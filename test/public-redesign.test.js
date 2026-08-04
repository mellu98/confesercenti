const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');

const ROOT = path.join(__dirname, '..');
const PUBLIC_VIEWS = path.join(ROOT, 'views', 'public');
const { sanitizePublicUrl } = require(path.join(ROOT, 'src', 'db'));

const site = {
  name: 'Pavia Esercenti',
  tagline: 'Al fianco delle imprese del territorio.',
  email: 'info@paviaesercenti.it',
  phone: '0382 000000',
  address: 'Via Roma 1, 27100 Pavia (PV)',
  hours: 'Lun–Ven 8:30–13:00 / 14:00–17:30'
};

const item = (type, index, overrides = {}) => ({
  id: index,
  type,
  title: `${type} ${index}`,
  slug: `${type}-${index}`,
  excerpt: `Descrizione ${type} ${index}`,
  body: `Primo paragrafo ${index}.\n\nSecondo paragrafo ${index}.`,
  image: '',
  link: '',
  tag: '',
  sort: index,
  published: 1,
  created_at: `2026-07-${String(20 - index).padStart(2, '0')} 09:00:00`,
  ...overrides
});

const banners = {
  sidebar: Array.from({ length: 3 }, (_, index) => item('banner', index + 1, { tag: 'sidebar' })),
  bottom: Array.from({ length: 2 }, (_, index) => item('banner', index + 4, { tag: 'bottom' }))
};

async function render(view, locals = {}) {
  return ejs.renderFile(path.join(PUBLIC_VIEWS, `${view}.ejs`), {
    site,
    path: '/',
    banners,
    ...locals
  });
}

function occurrences(source, pattern) {
  return (source.match(pattern) || []).length;
}

function loadPublicRoutes({ run = () => {}, send = () => Promise.resolve(), all = () => [], get = () => undefined } = {}) {
  const routes = {};
  const router = { get(route, handler) { routes[route] = handler; }, post(route, handler) { routes[route] = handler; } };
  const db = { prepare: () => ({ all, get, run }) };
  const mod = { exports: {} };
  const source = fs.readFileSync(path.join(ROOT, 'src', 'routes', 'public.js'), 'utf8');
  new Function('require', 'module', 'exports', source)(id => (
    id === 'express' ? { Router: () => router }
      : id === '../db' ? { db, getSetting: () => ({}), sanitizePublicUrl }
        : { sendContactMail: send }
  ), mod, mod.exports);
  return routes;
}

function loadContactHandler(options) { return loadPublicRoutes(options)['/contatti']; }

test('public link sanitizer blocks unsafe schemes while retaining supported destinations', async () => {
  for (const link of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '  javascript:alert(1)']) {
    assert.equal(sanitizePublicUrl(link), '');
  }
  assert.equal(sanitizePublicUrl('https://example.test/path'), 'https://example.test/path');
  assert.equal(sanitizePublicUrl('http://example.test'), 'http://example.test/');
  assert.equal(sanitizePublicUrl('mailto:info@example.test'), 'mailto:info@example.test');
  assert.equal(sanitizePublicUrl('tel:+390382000000'), 'tel:+390382000000');

  const publicRoutes = loadPublicRoutes({ all: () => [item('convenzione', 1, { link: 'data:text/html,unsafe' })] });
  const response = { render(view, data) { this.view = view; this.data = data; } };
  publicRoutes['/convenzioni']({}, response);
  assert.equal(response.data.convenzioni[0].link, '');

  const unsafeBanner = sanitizePublicUrl('javascript:alert(1)');
  const safeBanner = sanitizePublicUrl('https://partner.example');
  const html = await render('home', {
    home: {}, servizi: [], convenzioni: [], notizie: [], partner: [],
    banners: { sidebar: [item('banner', 1, { link: unsafeBanner })], bottom: [item('banner', 2, { link: safeBanner })] }
  });
  assert.doesNotMatch(html, /href="(?:javascript|data):/i);
  assert.match(html, /href="https:\/\/partner\.example\/"/);

  const publicRoute = fs.readFileSync(path.join(ROOT, 'src', 'routes', 'public.js'), 'utf8');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.match(publicRoute, /link:\s*sanitizePublicUrl\(item\.link\)/);
  assert.match(server, /link:\s*sanitizePublicUrl\(banner\.link\)/);
});

test('README requires ADMIN_PASSWORD for the first boot', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.match(readme, /ADMIN_PASSWORD.*obbligatori[oa].*primo avvio/i);
  assert.doesNotMatch(readme, /ADMIN_EMAIL\s*\/\s*ADMIN_PASSWORD\s*→\s*opzionali/i);
});

const contactRequest = (ip = '203.0.113.10', website = '') => ({
  ip,
  body: { name: 'Impresa Test', email: 'test@example.it', phone: '', subject: 'Servizi', body: 'Richiesta', website }
});
const contactResponse = () => ({
  locals: { site: { email: 'info@example.it' } }, headers: {}, statusCode: 200,
  set(name, value) { this.headers[name] = value; return this; },
  status(code) { this.statusCode = code; return this; },
  render(view, data) { this.view = view; this.data = data; return this; },
  redirect(location) { this.location = location; return this; }
});

test('public shell exposes accessible landmarks, current navigation, and official logo derivative', async () => {
  const html = await render('home', {
    home: {
      stat1_n: '1.500+',
      stat1_t: 'Imprese associate',
      stat2_n: '40+',
      stat2_t: 'Anni sul territorio',
      stat3_n: '20+',
      stat3_t: 'Servizi dedicati'
    },
    servizi: Array.from({ length: 6 }, (_, index) => item('servizio', index + 1)),
    convenzioni: Array.from({ length: 4 }, (_, index) => item('convenzione', index + 1)),
    notizie: Array.from({ length: 3 }, (_, index) => item('notizia', index + 1)),
    partner: [item('partner', 1)]
  });

  assert.match(html, /<a[^>]+class="skip-link"[^>]+href="#main-content"/);
  assert.match(html, /<main[^>]+id="main-content"/);
  assert.equal(occurrences(html, /<h1\b/g), 1);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /aria-controls="mainNav"/);
  assert.match(
    html,
    /<img[^>]+src="\/images\/logo-pavia-esercenti\.png"[^>]+alt="Pavia Esercenti"[^>]+width="\d+"[^>]+height="\d+"/
  );
});

test('homepage is service-led and renders every required dynamic collection', async () => {
  const html = await render('home', {
    home: {
      stat1_n: '1.500+',
      stat1_t: 'Imprese associate',
      stat2_n: '40+',
      stat2_t: 'Anni sul territorio',
      stat3_n: '20+',
      stat3_t: 'Servizi dedicati'
    },
    servizi: Array.from({ length: 6 }, (_, index) => item('servizio', index + 1)),
    convenzioni: Array.from({ length: 4 }, (_, index) => item('convenzione', index + 1)),
    notizie: Array.from({ length: 3 }, (_, index) => item('notizia', index + 1)),
    partner: [item('partner', 1)]
  });

  assert.match(html, /La tua impresa non è sola\./);
  assert.match(html, /Scopri i servizi/);
  assert.match(html, /Parla con noi/);
  assert.equal(occurrences(html, /class="service-directory__item"/g), 6);
  assert.equal(occurrences(html, /class="benefit-list__item"/g), 4);
  assert.equal(occurrences(html, /class="news-lead"/g), 1);
  assert.equal(occurrences(html, /class="news-list__item"/g), 2);
  assert.equal(occurrences(html, /class="opportunity-band__item/g), 5);
});

test('homepage hero image is dimensioned, meaningful, and prioritized as the LCP asset', async () => {
  const html = await render('home', {
    home: {},
    servizi: [],
    convenzioni: [],
    notizie: [],
    partner: []
  });

  assert.match(
    html,
    /<img[^>]+src="\/images\/hero-pavia-impresa\.webp"[^>]+alt="Imprenditrice pavese al lavoro nella sua attività"[^>]+width="\d+"[^>]+height="\d+"[^>]+loading="eager"[^>]+fetchpriority="high"/
  );
});

test('press empty state offers a clear contact action', async () => {
  const html = await render('notizie', {
    path: '/stampa',
    titolo: 'Sala stampa',
    base: '/stampa',
    posts: []
  });

  assert.match(html, /Nessun comunicato stampa pubblicato/);
  assert.match(html, /href="\/contatti"/);
});

test('contact form preserves persistence field names and accessible feedback', async () => {
  const html = await render('contatti', {
    path: '/contatti',
    page: { intro: 'Scrivici.' },
    sent: false,
    error: 'Compila i campi obbligatori.'
  });

  for (const name of ['website', 'name', 'email', 'phone', 'subject', 'body']) {
    assert.match(html, new RegExp(`name="${name}"`));
  }
  assert.match(html, /role="alert"/);
  assert.match(html, /autocomplete="name"/);
  assert.match(html, /autocomplete="email"/);
});

test('mobile navigation enhancement covers inert state, dismissal, focus containment and return', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'js', 'main.js'), 'utf8');

  assert.match(source, /\.inert\s*=/);
  assert.match(source, /Escape/);
  assert.match(source, /contains\(event\.target\)/);
  assert.match(source, /focusable/);
  assert.match(source, /toggle\.focus\(\)/);
});

test('CSS keeps content visible by default and defines visible focus and reduced motion', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'css', 'style.css'), 'utf8');

  assert.doesNotMatch(source, /\.reveal\s*\{[^}]*opacity\s*:\s*0/s);
  assert.match(source, /:focus-visible/);
  assert.match(source, /prefers-reduced-motion:\s*reduce/);
  assert.match(source, /min-height:\s*44px/);
  assert.doesNotMatch(source, /background(?:-image)?\s*:\s*(?:repeating-)?(?:linear|radial|conic)-gradient/);
});

test('homepage route supplies conventions without changing public URL contracts', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'routes', 'public.js'), 'utf8');

  assert.match(source, /router\.get\('\/'/);
  assert.match(source, /convenzioni:\s*list\('convenzione',\s*4\)/);
  for (const route of ['/associazione', '/servizi', '/convenzioni', '/notizie', '/stampa', '/partnership', '/contatti']) {
    assert.match(source, new RegExp(route.replaceAll('/', '\\/')));
  }
});

test('contact POST rate-limits by IP while preserving honeypot fake-success', () => {
  const handler = loadContactHandler();
  let response;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    response = contactResponse();
    handler(contactRequest(), response, assert.fail);
  }
  assert.equal(response.statusCode, 429);
  assert.match(response.headers['Retry-After'], /^\d+$/);
  assert.equal(response.view, 'public/contatti');
  assert.match(response.data.error, /richieste/i);

  const honeypot = contactResponse();
  handler(contactRequest('203.0.113.10', 'https://spam.example'), honeypot, assert.fail);
  assert.equal(honeypot.location, '/contatti?ok=1');
});

test('contact POST forwards synchronous failures and observes mail rejection', async () => {
  const failure = new Error('database unavailable');
  let forwarded;
  const result = loadContactHandler({ run: () => { throw failure; } })(
    contactRequest('203.0.113.11'), contactResponse(), error => { forwarded = error; }
  );
  if (result?.catch) await result.catch(() => {});
  assert.equal(forwarded, failure);

  let rejectionObserved = false;
  loadContactHandler({ send: () => ({ catch() { rejectionObserved = true; } }) })(
    contactRequest('203.0.113.12'), contactResponse(), assert.fail
  );
  assert.equal(rejectionObserved, true);
});

test('corrections remain bounded and progressively enhanced', () => {
  const route = fs.readFileSync(path.join(ROOT, 'src', 'routes', 'public.js'), 'utf8');
  const head = fs.readFileSync(path.join(PUBLIC_VIEWS, '_head.ejs'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'public', 'js', 'main.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'public', 'css', 'style.css'), 'utf8');
  const preview = fs.readFileSync(path.join(ROOT, 'scripts', 'render-preview.js'), 'utf8');

  assert.match(route, /MAX_CONTACT_IPS/);
  assert.match(route, /contactAttempts\.delete/);
  assert.doesNotMatch(head, /classList\.add\(['"]js/);
  assert.match(js, /classList\.add\(['"]nav-enhanced/);
  assert.match(css, /\.nav-enhanced \.main-nav/);
  assert.match(css, /:focus-visible\s*\{[^}]*var\(--forest\)/s);
  assert.match(css, /\.hero :focus-visible[\s\S]*var\(--citrus\)/);
  assert.match(preview, /existsSync\([^)]*admin\.css/);
});
