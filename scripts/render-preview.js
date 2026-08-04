// Anteprima statica del sito: renderizza i template EJS in HTML navigabile
// senza dipendenze npm. Solo per preview — il sito vero gira con `npm start`.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VIEWS = path.join(ROOT, 'views');
const OUT = process.argv[2] || path.join(ROOT, '..', 'preview');

// ---- mini motore EJS (subset: <%= %>, <%- %>, <% %>, include) ----
function compile(tpl) {
  let body = 'var __o="";\n';
  const re = /<%([=\-]?)([\s\S]*?)%>/g;
  let last = 0, m;
  const esc = 'function __e(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}\n';
  while ((m = re.exec(tpl))) {
    body += '__o+=' + JSON.stringify(tpl.slice(last, m.index)) + ';\n';
    if (m[1] === '=') body += '__o+=__e(' + m[2] + ');\n';
    else if (m[1] === '-') body += '__o+=(' + m[2] + ');\n';
    else body += m[2] + '\n';
    last = re.lastIndex;
  }
  body += '__o+=' + JSON.stringify(tpl.slice(last)) + ';\nreturn __o;';
  return new Function('include', 'locals', esc + `with(locals){${body}}`);
}
function render(rel, locals) {
  const dir = path.dirname(path.join(VIEWS, rel));
  const tpl = fs.readFileSync(path.join(VIEWS, rel), 'utf8');
  const include = (name, extra = {}) =>
    render(path.relative(VIEWS, path.join(dir, name + '.ejs')), { ...locals, ...extra });
  return compile(tpl)(include, locals);
}

// ---- dati demo (stessi del seed) ----
const site = {
  name: 'Pavia Esercenti',
  tagline: 'Al fianco delle imprese del commercio, del turismo e dei servizi di Pavia e provincia.',
  email: 'info@paviaesercenti.it', phone: '0382 000000',
  address: 'Via Roma 1, 27100 Pavia (PV)', hours: 'Lun–Ven 8:30–13:00 / 14:00–17:30',
  facebook: '', instagram: '', linkedin: ''
};
const home = {
  hero_title: 'La forza delle imprese di Pavia',
  hero_text: 'Rappresentiamo e tuteliamo commercianti, artigiani e piccole imprese del territorio pavese. Servizi, convenzioni e assistenza su misura per far crescere la tua attività.',
  hero_cta: 'Diventa socio',
  stat1_n: '1.500+', stat1_t: 'Imprese associate',
  stat2_n: '40+', stat2_t: 'Anni sul territorio',
  stat3_n: '20+', stat3_t: 'Servizi dedicati'
};
const now = '2026-07-17 10:00:00';
const mk = (type, arr) => arr.map(([title, excerpt, body = '', tag = ''], i) => ({
  type, title, excerpt, body, tag, link: '', image: '',
  slug: title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
  sort: i, published: 1, created_at: now, updated_at: now
}));
const servizi = mk('servizio', [
  ['Assistenza fiscale e contabile', 'Tenuta contabilità, dichiarazioni, consulenza fiscale per imprese e partite IVA.'],
  ['Paghe e consulenza del lavoro', 'Elaborazione cedolini, contratti, gestione del personale e pratiche INPS/INAIL.'],
  ['Pratiche e autorizzazioni', 'SCIA, licenze, subingressi e ogni pratica amministrativa per la tua attività.'],
  ['Credito e finanza agevolata', 'Accesso al credito, bandi, contributi regionali ed europei per le PMI.'],
  ['Formazione e sicurezza', 'Corsi obbligatori (HACCP, sicurezza sul lavoro) e formazione professionale.'],
  ['CAF e Patronato', 'Servizi fiscali e previdenziali per imprenditori, dipendenti e famiglie.']
]);
const convenzioni = mk('convenzione', [
  ['Energia e utenze', 'Tariffe agevolate su luce e gas per le imprese associate.'],
  ['Assicurazioni', 'Polizze dedicate a condizioni riservate ai soci.'],
  ['Banche e POS', 'Commissioni ridotte su POS e servizi bancari convenzionati.'],
  ['SIAE e diritti', 'Sconti sugli abbonamenti musica d’ambiente per esercizi commerciali.']
]);
const partner = mk('partner', [
  ['Sarconix', 'Siti web, e-commerce, consulenze growth per brand e servizi digitali.',
   'Sarconix è il partner digitale di Pavia Esercenti. Realizza siti web professionali, piattaforme e-commerce, strategie di crescita (growth) per brand e servizi digitali in generale, aiutando le imprese del territorio a essere competitive online.',
   'Partner digitale']
]);
const notizie = mk('notizia', [
  ['Benvenuti sul nuovo portale di Pavia Esercenti',
   'È online il nuovo portale dell’associazione: più veloce, più chiaro, pensato per le imprese del territorio.',
   'È online il nuovo sito di Pavia Esercenti. Qui troverai notizie, servizi, convenzioni e tutti i contatti per la tua impresa.\n\nPer qualsiasi esigenza, la sezione Contatti è a tua disposizione.',
   'Associazione'],
  ['Commercio, i dati del primo semestre in provincia di Pavia',
   'L’osservatorio dell’associazione fotografa l’andamento delle attività commerciali sul territorio provinciale.',
   'Contenuto di esempio: sostituisci questa notizia dal pannello admin con i dati reali.', 'Economia'],
  ['Bandi regionali: nuove opportunità per le PMI del territorio',
   'Contributi a fondo perduto e finanza agevolata: le scadenze da non perdere per le imprese pavesi.',
   'Contenuto di esempio.', 'Bandi'],
  ['Sicurezza e formazione: al via il calendario corsi autunnale',
   'HACCP, sicurezza sul lavoro e aggiornamenti obbligatori: aperte le iscrizioni ai corsi dell’associazione.',
   'Contenuto di esempio.', 'Formazione'],
  ['Convenzione energia: risparmi fino al 20% per gli associati',
   'Rinnovato l’accordo con i fornitori di energia: tariffe dedicate a chi è iscritto a Pavia Esercenti.',
   'Contenuto di esempio.', 'Convenzioni']
]);
const banners = {
  sidebar: mk('banner', [['Banner sidebar 1', '', '', 'sidebar'], ['Banner sidebar 2', '', '', 'sidebar'], ['Banner sidebar 3', '', '', 'sidebar']]).map(b => ({ ...b, tag: 'sidebar' })),
  bottom: mk('banner', [['Banner bottom 1', '', '', 'bottom'], ['Banner bottom 2', '', '', 'bottom']]).map(b => ({ ...b, tag: 'bottom' }))
};

// ---- dati admin demo ----
const withId = arr => arr.map((x, i) => ({ ...x, id: i + 1 }));
const adminUser = { id: 1, name: 'Super Admin', role: 'superadmin' };
const adminSets = {
  servizi: { cfg: { label: 'Servizi' }, items: withId(servizi) },
  convenzioni: { cfg: { label: 'Convenzioni' }, items: withId(convenzioni) },
  notizie: { cfg: { label: 'Notizie' }, items: withId(notizie) },
  stampa: { cfg: { label: 'Sala stampa' }, items: [] },
  partnership: { cfg: { label: 'Partnership' }, items: withId(partner) },
  banner: { cfg: { label: 'Banner ADV' }, items: withId([...banners.sidebar, ...banners.bottom]) }
};
const demoMsgs = withId([
  { name: 'Mario Rossi', email: 'mario.rossi@esempio.it', phone: '333 1234567', subject: 'Voglio associarmi',
    body: 'Buongiorno, ho un negozio di alimentari a Vigevano e vorrei informazioni su come associarmi.', read: 0, created_at: now },
  { name: 'Laura Bianchi', email: 'laura@esempio.it', phone: '', subject: 'Richiesta servizi',
    body: 'Salve, avrei bisogno di assistenza per una pratica SCIA. Potete ricontattarmi?', read: 0, created_at: now }
]);

// ---- pagine da renderizzare ----
const pages = [
  ['index.html', 'public/home.ejs', '/', { home, servizi, convenzioni, notizie, partner }],
  ['associazione.html', 'public/associazione.ejs', '/associazione', { page: { title: 'Chi siamo', intro: 'Pavia Esercenti è l’associazione di categoria che rappresenta le piccole e medie imprese del commercio, del turismo, dell’artigianato e dei servizi della provincia di Pavia, in associazione con Confesercenti.', body: 'Dal nostro insediamento sul territorio lavoriamo ogni giorno al fianco degli imprenditori: dialoghiamo con le istituzioni locali, promuoviamo lo sviluppo economico della provincia e offriamo servizi concreti a chi fa impresa.\n\nLa nostra missione è semplice: essere il punto di riferimento per chi vuole aprire, gestire e far crescere un’attività a Pavia e provincia.\n\nSiamo parte della rete nazionale Confesercenti, presente in tutta Italia con oltre 350.000 imprese associate.' } }],
  ['servizi.html', 'public/servizi.ejs', '/servizi', { servizi }],
  ['convenzioni.html', 'public/convenzioni.ejs', '/convenzioni', { convenzioni }],
  ['notizie.html', 'public/notizie.ejs', '/notizie', { titolo: 'Notizie', base: '/notizie', posts: notizie }],
  ['notizia-benvenuti.html', 'public/post.ejs', '/notizie/x', { post: notizie[1], back: '/notizie', backLabel: 'Notizie' }],
  ['stampa.html', 'public/notizie.ejs', '/stampa', { titolo: 'Sala stampa', base: '/stampa', posts: [] }],
  ['partnership.html', 'public/partnership.ejs', '/partnership', { partner }],
  ['contatti.html', 'public/contatti.ejs', '/contatti', { page: { intro: 'Hai bisogno di assistenza, vuoi associarti o richiedere una consulenza? Scrivici: ti rispondiamo entro 24 ore lavorative.' }, sent: false, error: null }],
  ['admin-login.html', 'admin/login.ejs', '/admin/login', { error: null, user: null }],
  ['admin-dashboard.html', 'admin/dashboard.ejs', '/admin', {
    user: adminUser,
    TYPES: Object.fromEntries(Object.entries(adminSets).map(([k, v]) => [k, v.cfg])),
    counts: { ...Object.fromEntries(Object.entries(adminSets).map(([k, v]) => [k, v.items.length])), messaggi: 2 }
  }],
  ...Object.entries(adminSets).map(([sec, v]) =>
    [`admin-${sec}.html`, 'admin/lista.ejs', `/admin/contenuti/${sec}`, { user: adminUser, sec, cfg: v.cfg, items: v.items }]),
  ['admin-editor.html', 'admin/editor.ejs', '/admin/contenuti/notizie/1', { user: adminUser, sec: 'notizie', cfg: { label: 'Notizie' }, item: withId(notizie)[0] }],
  ['admin-editor-banner.html', 'admin/editor.ejs', '/admin/contenuti/banner/1', { user: adminUser, sec: 'banner', cfg: { label: 'Banner ADV' }, item: withId(banners.sidebar)[0] }],
  ['admin-messaggi.html', 'admin/messaggi.ejs', '/admin/messaggi', { user: adminUser, msgs: demoMsgs }],
  ['admin-impostazioni.html', 'admin/impostazioni.ejs', '/admin/impostazioni', {
    user: adminUser, s: site, h: home, saved: false,
    a: { title: 'Chi siamo', intro: 'Testo introduttivo...', body: 'Testo pagina...' },
    c: { intro: 'Testo pagina contatti...' }
  }],
  ['admin-utenti.html', 'admin/utenti.ejs', '/admin/utenti', {
    user: adminUser, error: null,
    users: [{ id: 1, name: 'Super Admin', email: 'admin@example.com', role: 'superadmin', created_at: now }]
  }]
];

// riscrittura link per navigazione statica
const linkMap = {
  '/': 'index.html', '/associazione': 'associazione.html', '/servizi': 'servizi.html',
  '/convenzioni': 'convenzioni.html', '/notizie': 'notizie.html',
  '/notizie/benvenuti-sul-nuovo-sito-di-pavia-esercenti': 'notizia-benvenuti.html',
  '/stampa': 'stampa.html', '/partnership': 'partnership.html', '/contatti': 'contatti.html',
  '/admin': 'admin-dashboard.html', '/admin/login': 'admin-login.html'
};
function rewrite(html) {
  html = html.replace(/(href|src|action)="(\/[^"]*)"/g, (all, attr, url) => {
    if (url.startsWith('/css/') || url.startsWith('/js/') || url.startsWith('/images/') || url.startsWith('/fonts/')) {
      return `${attr}="${url.slice(1)}"`;
    }
    if (url === '/admin/login') return `${attr}="${attr === 'action' ? 'admin-dashboard.html' : 'admin-login.html'}"`;
    if (url === '/admin/logout') return `${attr}="admin-login.html"`;
    if (linkMap[url]) return `${attr}="${linkMap[url]}"`;
    if (url.startsWith('/notizie/') || url.startsWith('/stampa/')) return `${attr}="notizia-benvenuti.html"`;
    let m = url.match(/^\/admin\/contenuti\/(\w+)$/);
    if (m) return `${attr}="admin-${m[1]}.html"`;
    m = url.match(/^\/admin\/contenuti\/(\w+)\/(nuovo|\d+)/);
    if (m) return `${attr}="admin-editor${m[1] === 'banner' ? '-banner' : ''}.html"`;
    if (url.startsWith('/admin/messaggi')) return `${attr}="admin-messaggi.html"`;
    if (url.startsWith('/admin/impostazioni') || url === '/admin/password') return `${attr}="admin-impostazioni.html"`;
    if (url.startsWith('/admin/utenti')) return `${attr}="admin-utenti.html"`;
    if (url.startsWith('/admin')) return `${attr}="admin-dashboard.html"`;
    return `${attr}="index.html"`;
  });
  // i form in anteprima navigano soltanto (GET), non salvano nulla
  html = html.replace(/method="POST"/g, 'method="GET"');
  return html.replace('</body>', '<div style="position:fixed;bottom:14px;right:14px;background:#123a30;color:#fff;padding:8px 14px;border-radius:10px;font:600 12px system-ui;z-index:99;opacity:.9">ANTEPRIMA — i salvataggi funzionano solo nel sito reale</div></body>');
}

fs.mkdirSync(path.join(OUT, 'css'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'js'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'public/css/style.css'), path.join(OUT, 'css/style.css'));
if (fs.existsSync(path.join(ROOT, 'public/css/admin.css'))) {
  fs.copyFileSync(path.join(ROOT, 'public/css/admin.css'), path.join(OUT, 'css/admin.css'));
}
fs.copyFileSync(path.join(ROOT, 'public/js/main.js'), path.join(OUT, 'js/main.js'));
fs.cpSync(path.join(ROOT, 'public/images'), path.join(OUT, 'images'), { recursive: true });
fs.cpSync(path.join(ROOT, 'public/fonts'), path.join(OUT, 'fonts'), { recursive: true });

for (const [file, view, urlPath, locals] of pages) {
  const html = render(view, { site, path: urlPath, user: null, banners, ...locals });
  fs.writeFileSync(path.join(OUT, file), rewrite(html));
  console.log('✓', file);
}
console.log('\nAnteprima generata in:', OUT);
