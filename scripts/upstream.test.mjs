import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {makeImport, syncCompiler, readImport, readPublicCompiler, snapshot, hash, json} from './upstream.mjs';
import {renderReference, settings} from './site.mjs';
import {validateSite} from './check-site.mjs';
import {assertAutomationBranch, botEmail} from './update-policy.mjs';

function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kelft-site-test-'));
  t.after(() => {assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(directory, {recursive: true, force: true});});
  return directory;
}
function entries() {
  return new Map(Object.entries({
    'release.json': JSON.stringify({version: '0.1.0-alpha.1', coreVersion: '0.1', intentVersion: '0.2', specificationVersion: '0.2.0'}),
    'spec/README.md': '# Kelft\n\n[Core](language.md) [Policy](../docs/licensing.md)\n',
    'spec/language.md': '# Core\n', 'spec/intent-v0.2.md': '# Intent\n', 'spec/intrinsics.json': '{}',
    'examples/hello.kelft': 'fn main() -> void { println("Hello, Kelft!"); }\n',
    'docs/install.md': '# Install\n', 'docs/licensing.md': '# Licensing\n', 'CONTRIBUTING.md': '# Contributing\n', 'host/native/resource-contracts.json': '{}'
  }).map(([name, text]) => [name, Buffer.from(text)]));
}
function draftSnapshotFixture(t, {readmeCommit = true} = {}) {
  const root = temporary(t), draft = makeImport(entries());
  syncCompiler(root, draft);
  const restore = () => {for (const [name, bytes] of draft.rows) {const file = path.join(root, 'versions/0.2.0', name); fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, bytes);}};
  restore();
  syncCompiler(root, makeImport(entries(), 'a'.repeat(40)));
  execFileSync('git', ['init', '--initial-branch=dev', root], {stdio: 'pipe', windowsHide: true});
  const git = args => execFileSync('git', ['-C', root, '-c', 'safe.directory=' + root, '-c', 'user.name=Kelft site tests', '-c', 'user.email=site-tests@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=' + path.join(root, 'no-hooks'), ...args], {encoding: 'utf8', stdio: 'pipe', windowsHide: true}).trim();
  if (readmeCommit) {fs.writeFileSync(path.join(root, 'README.md'), '# Website\n'); git(['add', '--', 'README.md']); git(['commit', '-m', 'README-only fixture']);}
  return {root, draft, restore, git};
}
test('public import preserves bytes, records versions, and skips unrelated compiler revisions', t => {
  const root = temporary(t), input = makeImport(entries(), 'a'.repeat(40));
  assert.equal(syncCompiler(root, input), true);
  assert.equal(readImport(root, {production: true}).lock.compilerVersion, '0.1.0-alpha.1');
  for (const row of input.lock.files) assert.equal(hash(fs.readFileSync(path.join(root, row.path))), row.sha256);
  assert.equal(syncCompiler(root, makeImport(entries(), 'b'.repeat(40))), false);
  assert.equal(readImport(root).lock.revision, 'a'.repeat(40));
});
test('local edits and unmanaged collisions fail before import writes', t => {
  const root = temporary(t), input = makeImport(entries()); syncCompiler(root, input);
  fs.appendFileSync(path.join(root, 'spec/language.md'), 'Human edit');
  const before = fs.readFileSync(path.join(root, 'compiler-source.json'));
  assert.throws(() => syncCompiler(root, makeImport(entries(), 'a'.repeat(40))), /Modified/);
  assert.deepEqual(fs.readFileSync(path.join(root, 'compiler-source.json')), before);
  const other = temporary(t); fs.mkdirSync(path.join(other, 'spec')); fs.writeFileSync(path.join(other, 'spec/README.md'), 'Human edit');
  assert.throws(() => syncCompiler(other, input), /local edit/);
  assert.ok(!fs.existsSync(path.join(other, 'compiler-source.json')));
});
test('draft previews cannot deploy or create snapshots; pinned snapshots stay unchanged', t => {
  const root = temporary(t); syncCompiler(root, makeImport(entries()));
  assert.throws(() => readImport(root, {production: true}), /Production requires/);
  assert.throws(() => snapshot(root, '0.2.0'), /Production requires/);
  syncCompiler(root, makeImport(entries(), 'a'.repeat(40))); snapshot(root, '0.2.0');
  const file = path.join(root, 'versions/0.2.0/spec/language.md'), before = fs.readFileSync(file);
  const changed = entries(); changed.set('spec/language.md', Buffer.from('# Revised Core\n'));
  syncCompiler(root, makeImport(changed, 'b'.repeat(40)));
  assert.deepEqual(fs.readFileSync(file), before);
  assert.equal(readImport(path.join(root, 'versions/0.2.0')).lock.revision, 'a'.repeat(40));
  assert.throws(() => snapshot(root, '0.2.0'), /immutable/);
});
test('failed upstream responses and malformed source data cannot produce an import', async () => {
  await assert.rejects(readPublicCompiler('main', async () => new Response('', {status: 404})), /request failed: 404/);
  await assert.rejects(readPublicCompiler('main', async () => Response.json({sha: 'invalid'})), /Invalid public compiler commit/);
  const bad = entries(); bad.set('spec/language.md', Buffer.from('See docs/references/private.md'));
  assert.throws(() => makeImport(bad), /Unreviewed/);
  const invalid = entries(); invalid.set('spec/../../escape.md', Buffer.from('escape'));
  assert.throws(() => makeImport(invalid), /Unexpected/);
});
test('remote reads resolve once and use immutable compiler URLs', async () => {
  const source = entries(), calls = [], revision = 'a'.repeat(40);
  const incoming = await readPublicCompiler('main', async url => {
    calls.push(url);
    if (url.includes('/commits/')) return Response.json({sha: revision});
    if (url.includes('/contents/')) return Response.json([...source.keys()].filter(name => name.startsWith('spec/')).map(name => ({type: 'file', name: name.slice(5)})));
    const name = url.split('/' + revision + '/')[1]; return new Response(source.get(name));
  });
  assert.equal(incoming.lock.revision, revision);
  assert.ok(calls.filter(url => url.includes('raw.githubusercontent')).every(url => url.includes('/' + revision + '/')));
  const offline = entries(); offline.delete('spec/language.md'); assert.throws(() => makeImport(offline), /Missing compiler input/);
});
test('rendering links to pinned public sources without changing technical fences', () => {
  const {lock} = makeImport(entries(), 'a'.repeat(40));
  const text = '# Core\n[Core](README.md) [Policy](../docs/licensing.md)\n`selfhost/direct/map-runtime.kelft`\n\n```kelft\nprintln("literal");\n```\n';
  const rendered = renderReference(text, 'spec/language.md', lock);
  assert.match(rendered, /\]\(index\.md\)/);
  assert.ok(rendered.includes(lock.repository + '/blob/' + lock.revision + '/docs/licensing.md'));
  assert.ok(rendered.includes('```kelft\nprintln("literal");\n```'));
  assert.match(rendered, /commit/);
});
test('website crawl catches missing downloads and anchors with configurable bases', t => {
  const root = temporary(t); fs.mkdirSync(path.join(root, 'dev'));
  fs.writeFileSync(path.join(root, 'index.html'), '<a href="/docs/dev/index.html#core">Core</a>');
  fs.writeFileSync(path.join(root, 'dev/index.html'), '<h1 id="core">Core</h1><a href="intrinsics.json">JSON</a>');
  assert.throws(() => validateSite(root, '/docs/'), /missing intrinsics/);
  fs.writeFileSync(path.join(root, 'dev/intrinsics.json'), '{}'); assert.equal(validateSite(root, '/docs/').status, 'passed');
  fs.writeFileSync(path.join(root, 'index.html'), '<a href="/docs/dev/index.html#missing">Core</a>');
  assert.throws(() => validateSite(root, '/docs/'), /missing anchor/);
  fs.writeFileSync(path.join(root, 'publication.json'), json({origin: 'https://www.kelft.com', base: '/'}));
  assert.equal(settings(root, {KELFT_SITE_BASE: '/docs/'}).base, '/docs/');
  assert.throws(() => settings(root, {KELFT_SITE_BASE: '/../'}), /Expected/);
});
test('source lock rejects mismatched metadata and a sync refreshes inventory hashes', t => {
  const root = temporary(t); fs.writeFileSync(path.join(root, '.publication.json'), json({schema: 'kelft.public-export/1', kind: 'spec', files: []}));
  syncCompiler(root, makeImport(entries(), 'a'.repeat(40)));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.publication.json')));
  for (const row of manifest.files) assert.equal(hash(fs.readFileSync(path.join(root, row.path))), row.sha256);
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'compiler-source.json'))); lock.compilerVersion = '99.0';
  fs.writeFileSync(path.join(root, 'compiler-source.json'), json(lock)); assert.throws(() => readImport(root), /metadata disagrees/);
});
test('initial draft snapshot refresh accepts a README-only commit and preserves local edits', t => {
  const {root, draft, git} = draftSnapshotFixture(t);
  const head = git(['rev-parse', 'HEAD']), readme = fs.readFileSync(path.join(root, 'README.md'));
  const file = path.join(root, 'versions/0.2.0/spec/language.md'); fs.appendFileSync(file, 'Human edit');
  assert.throws(() => snapshot(root, '0.2.0', {refreshUncommitted: true}), /Modified/);
  fs.writeFileSync(file, draft.rows.get('spec/language.md'));
  snapshot(root, '0.2.0', {refreshUncommitted: true});
  assert.equal(readImport(path.join(root, 'versions/0.2.0'), {production: true}).lock.revision, 'a'.repeat(40));
  assert.throws(() => snapshot(root, '0.2.0', {refreshUncommitted: true}), /immutable/);
  assert.equal(git(['rev-parse', 'HEAD']), head);
  assert.equal(git(['diff', '--cached', '--name-only']), '');
  assert.deepEqual(fs.readFileSync(path.join(root, 'README.md')), readme);
});
test('unborn repositories can still refresh a hash-valid untracked draft snapshot', t => {
  const {root} = draftSnapshotFixture(t, {readmeCommit: false});
  snapshot(root, '0.2.0', {refreshUncommitted: true});
  assert.equal(readImport(path.join(root, 'versions/0.2.0')).lock.status, 'pinned');
});
test('staged snapshot files prevent draft refresh before any snapshot commit', t => {
  const {root, git} = draftSnapshotFixture(t);
  const lock = fs.readFileSync(path.join(root, 'versions/0.2.0/compiler-source.json'));
  git(['add', '--', 'versions/0.2.0/spec/language.md']);
  assert.throws(() => snapshot(root, '0.2.0', {refreshUncommitted: true}), /Tracked or staged/);
  assert.deepEqual(fs.readFileSync(path.join(root, 'versions/0.2.0/compiler-source.json')), lock);
});
test('tracked snapshot files remain immutable even when their source lock says draft', t => {
  const {root, git} = draftSnapshotFixture(t);
  git(['add', '--', 'versions/0.2.0']); git(['commit', '-m', 'Committed snapshot fixture']);
  assert.throws(() => snapshot(root, '0.2.0', {refreshUncommitted: true}), /Tracked or staged/);
  // Removing paths from the index does not remove their committed history.
  git(['rm', '-r', '--cached', '--', 'versions/0.2.0']);
  assert.throws(() => snapshot(root, '0.2.0', {refreshUncommitted: true}), /Committed snapshots/);
  assert.equal(readImport(path.join(root, 'versions/0.2.0')).lock.status, 'unpublished-draft');
});
test('snapshot history on another available ref prevents refreshing an untracked draft', t => {
  const {root, git, restore} = draftSnapshotFixture(t);
  git(['switch', '-c', 'snapshot-history']);
  git(['add', '--', 'versions/0.2.0']); git(['commit', '-m', 'Snapshot on another branch']);
  git(['tag', 'snapshot-history']); git(['switch', 'dev']); restore();
  assert.equal(git(['ls-files', '--', 'versions/0.2.0']), '');
  assert.throws(() => snapshot(root, '0.2.0', {refreshUncommitted: true}), /Committed snapshots/);
  git(['branch', '-D', 'snapshot-history']);
  // The tag alone must preserve the history guard after its branch is gone.
  assert.throws(() => snapshot(root, '0.2.0', {refreshUncommitted: true}), /Committed snapshots/);
  assert.equal(readImport(path.join(root, 'versions/0.2.0')).lock.status, 'unpublished-draft');
});
test('deleted upstream pages retire only unchanged importer-owned files', t => {
  const root = temporary(t), original = entries();original.set('spec/extra.md', Buffer.from('# Extra\n'));
  syncCompiler(root, makeImport(original, 'a'.repeat(40)));
  fs.writeFileSync(path.join(root, 'spec/community.md'), 'Human material');
  syncCompiler(root, makeImport(entries(), 'b'.repeat(40)));
  assert.ok(!fs.existsSync(path.join(root, 'spec/extra.md')));
  assert.equal(fs.readFileSync(path.join(root, 'spec/community.md'), 'utf8'), 'Human material');
});
test('public licensing rules cover snapshots, copied prose, JSON, examples, and relocated artwork', () => {
  const policy = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../licensing.json')));
  function matches(pattern, name) {
    const expression = pattern.split('/').map(part => part === '**' ? '.*' : part.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '[^/]*')).join('/');
    return new RegExp('^' + expression + '$').test(name);
  }
  const license = name => policy.exceptions.find(row => row.paths.some(p => matches(p, name)))?.license ?? policy.rules.find(row => row.paths.some(p => matches(p, name)))?.license ?? policy.defaultFirstPartySoftware;
  for (const file of ['pages/index.md', 'spec/language.md', 'versions/0.2.0/spec/language.md', 'compiler-inputs/docs/install.md']) assert.equal(license(file), 'CC-BY-4.0');
  assert.equal(license('compiler-inputs/examples/hello.kelft'), 'MIT-0');
  assert.equal(license('versions/0.2.0/spec/intrinsics.json'), 'MIT OR Apache-2.0');
  assert.ok(policy.exceptions.some(row => row.license === null && row.paths.some(p => matches(p, 'public/favicon.svg'))));
  for (const name of policy.dependencyInventories) assert.equal(name, 'pnpm-lock.yaml');
});
test('automation can reuse merged bot branches while protecting human work and site tooling', () => {
  assert.doesNotThrow(() => assertAutomationBranch([], []));
  assert.doesNotThrow(() => assertAutomationBranch([botEmail], ['spec/language.md', 'compiler-source.json']));
  assert.throws(() => assertAutomationBranch(['maintainer@example.invalid'], ['spec/language.md']), /human changes/);
  assert.throws(() => assertAutomationBranch([botEmail], ['.github/workflows/pages.yml']), /unexpected/);
});
