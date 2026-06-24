import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const PORT = 3001;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  let js = '';
  let css = '';
  try { js = readFileSync(join(ROOT, '中国象棋/web/assets/index-DRUcVeX-.js'), 'utf-8'); } catch (e) { js = 'console.error("读取JS失败:"+arguments[0])'; }
  try { css = readFileSync(join(ROOT, '中国象棋/web/assets/index-5kyAybjO.css'), 'utf-8'); } catch {}

  res.end(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>诊断</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<div id="diag" style="position:fixed;top:0;left:0;right:0;background:#fff;color:#000;padding:10px;font:13px monospace;z-index:99999;max-height:50vh;overflow:auto;white-space:pre-wrap"></div>
<script>
  var d = document.getElementById('diag');
  function log(msg){ d.textContent += msg + '\\n'; }
  window.addEventListener('error', function(e){
    log('[ERROR] ' + (e.message||'') + ' @ ' + (e.filename||'') + ':' + (e.lineno||'') + ':' + (e.colno||''));
    if(e.error && e.error.stack) log(e.error.stack);
  });
  window.addEventListener('unhandledrejection', function(e){
    log('[PROMISE] ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
  });
  log('页面加载开始');
  log('root元素: ' + !!document.getElementById('root'));
  log('JS长度: ' + ${js.length});
  try {
    log('开始执行JS...');
    ${js}
    log('JS执行完毕');
    setTimeout(function(){
      log('root内容长度: ' + (document.getElementById('root').innerHTML.length));
      log('root子元素数: ' + document.getElementById('root').childElementCount);
    }, 500);
  } catch(err) {
    log('[执行异常] ' + err.message);
    if(err.stack) log(err.stack);
  }
</script>
</body>
</html>`);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('诊断服务: http://localhost:' + PORT + '/');
});
