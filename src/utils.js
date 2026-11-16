const nodemailer = require("nodemailer");

async function sendMail({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`Email not sent (SMTP not configured): ${subject} -> ${to}`);
    return false;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({
    from: {
      name: process.env.SMTP_FROM_NAME || "EventHub",
      address: process.env.SMTP_FROM || process.env.SMTP_USER
    },
    to, subject, text, html
  });
  return true;
}

module.exports = { sendMail };
