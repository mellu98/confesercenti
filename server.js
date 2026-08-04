const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;

if (isProduction && !sessionSecret) {
  throw new Error('SESSION_SECRET is required in production');
}

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cookieSession = require('cookie-session');
const { db, DATA_DIR, getSetting, sanitizePublicUrl } = require('./src/db');

const effectiveSessionSecret = sessionSecret || crypto.randomBytes(32).toString('hex');

const app = express();
app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads'), { maxAge: '7d' }));

app.use(cookieSession({
  name: 'cpsess',
  keys: [effectiveSessionSecret],
  maxAge: 8 * 60 * 60 * 1000, // 8h
  sameSite: 'lax',
  httpOnly: true,
  secure: isProduction
}));

// dati globali per tutte le view
app.use((req, res, next) => {
  res.locals.site = getSetting('site', {});
  res.locals.user = req.session.user || null;
  res.locals.path = req.path;
  if (!req.path.startsWith('/admin')) {
    const all = db.prepare("SELECT * FROM items WHERE type='banner' AND published=1 ORDER BY sort ASC").all()
      .map(banner => ({ ...banner, link: sanitizePublicUrl(banner.link) }));
    res.locals.banners = {
      sidebar: all.filter(b => b.tag === 'sidebar'),
      bottom: all.filter(b => b.tag === 'bottom')
    };
  } else {
    res.locals.banners = { sidebar: [], bottom: [] };
  }
  next();
});

app.use('/', require('./src/routes/public'));
app.use('/admin', require('./src/routes/admin'));

app.use((req, res) => res.status(404).render('public/404'));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Errore interno');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Pavia Esercenti in ascolto su :${PORT}`));
