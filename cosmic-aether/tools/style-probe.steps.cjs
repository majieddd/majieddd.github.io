module.exports = [
  { size: [800, 500] },
  { wait: 2200 },
  { eval: 'JSON.stringify({ style: (window.R && R.style) || null, hd: window.R ? R.quality.hd : null, tier: window.R ? R.quality.tier : null, errs: window.R ? R.errors().length : -1 })' }
];
