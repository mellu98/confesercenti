const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ALLOWED_PUBLIC_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function sanitizePublicUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ALLOWED_PUBLIC_URL_PROTOCOLS.has(url.protocol) ? url.href : '';
  } catch { return ''; }
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const db = new Database(path.join(DATA_DIR, 'site.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor', -- 'superadmin' | 'editor'
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,           -- 'servizio' | 'convenzione' | 'notizia' | 'stampa' | 'partner'
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT DEFAULT '',
  body TEXT DEFAULT '',
  image TEXT DEFAULT '',
  link TEXT DEFAULT '',
  tag TEXT DEFAULT '',
  sort INTEGER DEFAULT 0,
  published INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_type_slug ON items(type, slug);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  body TEXT NOT NULL,
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// ---------- password helpers (no native deps) ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(pw, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

// ---------- settings helpers ----------
function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return fallback; }
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, JSON.stringify(value));
}

function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item';
}

// ---------- seed ----------
function seed() {
  if (!db.prepare('SELECT COUNT(*) c FROM users').get().c) {
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const pw = process.env.ADMIN_PASSWORD;
    if (!pw) throw new Error('ADMIN_PASSWORD is required when creating the first user');
    db.prepare('INSERT INTO users (email,name,pass_hash,role) VALUES (?,?,?,?)')
      .run(email, 'Super Admin', hashPassword(pw), 'superadmin');
    console.log(`[seed] Super admin creato: ${email}`);
  }

  if (getSetting('site') === null) {
    setSetting('site', {
      name: 'Pavia Esercenti',
      tagline: 'Al fianco delle imprese del commercio, del turismo e dei servizi di Pavia e provincia.',
      email: 'info@confesercentipavia.it',
      phone: '0382 000000',
      address: 'Via Roma 1, 27100 Pavia (PV)',
      hours: 'Lun–Ven 8:30–13:00 / 14:00–17:30',
      facebook: '', instagram: '', linkedin: ''
    });
    setSetting('home', {
      hero_title: 'La forza delle imprese di Pavia',
      hero_text: 'Rappresentiamo e tuteliamo commercianti, artigiani e piccole imprese del territorio pavese. Servizi, convenzioni e assistenza su misura per far crescere la tua attività.',
      hero_cta: 'Diventa socio',
      stat1_n: '1.500+', stat1_t: 'Imprese associate',
      stat2_n: '40+', stat2_t: 'Anni sul territorio',
      stat3_n: '20+', stat3_t: 'Servizi dedicati'
    });
    setSetting('associazione', {
      title: 'Chi siamo',
      intro: 'Pavia Esercenti è l’associazione di categoria che rappresenta le piccole e medie imprese del commercio, del turismo, dell’artigianato e dei servizi della provincia di Pavia, in associazione con Confesercenti.',
      body: 'Dal nostro insediamento sul territorio lavoriamo ogni giorno al fianco degli imprenditori: dialoghiamo con le istituzioni locali, promuoviamo lo sviluppo economico della provincia e offriamo servizi concreti a chi fa impresa.\n\nLa nostra missione è semplice: essere il punto di riferimento per chi vuole aprire, gestire e far crescere un’attività a Pavia e provincia.\n\nSiamo parte della rete nazionale Confesercenti, presente in tutta Italia con oltre 350.000 imprese associate.'
    });
    setSetting('contatti', {
      intro: 'Hai bisogno di assistenza, vuoi associarti o richiedere una consulenza? Scrivici: ti rispondiamo entro 24 ore lavorative.'
    });
  }

  if (!db.prepare("SELECT COUNT(*) c FROM items").get().c) {
    const ins = db.prepare('INSERT INTO items (type,title,slug,excerpt,body,tag,link,sort) VALUES (@type,@title,@slug,@excerpt,@body,@tag,@link,@sort)');
    const servizi = [
      ['Assistenza fiscale e contabile', 'Tenuta contabilità, dichiarazioni, consulenza fiscale per imprese e partite IVA.'],
      ['Paghe e consulenza del lavoro', 'Elaborazione cedolini, contratti, gestione del personale e pratiche INPS/INAIL.'],
      ['Pratiche e autorizzazioni', 'SCIA, licenze, subingressi e ogni pratica amministrativa per la tua attività.'],
      ['Credito e finanza agevolata', 'Accesso al credito, bandi, contributi regionali ed europei per le PMI.'],
      ['Formazione e sicurezza', 'Corsi obbligatori (HACCP, sicurezza sul lavoro) e formazione professionale.'],
      ['CAF e Patronato', 'Servizi fiscali e previdenziali per imprenditori, dipendenti e famiglie.']
    ];
    servizi.forEach(([t, e], i) => ins.run({ type: 'servizio', title: t, slug: slugify(t), excerpt: e, body: '', tag: '', link: '', sort: i }));

    const conv = [
      ['Energia e utenze', 'Tariffe agevolate su luce e gas per le imprese associate.'],
      ['Assicurazioni', 'Polizze dedicate a condizioni riservate ai soci.'],
      ['Banche e POS', 'Commissioni ridotte su POS e servizi bancari convenzionati.'],
      ['SIAE e diritti', 'Sconti sugli abbonamenti musica d’ambiente per esercizi commerciali.']
    ];
    conv.forEach(([t, e], i) => ins.run({ type: 'convenzione', title: t, slug: slugify(t), excerpt: e, body: '', tag: '', link: '', sort: i }));

    ins.run({
      type: 'partner', title: 'Sarconx', slug: 'sarconx',
      excerpt: 'Siti web, e-commerce, consulenze growth per brand e servizi digitali.',
      body: 'Sarconx è il partner digitale di Pavia Esercenti. Realizza siti web professionali, piattaforme e-commerce, strategie di crescita (growth) per brand e servizi digitali in generale, aiutando le imprese del territorio a essere competitive online.\n\nEmail: info@sarconx.com',
      tag: 'Partner digitale', link: 'https://sarconx.com', sort: 0
    });

    const notizie = [
      ['Benvenuti sul nuovo portale di Pavia Esercenti',
       'È online il nuovo portale dell’associazione: più veloce, più chiaro, pensato per le imprese del territorio.',
       'È online il nuovo sito di Pavia Esercenti. Qui troverai notizie, servizi, convenzioni e tutti i contatti per la tua impresa.\n\nPer qualsiasi esigenza, la sezione Contatti è a tua disposizione.',
       'Associazione'],
      ['Commercio, i dati del primo semestre in provincia di Pavia',
       'L’osservatorio dell’associazione fotografa l’andamento delle attività commerciali sul territorio provinciale.',
       'Contenuto di esempio: sostituisci questa notizia dal pannello admin con i dati reali dell’osservatorio.\n\nLa sezione Notizie è pensata come una vera testata: articoli in evidenza, categorie e archivio.',
       'Economia'],
      ['Bandi regionali: nuove opportunità per le PMI del territorio',
       'Contributi a fondo perduto e finanza agevolata: le scadenze da non perdere per le imprese pavesi.',
       'Contenuto di esempio: aggiorna dal pannello admin con i bandi attivi.',
       'Bandi'],
      ['Sicurezza e formazione: al via il calendario corsi autunnale',
       'HACCP, sicurezza sul lavoro e aggiornamenti obbligatori: aperte le iscrizioni ai corsi dell’associazione.',
       'Contenuto di esempio: aggiorna dal pannello admin con il calendario reale.',
       'Formazione'],
      ['Convenzione energia: risparmi fino al 20% per gli associati',
       'Rinnovato l’accordo con i fornitori di energia: tariffe dedicate a chi è iscritto a Pavia Esercenti.',
       'Contenuto di esempio: aggiorna dal pannello admin.',
       'Convenzioni']
    ];
    notizie.forEach(([t, e, b, tag], i) => ins.run({ type: 'notizia', title: t, slug: slugify(t), excerpt: e, body: b, tag, link: '', sort: i }));

    // Banner pubblicitari: tag = posizione ('sidebar' | 'bottom').
    // Senza immagine viene mostrato un placeholder "Spazio pubblicitario".
    const banners = [
      ['Banner sidebar 1', 'sidebar'], ['Banner sidebar 2', 'sidebar'],
      ['Banner sidebar 3', 'sidebar'], ['Banner bottom 1', 'bottom'], ['Banner bottom 2', 'bottom']
    ];
    banners.forEach(([t, pos], i) => ins.run({ type: 'banner', title: t, slug: slugify(t), excerpt: '', body: '', tag: pos, link: '', sort: i }));
  }
}
seed();

module.exports = { db, DATA_DIR, getSetting, setSetting, hashPassword, verifyPassword, sanitizePublicUrl, slugify };
