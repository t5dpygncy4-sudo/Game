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
  createOscillator(){ return {type:'',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}}; }
  createGain(){ return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}; }
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
  Obstacle, ObstacleSpawner, Starfield, WAVE_TEMPLATES, UPGRADES,
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

// T1: 手动开火——不按空格不开火；按空格才开火
test('Player 手动开火（不按空格不开，按住才开）', ()=>{
  const g = makeGame();
  g.player.fireTimer = 0;
  const beforeBullets = g.bullets.length;
  // 不按开火键：不应射出
  sandbox.Input.keys[' '] = false;
  g.player.update(0.05);
  if(g.bullets.length > beforeBullets) throw new Error('Player 未按空格也开火了');
  // 按空格：应射出
  sandbox.Input.keys[' '] = true;
  g.player.fireTimer = 0;
  g.player.update(0.05);
  sandbox.Input.keys[' '] = false;
  if(g.bullets.length <= beforeBullets) throw new Error('Player 按住空格未开火');
});

// T2: Wingman 手动开火（与主炮同步）
test('Wingman 手动开火（按空格才发射）', ()=>{
  const g = makeGame();
  g.player.abilities.add('wingman');
  g.player.wingmen = [ new sandbox.Wingman(g.player, -1) ];
  g.player.wingmen.forEach(w=>{ w.fireTimer=0; });
  const beforeBullets = g.bullets.length;
  // 不按开火键：不应射出
  sandbox.Input.keys[' '] = false;
  g.player.wingmen[0].update(0.05);
  if(g.bullets.length > beforeBullets) throw new Error('Wingman 未按空格也开火了');
  // 按空格：应射出
  sandbox.Input.keys[' '] = true;
  g.player.wingmen[0].fireTimer = 0;
  g.player.wingmen[0].update(0.05);
  sandbox.Input.keys[' '] = false;
  if(g.bullets.length <= beforeBullets) throw new Error('Wingman 按住空格未开火');
});

// T3: 第六关存在 + obstacleOnlyFrom 配置 + 加长后长度
test('第六关存在且加长 length=9200, obstacleOnlyFrom=4600', ()=>{
  if(!sandbox.LEVELS || sandbox.LEVELS.length<6) throw new Error('LEVELS 少于 6 关');
  const L6 = sandbox.LEVELS[5];
  if(L6.name !== '第六关 · 逃脱要塞') throw new Error('第六关名称错误: '+L6.name);
  if(L6.theme !== 'escape') throw new Error('第六关主题错误');
  if(L6.bossType !== 6) throw new Error('第六关 bossType 应为 6');
  if(L6.length !== 9200) throw new Error('第六关 length 应为 9200, 实际 '+L6.length);
  if(L6.obstacleOnlyFrom !== 4600) throw new Error('第六关 obstacleOnlyFrom 应为 4600, 实际 '+L6.obstacleOnlyFrom);
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
  g.player.shoot();   // 直接调用 shoot 验证子弹伤害
  const bullet = g.bullets.find(b=>b.friendly && !b.missile);
  if(!bullet) throw new Error('主炮子弹未生成');
  if(bullet.dmg !== 1) throw new Error('主炮子弹伤害不为 1, 实际 '+bullet.dmg);
  // 导弹
  g.bullets.length = 0;
  g.player.missileLevel = 1;
  g.player.abilities.add('missile');
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

// T16c: 第四关主题改回 fire（火海）
test('第四关主题为 fire（火海）', ()=>{
  const L4 = sandbox.LEVELS[3];
  if(L4.theme !== 'fire') throw new Error('第四关主题应为 fire, 实际 '+L4.theme);
  if(L4.name !== '第四关 · 火海') throw new Error('第四关名称错误: '+L4.name);
});

// T16d: Starfield fire 主题能正常构建/更新/绘制
test('Starfield fire 主题（火焰云团 + 火星 + 余烬）', ()=>{
  const sf = new sandbox.Starfield('fire');
  if(!sf.themeObj.clouds || sf.themeObj.clouds.length===0) throw new Error('fire 主题缺少火焰云团');
  if(!sf.themeObj.sparks || sf.themeObj.sparks.length===0) throw new Error('fire 主题缺少火星粒子');
  if(!sf.themeObj.embers || sf.themeObj.embers.length===0) throw new Error('fire 主题缺少余烬');
  // 更新与绘制不抛异常
  sf.update(0.05, 125);
  sf.draw(canvas.getContext());
  // 长时间更新后仍正常
  for(let i=0;i<60;i++) sf.update(0.05, 125);
  sf.draw(canvas.getContext());
});

// T17: 敌方子弹默认寿命足够长（14s），避免屏内弹道中途消失
test('敌方子弹默认寿命 14 秒', ()=>{
  const b = new sandbox.Bullet(100,100,-100,0,{friendly:false});
  if(b.life < 14) throw new Error('敌方子弹寿命应≥14s, 实际 '+b.life);
  const f = new sandbox.Bullet(100,100,100,0,{friendly:true});
  if(f.life !== 3) throw new Error('友方子弹寿命应为3s, 实际 '+f.life);
});

// T18: addBullet 容量上限触发时优先移除离屏子弹，保留屏内 Boss 弹幕
test('addBullet 容量上限时优先移除离屏子弹', ()=>{
  const g = sandbox.makeGame ? sandbox.makeGame() : null;
  if(!g){
    // 退而其次：直接 new Game
    const game = new sandbox.Game();
    game.camX = 0; // 屏内范围 [0, W]
    // 先填满（不超容）
    for(let i=0;i<sandbox.CFG.maxBullets;i++){
      game.addBullet(new sandbox.Bullet(400, 240, 0, 0, {friendly:false}));  // 屏内子弹
    }
    const beforeCount = game.bullets.length;
    // 添加 1 个屏外子弹 + 1 个屏内子弹，触发上限
    game.addBullet(new sandbox.Bullet(-5000, 240, 0, 0, {friendly:false}));   // 屏外
    // 添加屏内子弹触发上限，应优先移除上面的屏外子弹
    game.addBullet(new sandbox.Bullet(400, 240, 0, 0, {friendly:false}));    // 屏内
    // 屏外子弹应已被移除（找不到 x=-5000 的子弹）
    const stillHasOffscreen = game.bullets.some(b => b.x === -5000);
    if(stillHasOffscreen) throw new Error('容量上限时应优先移除离屏子弹，但屏外子弹仍存在');
  }
});

// T19: CFG.maxBullets 已提升到 800（足以容纳 boss3 螺旋弹幕 50发/秒 × 6秒）
test('maxBullets 上限为 800', ()=>{
  if(sandbox.CFG.maxBullets < 800) throw new Error('maxBullets 应≥800, 实际 '+sandbox.CFG.maxBullets);
});

// T20: 第六关后半段障碍物密度降低（间隔 ≈ 1100，约为之前的 1/5）
test('第六关后半段障碍物密度降低', ()=>{
  const g = makeGame(5);
  g.scrollDistance = g.level.obstacleOnlyFrom + 100;
  const beforeObs = g.obstacles.length;
  // 推进 3000 像素
  const dt = 0.5;
  const dist = 3000;
  const ticks = Math.ceil(dist / (g.level.scrollSpeed * dt));
  for(let i=0;i<ticks;i++){
    g.camX += g.level.scrollSpeed * dt;
    g.scrollDistance += g.level.scrollSpeed * dt;
    g.obstacleSpawner.update(dt);
  }
  const added = g.obstacles.length - beforeObs;
  // 3000 像素 / 1100 间隔 ≈ 3 丛，每丛 2-6 个 → 6-18 个障碍物
  // 关键校验：密度应明显低于改前（改前 220 间隔时会生成 ≈ 13 丛 × 6 = 78 个）
  if(added > 25) throw new Error(`障碍物仍然太密: ${added} 个（间隔应为 ≈1100）`);
  if(added < 2) throw new Error(`障碍物生成失败: 仅 ${added} 个`);
});

// T21: Boss 死亡后进入 LEVEL_CLEAR 状态，3 秒后才进入 LEVEL_OUT
test('Boss 死亡后等待 3 秒拾取掉落物', ()=>{
  const W = sandbox.W, H = sandbox.H;
  const g = makeGame(0);   // 第一关，无 levelIndex 越界
  // 触发 boss
  g.scrollDistance = g.level.length + 100;
  g.bossTriggered = true;
  // 给一个 boss 实例
  g.boss = new sandbox.Boss(g, 1);
  g.boss.x = g.camX + W - 200;   // 把 boss 拉近屏内以便更新激活攻击
  // 让 boss 立即死亡
  g.boss.takeDamage(g.boss.hp);   // 触发 die() 设置 dead=true
  // 更新一帧，game.update 检测到 boss.dead 后应进入 LEVEL_CLEAR
  g.update(0.01);
  if(g.state !== 'LEVEL_CLEAR') throw new Error(`Boss 死亡后应进入 LEVEL_CLEAR, 实际 ${g.state}`);
  // 推进 2 秒，仍应为 LEVEL_CLEAR
  for(let i=0;i<200;i++) g.update(0.01);
  if(g.state !== 'LEVEL_CLEAR') throw new Error(`2 秒后应仍为 LEVEL_CLEAR, 实际 ${g.state}`);
  // 推进到 3 秒以上，应切换到 LEVEL_OUT
  for(let i=0;i<110;i++) g.update(0.01);
  if(g.state !== 'LEVEL_OUT') throw new Error(`3 秒后应切换到 LEVEL_OUT, 实际 ${g.state}`);
});

// T22: 飞机速度升级上限改为 5 级
test('飞机速度升级上限为 5 级', ()=>{
  if(sandbox.UPGRADES[0].id !== 'speed') throw new Error('UPGRADES[0] 应为 speed');
  const g = makeGame(0);
  g.player.crystals = 100;
  // 升 5 次
  for(let i=0;i<5;i++) g.player.tryUpgrade(1);
  if(g.player.speedLevel !== 5) throw new Error('5 次加速后 speedLevel 应为 5, 实际 '+g.player.speedLevel);
  // 第 6 次应失败
  const before = g.player.speedLevel;
  g.player.tryUpgrade(1);
  if(g.player.speedLevel !== 5) throw new Error('满级后不应继续升级');
});

// T23: 僚机上限改为 4 级，且位置布局上下对称
test('僚机上限为 4 级且布局上下对称', ()=>{
  const g = makeGame(0);
  g.player.crystals = 100;
  for(let i=0;i<4;i++) g.player.tryUpgrade(5);
  if(g.player.wingmen.length !== 4) throw new Error('4 次购买后应有 4 个僚机, 实际 '+g.player.wingmen.length);
  // 第 5 次应失败
  g.player.tryUpgrade(5);
  if(g.player.wingmen.length !== 4) throw new Error('满级后不应继续增加僚机');
  // 推进一帧让僚机定位
  for(let i=0;i<30;i++) g.player.wingmen.forEach(w=>w.update(0.05));
  const offsets = g.player.wingmen.map(w => w.y - g.player.y);
  // 应有 2 个负偏移（上）和 2 个正偏移（下）
  const upCount = offsets.filter(o => o < -5).length;
  const dnCount = offsets.filter(o => o > 5).length;
  if(upCount !== 2 || dnCount !== 2) throw new Error(`僚机布局应上下各 2 个, 实际 上${upCount} 下${dnCount}, 偏移=${offsets}`);
});

// T24: 护盾 3 次抵挡 + 存在时按 6 可补满
test('护盾 3 次抵挡 + 可补满', ()=>{
  const g = makeGame(0);
  g.player.crystals = 100;
  // 第一次购买护盾
  g.player.tryUpgrade(6);
  if(g.player.shieldHits !== 3) throw new Error('护盾激活后应为 3 次, 实际 '+g.player.shieldHits);
  // 抵挡 1 次后剩 2
  g.player.hurt(1);
  if(g.player.shieldHits !== 2) throw new Error('抵挡 1 次后应剩 2, 实际 '+g.player.shieldHits);
  // 再按 6 补满
  g.player.tryUpgrade(6);
  if(g.player.shieldHits !== 3) throw new Error('补满后应回 3 次, 实际 '+g.player.shieldHits);
});

// T25: 追踪导弹基础速度 600（原 420）+ 失去目标后立即重选
test('追踪导弹速度提升 + 失去目标重选', ()=>{
  if(sandbox.CFG.missileSpeed !== 600) throw new Error('missileSpeed 应为 600, 实际 '+sandbox.CFG.missileSpeed);
  const g = makeGame(2);   // 第三关有敌人
  // 创建一个敌人作为初始目标
  const e1 = new sandbox.Enemy('fighter', g.camX + 300, 100, g);
  e1.dead = false; g.enemies.push(e1);
  // 发射导弹
  g.player.missileLevel = 1;
  g.player.crystals = 100;
  g.player.tryUpgrade(2);  // 解锁追踪弹
  g.player.fireMissiles();
  const missile = g.bullets.find(b => b.missile);
  if(!missile) throw new Error('应有导弹生成');
  if(!missile.target) throw new Error('导弹初始应有目标');
  // 让原目标死亡
  const oldTarget = missile.target;
  oldTarget.dead = true;
  // 创建新敌人
  const e2 = new sandbox.Enemy('fighter', g.camX + 500, 300, g);
  e2.dead = false; g.enemies.push(e2);
  // 更新一帧：导弹应立即重选新目标
  missile.update(0.05, g);
  if(!missile.target || missile.target === oldTarget) throw new Error('导弹应立即重选最近敌人');
  if(missile.target !== e2) throw new Error('导弹新目标应为新敌人 e2');
});

// T16b: 第六关后半段纯障碍——障碍物成丛生成（每丛 2-3 个）
test('第六关后半段障碍物成丛生成（密度更高）', ()=>{
  const g = makeGame(5);
  g.scrollDistance = g.level.obstacleOnlyFrom + 200; // 进入纯障碍段
  const beforeObs = g.obstacles.length;
  // 推进 2400 像素（覆盖约 2 丛，间隔 ≈1100）
  const dt = 0.5;
  const ticks = Math.ceil(2400 / (g.level.scrollSpeed * dt));
  for(let i=0;i<ticks;i++){
    g.camX += g.level.scrollSpeed * dt;
    g.scrollDistance += g.level.scrollSpeed * dt;
    g.obstacleSpawner.update(dt);
  }
  const added = g.obstacles.length - beforeObs;
  // 2400 像素 / 1100 间隔 ≈ 2 丛，每丛 2-3 个 → 4-6 个障碍物
  if(added < 2) throw new Error(`后半段障碍物生成不足: 仅 ${added} 个`);
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
