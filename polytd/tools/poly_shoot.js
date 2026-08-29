'use strict';
const http=require('http'); const fs=require('fs'); const path=require('path');
const { spawn }=require('child_process');
const ROOT=path.resolve(__dirname,'..'); const PORT=8477;
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html';
  const fp=path.join(ROOT,p.replace(/^\//,''));
  if(!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(fp).pipe(res);
}).listen(PORT);

const PAGESCRIPT = "(async ()=>{\n  const A=window.__poly;\n  const S='STATEHERE';\n  if(S==='title'){ return 't'; }\n  A.ui.briefing();\n  await new Promise(r=>setTimeout(r,250));\n  if(S==='briefing') return 'b';\n  A.mapId=(window.__mapSel||'orrery'); A.startBattle();\n  const b=A.battle;\n  b.gold=9000; A.ui.refreshGold();\n  (function(){\n    const pathCell=(c,r)=>b.cells.find(cl=>cl.c===c&&cl.r===r&&cl.path);\n    const adj=[]; b.cells.forEach(cl=>{ if(cl.path)return;\n      const n=[[cl.c-1,cl.r],[cl.c+1,cl.r],[cl.c,cl.r-1],[cl.c,cl.r+1],[cl.c-1,cl.r-1],[cl.c+1,cl.r+1]];\n      if(n.some(p=>pathCell(p[0],p[1]))) adj.push(cl); });\n    adj.sort((a,b2)=>Math.abs(a.z-0.2)-Math.abs(b2.z-0.2));\n    const loadout=['bolt','cryo','bolt','mortar','arc','toxin','pyre','nullfield','railgun'];\n    loadout.forEach((tid,i)=>{ const cl=adj[i%adj.length]; if(cl && POLY.DATA.TOWERS[tid]) b.place(tid, cl); });\n  })();\n  A.cam.yaw=0; A.cam.pitch=0.66; A.cam.dist=16.5; A.cam.target=[0,0.8,0.6];\n  A.speedMul=1;\n  if(S==='built'){ return 'built'; }\n  b.beginNext();\n  if(S==='wave1'){\n    let t=0; while(t<1.4 && b.state!=='lost'){ await new Promise(r=>setTimeout(r,100)); t+=0.1; }\n    return 'wave1';\n  }\n  A.speedMul=4;\n  let guard=0;\n  while(b.waveNo<5 && b.state==='wave' && guard<140){ await new Promise(r=>setTimeout(r,200)); guard++; }\n  return b.state==='wave'?'wave5':'end';\n})()";

async function main(){
  const state=process.argv[2]||'board'; const out=process.argv[3]||'state.png';
  const userDir=path.join(process.env.TEMP,'poly-shot-'+Date.now());
  const dbg=(9333+process.pid%100);
  const chrome=spawn(CHROME,['--headless=new','--disable-gpu','--enable-unsafe-swiftshader',
    '--remote-debugging-port='+dbg,'--window-size=1600,900','--user-data-dir='+userDir,
    '--no-first-run','--mute-audio','http://127.0.0.1:'+PORT+'/index.html'],{stdio:'ignore'});
  await new Promise(r=>setTimeout(r,2600));
  let targets;
  for(let i=0;i<20;i++){ try{ targets=await (await fetch('http://127.0.0.1:'+dbg+'/json/list')).json();
    if(targets.some(x=>x.type==='page'))break; }catch(e){}
    await new Promise(r=>setTimeout(r,400)); }
  const page=targets.find(x=>x.type==='page'&&x.url.indexOf('8477')>=0)||targets.find(x=>x.type==='page');
  if(!page){ console.error('NO PAGE'); process.exit(2); }
  console.log('PAGE URL:', page.url);
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  let idc=0; const pend=new Map();
  ws.onmessage=(ev)=>{ const m=JSON.parse(ev.data);
    if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);
      if(m.error)p.rej(new Error(m.error.message));else p.res(m.result);} };
  await new Promise(r=>ws.onopen=r);
  const send=(method,params={})=>new Promise((res,rej)=>{ const id=++idc;
    pend.set(id,{res,rej}); ws.send(JSON.stringify({id,method,params})); });
  await send('Runtime.enable'); await send('Page.enable');
  const ev=async (expr)=>{ const r=await send('Runtime.evaluate',
    {expression:expr,awaitPromise:true,returnByValue:true});
    if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description||'eval fail');
    return r.result.value; };
  for(let i=0;i<40;i++){ if(await ev('!!(window.__poly && window.__poly.eng && window.__poly.eng.gl)').catch(()=>false)) break;
    await new Promise(r=>setTimeout(r,300)); }
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  await ev((process.env.POLYTDMAP?('window.__mapSel='+JSON.stringify(process.env.POLYTDMAP)+';1'):'1'));
  const script='eval(atob("'+Buffer.from(PAGESCRIPT.replace('STATEHERE',state),'utf8').toString('base64')+'"))';
  let result='';
  try{ result=await ev(script); }catch(e){ result='ER:'+e.message; }
  await sleep(600);
  if(process.argv[4]==='zoom'){
    await ev('(function(){ const A=window.__poly; A.cam.dist=7.5; A.cam.pitch=0.55; A.cam.target=[0.2,0.4,-1.8]; return 1; })()');
    await sleep(500);
  }
  if(process.argv[4]==='slices15'){
    for(let gidx=0; gidx<9; gidx++){
      await ev('(function(){ const eng=window.__poly.eng; for(let i=0;i<eng.plates.length;i++){ eng.plates[i].model=(Math.floor(i/15)===('+gidx+')) ? POLY.M4.scale(0.001) : POLY.M4.ident(); } return 1; })()');
      await sleep(160);
      const s21=await send('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync('D:/DeepseekHarness/states/g'+gidx+'.png', Buffer.from(s21.data,'base64'));
    }
    console.log('SLICES15 DONE');
  }
  const shot=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(out, Buffer.from(shot.data,'base64'));
  console.log('STATE: '+result+' -> '+out);
  ws.close(); chrome.kill();
  process.exit(0);
}
main().catch(e=>{ console.error('FAIL',e); process.exit(1); });