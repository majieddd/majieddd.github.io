module.exports = [
  { size: [400, 300] },
  { wait: 2200 },
  { eval: '(function(){ var g = R.gl;' +
    ' var fs = g.createFramebuffer(); g.bindFramebuffer(g.FRAMEBUFFER, fs);' +
    ' var rbs = []; for (var i = 0; i < 2; i++) { var rb = g.createRenderbuffer(); g.bindRenderbuffer(g.RENDERBUFFER, rb); g.renderbufferStorageMultisample(g.RENDERBUFFER, 4, g.RGBA16F, 64, 64); g.framebufferRenderbuffer(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0 + i, g.RENDERBUFFER, rb); rbs.push(rb); }' +
    ' g.drawBuffers([g.COLOR_ATTACHMENT0, g.COLOR_ATTACHMENT1]);' +
    ' var cv0 = document.createElement("canvas"); cv0.width = cv0.height = 64;' +
    ' var c0 = cv0.getContext("2d"); c0.fillStyle = "rgb(255,0,0)"; c0.fillRect(0,0,64,64);' +
    ' var cv1 = document.createElement("canvas"); cv1.width = cv1.height = 64;' +
    ' var c1 = cv1.getContext("2d"); c1.fillStyle = "rgb(0,0,255)"; c1.fillRect(0,0,64,64);' +
    ' var t0 = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t0); g.texImage2D(g.TEXTURE_2D,0,g.RGBA8,64,64,0,g.RGBA,g.UNSIGNED_BYTE,cv0);' +
    ' var t1 = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t1); g.texImage2D(g.TEXTURE_2D,0,g.RGBA8,64,64,0,g.RGBA,g.UNSIGNED_BYTE,cv1);' +
    ' g.viewport(0,0,64,64);' +
    ' g.colorMask(true,false,false,false); g.clearColor(1,0,0,1); g.clear(g.COLOR_BUFFER_BIT);' +
    ' g.colorMask(false,false,true,false); g.clearColor(0,0,1,1); g.clear(g.COLOR_BUFFER_BIT);' +
    ' g.colorMask(true,true,true,true);' +
    ' var dst = g.createFramebuffer(); g.bindFramebuffer(g.DRAW_FRAMEBUFFER, dst);' +
    ' g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, t0, 0);' +
    ' g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT1, g.TEXTURE_2D, t1, 0);' +
    ' g.bindFramebuffer(g.READ_FRAMEBUFFER, fs);' +
    ' g.readBuffer(g.COLOR_ATTACHMENT0); g.drawBuffers([g.COLOR_ATTACHMENT0]);' +
    ' g.blitFramebuffer(0,0,64,64,0,0,64,64,g.COLOR_BUFFER_BIT,g.NEAREST);' +
    ' g.readBuffer(g.COLOR_ATTACHMENT1); g.drawBuffers([g.COLOR_ATTACHMENT1]);' +
    ' g.blitFramebuffer(0,0,64,64,0,0,64,64,g.COLOR_BUFFER_BIT,g.NEAREST);' +
    ' function rd(t, name) { g.bindFramebuffer(g.FRAMEBUFFER, dst); g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, t, 0); g.drawBuffers([g.COLOR_ATTACHMENT0]); g.readBuffer(g.COLOR_ATTACHMENT0); var px = new Uint8Array(4); g.readPixels(32,32,1,1,g.RGBA,g.UNSIGNED_BYTE,px); return name + "=" + Array.prototype.join.call(px, ","); }' +
    ' var out = rd(t0, "t0") + " " + rd(t1, "t1");' +
    ' return out; })()' }
];
