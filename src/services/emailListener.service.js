const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { User } = require('../models');
const videoService = require('./video.service');
const config = require('../configs/config');
const fs = require('fs');
const path = require('path');
const mime = require('mime'); // 导入 mime 模块
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid'); // 用于生成唯一的文件名

const extractEmail = (fromText) => {
  const emailMatch = fromText.match(/<(.+?)>/);
  return emailMatch ? emailMatch[1] : fromText;
};

// Helper function to extract all email addresses from a text
const extractEmails = (text) => {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  return text.match(emailRegex) || [];
};

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
      console.error(`stderr: ${data}`);
    });

    genTagsProcess.on('close', (code) => {
      if (code === 0) {
        try {
          console.log('Python script output:', pythonOutput);
          const result = JSON.parse(pythonOutput);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error('Python script failed with code ' + code));
      }
    });
  });
}


const saveEmailReply = async (parsed, bodyBuffer) => {
  try {
    // Ensure the attachments directory exists
    const attachmentsDir = path.join(__dirname, '../../attachments');
    if (!fs.existsSync(attachmentsDir)) {
      fs.mkdirSync(attachmentsDir);
    }

    const email = {
      from: extractEmail(parsed.from.text),
      to: extractEmail(parsed.to.text),
      cc: parsed.cc ? extractEmail(parsed.cc.text) : undefined,
      subject: parsed.subject,
      date: parsed.date,
      content: bodyBuffer || 'No body content',
      attachments: [],
    };

    // Extract all email addresses from the email content
    const contentEmails = extractEmails(email.content.toLowerCase());
    // Remove duplicates by creating a Set
    const uniqueContentEmails = [...new Set(contentEmails)];

    // if (uniqueContentEmails.length === 0) {
    //   console.log('No email addresses found in email content.');
    //   return;
    // }
    let users = [];
    if (email.cc) {
      // 邮箱字符检查时忽略大小写
      const user = await User.findOne({ email: email.cc.toLowerCase() });
      if (user) {
        users.push(user);
        // console.log(`User found with email: ${email.cc}`);
      }
    }
    // [MARK] check 1
    if (users.length === 0) {
      console.log(`No user found with email: ${email.cc}`);
      // 查找用户并保存反馈信息
      const all_users = await User.find();
      // 邮箱字符检查时忽略大小写
      users = all_users.filter((user) =>
        // user.suppliers.some((supplier) => supplier.contact === email.from)
        user.suppliers.some((supplier) => supplier.contact?.toLowerCase() === email.from?.toLowerCase())
      );
    }
    // [MARK] check 2
    if (users.length === 0) {
      console.log(`No suppliers found with email: ${email.from}`);
      // Find all users whose suppliers have contact emails matching any of the extracted emails
      users = await User.find({
        'suppliers.contact': { $in: uniqueContentEmails },
      }).lean(); // Using lean() for better performance since we don't need full Mongoose documents here
    }
    // [MARK] check 3
    if (users.length === 0) {
      console.log(`No user found suppliers with email: ${uniqueContentEmails}`);
      return;
    }

    // Collect all matching suppliers across all users
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

    if (matchingSuppliers.length === 0) {
      console.log('No suppliers found matching email addresses in content.');
      return;
    }

    // Process attachments if any
    const pdfPaths = [];
    if (parsed.attachments && parsed.attachments.length > 0) {
      for (const att of parsed.attachments) {
        try {
          // Generate a unique filename
          const uniqueFileName = `${uuidv4()}.${mime.extension(att.contentType) || 'bin'}`;

          // Define the full path to save the attachment
          const filePath = path.join(attachmentsDir, uniqueFileName);

          // Save the attachment to the filesystem
          fs.writeFileSync(filePath, att.content);

          if (att.contentType === 'application/pdf' || att.contentType === 'pdf') {
            pdfPaths.push(filePath);
          } else if (att.contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
            pdfPaths.push(filePath);
          }

          const fileUrl = `/api/attachments/${uniqueFileName}`;

          console.log(`Attachment saved to: ${fileUrl}`);

          // Add attachment details to the email object
          email.attachments.push({
            filename: att.filename,
            contentType: att.contentType,
            size: att.size,
            content: fileUrl,
          });

          // Example: If you need to process the attachment further (e.g., parsing PDFs)
          // Uncomment and modify the following block as needed
          /*
          if (att.contentType === 'application/pdf') {
            const pythonProcess = spawn('python', [path.join(__dirname, '../python/parse_files.py'), filePath]);
            let pythonOutput = '';
            pythonProcess.stdout.on('data', (data) => {
              pythonOutput += data.toString();
            });
            pythonProcess.stderr.on('data', (data) => {
              console.error(`stderr: ${data}`);
            });
            pythonProcess.on('close', async (code) => {
              if (code === 0) {
                try {
                  const parsedData = JSON.parse(pythonOutput);
                  for (let { supplier, user } of matchingSuppliers) {
                    await videoService.createVideo({
                      title: att.filename,
                      path: fileUrl,
                      addedBy: user._id,
                      json: parsedData,
                      supplier: supplier._id,
                    });
                  }
                } catch (videoError) {
                  console.error('Error saving video information:', videoError);
                }
              } else {
                console.error('Error processing file with Python script');
              }
            });
          } else {
            // For non-PDF attachments or if not processing via Python
            const parsedData = {};
            for (let { supplier, user } of matchingSuppliers) {
              await videoService.createVideo({
                title: att.filename,
                path: fileUrl,
                addedBy: user._id,
                json: parsedData,
                supplier: supplier._id,
              });
            }
          }
          */

          // Since the Python processing is commented out, we'll handle non-PDF attachments here
          const parsedData = {};
          for (let { supplier, user } of matchingSuppliers) {
            await videoService.createVideo({
              title: att.filename,
              path: fileUrl,
              addedBy: user._id,
              json: parsedData, // Store parsed data if available
              supplier: supplier._id,
            });
          }
        } catch (attError) {
          console.error(`Error processing attachment ${att.filename}:`, attError);
        }
      }
    }

    const txtFileName = `${uuidv4()}.txt`;
    const txtFilePath = path.join(attachmentsDir, txtFileName);
    fs.writeFileSync(txtFilePath, email.content);

    const result = await runGenTagsScript(txtFilePath, pdfPaths);
    console.log('Python script result:', result);
    email.tags = result.tags;
    email.reply = result.reply;
    console.log('Email:', email);

    // Assign the email to each matching supplier
    for (let { supplier, user } of matchingSuppliers) {
      email.surveyId = supplier.chooseSurvey;
      // Push the email to the supplier's feedback
      supplier.feedback.push(email);

      // Update supplier's email sending status
      supplier.nextEmailSendTime = null;
      supplier.isEmailSent = false;

      // Save the user document
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

    console.log('Email successfully assigned to matching suppliers.');
  } catch (error) {
    console.error('Error in saveEmailReply:', error);
    // Optionally, rethrow the error or handle it as needed
  }
};

const emailListener = (io) => {
  const imapConfig = {
    user: config.email.imap.user,
    password: config.email.imap.password,
    host: config.email.imap.host,
    port: config.email.imap.port,
    tls: true,
    tlsOptions: {
      rejectUnauthorized: false,
    },
    keepalive: {
      interval: 30000, // 每隔30秒发送心跳包
      idleInterval: 300000, // 5分钟空闲后发送 NOOP
      forceNoop: true, // 如果服务器不支持 IDLE，强制使用 NOOP 命令
    },
    connectTimeout: 100000, // 设置连接超时为10秒
  };

  const imap = new Imap(imapConfig);
  imap.setMaxListeners(0); // 防止内存泄漏警告

  const connectToImap = () => {
    imap.connect();
  };

  const openInbox = (cb) => {
    imap.openBox('INBOX', false, cb); // 打开 INBOX，并确保有写权限（false 表示可写）
  };

  const processNewMessages = () => {
    imap.search(['UNSEEN'], (err, results) => {
      if (err) {
        console.error('Error searching for new emails:', err);
        return;
      }
      if (!results || !results.length) {
        console.log('No new unseen emails.');
        return;
      }

      const f = imap.fetch(results, {
        bodies: '',
        markSeen: true, // 标记邮件为已读
        struct: true,
      });

      f.on('message', (msg, seqno) => {
        let allBuffers = []; // 用于存储邮件内容

        msg.on('body', (stream) => {
          stream.on('data', (chunk) => {
            allBuffers.push(chunk); // 将所有数据块保存到数组中
          });
        });

        msg.once('end', async () => {
          try {
            const fullMessage = Buffer.concat(allBuffers).toString('utf8');

            simpleParser(fullMessage, async (err, parsed) => {
              if (err) {
                console.error('Error parsing email:', err);
                return;
              }

              try {
                // 保存邮件以及附件（如果有）
                await saveEmailReply(parsed, parsed.text || parsed.html);

                // 通过 WebSocket 发送给前端
                io.emit('newEmail', parsed);
                console.log('New email sent to front-end via WebSocket');
              } catch (saveError) {
                console.error('Error when saving and sending email:', saveError);
              }
            });
          } catch (e) {
            console.error('Error processing message:', e);
          }
        });
      });

      f.once('error', (err) => {
        console.error('Fetch error:', err);
      });

      f.once('end', () => {
        console.log('Done fetching unseen emails.');
      });
    });
  };

  imap.once('ready', () => {
    openInbox((err) => {
      if (err) {
        console.error('Error opening inbox:', err);
        return;
      }

      console.log('Mailbox opened, starting to listen for new emails...');
      processNewMessages();

      imap.on('mail', () => {
        console.log('New email detected, processing...');
        processNewMessages();
      });
    });
  });

  imap.once('error', (err) => {
    console.error('IMAP error:', err);
    // 根据错误类型进行处理
    if (err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND' || err.code === 'ECONNRESET') {
      console.log('IMAP 连接超时或被重置，正在尝试重新连接...');
      imap.end(); // 确保之前的连接已关闭
      setTimeout(connectToImap, 5000); // 等待5秒后重新连接
    } else {
      // 处理其他错误
      console.error('IMAP connection error:', err);
      // process.exit(1); // 或者根据需要采取其他措施
      // 重新连接
      setTimeout(connectToImap, 5000);
    }
  });

  imap.once('end', () => {
    console.log('IMAP connection ended, attempting to reconnect...');
    setTimeout(connectToImap, 5000); // 等待5秒后重新连接
  });

  imap.once('close', (hadError) => {
    console.log(`IMAP connection closed, hadError = ${hadError}`);
    if (hadError) {
      console.log('由于错误导致连接关闭，正在尝试重新连接...');
      setTimeout(connectToImap, 5000);
    } else {
      console.log('IMAP 连接正常关闭。');
    }
  });

  connectToImap();
};

module.exports = emailListener;
