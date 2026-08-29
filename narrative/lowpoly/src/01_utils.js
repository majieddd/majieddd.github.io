/* 01 utils. Deterministic, no DOM, no side effects. */
(function(){
  const LP=window.LP;
  // 32-bit FNV-1a (matches Cosmic Conquest's FNV choice in BRAND.md / docs/HANDOVER).
  function fnv1a(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}return h>>>0;}
  // Mulberry32 PRNG. Deterministic and tiny.
  function mulberry32(seed){let a=seed>>>0;return function(){
    a|=0; a=(a+0x6D2B79F5)|0;
    let t=Math.imul(a^(a>>>15),1|a);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296;
  };}
  LP.fnv1a=fnv1a; LP.rngOf=function(s){return mulberry32(fnv1a(s));};
  LP.fmtTime=function(s){s=Math.max(0,Math.ceil(s));const m=Math.floor(s/60),x=s%60;return m+":"+(x<10?"0"+x:x);};
  LP.fmtInt=function(n){n=Math.round(n);return n<0?"-"+(LP.fmtInt(-n)):n<1000?""+n:n<1e6?(n/1e3).toFixed(1)+"k":(n/1e6).toFixed(2)+"M";};
  LP.clamp=(x,a,b)=>x<a?a:x>b?b:x;
  LP.lerp=(a,b,t)=>a+(b-a)*t;
  LP.smooth=(e)=>e*e*(3-2*e);
  // Colour helpers (rgb<->hex<->rgba strings).
  LP.hex=(h)=>{h=h.replace("#","");if(h.length===3)h=h.split("").map(c=>c+c).join("");return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];};
  LP.rgb=(r,g,b)=>"rgb("+r+","+g+","+b+")";
  LP.rgba=(r,g,b,a)=>"rgba("+r+","+g+","+b+","+a+")";
  LP.mix=(c1,c2,t)=>{const a=LP.hex(c1),b=LP.hex(c2);return LP.rgb(Math.round(LP.lerp(a[0],b[0],t)),Math.round(LP.lerp(a[1],b[1],t)),Math.round(LP.lerp(a[2],b[2],t)));};
  LP.shade=(c,t)=>LP.mix("#000000",c,t);
  LP.tint=(c,t)=>LP.mix("#ffffff",c,t);
  // 2D vector helpers
  LP.v2=(x,y)=>({x,y});
  LP.v2copy=(v)=>({x:v.x,y:v.y});
  LP.v2add=(a,b)=>({x:a.x+b.x,y:a.y+b.y});
  LP.v2sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
  LP.v2len=(a)=>Math.hypot(a.x,a.y);
  LP.v2norm=(a)=>{const l=Math.hypot(a.x,a.y)||1;return {x:a.x/l,y:a.y/l};};
  LP.v2dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  LP.v2lerp=(a,b,t)=>({x:LP.lerp(a.x,b.x,t),y:LP.lerp(a.y,b.y,t)});
  // Cache-friendly polygon centroid
  LP.centroid=(pts)=>{let x=0,y=0;for(const p of pts){x+=p.x;y+=p.y;}return {x:x/pts.length,y:y/pts.length};};
  // Cheap value noise for ground texture (1D, used for height variance)
  LP.hash1d=(n)=>{let x=Math.sin(n*127.1)*43758.5453;return x-Math.floor(x);};
  LP.noise2d=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y);
    const xf=x-xi,yf=y-yi;
    const a=LP.hash1d(xi+yi*57);
    const b=LP.hash1d(xi+1+yi*57);
    const c=LP.hash1d(xi+(yi+1)*57);
    const d=LP.hash1d(xi+1+(yi+1)*57);
    const u=LP.smooth(xf),v=LP.smooth(yf);
    return LP.lerp(LP.lerp(a,b,u),LP.lerp(c,d,u),v);
  };
  // Tweening (eases).
  LP.ease={inQuad:t=>t*t,outQuad:t=>1-(1-t)*(1-t),inOutQuad:t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2,
    outCubic:t=>1-Math.pow(1-t,3),outBack:t=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);},
    outElastic:t=>{if(t===0||t===1)return t;const c4=(2*Math.PI)/3;return Math.pow(2,-10*t)*Math.sin((t*10-0.75)*c4)+1;}};
  // Mulberry32 seeded array picker.
  LP.rngPick=(rng,arr)=>arr[Math.floor(rng()*arr.length)];
  LP.rngRange=(rng,a,b)=>LP.lerp(a,b,rng());
  // Color palette for Neon Reliquary (factions).
  LP.PAL={
    void:"#0a0e17", void2:"#070a10",
    ink:"#e2e8f0", dim:"#94a3b8", chrome:"#cbd5e1", slate:"#475569",
    cyan:"#38e8ff", steel:"#5fbfd1", blue:"#3b82f6",
    gold:"#fbbf24", ivory:"#fde68a", sun:"#f59e0b",
    violet:"#7c3aed", plum:"#a855f7", magenta:"#ff2fd6",
    crimson:"#ef4444", rust:"#b91c1c", ember:"#fb923c",
    mint:"#34d399", earth:"#a16207",
    hp:"#fbbf24", hpBg:"#0a0e17", ok:"#22c55e"
  };
  // Faction palettes. Each carries 5 swatches: light, mid, deep, accent, ink.
  LP.FAC={
    human:    {name:"HUMANITY",       light:"#9be8ff", mid:"#38e8ff", deep:"#155e75", accent:"#ffffff", ink:"#e0fbff", em:"#0ea5e9"},
    light:    {name:"FEDERATION",     light:"#fef3c7", mid:"#fbbf24", deep:"#92400e", accent:"#fffbeb", ink:"#fff7d6", em:"#fde68a"},
    xeno:     {name:"THE XENO",       light:"#c4b5fd", mid:"#7c3aed", deep:"#3b0764", accent:"#ff2fd6", ink:"#f5d0fe", em:"#a855f7"},
    pirate:   {name:"THE PIRATES",    light:"#fecaca", mid:"#ef4444", deep:"#7f1d1d", accent:"#fb923c", ink:"#fee2e2", em:"#dc2626"},
    parallel: {name:"THE PARALLEL",   light:"#e2e8f0", mid:"#94a3b8", deep:"#1e293b", accent:"#5eead4", ink:"#f1f5f9", em:"#5eead4"}
  };
})();
