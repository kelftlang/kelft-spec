import fs from 'node:fs';
import path from 'node:path';
import {defineConfig} from 'vitepress';
import {settings, pageSource} from '../scripts/site.mjs';
const root = path.resolve(import.meta.dirname, '..');
const publication = settings(root);
const versions = fs.readdirSync(path.join(root, 'versions')).sort();
const grammar = JSON.parse(fs.readFileSync(path.join(root, 'syntaxes/kelft.tmLanguage.json')));
grammar.name = 'kelft'; grammar.aliases = [];
const navigation = prefix => [
  {text: 'Overview', link: prefix + '/'}, {text: 'Core language', link: prefix + '/language'},
  {text: 'Intent source', link: prefix + '/intent-v0.2'}, {text: 'Intent IR', link: prefix + '/intent'},
  {text: 'Compatibility & glossary', link: prefix + '/compatibility'}, {text: 'Runtime', link: prefix + '/runtime'},
  {text: 'Wasm', link: prefix + '/wasm'}, {text: 'Browser', link: prefix + '/browser'},
  {text: 'Native profiles', link: prefix + '/native'}, {text: 'Direct native contracts', link: prefix + '/native-direct'},
  {text: 'Services', link: prefix + '/services'}, {text: 'Execution protocol', link: prefix + '/driver-protocol'}
];
export default defineConfig({
  title: 'Kelft', description: 'Build with AI. Stay in control. An AI-native, intent-first programming language designed for safer, verifiable software under human control.',
  base: publication.base, srcDir: 'site', cleanUrls: false,
  sitemap: {hostname: publication.origin + publication.base},
  head: [
    ['meta', {name: 'twitter:creator', content: '@EVMlord'}],
    ['link', {rel: 'me', href: 'https://x.com/EVMlord'}],
    ['link', {rel: 'icon', type: 'image/x-icon', href: publication.base + 'favicon.ico'}],
    ['link', {rel: 'icon', type: 'image/svg+xml', href: publication.base + 'favicon.svg'}]
  ],
  transformHead({pageData}) {
    const route = pageData.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '.html');
    const url = publication.origin + publication.base + route;
    return [['link', {rel: 'canonical', href: url}], ['meta', {property: 'og:url', content: url}], ['meta', {property: 'og:title', content: pageData.title || 'Kelft'}], ['meta', {property: 'og:description', content: pageData.description || 'Build with AI. Stay in control.'}]];
  },
  transformPageData(pageData) {
    const source = pageSource(root, pageData.relativePath);
    if (source) pageData.frontmatter.compilerSource = source.url;
  },
  markdown: {html: false, languages: [grammar], config: md => {
    md.set({html: false});
    md.core.ruler.after('block', 'kelft-ebnf', state => {for (const token of state.tokens) if (token.type === 'fence' && token.info.trim() === 'ebnf') token.info = 'text';});
  }},
  themeConfig: {
    logo: {src: '/favicon.svg', alt: 'Kelft Brandmark'}, siteTitle: 'Kelft',
    nav: [{text: 'Get started', link: '/getting-started'}, {text: 'Specification', items: [{text: 'Development', link: '/dev/'}, ...versions.map(v => ({text: 'Snapshot ' + v, link: '/v' + v + '/'}))]}, {text: 'Compiler', link: '/compiler'}, {text: 'Editor', link: 'https://github.com/kelftlang/vscode-kelft'}],
    socialLinks: [{icon: 'github', link: 'https://github.com/kelftlang/kelft'}],
    sidebar: Object.fromEntries(['dev', ...versions.map(v => 'v' + v)].map(v => ['/' + v + '/', navigation('/' + v)])),
    search: {provider: 'local'},
    editLink: {pattern: ({relativePath, frontmatter}) => frontmatter.compilerSource || 'https://github.com/kelftlang/kelft-spec/blob/main/' + (relativePath === 'licensing.md' ? 'docs/licensing.md' : 'pages/' + relativePath), text: 'View source'},
    footer: {message: 'Prose CC BY 4.0 ? Examples MIT-0 ? Tooling MIT OR Apache-2.0 ? <a href="' + publication.base + 'licensing.html">Licensing</a>', copyright: 'Copyright ? 2026 Kelft contributors'}
  }
});
