/* ==========================================================================
   POLY PROTOCOL — audio.js
   Web Audio, everything synthesized. Deep vaporwave register: tempo 84,
   SFX_DEPTH 0.62 floor, dark pads, neon arps. No sample files — the house
   rule is that nothing ships beside the code.
   ========================================================================== */
'use strict';
(() => {

class AudioCore {
  constructor(){
    this.ctx = null; this.master=null; this.sfxBus=null; this.musicBus=null;
    this.delay=null; this.reverb=null; this.vinyl=null;
    this.muted=false; this.ready=false;
    this.musicOn=true; this.sfxOn=true;
    this._music=null;
    this.sfxDepth=0.62; this.tempo=84;
  }
  init(){
    if(this.ctx) return true;
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const c=this.ctx;
      this.master = c.createGain(); this.master.gain.value=0.9;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value=-14; comp.ratio.value=4;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.gain.value=1.0;
      this.sfxBus.connect(this.master);
      this.musicBus = c.createGain(); this.musicBus.gain.value=0.5;
      this.musicBus.connect(this.master);
      // echo bus
      this.delay = c.createDelay(1.0); this.delay.delayTime.value=0.29;
      const fb = c.createGain(); fb.gain.value=0.32;
      const damp = c.createBiquadFilter(); damp.type='lowpass'; damp.frequency.value=2200;
      this.delay.connect(fb); fb.connect(damp); damp.connect(this.delay);
      this.delay.connect(this.master);
      // reverb: generated impulse
      this.reverb = c.createConvolver();
      this.reverb.buffer = this._impulse(2.6, 2.4);
      const rg = c.createGain(); rg.gain.value=0.34;
      this.reverb.connect(rg); rg.connect(this.master);
      // vinyl crackle layer (quiet)
      this.vinyl = c.createGain(); this.vinyl.gain.value=0.0;
      this._makeCrackle(this.vinyl);
      this.vinyl.connect(this.master);
      this.ready=true;
      return true;
    }catch(e){ console.warn('audio init failed', e); return false; }
  }
  _impulse(sec, decay){
    const c=this.ctx, rate=c.sampleRate, n=Math.floor(sec*rate);
    const buf=c.createBuffer(2,n,rate);
    for(let ch=0;ch<2;ch++){
      const d=buf.getChannelData(ch);
      for(let i=0;i<n;i++){
        const t=i/n;
        d[i]=(Math.random()*2-1)*Math.pow(1-t,decay)*0.5;
      }
    }
    return buf;
  }
  _makeCrackle(gain){
    // shaped noise bursts, quiet, random pops
    const c=this.ctx;
    const len=c.sampleRate*4;
    const buf=c.createBuffer(1,len,c.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<len;i++){
      d[i]=(Math.random()*2-1)*0.012;
      if(Math.random()<0.00007) { const n=2+Math.random()*6;
        for(let j=0;j<n;j++) d[i+j]+= (Math.random()*2-1)*0.35*(1-j/n); }
    }
    const src=c.createBufferSource(); src.buffer=buf; src.loop=true;
    const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=6000;
    src.connect(lp); lp.connect(gain); src.start();
  }
  resume(){ if(this.ctx && this.ctx.state==='suspended') this.ctx.resume(); }
  setMuted(m){ this.muted=m; if(this.master) this.master.gain.value = m?0:0.9; }
  toggleMusic(){ this.musicOn=!this.musicOn;
    if(this.musicBus) this.musicBus.gain.value=this.musicOn?0.5:0; return this.musicOn; }
  toggleSfx(){ this.sfxOn=!this.sfxOn;
    if(this.sfxBus) this.sfxBus.gain.value=this.sfxOn?1.0:0; return this.sfxOn; }

  /* ── SFX primitives ─────────────────────────────────────────────── */
  _env(g, t0, a, d, peak, sus){
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0+a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus??peak*0.3), t0+a+d);
  }
  blip(freq, opts){
    if(!this.ready||!this.sfxOn) return;
    const c=this.ctx, t0=c.currentTime;
    const o=c.createOscillator(), g=c.createGain();
    o.type=opts?.type||'square';
    o.frequency.setValueAtTime(freq, t0);
    if(opts?.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*opts.slide), t0+(opts.dur||0.1));
    this._env(g, t0, opts?.a??0.004, opts?.d??0.14, opts?.peak??0.16*this.sfxDepth);
    o.connect(g); g.connect(this.sfxBus);
    if(opts?.echo){ g.connect(this.delay); }
    o.start(t0); o.stop(t0+(opts?.dur||0.2)+0.05);
  }
  noise(opts){
    if(!this.ready||!this.sfxOn) return;
    const c=this.ctx, t0=c.currentTime;
    const dur=opts?.dur??0.25;
    const buf=c.createBuffer(1, Math.max(1,Math.floor(c.sampleRate*dur)), c.sampleRate);
    const d=buf.getChannelData(0);
    const mode=opts?.mode||'white';
    for(let i=0;i<d.length;i++){
      if(mode==='pop') d[i]=Math.random()<0.5?(Math.random()*2-1):0;
      else d[i]=Math.random()*2-1;
      if(mode==='crackle') d[i]*=Math.random();
    }
    const src=c.createBufferSource(); src.buffer=buf;
    const f=c.createBiquadFilter(); f.type=opts?.filter||'lowpass';
    f.frequency.setValueAtTime(opts?.freq||800, t0);
    if(opts?.freqSlide) f.frequency.exponentialRampToValueAtTime(Math.max(40,opts.freqSlide), t0+dur);
    f.Q.value=opts?.q??0.8;
    const g=c.createGain();
    this._env(g, t0, opts?.a??0.004, dur, opts?.peak??0.22*this.sfxDepth);
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    if(opts?.echo) g.connect(this.delay);
    src.start(t0); src.stop(t0+dur+0.05);
  }
  /* named SFX vocabulary */
  sfx(name, arg){
    if(!this.ready) return;
    const D=this.sfxDepth;
    switch(name){
      case 'ui': this.blip(880,{type:'sine',d:0.08,peak:0.10*D}); break;
      case 'ui2': this.blip(1320,{type:'sine',d:0.06,peak:0.08*D}); break;
      case 'place': this.blip(190,{type:'square',d:0.16,slide:0.7,peak:0.2*D});
        this.noise({dur:0.08,freq:900,filter:'bandpass',q:2,peak:0.12*D}); break;
      case 'upgrade': this.blip(300,{type:'sawtooth',d:0.2,slide:1.9,peak:0.14*D});
        this.blip(600,{type:'sine',d:0.3,slide:1.5,peak:0.12*D,echo:true}); break;
      case 'sell': this.blip(500,{type:'sine',d:0.18,slide:0.55,peak:0.12*D}); break;
      case 'fire_bolt': this.blip(520+Math.random()*90,{type:'square',d:0.05,slide:0.45,peak:0.11*D});
        this.noise({dur:0.04,freq:2400,filter:'highpass',peak:0.05*D}); break;
      case 'fire_cryo': this.blip(1150,{type:'sine',d:0.12,slide:0.5,peak:0.10*D});
        this.noise({dur:0.2,freq:5200,filter:'highpass',peak:0.04*D}); break;
      case 'fire_mortar': this.blip(96,{type:'sine',d:0.3,slide:0.4,peak:0.22*D});
        this.noise({dur:0.2,freq:500,filter:'bandpass',q:1.4,peak:0.14*D}); break;
      case 'fire_arc': this.blip(240,{type:'sawtooth',d:0.12,slide:2.4,peak:0.12*D});
        this.noise({dur:0.1,freq:3600,filter:'highpass',peak:0.1*D}); break;
      case 'fire_rail': this.blip(1800,{type:'sine',d:0.18,slide:0.12,peak:0.16*D});
        this.noise({dur:0.14,freq:4200,filter:'bandpass',q:4,peak:0.12*D}); break;
      case 'fire_toxin': this.blip(320,{type:'triangle',d:0.16,slide:0.6,peak:0.10*D});
        this.blip(200,{type:'sine',d:0.2,slide:0.5,peak:0.08*D}); break;
      case 'fire_pyre': this.noise({dur:0.35,freq:900,filter:'bandpass',q:1.2,a:0.02,peak:0.16*D,echo:true}); break;
      case 'hit': this.noise({dur:0.05,freq:1500,filter:'bandpass',q:1,peak:0.05*D}); break;
      case 'kill': this.blip(140,{type:'square',d:0.22,slide:0.3,peak:0.14*D});
        this.noise({dur:0.16,freq:700,filter:'bandpass',q:1.2,peak:0.12*D}); break;
      case 'explode': this.noise({dur:0.5,freq:900,freqSlide:120,peak:0.3*D,echo:true});
        this.blip(60,{type:'sine',d:0.4,slide:0.3,peak:0.26*D}); break;
      case 'leak': this.blip(180,{type:'sawtooth',d:0.3,slide:0.6,peak:0.2*D});
        this.noise({dur:0.2,freq:600,filter:'bandpass',q:2,peak:0.1*D,echo:true}); break;
      case 'wave': this.blip(220,{type:'sawtooth',d:0.5,slide:1.35,peak:0.12*D,echo:true});
        this.noise({dur:0.5,freq:2200,filter:'highpass',peak:0.03*D}); break;
      case 'buildStart': this.blip(392,{type:'sine',d:0.3,peak:0.1*D,echo:true}); break;
      case 'ability': this.blip(150,{type:'sawtooth',d:0.4,slide:2.2,peak:0.18*D,echo:true});
        this.noise({dur:0.3,freq:3000,filter:'bandpass',q:3,peak:0.1*D}); break;
      case 'victory': [261,329,392,523].forEach((f,i)=>setTimeout(()=>this.blip(f,{type:'sine',d:0.6,peak:0.12*D,echo:true}), i*140)); break;
      case 'defeat': [392,311,261,196].forEach((f,i)=>setTimeout(()=>this.blip(f,{type:'sawtooth',d:0.7,slide:0.97,peak:0.12*D,echo:true}), i*200)); break;
      case 'boss': this.blip(70,{type:'sawtooth',d:1.2,slide:0.55,peak:0.3*D});
        this.noise({dur:0.8,freq:300,freqSlide:90,peak:0.2*D,echo:true}); break;
      case 'acquire': this.blip(523,{type:'sine',d:0.15,peak:0.1*D});
        this.blip(784,{type:'sine',d:0.25,peak:0.09*D,echo:true}); break;
    }
  }

  /* ── music: 84 BPM neon reliquary drone ─────────────────────────── */
  startMusic(){
    if(!this.ready || this._music) return;
    const c=this.ctx;
    const bus=this.musicBus;
    // chord pads: Am — F — C — G, quarter=60/tempo*4? tempo 84
    const beat=60/this.tempo;
    const bar=beat*4;
    // deep pad detuned saws through a slow lowpass
    const chords=[[110,130.8,164.8,220],[87.3,130.8,174.6,261.6],[130.8,164.8,196,261.6],[98,146.8,196,246.9]];
    const rootNotes=[55,43.65,65.4,49];
    let barIdx=0;
    const sched=()=>{
      const t0=c.currentTime;
      const ch=chords[barIdx%chords.length];
      for(const f of ch){
        for(const det of [-4,4]){
          const o=c.createOscillator(); o.type='sawtooth'; o.frequency.value=f*det/400*4;
          o.detune.value=det;
          const g=c.createGain();
          g.gain.setValueAtTime(0.0001,t0);
          g.gain.linearRampToValueAtTime(0.020,t0+bar*0.6);
          g.gain.linearRampToValueAtTime(0.015,t0+bar*2.2);
          g.gain.linearRampToValueAtTime(0.0001,t0+bar*3.6);
          const f1=c.createBiquadFilter(); f1.type='lowpass'; f1.frequency.value=700;
          o.connect(f1); f1.connect(g); g.connect(bus);
          o.start(t0); o.stop(t0+bar*3.8);
        }
      }
      // sub bass on the half-bar
      const root=rootNotes[barIdx%rootNotes.length];
      const bo=c.createOscillator(); bo.type='sine'; bo.frequency.value=root;
      const bg=c.createGain();
      bg.gain.setValueAtTime(0.0001,t0);
      bg.gain.linearRampToValueAtTime(0.09,t0+0.25);
      bg.gain.setValueAtTime(0.09,t0+bar*2.8);
      bg.gain.linearRampToValueAtTime(0.0001,t0+bar*3.6);
      bo.connect(bg); bg.connect(bus);
      bo.start(t0); bo.stop(t0+bar*3.8);
      // sparse neon arp: 6th of the chord
      const arpNotes=[ch[2], ch[1], ch[3], ch[2]];
      for(let i=0;i<4;i++){
        const tt=t0+bar/4*i+0.02;
        const o=c.createOscillator(); o.type='square'; o.frequency.value=arpNotes[i];
        const g=c.createGain();
        g.gain.setValueAtTime(0.0001,tt);
        g.gain.linearRampToValueAtTime(0.035,tt+0.01);
        g.gain.exponentialRampToValueAtTime(0.0001,tt+0.5);
        o.connect(g); g.connect(this.delay);
        o.start(tt); o.stop(tt+0.6);
      }
      barIdx++;
      const next = t0 + bar*3.8;
      this._musicTimer=setTimeout(sched, Math.max(50,(next-c.currentTime)*1000));
    };
    sched();
    this._music=true;
  }
  stopMusic(){ if(this._musicTimer){ clearTimeout(this._musicTimer); this._musicTimer=null; } this._music=null; }
}

POLY.Audio = AudioCore;
})();
