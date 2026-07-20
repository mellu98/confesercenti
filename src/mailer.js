const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
}

async function sendContactMail(msg, siteEmail) {
  if (!transporter) return; // SMTP non configurato: il messaggio resta comunque salvato nell'admin
  const to = process.env.MAIL_TO || siteEmail;
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      replyTo: msg.email,
      subject: `[Sito] ${msg.subject || 'Nuovo messaggio'} — ${msg.name}`,
      text: `Nome: ${msg.name}\nEmail: ${msg.email}\nTelefono: ${msg.phone || '-'}\nOggetto: ${msg.subject || '-'}\n\n${msg.body}`
    });
  } catch (e) {
    console.error('[mailer] invio fallito:', e.message);
  }
}

module.exports = { sendContactMail };
