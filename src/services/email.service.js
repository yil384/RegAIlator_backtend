const nodemailer = require('nodemailer');
const config = require('../configs/config');
const logger = require('../configs/logger');

const transport = nodemailer.createTransport(config.email.smtp);
/* istanbul ignore next */
if (config.env !== 'test') {
  transport
    .verify()
    .then(() => logger.info('Connected to email server'))
    .catch((error) => {
      logger.warn('Unable to connect to email server. Make sure you have configured the SMTP options in .env');
      logger.error('Error details:', error); // 输出错误详情
    });
}

/**
 * Send an email
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @returns {Promise}
 */
const sendEmail = async (to, subject, text) => {
  const msg = { from: config.email.smtp.auth.user, to, subject, text };
  await transport.sendMail(msg);
};

/**
 * Send reset password email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendResetPasswordEmail = async (to, token) => {
  const subject = 'Reset password';
  // replace this url with the link to the reset password page of your front-end app
  const resetPasswordUrl = `${config.web_host}/reset-password?token=${token}`;
  const text = `Dear user,
To reset your password, click on this link: ${resetPasswordUrl}
If you did not request any password resets, then ignore this email.`;
  await sendEmail(to, subject, text);
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendVerificationEmail = async (to, token) => {
  const subject = 'Email Verification';
  // replace this url with the link to the email verification page of your front-end app
  const verificationEmailUrl = `${config.web_host}/verify-email?token=${token}`;
  const text = `Dear user,

Welcome to The Regailator.

To verify your email, click on this link: ${verificationEmailUrl}
If you did not create an account, then ignore this email.`;
  await sendEmail(to, subject, text);
};

const sendMentionEmail = async (to, subject, html, attachments = null, cc = null) => {
  const msg = { from: config.email.smtp.auth.user, to, subject, html, cc, attachments };
  await transport.sendMail(msg);
};

const sendReplyEmail = async (to, subject, text, cc = null) => {
  const msg = { from: config.email.smtp.auth.user, to, subject, text, cc };
  console.log('msg: ', msg);
  await transport.sendMail(msg);
};

module.exports = {
  transport,
  sendEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
  sendMentionEmail,
  sendReplyEmail,
};
