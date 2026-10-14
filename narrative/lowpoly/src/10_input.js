/* 10 input. Mouse + keyboard. The hover state drives placement, the hotkeys
   pick a tower preset, and P/Space/H cover pause, speed, help. */
(function(){
  const LP=window.LP, Art=LP.Art, Map=LP.Map;
  const G=LP.G, Audio=LP.Audio, Data=LP.Data;

  // Hover: project mouse to world. We use the same camera and back-solve.
  function onMove(e){
    const rect=LP.Render.canvas.getBoundingClientRect();
    const sx=e.clientX-rect.left, sy=e.clientY-rect.top;
    // Inverse iso: given (sx,sy), find (x,z) at y=0.
    // sx = (x - z)*ISO_COS*scale + cam.sx
    // sy = (x + z)*ISO_SIN*scale + cam.sy
    const c=LP.Render.cam;
    const a=(sx-c.sx)/(Art.ISO_COS*c.scale);
    const b=(sy-c.sy)/(Art.ISO_SIN*c.scale);
    const x=(a+b)/2, z=(b-a)/2;
    const T=LP.TILE;
    const tx=Math.floor(x/T), tz=Math.floor(z/T);
    if(tx<0||tz<0||tx>=G.maskW||tz>=G.maskH){LP.hover=null; return;}
    const buildable=!!G.mask[tz*G.maskW+tx];
    LP.hover={tx,tz,buildable};
  }
  function onClick(e){
    if(G.status!=="play")return;
    if(!LP.hover)return;
    // If a tower is already selected (sell mode?), right-click acts as deselect.
    if(e.button===2){
      G._selTower=null; G.selected=null; return;
    }
    // If clicking on an existing tower, select it (so U/S works)
    const T=LP.TILE; const wx=LP.hover.tx*T+T/2, wz=LP.hover.tz*T+T/2;
    const ex=G.towers.find(t=>Math.hypot(t.x-wx,t.z-wz)<T*0.55);
    if(ex){
      G._selTower=ex; G.selected=null; return;
    }
    if(!G.selected)return;
    if(!LP.hover.buildable){ UI.toast("Path is blocked"); return; }
    LP.Actions.placeTower(LP.hover.tx,LP.hover.tz);
  }
  function onKey(e){
    if(e.repeat)return;
    const k=e.key.toLowerCase();
    if(k>="1"&&k<="8"){
      const t=Data.TOWERS[parseInt(k,10)-1];
      if(t){G.selected=t.preset.id; Audio.click();}
      e.preventDefault(); return;
    }
    if(k==="u"){ LP.Actions.upgradeSelected(); e.preventDefault(); return; }
    if(k==="s"){ LP.Actions.sellSelected(); e.preventDefault(); return; }
    if(k==="p"){ togglePause(); e.preventDefault(); return; }
    if(k===" "){ cycleSpeed(); e.preventDefault(); return; }
    if(k==="h"){ toggleHelp(); e.preventDefault(); return; }
    if(k==="escape"){ G.selected=null; G._selTower=null; e.preventDefault(); return; }
  }
  function togglePause(){
    G.paused=!G.paused;
    document.getElementById("pause").classList.toggle("show",G.paused);
    Audio.click();
  }
  function cycleSpeed(){
    G.speed = G.speed===1? 2 : G.speed===2? 3 : 1;
    document.getElementById("btnSpeed").textContent="x"+G.speed;
    Audio.click();
  }
  function toggleHelp(){
    const el=document.getElementById("help");
    el.style.display = el.style.display==="none"||!el.style.display? "block":"none";
    Audio.click();
  }

  LP.Render.canvas.addEventListener("contextmenu",e=>e.preventDefault());
  LP.Render.canvas.addEventListener("mousemove",onMove);
  LP.Render.canvas.addEventListener("mousedown",onClick);
  LP.Render.canvas.addEventListener("touchstart",e=>{
    if(e.touches.length===1){
      const t=e.touches[0];
      onMove(t); onClick({clientX:t.clientX,clientY:t.clientY,button:0});
    }
  },{passive:true});
  window.addEventListener("keydown",onKey);
  // Top bar buttons
  document.getElementById("btnPause").addEventListener("click",togglePause);
  document.getElementById("btnSpeed").addEventListener("click",cycleSpeed);
  document.getElementById("btnHelp").addEventListener("click",toggleHelp);
  LP.Input={onMove,onClick};
})();
