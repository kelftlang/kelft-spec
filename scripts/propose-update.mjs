import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {readImport} from './upstream.mjs';
import {updateBranch as branch, botEmail as bot, generatedInput as allowed, assertAutomationBranch} from './update-policy.mjs';

const root = path.resolve(import.meta.dirname, '..');
const run = (command, args) => execFileSync(command, args, {cwd: root, encoding: 'utf8', windowsHide: true}).trim();
const git = args => run('git', args);
const changed = [...git(['diff', '--name-only']).split('\n'), ...git(['ls-files', '--others', '--exclude-standard']).split('\n')].filter(Boolean);
if (!changed.length || changed.some(name => !allowed(name))) throw new Error('Update contains unexpected files.');
const remote = git(['ls-remote', '--heads', 'origin', 'refs/heads/' + branch]);
const expected = remote.split(/\s/)[0];
if (expected) {
  git(['fetch', '--no-tags', 'origin', 'refs/heads/' + branch]);
  const authors = git(['log', 'origin/main..FETCH_HEAD', '--format=%ae']).split('\n').filter(Boolean);
  const paths = git(['diff', '--name-only', 'origin/main...FETCH_HEAD']).split('\n').filter(Boolean);
  assertAutomationBranch(authors, paths);
}
const {lock} = readImport(root, {production: true});
const generated = ['spec', 'compiler-inputs', 'compiler-source.json', '.publication.json'].filter(name => fs.existsSync(path.join(root, name)));
git(['add', '--', ...generated]);
if (expected && !git(['diff', '--name-only', 'FETCH_HEAD', '--', ...generated])) {
  console.log('The pending update already contains these inputs.');
  process.exit(0);
}
git(['config', 'user.name', 'github-actions[bot]']); git(['config', 'user.email', bot]);
git(['switch', '-c', branch]);
git(['commit', '-s', '-m', 'Update specification from public compiler ' + lock.revision.slice(0, 12)]);
run('gh', ['auth', 'setup-git']);
git(['push', '--force-with-lease=refs/heads/' + branch + ':' + expected, 'origin', 'HEAD:refs/heads/' + branch]);
const prs = JSON.parse(run('gh', ['pr', 'list', '--head', branch, '--base', 'main', '--state', 'open', '--json', 'number']));
const body = path.join(os.tmpdir(), 'kelft-spec-update-' + process.pid + '.md');
fs.writeFileSync(body, 'Updates the development reference from [public compiler commit ' + lock.revision.slice(0, 12) + '](' + lock.repository + '/commit/' + lock.revision + ').\n\nCompiler: ' + lock.compilerVersion + '. Existing specification snapshots are unchanged.\n\nValidation: source hashes, import tests, Markdown checks, production website build, and generated links/assets/anchors. Review and merge separately; deployment remains manual.\n');
try {
  if (prs.length) run('gh', ['pr', 'edit', String(prs[0].number), '--title', 'Update specification from public compiler', '--body-file', body]);
  else run('gh', ['pr', 'create', '--head', branch, '--base', 'main', '--title', 'Update specification from public compiler', '--body-file', body]);
} finally {fs.unlinkSync(body);}
