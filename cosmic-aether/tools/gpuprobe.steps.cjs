module.exports = [
  { size: [1600, 900] },
  { wait: 2200 },
  { eval: 'JSON.stringify({renderer: (window.R && R.caps()) ? R.caps().renderer : null, caps: window.R ? R.caps() : null, msaa: window.R ? R.quality.msaa : null})' }
];
