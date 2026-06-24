import http from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const PORT = 3000;

const MIME = {
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.md': 'text/plain; charset=utf-8',
};

const FILES = [
  '中国象棋_解压即用.zip',
  'chinese-chess.zip',
  'chinese-chess.tar.gz',
  '本地运行说明.md',
];

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url || '/');

  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>中国象棋 · 下载</title>
<style>
  body{font-family:"Microsoft YaHei",sans-serif;background:#1a1612;color:#ece3cf;margin:0;padding:40px 20px;text-align:center}
  h1{color:#d4af52;font-size:28px;margin-bottom:8px}
  p.sub{color:#8a7d5e;margin-bottom:32px}
  .file{display:inline-block;margin:10px;padding:20px 32px;background:#272019;border:1px solid #4a3d2e;border-radius:12px;text-decoration:none;color:#ece3cf;font-size:16px;transition:all .2s}
  .file:hover{background:#332a20;border-color:#d4af52;transform:translateY(-2px)}
  .file .name{font-weight:bold;display:block;margin-bottom:4px}
  .file .size{font-size:13px;color:#8a7d5e}
  .tip{margin-top:36px;padding:16px 24px;background:#272019;border-radius:8px;display:inline-block;text-align:left;color:#8a7d5e;font-size:14px;line-height:1.8;max-width:520px}
</style></head><body>
<h1>中國象棋 · 项目下载</h1>
<p class="sub">推荐下载「解压即用版」，无需安装任何软件</p>
${FILES.map((f) => {
  let size = '';
  try { size = (statSync(join(ROOT, f)).size / 1024).toFixed(0) + ' KB'; } catch { size = '-'; }
  return `<a class="file" href="/${encodeURIComponent(f)}"><span class="name">📦 ${f}</span><span class="size">${size}</span></a>`;
}).join('')}
<div class="tip">
<b style="color:#d4af52">下载后如何运行：</b><br>
1. 解压 chinese-chess.zip 到任意文件夹<br>
2. 安装 Node.js（nodejs.org）<br>
3. 命令行进入文件夹，执行 <code style="color:#d4af52">npm install</code><br>
4. 执行 <code style="color:#d4af52">npm run dev</code><br>
5. 浏览器打开 http://localhost:5173/
</div>
</body></html>`);
    return;
  }

  const fileName = url.slice(1);
  if (!FILES.includes(fileName)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('文件不存在');
    return;
  }

  try {
    const data = readFileSync(join(ROOT, fileName));
    const mime = MIME[extname(fileName)] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Content-Length': data.length,
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('读取文件失败');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`下载服务已启动：`);
  console.log(`  ➜  http://localhost:${PORT}/`);
});
