/* ==========================================================================
   POLY PROTOCOL — art.js
   The painted world. Everything here is generated at load: a vaporwave
   brushwork skybox, painted particle brushes, rune glyphs. No assets.
   ========================================================================== */
'use strict';
(() => {

const C = {
  void:'#0a0e17', void2:'#0d1420', cyan:'#38e8ff', magenta:'#ff2fd6',
  violet:'#a855f7', gold:'#fbbf24', crimson:'#ef4444', lime:'#a3e635',
  chrome:'#94a3b8', chDark:'#1e293b', chMid:'#475569', ink:'#e8f1fb',
  skyTop:'#05060e', skyHi:'#1c0f2e', skyLo:'#3d1032', skyHot:'#b31b62',
  sun:'#ff2fd6', sunCore:'#ffd6f5', horizon:'#e7529a', far:'#8a2d6a'
};

function hex(h){ const n=parseInt(h.slice(1),16); return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]; }
function mix(a,b,t){ return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]; }
function jitter(col, amt){ const t=(Math.random()-0.5)*amt;
  return [Math.max(0,col[0]+t),Math.max(0,col[1]+t),Math.max(0,col[2]+t)]; }
function rgb(c, a){ return 'rgba(' + Math.round(c[0]*255) + ',' + Math.round(c[1]*255) + ',' + Math.round(c[2]*255) + ',' + (a??1) + ')'; }

/* painterly helpers on 2D canvas */
function dab(g, x,y, r, colr, alpha, rot){
  g.save(); g.translate(x,y); g.rotate(rot||0);
  g.scale(1, 0.55+Math.random()*0.5);
  const gr=g.createRadialGradient(0,0,0, 0,0,r);
  gr.addColorStop(0, rgb(colr, alpha));
  gr.addColorStop(0.75, rgb(colr, alpha*0.85));
  gr.addColorStop(1, rgb(colr, 0));
  g.fillStyle=gr;
  g.beginPath(); g.arc(0,0,r,0,7); g.fill();
  g.restore();
}
function stroke(g, x0,y0,x1,y1, width, colr, alpha, segs){
  const n=segs||5;
  for(let i=0;i<=n;i++){
    const t=i/n;
    dab(g, x0+(x1-x0)*t + (Math.random()-0.5)*2, y0+(y1-y0)*t + (Math.random()-0.5)*2,
      width*(0.7+Math.random()*0.5), colr, alpha, Math.atan2(y1-y0,x1-x0));
  }
}
function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296; }; }

/* the skybox. Neon Reliquary register: night-to-magenta gradient, ringed
   sun, brush clouds, engraved ridge silhouettes with neon seams. */
function paintSkyFace(w,h, seed, opts){
  opts=opts||{};
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const g=c.getContext('2d');
  const R=mulberry(seed);
  const gr=g.createLinearGradient(0,0,0,h);
  gr.addColorStop(0,'#0a0a18'); gr.addColorStop(0.38,'#2a1140');
  gr.addColorStop(0.58,'#5c1a55'); gr.addColorStop(0.74,'#a6306e');
  gr.addColorStop(0.9,'#e0447c'); gr.addColorStop(1,'#f06a92');
  g.fillStyle=gr; g.fillRect(0,0,w,h);
  g.fillStyle='#cfe7ff';
  for(let i=0;i<90;i++){
    const x=R()*w, y=R()*h*0.5;
    g.globalAlpha=R()*0.6;
    g.fillRect(x,y, R()<0.12?2:1, R()<0.12?2:1);
  }
  g.globalAlpha=1;
  for(let i=0;i<34;i++){
    const y=h*(0.35+R()*0.5), x=R()*w;
    const hot=mix(hex(C.skyHot),hex(C.magenta),R()*0.5);
    stroke(g, x-w*0.2,y, x+w*0.2, y+(R()-0.5)*h*0.2, 20+R()*34, hot, 0.05+R()*0.06, 8);
  }
  if(opts.sun!==false){
    // ONE soft glow sun low on the horizon — never white, never hard-edged
    const cx=w*(0.5+(R()-0.5)*0.24), cy=h*0.78, r=h*0.16;
    for(let i=5;i>0;i--){ dab(g,cx,cy, r*(1+i*0.24), hex(C.sun), 0.02, 0.3); }
    dab(g,cx,cy,r*1.04,hex(C.sun),0.22,0.2);
    dab(g,cx,cy,r*0.72,hex(C.sunCore),0.34,0.2);
  }
  if(opts.ridges!==false){
    for(let band=3;band>=1;band--){
      const base=h*(0.82+band*0.045);
      g.fillStyle=band===3?C.void2:'#150a1e';
      g.beginPath(); g.moveTo(0,h);
      let y=base;
      const step= w/(14+band*6);
      for(let x=0;x<=w;x+=step){
        y=base - (Math.sin(x*0.01*(1+band)+band*7)*8 + R()*10) * (0.5+band*0.35);
        if(R()<0.05*(1.4-band*0.3)) y-=26+R()*44;
        g.lineTo(x,y);
      }
      g.lineTo(w,h); g.closePath(); g.fill();
      g.strokeStyle=band===1?'rgba(56,232,255,0.5)':'rgba(255,47,214,0.4)';
      g.lineWidth=1.5+band;
      g.beginPath(); g.moveTo(0,0);
      for(let x=0;x<w;x+=4){
        const yy = h*(0.80+band*0.045) - Math.abs(Math.sin(x*0.007*(1+band)))*14;
        g.lineTo(x, yy);
      }
      g.stroke();
    }
  }
  for(let i=0;i<26;i++){
    const x=R()*w, y=R()*h;
    g.fillStyle='rgba(255,120,200,'+(0.015+R()*0.03)+')';
    g.fillRect(x,y, 1+R()*2, 30+R()*120);
  }
  return c;
}

function makeSkyTexture(gl){
  const S=512;
  const sideTop=paintSkyFace(S,S,11,{sun:false,ridges:false});
  const sideBot=(()=>{ const c=document.createElement('canvas'); c.width=S;c.height=S;
    const g=c.getContext('2d'); const gr=g.createLinearGradient(0,0,0,S);
    gr.addColorStop(0,'#0a0512'); gr.addColorStop(1,'#03040a');
    g.fillStyle=gr; g.fillRect(0,0,S,S);
    for(let i=0;i<70;i++){ dab(g, Math.random()*S, Math.random()*S*0.5, 14+Math.random()*30,
      hex('#2a0d33'), 0.05+Math.random()*0.05, 0.4); }
    return c; })();
  const faces=[
    paintSkyFace(S,S,13,{sun:true,ridges:true}),
    paintSkyFace(S,S,21,{sun:false,ridges:true}),
    sideTop,
    sideBot,
    paintSkyFace(S,S,12,{sun:true,ridges:true}),
    paintSkyFace(S,S,31,{sun:false,ridges:true}) ];
  const tex=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP,tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  for(let i=0;i<6;i++){
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X+i,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,faces[i]);
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  return {tex, faces};
}

function makeSpriteBrush(gl){
  const mk=(kind)=>{
    const s=128, c=document.createElement('canvas'); c.width=s; c.height=s;
    const g=c.getContext('2d');
    const gr=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
    if(kind===0){ gr.addColorStop(0,'rgba(255,255,255,1)');
      gr.addColorStop(0.25,'rgba(255,255,255,0.6)');
      gr.addColorStop(0.6,'rgba(255,255,255,0.12)');
      gr.addColorStop(1,'rgba(255,255,255,0)'); }
    else { gr.addColorStop(0,'rgba(255,255,255,1)');
      gr.addColorStop(0.1,'rgba(255,255,255,0.9)');
      gr.addColorStop(0.4,'rgba(255,255,255,0.05)');
      gr.addColorStop(1,'rgba(255,255,255,0)'); }
    g.fillStyle=gr; g.fillRect(0,0,s,s);
    if(kind===1){
      g.strokeStyle='rgba(255,255,255,0.9)'; g.lineWidth=3;
      g.beginPath(); g.arc(s/2,s/2,s*0.42,0,7); g.stroke();
    }
    const tex=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    return tex;
  };
  return { soft: mk(0), ring: mk(1) };
}

POLY.PAINT = { C, hex, mix, jitter, dab, stroke, paintSkyFace, mulberry,
  makeSkyTexture, makeSpriteBrush };
})();
