import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const compilerRepository = 'https://github.com/kelftlang/kelft';
export const hash = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
export const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
export const compilerMetadata = ['release.json', 'examples/hello.kelft', 'docs/install.md', 'docs/licensing.md', 'CONTRIBUTING.md', 'host/native/resource-contracts.json'];
const metadata = compilerMetadata;
export function safePath(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9._/-]+$/.test(name) || name.startsWith('/') || name.split('/').some(p => !p || p === '.' || p === '..' || p.toLowerCase() === '.git' || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) throw new Error('Unsafe publication path: ' + name);
  return name;
}
export function readSafe(root, name) {
  let file = path.resolve(root);
  if (fs.lstatSync(file).isSymbolicLink()) throw new Error('Publication symlink: ' + file);
  for (const part of safePath(name).split('/')) {
    file = path.join(file, part);
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw new Error('Publication symlink: ' + name);
  }
  return fs.readFileSync(file);
}
function destination(root, name) {
  safePath(name);
  let file = path.resolve(root);
  if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw new Error('Publication root symlink.');
  for (const part of name.split('/')) {
    file = path.join(file, part);
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw new Error('Publication symlink: ' + name);
  }
  return file;
}
function importedPath(source) {
  if (/^spec\/[A-Za-z0-9._-]+\.(md|json)$/.test(source)) return source;
  if (metadata.includes(source)) return 'compiler-inputs/' + source;
  throw new Error('Unexpected compiler input: ' + source);
}
export function makeImport(entries, revision = null) {
  if (revision !== null && !/^[a-f0-9]{40}$/.test(revision)) throw new Error('Expected full public compiler commit SHA.');
  const release = JSON.parse(entries.get('release.json'));
  for (const key of ['version', 'coreVersion', 'intentVersion', 'specificationVersion']) if (typeof release[key] !== 'string' || !/^\d+\.\d+(?:\.\d+)?(?:-[A-Za-z0-9.-]+)?$/.test(release[key])) throw new Error('Invalid compiler version: ' + key);
  for (const file of ['spec/README.md', 'spec/language.md', 'spec/intent-v0.2.md', 'spec/intrinsics.json', ...metadata]) if (!entries.has(file)) throw new Error('Missing compiler input: ' + file);
  JSON.parse(entries.get('spec/intrinsics.json'));
  const rows = new Map(), files = [];
  for (const [source, bytes] of [...entries].sort(([a], [b]) => a.localeCompare(b))) {
    const name = importedPath(source);
    if (/\.md$/.test(source) && /Bracket K|docs\/references\/|owner revised|private development repository|scripts\/test-native-aggregate\.mjs/.test(bytes.toString('utf8'))) throw new Error('Unreviewed public compiler wording: ' + source);
    rows.set(name, bytes);
    files.push({source, path: name, sha256: hash(bytes), bytes: bytes.length});
  }
  const lock = {schema: 'kelft.compiler-source/1', repository: compilerRepository, revision, status: revision ? 'pinned' : 'unpublished-draft', compilerVersion: release.version, coreVersion: release.coreVersion, intentVersion: release.intentVersion, specificationVersion: release.specificationVersion, files};
  rows.set('compiler-source.json', json(lock));
  return {rows, lock};
}
export function readDraftCompiler(root) {
  const entries = new Map();
  for (const name of fs.readdirSync(path.join(root, 'spec')).sort()) {
    if (!/^[A-Za-z0-9._-]+\.(md|json)$/.test(name)) throw new Error('Unexpected compiler specification entry: ' + name);
    entries.set('spec/' + name, readSafe(root, 'spec/' + name));
  }
  for (const name of metadata) entries.set(name, readSafe(root, name));
  const manifestPath = path.join(root, '.publication.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(readSafe(root, '.publication.json'));
    for (const [name, bytes] of entries) if (manifest.files?.find(row => row.path === name)?.sha256 !== hash(bytes)) throw new Error('Modified prepared compiler input: ' + name);
  }
  return makeImport(entries);
}
export async function readPublicCompiler(ref = 'main', fetcher = fetch) {
  if (!/^[A-Za-z0-9._/-]+$/.test(ref)) throw new Error('Invalid public compiler ref.');
  async function request(url, asJSON = false) {
    const response = await fetcher(url, {signal: AbortSignal.timeout(30000), headers: {'User-Agent': 'kelft-spec-sync', ...(url.startsWith('https://api.github.com/') && process.env.GH_TOKEN ? {Authorization: 'Bearer ' + process.env.GH_TOKEN} : {})}});
    if (!response.ok) throw new Error('Public compiler request failed: ' + response.status + ' ' + url);
    return asJSON ? response.json() : Buffer.from(await response.arrayBuffer());
  }
  const commit = await request('https://api.github.com/repos/kelftlang/kelft/commits/' + encodeURIComponent(ref), true);
  if (!/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error('Invalid public compiler commit.');
  const listing = await request('https://api.github.com/repos/kelftlang/kelft/contents/spec?ref=' + commit.sha, true);
  if (!Array.isArray(listing) || !listing.length || listing.some(e => e.type !== 'file' || !/^[A-Za-z0-9._-]+\.(md|json)$/.test(e.name))) throw new Error('Unexpected public specification tree.');
  const names = [...listing.map(e => 'spec/' + e.name), ...metadata];
  const entries = new Map();
  // Fetch immutable inputs in bounded batches, never execute upstream scripts.
  for (let i = 0; i < names.length; i += 4) {
    const batch = await Promise.all(names.slice(i, i + 4).map(async name => [name, await request('https://raw.githubusercontent.com/kelftlang/kelft/' + commit.sha + '/' + name)]));
    for (const [name, bytes] of batch) entries.set(name, bytes);
  }
  return makeImport(entries, commit.sha);
}
export function readImport(root, {production = false} = {}) {
  const lock = JSON.parse(readSafe(root, 'compiler-source.json'));
  if (lock.schema !== 'kelft.compiler-source/1' || lock.repository !== compilerRepository || !Array.isArray(lock.files) || (lock.status === 'pinned' ? !/^[a-f0-9]{40}$/.test(lock.revision) : lock.status !== 'unpublished-draft' || lock.revision !== null)) throw new Error('Invalid compiler source lock.');
  if (production && lock.status !== 'pinned') throw new Error('Production requires a pinned public compiler commit; this is an unpublished draft.');
  const entries = new Map();
  for (const file of lock.files) {
    if (file.path !== importedPath(file.source) || entries.has(file.source)) throw new Error('Invalid compiler source inventory.');
    const bytes = readSafe(root, file.path);
    if (hash(bytes) !== file.sha256 || bytes.length !== file.bytes) throw new Error('Modified compiler source input: ' + file.path);
    entries.set(file.source, bytes);
  }
  const result = makeImport(entries, lock.revision);
  if (!json(result.lock).equals(json(lock))) throw new Error('Compiler source metadata disagrees with inputs.');
  return result;
}
export function syncCompiler(root, incoming) {
  const previous = fs.existsSync(path.join(root, 'compiler-source.json')) ? readImport(root) : null;
  const old = new Map(previous?.lock.files.map(file => [file.path, file.sha256]) ?? []);
  const deletions = [...old.keys()].filter(name => !incoming.rows.has(name));
  for (const [name, bytes] of incoming.rows) {
    const file = destination(root, name);
    if (fs.existsSync(file) && name !== 'compiler-source.json' && !fs.readFileSync(file).equals(bytes) && hash(fs.readFileSync(file)) !== old.get(name)) throw new Error('Refusing to overwrite local edit: ' + name);
  }
  if (previous && json(previous.lock).equals(json(incoming.lock))) return false;
  if (previous?.lock.status === 'pinned' && incoming.lock.status === 'pinned' && json(previous.lock.files).equals(json(incoming.lock.files))) return false;
  const manifestFile = path.join(root, '.publication.json');
  let manifest = fs.existsSync(manifestFile) ? JSON.parse(readSafe(root, '.publication.json')) : null;
  if (manifest) {
    const replaced = new Set([...old.keys(), ...incoming.rows.keys()]);
    const files = manifest.files.filter(file => !replaced.has(file.path));
    for (const [name, bytes] of incoming.rows) files.push({path: name, sha256: hash(bytes), bytes: bytes.length});
    manifest = {...manifest, sourceRepository: compilerRepository, sourceRevision: incoming.lock.revision ?? 'unpublished-draft', sourceDirty: !incoming.lock.revision, files: files.sort((a, b) => a.path.localeCompare(b.path))};
  }
  for (const [name, bytes] of incoming.rows) {
    const file = destination(root, name);
    fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, bytes);
  }
  for (const name of deletions) fs.unlinkSync(destination(root, name));
  if (manifest) fs.writeFileSync(manifestFile, json(manifest));
  return true;
}
export function snapshot(root, version, {refreshUncommitted = false} = {}) {
  if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version)) throw new Error('Invalid snapshot version.');
  const current = readImport(root, {production: true});
  const target = path.join(root, 'versions', version);
  if (fs.existsSync(target)) {
    if (!refreshUncommitted || readImport(target).lock.status !== 'unpublished-draft') throw new Error('Snapshot already exists and is immutable: ' + version);
    const git = args => execFileSync('git', ['-c', 'safe.directory=' + path.resolve(root), '-C', root, ...args], {encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']}).trim();
    if (fs.realpathSync(git(['rev-parse', '--show-toplevel'])).toLowerCase() !== fs.realpathSync(root).toLowerCase()) throw new Error('Expected the website repository root.');
    const snapshotPath = 'versions/' + version + '/';
    if (git(['ls-files', '--', snapshotPath])) throw new Error('Tracked or staged snapshots are immutable.');
    if (git(['rev-list', '--all', '--max-count=1', '--', snapshotPath])) throw new Error('Committed snapshots are immutable.');
    syncCompiler(target, current);
  } else for (const [name, bytes] of current.rows) {
      const file = destination(root, 'versions/' + version + '/' + name);
      if (fs.existsSync(file)) throw new Error('Snapshot file collision.');
      fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, bytes);
    }
  // A new snapshot joins the reviewed site inventory when one is present.
  const manifestFile = path.join(root, '.publication.json');
  if (fs.existsSync(manifestFile)) {
    const manifest = JSON.parse(readSafe(root, '.publication.json'));
    manifest.files = manifest.files.filter(file => !file.path.startsWith('versions/' + version + '/'));
    for (const [name, bytes] of current.rows) manifest.files.push({path: 'versions/' + version + '/' + name, sha256: hash(bytes), bytes: bytes.length});
    manifest.files.sort((a, b) => a.path.localeCompare(b.path));
    fs.writeFileSync(manifestFile, json(manifest));
  }
}
export async function runCLI(args) {
  const root = path.resolve(import.meta.dirname, '..');
  if (args[0] === 'snapshot' && (args.length === 2 || (args.length === 3 && args[2] === '--refresh-uncommitted'))) {snapshot(root, args[1], {refreshUncommitted: args.length === 3}); return;}
  let incoming;
  if (args[0] === '--draft' && args[1] === '--source' && args.length === 3) incoming = readDraftCompiler(path.resolve(args[2]));
  else if (args[0] === '--ref' && args.length === 2) incoming = await readPublicCompiler(args[1]);
  else throw new Error('Usage: sync --ref REF | --draft --source PUBLIC_COMPILER | snapshot VERSION');
  const changed = syncCompiler(root, incoming);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'changed=' + changed + '\n');
  console.log(JSON.stringify({changed, compiler: incoming.lock.compilerVersion, revision: incoming.lock.revision, status: incoming.lock.status}));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await runCLI(process.argv.slice(2));
