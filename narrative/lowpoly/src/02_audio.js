/* 02 audio. Web Audio API. Everything procedural, no samples.
   SFX = short shaped-noise/tone recipes. BGM = a slow multi-voice pad sequencer
   gated by game intensity. Master limiter keeps total output under 0.85. */
(function(){
  const LP=window.LP;
  // Always seed LP.Audio with a no-op fallback so downstream code can call
  // Audio.click() etc. without a guard, even if Web Audio is unavailable.
  const NOOP=()=>{};
  LP.Audio={ready:false,fire:NOOP,explode:NOOP,hurt:NOOP,coin:NOOP,
    click:NOOP,uiOpen:NOOP,uiClose:NOOP,waveStart:NOOP,win:NOOP,lose:NOOP,bgmSet:NOOP};
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return;
  const ctx=new AC();
  const master=ctx.createGain(); master.gain.value=0.6;
  const limiter=ctx.createDynamicsCompressor(); limiter.threshold.value=-6; limiter.ratio.value=6; limiter.attack.value=0.003; limiter.release.value=0.2;
  master.connect(limiter).connect(ctx.destination);

  // Helpers
  function noise(dur){const b=ctx.createBuffer(1,Math.max(1,Math.floor(ctx.sampleRate*dur)),ctx.sampleRate);
    const d=b.getChannelData(0); for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length); return b;}
  function env(g,a,d,s,r){const t=ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(a,t+0.005); g.gain.linearRampToValueAtTime(a*s,t+a+d); g.gain.exponentialRampToValueAtTime(0.0001,t+a+d+r);}
  function osc(type,freq,detune){const o=ctx.createOscillator(); o.type=type; o.frequency.value=freq; if(detune)o.detune.value=detune; return o;}

  // Resume on first user gesture
  let armed=false;
  function arm(){if(armed)return; armed=true; if(ctx.state==="suspended")ctx.resume();}
  window.addEventListener("pointerdown",arm,{passive:true});
  window.addEventListener("keydown",arm,{passive:true});

  // SFX
  function sfxFire(kind){
    if(!armed)return;
    const t=ctx.currentTime; const o=osc("square",520+Math.random()*60,0);
    const g=ctx.createGain(); o.connect(g).connect(master);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.16,t+0.005);
    o.frequency.exponentialRampToValueAtTime(180,t+0.09);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.12); o.start(t); o.stop(t+0.13);
    // tiny noise tick for impact
    const n=ctx.createBufferSource(); n.buffer=noise(0.05);
    const ng=ctx.createGain(); n.connect(ng).connect(master); ng.gain.value=0.08;
    n.start(t+0.01); n.stop(t+0.07);
  }
  function sfxExplode(){
    if(!armed)return;
    const t=ctx.currentTime; const n=ctx.createBufferSource(); n.buffer=noise(0.5);
    const f=ctx.createBiquadFilter(); f.type="lowpass"; f.frequency.setValueAtTime(2200,t); f.frequency.exponentialRampToValueAtTime(160,t+0.45);
    const g=ctx.createGain(); n.connect(f).connect(g).connect(master);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.32,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+0.5);
    n.start(t); n.stop(t+0.55);
    // Sub thump
    const o=osc("sine",90,0); const og=ctx.createGain(); o.connect(og).connect(master);
    og.gain.setValueAtTime(0,t); og.gain.linearRampToValueAtTime(0.28,t+0.01); og.gain.exponentialRampToValueAtTime(0.0001,t+0.32);
    o.start(t); o.stop(t+0.35);
  }
  function sfxHurt(){
    if(!armed)return;
    const t=ctx.currentTime; const o=osc("sawtooth",180,0);
    const f=ctx.createBiquadFilter(); f.type="bandpass"; f.frequency.value=620; f.Q.value=4;
    const g=ctx.createGain(); o.connect(f).connect(g).connect(master);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.18,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+0.18);
    o.start(t); o.stop(t+0.2);
  }
  function sfxCoin(){
    if(!armed)return;
    const t=ctx.currentTime; [880,1320].forEach((f,i)=>{
      const o=osc("triangle",f,0); const g=ctx.createGain(); o.connect(g).connect(master);
      g.gain.setValueAtTime(0,t+i*0.05); g.gain.linearRampToValueAtTime(0.18,t+i*0.05+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+i*0.05+0.12);
      o.start(t+i*0.05); o.stop(t+i*0.05+0.13);
    });
  }
  function sfxClick(){if(!armed)return; const t=ctx.currentTime; const o=osc("square",660,0); const g=ctx.createGain(); o.connect(g).connect(master); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.12,t+0.004); g.gain.exponentialRampToValueAtTime(0.0001,t+0.05); o.start(t); o.stop(t+0.06);}
  function sfxUiOpen(){if(!armed)return; const t=ctx.currentTime; [330,440,550].forEach((f,i)=>{const o=osc("triangle",f,0); const g=ctx.createGain(); o.connect(g).connect(master); g.gain.setValueAtTime(0,t+i*0.04); g.gain.linearRampToValueAtTime(0.16,t+i*0.04+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+i*0.04+0.18); o.start(t+i*0.04); o.stop(t+i*0.04+0.19);});}
  function sfxUiClose(){if(!armed)return; const t=ctx.currentTime; [550,330].forEach((f,i)=>{const o=osc("triangle",f,0); const g=ctx.createGain(); o.connect(g).connect(master); g.gain.setValueAtTime(0,t+i*0.03); g.gain.linearRampToValueAtTime(0.14,t+i*0.03+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+i*0.03+0.14); o.start(t+i*0.03); o.stop(t+i*0.03+0.15);});}
  function sfxWaveStart(){if(!armed)return; const t=ctx.currentTime; [220,330,440,660].forEach((f,i)=>{const o=osc("sawtooth",f,0); const f2=ctx.createBiquadFilter(); f2.type="lowpass"; f2.frequency.value=900;
    const g=ctx.createGain(); o.connect(f2).connect(g).connect(master); g.gain.setValueAtTime(0,t+i*0.07); g.gain.linearRampToValueAtTime(0.12,t+i*0.07+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+i*0.07+0.22); o.start(t+i*0.07); o.stop(t+i*0.07+0.24);});}
  function sfxWin(){if(!armed)return; const t=ctx.currentTime; [523,659,784,1046].forEach((f,i)=>{const o=osc("triangle",f,0); const g=ctx.createGain(); o.connect(g).connect(master); g.gain.setValueAtTime(0,t+i*0.12); g.gain.linearRampToValueAtTime(0.18,t+i*0.12+0.01); g.gain.linearRampToValueAtTime(0.10,t+i*0.12+0.4); g.gain.exponentialRampToValueAtTime(0.0001,t+i*0.12+0.8); o.start(t+i*0.12); o.stop(t+i*0.12+0.85);});}
  function sfxLose(){if(!armed)return; const t=ctx.currentTime; [330,247,196,165].forEach((f,i)=>{const o=osc("sawtooth",f,0); const f2=ctx.createBiquadFilter(); f2.type="lowpass"; f2.frequency.value=600;
    const g=ctx.createGain(); o.connect(f2).connect(g).connect(master); g.gain.setValueAtTime(0,t+i*0.16); g.gain.linearRampToValueAtTime(0.18,t+i*0.16+0.02); g.gain.linearRampToValueAtTime(0.08,t+i*0.16+0.5); g.gain.exponentialRampToValueAtTime(0.0001,t+i*0.16+1.0); o.start(t+i*0.16); o.stop(t+i*0.16+1.05);});}

  // BGM: slow chord pad. Two voices (root + fifth) on a 4-bar loop.
  // Intensity scales the filter cutoff and the bass gain.
  let padBus=null, padVoices=[], padBass=null, padTick=0;
  function setupPad(){
    if(padBus)return;
    try{
      padBus=ctx.createGain(); padBus.gain.value=0.20;
      const filt=ctx.createBiquadFilter(); filt.type="lowpass"; filt.frequency.value=700; filt.Q.value=0.7;
      padBus.connect(filt).connect(master);
      // Voices: 3 sine layers, detuned
      const freqs=[110,165,220]; // A2, E3, A3 (A minor pentatonic root)
      for(let i=0;i<freqs.length;i++){
        const a=osc("sine",freqs[i],-7);
        const b=osc("sine",freqs[i],+7);
        const g=ctx.createGain(); g.gain.value=0.18;
        a.connect(g); b.connect(g); g.connect(padBus);
        padVoices.push({a,b,g,base:freqs[i]});
      }
      padBass=ctx.createGain(); padBass.gain.value=0.0;
      const bass=osc("triangle",55,0); bass.connect(padBass).connect(master);
      padBass.osc=bass;
    }catch(e){ padBus=null; padVoices=[]; padBass=null; }
  }
  function bgmSet(intensity){
    if(!armed)setupPad();
    if(!padBus)return;
    const target=LP.clamp(intensity,0,1);
    try{
      if(padBass) padBass.gain.linearRampToValueAtTime(0.06+target*0.10,ctx.currentTime+0.4);
      padVoices.forEach(v=>{v.g.gain.linearRampToValueAtTime(0.10+target*0.10,ctx.currentTime+0.4);});
    }catch(e){}
    padTick++;
  }

  LP.Audio={ready:true,
    fire:sfxFire, explode:sfxExplode, hurt:sfxHurt, coin:sfxCoin,
    click:sfxClick, uiOpen:sfxUiOpen, uiClose:sfxUiClose,
    waveStart:sfxWaveStart, win:sfxWin, lose:sfxLose,
    bgmSet:bgmSet
  };
})();
