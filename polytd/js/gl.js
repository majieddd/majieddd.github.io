/* ==========================================================================
   POLY PROTOCOL — engine.js
   Custom WebGL2 micro-engine: the painterly pipeline.
   Flat-shaded toon bands + fresnel rim + fog give the *Neon Reliquary*
   wet-oil register on low-poly geometry; a post pass adds ink outlines,
   posterized paint quantization, dither, grain and vignette.
   ========================================================================== */
'use strict';
window.POLY = window.POLY || {};
(() => {

/* ── tiny vector / matrix math ─────────────────────────────────────── */
const M4 = {
  ident(){ const m = new Float32Array(16); m[0]=m[5]=m[10]=m[15]=1; return m; },
  mul(a,b){ const o = new Float32Array(16);
    for(let r=0;r<4;r++) for(let c=0;c<4;c++){
      let s=0; for(let k=0;k<4;k++) s+=a[k*4+r]*b[c*4+k]; o[c*4+r]=s; }
    return o; },
  persp(fovy,aspect,n,f){ const t=1/Math.tan(fovy/2), o=new Float32Array(16);
    o[0]=t/aspect; o[5]=t; o[10]=(f+n)/(n-f); o[11]=-1; o[14]=2*f*n/(n-f); return o; },
  lookAt(eye,tgt,up){ let z=[eye[0]-tgt[0],eye[1]-tgt[1],eye[2]-tgt[2]];
    let l=Math.hypot(...z); z=z.map(v=>v/l);
    let x=[up[1]*z[2]-up[2]*z[1], up[2]*z[0]-up[0]*z[2], up[0]*z[1]-up[1]*z[0]];
    l=Math.hypot(...x)||1; x=x.map(v=>v/l);
    const y=[z[1]*x[2]-z[2]*x[1], z[2]*x[0]-z[0]*x[2], z[0]*x[1]-z[1]*x[0]];
    return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
      -(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2]),
      -(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2]),
      -(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]),1]); },
  trs(x,y,z,rx,ry,rz,sx,sy,sz){
    sx=sx??1; sy=sy??sx; sz=sz??sx;
    const cx=Math.cos(rx||0),sx_=Math.sin(rx||0),cy=Math.cos(ry||0),sy_=Math.sin(ry||0),
          cz=Math.cos(rz||0),sz_=Math.sin(rz||0);
    const m=new Float32Array(16);
    m[0]=(cy*cz)*sx; m[1]=(cz*sx_*sy_+cx*sz_)*sx; m[2]=(sx_*sz_-cx*cz*sy_)*sx;
    m[4]=(-cy*sz_)*sy; m[5]=(cx*cz-sx_*sy_*sz_)*sy; m[6]=(cz*sx_+cx*sy_*sz_)*sy;
    m[8]=sy_*sz; m[9]=(-cy*sx_)*sz; m[10]=(cx*cy)*sz;
    m[12]=x; m[13]=y; m[14]=z; m[15]=1; return m; },
  scale(x,y,z){ const m=M4.ident(); m[0]=x; m[5]=y??x; m[10]=z??x; return m; },
  trans(x,y,z){ const m=M4.ident(); m[12]=x; m[13]=y; m[14]=z; return m; },
  norm(m){ const o=new Float32Array(9);
    const a=m[0],b=m[1],c=m[2],d=m[4],e=m[5],f=m[6],g=m[8],h=m[9],i=m[10];
    const det = a*(e*i-f*h) - d*(b*i-c*h) + g*(b*f-c*e);
    if(Math.abs(det)<1e-12) return o;
    const id=1/det;
    o[0]=(e*i-f*h)*id; o[3]=(c*h-b*i)*id; o[6]=(b*f-c*e)*id;
    o[1]=(f*g-d*i)*id; o[4]=(a*i-c*g)*id; o[7]=(c*d-a*f)*id;
    o[2]=(d*h-e*g)*id; o[5]=(b*g-a*h)*id; o[8]=(a*e-b*d)*id; return o; }
};
const V3 = {
  add(a,b){ return [a[0]+b[0],a[1]+b[1],a[2]+b[2]]; },
  sub(a,b){ return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; },
  scale(a,s){ return [a[0]*s,a[1]*s,a[2]*s]; },
  len(a){ return Math.hypot(a[0],a[1],a[2]); },
  norm(a){ const l=V3.len(a)||1; return [a[0]/l,a[1]/l,a[2]/l]; },
  cross(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; },
  lerp(a,b,t){ return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
};

/* ── hash noise for flat dither / jitter ───────────────────────────── */
function hash(n){ n = Math.sin(n)*43758.5453; return n - Math.floor(n); }

/* ── WebGL context ─────────────────────────────────────────────────── */
function createGL(canvas){
  const gl = canvas.getContext('webgl2', { antialias:true, alpha:false,
    powerPreference:'high-performance', preserveDrawingBuffer:true });
  if(!gl) return null;
  gl.getExtension('EXT_color_buffer_float');
  return gl;
}

function compile(gl, type, src){
  const LF=String.fromCharCode(10);
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
    const log = gl.getShaderInfoLog(s);
    throw new Error('shader: ' + log + LF + src.split(LF).slice(0,30).join(LF));
  }
  return s;
}
function program(gl, vs, fs){
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  return p;
}

/* ── the painterly lit surface ─────────────────────────────────────── */
const LIT_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 aCol;
layout(location=3) in vec4 aW;    // wave dir xyz, phase w
layout(location=4) in vec2 aA;    // amplitude, speed
layout(location=5) in vec2 aUV;
uniform int uTexOn;
uniform mat4 uProj, uView, uModel;
uniform mat3 uNorm;
uniform float uEmis;
uniform float uGlow;
uniform vec2 uJit;
uniform float uTime;
out vec3 vN; out vec4 vC; out vec3 vW; out float vE; out float vG; out vec2 vUV;
void main(){
  vec4 wp = uModel * vec4(aPos,1.0);
  vW = wp.xyz;
  vN = normalize(uNorm * aNrm);
  vec3 j = vec3(
    fract(sin(dot(aPos.xy, vec2(12.9898,78.233)) + uJit.x)*43758.5)-.5,
    fract(sin(dot(aPos.yz, vec2(39.346,11.135)) + uJit.y)*24634.6)-.5,
    fract(sin(dot(aPos.xz, vec2(53.731,17.891)) + uJit.x)*91187.2)-.5) * 0.012;
  vec4 wv = vec4(0.0);
  if(aA.x > 0.0001){
    wv = aW * (sin(uTime*aA.y + aW.w) * aA.x);
    wv.y *= 0.6;
  }
  gl_Position = uProj * uView * vec4(wp.xyz + j + wv.xyz, 1.0);
  vC = aCol; vE = uEmis; vG = uGlow; vUV = aUV;
}`
const LIT_FS = `#version 300 es
precision highp float;
in vec3 vN; in vec4 vC; in vec3 vW; in float vE; in float vG; in vec2 vUV;
uniform vec3 uCam; uniform vec3 uKey; uniform vec3 uKeyCol;
uniform vec3 uFill; uniform vec3 uFillCol; uniform vec3 uRimCol;
uniform vec3 uFogCol; uniform vec2 uFog;   // near, far
uniform float uPaint;    // palette posterization strength (paint bands)
uniform vec3 uAmbient;
uniform vec3 uTint;   // per-plate vertex color multiplier
uniform sampler2D uTex;
uniform int uTexOn;
out vec4 o;
float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
float shade(vec3 n, vec3 l){
  float d = clamp(dot(n, l), 0.0, 1.0);
  return (floor(d*2.99) + 0.5) / 3.0;   // 3 toon bands, capped at 1
}
void main(){
  vec3 n = normalize(vN);
  vec3 key = shade(n, uKey) * uKeyCol * 0.82;
  vec3 fill = shade(-n, uFill) * uFillCol * 0.38;
  float fr = pow(1.0 - clamp(dot(n, normalize(uCam - vW)), 0.0, 1.0), 2.2);
  vec3 rim = uRimCol * fr * 0.42 * (1.0 - luma(vC.rgb)*0.8);
  vec3 alb = vC.rgb * uTint;
  if(uTexOn == 1){ alb.rgb *= texture(uTex, vUV).rgb * 1.9; }
  vec3 lit = alb * (uAmbient + key + fill) + rim;
  float dist = length(uCam - vW);
  float fog = smoothstep(uFog.x, uFog.y, dist) * 0.55;
  lit = mix(lit, uFogCol, fog);
  lit += vC.rgb * vE * 0.55;             // emissive parts (tone-capped)
  lit += lit * (vG * 0.40);               // glow: sheen, never white-out
  lit = lit / (1.0 + lit*0.72);           // filmic shoulder: no pure white
  lit *= 1.26;
  o = vec4(lit, vC.a);
}`;

/* ── additive billboard (particles, glows, rings) ──────────────────── */
const BILL_VS = `#version 300 es
layout(location=0) in vec2 aCorner;   // unit quad corner
layout(location=1) in vec4 aData;     // x,y,z, size
layout(location=2) in vec4 aCol;
layout(location=3) in vec2 aArc;      // x: arc (rad), y: pad
uniform mat4 uProj, uView;
uniform vec2 uInv;
out vec4 vC; out vec2 vA; out float vPad;
void main(){
  vec4 cam = uView * vec4(aData.xyz, 1.0);
  vec2 sc = aCorner * aData.w;
  gl_Position = uProj * vec4(cam.xy + sc, cam.z, cam.w);
  vC = aCol; vA = aArc; vPad = aArc.y;
}`;
const BILL_FS = `#version 300 es
precision highp float;
in vec4 vC; in vec2 vA; in float vPad;
uniform float uSoft;   // 0 = hard disc, 1 = soft glow
out vec4 o;
void main(){
  float d = length(vA) * 2.0;
  float a;
  if(uSoft > 0.5) a = exp(-d*d*3.0);
  else a = step(1.0, vA.x) * smoothstep(1.0, 0.88, d);
  o = vec4(vC.rgb, vC.a * a);
}`;

/* ── fullscreen post: the oil-paint kitchen ────────────────────────── */
const POST_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0,1); }`;
const POST_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBrush;   // brushstroke paper texture
uniform float uTime;
uniform vec2 uRes;
uniform float uPost;        // master post strength 0..1
uniform float uVignette;
uniform float uGrainAmt;
uniform float uQuant;       // paint quantization levels per channel
uniform float uEdge;        // ink outline strength
uniform float uBrushMix;    // brush texture layering
out vec4 o;
float luma(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
float hashv(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec3 c = texture(uScene, vUv).rgb;
  // 1. ink outlines: sobel on luma
  vec2 px = 1.0 / uRes;
  float g0 = luma(texture(uScene, vUv).rgb);
  float gx = 0.0, gy = 0.0;
  for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++){
    float g = luma(texture(uScene, vUv + vec2(i,j)*px).rgb);
    float w = 0.0;
    if(i==0 && j==0) continue;
    w = (i==0 || j==0) ? 1.0 : 0.35;
    gx += g * float(i) * w; gy += g * float(j) * w;
  }
  float edge = clamp(length(vec2(gx,gy)) * uEdge, 0.0, 1.0) * uPost;
  c = mix(c, vec3(0.03,0.045,0.08), edge*0.9);
  // 2. paint quantization — posterize with dither
  float n = hashv(vUv * uRes + fract(uTime*0.7)*7.0)*0.5 - 0.25;
  vec3 q = floor(c * uQuant + n) / uQuant;
  c = mix(c, q, 0.85 * uPost);
  // 3. brushstroke paper — modulate with painted noise (subtle)
  vec3 br = texture(uBrush, vUv*1.7 + vec2(0.0, -uTime*0.004)).rgb;
  c *= 1.0 - uBrushMix * (1.0 - br) * uPost;
  c *= 1.0 + uBrushMix * 0.5 * br * uPost;
  // 4. film grain
  c += (hashv(vUv * uRes.xy * 1.7 + fract(uTime)*31.7) - 0.5) * uGrainAmt * uPost;
  // 5. vignette
  vec2 q2 = vUv - 0.5;
  c *= 1.0 - uVignette * dot(q2,q2) * 2.2 * uPost;
  // 6. soft chromatic edge (very subtle)
  vec2 cc = (vUv - 0.5) * edge * 0.0045 * uPost;
  c.r = texture(uScene, vUv + cc).r;
  c.b = texture(uScene, vUv - cc).b;
  o = vec4(c, 1.0);
}`;

/* ── geometry helpers ──────────────────────────────────────────────── */
/* A GeoBuilder accumulates indexed triangles with per-vertex colour. */
class Geo {
  constructor(){ this.p=[]; this.n=[]; this.c=[]; this.i=[]; }
  setUV(uvArr){ this.uv=uvArr; return this; }
  /* mark the LAST n vertices (from mark) as waving along dir */
  tagWave(dir, amp, speed, spread, phase, mark){
    if(!(amp > 0)) return this;
    const nP=this.p.length/3;
    const m = mark ?? (this._mark ?? 0);
    const w = this.w ?? new Float32Array(nP*3);
    const ph = this.ph ?? new Float32Array(nP);
    const am = this.amp ?? new Float32Array(nP);
    const sp = this.spd ?? new Float32Array(nP);
    for(let i=m;i<nP;i++){
      const px=this.p[i*3], py=this.p[i*3+1], pz=this.p[i*3+2];
      w[i*3]=dir[0]; w[i*3+1]=dir[1]; w[i*3+2]=dir[2];
      ph[i]= px*2.30 + pz*1.97 + py*0.61 + (phase ?? 0);
      am[i]= amp * (1 + (POLY.hash(px*7.1+pz*3.3) - 0.5) * spread);
    }
    for(let i=m;i<nP;i++) sp[i]=speed;
    this.w = w; this.ph = ph; this.amp = am; this.spd = sp;
    return this;
  }
  tri(a,b,c, col, nrm){
    const base = this.p.length/3;
    const n = nrm || V3.norm(V3.cross(V3.sub(b,a), V3.sub(c,a)));
    const al = col[3] ?? 1;
    for(const v of [a,b,c]){
      this.p.push(...v); this.n.push(...n);
      this.c.push(col[0], col[1], col[2]);
      this.al = this.al || []; this.al.push(al);
    }
    this.i.push(base, base+1, base+2);
  }
  quad(a,b,c,d, col, nrm){
    // two tris; winding follows the DECLARED normal so culling always agrees
    const n = nrm || V3.norm(V3.cross(V3.sub(b,a), V3.sub(c,a)));
    const cn = V3.cross(V3.sub(b,a), V3.sub(c,a));
    if(V3.norm(cn)[0]*n[0]+V3.norm(cn)[1]*n[1]+V3.norm(cn)[2]*n[2] < 0){
      const t=b; b=d; d=t;
    }
    this.tri(a,b,c,col,n); this.tri(a,c,d,col,n);
  }
  box(cx,cy,cz, w,h,d, col, col2, tint, faceTint){
    // direct form: cx,cy,cz, width,height,depth, col, (optional top col), (tint)
    const x0=cx-w/2,x1=cx+w/2,y0=cy-h/2,y1=cy+h/2,z0=cz-d/2,z1=cz+d/2;
    const cT = col2||col;
    const jitter=(colc)=>{
      if(!tint || typeof colc==='number') return colc;
      const t=(hash(cx*13.7+cy*7.3+cz*3.1)-0.5)*tint;
      return [Math.max(0,colc[0]+t), Math.max(0,colc[1]+t), Math.max(0,colc[2]+t)];
    };
    this.quad([x0,y0,z0],[x0,y0,z1],[x1,y0,z1],[x1,y0,z0], jitter(col), [0,-1,0]);
    this.quad([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1], jitter(cT), [0,1,0]);
    this.quad([x0,y0,z0],[x0,y1,z0],[x0,y1,z1],[x0,y0,z1], jitter(col), [-1,0,0]);
    this.quad([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0], jitter(col), [1,0,0]);
    this.quad([x0,y0,z0],[x0,y0,z1],[x1,y0,z1],[x1,y0,z0], jitter(col), [0,0,-1]);
    this.quad([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1], jitter(cT), [0,0,1]);
  }
  cyl(cx,cy,cz, r0,r1,h, seg, col, capCol){
    // standing cylinder, r0 bottom r1 top; capCol for top
    const n0 = this.p.length/3;
    for(let i=0;i<=seg;i++){
      const a = i/seg*Math.PI*2;
      this.p.push(cx+Math.cos(a)*r0, cy-h/2, cz+Math.sin(a)*r0);
      this.p.push(cx+Math.cos(a)*r1, cy+h/2, cz+Math.sin(a)*r1);
    }
    const nn = this.n.length/3;
    for(let i=0;i<=seg;i++){
      const a = i/seg*Math.PI*2;
      const nx=Math.cos(a), nz=Math.sin(a), l=Math.hypot(nx,1,nz);
      this.n.push(nx/l,0,nz/l); this.n.push(nx/l,0,nz/l);
    }
    for(let i=0;i<seg;i++){
      const b = nn+i*2;
      this.c.push(...col,...col,...col,...col);
      this.i.push(b,b+1,b+2, b+1,b+3,b+2);
    }
    if(capCol){
      const ci=this.p.length/3;
      this.p.push(cx,cy+h/2,cz); this.n.push(0,1,0); this.c.push(...capCol);
      for(let i=0;i<seg;i++){
        const b = nn+i*2;
        this.p.push(this.p[b*3],this.p[b*3+1],this.p[b*3+2]);
        this.p.push(this.p[(b+2)*3],this.p[(b+2)*3+1],this.p[(b+2)*3+2]);
        this.n.push(0,1,0,0,1,0); this.c.push(...capCol,...capCol);
        this.i.push(ci, ci+1+i*2, ci+2+i*2);
      }
    }
  }
  cone(cx,cy,cz, r,h, seg, col){
    const b = this.p.length/3;
    for(let i=0;i<seg;i++){
      const a0=i/seg*Math.PI*2, a1=(i+1)/seg*Math.PI*2;
      this.tri([cx,cy-h/2,cz],
               [cx+Math.cos(a1)*r, cy-h/2, cz+Math.sin(a1)*r],
               [cx+Math.cos(a0)*r, cy-h/2, cz+Math.sin(a0)*r], col);
      this.tri([cx,cy+h/2,cz],
               [cx+Math.cos(a0)*r, cy-h/2, cz+Math.sin(a0)*r],
               [cx+Math.cos(a1)*r, cy-h/2, cz+Math.sin(a1)*r], col);
    }
  }
  sph(cx,cy,cz, r, lat, lon, col, topCol, botCol){
    // lat rows from top to bottom; two-tone painterly shading
    const base=this.p.length/3;
    const rows=lat+1;
    for(let j=0;j<=lat;j++){
      const t=j/lat, phi=t*Math.PI;
      const cc = topCol ? [topCol[0]+(col[0]-topCol[0])*t, topCol[1]+(col[1]-topCol[1])*t, topCol[2]+(col[2]-topCol[2])*t, col[3]??1] : col;
      for(let i=0;i<=lon;i++){
        const th=i/lon*Math.PI*2;
        this.p.push(cx+r*Math.sin(phi)*Math.cos(th), cy+r*Math.cos(phi), cz+r*Math.sin(phi)*Math.sin(th));
        const n=[Math.sin(phi)*Math.cos(th), Math.cos(phi), Math.sin(phi)*Math.sin(th)];
        this.n.push(...n); this.c.push(...cc);
      }
    }
    for(let j=0;j<lat;j++) for(let i=0;i<lon;i++){
      const a=base+j*(lon+1)+i, b=a+lon+1;
      this.i.push(a,b,a+1, a+1,b,b+1);
    }
  }
  torus(cx,cy,cz, R,r, seg, tr, col){
    for(let i=0;i<seg;i++){
      const a=i/seg*Math.PI*2, a1=(i+1)/seg*Math.PI*2;
      for(let j=0;j<tr;j++){
        const b=j/tr*Math.PI*2, b1=(j+1)/tr*Math.PI*2;
        const p=(aa,bb)=>[cx+(R+r*Math.cos(bb))*Math.cos(aa), cy+r*Math.sin(bb), cz+(R+r*Math.cos(bb))*Math.sin(aa)];
        const nrm=(aa,bb)=>[Math.cos(bb)*Math.cos(aa), Math.sin(bb), Math.cos(bb)*Math.sin(aa)];
        this.quad(p(a,b),p(a1,b),p(a1,b1),p(a,b1), col, nrm((a+a1)/2,(b+b1)/2));
      }
    }
  }
  /* extruded polygon path: poly = [[x,z],...] plot */
  extrude(poly, y0, y1, col, sideCol){
    const n = V3.norm([0,1,0]);
    const b = this.p.length/3;
    for(let i=0;i<poly.length;i++){
      this.p.push(poly[i][0], y1, poly[i][1]); this.n.push(...n); this.c.push(...col);
    }
    for(let i=0;i<poly.length-1;i++){
      const a=i+0;
      this.i.push(b+a, b+a+1, b+poly.length-1);
    }
    // bottom
    const d = this.p.length/3;
    for(let i=0;i<poly.length;i++){
      this.p.push(poly[i][0], y0, poly[i][1]); this.n.push(0,-1,0); this.c.push(...col);
    }
    for(let i=0;i<poly.length-1;i++){
      this.i.push(d+i+1, d+i, d+poly.length-1);
    }
    // sides
    for(let i=0;i<poly.length-1;i++){
      const a=poly[i], b2=poly[i+1];
      const nn=hash(i)*0.12-0.06;
      this.quad([a[0],y1,a[1]],[a[0],y0,a[1]],[b2[0],y0,b2[1]],[b2[0],y1,b2[1]],
        sideCol||[col[0]+nn,col[1]+nn,col[2]+nn,col[3]??1]);
    }
  }
  build(gl){
    const vao=gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    const nP=this.p.length/3;
    const inter=new Float32Array(nP*18);
    const wdir=this.w ?? [], wph=this.ph ?? [], amp=this.amp ?? [], spd=this.spd ?? [];
    for(let i=0;i<nP;i++){
      const o=i*18;
      inter[o]=this.p[i*3]; inter[o+1]=this.p[i*3+1]; inter[o+2]=this.p[i*3+2];
      inter[o+3]=this.n[i*3]; inter[o+4]=this.n[i*3+1]; inter[o+5]=this.n[i*3+2];
      inter[o+6]=this.c[i*3]; inter[o+7]=this.c[i*3+1]; inter[o+8]=this.c[i*3+2];
      inter[o+9]=this.al ? this.al[i] : 1;
      inter[o+10]=wdir[i*3] ?? 0; inter[o+11]=wdir[i*3+1] ?? 0; inter[o+12]=wdir[i*3+2] ?? 0;
      inter[o+13]=wph[i] ?? 0;
      inter[o+14]=amp[i] ?? 0; inter[o+15]=spd[i] ?? 0;
      inter[o+16]=this.uv ? this.uv[i*2] : 0;
      inter[o+17]=this.uv ? this.uv[i*2+1] : 0;
    }
    gl.bufferData(gl.ARRAY_BUFFER, inter, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,72,0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,72,12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,4,gl.FLOAT,false,72,24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3,4,gl.FLOAT,false,72,40);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4,2,gl.FLOAT,false,72,56);
    gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5,2,gl.FLOAT,false,72,64);
    const ib=gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.i), gl.STATIC_DRAW);
    return { vao, vb, ib, count:this.i.length, geo:this };
  }
}

const SKY_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vP;
void main(){ vP = aPos; gl_Position = vec4(aPos, 0.99995, 1.0); }
`;
const SKY_FS = `#version 300 es
precision highp float;
in vec2 vP;
uniform samplerCube uSky;
uniform mat3 uVRot;         // view rotation (world-space)
uniform float uTanFov;
uniform float uAspect;
out vec4 o;
void main(){
  vec3 d = normalize(uVRot * vec3(vP.x * uTanFov * uAspect, vP.y * uTanFov, -1.0));
  vec3 c = texture(uSky, d).rgb;
  o = vec4(c, 1.0);
}
`;

/* ── a painterly particle pool (additive billboards) ───────────────── */
class Pool {
  constructor(gl, max){
    this.gl=gl; this.max=max; this.n=0; this.items=[];
    for(let i=0;i<max;i++) this.items.push({x:0,y:0,z:0,size:0,r:0,g:0,b:0,a:0,
      life:0,max:1,soft:1,spread:0,grav:0,sp:[0,0,0], drag:1, mode:0});
    this.vb=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,this.vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(max*24), gl.DYNAMIC_DRAW);
    // VAO: each vertex = 16 floats (64 bytes): corner(2) xyzs(4) rgba(4) arc(2) pad(4)
    this.vao=gl.createVertexArray(); gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.vb);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,64,0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,4,gl.FLOAT,false,64,8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,4,gl.FLOAT,false,64,24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3,2,gl.FLOAT,false,64,40);
    gl.bindVertexArray(null);
  }
  reset(){ this.n=0; }
  emit(o){
    if(this.n>=this.max) return;
    const i=this.items[this.n++];
    Object.assign(i, {r:1,g:1,b:1,a:1,soft:1,spread:0,grav:0,drag:0.92,mode:0,
      sp:[0,0,0]}, o);
    i.max=i.life; i.x=o.x??0; i.y=o.y??0; i.z=o.z??0;
    i.ox=0;
  }
  update(dt){
    for(let i=0;i<this.n;i++){
      const p=this.items[i];
      p.life-=dt;
      p.x+=p.sp[0]*dt; p.y+=p.sp[1]*dt; p.z+=p.sp[2]*dt;
      const d=Math.pow(p.drag, dt*60);
      p.sp[0]*=d; p.sp[1]*=d; p.sp[2]*=d;
      p.sp[1]-=p.grav*dt;
    }
    // compact out dead
    let w=0;
    for(let i=0;i<this.n;i++){ if(this.items[i].life>0){ if(w!==i) this.items[w]=this.items[i]; w++; } }
    this.n=w;
  }
  draw(gl, prog, proj, view){
    if(!this.n) return;
    const data=new Float32Array(this.n*96);
    const TRI=[[-1,-1],[1,-1],[-1,1], [-1,1],[1,-1],[1,1]];
    let o=0;
    for(let i=0;i<this.n;i++){
      const p=this.items[i];
      const t=Math.max(0,p.life/p.max);
      const s=p.size*(0.6+0.4*t);
      const al=p.a*(t*t*(3-2*t));
      for(const c of TRI){
        data[o++]=c[0]; data[o++]=c[1];
        data[o++]=p.x; data[o++]=p.y; data[o++]=p.z; data[o++]=s;
        data[o++]=p.r; data[o++]=p.g; data[o++]=p.b; data[o++]=al;
        data[o++]=0; data[o++]=p.mode;
        data[o++]=0; data[o++]=0; data[o++]=0; data[o++]=0;
      }
    }
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    gl.useProgram(prog);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog,'uProj'),false,proj);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog,'uView'),false,view);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES, 0, this.n*6);
    gl.depthMask(true); gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }}

/* ── engine shell ──────────────────────────────────────────────────── */
class Engine {
  constructor(canvas){
    this.gl = createGL(canvas);
    if(!this.gl) return;
    const gl=this.gl;
    this.canvas=canvas;
    this.prog=program(gl,LIT_VS,LIT_FS);
    this.bill=program(gl,BILL_VS,BILL_FS);
    this.post=program(gl,POST_VS,POST_FS);
    this.sky=program(gl,SKY_VS,SKY_FS);
    this._skyLoc={ uSky:gl.getUniformLocation(this.sky,'uSky'),
      uVRot:gl.getUniformLocation(this.sky,'uVRot'),
      uTanFov:gl.getUniformLocation(this.sky,'uTanFov'),
      uAspect:gl.getUniformLocation(this.sky,'uAspect') };
    // fullscreen quad
    this.fsq=gl.createVertexArray(); gl.bindVertexArray(this.fsq);
    this.fsb=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,this.fsb);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    this.pool=new Pool(gl, 4096);
    this.plates=[];   // lit mesh batches {mesh, model, emis, glow, alpha}
    this.sprites=[];  // glow sprites drawn via pool each frame
    this.u={};
    this._initUniforms();
    this.proj=M4.ident(); this.view=M4.ident();
    this.cam=[0,12,18]; this.target=[0,0,0];
    this.time=0;
    this.postTex=null;
    this._post={ on:true, quant:9, edge:6.5, grain:0.05, vignette:0.32, brush:0.10 };
    // brush texture: procedural paint noise
    this.brushTex=this._makeBrush();
    this._makeTargets();
  }
  _initUniforms(){
    const gl=this.gl, p=this.prog;
    const u={};
    for(const n of ['uProj','uView','uModel','uNorm','uEmis','uGlow','uJit','uTime','uCam','uTexOn','uTint',
      'uKey','uKeyCol','uFill','uFillCol','uRimCol','uFogCol','uFog','uPaint','uAmbient']){
      u[n]=gl.getUniformLocation(p,n);
    }
    u.uTexLoc=gl.getUniformLocation(p,'uTex');
    gl.useProgram(p); gl.uniform1i(u.uTexLoc, 0);
    gl.uniform3f(u.uKey,   0.26, 0.34, 0.30);
    gl.uniform3f(u.uKeyCol, 1.00, 0.88, 0.92);
        gl.uniform3f(u.uFill,  -0.34, 0.20, -0.46);
    gl.uniform3f(u.uFillCol, 0.55, 0.62, 0.95);
    gl.uniform3f(u.uRimCol, 0.55, 0.30, 0.75);
    gl.uniform3f(u.uFogCol, 0.16, 0.09, 0.16);
    gl.uniform2f(u.uFog, 12, 30);
    gl.uniform1f(u.uPaint, 0.55);
    gl.uniform3f(u.uAmbient, 0.36, 0.38, 0.47);
    this.uni = u;
    this._makeTargets();
  }
  _makeTargets(){
    const gl=this.gl;
    if(this.fbo){ gl.deleteFramebuffer(this.fbo); gl.deleteTexture(this.fboTex); }
    const W=this.canvas.width, H=this.canvas.height;
    this.fboTex=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    this.fbo=gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.fboTex,0);
    this.depth=gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth);
    gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,W,H);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,this.depth);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  setCam(eye, tgt){
    this.camEye=eye.slice(); this.camTgt=tgt.slice();
    this.cam=eye.slice();
    this.view=M4.lookAt(eye, tgt, [0,1,0]);
  }
  setSky(tex, radius){ this.skyTex=tex; this.skyR=radius||60; }
  unsetSky(){ this.skyTex=null; }
  add(geo, model, opts){
    opts=opts||{};
    const mesh=geo.build(this.gl);
    if(opts.name) mesh.__name=opts.name;
    const pl={mesh:mesh, model:model||POLY.M4.ident(), alpha:1,
      emis:opts.emis||0, glow:opts.glow||0, tint:opts.tint?opts.tint.slice():null, tex:null};
    this.plates.push(pl);
    this._dirty=[];
    return mesh;
  }
  addMesh(mesh, model, opts){ return this.add({build:()=>mesh, geoUndefined:true}, model, opts); }
  glow(pos, size, color, inten){ this.sprites[pos.length?0:0] && 0; this.sprites.push({pos, size, color, inten:Math.min(1.2, inten)}); }
  step(dt){
    this.time+=dt;
    for(const s of this.sprites){
      this.pool.emit(s.pos[0], s.pos[1], s.pos[2], s.size||0.3, s.color||[1,1,1], s.inten||0.5, 0.35, 0, [0,0.6,0], 0.98, 0);
    }
    this.sprites.length=0;
    this.pool.update(dt);
    if(this.onStep) this.onStep(dt, this.time);
  }

  _makeBrush(){
    const gl=this.gl;
    const S=256;
    const t=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,t);
    const d=new Uint8Array(S*S*4);
    let seed=12345;
    const rnd=()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
    for(let i=0;i<S*S;i++){
      const n=rnd();
      const v=0.42+n*0.16;
      // low-frequency smears
      const x=i%S, y=(i/S)|0;
      const f=0.5+0.5*Math.sin(x*0.09+Math.sin(y*0.13)*2)*Math.cos(y*0.07);
      const vv=Math.max(0,Math.min(1, v*(0.55+0.9*f)));
      d[i*4]=Math.round(vv*255); d[i*4+1]=Math.round(vv*255); d[i*4+2]=Math.round(vv*255); d[i*4+3]=255;
    }
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,S,S,0,gl.RGBA,gl.UNSIGNED_BYTE,d);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
    return t;
  }

  resize(w,h){
    const gl=this.gl;
    if(this.canvas.width!==w||this.canvas.height!==h){
      this.canvas.width=w; this.canvas.height=h;
      this._makeTargets();
    }
  }

  draw(){
    const gl=this.gl;
    const W=this.canvas.width, H=this.canvas.height;
    // ---- pass 1: scene into FBO ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0,0,W,H);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0.012,0.010,0.02,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    // sky
    if(this.skyTex){ this._sky(); }
    // lit plates (each mesh owns its VAO from build())
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);
    gl.useProgram(this.prog);
    const u=this.uni;
    gl.uniformMatrix4fv(u.uProj,false,this.proj);
    gl.uniformMatrix4fv(u.uView,false,this.view);
    gl.uniform3f(u.uCam,this.cam[0],this.cam[1],this.cam[2]);
    gl.uniform1f(u.uTime,this.time||0);
    gl.uniform1i(u.uTexOn,0);
    // brush texture bound to unit 0 for per-pixel variation (uTexOn stays 0 unless pl.tex)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.brushTex);
    for(const pl of this.plates){
      if(!pl.model) continue;
      gl.uniformMatrix4fv(u.uModel,false,pl.model);
      gl.uniform1f(u.uEmis, pl.emis||0);
      gl.uniform1f(u.uGlow, pl.glow||0);
      const t=pl.tint||[1,1,1];
      gl.uniform3f(u.uTint,t[0],t[1],t[2]);
      // normal matrix: inverse-transpose of model 3x3
      const m=pl.model;
      const iM=POLY.M4.inv(m);
      const nm=[ iM[0],iM[1],iM[2], iM[4],iM[5],iM[6], iM[8],iM[9],iM[10] ];
      gl.uniformMatrix3fv(u.uNorm, false, nm);
      const m2=pl.mesh;
      gl.bindVertexArray(m2.vao);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m2.ib);
      gl.drawElements(gl.TRIANGLES, m2.count, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
    gl.disable(gl.CULL_FACE);
    // billboards (pool)
    this.pool.draw(gl, this.bill, this.proj, this.view);
    // ---- pass 2: post to screen ----
    this._postPass();
  }

  _makeLitVAO(){
    const gl=this.gl;
    const vao=gl.createVertexArray();
    gl.bindVertexArray(vao);
    // interleaved geometry: pos3 nrm3 col3 wave3 phase1 amp1 speed1 uv2 = 18 floats stride 72
    for(let i=0;i<6;i++) gl.enableVertexAttribArray(i);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vb || (this._vb=gl.createBuffer()));
    gl.vertexAttribPointer(0,3,gl.FLOAT,false,72,0);
    gl.vertexAttribPointer(1,3,gl.FLOAT,false,72,12);
    gl.vertexAttribPointer(2,3,gl.FLOAT,false,72,24);
    gl.vertexAttribPointer(3,3,gl.FLOAT,false,72,36);
    gl.vertexAttribPointer(4,1,gl.FLOAT,false,72,48);
    gl.vertexAttribPointer(5,1,gl.FLOAT,false,72,56);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ib || (this._ib=gl.createBuffer()));
    return vao;
  }

  _sky(){
    const gl=this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(this.fsq);
    gl.useProgram(this.sky);
    const l=this._skyLoc;
    gl.uniform1i(l.uSky,0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.skyTex);
    // view rotation (yaw only)
    const yaw=this.skyRot||0;
    gl.uniform2f(l.uVRot, Math.cos(yaw), Math.sin(yaw));
    gl.uniform1f(l.uTanFov, Math.tan((this.fov||0.78)*0.5));
    gl.uniform1f(l.uAspect, this.canvas.width/this.canvas.height);
    gl.drawArrays(gl.TRIANGLES,0,3);
    gl.enable(gl.DEPTH_TEST);
  }

  _postPass(){
    const gl=this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    const W=this.canvas.width, H=this.canvas.height;
    gl.viewport(0,0,W,H);
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(this.fsq);
    gl.useProgram(this.post);
    const p=this._postLoc||(this._postLoc={
      uTex:gl.getUniformLocation(this.post,'uTex'),
      uQuant:gl.getUniformLocation(this.post,'uQuant'),
      uEdge:gl.getUniformLocation(this.post,'uEdge'),
      uGrain:gl.getUniformLocation(this.post,'uGrain'),
      uVig:gl.getUniformLocation(this.post,'uVig'),
      uBrush:gl.getUniformLocation(this.post,'uBrushMix'),
      uBrushOn:gl.getUniformLocation(this.post,'uPost'),
      uSize:gl.getUniformLocation(this.post,'uSize'),
      uBrushTex:gl.getUniformLocation(this.post,'uBrushTex'),
      uChroma:gl.getUniformLocation(this.post,'uChroma')
    });
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,this.fboTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D,this.brushTex);
    gl.uniform1i(p.uTex,0);
    gl.uniform1i(p.uBrushTex,1);
    gl.uniform1f(p.uQuant,this._post.quant);
    gl.uniform1f(p.uEdge,this._post.edge);
    gl.uniform1f(p.uGrain,this._post.grain);
    gl.uniform1f(p.uVig,this._post.vignette);
    gl.uniform1f(p.uBrush,this._post.brush);
    gl.uniform1f(p.uBrushOn,1);
    gl.uniform2f(p.uSize,W,H);
    gl.uniform1f(p.uChroma,0.0016);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
}

/* ── public surface ────────────────────────────────────────────────── */
POLY.Engine = Engine;
POLY.Pool = Pool;
POLY.Geo = Geo;
POLY.M4 = M4;
POLY.V3 = V3;

})();
