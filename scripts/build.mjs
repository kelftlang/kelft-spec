import fs from 'node:fs';
import path from 'node:path';
import {build} from 'vitepress';
import {validateMarkdown} from './check.mjs';
import {readImport, readPublicCompiler} from './upstream.mjs';
import {settings, compilerLink, renderReference} from './site.mjs';
import {validateSite} from './check-site.mjs';

const root = path.resolve(import.meta.dirname, '..');
process.chdir(root);
const production = process.argv.includes('--production');
const current = readImport(root, {production});
if (production) {
  const imports = [current, ...fs.readdirSync(path.join(root, 'versions')).map(version => readImport(path.join(root, 'versions', version), {production: true}))];
  const checked = new Map();
  for (const input of imports) {
    if (!checked.has(input.lock.revision)) checked.set(input.lock.revision, (await readPublicCompiler(input.lock.revision)).lock);
    if (JSON.stringify(checked.get(input.lock.revision)) !== JSON.stringify(input.lock)) throw new Error('Public compiler content differs from the committed source lock.');
  }
}
validateMarkdown(root);
const config = settings(root);
const generated = path.join(root, 'site');
// This directory is exclusively generated. Remove stale pages from previous imports.
if (path.dirname(generated) !== root || path.basename(generated) !== 'site' || (fs.existsSync(generated) && fs.lstatSync(generated).isSymbolicLink())) throw new Error('Invalid generated site directory.');
fs.rmSync(generated, {recursive: true, force: true});
fs.mkdirSync(path.join(generated, 'public'), {recursive: true});
function reference(directory, prefix) {
  const {lock, rows} = readImport(directory);
  const target = path.join(generated, prefix);
  fs.mkdirSync(target, {recursive: true});
  for (const [source, bytes] of rows) {
    if (!source.startsWith('spec/')) continue;
    const name = source.slice(5);
    if (name.endsWith('.md')) fs.writeFileSync(path.join(target, name === 'README.md' ? 'index.md' : name), renderReference(bytes.toString('utf8'), source, lock));
    else {
      const asset = path.join(generated, 'public', prefix, name);
      fs.mkdirSync(path.dirname(asset), {recursive: true}); fs.writeFileSync(asset, bytes);
    }
  }
}
reference(root, 'dev');
for (const version of fs.readdirSync(path.join(root, 'versions')).sort()) reference(path.join(root, 'versions', version), 'v' + version);
const lock = current.lock;
const identity = lock.revision ? 'This reference uses compiler **' + lock.compilerVersion + '** at [commit ' + lock.revision.slice(0, 12) + '](' + compilerLink(lock, '', 'tree') + ').' : '::: warning Unpublished preview\nThis site currently previews compiler **' + lock.compilerVersion + '** from a prepared public compiler draft. A public source commit is required before deployment.\n:::';
for (const name of fs.readdirSync(path.join(root, 'pages')).filter(n => n.endsWith('.md'))) {
  const text = fs.readFileSync(path.join(root, 'pages', name), 'utf8')
    .replaceAll('<!-- HELLO -->', '\x60\x60\x60kelft\n' + current.rows.get('compiler-inputs/examples/hello.kelft').toString('utf8').trim() + '\n\x60\x60\x60')
    .replaceAll('<!-- COMPILER_INSTALL -->', compilerLink(lock, 'docs/install.md'))
    .replaceAll('<!-- COMPILER_BUILD -->', compilerLink(lock, 'docs/build.md'))
    .replaceAll('<!-- COMPILER_ARCHITECTURE -->', compilerLink(lock, 'docs/architecture.md'))
    .replaceAll('<!-- COMPILER_CONTRIBUTING -->', compilerLink(lock, 'CONTRIBUTING.md'))
    .replaceAll('<!-- COMPILER_IDENTITY -->', identity);
  fs.writeFileSync(path.join(generated, name), text + (name === 'index.md' ? '\n\n' + identity + '\n' : ''));
}
fs.writeFileSync(path.join(generated, 'licensing.md'), fs.readFileSync(path.join(root, 'docs/licensing.md'), 'utf8').replace(/\]\(\.\.\/([^)]*)\)/g, '](https://github.com/kelftlang/kelft-spec/blob/main/$1)'));
fs.cpSync(path.join(root, 'public'), path.join(generated, 'public'), {recursive: true});
fs.writeFileSync(path.join(generated, 'public/robots.txt'), 'User-agent: *\nAllow: /\nSitemap: ' + config.origin + config.base + 'sitemap.xml\n');
await build(root);
console.log(JSON.stringify(validateSite(path.join(root, '.vitepress/dist'), config.base)));
