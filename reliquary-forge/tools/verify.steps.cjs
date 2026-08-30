"use strict";

module.exports = [
  { size: [1600, 900] },
  { wait: 700 },
  { eval: "(async function(){await window.__FORGE.ready;window.__FORGE.start();globalThis.__lineup=window.__FORGE.spawnLineup();window.__FORGE.buildAt('helios',0);window.__FORGE.buildAt('vortex',4);window.__FORGE.buildAt('rime',8);return {probe:'boot',lineup:globalThis.__lineup,towers:window.__FORGE.state().towers.length,errors:window.__FORGE.errors()};})()" },
  { wait: 360 },
  { eval: "globalThis.__animTime=window.__FORGE.state().time;globalThis.__animA=window.__FORGE.animationState(globalThis.__lineup[0]);({probe:'anim-a',parts:Object.keys(globalThis.__animA).length,state:globalThis.__animA})" },
  { wait: 1500 },
  { eval: "(function(){var b=window.__FORGE.animationState(globalThis.__lineup[0]),d=0;Object.keys(b).forEach(function(k){var a=globalThis.__animA[k]||[];b[k].forEach(function(v,i){d=Math.max(d,Math.abs(v-(a[i]||0)));});});return {probe:'animation',parts:Object.keys(b).length,maxDelta:d,timeDelta:window.__FORGE.state().time-globalThis.__animTime};})()" },
  { eval: "({probe:'physical',grounding:window.__FORGE.groundingState(),facing:window.__FORGE.facingState()})" },
  { eval: "(function(){var state=window.__FORGE.visualState();state.probe='planet-geometry';return state;})()" },
  { eval: "({probe:'build-rules',duplicate:window.__FORGE.buildAt('helios',0),badSlot:window.__FORGE.buildAt('rime',99),wave:window.__FORGE.beginWave()})" },
  { wait: 2100 },
  { shot: "verify-desktop" },
  { eval: "globalThis.__shadowA=window.__FORGE.shadowState();window.__FORGE.orbitCamera(1.8,0.54,42);true" },
  { wait: 900 },
  { eval: "(function(){var b=window.__FORGE.shadowState(),d=0;b.matrix.forEach(function(v,i){d=Math.max(d,Math.abs(v-globalThis.__shadowA.matrix[i]));});return {probe:'shadow-anchor',matrixDelta:d,extent:[b.left,b.right,b.top,b.bottom]};})()" },
  { eval: "(function(){var overflow=[].filter.call(document.querySelectorAll('button'),function(b){return b.scrollHeight>b.clientHeight+1});var focus=[];[].forEach.call(document.querySelectorAll('button:not([disabled])'),function(b){if(b.tabIndex<0)focus.push(b.id||b.className);});var css=[].map.call(document.styleSheets,function(s){try{return [].map.call(s.cssRules,function(r){return r.cssText}).join(' ')}catch(e){return ''}}).join(' ');return {probe:'ui',pageOverflow:document.body.scrollWidth-window.innerWidth,buttonOverflow:overflow.length,focusMissing:focus,focusRule:/button:focus-visible/.test(css),reduced:/prefers-reduced-motion/.test(css),navHeight:document.querySelector('.status-strip').getBoundingClientRect().height};})()" },
  { eval: "window.__FORGE.benchmark(60).then(function(v){v.probe='benchmark';return v})" },
  { eval: "window.__FORGE.buildAll();globalThis.__aimLineup=window.__FORGE.spawnLineup();true" },
  { wait: 900 },
  { eval: "(async function(){var frames=[];for(var i=0;i<30;i+=1){await new Promise(requestAnimationFrame);var state=window.__FORGE.state();frames.push({targets:state.towers.filter(function(t){return (t.kind==='helios'||t.kind==='rime')&&t.targetId!==null;}).map(function(t){return [t.id,t.kind,t.targetId];}),facing:window.__FORGE.facingState().filter(function(entry){return entry.type==='tower';})});}return {probe:'temporal-aim',frames:frames};})()" },
  { size: [390, 844] },
  { wait: 800 },
  { shot: "verify-mobile" },
  { eval: "({probe:'mobile',pageOverflow:document.body.scrollWidth-window.innerWidth,rail:Math.round(document.querySelector('.command-rail').getBoundingClientRect().width),viewport:window.innerWidth,errors:window.__FORGE.errors()})" }
];
