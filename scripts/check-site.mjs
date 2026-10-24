import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export function validateSite(root, base = '/') {
  const files = [];
  function walk(directory) {
    for (const item of fs.readdirSync(directory, {withFileTypes: true})) {
      const file = path.join(directory, item.name);
      if (item.isSymbolicLink()) throw new Error('Generated site symlink.');
      if (item.isDirectory()) walk(file);
      else if (item.name.endsWith('.html')) files.push(file);
    }
  }
  walk(root);
  const cache = new Map(), failures = [];
  function ids(file) {
    if (!cache.has(file)) cache.set(file, new Set([...fs.readFileSync(file, 'utf8').matchAll(/\bid="([^"]+)"/g)].map(m => m[1])));
    return cache.get(file);
  }
  let links = 0, anchors = 0;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    if (/Bracket K|github\.com\/[^/]+\/kelft-ts(?:\/|["#])|docs\/references\//.test(html)) failures.push(path.relative(root, file) + ': private or stale content');
    const page = new URL(base + path.relative(root, file).replaceAll('\\', '/'), 'https://site.invalid');
    for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const href = match[1].replaceAll('&amp;', '&');
      if (/^(https?:|mailto:|data:|javascript:)/i.test(href)) continue;
      links++;
      const target = new URL(href, page);
      if (target.origin !== page.origin || !target.pathname.startsWith(base)) {failures.push(href + ': outside configured site base'); continue;}
      const relative = decodeURIComponent(target.pathname.slice(base.length));
      let destination = path.resolve(root, relative);
      if (!destination.startsWith(path.resolve(root) + path.sep) && destination !== path.resolve(root)) throw new Error('Generated link escapes site.');
      if (fs.existsSync(destination) && fs.statSync(destination).isDirectory()) destination = path.join(destination, 'index.html');
      if (!fs.existsSync(destination)) failures.push(path.relative(root, file) + ': missing ' + href);
      else if (target.hash && destination.endsWith('.html')) {
        anchors++;
        if (!ids(destination).has(decodeURIComponent(target.hash.slice(1)))) failures.push(path.relative(root, file) + ': missing anchor ' + href);
      }
    }
  }
  if (!files.length || failures.length) throw new Error('Generated website validation failed:\n' + failures.join('\n'));
  return {status: 'passed', htmlPages: files.length, localLinks: links, anchors, base};
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) console.log(JSON.stringify(validateSite(path.resolve(process.argv[2]), process.argv[3] || '/')));
