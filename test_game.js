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
  get sampleRate(){ return 44100; }
  createOscillator(){ return {type:'',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){return this;},start(){},stop(){}}; }
  createGain(){ return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){return this;}}; }
  createBuffer(){ return {getChannelData(){ return new Float32Array(1024); }}; }
  createBufferSource(){ return {buffer:null,connect(){return this;},start(){},stop(){}}; }
  createBiquadFilter(){ return {type:'',frequency:{value:0},connect(){return this;}}; }
  get destination(){ return {}; }
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
  Game, LEVELS, CFG, COLORS, DIFFICULTY, DIFFICULTY_ORDER, Input, Audio2,
  Player, Wingman, Bullet, Enemy, Boss,
  Obstacle, ObstacleSpawner, Starfield, WAVE_TEMPLATES, UPGRADES,
  Crystal, LifeDrop, BombCrystal,
  W, H,
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
test('Boss 死亡后等待 4.5 秒拾取掉落物', ()=>{
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
  // 推进 3 秒，仍应为 LEVEL_CLEAR
  for(let i=0;i<300;i++) g.update(0.01);
  if(g.state !== 'LEVEL_CLEAR') throw new Error(`3 秒后应仍为 LEVEL_CLEAR, 实际 ${g.state}`);
  // 推进到 4.5 秒以上，应切换到 LEVEL_OUT
  for(let i=0;i<160;i++) g.update(0.01);
  if(g.state !== 'LEVEL_OUT') throw new Error(`4.5 秒后应切换到 LEVEL_OUT, 实际 ${g.state}`);
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

// T26: 道具磁吸——玩家靠近时晶体被吸过来（仅接触时吸附）
test('Crystal 磁吸：玩家靠近时被吸引', ()=>{
  const g = makeGame(0);
  // 在玩家右侧 40 像素放置晶体（在磁吸范围 55 内）
  const c = new sandbox.Crystal(g.player.x + 40, g.player.y);
  g.crystals.push(c);
  const x0 = c.x, y0 = c.y;
  // 推进 30 帧（约 0.5s）
  for(let i=0;i<30;i++) c.update(0.016, g.player);
  // 晶体应向玩家方向移动（x 应减小）
  if(c.x >= x0) throw new Error(`晶体应被吸过来（x 减小），实际 x0=${x0}, x=${c.x}`);
  // 距离应明显减小
  const dist0 = Math.hypot(x0-g.player.x, y0-g.player.y);
  const dist1 = Math.hypot(c.x-g.player.x, c.y-g.player.y);
  if(dist1 >= dist0) throw new Error(`距离应减小, dist0=${dist0.toFixed(1)} dist1=${dist1.toFixed(1)}`);
});

// T27: 道具磁吸——玩家远离时晶体维持基础左飘
test('Crystal 远离时不被吸引', ()=>{
  const g = makeGame(0);
  // 在玩家右侧 200 像素放置晶体（远超磁吸范围 55）
  const c = new sandbox.Crystal(g.player.x + 200, g.player.y);
  g.crystals.push(c);
  const x0 = c.x;
  // 推进 30 帧
  for(let i=0;i<30;i++) c.update(0.016, g.player);
  // 不应被吸过来（x 应保持基础左飘，不会反向加速向玩家）
  if(c.x > x0) throw new Error(`远离时晶体不应被吸过来, x0=${x0}, x=${c.x}`);
});

// T28: 生命道具磁吸
test('LifeDrop 磁吸：玩家靠近时被吸引', ()=>{
  const g = makeGame(0);
  const l = new sandbox.LifeDrop(g.player.x + 40, g.player.y);
  g.lifeDrops.push(l);
  const x0 = l.x;
  // LifeDrop 磁吸范围 60
  for(let i=0;i<30;i++) l.update(0.016, g.player);
  // 应被吸引（x 应明显减小）
  if(l.x >= x0) throw new Error(`LifeDrop 应被吸过来, x0=${x0}, x=${l.x}`);
});

// T29: 玩家侧视飞机绘制不抛异常（基础+加速+护盾激活）
test('Player 侧视飞机绘制不抛异常', ()=>{
  const g = makeGame();
  const ctx = canvas.getContext();
  g.player.t = 1.0;
  g.player.draw(ctx, 0);
  g.player.speedLevel = 5;
  g.player.draw(ctx, 0);
  g.player.shieldHits = 3;
  g.player.draw(ctx, 0);
});

// T30: 僚机侧视绘制不抛异常
test('Wingman 侧视绘制不抛异常', ()=>{
  const g = makeGame();
  g.player.abilities.add('wingman');
  g.player.wingmen = [ new sandbox.Wingman(g.player, 0) ];
  g.player.wingmen.forEach(w=>{ w.t = 1.0; w.draw(canvas.getContext(), 0); });
});

// T31: LifeDrop 改为红色六角晶体（不再心形）
test('LifeDrop 改为红色晶体（不抛异常）', ()=>{
  const l = new sandbox.LifeDrop(100, 100);
  if(l.w !== 22) throw new Error('LifeDrop 尺寸应为 22, 实际 '+l.w);
  l.t = 1.0;
  l.draw(canvas.getContext(), 0);
});

// T32: BombCrystal 拾取后增加库存（不立即触发）
test('BombCrystal 拾取后增加库存（最多 2）', ()=>{
  const g = makeGame(0);
  if(g.player.bombs !== 0) throw new Error('初始 bombs 应为 0, 实际 '+g.player.bombs);
  // 第一次拾取：库存 +1，不应清屏
  const b1 = new sandbox.BombCrystal(g.player.x+50, g.player.y);
  b1.apply(g.player);
  if(g.player.bombs !== 1) throw new Error('第一次拾取后 bombs 应为 1, 实际 '+g.player.bombs);
  // 第二次拾取：库存 +1 = 2，仍不触发
  const b2 = new sandbox.BombCrystal(g.player.x+50, g.player.y);
  b2.apply(g.player);
  if(g.player.bombs !== 2) throw new Error('第二次拾取后 bombs 应为 2, 实际 '+g.player.bombs);
});

// T32b: 库存满 2 时再拾取立即触发清屏
test('库存满 2 时再拾取立即清屏', ()=>{
  const g = makeGame(0);
  // 准备敌人 + 子弹
  g.enemies.push(new sandbox.Enemy('asteroid_s', g.camX + 100, 100, g));
  g.enemies.push(new sandbox.Enemy('asteroid_s', g.camX + 200, 200, g));
  g.bullets.push(new sandbox.Bullet(g.camX+100,100,-200,0,{w:8,h:8,color:'#f80',friendly:false}));
  g.bullets.push(new sandbox.Bullet(g.camX+150,150,-200,0,{w:8,h:8,color:'#f80',friendly:false}));
  g.bullets.push(new sandbox.Bullet(g.camX+100,100, 200,0,{w:8,h:8,color:'#0ff',friendly:true}));
  // 满库存
  g.player.bombs = 2;
  // 再拾取：应立即清屏，库存仍为 2
  const b = new sandbox.BombCrystal(g.player.x, g.player.y);
  b.apply(g.player);
  if(g.player.bombs !== 2) throw new Error('满库存再拾取后应保持 2, 实际 '+g.player.bombs);
  // 敌人应全部死亡
  const alive = g.enemies.filter(e=>!e.dead);
  if(alive.length !== 0) throw new Error('应清除所有敌人, 剩余 '+alive.length);
  // 敌方子弹应被清空
  const enemyBullets = g.bullets.filter(b=>!b.friendly);
  if(enemyBullets.length !== 0) throw new Error('应清空敌方子弹, 剩余 '+enemyBullets.length);
  // 友方子弹应保留
  const friendlyBullets = g.bullets.filter(b=>b.friendly);
  if(friendlyBullets.length !== 1) throw new Error('友方子弹应保留 1 发, 实际 '+friendlyBullets.length);
});

// T32c: Shift 触发清屏，消耗 1 库存
test('Shift 触发清屏消耗 1 库存', ()=>{
  const g = makeGame(0);
  g.enemies.push(new sandbox.Enemy('asteroid_s', g.camX + 100, 100, g));
  g.bullets.push(new sandbox.Bullet(g.camX+100,100,-200,0,{w:8,h:8,color:'#f80',friendly:false}));
  g.player.bombs = 2;
  // 模拟 Shift 按下
  sandbox.Input.pressed['shift'] = true;
  g.player.update(0.016);
  sandbox.Input.pressed['shift'] = false;
  if(g.player.bombs !== 1) throw new Error('Shift 后 bombs 应减 1 = 1, 实际 '+g.player.bombs);
  // 敌人应死亡
  const alive = g.enemies.filter(e=>!e.dead);
  if(alive.length !== 0) throw new Error('Shift 触发应清除所有敌人, 剩余 '+alive.length);
});

// T32d: 无库存时按 Shift 不触发
test('无库存时按 Shift 不触发', ()=>{
  const g = makeGame(0);
  g.enemies.push(new sandbox.Enemy('asteroid_s', g.camX + 100, 100, g));
  g.player.bombs = 0;
  sandbox.Input.pressed['shift'] = true;
  g.player.update(0.016);
  sandbox.Input.pressed['shift'] = false;
  const alive = g.enemies.filter(e=>!e.dead);
  if(alive.length !== 1) throw new Error('无库存不应清屏, 剩余敌人 '+alive.length);
});

// T33: BombCrystal 不伤害 Boss
test('BombCrystal 不伤害 Boss', ()=>{
  const g = makeGame(5); // 第六关有 Boss
  const boss = new sandbox.Boss(g, 6);
  boss.entered = true;
  g.boss = boss;
  const hpBefore = boss.hp;
  // 通过 triggerScreenClear 验证
  g.triggerScreenClear();
  if(boss.hp !== hpBefore) throw new Error('BombCrystal 不应伤害 Boss, hp 前='+hpBefore+' 后='+boss.hp);
});

// T34: BombCrystal 磁吸
test('BombCrystal 磁吸：玩家靠近时被吸引', ()=>{
  const g = makeGame(0);
  const b = new sandbox.BombCrystal(g.player.x + 40, g.player.y);
  g.bombCrystals.push(b);
  const x0 = b.x;
  for(let i=0;i<30;i++) b.update(0.016, g.player);
  if(b.x >= x0) throw new Error(`BombCrystal 应被吸过来, x0=${x0}, x=${b.x}`);
});

// T35: BombCrystal 绘制不抛异常
test('BombCrystal 绘制不抛异常', ()=>{
  const b = new sandbox.BombCrystal(100, 100);
  b.t = 1.0;
  b.draw(canvas.getContext(), 0);
});

// T36: 玩家飞机新外形绘制不抛异常（基础+加速5级+护盾激活）
test('Player 新秀气外形绘制不抛异常', ()=>{
  const g = makeGame();
  const ctx = canvas.getContext();
  g.player.t = 1.0;
  g.player.draw(ctx, 0);
  g.player.speedLevel = 5;
  g.player.draw(ctx, 0);
  g.player.shieldHits = 3;
  g.player.draw(ctx, 0);
});

// T37: Audio2 新增丰富音效方法（不抛异常）
test('Audio2 新增丰富音效方法', ()=>{
  sandbox.Audio2.init();
  // 应包含所有新方法
  const methods = ['shoot','laser','missile','hit','explode','bigExplode','pickup','levelup','alarm','hurt','bossWarn','bossDead','levelStart','screenClear','shield','playerDead','win','chord','noise'];
  for(const m of methods){
    if(typeof sandbox.Audio2[m] !== 'function') throw new Error('缺少方法: '+m);
  }
  // 调用所有方法不应抛异常
  sandbox.Audio2.shoot();
  sandbox.Audio2.laser();
  sandbox.Audio2.missile();
  sandbox.Audio2.hit();
  sandbox.Audio2.explode();
  sandbox.Audio2.bigExplode();
  sandbox.Audio2.pickup();
  sandbox.Audio2.levelup();
  sandbox.Audio2.alarm();
  sandbox.Audio2.hurt();
  sandbox.Audio2.bossWarn();
  sandbox.Audio2.bossDead();
  sandbox.Audio2.levelStart();
  sandbox.Audio2.screenClear();
  sandbox.Audio2.shield();
  sandbox.Audio2.playerDead();
  sandbox.Audio2.win();
});

// T38: 僚机新外形绘制不抛异常
test('Wingman 新流线型外形绘制不抛异常', ()=>{
  const g = makeGame();
  g.player.abilities.add('wingman');
  g.player.wingmen = [ new sandbox.Wingman(g.player, 0) ];
  g.player.wingmen.forEach(w=>{ w.t = 1.0; w.draw(canvas.getContext(), 0); });
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

// T19: 难度系统配置存在且系数正确
test('DIFFICULTY 配置存在且系数正确', ()=>{
  if(!sandbox.DIFFICULTY) throw new Error('DIFFICULTY 配置不存在');
  const d = sandbox.DIFFICULTY;
  if(d.easy.fireMul !== 1.3) throw new Error('easy fireMul 应为 1.3, 实际 '+d.easy.fireMul);
  if(d.normal.fireMul !== 1.0) throw new Error('normal fireMul 应为 1.0, 实际 '+d.normal.fireMul);
  if(d.hard.fireMul !== 0.7) throw new Error('hard fireMul 应为 0.7, 实际 '+d.hard.fireMul);
  if(d.easy.hpMul !== 1.0) throw new Error('easy hpMul 应为 1.0, 实际 '+d.easy.hpMul);
  if(d.normal.hpMul !== 1.0) throw new Error('normal hpMul 应为 1.0, 实际 '+d.normal.hpMul);
  if(d.hard.hpMul !== 1.5) throw new Error('hard hpMul 应为 1.5, 实际 '+d.hard.hpMul);
  if(!sandbox.DIFFICULTY_ORDER || sandbox.DIFFICULTY_ORDER.length !== 3) throw new Error('DIFFICULTY_ORDER 应为 3 项');
  if(sandbox.DIFFICULTY_ORDER[0] !== 'easy' || sandbox.DIFFICULTY_ORDER[1] !== 'normal' || sandbox.DIFFICULTY_ORDER[2] !== 'hard')
    throw new Error('DIFFICULTY_ORDER 顺序错误: '+sandbox.DIFFICULTY_ORDER);
});

// T20: Game 默认难度为 normal + fireScale 计算
test('Game 默认难度为 normal，fireScale 计算正确', ()=>{
  const g = new sandbox.Game();
  if(g.difficulty !== 'normal') throw new Error('默认难度应为 normal, 实际 '+g.difficulty);
  // normal: fireMul=1.0, fireScale=1.0
  if(Math.abs(g.fireScale() - 1.0) > 0.0001) throw new Error('normal fireScale 应为 1.0, 实际 '+g.fireScale());
  // easy: fireMul=1.3, fireScale=1/1.3
  g.difficulty = 'easy';
  if(Math.abs(g.fireScale() - 1/1.3) > 0.0001) throw new Error('easy fireScale 应为 '+(1/1.3)+', 实际 '+g.fireScale());
  // hard: fireMul=0.7, fireScale=1/0.7
  g.difficulty = 'hard';
  if(Math.abs(g.fireScale() - 1/0.7) > 0.0001) throw new Error('hard fireScale 应为 '+(1/0.7)+', 实际 '+g.fireScale());
});

// T21: A/D 键在 TITLE 状态循环切换难度
test('A/D 键在 TITLE 状态循环切换难度', ()=>{
  const g = new sandbox.Game();
  g.state = 'TITLE';
  sandbox.Input.pressed = {};
  if(g.difficulty !== 'normal') throw new Error('初始难度应为 normal');
  // 按 D：normal -> hard
  sandbox.Input.pressed['d'] = true;
  g.update(0.01);
  sandbox.Input.pressed = {};
  if(g.difficulty !== 'hard') throw new Error('按 D 后应为 hard, 实际 '+g.difficulty);
  // 再按 D：hard -> easy（循环到下一个）
  sandbox.Input.pressed['d'] = true;
  g.update(0.01);
  sandbox.Input.pressed = {};
  if(g.difficulty !== 'easy') throw new Error('再按 D 应循环到 easy, 实际 '+g.difficulty);
  // 再按 D：easy -> normal
  sandbox.Input.pressed['d'] = true;
  g.update(0.01);
  sandbox.Input.pressed = {};
  if(g.difficulty !== 'normal') throw new Error('再按 D 应循环到 normal, 实际 '+g.difficulty);
  // 按 A：normal -> easy（反向）
  sandbox.Input.pressed['a'] = true;
  g.update(0.01);
  sandbox.Input.pressed = {};
  if(g.difficulty !== 'easy') throw new Error('按 A 从 normal 应到 easy, 实际 '+g.difficulty);
  // 再按 A：easy -> hard（循环）
  sandbox.Input.pressed['a'] = true;
  g.update(0.01);
  sandbox.Input.pressed = {};
  if(g.difficulty !== 'hard') throw new Error('按 A 从 easy 应到 hard, 实际 '+g.difficulty);
});

// T22: 敌人 HP 困难模式 +50%
test('敌人 HP 困难模式 +50%（HP=base*hpClass*hpMul）', ()=>{
  const g = makeGame(2); // 第三关 enemyHp=5
  // normal 难度：asteroid_l hpClass=3 → 5*3=15
  g.difficulty = 'normal';
  const eN = new sandbox.Enemy('asteroid_l', 100, 100, g);
  if(eN.maxHp !== 15) throw new Error('normal asteroid_l maxHp 应为 15, 实际 '+eN.maxHp);
  // hard 难度：5*3*1.5=22.5 → round=23
  g.difficulty = 'hard';
  const eH = new sandbox.Enemy('asteroid_l', 100, 100, g);
  if(eH.maxHp !== 23) throw new Error('hard asteroid_l maxHp 应为 23 (round(22.5)), 实际 '+eH.maxHp);
  // easy 难度：与 normal 相同
  g.difficulty = 'easy';
  const eE = new sandbox.Enemy('asteroid_l', 100, 100, g);
  if(eE.maxHp !== 15) throw new Error('easy asteroid_l maxHp 应为 15, 实际 '+eE.maxHp);
  // 小敌人 hpClass=1: 5*1*1.5=7.5 → round=8
  g.difficulty = 'hard';
  const eSmall = new sandbox.Enemy('asteroid_s', 100, 100, g);
  if(eSmall.maxHp !== 8) throw new Error('hard asteroid_s maxHp 应为 8 (round(7.5)), 实际 '+eSmall.maxHp);
});

// T23: Boss HP 困难模式 +50%
test('Boss HP 困难模式 +50%（HP=hpMap*hpMul）', ()=>{
  const g = makeGame(5);
  // normal: Boss6 = 1200
  g.difficulty = 'normal';
  const bN = new sandbox.Boss(g, 6);
  if(bN.maxHp !== 1200) throw new Error('normal Boss6 maxHp 应为 1200, 实际 '+bN.maxHp);
  // hard: 1200*1.5=1800
  g.difficulty = 'hard';
  const bH = new sandbox.Boss(g, 6);
  if(bH.maxHp !== 1800) throw new Error('hard Boss6 maxHp 应为 1800, 实际 '+bH.maxHp);
  // easy: 与 normal 相同
  g.difficulty = 'easy';
  const bE = new sandbox.Boss(g, 6);
  if(bE.maxHp !== 1200) throw new Error('easy Boss6 maxHp 应为 1200, 实际 '+bE.maxHp);
  // Boss1: 140 * 1.5 = 210
  g.difficulty = 'hard';
  const b1 = new sandbox.Boss(g, 1);
  if(b1.maxHp !== 210) throw new Error('hard Boss1 maxHp 应为 210, 实际 '+b1.maxHp);
});

// T24: 敌人 fireTimer 按难度调整（easy 慢 / hard 快）
test('敌人 fireTimer 按难度调整：easy 减量小 / hard 减量大', ()=>{
  const g = makeGame(2);
  // 让敌人在屏内（满足 fireTimer 触发条件）
  // normal: dt 减量 = 0.1 * 1.0 = 0.1
  g.difficulty = 'normal';
  const eN = new sandbox.Enemy('turret', 100, 100, g);
  eN.fireTimer = 1.0;
  eN.x = g.camX + 100;  // 在屏内
  const beforeN = eN.fireTimer;
  eN.update(0.1);
  const deltaN = beforeN - eN.fireTimer;
  if(Math.abs(deltaN - 0.1) > 0.001) throw new Error('normal 难度 fireTimer 减量应为 0.1, 实际 '+deltaN);

  // easy: dt 减量 = 0.1 / 1.3 ≈ 0.0769
  g.difficulty = 'easy';
  const eE = new sandbox.Enemy('turret', 100, 100, g);
  eE.fireTimer = 1.0;
  eE.x = g.camX + 100;
  const beforeE = eE.fireTimer;
  eE.update(0.1);
  const deltaE = beforeE - eE.fireTimer;
  if(Math.abs(deltaE - 0.1/1.3) > 0.001) throw new Error('easy 难度 fireTimer 减量应为 '+(0.1/1.3).toFixed(4)+', 实际 '+deltaE.toFixed(4));

  // hard: dt 减量 = 0.1 / 0.7 ≈ 0.1429
  g.difficulty = 'hard';
  const eH = new sandbox.Enemy('turret', 100, 100, g);
  eH.fireTimer = 1.0;
  eH.x = g.camX + 100;
  const beforeH = eH.fireTimer;
  eH.update(0.1);
  const deltaH = beforeH - eH.fireTimer;
  if(Math.abs(deltaH - 0.1/0.7) > 0.001) throw new Error('hard 难度 fireTimer 减量应为 '+(0.1/0.7).toFixed(4)+', 实际 '+deltaH.toFixed(4));
});

// T25: Boss fireTimer 按难度调整
test('Boss fireTimer 按难度调整：easy 减量小 / hard 减量大', ()=>{
  const g = makeGame(5);
  // normal
  g.difficulty = 'normal';
  const bN = new sandbox.Boss(g, 1);
  bN.entered = true;
  bN.fireTimer = 1.0;
  const beforeN = bN.fireTimer;
  bN.update(0.1);
  const deltaN = beforeN - bN.fireTimer;
  if(Math.abs(deltaN - 0.1) > 0.001) throw new Error('normal Boss fireTimer 减量应为 0.1, 实际 '+deltaN);

  // easy
  g.difficulty = 'easy';
  const bE = new sandbox.Boss(g, 1);
  bE.entered = true;
  bE.fireTimer = 1.0;
  const beforeE = bE.fireTimer;
  bE.update(0.1);
  const deltaE = beforeE - bE.fireTimer;
  if(Math.abs(deltaE - 0.1/1.3) > 0.001) throw new Error('easy Boss fireTimer 减量应为 '+(0.1/1.3).toFixed(4)+', 实际 '+deltaE.toFixed(4));

  // hard
  g.difficulty = 'hard';
  const bH = new sandbox.Boss(g, 1);
  bH.entered = true;
  bH.fireTimer = 1.0;
  const beforeH = bH.fireTimer;
  bH.update(0.1);
  const deltaH = beforeH - bH.fireTimer;
  if(Math.abs(deltaH - 0.1/0.7) > 0.001) throw new Error('hard Boss fireTimer 减量应为 '+(0.1/0.7).toFixed(4)+', 实际 '+deltaH.toFixed(4));
});

// T26: drawTitle 在各难度下不抛异常
test('drawTitle 各难度下绘制不抛异常', ()=>{
  const g = new sandbox.Game();
  g.state = 'TITLE';
  for(const d of ['easy','normal','hard']){
    g.difficulty = d;
    try { g.drawTitle(); }
    catch(e){ throw new Error(`drawTitle 难度=${d} 异常: ${e.message}`); }
  }
});

// T27: 新增开火方法存在
test('Enemy 新增开火方法存在（shootAimedFan/shootRing/shootAimedBurst/shootCorrosiveRing）', ()=>{
  const g = makeGame();
  const e = new sandbox.Enemy('turret', 100, 100, g);
  for(const m of ['shootAimedFan','shootRing','shootAimedBurst','shootCorrosiveRing']){
    if(typeof e[m] !== 'function') throw new Error('Enemy 缺少方法: '+m);
  }
});

// T28: shootRing 发射 n 颗子弹（360° 环形）
test('shootRing 发射指定数量的子弹（360° 环形）', ()=>{
  const g = makeGame(2);
  const e = new sandbox.Enemy('core_cell', 200, 200, g);
  const before = g.bullets.length;
  e.shootRing(8);
  if(g.bullets.length - before !== 8) throw new Error('shootRing(8) 应发射 8 颗, 实际 '+(g.bullets.length-before));
  // 验证子弹方向均匀分布（角度差约 45°）
  const angles = g.bullets.slice(-8).map(b=>Math.atan2(b.vy, b.vx));
  // 排序后相邻角度差应接近 2π/8
  angles.sort((a,b)=>a-b);
  const expectedDiff = (2*Math.PI/8);
  for(let i=1;i<8;i++){
    const d = angles[i]-angles[i-1];
    if(Math.abs(d - expectedDiff) > 0.1 && Math.abs(d - expectedDiff - 2*Math.PI) > 0.1)
      throw new Error('环形子弹角度分布不均匀: '+d.toFixed(3)+' vs '+expectedDiff.toFixed(3));
  }
});

// T29: shootAimedFan 朝玩家方向扇形发射
test('shootAimedFan 朝玩家方向扇形发射 n 颗', ()=>{
  const g = makeGame();
  const e = new sandbox.Enemy('turret', 200, 200, g);
  g.player.x = 100; g.player.y = 200;  // 玩家在敌人左侧
  const before = g.bullets.length;
  e.shootAimedFan(3, 0.2);
  if(g.bullets.length - before !== 3) throw new Error('shootAimedFan(3) 应发射 3 颗, 实际 '+(g.bullets.length-before));
  // 中心子弹应朝玩家方向（左 = -x 方向）
  const mid = g.bullets[before+1];
  if(mid.vx >= 0) throw new Error('中心子弹应朝玩家方向（左）, vx='+mid.vx);
});

// T30: shootCorrosiveRing 发射腐蚀液子弹
test('shootCorrosiveRing 发射腐蚀液子弹', ()=>{
  const g = makeGame(4);
  const e = new sandbox.Enemy('mutant_grunt', 200, 200, g);
  const before = g.bullets.length;
  e.shootCorrosiveRing(10);
  if(g.bullets.length - before !== 10) throw new Error('shootCorrosiveRing(10) 应发射 10 颗, 实际 '+(g.bullets.length-before));
  // 验证子弹带腐蚀属性
  const ring = g.bullets.slice(-10);
  for(const b of ring){
    if(!b.corrosive) throw new Error('shootCorrosiveRing 子弹应带腐蚀属性');
  }
});

// T31: shootAimedBurst 触发连发状态，update 中按间隔连续发射
test('shootAimedBurst 触发连发状态，update 中连续发射', ()=>{
  const g = makeGame();
  const e = new sandbox.Enemy('laser_node', 200, 200, g);
  e.x = g.camX + 100;  // 在屏内
  // 触发 3 连发
  e.shootAimedBurst(3, 0.15);
  if(e._burstCount !== 3) throw new Error('_burstCount 应为 3, 实际 '+e._burstCount);
  if(e._burstInterval !== 0.15) throw new Error('_burstInterval 应为 0.15, 实际 '+e._burstInterval);
  // 第一次 update 应立即发射第一颗（_burstTimer<=0）
  const before0 = g.bullets.length;
  e.update(0.01);
  if(g.bullets.length <= before0) throw new Error('第一次 update 应发射第一颗子弹');
  if(e._burstCount !== 2) throw new Error('发射后 _burstCount 应为 2, 实际 '+e._burstCount);
  // 立即再次 update 不应发射（需等间隔）
  const before1 = g.bullets.length;
  e.update(0.01);
  if(g.bullets.length > before1) throw new Error('间隔未到不应发射');
  // 推进 0.15s 后应再发射一颗
  e.update(0.15);
  if(g.bullets.length <= before1) throw new Error('间隔后应再发射一颗');
  if(e._burstCount !== 1) throw new Error('第二颗发射后 _burstCount 应为 1, 实际 '+e._burstCount);
});

// T32: 第6关 ruin_core 多模式开火（召唤碎片 / 环形 / 弹幕）
test('ruin_core 多模式开火：召唤碎片 / 环形 / 弹幕', ()=>{
  const g = makeGame(5);
  // 在屏内 + 让 fireTimer 触发
  const ruin = new sandbox.Enemy('ruin_core', 200, 200, g);
  ruin.x = g.camX + 100;
  // 跑多次以触发各种模式（验证不抛异常）
  let foundDebris=false, foundBullets=false;
  for(let i=0;i<50;i++){
    ruin.fireTimer = 0;
    const enemiesBefore = g.enemies.length;
    const bulletsBefore = g.bullets.length;
    ruin.update(0.01);
    if(g.enemies.length > enemiesBefore) foundDebris = true;
    if(g.bullets.length - bulletsBefore > 5) foundBullets = true;  // shootRing/shootAimedBurst
    if(foundDebris && foundBullets) break;
  }
  if(!foundDebris) throw new Error('ruin_core 应触发召唤碎片模式');
  if(!foundBullets) throw new Error('ruin_core 应触发环形/弹幕模式');
});

// T33: Boss 专属机制状态变量初始化
test('Boss 专属机制状态变量初始化', ()=>{
  const g = makeGame(0);
  for(const t of [2,3,4,5,6]){
    const b = new sandbox.Boss(g, t);
    // boss2: 障碍召唤
    if(!('obstacleTimer' in b)) throw new Error(`Boss${t} 缺少 obstacleTimer`);
    // boss3: 冲撞状态
    if(!('chargeState' in b)) throw new Error(`Boss${t} 缺少 chargeState`);
    if(b.chargeState !== 'idle') throw new Error(`Boss${t} 初始 chargeState 应为 idle, 实际 ${b.chargeState}`);
    if(!('chargeTimer' in b)) throw new Error(`Boss${t} 缺少 chargeTimer`);
    // boss4: 扫射弹幕
    if(!('sweepTimer' in b)) throw new Error(`Boss${t} 缺少 sweepTimer`);
    // boss5: 旋转激光
    if(!('rotLaserActive' in b)) throw new Error(`Boss${t} 缺少 rotLaserActive`);
    if(!('rotLaserDir' in b)) throw new Error(`Boss${t} 缺少 rotLaserDir`);
    // boss6: 能量波 + 弹射激光
    if(!('energyWaveActive' in b)) throw new Error(`Boss${t} 缺少 energyWaveActive`);
    if(!('ricochetLaserActive' in b)) throw new Error(`Boss${t} 缺少 ricochetLaserActive`);
    if(b.ricochetLaserMaxBounces !== 4) throw new Error(`Boss${t} ricochetLaserMaxBounces 应为 4, 实际 ${b.ricochetLaserMaxBounces}`);
  }
});

// T34: Boss2 周期性召唤障碍物
test('Boss2 周期性召唤障碍物（小行星/碎片）', ()=>{
  const g = makeGame(1);
  const b = new sandbox.Boss(g, 2);
  b.entered = true;
  b.obstacleTimer = 0.01;  // 立即触发
  const enemiesBefore = g.enemies.length;
  b.update(0.02);
  if(g.enemies.length <= enemiesBefore) throw new Error('Boss2 应召唤障碍物');
  // 验证召唤的是小行星类敌人
  const newEnemies = g.enemies.slice(enemiesBefore);
  const validTypes = ['asteroid_s','asteroid_m','debris_big'];
  for(const e of newEnemies){
    if(!validTypes.includes(e.type)) throw new Error('Boss2 召唤了非障碍类型: '+e.type);
  }
});

// T35: Boss3 冲撞机制状态机（idle→charging→dashing→returning→idle）
test('Boss3 冲撞机制：idle→charging→dashing→returning→idle', ()=>{
  const g = makeGame(2);
  const b = new sandbox.Boss(g, 3);
  b.entered = true;
  if(b.chargeState !== 'idle') throw new Error('初始应为 idle');
  // 触发充能：将 chargeTimer 设为 0
  b.chargeTimer = 0.01;
  b.update(0.02);
  if(b.chargeState !== 'charging') throw new Error('chargeTimer 到 0 应切换到 charging, 实际 '+b.chargeState);
  // 推进 0.8s 应切换到 dashing
  const dashStartY = b.y;
  for(let i=0;i<80;i++) b.update(0.01);
  if(b.chargeState !== 'dashing') throw new Error('充能 0.8s 后应为 dashing, 实际 '+b.chargeState);
  // 推进 0.7s 应切换到 returning（新冲刺时长 0.7s）
  for(let i=0;i<75;i++) b.update(0.01);
  if(b.chargeState !== 'returning') throw new Error('冲刺 0.7s 后应为 returning, 实际 '+b.chargeState);
  // 推进 1.2s 应回到 idle
  for(let i=0;i<125;i++) b.update(0.01);
  if(b.chargeState !== 'idle') throw new Error('归位 1.2s 后应为 idle, 实际 '+b.chargeState);
});

// T36: Boss3 冲撞接触玩家造成伤害
test('Boss3 冲撞接触玩家造成伤害', ()=>{
  const g = makeGame(2);
  const b = new sandbox.Boss(g, 3);
  b.entered = true;
  // 把玩家拉到 Boss 附近
  g.player.x = b.x - 60;
  g.player.y = b.y;
  g.player.invincible = 0;
  const livesBefore = g.player.lives;
  // 直接进入 dashing 阶段（已冲刺一半时间，Boss 接近玩家位置）
  b.chargeState='dashing';
  b.chargeDur = 0.35;  // 剩余 0.35s（基于新冲刺时长 0.7s），tt=0.5
  b.chargeOriginX = b.x; b.chargeOriginY = b.y;
  b.chargeTargetX = g.player.x; b.chargeTargetY = g.player.y;
  b.update(0.01);
  if(g.player.lives >= livesBefore) throw new Error(`Boss3 冲撞应造成伤害, lives=${g.player.lives} vs ${livesBefore}`);
});

// T36b: Boss3 冲撞贯穿屏幕（玩家躲在左边缘也会被撞）
test('Boss3 冲撞贯穿屏幕——玩家躲在左边缘也受伤', ()=>{
  const g = makeGame(2);
  const b = new sandbox.Boss(g, 3);
  b.entered = true;
  // 玩家躲在屏幕左边缘（贴近 camX+24 边界）
  g.player.x = g.camX + 30;
  g.player.y = sandbox.H/2;
  g.player.invincible = 0;
  const livesBefore = g.player.lives;
  // 触发充能：应锁定玩家 Y + 屏幕左端外
  b.chargeTimer = 0.01;
  b.update(0.02);
  if(b.chargeState !== 'charging') throw new Error('应进入 charging, 实际 '+b.chargeState);
  // chargeTargetX 应在屏幕左端外（camX - 60），不是玩家 x 位置
  if(b.chargeTargetX > g.camX) throw new Error('冲撞目标 X 应在屏幕左端外, 实际 '+b.chargeTargetX);
  // 推进到 dashing 完成（充能 0.8s + 冲刺 0.7s）
  for(let i=0;i<160;i++) b.update(0.01);
  // 玩家躲在左边缘也应受伤（Boss 冲撞路径覆盖整条屏幕）
  if(g.player.lives >= livesBefore) throw new Error('玩家在左边缘也应被冲撞到, lives='+g.player.lives+' vs '+livesBefore);
});



// T37: Boss4 目标定向多发扫射弹幕
test('Boss4 目标定向多发扫射弹幕（3 层扇形）', ()=>{
  const g = makeGame(3);
  const b = new sandbox.Boss(g, 4);
  b.entered = true;
  b.sweepTimer = 0.01;  // 立即触发
  const bulletsBefore = g.bullets.length;
  b.update(0.02);
  const newBullets = g.bullets.length - bulletsBefore;
  // 3 层 × (4+phase) 颗，phase=1 → 3*5=15
  if(newBullets < 12) throw new Error('Boss4 扫射应发射至少 12 颗（3 层 × 4+颗），实际 '+newBullets);
  // 验证子弹朝玩家方向（左方）
  const newOnes = g.bullets.slice(bulletsBefore);
  let leftCount=0;
  for(const bul of newOnes){
    if(bul.vx < 0) leftCount++;   // 玩家在左
  }
  if(leftCount < newBullets*0.8) throw new Error('大部分子弹应朝玩家方向（左）');
});

// T38: Boss5 阶段3 旋转激光触发
test('Boss5 阶段3 旋转激光触发', ()=>{
  const g = makeGame(4);
  const b = new sandbox.Boss(g, 5);
  b.entered = true;
  // 设置 hp 让 phase 自动切换到 3（hp < 25% maxHp）
  b.hp = b.maxHp * 0.2;
  b.rotLaserActive = false;
  b.rotLaserTimer = 0.01;  // 立即触发
  b.update(0.02);
  if(b.phase !== 3) throw new Error('Boss5 hp=20% 应为 phase 3, 实际 '+b.phase);
  if(!b.rotLaserActive) throw new Error('Boss5 P3 rotLaserTimer 到 0 应激活旋转激光');
  if(b.rotLaserDur !== 5.0) throw new Error('旋转激光持续应为 5.0s, 实际 '+b.rotLaserDur);
  // rotLaserDir 应为 ±1
  if(Math.abs(b.rotLaserDir) !== 1) throw new Error('rotLaserDir 应为 ±1, 实际 '+b.rotLaserDir);
});

// T39: Boss5 旋转激光对玩家造成伤害
test('Boss5 旋转激光：玩家在激光路径上受伤', ()=>{
  const g = makeGame(4);
  const b = new sandbox.Boss(g, 5);
  b.entered = true;
  // 设置 hp 进入 phase 3
  b.hp = b.maxHp * 0.2;
  b.update(0.01);  // 让 phase 切换为 3
  if(b.phase !== 3) throw new Error('phase 应为 3, 实际 '+b.phase);
  b.rotLaserActive = true;
  b.rotLaserDur = 5.0;
  b.rotLaserAngle = 0;   // 激光朝右方
  b.rotLaserDir = 1;
  g.player.invincible = 0;
  g.player.lives = 5;
  const livesBefore = g.player.lives;
  // 推进 0.5s：每帧让玩家跟随激光角度移动（始终在激光路径上）
  for(let i=0;i<50;i++){
    const cx = g.camX + sandbox.W/2;
    const cy = sandbox.H/2;
    g.player.x = cx + Math.cos(b.rotLaserAngle) * 250;
    g.player.y = cy + Math.sin(b.rotLaserAngle) * 250;
    b.update(0.01);
  }
  if(g.player.lives >= livesBefore) throw new Error(`玩家在激光路径上应受伤, lives=${g.player.lives} vs ${livesBefore}`);
});

// T40: Boss6 能量波触发 + 玩家在角落安全
test('Boss6 能量波：玩家在角落安全，在其他位置受伤', ()=>{
  const g = makeGame(5);
  const b = new sandbox.Boss(g, 6);
  b.entered = true;
  b.energyWaveActive = true;
  b.energyWaveDur = 2.5;
  // 玩家在角落（左上）
  g.player.x = g.camX + 60;
  g.player.y = 60;
  g.player.invincible = 0;
  g.player.lives = 5;
  const livesBefore = g.player.lives;
  // 推进 0.5s 不应受伤（在安全区）
  for(let i=0;i<50;i++) b.update(0.01);
  if(g.player.lives < livesBefore) throw new Error('玩家在角落应安全, 但受伤了');
  // 玩家移到中央（非安全区）
  g.player.x = g.camX + sandbox.W/2;
  g.player.y = sandbox.H/2;
  g.player.invincible = 0;
  const livesMid = g.player.lives;
  for(let i=0;i<50;i++) b.update(0.01);
  if(g.player.lives >= livesMid) throw new Error('玩家在中央应受伤, 但未受伤');
});

// T41: Boss6 弹射激光反弹最多 4 次
test('Boss6 弹射激光：撞墙反弹最多 4 次', ()=>{
  const g = makeGame(5);
  const b = new sandbox.Boss(g, 6);
  b.entered = true;
  // 启动弹射激光：朝右上发射，会快速撞顶
  b.ricochetLaserActive = true;
  b.ricochetLaserBounces = 0;
  b.ricochetLaserLife = 10.0;  // 寿命足够长
  b.ricochetLaserX = b.x;
  b.ricochetLaserY = b.y;
  b.ricochetLaserVx = 600;
  b.ricochetLaserVy = -600;  // 朝右上快速移动
  b.update(0.5);  // 推进 0.5s，应至少撞墙 1 次
  if(b.ricochetLaserBounces === 0 && b.ricochetLaserActive) {
    // 若还未撞墙，再推进
    b.update(0.5);
  }
  // 验证反弹次数不超过 4
  if(b.ricochetLaserBounces > 4) throw new Error('反弹次数超过 4, 实际 '+b.ricochetLaserBounces);
  // 如果反弹已达 4，激光应消失
  if(b.ricochetLaserBounces >= 4 && !b.ricochetLaserActive) {
    // 预期：达到 4 次反弹后消失
  }
});

// T42: Boss6 弹射激光接触玩家造成伤害
test('Boss6 弹射激光接触玩家造成伤害', ()=>{
  const g = makeGame(5);
  const b = new sandbox.Boss(g, 6);
  b.entered = true;
  b.ricochetLaserActive = true;
  b.ricochetLaserLife = 5.0;
  b.ricochetLaserBounces = 0;
  // 激光在玩家位置
  b.ricochetLaserX = g.player.x;
  b.ricochetLaserY = g.player.y;
  b.ricochetLaserVx = 0;
  b.ricochetLaserVy = 0;  // 不移动，停留在玩家位置
  g.player.invincible = 0;
  g.player.lives = 5;
  const livesBefore = g.player.lives;
  b.update(0.01);
  if(g.player.lives >= livesBefore) throw new Error('弹射激光接触玩家应造成伤害');
});

// T43: drawSpecials 在各种 Boss 状态下不抛异常
test('drawSpecials 各 Boss 状态下绘制不抛异常', ()=>{
  const ctx = canvas.getContext();
  // Boss3 充能状态
  let g = makeGame(2);
  let b = new sandbox.Boss(g, 3);
  b.entered = true;
  b.chargeState = 'charging';
  b.t = 1.0;
  try { b.drawSpecials(ctx, 0); }
  catch(e){ throw new Error('Boss3 drawSpecials 异常: '+e.message); }
  // Boss5 旋转激光激活
  g = makeGame(4);
  b = new sandbox.Boss(g, 5);
  b.entered = true;
  b.rotLaserActive = true;
  b.rotLaserAngle = 0.5;
  b.t = 1.0;
  try { b.drawSpecials(ctx, 0); }
  catch(e){ throw new Error('Boss5 drawSpecials 异常: '+e.message); }
  // Boss6 能量波 + 弹射激光同时激活
  g = makeGame(5);
  b = new sandbox.Boss(g, 6);
  b.entered = true;
  b.energyWaveActive = true;
  b.ricochetLaserActive = true;
  b.ricochetLaserX = 200;
  b.ricochetLaserY = 200;
  b.ricochetLaserBounces = 2;
  b.t = 1.0;
  try { b.drawSpecials(ctx, 0); }
  catch(e){ throw new Error('Boss6 drawSpecials 异常: '+e.message); }
});

// T44: 新增 fireTracking / fireWall 方法存在
test('Boss 新增 fireTracking / fireWall 方法存在', ()=>{
  const g = makeGame(0);
  const b = new sandbox.Boss(g, 1);
  if(typeof b.fireTracking !== 'function') throw new Error('Boss 缺少 fireTracking 方法');
  if(typeof b.fireWall !== 'function') throw new Error('Boss 缺少 fireWall 方法');
});

// T45: fireTracking 发射追踪子弹
test('fireTracking 发射追踪子弹', ()=>{
  const g = makeGame(0);
  const b = new sandbox.Boss(g, 1);
  g.player.x = b.x - 200;
  g.player.y = b.y;
  const before = g.bullets.length;
  b.fireTracking(3, 1.5);
  if(g.bullets.length - before !== 3) throw new Error('fireTracking(3) 应发射 3 颗, 实际 '+(g.bullets.length-before));
  // 验证子弹带追踪属性
  const tbs = g.bullets.slice(before);
  for(const bul of tbs){
    if(bul.tracking !== 0.4) throw new Error('追踪子弹 tracking 应为 0.4, 实际 '+bul.tracking);
    if(bul.trackingTime !== 1.5) throw new Error('追踪子弹 trackingTime 应为 1.5, 实际 '+bul.trackingTime);
  }
});

// T46: 追踪子弹在 update 中朝玩家转向
test('追踪子弹在 update 中朝玩家转向', ()=>{
  const g = makeGame(0);
  // 玩家在屏幕左侧，子弹从右侧发射
  g.player.x = 100;
  g.player.y = 300;
  const bullet = new sandbox.Bullet(800, 300, -100, 0, {w:10,h:10,dmg:1,color:'#ff8a3a',friendly:false,tracking:0.4,trackingTime:1.5});
  const vy0 = bullet.vy;
  // 把玩家位置移到上方，子弹应朝上方转向
  g.player.y = 100;
  bullet.update(0.1, g);
  // vy 应朝负方向（向上）变化
  if(bullet.vy >= vy0) throw new Error('追踪子弹应朝玩家方向（上）转向, vy='+bullet.vy+' vs '+vy0);
  // trackingTime 应减少
  if(bullet.trackingTime >= 1.5) throw new Error('trackingTime 应减少, 实际 '+bullet.trackingTime);
});

// T47: fireWall 发射散弹墙（朝玩家方向，避开玩家附近 gap）
test('fireWall 发射散弹墙', ()=>{
  const g = makeGame(0);
  const b = new sandbox.Boss(g, 1);
  g.player.x = 200;
  g.player.y = sandbox.H/2;   // 屏幕中央
  const before = g.bullets.length;
  b.fireWall(10);
  const newBullets = g.bullets.length - before;
  if(newBullets < 3) throw new Error('fireWall(10) 至少应发射 3 颗（避开 gap）, 实际 '+newBullets);
  // 验证子弹朝左飞（朝玩家方向）
  const wallBullets = g.bullets.slice(before);
  for(const bul of wallBullets){
    if(bul.vx >= 0) throw new Error('散弹墙子弹应朝左飞, vx='+bul.vx);
  }
});

// T48: 阶段切换瞬间爆发弹幕
test('Boss 阶段切换瞬间爆发弹幕', ()=>{
  const g = makeGame(5);
  const b = new sandbox.Boss(g, 6);
  b.entered = true;
  // 初始 phase=1，hp=full
  if(b.phase !== 1) throw new Error('初始 phase 应为 1, 实际 '+b.phase);
  // 把 hp 降到 25% 以下，触发 phase 切换到 3
  b.hp = b.maxHp * 0.2;
  const before = g.bullets.length;
  b.update(0.01);
  if(b.phase !== 3) throw new Error('切换后 phase 应为 3, 实际 '+b.phase);
  // 应爆发 fireRing(20) + fireFan(10) = 30 颗
  if(g.bullets.length - before < 25) throw new Error('阶段切换应爆发至少 25 颗子弹, 实际 '+(g.bullets.length-before));
});

// T49: Boss 阶段3 移动更主动（朝玩家 Y 漂移）
test('Boss 阶段3 移动更主动：朝玩家 Y 漂移', ()=>{
  const g = makeGame(0);
  const b = new sandbox.Boss(g, 1);
  b.entered = true;
  b.phase = 3;
  // 玩家在 Boss 上方
  g.player.y = 100;
  const bossY0 = b.y;
  b.update(0.5);
  // Boss Y 应朝玩家方向（减小）
  if(b.y >= bossY0) throw new Error('Boss P3 应朝玩家方向（上）漂移, y0='+bossY0+' y1='+b.y);
});

// T50: 从激光升级到散弹时，激光动画立即关闭
test('从激光升级到散弹时激光动画立即关闭', ()=>{
  const g = makeGame();
  // 先升级激光到 1 级
  g.player.crystals = 100;
  g.player.tryUpgrade(4);   // 激光
  if(g.player.laserLevel !== 1) throw new Error('激光升级失败, level='+g.player.laserLevel);
  if(!g.player.hasLaser) throw new Error('hasLaser 应为 true');
  // 模拟按住空格开火：激光激活
  sandbox.Input.keys[' '] = true;
  g.player.update(0.02);
  if(!g.player.laserActive) throw new Error('按住空格时激光应激活');
  // 升级散弹：应立即关闭激光状态
  g.player.tryUpgrade(3);   // 散弹
  // 立即检查（update 之前）：laserActive 应为 false
  if(g.player.laserActive) throw new Error('升级散弹后 laserActive 应立即为 false');
  if(g.player.laserLevel !== 0) throw new Error('升级散弹后 laserLevel 应为 0');
  if(g.player.hasLaser) throw new Error('升级散弹后 hasLaser 应为 false');
  // 再 update 一次：laserActive 仍应为 false（动画不应残留）
  g.player.update(0.02);
  if(g.player.laserActive) throw new Error('升级散弹后 update 后激光不应再激活');
  sandbox.Input.keys[' '] = false;
});

// T51: Boss 入场动画期间不可被攻击（玩家子弹无效）
test('Boss 入场期间玩家子弹不造成伤害', ()=>{
  const g = makeGame(0);
  const b = new sandbox.Boss(g, 1);
  b.entered = false;   // 入场中
  g.boss = b;          // 注册到 Game
  const hpBefore = b.hp;
  // 模拟一颗友方子弹击中 Boss 核心
  g.bullets.length = 0;
  const bullet = new sandbox.Bullet(b.x, b.y, -300, 0, {w:8,h:8,dmg:1,friendly:true});
  g.bullets.push(bullet);
  g.collisions();
  if(b.hp !== hpBefore) throw new Error('Boss 入场期间不应被攻击, hp 减少 '+(hpBefore-b.hp));
  if(bullet.dead) throw new Error('入场期间子弹不应被消耗（应穿过 Boss）');
});

// T52: Boss 入场期间不伤害玩家（即使身体重叠）
test('Boss 入场期间不伤害玩家', ()=>{
  const g = makeGame(0);
  const b = new sandbox.Boss(g, 1);
  b.entered = false;
  g.boss = b;
  // 把 Boss 放到玩家位置上
  b.x = g.player.x; b.y = g.player.y;
  g.player.invincible = 0;
  const livesBefore = g.player.lives;
  g.collisions();
  if(g.player.lives < livesBefore) throw new Error('Boss 入场期间不应伤害玩家, lives 减少 '+(livesBefore-g.player.lives));
});

// T53: 掉落物使用 camX 相对坐标离屏回收（长关卡不滞留）
test('掉落物使用 camX 相对坐标离屏回收', ()=>{
  const g = makeGame(5);   // 第六关长关卡
  // 假设相机已经推进到 5000
  g.camX = 5000;
  // 在相机左侧 200 处生成掉落物（已在屏幕外）
  const c = new sandbox.Crystal(g.camX - 200, 300);
  const l = new sandbox.LifeDrop(g.camX - 200, 300);
  const bc = new sandbox.BombCrystal(g.camX - 200, 300);
  g.crystals.push(c); g.lifeDrops.push(l); g.bombCrystals.push(bc);
  c.update(0.01, g.player); l.update(0.01, g.player); bc.update(0.01, g.player);
  if(!c.dead) throw new Error('离屏 Crystal 应被标记 dead');
  if(!l.dead) throw new Error('离屏 LifeDrop 应被标记 dead');
  if(!bc.dead) throw new Error('离屏 BombCrystal 应被标记 dead');
});

// T54: 玩家本帧被敌弹杀死后不再拾取道具（避免死后误触清屏）
test('玩家同帧死亡后不拾取道具', ()=>{
  const g = makeGame();
  // 玩家剩 1 命且无护盾
  g.player.lives = 1;
  g.player.invincible = 0;
  g.player.shieldHits = 0;
  // 在玩家位置放置清屏晶体（满库存触发清屏）
  const bc = new sandbox.BombCrystal(g.player.x, g.player.y);
  g.bombCrystals.push(bc);
  g.player.bombs = 2;   // 已满，碰到会触发清屏
  // 在玩家位置放置敌弹，会立即杀死玩家
  g.bullets.length = 0;
  const eb = new sandbox.Bullet(g.player.x, g.player.y, 0, 0, {w:8,h:8,dmg:1,friendly:false});
  g.bullets.push(eb);
  g.collisions();
  // 玩家应死亡
  if(g.player.alive) throw new Error('玩家应被敌弹杀死');
  // 清屏晶体应未被拾取（仍在数组中）
  if(bc.dead) throw new Error('玩家死亡后不应再拾取清屏晶体');
  // 玩家库存应未变化，且未触发清屏
  if(g.player.bombs !== 2) throw new Error('玩家库存不应变化');
});

// T55: 暂停时星空背景不更新
test('暂停时星空不更新', ()=>{
  const g = makeGame();
  g.state = 'PLAYING';
  // 推进一帧，记录某颗星星位置
  g.starfield.update(0.05, g.level.scrollSpeed);
  const star1 = g.starfield.layers[0].stars[0];
  const x1 = star1.x, y1 = star1.y;
  // 暂停
  g.state = 'PAUSED';
  // 多次 update：星空不应移动
  for(let i=0;i<5;i++) g.update(0.05);
  const star2 = g.starfield.layers[0].stars[0];
  if(star2.x !== x1 || star2.y !== y1) {
    throw new Error('暂停期间星空不应移动: before=('+x1+','+y1+') after=('+star2.x+','+star2.y+')');
  }
});

// T56: Boss5 旋转激光跨会话不立即伤害玩家
test('Boss5 旋转激光会话切换时不立即伤害', ()=>{
  const g = makeGame(4);
  const b = new sandbox.Boss(g, 5);
  b.entered = true;
  b.hp = b.maxHp * 0.2;   // 强制 phase=3（boss.update 会根据 hp 重算 phase）
  // 触发激光
  b.rotLaserTimer = 0.01;
  b.update(0.02);
  if(b.phase !== 3) throw new Error('hp=20% phase 应为 3, 实际 '+b.phase);
  if(!b.rotLaserActive) throw new Error('激光应激活');
  // 持续到激光结束
  b.rotLaserDur = 0.01;
  for(let i=0;i<5;i++) b.update(0.01);
  if(b.rotLaserActive) throw new Error('激光应已结束');
  // 模拟玩家曾经在激光路径上累积了 _rotLaserHurtT
  b._rotLaserHurtT = 0.14;   // 即将达阈值
  // 再次激活激光
  b.rotLaserTimer = 0.01;
  // 把玩家放到激光路径上（中心右侧，正东方向 angle=0）
  const cx = g.camX + sandbox.W/2, cy = sandbox.H/2;
  g.player.x = cx + 200;
  g.player.y = cy;
  g.player.invincible = 0;
  g.player.lives = 5;
  const livesBefore = g.player.lives;
  // 短 tick（dt 很小，不应超过 0.15 累积）
  b.update(0.01);
  if(b._rotLaserHurtT !== 0) throw new Error('激光重新激活时应重置 _rotLaserHurtT, 实际 '+b._rotLaserHurtT);
  // 单帧 0.01s 不应造成伤害（远小于 0.15）
  if(g.player.lives < livesBefore) throw new Error('激光重新激活时不应立即伤害玩家');
});

// T57: Boss3 冲撞使用线段碰撞（玩家在路径上但不在端点也受伤）
test('Boss3 冲撞线段碰撞：玩家在路径中段受伤', ()=>{
  const g = makeGame(2);
  const b = new sandbox.Boss(g, 3);
  b.entered = true;
  b.chargeState = 'dashing';
  b.chargeDur = 0.35;   // tt=0.5
  // Boss 从 x=1000 冲到 x=200，路径覆盖 x=600
  b.chargeOriginX = 1000; b.chargeOriginY = 300;
  b.chargeTargetX = 200;   b.chargeTargetY = 300;
  b.x = 1000; b.y = 300;   // 当前位置（会被 tt=0.5 覆盖到 x=600）
  // 玩家位于 x=600（路径中段）、y=300（路径线上）
  g.player.x = 600; g.player.y = 300;
  g.player.invincible = 0;
  g.player.lives = 5;
  const livesBefore = g.player.lives;
  b.update(0.01);
  // 玩家正好在 (600, 300)，Boss 这一帧从 (1000,300) 走到 (600,300)，应受伤
  if(g.player.lives >= livesBefore) throw new Error('玩家在路径中段应被线段碰撞检测到');
});

// T58: 玩家碰撞箱仅覆盖飞机前半部分（驾驶舱）— 后半部分（机翼/尾翼）应无碰撞
test('玩家碰撞箱：仅前半部分（驾驶舱）触发碰撞', ()=>{
  const g = makeGame();
  g.player.invincible = 0;
  g.player.lives = 5;
  // 取玩家碰撞箱
  const pb = g.player.bounds();
  // 1) 碰撞箱 X 中心应位于玩家 X 前方（驾驶舱方向），即 playerHitOffsetX>0
  const pbCenterX = pb.x + pb.w/2;
  if(pbCenterX <= g.player.x) throw new Error('碰撞箱中心应前移到机头方向, 实际中心 X='+pbCenterX+' 玩家 X='+g.player.x);
  // 2) 碰撞箱应明显小于整体飞机尺寸 (38x24)
  if(pb.w >= 38 || pb.h >= 24) throw new Error('碰撞箱应小于整体飞机尺寸 38x24, 实际 '+pb.w+'x'+pb.h);
  // 3) 玩家机身中后部（机翼位置）应不在碰撞箱内
  //    飞机局部坐标：机翼末端约 x=-20，机尾约 x=-12
  //    机翼位置 (player.x-15, player.y) 应在碰撞箱外
  const wingX = g.player.x - 15, wingY = g.player.y;
  const inWing = (wingX >= pb.x && wingX <= pb.x+pb.w && wingY >= pb.y && wingY <= pb.y+pb.h);
  if(inWing) throw new Error('机翼位置应在碰撞箱外（仅驾驶舱碰撞）');
  // 4) 驾驶舱位置 (player.x+10, player.y) 应在碰撞箱内
  const cockpitX = g.player.x + 10, cockpitY = g.player.y;
  const inCockpit = (cockpitX >= pb.x && cockpitX <= pb.x+pb.w && cockpitY >= pb.y && cockpitY <= pb.y+pb.h);
  if(!inCockpit) throw new Error('驾驶舱位置应在碰撞箱内');
});

// T59: 验证实际碰撞行为 — 子弹击中机翼不伤害玩家，击中驾驶舱伤害玩家
test('实际碰撞：机翼位置敌弹无效，驾驶舱位置敌弹有效', ()=>{
  const g = makeGame();
  g.player.invincible = 0;
  g.player.lives = 5;
  // 场景 1：敌弹位于玩家机翼位置（应不伤害）
  g.bullets.length = 0;
  const eb1 = new sandbox.Bullet(g.player.x - 15, g.player.y, 0, 0, {w:8,h:8,dmg:1,friendly:false});
  g.bullets.push(eb1);
  const lives1 = g.player.lives;
  g.collisions();
  if(g.player.lives < lives1) throw new Error('敌弹击中机翼位置不应伤害玩家');
  // 场景 2：敌弹位于玩家驾驶舱位置（应伤害）
  g.bullets.length = 0;
  const eb2 = new sandbox.Bullet(g.player.x + 10, g.player.y, 0, 0, {w:8,h:8,dmg:1,friendly:false});
  g.bullets.push(eb2);
  const lives2 = g.player.lives;
  g.collisions();
  if(g.player.lives >= lives2) throw new Error('敌弹击中驾驶舱位置应伤害玩家');
});

// T60: 同一敌人可同时掉多种物品（三套概率互相独立，不互斥）
test('同一敌人可同时掉多种物品（三套概率独立）', ()=>{
  const g = makeGame();
  // 大敌人：能量晶体必掉(100%)，生命 10%，清屏 5%
  // 我们直接注入"必返回 true"的 Math.random 来验证三套独立判定能同时触发
  const e = new sandbox.Enemy('asteroid_l', 200, 200, g);
  // 保存原 Math.random
  const origRandom = Math.random;
  let callIdx = 0;
  // 让所有 Math.random() 都返回 0（< 任何概率阈值）→ 三个掉落都应触发
  Math.random = () => 0;
  try {
    g.crystals.length = 0;
    g.lifeDrops.length = 0;
    g.bombCrystals.length = 0;
    e.die();
    if(g.crystals.length < 1) throw new Error('大敌人必掉能量晶体');
    if(g.lifeDrops.length < 1) throw new Error('Math.random=0 时生命补给应掉落');
    if(g.bombCrystals.length < 1) throw new Error('Math.random=0 时清屏晶体应掉落');
    if(g.crystals.length + g.lifeDrops.length + g.bombCrystals.length < 3) {
      throw new Error('同一敌人应能同时掉三种物品');
    }
  } finally {
    Math.random = origRandom;
  }
});

// T61: 掉落概率各概率独立——Math.random=1 时只掉大敌人必掉的能量晶体
test('掉落概率独立：Math.random=1 时大敌人只掉能量晶体', ()=>{
  const g = makeGame();
  const e = new sandbox.Enemy('asteroid_l', 200, 200, g);
  const origRandom = Math.random;
  // 所有 random 都返回 1（>= 所有概率阈值）→ 仅大敌人必掉的能量晶体触发
  Math.random = () => 1;
  try {
    g.crystals.length = 0;
    g.lifeDrops.length = 0;
    g.bombCrystals.length = 0;
    e.die();
    if(g.crystals.length !== 1) throw new Error('大敌人应必掉 1 颗能量晶体, 实际 '+g.crystals.length);
    if(g.lifeDrops.length !== 0) throw new Error('Math.random=1 时不应掉生命补给, 实际 '+g.lifeDrops.length);
    if(g.bombCrystals.length !== 0) throw new Error('Math.random=1 时不应掉清屏晶体, 实际 '+g.bombCrystals.length);
  } finally {
    Math.random = origRandom;
  }
});

// T62: 多个掉落物位置加随机偏移，不重叠在死亡点
test('多个掉落物位置带随机偏移，不完全重叠', ()=>{
  const g = makeGame();
  const e = new sandbox.Enemy('asteroid_l', 500, 300, g);
  // 强制所有随机都触发掉落
  const origRandom = Math.random;
  Math.random = () => 0;
  try {
    e.die();
  } finally {
    Math.random = origRandom;
  }
  // 收集所有掉落物位置
  const positions = [];
  g.crystals.forEach(c => positions.push({x:c.x, y:c.y}));
  g.lifeDrops.forEach(l => positions.push({x:l.x, y:l.y}));
  g.bombCrystals.forEach(b => positions.push({x:b.x, y:b.y}));
  if(positions.length < 3) throw new Error('应至少掉 3 个物品, 实际 '+positions.length);
  // 由于 rand(-18, 18) 偏移，三个位置不应完全相同
  // 注意：rand 在测试沙箱中可能依赖 Math.random，强制 0 时偏移可能相同
  // 至少应至少有 1 个不同（rand 用 Math.random 时返回 -18 + 0*36 = -18）
  // 但实际掉落物位置应不全是 (500, 300)
  const allSame = positions.every(p => p.x === 500 && p.y === 300);
  if(allSame) throw new Error('掉落物应有位置偏移，不应全部在死亡点');
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
