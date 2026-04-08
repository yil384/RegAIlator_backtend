/**
 * @module services/emailListener
 * @description Persistent IMAP email listener that ingests supplier reply emails.
 *
 * ## How it works (high-level flow)
 *
 * 1. **Connect** -- Opens a long-lived IMAP connection to the configured mailbox
 *    and listens for new (UNSEEN) messages. Reconnects automatically on failure.
 *
 * 2. **Match** -- When a new email arrives, the service must figure out which
 *    internal User(s) and Supplier(s) it relates to. Matching uses a 3-tier
 *    priority strategy (see {@link findMatchingUsers}):
 *      a. CC field matches a registered user's email address.
 *      b. Sender address matches a supplier's `contact` field.
 *      c. Email addresses found *inside the body text* match a supplier's contact.
 *    This multi-tier approach is necessary because suppliers often forward or
 *    reply from different addresses, and sometimes include the relevant contact
 *    only in the message body (e.g., signature blocks, forwarded headers).
 *
 * 3. **Process attachments** -- Files are saved to disk under `/attachments/`
 *    with UUID filenames and recorded as Video documents (the "Video" model is
 *    a general-purpose file record, not limited to video files).
 *
 * 4. **AI tagging** -- The email body (and any PDF/XLSX attachments) are sent
 *    to a Python script (`gen_tags.py`) that uses AI to extract compliance tags
 *    and draft a suggested reply. Results are stored on the feedback entry.
 *
 * 5. **Persist** -- The parsed email is pushed into the matching supplier's
 *    `feedback[]` array and the supplier's email-reminder timer is reset
 *    (`nextEmailSendTime = null, isEmailSent = false`) since a reply was received.
 *
 * 6. **Notify** -- A WebSocket event (`newEmail`) is emitted via Socket.IO so
 *    the frontend can update in real time.
 */
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

/**
 * Extract a bare email address from an RFC 5322 "display name" format string.
 * e.g., "John Doe <john@example.com>" -> "john@example.com"
 * If no angle brackets are found, returns the input as-is (already bare).
 * @param {string} fromText - Raw sender/recipient string from the email header
 * @returns {string} The extracted email address
 */
const extractEmail = (fromText) => {
  const emailMatch = fromText.match(/<(.+?)>/);
  return emailMatch ? emailMatch[1] : fromText;
};

/**
 * Scan free text and return all email addresses found within it.
 * Used to discover supplier contacts mentioned in the email body (e.g., in
 * forwarded headers, signature blocks, or inline references).
 * @param {string} text - The email body content to scan
 * @returns {string[]} Array of email addresses found (may contain duplicates)
 */
const extractEmails = (text) => {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  return text.match(emailRegex) || [];
};

// Ensure attachments directory exists
const ensureAttachmentsDir = () => {
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
};

/**
 * Invoke the Python AI tagging script (`gen_tags.py`) as a child process.
 * The script reads the email body text file and any PDF/XLSX attachments,
 * then returns a JSON object with `tags` (string[]) and `reply` (object|null).
 * @param {string} txtFilePath - Absolute path to a .txt file containing the email body
 * @param {string[]} pdfPaths - Absolute paths to PDF/XLSX attachment files
 * @returns {Promise<{tags: string[], reply: {subject: string, content: string}|null}>}
 */
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

/**
 * Find which User document(s) an incoming email relates to.
 * Uses a 3-tier priority strategy -- stops at the first tier that yields results:
 *   1. CC address matches a registered user email (the sender explicitly CC'd our user).
 *   2. Sender address matches a supplier's `contact` field on any user.
 *   3. Email addresses extracted from the body match a supplier's contact.
 * @param {Object} email - Parsed email object with `from`, `to`, `cc` fields
 * @param {string[]} uniqueContentEmails - De-duplicated emails found in the body text
 * @returns {Promise<User[]>} Matching user documents (may be empty)
 */
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

/**
 * Given the matched user(s), drill down to find which specific supplier
 * subdocuments the email corresponds to. A supplier matches if its `contact`
 * field equals the sender address OR appears in the body-extracted emails.
 * Returns pairs of {supplier, user} so callers know where to persist feedback.
 * @param {User[]} users - User documents returned by {@link findMatchingUsers}
 * @param {Object} email - Parsed email with `from` field
 * @param {string[]} uniqueContentEmails - De-duplicated emails from the body
 * @returns {{supplier: Object, user: User}[]} Array of matched supplier-user pairs
 */
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

/**
 * Save email attachments to disk and classify them for downstream processing.
 * Each file is written with a UUID filename to avoid collisions. PDFs and XLSX
 * files are tracked separately in `pdfPaths` so they can be sent to the AI
 * tagging script for content extraction.
 * @param {Object[]} parsedAttachments - Attachment objects from mailparser
 * @returns {Promise<{emailAttachments: Object[], pdfPaths: string[]}>}
 *   emailAttachments: metadata array stored in the feedback entry
 *   pdfPaths: absolute file paths to PDF/XLSX files for AI processing
 */
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

/**
 * Top-level orchestrator for processing a single incoming email.
 * Coordinates the full pipeline: extract addresses -> find matching users/suppliers
 * -> save attachments -> run AI tagging -> persist feedback and reset reminder state.
 * @param {Object} parsed - The mailparser-parsed email object
 * @param {string} bodyBuffer - The plain-text or HTML body content
 */
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

/**
 * Initialize the persistent IMAP email listener.
 * Creates a long-lived connection that watches the INBOX for new messages and
 * automatically reconnects on failure. The IMAP `mail` event triggers processing
 * of unseen messages. Each new email is parsed, matched to suppliers, and
 * broadcast to connected clients via Socket.IO.
 *
 * Lifecycle: connect -> open INBOX -> process unseen -> listen for `mail` events.
 * On disconnect/error: cleanup old instance -> wait RECONNECT_DELAY -> reconnect.
 * On SIGTERM: gracefully close without reconnecting.
 *
 * @param {import('socket.io').Server} io - Socket.IO server instance for real-time
 *   notifications to the frontend (emits 'newEmail' events)
 */
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
