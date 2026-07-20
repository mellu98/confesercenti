const express = require('express');
const { db, getSetting, sanitizePublicUrl } = require('../db');
const { sendContactMail } = require('../mailer');

const router = express.Router();
const CONTACT_WINDOW_MS = 10 * 60 * 1000;
const CONTACT_LIMIT = 5;
const MAX_CONTACT_IPS = 2000;
const contactAttempts = new Map();

const publicItem = item => item && { ...item, link: sanitizePublicUrl(item.link) };
const list = (type, limit = 100) =>
  db.prepare('SELECT * FROM items WHERE type=? AND published=1 ORDER BY sort ASC, created_at DESC LIMIT ?').all(type, limit).map(publicItem);
const one = (type, slug) =>
  publicItem(db.prepare('SELECT * FROM items WHERE type=? AND slug=? AND published=1').get(type, slug));
const safely = handler => (req, res, next) => {
  try { return handler(req, res, next); } catch (error) { return next(error); }
};
const reportMailError = error => console.error('[mailer] invio fallito:', error?.message || error);
const contactRetryAfter = (ip, now = Date.now()) => {
  const key = String(ip || 'unknown').slice(0, 80);
  let attempt = contactAttempts.get(key);
  if (!attempt || attempt.resetAt <= now) {
    if (attempt) contactAttempts.delete(key);
    else if (contactAttempts.size >= MAX_CONTACT_IPS) contactAttempts.delete(contactAttempts.keys().next().value);
    attempt = { count: 0, resetAt: now + CONTACT_WINDOW_MS };
    contactAttempts.set(key, attempt);
  }
  attempt.count = Math.min(attempt.count + 1, CONTACT_LIMIT + 1);
  return attempt.count > CONTACT_LIMIT ? Math.max(1, Math.ceil((attempt.resetAt - now) / 1000)) : 0;
};

router.get('/', (req, res) => {
  res.render('public/home', {
    home: getSetting('home', {}),
    servizi: list('servizio', 6),
    convenzioni: list('convenzione', 4),
    notizie: list('notizia', 3),
    partner: list('partner', 8)
  });
});

router.get('/associazione', (req, res) =>
  res.render('public/associazione', { page: getSetting('associazione', {}) }));

router.get('/servizi', (req, res) =>
  res.render('public/servizi', { servizi: list('servizio') }));

router.get('/convenzioni', (req, res) =>
  res.render('public/convenzioni', { convenzioni: list('convenzione') }));

router.get('/notizie', (req, res) =>
  res.render('public/notizie', { titolo: 'Notizie', base: '/notizie', posts: list('notizia') }));

router.get('/notizie/:slug', (req, res, next) => {
  const post = one('notizia', req.params.slug);
  if (!post) return next();
  res.render('public/post', { post, back: '/notizie', backLabel: 'Notizie' });
});

router.get('/stampa', (req, res) =>
  res.render('public/notizie', { titolo: 'Sala stampa', base: '/stampa', posts: list('stampa') }));

router.get('/stampa/:slug', (req, res, next) => {
  const post = one('stampa', req.params.slug);
  if (!post) return next();
  res.render('public/post', { post, back: '/stampa', backLabel: 'Sala stampa' });
});

router.get('/partnership', (req, res) =>
  res.render('public/partnership', { partner: list('partner') }));

router.get('/partnership/:slug', (req, res, next) => {
  const p = one('partner', req.params.slug);
  if (!p) return next();
  res.render('public/partner-detail', { p });
});

router.get('/contatti', (req, res) =>
  res.render('public/contatti', { page: getSetting('contatti', {}), sent: req.query.ok === '1', error: null }));

router.post('/contatti', safely((req, res) => {
  const { name, email, phone, subject, body, website } = req.body;
  if (website) return res.redirect('/contatti?ok=1'); // honeypot anti-spam
  const retryAfter = contactRetryAfter(req.ip);
  if (retryAfter) {
    res.set('Retry-After', String(retryAfter));
    return res.status(429).render('public/contatti', {
      page: getSetting('contatti', {}), sent: false,
      error: 'Troppe richieste in poco tempo. Attendi qualche minuto e riprova.'
    });
  }
  if (!name || !email || !body) {
    return res.status(400).render('public/contatti', {
      page: getSetting('contatti', {}), sent: false,
      error: 'Compila i campi obbligatori (nome, email, messaggio).'
    });
  }
  const msg = {
    name: String(name).slice(0, 120),
    email: String(email).slice(0, 160),
    phone: String(phone || '').slice(0, 40),
    subject: String(subject || '').slice(0, 160),
    body: String(body).slice(0, 4000)
  };
  db.prepare('INSERT INTO messages (name,email,phone,subject,body) VALUES (?,?,?,?,?)')
    .run(msg.name, msg.email, msg.phone, msg.subject, msg.body);
  try {
    const pendingMail = sendContactMail(msg, res.locals.site.email);
    if (pendingMail?.catch) pendingMail.catch(reportMailError);
  } catch (error) { reportMailError(error); }
  res.redirect('/contatti?ok=1');
}));

module.exports = router;
