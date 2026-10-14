/* Fast shader gate probe.
   Loads the page and reports whether every GL program compiled and linked.
   The newline is built with String.fromCharCode rather than written as an
   escape: this source passes through a template literal before it is evaluated
   in the page, so a literal backslash-n here becomes a REAL newline inside the
   evaluated string and breaks it. */
module.exports = [
  { size: [400, 300] },
  { wait: 2200 },
  { eval: [
      'JSON.stringify({',
      '  booted: typeof window.__RQ !== "undefined",',
      '  glErrors: (window.GL && GL.errors) ? GL.errors().map(function(e){',
      '    return e.stage + ": " + String(e.msg).split(String.fromCharCode(10))[0];',
      '  }) : ["GL module missing"]',
      '})'
    ].join('\n') }
];
