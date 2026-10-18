import nodemailer from 'nodemailer';

let transporter;

const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]));

const getTransporter = () => {
  if (transporter) return transporter;

  const port = Number(process.env.SMTP_PORT || 587);
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) throw new Error('Email service is not configured');

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user, pass },
  });

  return transporter;
};

export const sendPasswordResetEmail = async ({ email, name, resetUrl }) => {
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error('EMAIL_FROM is not configured');

  await getTransporter().sendMail({
    from,
    to: email,
    subject: 'Reset your OpSync password',
    text: `Hello ${name},\n\nUse this link to reset your OpSync password:\n${resetUrl}\n\nThis link expires in 15 minutes and can only be used once. If you did not request this, you can ignore this email.`,
    html: `<p>Hello ${escapeHtml(name)},</p><p>Use the link below to reset your OpSync password.</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p><p>This link expires in 15 minutes and can only be used once.</p><p>If you did not request this, you can ignore this email.</p>`,
  });
};

export const sendEmailVerificationEmail = async ({ email, name, verificationUrl }) => {
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error('EMAIL_FROM is not configured');

  await getTransporter().sendMail({
    from,
    to: email,
    subject: 'Verify your OpSync email',
    text: `Hello ${name},\n\nVerify your OpSync email using this link:\n${verificationUrl}\n\nThis link expires in 30 minutes and can only be used once.`,
    html: `<p>Hello ${escapeHtml(name)},</p><p>Verify your OpSync email using the link below.</p><p><a href="${escapeHtml(verificationUrl)}">Verify email</a></p><p>This link expires in 30 minutes and can only be used once.</p>`,
  });
};
