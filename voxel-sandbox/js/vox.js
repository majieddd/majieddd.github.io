/* VOX. A tiny isometric voxel rasteriser for Canvas 2D.

   WHY IT LOOKS LIKE THIS: the shipping engine is zero dependency, plain script
   tags, no bundler and no WebGL, so this is written to the same rules. It can
   be dropped into js/ and inlined by build.js with no other change.

   THE ONE ARCHITECTURAL DECISION. Drawing every cube of every unit on every
   frame does not scale: a 200 voxel model at 20 units on screen is 4000 cubes
   and up to 12000 face fills per frame. So models are BAKED ONCE into sprite
   canvases at N yaw angles, and the game loop only ever calls drawImage. That
   is also how you would ship it, and it means the texture pass costs nothing
   at runtime because it is painted into the bake.

   Coordinate convention: x and z are ground plane, y is UP. Boxes are
   inclusive on both ends: [x0,y0,z0, x1,y1,z1, colourIndex]. */
'use strict';

var Vox = (function () {

  /* ---- model construction ------------------------------------------- */

  /* Expand boxes to voxels, then discard any voxel fully enclosed on all six
     sides. Those can never be seen from any angle and baking them is pure
     waste: on the models here it removes 13 to 30 percent of the work. */
  function shell(boxes) {
    var map = Object.create(null), list = [], i, b, x, y, z, k;
    for (i = 0; i < boxes.length; i++) {
      b = boxes[i];
      for (x = b[0]; x <= b[3]; x++)
        for (y = b[1]; y <= b[4]; y++)
          for (z = b[2]; z <= b[5]; z++) {
            k = x + ',' + y + ',' + z;
            if (map[k] === undefined) { map[k] = list.length; list.push([x, y, z, b[6]]); }
            else list[map[k]][3] = b[6];
          }
    }
    var NB = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    var out = [], j, n, p, hidden;
    for (j = 0; j < list.length; j++) {
      p = list[j]; hidden = true;
      for (n = 0; n < 6; n++) {
        if (map[(p[0]+NB[n][0]) + ',' + (p[1]+NB[n][1]) + ',' + (p[2]+NB[n][2])] === undefined) {
          hidden = false; break;
        }
      }
      if (!hidden) out.push(p);
    }
    return { voxels: out, total: list.length };
  }

  /* Bounding sphere, so the auto-fit scale does not breathe as a model turns.
     A bounding BOX would, because its projected width changes with yaw. */
  function bounds(voxels) {
    var cx = 0, cy = 0, cz = 0, i, r = 0, d;
    for (i = 0; i < voxels.length; i++) { cx += voxels[i][0]; cy += voxels[i][1]; cz += voxels[i][2]; }
    cx /= voxels.length; cy /= voxels.length; cz /= voxels.length;
    for (i = 0; i < voxels.length; i++) {
      d = Math.sqrt(Math.pow(voxels[i][0]-cx,2) + Math.pow(voxels[i][1]-cy,2) + Math.pow(voxels[i][2]-cz,2));
      if (d > r) r = d;
    }
    var minY = Infinity;
    for (i = 0; i < voxels.length; i++) if (voxels[i][1] < minY) minY = voxels[i][1];
    return { cx: cx, cy: cy, cz: cz, r: Math.max(r, 1), minY: minY };
  }

  /* Six cube faces as corner offsets, with the lighting ramp baked in. Face
     order does not matter because they are backface culled per angle. */
  /* Lighting ramp. The floor is deliberately high: these palettes put
     near-black (#0a0e17) at index 0, so a steep ramp multiplies an already
     dark colour toward invisible and the model reads as a silhouette with no
     internal form. Measured by eye at 74px, 0.55 is about where the side faces
     stop disappearing into the board. */
  var FACES = [
    { c: [[0,1,0],[1,1,0],[1,1,1],[0,1,1]], lum: 1.15 },  /* top    */
    { c: [[0,0,1],[1,0,1],[1,0,0],[0,0,0]], lum: 0.50 },  /* bottom */
    { c: [[1,0,0],[1,0,1],[1,1,1],[1,1,0]], lum: 0.80 },
    { c: [[0,0,1],[0,0,0],[0,1,0],[0,1,1]], lum: 0.62 },
    { c: [[0,0,1],[0,1,1],[1,1,1],[1,0,1]], lum: 0.95 },
    { c: [[1,0,0],[1,1,0],[0,1,0],[0,0,0]], lum: 0.70 }
  ];

  function shade(hex, f) {
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return 'rgb(' + Math.min(255,Math.round(r*f)) + ',' +
                    Math.min(255,Math.round(g*f)) + ',' +
                    Math.min(255,Math.round(b*f)) + ')';
  }

  /* ---- baking --------------------------------------------------------- */

  /* Render one yaw angle into its own canvas. Returns {canvas, ox, oy} where
     ox/oy is the offset from the model's ground centre to the sprite's top
     left, so the caller can position by a ground point and not think about it. */
  function bakeAngle(model, yaw, px, textured) {
    var vox = model.shell.voxels, bd = model.bounds;
    var pitch = 0.62, cp = Math.cos(pitch), sp = Math.sin(pitch);
    var cyw = Math.cos(yaw), syw = Math.sin(yaw);
    var S = px * 0.30 / bd.r;

    function proj(x, y, z) {
      var dx = x - bd.cx, dy = y - bd.cy, dz = z - bd.cz;
      var rx = dx*cyw - dz*syw, rz = dx*syw + dz*cyw;
      return [ (rx - rz) * S * 0.87,
               (rx + rz) * S * 0.5 * cp - dy * S * (0.6 + sp*0.55),
               rx + rz + dy*1.2 ];
    }

    /* First pass: measure so the canvas is exactly big enough. */
    var minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity, i, f, k, p, q;
    for (i = 0; i < vox.length; i++) {
      p = vox[i];
      for (k = 0; k < 8; k++) {
        q = proj(p[0] + (k&1), p[1] + ((k>>1)&1), p[2] + ((k>>2)&1));
        if (q[0]<minX) minX=q[0]; if (q[0]>maxX) maxX=q[0];
        if (q[1]<minY) minY=q[1]; if (q[1]>maxY) maxY=q[1];
      }
    }
    var pad = 2;
    var w = Math.max(1, Math.ceil(maxX - minX) + pad*2);
    var h = Math.max(1, Math.ceil(maxY - minY) + pad*2);
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    var offX = -minX + pad, offY = -minY + pad;

    /* Painter's algorithm. Depth is a true view-direction dot product, so it
       stays correct at any yaw, unlike sorting on grid axes. */
    var order = [];
    for (i = 0; i < vox.length; i++) {
      p = vox[i];
      order.push([ proj(p[0]+0.5, p[1]+0.5, p[2]+0.5)[2], p ]);
    }
    order.sort(function (a, b) { return a[0] - b[0]; });

    var faces = 0;
    for (i = 0; i < order.length; i++) {
      p = order[i][1];
      var base = model.pal[p[3]] || model.pal[0];
      for (f = 0; f < 6; f++) {
        var fc = FACES[f], pts = [], area = 0;
        for (k = 0; k < 4; k++) {
          q = proj(p[0]+fc.c[k][0], p[1]+fc.c[k][1], p[2]+fc.c[k][2]);
          pts.push([q[0] + offX, q[1] + offY]);
        }
        for (k = 0; k < 4; k++) {
          area += pts[k][0]*pts[(k+1)%4][1] - pts[(k+1)%4][0]*pts[k][1];
        }
        if (area >= 0) continue;               /* facing away */
        faces++;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (k = 1; k < 4; k++) ctx.lineTo(pts[k][0], pts[k][1]);
        ctx.closePath();
        ctx.fillStyle = shade(base, fc.lum);
        ctx.fill();
        if (textured) {
          ctx.save(); ctx.clip();
          ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1; ctx.stroke();
          var mx = (pts[0][0]+pts[2][0])/2, my = (pts[0][1]+pts[2][1])/2;
          ctx.fillStyle = 'rgba(0,0,0,0.30)';
          for (var dx = -7; dx <= 7; dx += 4)
            for (var dy = -7; dy <= 7; dy += 4) ctx.fillRect(mx+dx, my+dy, 1.2, 1.2);
          ctx.restore();
        } else {
          ctx.strokeStyle = 'rgba(0,0,0,0.20)'; ctx.lineWidth = 0.6; ctx.stroke();
        }
      }
    }

    /* Ground anchor: where the model's lowest point projects to. */
    var g = proj(bd.cx, bd.minY, bd.cz);
    return { canvas: cv, ax: g[0] + offX, ay: g[1] + offY, faces: faces };
  }

  /* Public: turn box data into a baked, ready-to-blit sprite set. */
  function make(def, px, angles, textured) {
    var sh = shell(def.boxes);
    var model = { pal: def.pal, shell: sh, bounds: bounds(sh.voxels) };
    var frames = [], i, totalFaces = 0, bytes = 0;
    for (i = 0; i < angles; i++) {
      var fr = bakeAngle(model, (i / angles) * Math.PI * 2, px, textured);
      totalFaces += fr.faces;
      bytes += fr.canvas.width * fr.canvas.height * 4;
      frames.push(fr);
    }
    return {
      name: def.name, frames: frames, angles: angles,
      stats: {
        boxes: def.boxes.length, voxels: sh.total, shell: sh.voxels.length,
        facesPerFrame: Math.round(totalFaces / angles),
        bakedBytes: bytes
      }
    };
  }

  /* Draw a baked sprite so that (sx, sy) is the point it stands on. */
  function draw(ctx, sprite, sx, sy, yaw, alpha) {
    var n = sprite.angles;
    var idx = Math.round((yaw / (Math.PI*2)) * n) % n;
    if (idx < 0) idx += n;
    var f = sprite.frames[idx];
    if (alpha !== undefined && alpha < 1) {
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.drawImage(f.canvas, Math.round(sx - f.ax), Math.round(sy - f.ay));
      ctx.restore();
    } else {
      ctx.drawImage(f.canvas, Math.round(sx - f.ax), Math.round(sy - f.ay));
    }
  }

  return { make: make, draw: draw, shell: shell };
})();
