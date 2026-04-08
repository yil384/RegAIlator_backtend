const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { User } = require('../models');
const videoService = require('./video.service');
const config = require('../configs/config');
const fs = require('fs');
const path = require('path');
const mime = require('mime');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const logger = require('../configs/logger');

const RECONNECT_DELAY = 5000;
const ATTACHMENTS_DIR = path.join(__dirname, '../../attachments');

// Extract email address from "Name <email>" format
const extractEmail = (fromText) => {
  const emailMatch = fromText.match(/<(.+?)>/);
  return emailMatch ? emailMatch[1] : fromText;
};

// Extract all email addresses from text content
const extractEmails = (text) => {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  return text.match(emailRegex) || [];
};

// Ensure attachments directory exists
const ensureAttachmentsDir = () => {
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
};

// Run Python gen_tags script and return parsed result
function runGenTagsScript(txtFilePath, pdfPaths) {
  return new Promise((resolve, reject) => {
    const genTagsProcess = spawn('python', [
      path.join(__dirname, '../python/gen_tags.py'),
      txtFilePath,
      pdfPaths.length,
      ...pdfPaths,
    ]);

    let pythonOutput = '';

    genTagsProcess.stdout.on('data', (data) => {
      pythonOutput += data.toString();
    });

    genTagsProcess.stderr.on('data', (data) => {
      logger.error(`gen_tags stderr: ${data}`);
    });

    genTagsProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(pythonOutput);
          resolve(result);
        } catch (err) {
          reject(new Error(`Failed to parse gen_tags output: ${err.message}`));
        }
      } else {
        reject(new Error(`gen_tags script exited with code ${code}`));
      }
    });

    genTagsProcess.on('error', (err) => {
      reject(new Error(`Failed to spawn gen_tags process: ${err.message}`));
    });
  });
}

// Find users matching the email sender/content
const findMatchingUsers = async (email, uniqueContentEmails) => {
  // Check 1: match by CC email
  if (email.cc) {
    const user = await User.findOne({ email: email.cc.toLowerCase() });
    if (user) return [user];
  }

  // Check 2: match by supplier contact matching sender
  const allUsers = await User.find();
  const matchedBySender = allUsers.filter((user) =>
    user.suppliers.some((supplier) => supplier.contact?.toLowerCase() === email.from?.toLowerCase())
  );
  if (matchedBySender.length > 0) return matchedBySender;

  // Check 3: match by supplier contact in email content
  if (uniqueContentEmails.length > 0) {
    const matchedByContent = await User.find({
      'suppliers.contact': { $in: uniqueContentEmails },
    }).lean();
    if (matchedByContent.length > 0) return matchedByContent;
  }

  return [];
};

// Find suppliers within users that match the email
const findMatchingSuppliers = (users, email, uniqueContentEmails) => {
  let matchingSuppliers = [];
  for (const user of users) {
    const matched = user.suppliers
      .filter(
        (supplier) =>
          supplier.contact?.toLowerCase() === email.from?.toLowerCase() ||
          (supplier.contact && uniqueContentEmails.includes(supplier.contact.toLowerCase()))
      )
      .map((supplier) => ({ supplier, user }));
    matchingSuppliers = matchingSuppliers.concat(matched);
  }
  return matchingSuppliers;
};

// Process and save email attachments
const processAttachments = async (parsedAttachments) => {
  const emailAttachments = [];
  const pdfPaths = [];

  if (!parsedAttachments || parsedAttachments.length === 0) {
    return { emailAttachments, pdfPaths };
  }

  for (const att of parsedAttachments) {
    try {
      const uniqueFileName = `${uuidv4()}.${mime.extension(att.contentType) || 'bin'}`;
      const filePath = path.join(ATTACHMENTS_DIR, uniqueFileName);

      fs.writeFileSync(filePath, att.content);

      if (att.contentType === 'application/pdf' || att.contentType === 'pdf') {
        pdfPaths.push(filePath);
      } else if (att.contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        pdfPaths.push(filePath);
      }

      const fileUrl = `/api/attachments/${uniqueFileName}`;
      emailAttachments.push({
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
        content: fileUrl,
      });
    } catch (attError) {
      logger.error(`Error processing attachment ${att.filename}: ${attError.message}`);
    }
  }

  return { emailAttachments, pdfPaths };
};

// Save email reply to matching suppliers in database
const saveEmailReply = async (parsed, bodyBuffer) => {
  try {
    ensureAttachmentsDir();

    const email = {
      from: extractEmail(parsed.from.text),
      to: extractEmail(parsed.to.text),
      cc: parsed.cc ? extractEmail(parsed.cc.text) : undefined,
      subject: parsed.subject,
      date: parsed.date,
      content: bodyBuffer || 'No body content',
      attachments: [],
    };

    const contentEmails = extractEmails(email.content.toLowerCase());
    const uniqueContentEmails = [...new Set(contentEmails)];

    // Find matching users
    const users = await findMatchingUsers(email, uniqueContentEmails);
    if (users.length === 0) {
      logger.info(`No matching users found for email from: ${email.from}`);
      return;
    }

    // Find matching suppliers
    const matchingSuppliers = findMatchingSuppliers(users, email, uniqueContentEmails);
    if (matchingSuppliers.length === 0) {
      logger.info('No suppliers found matching email addresses.');
      return;
    }

    // Process attachments
    const { emailAttachments, pdfPaths } = await processAttachments(parsed.attachments);
    email.attachments = emailAttachments;

    // Create video records for each attachment
    for (const att of emailAttachments) {
      const parsedData = {};
      for (const { supplier, user } of matchingSuppliers) {
        await videoService.createVideo({
          title: att.filename,
          path: att.content,
          addedBy: user._id,
          json: parsedData,
          supplier: supplier._id,
        });
      }
    }

    // Run AI tagging on email content
    const txtFileName = `${uuidv4()}.txt`;
    const txtFilePath = path.join(ATTACHMENTS_DIR, txtFileName);
    fs.writeFileSync(txtFilePath, email.content);

    try {
      const result = await runGenTagsScript(txtFilePath, pdfPaths);
      email.tags = result.tags;
      email.reply = result.reply;
    } catch (tagError) {
      logger.error(`Tag generation failed: ${tagError.message}`);
      email.tags = [];
      email.reply = null;
    }

    // Assign email feedback to each matching supplier
    for (const { supplier, user } of matchingSuppliers) {
      email.surveyId = supplier.chooseSurvey;

      await User.updateOne(
        { _id: user._id, 'suppliers._id': supplier._id },
        {
          $push: { 'suppliers.$.feedback': email },
          $set: {
            'suppliers.$.nextEmailSendTime': null,
            'suppliers.$.isEmailSent': false,
          },
        }
      );
    }

    logger.info('Email successfully assigned to matching suppliers.');
  } catch (error) {
    logger.error(`Error in saveEmailReply: ${error.message}`);
  }
};

// Main email listener - creates IMAP connection with proper lifecycle management
const emailListener = (io) => {
  let imap = null;
  let isShuttingDown = false;

  const createImapConfig = () => ({
    user: config.email.imap.user,
    password: config.email.imap.password,
    host: config.email.imap.host,
    port: config.email.imap.port,
    tls: true,
    tlsOptions: {
      rejectUnauthorized: false,
    },
    keepalive: {
      interval: 30000,
      idleInterval: 300000,
      forceNoop: true,
    },
    connectTimeout: 100000,
  });

  const processNewMessages = () => {
    if (!imap || imap.state !== 'authenticated') return;

    imap.search(['UNSEEN'], (err, results) => {
      if (err) {
        logger.error(`Error searching for new emails: ${err.message}`);
        return;
      }
      if (!results || !results.length) {
        logger.info('No new unseen emails.');
        return;
      }

      const f = imap.fetch(results, {
        bodies: '',
        markSeen: true,
        struct: true,
      });

      f.on('message', (msg) => {
        let allBuffers = [];

        msg.on('body', (stream) => {
          stream.on('data', (chunk) => {
            allBuffers.push(chunk);
          });
        });

        msg.once('end', () => {
          const fullMessage = Buffer.concat(allBuffers).toString('utf8');

          simpleParser(fullMessage, async (parseErr, parsed) => {
            if (parseErr) {
              logger.error(`Error parsing email: ${parseErr.message}`);
              return;
            }

            try {
              await saveEmailReply(parsed, parsed.text || parsed.html);
              io.emit('newEmail', parsed);
              logger.info('New email processed and sent to front-end via WebSocket');
            } catch (saveError) {
              logger.error(`Error saving/sending email: ${saveError.message}`);
            }
          });
        });
      });

      f.once('error', (fetchErr) => {
        logger.error(`Fetch error: ${fetchErr.message}`);
      });

      f.once('end', () => {
        logger.info('Done fetching unseen emails.');
      });
    });
  };

  const connect = () => {
    if (isShuttingDown) return;

    // Clean up previous instance
    if (imap) {
      try {
        imap.removeAllListeners();
        imap.end();
      } catch (e) {
        // Ignore cleanup errors
      }
      imap = null;
    }

    // Create fresh IMAP instance for each connection attempt
    imap = new Imap(createImapConfig());

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) {
          logger.error(`Error opening inbox: ${err.message}`);
          scheduleReconnect();
          return;
        }

        logger.info('Mailbox opened, listening for new emails...');
        processNewMessages();

        imap.on('mail', () => {
          logger.info('New email detected, processing...');
          processNewMessages();
        });
      });
    });

    imap.once('error', (err) => {
      logger.error(`IMAP error: ${err.message}`);
      scheduleReconnect();
    });

    imap.once('end', () => {
      logger.info('IMAP connection ended.');
      scheduleReconnect();
    });

    imap.once('close', (hadError) => {
      if (hadError) {
        logger.error('IMAP connection closed due to error.');
      }
      // Reconnect is already scheduled by 'end' or 'error' handler
    });

    try {
      imap.connect();
    } catch (err) {
      logger.error(`IMAP connect failed: ${err.message}`);
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (isShuttingDown) return;
    logger.info(`Scheduling IMAP reconnect in ${RECONNECT_DELAY / 1000}s...`);
    setTimeout(connect, RECONNECT_DELAY);
  };

  // Graceful shutdown support
  process.once('SIGTERM', () => {
    isShuttingDown = true;
    if (imap) {
      try {
        imap.removeAllListeners();
        imap.end();
      } catch (e) {
        // Ignore cleanup errors on shutdown
      }
    }
  });

  connect();
};

module.exports = emailListener;
