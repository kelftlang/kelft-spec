import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import {pathToFileURL} from 'node:url';
import {readImport} from './upstream.mjs';

const parser = new MarkdownIt({html: false});
export function slug(text) {
  return text.trim().toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
}
export function validateMarkdown(root, directories = ['spec', 'versions', 'docs', 'README.md', 'CONTRIBUTING.md', 'TRADEMARKS.md']) {
  const files = [];
  function walk(directory) {
    if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('Publication symlink: ' + directory);
    if (fs.statSync(directory).isFile()) {if(directory.endsWith('.md'))files.push(directory);return;}
    for (const item of fs.readdirSync(directory, {withFileTypes: true})) {
      // These are verbatim upstream inputs, not website pages; their hashes are checked.
      if (item.isDirectory() && item.name === 'compiler-inputs') continue;
      const file = path.join(directory, item.name);
      if (item.isSymbolicLink()) throw new Error('Publication symlink: ' + file);
      if (item.isDirectory()) walk(file);
      else if (item.name.endsWith('.md')) files.push(file);
    }
  }
  for (const directory of directories) if (fs.existsSync(path.join(root, directory))) walk(path.join(root, directory));
  const anchors = new Map();
  function headings(file) {
    if (anchors.has(file)) return anchors.get(file);
    const tokens = parser.parse(fs.readFileSync(file, 'utf8'), {}), found = new Set(), counts = new Map();
    for (let index = 0; index < tokens.length; index++) if (tokens[index].type === 'heading_open') {
      const base = slug(tokens[index + 1].content), count = counts.get(base) || 0;
      found.add(base + (count ? '-' + count : '')); counts.set(base, count + 1);
    }
    anchors.set(file, found); return found;
  }
  function link(file, href) {
    if (/^(https?:|mailto:)/.test(href)) {
      if (/github\.com\/kelftlang\/kelft-ts(?:\/|$)/.test(href)) throw new Error('Private repository link: ' + href);
      return;
    }
    if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')) throw new Error('Unsupported publication link: ' + href);
    const [raw, fragment] = href.split('#'), target = path.resolve(path.dirname(file), decodeURIComponent(raw.split('?')[0] || path.basename(file)));
    const relative = path.relative(root, target);
    if (!fs.existsSync(target)) {
      const location = path.relative(root,file).replaceAll('\\','/');
      const match = /^(versions\/[^/]+\/)?spec\/(.+)$/.exec(location);
      if (match && fs.existsSync(path.join(root, match[1] || '', 'compiler-source.json'))) {
        const {lock} = readImport(path.join(root, match[1] || ''));
        const source = path.posix.normalize(path.posix.join('spec', path.posix.dirname(match[2]), raw));
        if (lock.files.some(entry => entry.source === source)) return;
      }
    }
    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(target)) throw new Error(`Missing publication link in ${path.relative(root,file)}: ${href}`);
    if (fragment && target.endsWith('.md') && !headings(target).has(decodeURIComponent(fragment))) throw new Error('Missing publication anchor: ' + href);
  }
  function visit(file, tokens) {
    for (const token of tokens) {
      if (token.type === 'link_open') link(file, token.attrGet('href'));
      if (token.type === 'image') link(file, token.attrGet('src'));
      if (token.children) visit(file, token.children);
    }
  }
  for (const file of files) visit(file, parser.parse(fs.readFileSync(file, 'utf8'), {}));
  return {markdownFiles: files.length, status: 'passed'};
}
export function checkPublication(root) {
  const current = readImport(root);
  for (const version of fs.readdirSync(path.join(root, 'versions'))) readImport(path.join(root, 'versions', version));
  return {...validateMarkdown(root), sourceStatus: current.lock.status};
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) console.log(JSON.stringify(checkPublication(path.resolve(import.meta.dirname, '..'))));
