import http from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const PORT = 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.md': 'text/plain; charset=utf-8',
};

const FILES = [
  { name: '中国象棋.html', label: '单文件版（推荐）', desc: '下载后双击即可玩，无需任何软件', icon: '🎯' },
  { name: '中国象棋_解压即用.zip', label: '解压即用版', desc: 'Windows 双击「双击启动.bat」即可', icon: '📦' },
  { name: 'chinese-chess.zip', label: '源代码', desc: '完整项目源码，开发者使用', icon: '💻' },
];

function lastSegment(url) {
  const path = url.split('?')[0].split('#')[0];
  const segs = decodeURIComponent(path).split('/').filter(Boolean);
  return segs.length ? segs[segs.length - 1] : '';
}

function fileSize(name) {
  try { return (statSync(join(ROOT, name)).size / 1024).toFixed(0) + ' KB'; } catch { return '-'; }
}

function downloadPage() {
  const fileCards = FILES.map((f) => `
    <a class="card" href="${encodeURIComponent(f.name)}" download>
      <div class="card-icon">${f.icon}</div>
      <div class="card-body">
        <div class="card-name">${f.label}</div>
        <div class="card-file">${f.name}</div>
        <div class="card-desc">${f.desc}</div>
      </div>
      <div class="card-size">${fileSize(f.name)}</div>
    </a>`).join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>中国象棋 · 下载</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;background:radial-gradient(ellipse at top,#2a2018,#15110d);color:#ece3cf;min-height:100vh;padding:32px 16px 64px}
  .wrap{max-width:680px;margin:0 auto}
  h1{font-size:30px;color:#d4af52;text-align:center;letter-spacing:2px;margin-bottom:6px}
  .sub{text-align:center;color:#8a7d5e;margin-bottom:28px;font-size:14px}
  .play{display:block;text-align:center;text-decoration:none;margin:0 auto 32px;width:fit-content;padding:14px 40px;background:linear-gradient(135deg,#c0392b,#8e2a1f);color:#fff;border-radius:30px;font-size:17px;font-weight:bold;box-shadow:0 4px 16px rgba(192,57,43,.4);transition:transform .2s,box-shadow .2s}
  .play:hover{transform:translateY(-2px);box-shadow:0 6px 22px rgba(192,57,43,.55)}
  .card{display:flex;align-items:center;gap:16px;text-decoration:none;color:#ece3cf;background:#272019;border:1px solid #4a3d2e;border-radius:14px;padding:18px 22px;margin-bottom:14px;transition:all .2s}
  .card:hover{background:#332a20;border-color:#d4af52;transform:translateX(4px)}
  .card-icon{font-size:30px;flex-shrink:0}
  .card-body{flex:1;min-width:0}
  .card-name{font-size:17px;font-weight:bold;margin-bottom:2px}
  .card-file{font-size:12px;color:#6b5e47;margin-bottom:4px;word-break:break-all}
  .card-desc{font-size:13px;color:#9a8d6e}
  .card-size{font-size:13px;color:#d4af52;flex-shrink:0;font-weight:bold}
  .tip{margin-top:30px;padding:18px 22px;background:#1f1a14;border-left:3px solid #d4af52;border-radius:8px;font-size:14px;line-height:1.9;color:#9a8d6e}
  .tip b{color:#d4af52}
  .tip code{background:#332a20;padding:2px 7px;border-radius:4px;color:#d4af52;font-size:13px}
  .rec{display:inline-block;background:#c0392b;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:8px;vertical-align:middle}
</style>
</head>
<body>
<div class="wrap">
  <h1>中國象棋 · 楚河漢界</h1>
  <p class="sub">标准比赛规则 · 人机对战三档难度 · 声效</p>

  <a class="play" href="play">▶ 在线试玩（直接在浏览器里玩）</a>

  <h2 style="font-size:16px;color:#8a7d5e;margin-bottom:14px;font-weight:normal">下载到本地：</h2>
  ${fileCards}

  <div class="tip">
    <b>推荐：</b>下载「单文件版」<span class="rec">推荐</span>，只需一个 <code>中国象棋.html</code> 文件。<br>
    下载后<b>双击</b>它，用 Edge / Chrome 浏览器打开即可游玩，无需安装任何软件。<br><br>
    <b>解压即用版：</b>解压后双击 <code>双击启动.bat</code>，会自动打开浏览器（无需 Node.js）。<br><br>
    <b>在线试玩：</b>点击上方按钮，无需下载，直接在当前浏览器里玩。
  </div>
</div>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const seg = lastSegment(req.url || '/');

  if (seg === '' || seg === 'index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(downloadPage());
    return;
  }

  if (seg === 'play') {
    try {
      const data = readFileSync(join(ROOT, '中国象棋.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('游戏文件不存在');
    }
    return;
  }

  const file = FILES.find((f) => f.name === seg);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('文件不存在');
    return;
  }

  try {
    const data = readFileSync(join(ROOT, file.name));
    const mime = MIME[extname(file.name)] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'Content-Length': data.length,
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('读取文件失败');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`下载服务已启动：http://localhost:${PORT}/`);
});
