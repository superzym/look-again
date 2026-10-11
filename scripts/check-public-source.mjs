// Packaging/integrity checks only: no browser, network, or model execution.
// This allowlist detects extra files; it is not a content/secrets scanner.
import { readdirSync, lstatSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const allowed = new Set([
  'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md',
  'research-model.json', 'validation.json',
  'dist/index.html', 'dist/styles.css', 'dist/app.js',
  'dist/model-worker.js', 'dist/sw.js',
  'dist/assets/credits.json', 'dist/assets/CREDITS.txt',
  'dist/assets/demo-leaf.jpg', 'dist/assets/demo-bark.jpg',
  '.github/workflows/check.yml', 'scripts/check-public-source.mjs',
  'docs/demo.png',
]);
const allowedDirectories = new Set();
for (const file of allowed) {
  const parts = file.split('/');
  for (let n = 1; n < parts.length; n++) allowedDirectories.add(parts.slice(0, n).join('/'));
}

function inventory(directory = root, prefix = '') {
  const found = [];
  for (const name of readdirSync(directory)) {
    if (!prefix && name === '.git') continue; // Checkout metadata only.
    const key = prefix + name;
    const path = join(directory, name);
    const stat = lstatSync(path);
    assert(!stat.isSymbolicLink(), `Symlinks are not public source files: ${key}`);
    if (stat.isDirectory()) {
      assert(allowedDirectories.has(key), `Unexpected public directory: ${key}`);
      found.push(...inventory(path, key + '/'));
    } else {
      assert(stat.isFile() && allowed.has(key), `Unexpected public file: ${key}`);
      found.push(key);
    }
  }
  return found;
}

function decodeAttribute(value) {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (_, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()];
    return String.fromCodePoint(entity[1].toLowerCase() === 'x'
      ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10));
  });
}

function checkLocalReference(raw) {
  const value = decodeAttribute(raw).trim();
  if (!value || value.startsWith('#') || value.startsWith('//')
      || /^(https?:|data:|blob:|mailto:|tel:)/i.test(value)) return false;
  assert(!/^[a-z][a-z\d+.-]*:/i.test(value), `Unsupported resource scheme: ${value}`);
  const pathPart = decodeURIComponent(value.split(/[?#]/, 1)[0]);
  assert(!pathPart.includes('\\') && !pathPart.includes('\0'), `Unsafe local reference: ${value}`);
  assert(!pathPart.split('/').includes('..'), `Local reference leaves dist: ${value}`);
  let path = resolve(dist, pathPart.replace(/^\/+/, '') || '.');
  const within = relative(dist, path);
  assert(within !== '..' && !within.startsWith('..' + sep), `Local reference leaves dist: ${value}`);
  if (lstatSync(path).isDirectory()) path = join(path, 'index.html');
  assert(lstatSync(path).isFile(), `Missing local resource: ${value}`);
  return true;
}

try {
  const files = inventory();
  assert.equal(files.length, allowed.size, 'Required public files are missing');
  for (const file of allowed) assert(files.includes(file), `Missing required file: ${file}`);

  const scripts = files.filter(file => /^dist\/[^/]+\.js$/.test(file));
  for (const file of scripts) {
    // Parse as a browser module through stdin; do not resolve or execute CDN imports.
    const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
      input: readFileSync(join(root, file)), encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.status, 0, `${file}: ${result.error?.message || result.stderr}`);
  }

  // Static attributes in this hand-authored HTML, not a general browser DOM parser.
  const html = readFileSync(join(dist, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  assert(!/<base\b/i.test(html), 'A base element requires reviewing local resource resolution');
  let references = 0;
  for (const tag of html.matchAll(/<[A-Za-z][^>]*>/g)) {
    for (const attr of tag[0].matchAll(/\s(?:src|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      if (checkLocalReference(attr[1] ?? attr[2] ?? attr[3])) references++;
    }
    assert(!/\ssrcset\s*=/i.test(tag[0]), 'Review srcset resource checking before adding it');
  }

  const credits = JSON.parse(readFileSync(join(dist, 'assets/credits.json'), 'utf8'));
  const expectedPhotos = new Set(['demo-leaf.jpg', 'demo-bark.jpg']);
  assert.equal(credits.assets?.length, 2, 'Expected two credited demonstration photos');
  for (const asset of credits.assets) {
    assert(expectedPhotos.delete(asset.file), 'Unexpected or duplicate demonstration photo');
    const bytes = readFileSync(join(dist, 'assets', asset.file));
    assert(Number.isSafeInteger(asset.bytes) && asset.bytes > 0, 'Invalid credited byte count');
    assert.equal(bytes.length, asset.bytes, `${asset.file}: credited byte count mismatch`);
    assert.match(asset.sha256, /^[0-9a-f]{64}$/, 'Invalid credited SHA-256');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256,
      `${asset.file}: SHA-256 mismatch`);
  }
  const license = readFileSync(join(root, 'LICENSE'), 'utf8');
  assert(license.includes('MIT License') && license.includes('Permission is hereby granted'), 'Missing MIT license');
  for (const file of ['THIRD_PARTY_NOTICES.md', 'dist/assets/CREDITS.txt']) {
    assert(readFileSync(join(root, file), 'utf8').trim().length > 0, `Empty third-party notice: ${file}`);
  }
  console.log(`PASS: ${files.length} allowed files; ${scripts.length} JavaScript syntax checks; ${references} local HTML references; 2 photo hashes/byte counts; license/notices.`);
  console.log('Packaging and integrity only. Browser behavior and model accuracy are not tested.');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
