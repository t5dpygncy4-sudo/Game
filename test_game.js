// Node VM sandbox test harness for /workspace/game.html
// 提取 <script> 内容并用 vm 沙箱执行，模拟 Canvas/Audio/Input/InputEvent 等浏览器环境

const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('/workspace/game.html', 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error('NO SCRIPT FOUND'); process.exit(1); }
const code = m[1];

// ---- 模拟 DOM / Canvas 2D 上下文 ----
class CanvasCtx2D {
  constructor(){ this._ops=[]; this._fill=''; this._stroke=''; this._lineWidth=1; this._shadowBlur=0; this._shadowColor=''; }
  save(){ this._ops.push(['save']); }
  restore(){ this._ops.push(['restore']); }
  translate(x,y){ this._ops.push(['translate',x,y]); }
  rotate(a){ this._ops.push(['rotate',a]); }
  scale(x,y){ this._ops.push(['scale',x,y]); }
  beginPath(){ this._ops.push(['beginPath']); }
  closePath(){ this._ops.push(['closePath']); }
  moveTo(x,y){ this._ops.push(['moveTo',x,y]); }
  lineTo(x,y){ this._ops.push(['lineTo',x,y]); }
  quadraticCurveTo(cx,cy,x,y){ this._ops.push(['quad',cx,cy,x,y]); }
  bezierCurveTo(a,b,c,d,e,f){ this._ops.push(['bezier',a,b,c,d,e,f]); }
  arc(x,y,r,a0,a1){ this._ops.push(['arc',x,y,r,a0,a1]); }
  ellipse(x,y,rx,ry,rot,a0,a1){ this._ops.push(['ellipse',x,y,rx,ry,rot,a0,a1]); }
  fillRect(x,y,w,h){ this._ops.push(['fillRect',x,y,w,h]); }
  strokeRect(x,y,w,h){ this._ops.push(['strokeRect',x,y,w,h]); }
  fill(){ this._ops.push(['fill']); }
  stroke(){ this._ops.push(['stroke']); }
  createRadialGradient(x0,y0,r0,x1,y1,r1){ return {addColorStop:()=>{}}; }
  createLinearGradient(x0,y0,x1,y1){ return {addColorStop:()=>{}}; }
  set fillStyle(v){ this._fill=v; }
  get fillStyle(){ return this._fill; }
  set strokeStyle(v){ this._stroke=v; }
  get strokeStyle(){ return this._stroke; }
  set lineWidth(v){ this._lineWidth=v; }
  get lineWidth(){ return this._lineWidth; }
  set shadowBlur(v){ this._shadowBlur=v; }
  get shadowBlur(){ return this._shadowBlur; }
  set shadowColor(v){ this._shadowColor=v; }
  get shadowColor(){ return this._shadowColor; }
  set font(v){}
  set textAlign(v){}
  set textBaseline(v){}
  set globalAlpha(v){}
  measureText(t){ return {width:t.length*8}; }
  fillText(t,x,y){ this._ops.push(['fillText',t,x,y]); }
  strokeText(t,x,y){ this._ops.push(['strokeText',t,x,y]); }
  clearRect(x,y,w,h){ this._ops.push(['clearRect',x,y,w,h]); }
  drawImage(){ }
  clip(){ }
  isPointInPath(){ return false; }
}

class CanvasElement {
  constructor(w,h){ this.width=w; this.height=h; this._ctx=new CanvasCtx2D(); }
  getContext(){ return this._ctx; }
  addEventListener(){}
  removeEventListener(){}
  getBoundingClientRect(){ return {left:0,top:0,width:this.width,height:this.height}; }
}

// ---- 模拟 window / document / AudioContext / requestAnimationFrame ----
const canvas = new CanvasElement(960, 600);
const documentMock = {
  getElementById(id){ if(id==='game') return canvas; return null; },
  createElement(t){ if(t==='canvas') return new CanvasElement(960,600); return {}; },
  addEventListener(){},
  removeEventListener(){},
  body:{ appendChild(){} },
  querySelector(){ return null; },
};
class AudioContextMock {
  get currentTime(){ return 0; }
  createOscillator(){ return {type:'',frequency:{setValueAtTime(){}},connect(){},start(){},stop(){}}; }
  createGain(){ return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){}}; }
}
const windowMock = {
  AudioContext: AudioContextMock,
  webkitAudioContext: AudioContextMock,
  addEventListener(){},
  removeEventListener(){},
  innerWidth: 960,
  innerHeight: 600,
  devicePixelRatio: 1,
  requestAnimationFrame: ()=>0,
  cancelAnimationFrame: ()=>{},
};
const sandbox = {
  window: windowMock,
  document: documentMock,
  console,
  AudioContext: AudioContextMock,
  webkitAudioContext: AudioContextMock,
  requestAnimationFrame: ()=>0,
  cancelAnimationFrame: ()=>{},
  Math,
  Date,
  JSON,
  parseInt, parseFloat,
  setTimeout, clearTimeout, setInterval, clearInterval,
  performance: { now: ()=>0 },
  navigator: { userAgent: 'node' },
  location: { href:'http://localhost/' },
  Image: class {},
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

// const/let 不会挂到 globalThis，所以追加导出
const exportLine = `
globalThis.__exports = {
  Game, LEVELS, CFG, COLORS, Input, Audio2,
  Player, Wingman, Bullet, Enemy, Boss,
  Obstacle, ObstacleSpawner, Starfield, WAVE_TEMPLATES,
};
`;
vm.runInContext(exportLine, sandbox);
const E = sandbox.__exports;
for(const k in E) sandbox[k] = E[k];

// ---- 测试用例 ----
const tests = [];
function test(name, fn){ tests.push({name, fn}); }

// Helper: 实例化 Game，并设置指定关卡为 PLAYING 状态
function makeGame(levelIdx=0){
  const g = new sandbox.Game();
  g.startLevel(levelIdx);
  g.state='PLAYING';
  return g;
}

// T1: 自动开火——Player 无输入也能射出子弹
test('Player 自动开火（不依赖开火键）', ()=>{
  const g = makeGame();
  g.player.fireTimer = 0; // 立刻触发
  const beforeBullets = g.bullets.length;
  g.player.update(0.05);
  const ok = g.player.laserActive || g.bullets.length > beforeBullets;
  if(!ok) throw new Error('Player 未自动开火');
});

// T2: Wingman 自动开火
test('Wingman 自动开火（不依赖开火键）', ()=>{
  const g = makeGame();
  g.player.abilities.add('wingman');
  g.player.wingmen = [ new sandbox.Wingman(g.player, -1) ];
  g.player.wingmen.forEach(w=>{ w.fireTimer=0; });
  const beforeBullets = g.bullets.length;
  g.player.wingmen[0].update(0.05);
  if(g.bullets.length <= beforeBullets) throw new Error('Wingman 未自动开火');
});

// T3: 第六关存在 + obstacleOnlyFrom 配置
test('第六关存在且 obstacleOnlyFrom=2800', ()=>{
  if(!sandbox.LEVELS || sandbox.LEVELS.length<6) throw new Error('LEVELS 少于 6 关');
  const L6 = sandbox.LEVELS[5];
  if(L6.name !== '第六关 · 逃脱要塞') throw new Error('第六关名称错误: '+L6.name);
  if(L6.theme !== 'escape') throw new Error('第六关主题错误');
  if(L6.bossType !== 6) throw new Error('第六关 bossType 应为 6');
  if(L6.obstacleOnlyFrom !== 2800) throw new Error('第六关 obstacleOnlyFrom 应为 2800, 实际 '+L6.obstacleOnlyFrom);
});

// T4: 每关 enemyHp 检查 (1,3,5,5,5,5)
test('每关 enemyHp 配置正确', ()=>{
  const expected = [1,3,5,5,5,5];
  sandbox.LEVELS.forEach((L,i)=>{
    if(L.enemyHp !== expected[i]) throw new Error(`第${i+1}关 enemyHp 应为 ${expected[i]}, 实际 ${L.enemyHp}`);
  });
});

// T5: 敌人 HP 系统：base × hpClass
test('敌人 HP 系统：base × hpClass', ()=>{
  const g = makeGame(2); // 第三关 enemyHp=5
  const e1 = new sandbox.Enemy('asteroid_s', 100, 100, g);
  const e2 = new sandbox.Enemy('asteroid_m', 100, 100, g);
  const e3 = new sandbox.Enemy('asteroid_l', 100, 100, g);
  const classes = [e1.hpClass, e2.hpClass, e3.hpClass].filter(c=>c);
  if(classes.length<2) throw new Error('敌人 hpClass 区分不明显');
  [e1,e2,e3].forEach(e=>{
    if(e.maxHp !== g.level.enemyHp * (e.hpClass||1)) throw new Error(`敌人 maxHp=${e.maxHp} != enemyHp×hpClass=${g.level.enemyHp*(e.hpClass||1)}`);
  });
});

// T6: 子弹伤害=1（主炮与导弹）
test('主炮与导弹子弹伤害=1', ()=>{
  const g = makeGame();
  g.player.shoot();
  const bullet = g.bullets.find(b=>b.friendly && !b.missile);
  if(!bullet) throw new Error('主炮子弹未生成');
  if(bullet.dmg !== 1) throw new Error('主炮子弹伤害不为 1, 实际 '+bullet.dmg);
  // 导弹
  g.bullets.length = 0;
  g.player.missileLevel = 1;
  g.player.fireMissiles();
  const mis = g.bullets.find(b=>b.missile);
  if(!mis) throw new Error('导弹未生成');
  if(mis.dmg !== 1) throw new Error('导弹伤害不为 1, 实际 '+mis.dmg);
});

// T7: Boss 6 巨型机器人 HP=1200 尺寸=320x240
test('Boss type 6 巨型机器人 HP=1200', ()=>{
  const g = makeGame(5);
  const b = new sandbox.Boss(g, 6);
  if(b.maxHp !== 1200) throw new Error('Boss6 HP 应为 1200, 实际 '+b.maxHp);
  if(b.w !== 320 || b.h !== 240) throw new Error(`Boss6 尺寸错误: ${b.w}x${b.h}`);
  if(!('continuousLaserTimer' in b)) throw new Error('Boss6 缺少 continuousLaserTimer');
  if(!('continuousLaserActive' in b)) throw new Error('Boss6 缺少 continuousLaserActive');
});

// T8: Boss 6 攻击模式触发弹幕
test('Boss type 6 三阶段攻击都生成弹幕', ()=>{
  const g = makeGame(5);
  const b = new sandbox.Boss(g, 6);
  b.entered = true; // 跳过入场动画
  // phase 1
  b.phase = 1; b.fireTimer = 0; b.hp = b.maxHp * 0.7;
  const before1 = g.bullets.length;
  b.update(0.05);
  if(g.bullets.length <= before1) throw new Error('Boss6 phase1 未发射子弹');
  // phase 2
  g.bullets.length = 0;
  b.phase = 2; b.fireTimer = 0; b.hp = b.maxHp * 0.4;
  b.update(0.05);
  if(g.bullets.length === 0) throw new Error('Boss6 phase2 未发射子弹');
  // phase 3
  g.bullets.length = 0;
  b.phase = 3; b.fireTimer = 0; b.hp = b.maxHp * 0.2;
  b.update(0.05);
  if(g.bullets.length === 0) throw new Error('Boss6 phase3 未发射子弹');
});

// T9: Boss 6 连续激光触发 + 伤害玩家
test('Boss6 连续激光触发并对玩家造成伤害', ()=>{
  const g = makeGame(5);
  const b = new sandbox.Boss(g, 6);
  b.entered = true;
  b.continuousLaserTimer = 0; // 立刻触发
  b.continuousLaserActive = false;
  // 把 boss 拉近玩家，确保玩家 X 在激光伤害范围内（p.x > this.x-200）
  b.x = 300;
  g.player.x = 200;
  g.player.y = 300;
  g.player.invincible = 0; // 关闭无敌
  g.player.lives = 5;
  const livesInitial = g.player.lives;
  // 短 tick，触发 active（激活后会在同一 tick 内立刻检测伤害）
  b.update(0.05);
  if(!b.continuousLaserActive) throw new Error('连续激光未激活');
  // 持续 tick 0.5s（玩家会进入无敌，但激光激活那一下的伤害应已生效）
  for(let i=0;i<50;i++) b.update(0.01);
  if(g.player.lives >= livesInitial) throw new Error(`连续激光未造成伤害，lives=${g.player.lives} vs initial=${livesInitial}`);
});

// T10: Boss6 draw 不抛异常
test('Boss6 draw 不抛异常', ()=>{
  const g = makeGame(5);
  const b = new sandbox.Boss(g, 6);
  b.entered = true;
  for(const ph of [1,2,3]){
    b.phase = ph;
    b.continuousLaserActive = true;
    b.continuousLaserY = 300;
    b.t = 1.0;
    try { b.draw(canvas.getContext(), 0); }
    catch(e){ throw new Error(`phase ${ph} draw 异常: ${e.message}`); }
  }
  // 关闭激光后再画一次
  b.continuousLaserActive = false;
  b.draw(canvas.getContext(), 0);
});

// T11: 第六关敌人 debris/ruin_core 存在
test('debris 和 ruin_core 敌人类型存在', ()=>{
  if(!sandbox.WAVE_TEMPLATES[6]) throw new Error('WAVE_TEMPLATES[6] 不存在');
  const g = makeGame(5);
  const d = new sandbox.Enemy('debris', 100, 100, g);
  const db = new sandbox.Enemy('debris_big', 100, 100, g);
  const rc = new sandbox.Enemy('ruin_core', 100, 100, g);
  if(!d.explodeOnDeath) throw new Error('debris 应有 explodeOnDeath=true');
  if(!db.explodeOnDeath) throw new Error('debris_big 应有 explodeOnDeath=true');
  if(!rc) throw new Error('ruin_core 创建失败');
});

// T12: explodeOnDeath 死后散弹
test('debris 死后散弹', ()=>{
  const g = makeGame(5);
  const d = new sandbox.Enemy('debris', 100, 100, g);
  const before = g.bullets.length;
  d.die();
  if(g.bullets.length <= before) throw new Error('debris 死后未散弹');
});

// T13: 第六关后半段纯障碍——spawner 不刷怪
test('第六关后半段（obstacleOnlyFrom 后）spawner 停止刷怪', ()=>{
  const g = makeGame(5);
  g.scrollDistance = g.level.obstacleOnlyFrom + 100; // 进入纯障碍段
  let spawnerCalled = 0;
  g.spawner = { update(dt){ spawnerCalled++; } };
  g.obstacleSpawner = { update(dt){} };
  g.update(0.05);
  if(spawnerCalled !== 0) throw new Error('obstacleOnlyFrom 后 spawner 仍在刷怪');
});

// T14: 速度升级增强（speedLevel=3 比 speedLevel=0 移动得快）
test('Player 速度升级增强', ()=>{
  const g = makeGame();
  // speedLevel=3 跑一遍
  g.player.speedLevel = 3;
  g.player.vx = 0; g.player.vy = 0;
  g.player.x = 200; g.player.y = 300;
  sandbox.Input.keys['arrowright'] = true;
  const x0 = g.player.x;
  for(let i=0;i<30;i++) g.player.update(0.01);
  const dxHigh = g.player.x - x0;
  // 重置 speedLevel=0
  g.player.speedLevel = 0;
  g.player.vx = 0; g.player.x = 200;
  for(let i=0;i<30;i++) g.player.update(0.01);
  const dxLow = g.player.x - 200;
  sandbox.Input.keys['arrowright'] = false;
  if(dxHigh <= dxLow) throw new Error(`速度升级不明显: level3 dx=${dxHigh.toFixed(2)} vs level0 dx=${dxLow.toFixed(2)}`);
});

// T15: Player 流线型外观绘制不抛异常
test('Player 新流线型外观绘制不抛异常', ()=>{
  const g = makeGame();
  g.player.t = 1.0;
  g.player.draw(canvas.getContext(), 0);
  g.player.speedLevel = 3;
  g.player.draw(canvas.getContext(), 0);
});

// T16: ObstacleSpawner escape 类型间隔更密
test('ObstacleSpawner escape 间隔更密', ()=>{
  const g = makeGame(5);
  const sp = new sandbox.ObstacleSpawner(g, 'escape');
  if(sp.interval !== 380) throw new Error('escape 障碍物间隔应为 380, 实际 '+sp.interval);
});

// T17: CFG 配置项存在
test('CFG 关键配置项存在', ()=>{
  if(!sandbox.CFG || !sandbox.CFG.playerSpeedMax) throw new Error('CFG.playerSpeedMax 不存在');
  if(!sandbox.CFG.bulletSpeed) throw new Error('CFG.bulletSpeed 不存在');
});

// T18: Boss6 phase 切换正确（通过 hp 触发 update 自动切换 phase）
test('Boss6 阶段切换：>50% P1, 25-50% P2, <25% P3', ()=>{
  const g = makeGame(5);
  const b = new sandbox.Boss(g, 6);
  b.entered = true;
  b.hp = b.maxHp * 0.6;
  b.update(0.01);
  if(b.phase !== 1) throw new Error('hp>50% 应为 phase 1, 实际 '+b.phase);
  b.hp = b.maxHp * 0.4;
  b.update(0.01);
  if(b.phase !== 2) throw new Error('hp 25-50% 应为 phase 2, 实际 '+b.phase);
  b.hp = b.maxHp * 0.2;
  b.update(0.01);
  if(b.phase !== 3) throw new Error('hp<25% 应为 phase 3, 实际 '+b.phase);
});

// 跑测试
let passed = 0, failed = 0;
for(const t of tests){
  try{
    t.fn();
    console.log('  PASS  '+t.name);
    passed++;
  }catch(e){
    console.log('  FAIL  '+t.name+'\n        -> '+e.message);
    failed++;
  }
}
console.log(`\n  结果: ${passed} 通过, ${failed} 失败 (共 ${tests.length} 项)`);
process.exit(failed===0 ? 0 : 1);
