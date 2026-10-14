/* POLY PROTOCOL — headless verification.
   Drives the real page in headless Chrome via CDP (no deps).
   Usage: node tools/poly_headless.js [--shot=dir] [--demo]
   Requires chrome path; uses http server port 8473.
   This file only needs Node's built-in http + ws (Node 22+ has WebSocket). */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8473;
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.webp':'image/webp', '.png':'image/png', '.ico':'image/x-icon' };

function serve(){
  http.createServer((req,res)=>{
    let p = decodeURIComponent(req.url.split('?')[0]);
    if(p==='/') p='/index.html';
    const fp = path.join(ROOT, p.replace(/^\//,''));
    if(!fs.existsSync(fp) || fs.statSync(fp).isDirectory()){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'Content-Type': mime[path.extname(fp)] || 'application/octet-stream',
      'Cache-Control':'no-store'});
    fs.createReadStream(fp).pipe(res);
  }).listen(PORT);
  console.log('serving on :'+PORT);
}

async function main(){
  const args = process.argv.slice(2);
  const shotDir = args.find(a=>a.startsWith('--shot='))?.slice(7) || null;
  const demoMode = args.includes('--demo');
  serve();
  const userDir = path.join(process.env.TEMP || '/tmp', 'poly-chrome-'+Date.now());
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
    '--remote-debugging-port='+(9333+process.pid%100), '--window-size=1280,800',
    '--user-data-dir='+userDir, '--no-first-run', '--mute-audio',
    'http://127.0.0.1:'+PORT+'/index.html'
  ], {stdio:'ignore'});
  await new Promise(r=>setTimeout(r, 2600));
  // fetch ws debugger url
  let targets;
  for(let i=0;i<20;i++){
    try{
      targets=await (await fetch('http://127.0.0.1:'+(9333+process.pid%100)+'/json/list')).json();
      if(targets.some(t=>t.type==='page')) break;
    }catch(e){}
    await new Promise(r=>setTimeout(r, 400));
  }
  const page = targets.find(t=>t.type==='page' && t.url.includes('8473'));
  if(!page){ console.error('NO PAGE TARGET'); process.exit(2); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let idc=0; const pend=new Map();
  const send=(method, params={})=>new Promise((res,rej)=>{
    const id=++idc; pend.set(id,{res,rej});
    ws.send(JSON.stringify({id,method,params}));
  });
  ws.onmessage=(ev)=>{
    const m=JSON.parse(ev.data);
    if(m.id && pend.has(m.id)){ const p=pend.get(m.id); pend.delete(m.id);
      if(m.error) p.rej(new Error(m.error.message)); else p.res(m.result); }
  };
  await new Promise(r=> ws.onopen=r);
  await send('Runtime.enable');
  await send('Page.enable');
  await new Promise(r=>setTimeout(r,300));
  await send('Page.reload');
  await new Promise(r=>setTimeout(r,2600));
  const diag=await send('Runtime.evaluate', {expression:"JSON.stringify({P:typeof POLY, G:typeof POLY?.Geo, E:typeof POLY?.Engine, A:typeof POLY?.PAINT, gl: (()=>{ try{ const c=document.createElement('canvas'); return !!c.getContext('webgl2',{antialias:true,alpha:false}); }catch(e){ return 'ex:'+e.message; } })()})", returnByValue:true});
  console.log('MODULE DIAG:', diag.result?.value);
  const consoleErrors=[];
  ws.addEventListener('message', ev=>{
    const m=JSON.parse(ev.data);
    if(m.method==='Runtime.consoleAPICalled' && m.params.type==='error'){
      consoleErrors.push(m.params.args.map(a=>a.value??a.description??'').join(' '));
    }
    if(m.method==='Runtime.exceptionThrown'){
      consoleErrors.push('EXC: '+(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text));
    }
  });
  await send('Page.addScriptToEvaluateOnNewDocument', {source: "window.__bootErr=null; window.addEventListener('error', e=>{ window.__bootErr = (e.message||'') + ' @ ' + (e.filename||'').split(/[\\/]/).pop() + ':' + e.lineno; });"});
  const evalJs=async (expr)=>{
    const r=await send('Runtime.evaluate', {expression:expr, awaitPromise:true, returnByValue:true});
    if(r.exceptionDetails) throw new Error(r.exceptionDetails.text+' '+JSON.stringify(r.exceptionDetails.exception?.description||''));
    return r.result.value;
  };
  const shot=async (name)=>{
    if(!shotDir) return null;
    const r=await send('Page.captureScreenshot', {format:'png'});
    fs.mkdirSync(shotDir,{recursive:true});
    fs.writeFileSync(path.join(shotDir, name+'.png'), Buffer.from(r.data,'base64'));
    console.log('shot:', name);
    return path.join(shotDir, name+'.png');
  };
  // wait for app boot
  for(let i=0;i<40;i++){
    const ok=await evalJs('!!(window.__poly && window.__poly.eng && window.__poly.eng.gl)').catch(()=>false);
    if(ok) break;
    await new Promise(r=>setTimeout(r,300));
  }
  const boot=await evalJs('JSON.stringify({gl: !!(window.__poly?.eng?.gl), screen: window.__poly?._screenId})');
  console.log('BOOT:', boot);
  const st=await evalJs('JSON.stringify({poly: typeof window.__poly, err: window.__bootErr, fallbackShown: !document.getElementById("gl-fallback").classList.contains("hidden")})').catch(e=>'err:'+e.message);
  console.log('STATE:', st);
  const ev=await evalJs("const s=document.querySelectorAll('script[src]'); JSON.stringify({count:s.length, srcs:[...s].map(x=>x.src.split('/').pop()), mainLoaded: !!(window.POLY && window.POLY.Battle)})").catch(e=>e.message);
  console.log('SCRIPTS:', ev);
  const ev2=await evalJs("JSON.stringify({invType: typeof POLY.M4.inv, mulP: typeof POLY.M4.mulP})").catch(e=>e.message);
  console.log('M4 EXT:', ev2);
  console.log('EARLY ERRORS:', JSON.stringify(consoleErrors.slice(0,10)));
  await new Promise(r=>setTimeout(r,600));
  await shot('01-title');

  // go to briefing
  await evalJs("window.__poly.ui?.briefing?.()");
  await new Promise(r=>setTimeout(r,300));
  await shot('02-briefing');

  // start battle
  await evalJs("window.__poly.startBattle()");
  await new Promise(r=>setTimeout(r,800));
  await shot('03-board');
  const bstate=await evalJs('JSON.stringify({waves:'+( 'window.__poly.battle?1:0' )+',gold: window.__poly.battle?.gold, lives: window.__poly.battle?.lives, state: window.__poly.battle?.state})');
  console.log('BATTLE:', bstate);
  const rerr=await evalJs('JSON.stringify({renderErr: window.__poly?._screenError ? (window.__poly._screenError.message+"|"+window.__poly._screenError.stack?.split("\\n")[1]) : null, simErr: window.__poly?._simErr ? window.__poly._simErr.message : null, plates: window.__poly?.eng?.plates?.length, cam: JSON.stringify(window.__poly?.cam)})').catch(e=>e.message);
  console.log('RDIAG:', rerr);

  // scripted build: find buildable cells and place towers
  const info = await evalJs('(function(){ const b=window.__poly.battle; if(!b) return null; '+
    'const open=b.cells.filter(c=>!c.path).map(c=>[c.c,c.r]).slice(0,60); return JSON.stringify({open:open}); })()');
  console.log('CELLS:', info);
  const cells=JSON.parse(info||'{"open":[]}');
  await evalJs('window.__poly.battle.gold = 5000; window.__poly.ui.refreshGold(); 1');
  // place towers on cells adjacent to the path
  await evalJs("(function(){ const b=window.__poly.battle; "+
    "const pathCell = (c,r)=>b.cells.find(cl=>cl.c===c&&cl.r===r&&cl.path); "+
    "const adj = []; b.cells.forEach(cl=>{ if(cl.path) return; "+
    "  const near=[ [cl.c-1,cl.r],[cl.c+1,cl.r],[cl.c,cl.r-1],[cl.c,cl.r+1],[cl.c-1,cl.r-1],[cl.c+1,cl.r+1] ]; "+
    "  if(near.some(p=>pathCell(p[0],p[1]))) adj.push(cl); }); "+
    "const order=['bolt','bolt','bolt','cryo','mortar','nullfield','arc','railgun','toxin','pyre']; "+
    "adj.sort((a,b)=>a.z-b.z); "+
    "for(let i=0;i<order.length;i++){ const cl=adj[i%adj.length]; b.place(order[i], cl); } return adj.length; })()");
  await evalJs('(function(){ const b=window.__poly.battle; '+
    'const build=(tid,c,r)=>{ const cl=b.tileAt(c,r); if(cl) b.place(tid, cl); }; '+
    'const order=["bolt","bolt","cryo","bolt","mortar"]; const tries=[[3,1],[5,1],[1,6],[7,6],[4,3],[4,4],[2,5],[6,5]]; '+
    'for(let i=0;i<order.length;i++){ const t=tries[i]; build(order[i], t[0], t[1]); } return 1; })()');
  await new Promise(r=>setTimeout(r,400));
  await shot('04-builds');
  await new Promise(r=>setTimeout(r,700));
  await shot('04b-builds-later');
  // probe what sits near x=+3,z=0
  const probe=await evalJs('JSON.stringify((()=>{ const eng=window.__poly.eng; const out=[]; '+
    'eng.plates.forEach((pl,i)=>{ const m=pl.model; if(!m) return; '+
    ' const dx=m[12], dy=m[13], dz=m[14]; '+
    ' if(Math.abs(dx-3.2)<1.6 && Math.abs(dz-0.4)<1.6 && dy>0.2){ out.push(i+":["+dx.toFixed(1)+","+dy.toFixed(1)+","+dz.toFixed(1)+"] vs:"+pl.mesh.count+" em:"+pl.emis); } }); return out.slice(0,10); })())').catch(e=>e.message);
  console.log('PROBE:', probe);
  const probe2=await evalJs('JSON.stringify((()=>{ const b=window.__poly.battle; const out=[]; '+
    'b.towers.forEach((t,i)=>{ out.push(i+":"+t.id+"@"+t.x.toFixed(1)+","+t.z.toFixed(1)); }); return out; })())').catch(e=>e.message);
  console.log('TOWERS:', probe2);
  const probe3=await evalJs('JSON.stringify((()=>{ const eng=window.__poly.eng; const out=[]; '+
    'eng.plates.forEach((pl,i)=>{ const m=pl.model; if(!m) return; '+
    ' if(pl.mesh.count>=400) out.push(i+":["+m[12].toFixed(1)+","+m[13].toFixed(1)+","+m[14].toFixed(1)+"] vs:"+pl.mesh.count+" em:"+pl.emis+" gl:"+pl.glow); }); return out.slice(0,20); })())').catch(e=>e.message);
  console.log('BIG PLATES:', probe3);
  // zoom to the railgun area and re-shoot
  await evalJs('window.__poly.cam.dist=7; window.__poly.cam.target=[3.8,1.2,-1.8]; window.__poly.cam.pitch=0.42; 1');
  await new Promise(r=>setTimeout(r,700));
  await shot('05-zoom-railgun');
  // list all plates with names/verts near center
  const names=await evalJs('JSON.stringify((()=>{ const eng=window.__poly.eng; const out=[]; '+
    'eng.plates.forEach((pl,i)=>{ if(pl.mesh.__name || pl.mesh.count>400){ '+
    'out.push(i+":"+(pl.mesh.__name||"?")+":vs"+pl.mesh.count); } }); return out.slice(0,40); })())').catch(e=>e.message);
  console.log('NAMED:', names);
  // hide all tower plates
  await evalJs('(function(){ const eng=window.__poly.eng; eng.plates.forEach(pl=>{ if(pl.mesh.__name && pl.mesh.__name.startsWith("tbase_")){ pl.model=POLY.M4.scale(0.001); } }); return 1; })()');
  await new Promise(r=>setTimeout(r,250));
  await shot('05d-no-towers');
  // hide ALL plates without __name (rig parts) too
  await evalJs('(function(){ const eng=window.__poly.eng; eng.plates.forEach(pl=>{ if(!pl.mesh.__name && pl.mesh.count>300){ pl.model=POLY.M4.scale(0.001); } }); return 1; })()');
  await new Promise(r=>setTimeout(r,250));
  await shot('05e-no-unnamed');
  // kill plate 135 (arc at 2.3) and 138 (railgun at 3.5) and re-shoot
  await evalJs('(function(){ const b=window.__poly.battle; b.towers.forEach(t=>{ if(t.id==="arc"||t.id==="railgun"){ t.rig.parts.forEach(p=>{ p.plate.model = POLY.M4.scale(0.001); }); } }); return 1; })()');
  await new Promise(r=>setTimeout(r,300));
  await shot('05b-no-arc-rail');
  // hide core g/halo/orb plates
  await evalJs('(function(){ const b=window.__poly.battle; const core=b.board.core; '+
    'const eng=window.__poly.eng; eng.plates.forEach(p=>{ if(p.emis>=0.5 && p.mesh.count===480){ p.model=POLY.M4.scale(0.001); } }); return 1; })()');
  await new Promise(r=>setTimeout(r,300));
  await shot('05c-no-core');
  const placed=await evalJs('window.__poly.battle.towers.length');
  console.log('towers placed:', placed);

  // demo mode: fast-forward waves with rush
  if(demoMode){
    // let it run; speed up
    await evalJs('window.__poly.speedMul = 4; window.__poly.togglePause && 0;');
    for(let i=0;i<12;i++){
      await evalJs('window.__poly.battle.rush(); 1');
      await new Promise(r=>setTimeout(r,1200));
      const st=await evalJs('JSON.stringify({wave:window.__poly.battle.waveNo, state:window.__poly.battle.state, e:window.__poly.battle.enemies.length, gold:Math.round(window.__poly.battle.gold), lives:window.__poly.battle.lives, k:window.__poly.battle.kills})');
      console.log('t+'+i, st);
      if(i===4||i===8) await shot('0'+ (5+i) +'-wave'+ (i===4?'5':'9'));
      const fin=await evalJs('window.__poly.battle.state');
      if(fin==='won'||fin==='lost'){ console.log('END:', fin); break; }
    }
    await new Promise(r=>setTimeout(r,600));
    await shot('99-end');
  }
  console.log('CONSOLE ERRORS:', JSON.stringify(consoleErrors.slice(0,10)));
  ws.close();
  chrome.kill();
  process.exit(consoleErrors.length?1:0);
}
main().catch(e=>{ console.error('HARNESS FAIL', e); process.exit(1); });
