const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('Railway selects the Dockerfile builder', () => {
  const railway = JSON.parse(read('railway.json'));
  assert.equal(railway.build.builder, 'DOCKERFILE');
  assert.equal(railway.build.dockerfilePath, 'Dockerfile');
});

test('deployment guide contains no committed credential defaults', () => {
  const deploy = read('DEPLOY.md');
  assert.doesNotMatch(deploy, /^(?:SESSION_SECRET|ADMIN_PASSWORD)=(?!<[^>\r\n]+>)[^\s#]+/m);
  assert.match(deploy, /SESSION_SECRET=<generate-a-long-random-value>/);
  assert.match(deploy, /ADMIN_PASSWORD=<choose-a-strong-password>/);
  assert.match(deploy, /\/app\/data/);
  assert.match(deploy, /replicas?/i);
});

test('environment template uses secret placeholders with Railway guidance', () => {
  const envExample = read('.env.example');

  assert.doesNotMatch(envExample, /^(?:SESSION_SECRET|ADMIN_PASSWORD)=(?!<[^>\r\n]+>)[^\s#]+/m);
  assert.match(envExample, /ADMIN_PASSWORD=<choose-a-strong-password>/);
  assert.match(envExample, /Railway/i);
  assert.match(envExample, /(service variables?|variabili? di servizio)/i);
});

test('server requires a production session secret and binds all interfaces', () => {
  const server = read('server.js');
  assert.match(server, /process\.env\.NODE_ENV\s*===\s*['"]production['"][\s\S]*process\.env\.SESSION_SECRET/);
  assert.match(server, /crypto\.randomBytes/);
  assert.match(server, /app\.listen\(PORT,\s*['"]0\.0\.0\.0['"]/);
});

test('publishable runtime code contains no hard-coded credential defaults', () => {
  for (const file of ['server.js', 'src/db.js']) {
    const source = read(file);
    assert.doesNotMatch(source, /process\.env\.(?:SESSION_SECRET|ADMIN_PASSWORD)\s*(?:\|\||=)\s*['"][^'"]+['"]/);
  }
});

test('publishable source, templates, and docs contain no organization admin bootstrap email', () => {
  const legacyAdminEmail = ['admin', 'confesercentipavia.it'].join('@');
  const publishablePaths = [
    'README.md',
    'DEPLOY.md',
    ...['src', 'scripts', 'views', 'public/js'].flatMap(directory =>
      fs.readdirSync(path.join(ROOT, directory), { recursive: true })
        .filter(entry => !fs.statSync(path.join(ROOT, directory, entry)).isDirectory())
        .map(entry => path.join(directory, entry))
    )
  ];

  for (const file of publishablePaths) {
    assert.doesNotMatch(read(file), new RegExp(legacyAdminEmail.replace('.', '\\.')),
      `${file} must not publish an organization admin bootstrap email`);
  }
});

test('README requires first-boot admin credentials rather than publishing a default password', () => {
  const readme = read('README.md');

  assert.doesNotMatch(readme, /^-\s*Password:\s*`[^`]+`/im);
  assert.match(readme, /ADMIN_PASSWORD/i);
  assert.match(readme, /primo avvio|first boot/i);
  assert.match(readme, /cambia(?:re)? (?:subito|immediatamente)|change.*immediately/i);
});

test('first admin seed requires an explicit password', () => {
  const db = read('src/db.js');
  assert.match(db, /throw new Error\(['"]ADMIN_PASSWORD is required when creating the first user/);
  assert.match(db, /process\.env\.ADMIN_EMAIL\s*\|\|/);
  assert.match(db, /process\.env\.ADMIN_EMAIL\s*\|\|\s*['"]admin@example\.com['"]/);
});

test('production startup rejects missing required secrets before serving requests', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'confesercenti-railway-test-'));
  try {
    const baseEnv = { ...process.env, NODE_ENV: 'production', DATA_DIR: dataDir };
    delete baseEnv.SESSION_SECRET;
    delete baseEnv.ADMIN_PASSWORD;

    const missingSession = spawnSync(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: baseEnv,
      encoding: 'utf8'
    });
    assert.notEqual(missingSession.status, 0);
    assert.match(missingSession.stderr, /SESSION_SECRET is required in production/);

    const missingAdmin = spawnSync(process.execPath, ['-e', "require('./src/db')"], {
      cwd: ROOT,
      env: { ...baseEnv, SESSION_SECRET: 'test-only-secret' },
      encoding: 'utf8'
    });
    assert.notEqual(missingAdmin.status, 0);
    assert.match(missingAdmin.stderr, /ADMIN_PASSWORD is required when creating the first user/);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('Docker image installs production dependencies reproducibly from the lockfile', () => {
  const dockerfile = read('Dockerfile');
  assert.match(dockerfile, /COPY package\*\.json \.\//);
  assert.match(dockerfile, /npm ci --omit=dev --no-audit --no-fund/);
  assert.match(dockerfile, /ENV NODE_ENV=production/);
  assert.match(dockerfile, /ENV DATA_DIR=\/app\/data/);
  assert.match(dockerfile, /CMD \[[^\]]*['"]server\.js['"][^\]]*\]/);
});

test('local Railway and operating-system artifacts stay out of Git', () => {
  const ignore = read('.gitignore');
  for (const entry of ['.DS_Store', '.railway/', '*.log', '.atl/', '.claude/']) {
    assert.match(ignore, new RegExp(`^${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^\.env\.\*$/m);
  assert.match(ignore, /^!\.env\.example$/m);

  const dockerignore = read('.dockerignore');
  for (const entry of ['.atl/', '.claude/']) {
    assert.match(dockerignore, new RegExp(`^${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
});

test('README presents Railway as the primary Dockerfile deployment path', () => {
  const readme = read('README.md');

  assert.match(readme, /^## Deploy su Railway/m);
  assert.match(readme, /Railway/i);
  assert.match(readme, /Dockerfile/i);
  assert.match(readme, /\/app\/data/);
  assert.doesNotMatch(readme, /^## Deploy su Coolify/m);
});

test('production dependency policy requires safe Nodemailer and a matching lockfile', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));

  assert.equal(pkg.dependencies.nodemailer, '9.0.3');
  assert.equal(lock.packages[''].dependencies.nodemailer, '9.0.3');
  assert.equal(lock.packages['node_modules/nodemailer'].version, '9.0.3');
});

test('production session cookies are explicitly secure behind Railway proxy', () => {
  const server = read('server.js');

  assert.match(server, /app\.set\(['"]trust proxy['"],\s*1\)/);
  assert.match(server, /secure:\s*isProduction/);
  assert.match(server, /sameSite:\s*['"]lax['"]/);
  assert.match(server, /httpOnly:\s*true/);
});

test('admin image uploads reject SVG and allow only safe raster types', () => {
  const admin = read('src/routes/admin.js');

  assert.doesNotMatch(admin, /svg/i);
  assert.match(admin, /image\/png/);
  assert.match(admin, /image\/jpeg/);
  assert.match(admin, /image\/webp/);
  assert.match(admin, /image\/gif/);
  assert.match(admin, /path\.extname\(file\.originalname(?:\s*\|\|\s*['"]['"])?\)/);
  assert.match(admin, /MulterError\(['"]LIMIT_UNEXPECTED_FILE['"]/);
});

