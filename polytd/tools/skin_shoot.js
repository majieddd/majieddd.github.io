
'use strict';
const http=require('http'), fs=require('fs'), path=require('path');
const { spawn }=require('child_process');
const ROOT=path.resolve(__dirname,'..'); const PORT=8481;
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.bin':'application/octet-stream','.json':'application/json'};
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/skin-test.html';
  const fp=path.join(ROOT,p.replace(/^\//,''));
  if(!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(fp)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(fp).pipe(res);
}).listen(PORT);
async function main(){
  const userDir=path.join(process.env.TEMP,'skin-'+Date.now());
  const dbg=9333+process.pid%100;
  const chrome=spawn(CHROME,['--headless=new','--disable-gpu','--enable-unsafe-swiftshader','--remote-debugging-port='+dbg,'--window-size=1400,900','--user-data-dir='+userDir,'--no-first-run','--mute-audio','http://127.0.0.1:'+PORT+'/skin-test.html'],{stdio:'ignore'});
  await new Promise(r=>setTimeout(r,2600));
  let targets;
  for(let i=0;i<20;i++){ try{ targets=await (await fetch('http://127.0.0.1:'+dbg+'/json/list')).json(); if(targets.some(x=>x.type==='page'))break; }catch(e){}
    await new Promise(r=>setTimeout(r,400)); }
  const page=targets.find(x=>x.type==='page' && x.url.includes('8481')) || targets.find(x=>x.type==='page');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  let idc=0; const pend=new Map();
  ws.onmessage=(ev)=>{ const m=JSON.parse(ev.data); if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id); if(m.error)p.rej(new Error(m.error.message));else p.res(m.result);} };
  await new Promise(r=>ws.onopen=r);
  const send=(method,params={})=>new Promise((res,rej)=>{ const id=++idc; pend.set(id,{res,rej}); ws.send(JSON.stringify({id,method,params})); });
  await send('Runtime.enable'); await send('Page.enable');
  const consoleMsgs=[];
  ws.addEventListener('message', (ev)=>{
    try{
      const m=JSON.parse(ev.data);
      if(m.method==='Runtime.consoleAPICalled'){ consoleMsgs.push(m.params.type+': '+m.params.args.map(a=>a.value??a.description).join(' ')); }
      if(m.method==='Runtime.exceptionThrown'){ consoleMsgs.push('EXC: '+(m.params.exceptionDetails.exception?.description||JSON.stringify(m.params.exceptionDetails||{}).slice(0,300))); }
    }catch(e){}
  });
  const ev=async (expr)=>{ const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true}); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description||'eval fail'); return r.result.value; };
  for(let i=0;i<40;i++){ if(await ev('!!window.__testReady').catch(()=>false)) break; await new Promise(r=>setTimeout(r,300)); }
  await new Promise(r=>setTimeout(r,1500));
  const shot=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync('D:/DeepseekHarness/states/skin-test.png', Buffer.from(shot.data,'base64'));
  await send('Page.reload');
  await new Promise(r=>setTimeout(r,1600));
  for(let i=0;i<40;i++){ if(await ev('!!window.__testReady').catch(()=>false)) break; await new Promise(r=>setTimeout(r,300)); }
  await new Promise(r=>setTimeout(r,1200));
  for(let k=0;k<5;k++){
    await ev('(function(){ const u=window.__unit; if(u){ u.time='+k+'/30*4; u.update(0); } return 1; })()');
    await new Promise(r=>setTimeout(r,220));
    const s25=await send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('D:/DeepseekHarness/states/walk'+k+'.png', Buffer.from(s25.data,'base64'));
  }
  const dbgI=await ev('(function(){ return JSON.stringify({ready:window.__testReady||null, dbg:window.__dbg||null, w:window.innerWidth, h:window.innerHeight}); })()');
  console.log('SKIN TEST PAGE:', (()=>{try{return page.url}catch(e){return '?'}})());
  console.log('SKIN TEST READY, dbg:', dbgI);
  const errs=await ev('window.__consoleErrs||[]');
  console.log('SKIN TEST READY, ercnt:', JSON.stringify(errs));
  console.log('CONSOLE MSGS:', JSON.stringify(consoleMsgs.slice(0,12)));
  ws.close(); chrome.kill(); process.exit(0);
}
main().catch(e=>{ console.error('FAIL',e); process.exit(1); });
