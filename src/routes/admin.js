const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { db, DATA_DIR, getSetting, setSetting, hashPassword, verifyPassword, slugify } = require('../db');

const router = express.Router();

// ---- upload immagini ----
const storage = multer.diskStorage({
  destination: path.join(DATA_DIR, 'uploads'),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    cb(null, crypto.randomBytes(8).toString('hex') + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(png|jpe?g|webp|gif|svg)/.test(file.mimetype))
});

// ---- auth ----
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/admin/login');
  next();
}
function requireSuper(req, res, next) {
  if (req.session.user?.role !== 'superadmin') return res.status(403).send('Riservato al super admin');
  next();
}

const TYPES = {
  servizi:     { type: 'servizio',    label: 'Servizi' },
  convenzioni: { type: 'convenzione', label: 'Convenzioni' },
  notizie:     { type: 'notizia',     label: 'Notizie' },
  stampa:      { type: 'stampa',      label: 'Sala stampa' },
  partnership: { type: 'partner',     label: 'Partnership' },
  banner:      { type: 'banner',      label: 'Banner ADV' }
};

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

router.post('/login', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body.email || '').trim().toLowerCase());
  if (!u || !verifyPassword(req.body.password || '', u.pass_hash)) {
    return res.status(401).render('admin/login', { error: 'Credenziali non valide' });
  }
  req.session.user = { id: u.id, email: u.email, name: u.name, role: u.role };
  res.redirect('/admin');
});

router.get('/logout', (req, res) => { req.session = null; res.redirect('/admin/login'); });

router.use(requireAuth);

router.get('/', (req, res) => {
  const counts = {};
  for (const [k, v] of Object.entries(TYPES)) {
    counts[k] = db.prepare('SELECT COUNT(*) c FROM items WHERE type=?').get(v.type).c;
  }
  counts.messaggi = db.prepare('SELECT COUNT(*) c FROM messages WHERE read=0').get().c;
  res.render('admin/dashboard', { counts, TYPES });
});

// ---- impostazioni / pagine ----
router.get('/impostazioni', (req, res) => {
  res.render('admin/impostazioni', {
    s: getSetting('site', {}), h: getSetting('home', {}),
    a: getSetting('associazione', {}), c: getSetting('contatti', {}),
    saved: req.query.ok === '1'
  });
});

router.post('/impostazioni', (req, res) => {
  const b = req.body;
  setSetting('site', {
    name: b.name, tagline: b.tagline, email: b.email, phone: b.phone,
    address: b.address, hours: b.hours,
    facebook: b.facebook || '', instagram: b.instagram || '', linkedin: b.linkedin || ''
  });
  setSetting('home', {
    hero_title: b.hero_title, hero_text: b.hero_text, hero_cta: b.hero_cta,
    stat1_n: b.stat1_n, stat1_t: b.stat1_t, stat2_n: b.stat2_n,
    stat2_t: b.stat2_t, stat3_n: b.stat3_n, stat3_t: b.stat3_t
  });
  setSetting('associazione', { title: b.a_title, intro: b.a_intro, body: b.a_body });
  setSetting('contatti', { intro: b.c_intro });
  res.redirect('/admin/impostazioni?ok=1');
});

// ---- CRUD contenuti ----
router.get('/contenuti/:sec', (req, res, next) => {
  const cfg = TYPES[req.params.sec];
  if (!cfg) return next();
  const items = db.prepare('SELECT * FROM items WHERE type=? ORDER BY sort ASC, created_at DESC').all(cfg.type);
  res.render('admin/lista', { sec: req.params.sec, cfg, items });
});

router.get('/contenuti/:sec/nuovo', (req, res, next) => {
  const cfg = TYPES[req.params.sec];
  if (!cfg) return next();
  res.render('admin/editor', { sec: req.params.sec, cfg, item: null });
});

router.get('/contenuti/:sec/:id', (req, res, next) => {
  const cfg = TYPES[req.params.sec];
  if (!cfg) return next();
  const item = db.prepare('SELECT * FROM items WHERE id=? AND type=?').get(req.params.id, cfg.type);
  if (!item) return next();
  res.render('admin/editor', { sec: req.params.sec, cfg, item });
});

router.post('/contenuti/:sec/salva', upload.single('image'), (req, res, next) => {
  const cfg = TYPES[req.params.sec];
  if (!cfg) return next();
  const b = req.body;
  let slug = slugify(b.slug || b.title);
  const dup = db.prepare('SELECT id FROM items WHERE type=? AND slug=? AND id != ?').get(cfg.type, slug, b.id || 0);
  if (dup) slug += '-' + Date.now().toString(36);
  const data = {
    title: b.title, slug, excerpt: b.excerpt || '', body: b.body || '',
    link: b.link || '', tag: b.tag || '', sort: Number(b.sort) || 0,
    published: b.published ? 1 : 0,
    image: req.file ? '/uploads/' + req.file.filename : (b.current_image || '')
  };
  if (b.id) {
    db.prepare(`UPDATE items SET title=@title, slug=@slug, excerpt=@excerpt, body=@body, link=@link,
      tag=@tag, sort=@sort, published=@published, image=@image, updated_at=datetime('now')
      WHERE id=@id AND type=@type`).run({ ...data, id: b.id, type: cfg.type });
  } else {
    db.prepare(`INSERT INTO items (type,title,slug,excerpt,body,link,tag,sort,published,image)
      VALUES (@type,@title,@slug,@excerpt,@body,@link,@tag,@sort,@published,@image)`)
      .run({ ...data, type: cfg.type });
  }
  res.redirect('/admin/contenuti/' + req.params.sec);
});

router.post('/contenuti/:sec/:id/elimina', (req, res, next) => {
  const cfg = TYPES[req.params.sec];
  if (!cfg) return next();
  db.prepare('DELETE FROM items WHERE id=? AND type=?').run(req.params.id, cfg.type);
  res.redirect('/admin/contenuti/' + req.params.sec);
});

// ---- messaggi ----
router.get('/messaggi', (req, res) => {
  const msgs = db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 200').all();
  db.prepare('UPDATE messages SET read=1').run();
  res.render('admin/messaggi', { msgs });
});

router.post('/messaggi/:id/elimina', (req, res) => {
  db.prepare('DELETE FROM messages WHERE id=?').run(req.params.id);
  res.redirect('/admin/messaggi');
});

// ---- utenti (solo super admin) ----
router.get('/utenti', requireSuper, (req, res) => {
  const users = db.prepare('SELECT id,email,name,role,created_at FROM users ORDER BY id').all();
  res.render('admin/utenti', { users, error: req.query.err || null });
});

router.post('/utenti/nuovo', requireSuper, (req, res) => {
  const { email, name, password, role } = req.body;
  if (!email || !name || !password || password.length < 8) {
    return res.redirect('/admin/utenti?err=' + encodeURIComponent('Dati mancanti o password troppo corta (min 8).'));
  }
  try {
    db.prepare('INSERT INTO users (email,name,pass_hash,role) VALUES (?,?,?,?)')
      .run(email.trim().toLowerCase(), name, hashPassword(password), role === 'superadmin' ? 'superadmin' : 'editor');
  } catch {
    return res.redirect('/admin/utenti?err=' + encodeURIComponent('Email già registrata.'));
  }
  res.redirect('/admin/utenti');
});

router.post('/utenti/:id/elimina', requireSuper, (req, res) => {
  if (Number(req.params.id) === req.session.user.id) return res.redirect('/admin/utenti?err=Non puoi eliminare te stesso');
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.redirect('/admin/utenti');
});

// ---- cambio password personale ----
router.post('/password', (req, res) => {
  const { current, next: np } = req.body;
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.session.user.id);
  if (!u || !verifyPassword(current || '', u.pass_hash) || !np || np.length < 8) {
    return res.redirect('/admin/impostazioni?ok=0');
  }
  db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(hashPassword(np), u.id);
  res.redirect('/admin/impostazioni?ok=1');
});

module.exports = router;
