import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), '中国象棋', 'web');
const OUT = join(process.cwd(), '中国象棋.html');

let html = readFileSync(join(DIST, 'index.html'), 'utf-8');
const assetsDir = join(DIST, 'assets');
const assetFiles = readdirSync(assetsDir);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let jsContent = '';
let cssContent = '';

for (const file of assetFiles) {
  if (file.endsWith('.js.map')) continue;
  const content = readFileSync(join(assetsDir, file), 'utf-8');
  if (file.endsWith('.js')) {
    jsContent = content;
    const re = new RegExp(
      `<script[^>]*src=["']/assets/${esc(file)}["'][^>]*></script>`,
      'g'
    );
    html = html.replace(re, '');
  } else if (file.endsWith('.css')) {
    cssContent = content;
    const re = new RegExp(
      `<link[^>]*href=["']/assets/${esc(file)}["'][^>]*>`,
      'g'
    );
    html = html.replace(re, '');
  }
}

if (cssContent) {
  html = html.replace('</head>', () => `<style>\n${cssContent}\n</style>\n</head>`);
}

if (jsContent) {
  html = html.replace('</body>', () => `<script>\n${jsContent}\n</script>\n</body>`);
}

try {
  const favicon = readFileSync(join(DIST, 'favicon.svg'), 'utf-8');
  const dataUri = 'data:image/svg+xml;base64,' + Buffer.from(favicon, 'utf-8').toString('base64');
  html = html.replace(/<link[^>]*rel=["']icon["'][^>]*>/g, () => `<link rel="icon" href="${dataUri}" />`);
} catch {}

writeFileSync(OUT, html, 'utf-8');
const sizeKB = (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(0);
console.log(`✓ 已生成单文件: ${OUT} (${sizeKB} KB)`);
