import fs from 'node:fs';
import path from 'node:path';
import {readImport, compilerRepository} from './upstream.mjs';

export function settings(root, environment = process.env) {
  const publication = JSON.parse(fs.readFileSync(path.join(root, 'publication.json')));
  const origin = environment.KELFT_SITE_ORIGIN || publication.origin;
  const base = environment.KELFT_SITE_BASE || publication.base;
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin || !/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base)) throw new Error('Expected HTTPS origin and absolute directory base.');
  return {...publication, origin, base};
}
export function compilerLink(lock, source, kind = 'blob') {
  return compilerRepository + '/' + kind + '/' + (lock.revision || 'main') + '/' + source;
}
export function pageSource(root, relativePath) {
  let match = /^dev\/(.+)$/.exec(relativePath), directory = root;
  if (!match) {
    match = /^v([^/]+)\/(.+)$/.exec(relativePath);
    if (!match) return null;
    directory = path.join(root, 'versions', match[1]);
    match = [match[0], match[2]];
  }
  const {lock} = readImport(directory);
  const source = 'spec/' + match[1].replace(/^index\.md$/, 'README.md');
  return {lock, source, url: compilerLink(lock, source)};
}
export function renderReference(text, source, lock) {
  // Rendering changes locations only. Imported Markdown and its hashes remain intact.
  const chunks = text.split(/(^```[^\n]*\n[\s\S]*?^```[^\n]*$)/gm);
  text = chunks.map((chunk, index) => index % 2 ? chunk : chunk
    .replace(/\]\(([^)]+)\)/g, (whole, href) => {
      if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(href)) return whole;
      const [raw, fragment] = href.split('#');
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(source), raw));
      if (target.startsWith('spec/')) return '](' + raw.replace(/(^|\/)README\.md$/, '$1index.md') + (fragment ? '#' + fragment : '') + ')';
      if (target.startsWith('../')) throw new Error('Upstream link escapes repository: ' + href);
      return '](' + compilerLink(lock, target) + (fragment ? '#' + fragment : '') + ')';
    })
    .replace(/`(selfhost\/[A-Za-z0-9_./-]+\.kelft)`/g, (_all, file) => '[`' + file + '`](' + compilerLink(lock, file) + ')')).join('');
  const identity = lock.revision ? 'commit `' + lock.revision + '`' : '**unpublished compiler draft**';
  const warning = lock.status === 'unpublished-draft' ? '::: warning Unpublished preview\nThis preview uses a prepared public compiler draft. It does not identify a published compiler commit or release.\n:::\n\n' : '';
  return warning + text + '\n\n---\n\nSource: [public Kelft compiler](' + compilerLink(lock, source) + '), ' + identity + '. Compiler **' + lock.compilerVersion + '**; Core **' + lock.coreVersion + '**; Intent **' + lock.intentVersion + '**.\n';
}
