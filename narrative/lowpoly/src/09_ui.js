/* 09 ui. Builds the dock cards, topbar, banner chips; wires toast/end modal.
   Listens to LP.G and LP.Actions; no logic of its own. */
(function(){
  const LP=window.LP, Data=LP.Data, FAC=LP.FAC, Art=LP.Art;
  const G=LP.G;
  // Use the IIFE scope, not window.Audio (which is the HTMLMediaElement
  // constructor in the browser : calling .uiOpen on it would throw).
  const Audio=LP.Audio;
  const clamp=LP.clamp, lerp=LP.lerp;
  // Use the UI namespace the game module reserved
  const UI=LP.UI;
  const els={};
  function $(id){return document.getElementById(id);}

  function buildDock(){
    const host=$("towers");
    host.innerHTML="";
    for(const t of Data.TOWERS){
      const div=document.createElement("div");
      div.className="tcard";
      div.dataset.key=t.key;
      div.innerHTML=`
        <div class="row">
          <span class="key">${t.key}</span>
          <span class="nm">${t.name}</span>
        </div>
        <div class="cost">${t.preset.cost}</div>`;
      div.title=t.blurb+" ("+t.tag+")";
      div.addEventListener("click",()=>{UI.selectTower(t.preset.id); Audio.click();});
      host.appendChild(div);
      t._el=div;
    }
  }
  function buildBanner(){
    const host=$("banner");
    host.innerHTML="";
    for(const f of Data.FACTIONS){
      const c=document.createElement("div");
      c.className="chip";
      c.style.borderColor=LP.mix(f.accent,"#000000",0.4);
      c.style.color=LP.mix(f.accent,"#ffffff",0.4);
      c.dataset.fac=f.id;
      c.textContent=f.name;
      c.addEventListener("click",()=>{LP.Actions.setFaction(f.id); refreshBanner(); Audio.click();});
      host.appendChild(c);
    }
    refreshBanner();
  }
  function refreshBanner(){
    for(const c of document.querySelectorAll("#banner .chip")){
      c.classList.toggle("on", c.dataset.fac===G.faction);
    }
  }
  function updateHUD(){
    if(!G.map)return;
    $("tbFaction").textContent = (FAC[G.faction]||FAC.human).name;
    $("tbMap").textContent = G.map.name;
    $("tbWave").textContent = Math.min(G.wave+1,Data.WAVES.length)+" / "+Data.WAVES.length;
    $("vGold").textContent = LP.fmtInt(G.gold);
    $("vLives").textContent = G.lives;
    $("vScore").textContent = LP.fmtInt(G.score);
    const rem = G.wavePending? 0 : Math.max(0,G.between);
    $("vNext").textContent = LP.fmtTime(rem);
    const total = Data.WAVES.length;
    const prog = (G.wave + (G.wavePending? G.waveT/15 : 0)) / total;
    $("progFill").style.width = clamp(prog*100,0,100)+"%";
    // dock afford
    for(const t of Data.TOWERS){
      t._el.classList.toggle("afford", G.gold>=t.preset.cost);
      t._el.classList.toggle("sel", G.selected===t.preset.id);
    }
  }
  function selectTower(id){
    G.selected = (G.selected===id)? null : id;
  }
  let toastTimer=null;
  function toast(msg){
    const el=$("toast"); el.textContent=msg; el.classList.add("show");
    if(toastTimer)clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>{el.classList.remove("show");},1500);
  }
  function showEnd(kind){
    Audio.uiOpen();
    const root=document.createElement("div");
    root.className="modal";
    const isWin=kind==="win";
    root.innerHTML=`
      <div class="card">
        <h${isWin?1:3}>${isWin?"VICTORY":"DEFEAT"}</h${isWin?1:3}>
        <p class="sub">${isWin?"The Core held through all 12 waves.":"The Core has fallen."}</p>
        <div class="meta">
          <div class="cell g"><div class="lbl">CREDITS BANKED</div><div class="val">${LP.fmtInt(G.gold)}</div></div>
          <div class="cell k"><div class="lbl">KILLS</div><div class="val">${G.kills}</div></div>
          <div class="cell s"><div class="lbl">SCORE</div><div class="val">${LP.fmtInt(G.score)}</div></div>
        </div>
        <div class="row">
          <button class="pri" id="endAgain">PLAY AGAIN</button>
          <button id="endClose">BACK TO INTRO</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    root.querySelector("#endAgain").addEventListener("click",()=>{
      root.remove();
      LP.Actions.loadMap(G.map.id);
      Audio.uiClose();
    });
    root.querySelector("#endClose").addEventListener("click",()=>{
      root.remove();
      // Reset the game so the user can pick a fresh map/faction.
      LP.Actions.loadMap(G.map.id);
      showIntro();
      Audio.uiClose();
    });
  }
  function showIntro(){
    Audio.uiOpen();
    const root=document.createElement("div");
    root.className="modal";
    root.innerHTML=`
      <div class="card">
        <h1>COSMIC CONQUEST</h1>
        <p class="sub">LOW-POLY TOWER DEFENSE &middot; A NEON RELIQUARY DEMO</p>
        <p style="color:var(--dim);font-size:13px;margin:0 0 14px;position:relative">Choose your faction, then a map. Build towers, hold the Core, survive 12 waves. Every art asset is procedural, every sound is synthesised, every mesh is hand-rolled low-poly in the same illustrative language as Cosmic Conquest.</p>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:14px 0;position:relative" id="introFac"></div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:6px 0 18px;position:relative" id="introMaps"></div>
        <div class="row">
          <button class="pri" id="introStart">DEPLOY</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    const facHost=root.querySelector("#introFac");
    let chosenFac=G.faction;
    for(const f of Data.FACTIONS){
      const b=document.createElement("button");
      b.style.borderColor=LP.mix(f.accent,"#000000",0.4);
      b.style.color=LP.mix(f.accent,"#ffffff",0.4);
      b.style.fontSize="11px";b.style.letterSpacing=".06em";
      b.textContent=f.name;
      b.dataset.fac=f.id;
      b.addEventListener("click",()=>{
        chosenFac=f.id; for(const c of facHost.children) c.setAttribute("aria-pressed","false");
        b.setAttribute("aria-pressed","true"); LP.Actions.setFaction(f.id); Audio.click();
      });
      facHost.appendChild(b);
    }
    const mapHost=root.querySelector("#introMaps");
    let chosenMap="open";
    for(const m of Data.MAPS){
      const b=document.createElement("button");
      b.textContent=m.name;
      b.title=m.desc;
      b.dataset.map=m.id;
      b.addEventListener("click",()=>{
        chosenMap=m.id; for(const c of mapHost.children) c.setAttribute("aria-pressed","false");
        b.setAttribute("aria-pressed","true"); Audio.click();
      });
      mapHost.appendChild(b);
    }
    root.querySelector("#introStart").addEventListener("click",()=>{
      root.remove(); LP.Actions.loadMap(chosenMap); Audio.uiClose();
    });
  }
  UI.buildDock=buildDock; UI.buildBanner=buildBanner; UI.updateHUD=updateHUD;
  UI.selectTower=selectTower; UI.toast=toast; UI.showEnd=showEnd; UI.showIntro=showIntro;
  // Initial build once at module load
  buildDock();
  buildBanner();
  updateHUD();
})();
