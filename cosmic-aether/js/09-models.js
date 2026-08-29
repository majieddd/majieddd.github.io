/* RELIQUARY :: 09-models
   Every mesh in the game, built procedurally.

   COLOUR POLICY, and why it is not the obvious one. The style law says faction
   colour dominates a frame to the point of monochrome. A tower defence puts
   fourteen tower types on one board, so colouring each by its ORIGIN would put
   five rival palettes in one frame, which the law forbids outright.

   The resolution: the BOARD owns the frame. Towers are built from a shared
   dark hull material in every faction's game, and carry a small bright accent
   in their ELEMENT colour. The accent is a few percent of the silhouette, so
   it never competes with the board for dominance, and it encodes the one thing
   a player must read at a glance to plan reactions. Identity by silhouette,
   information by accent, mood by the board.

   TIERS CHANGE THE MODEL. Every upgrade adds or replaces geometry rather than
   only scaling numbers. An upgrade the player cannot see is an upgrade the
   player does not feel, and this is the cheapest place in the whole project to
   buy that feeling.

   All builders are memoised: a board has up to forty towers and a wave up to
   sixty denizens, and rebuilding a mesh per instance would allocate megabytes
   a second. */
'use strict';

var MODELS = (function () {

  var cache = Object.create(null);
  function memo(key, fn) {
    var v = cache[key];
    if (v === undefined) { v = fn(); cache[key] = v; }
    return v;
  }

  /* Shared hull palette. Deliberately narrow: three values of the same cold
     graphite, so every tower reads as built by the same hands and the accent
     is the only thing that varies. */
  /* THE HULL MUST OUT-VALUE THE BOARD. These were roughly half this bright to
     begin with, which put every tower BELOW the ground it stood on in
     luminance: the towers read as holes in the board rather than as objects
     on it, and the whole set flattened into silhouette at any distance.
     A defended position should have the player's own assets as the brightest
     solid things on the field, with the denizens as the dark shapes moving
     through it. That ordering is what makes a glance tell you who is winning. */
  var HULL = {
    dark: '#28324a',
    mid: '#3a4a68',
    light: '#54688e',
    trim: '#7386ac'
  };

  /* ---------- RIG DIMENSIONS, IN ONE PLACE ----------
     These were written twice, once in the leg builder and once in the pose
     function, and the two had to agree by hand. They did not: the pose set the
     hip at exactly upper + lower, which is FULL LEG EXTENSION, so the IK
     solved every stance leg to a dead straight line. That is why the walks
     read as stiff. A leg needs slack to bend, so the hip now sits at about
     0.82 of the leg's total reach.

     `stride` is derived from hip height rather than picked: a creature's step
     is roughly proportional to how far off the ground it stands, and tying
     them means a long-legged strider does not shuffle with the same stride as
     a crawler. `duty` is the fraction of the cycle a foot is planted.

     THE PHASE RATE FOLLOWS FROM THESE, it is not a free parameter. For a foot
     to stay put on the ground during stance:
         stride * scale = speed * duty * cycleTime
     so  phaseRate = speed * duty / (stride * scale)
     Any other rate slides the feet, which is the single loudest tell of cheap
     locomotion. */
  var RIG_DIMS = {
    crawler: { spread: 0.60, upper: 0.54, lower: 0.60, hipY: 0.94, zOff: 0.45,
               stride: 1.05, lift: 0.30, duty: 0.60, radius: 0.115 },
    walker:  { spread: 0.62, upper: 1.10, lower: 1.06, hipY: 1.80, zOff: 0,
               stride: 1.85, lift: 0.46, duty: 0.62, radius: 0.135 },
    strider: { spread: 0.95, upper: 1.48, lower: 1.40, hipY: 2.40, zOff: 0.72,
               stride: 2.55, lift: 0.62, duty: 0.66, radius: 0.165 }
  };

  function elementColor(el) {
    var e = DATA.ELEMENTS[el];
    return e ? e.color : '#ffffff';
  }

  /* A plinth every tower stands on, so the whole set shares a footprint and
     reads as one army. Tier adds rings to it, which is a cheap, legible
     "this one has been upgraded" signal visible even at full zoom out. */
  function plinth(b, tier, r) {
    r = r || 2.15;
    b.color(HULL.dark).tooth(1.0);
    b.prism(r, r * 0.92, 0.85, 6, 0);
    b.color(HULL.mid);
    b.prism(r * 0.86, r * 0.74, 0.42, 6, 0.85);
    if (tier >= 1) {
      b.color(HULL.trim).tooth(0.6);
      b.ring(r * 0.95, r * 1.12, 6, 0.9);
    }
    if (tier >= 2) {
      b.color(HULL.trim);
      for (var i = 0; i < 6; i++) {
        var a = (i / 6) * U.TAU + 0.3;
        b.push();
        b.translate(Math.cos(a) * r * 1.02, 0.42, Math.sin(a) * r * 1.02);
        b.box(0.26, 0.85, 0.26);
        b.pop();
      }
    }
  }

  /* ---------- tower builders ----------
     Each returns { base, turret, barrel, muzzle, turretY, spin } where the
     three meshes are the parts of the rig and `muzzle` is where projectiles
     and muzzle flash originate, in TURRET-local space. */

  var TOWER_BUILD = {

    bolt: function (b, t, acc) {
      plinth(b, t);
      b.color(HULL.mid).tooth(0.95);
      b.frustum(2.05, 2.05, 1.55, 1.55, 1.25, 1.25);
      return {
        turret: function (tb) {
          tb.color(HULL.light).tooth(0.85);
          tb.prism(1.05, 0.88, 0.72, 7, 0);
          tb.color(HULL.mid);
          tb.box(1.5, 0.62, 1.15);
          tb.color(acc).tooth(0.2).emissive(0.85);
          tb.push(); tb.translate(0, 0.42, -0.42); tb.box(0.5, 0.16, 0.2); tb.pop();
          tb.emissive(0);
        },
        barrel: function (bb) {
          bb.color(HULL.dark).tooth(0.55);
          bb.limb([0, 0, 0.2], [0, 0, 2.0 + t * 0.42], 0.20, 0.155, 6);
          if (t >= 1) bb.limb([0.30, 0, 0.2], [0.30, 0, 1.85 + t * 0.35], 0.15, 0.12, 5);
          if (t >= 2) bb.limb([-0.30, 0, 0.2], [-0.30, 0, 1.85 + t * 0.35], 0.15, 0.12, 5);
          bb.color(HULL.trim);
          bb.push(); bb.translate(0, 0, 0.55); bb.prism(0.30, 0.30, 0.26, 6, 0); bb.pop();
        },
        turretY: 2.5, muzzle: [0, 0, 2.3 + t * 0.42]
      };
    },

    cryo: function (b, t, acc) {
      plinth(b, t);
      b.color(HULL.mid).tooth(0.95);
      b.frustum(2.2, 2.2, 1.9, 1.9, 0.95, 1.25);
      /* Coolant flasks: the read-at-a-glance identity for this tower. */
      b.color(acc).tooth(0.25).emissive(0.55);
      for (var i = 0; i < 3 + t; i++) {
        var a = (i / (3 + t)) * U.TAU + 0.4;
        b.push();
        b.translate(Math.cos(a) * 1.5, 1.5, Math.sin(a) * 1.5);
        b.lathe([[0, 0], [0.26, 0.12], [0.3, 0.7], [0.16, 0.95], [0, 1.0]], 6);
        b.pop();
      }
      b.emissive(0);
      return {
        turret: function (tb) {
          tb.color(HULL.light).tooth(0.8);
          tb.lathe([[0.95, 0], [1.05, 0.35], [0.72, 0.78], [0.5, 0.9]], 7);
          tb.color(acc).tooth(0.15).emissive(0.9);
          tb.push(); tb.translate(0, 0.72, 0); tb.shard(0.34, 0.85 + t * 0.2, 0.2, 5, 0); tb.pop();
          tb.emissive(0);
        },
        barrel: function (bb) {
          bb.color(HULL.dark).tooth(0.5);
          bb.limb([0, 0.1, 0.3], [0, 0.42, 1.5], 0.28, 0.36, 6);
          bb.color(acc).tooth(0.1).emissive(0.7);
          bb.push(); bb.translate(0, 0.44, 1.55); bb.prism(0.38, 0.30, 0.2, 6, 0); bb.pop();
        },
        turretY: 2.2, muzzle: [0, 0.5, 1.8]
      };
    },

    mortar: function (b, t, acc) {
      plinth(b, t, 2.3);
      b.color(HULL.mid).tooth(1.0);
      b.frustum(2.4, 2.4, 2.0, 2.0, 0.8, 1.25);
      b.color(HULL.trim).tooth(0.9);
      b.push(); b.translate(0, 1.4, -1.1); b.box(1.9, 0.5, 0.5); b.pop();
      return {
        turret: function (tb) {
          tb.color(HULL.light).tooth(0.85);
          tb.box(1.7, 0.75, 1.9);
          tb.color(HULL.mid);
          tb.push(); tb.translate(0, 0.4, -0.8); tb.box(1.2, 0.85, 0.6); tb.pop();
          tb.color(acc).tooth(0.2).emissive(0.75);
          tb.push(); tb.translate(0, 0.55, -0.85); tb.box(0.55, 0.22, 0.16); tb.pop();
          tb.emissive(0);
        },
        barrel: function (bb) {
          /* Pitched steeply upward: the silhouette that says artillery from
             across the board, and the reason it cannot hit anything close. */
          bb.color(HULL.dark).tooth(0.6);
          var n = t >= 2 ? 3 : 1;
          for (var i = 0; i < n; i++) {
            var off = (i - (n - 1) / 2) * 0.55;
            bb.limb([off, 0, 0], [off, 2.1 + t * 0.3, 1.0 + t * 0.12], 0.32, 0.28, 6);
          }
          bb.color(HULL.trim);
          bb.push(); bb.translate(0, 0.25, 0.1); bb.prism(0.5, 0.46, 0.35, 6, 0); bb.pop();
        },
        turretY: 2.1, muzzle: [0, 2.3 + t * 0.3, 1.1]
      };
    },

    flak: function (b, t, acc) {
      plinth(b, t);
      b.color(HULL.mid).tooth(0.95);
      b.prism(1.8, 1.6, 1.1, 8, 1.25);
      b.color(HULL.trim).tooth(0.7);
      b.ring(1.65, 1.95, 8, 2.32);
      return {
        turret: function (tb) {
          tb.color(HULL.light).tooth(0.8);
          tb.prism(1.15, 1.0, 0.6, 8, 0);
          tb.color(HULL.mid);
          tb.push(); tb.translate(0, 0.35, -0.5); tb.box(1.5, 0.7, 0.9); tb.pop();
          /* Ammunition drums, one per tier, so the count is the upgrade. */
          tb.color(acc).tooth(0.3).emissive(0.6);
          for (var i = 0; i <= t; i++) {
            tb.push();
            tb.translate(-0.7 + i * 0.7, 0.55, -0.75);
            tb.prism(0.3, 0.3, 0.42, 6, 0);
            tb.pop();
          }
          tb.emissive(0);
        },
        barrel: function (bb) {
          bb.color(HULL.dark).tooth(0.5);
          var n = 2 + t;
          for (var i = 0; i < n; i++) {
            var a = (i / n) * U.TAU;
            var ox = Math.cos(a) * 0.26, oy = Math.sin(a) * 0.26;
            bb.limb([ox, oy + 0.35, 0.2], [ox, oy + 0.35, 1.85], 0.115, 0.09, 5);
          }
          bb.color(HULL.trim);
          bb.push(); bb.translate(0, 0.35, 0.35); bb.prism(0.42, 0.38, 0.3, 7, 0); bb.pop();
        },
        turretY: 2.9, muzzle: [0, 0.35, 2.0]
      };
    },

    arc: function (b, t, acc) {
      plinth(b, t);
      b.color(HULL.mid).tooth(0.95);
      b.frustum(1.9, 1.9, 1.2, 1.2, 1.9, 1.25);
      /* Insulator stack: the tesla silhouette. */
      b.color(HULL.trim).tooth(0.55);
      for (var i = 0; i < 3; i++) {
        b.push(); b.translate(0, 3.15 + i * 0.34, 0);
        b.lathe([[0.62, 0], [0.72, 0.09], [0.5, 0.18], [0.5, 0.26]], 8);
        b.pop();
      }
      return {
        turret: function (tb) {
          tb.color(HULL.light).tooth(0.6);
          tb.prism(0.7, 0.55, 0.5, 7, 0);
          tb.color(acc).tooth(0.1).emissive(1.0);
          tb.push(); tb.translate(0, 0.95, 0); tb.ico(0.62 + t * 0.09, 0); tb.pop();
          if (t >= 1) { tb.push(); tb.translate(0, 0.95, 0); tb.ring(0.95, 1.12, 10, 0); tb.pop(); }
          if (t >= 2) {
            tb.push(); tb.translate(0, 0.95, 0); tb.rotateX(1.05); tb.ring(1.05, 1.2, 10, 0); tb.pop();
          }
          tb.emissive(0);
        },
        barrel: null,
        turretY: 4.2, muzzle: [0, 0.95, 0]
      };
    },

    prism: function (b, t, acc) {
      plinth(b, t);
      /* The Federation is a cathedral culture: this is the one tower allowed
         ceremonial geometry rather than plate and weld. */
      b.color(HULL.mid).tooth(0.9);
      b.lathe([[1.7, 0], [1.5, 0.5], [1.55, 0.75], [1.1, 1.3], [0.95, 1.9]], 8, 0.2);
      b.color(HULL.trim).tooth(0.6);
      b.ring(1.5, 1.85, 8, 1.28);
      return {
        turret: function (tb) {
          tb.color(HULL.light).tooth(0.55);
          tb.lathe([[0.85, 0], [0.95, 0.28], [0.6, 0.6]], 8);
          tb.color(acc).tooth(0.08).emissive(1.0);
          tb.push(); tb.translate(0, 1.1, 0);
          tb.shard(0.45 + t * 0.08, 1.05 + t * 0.18, 0.55, 6, 0);
          tb.pop();
          if (t >= 1) {
            for (var i = 0; i < 3; i++) {
              var a = (i / 3) * U.TAU;
              tb.push();
              tb.translate(Math.cos(a) * 0.85, 0.85, Math.sin(a) * 0.85);
              tb.shard(0.16, 0.42, 0.2, 4, 0);
              tb.pop();
            }
          }
          if (t >= 2) { tb.push(); tb.translate(0, 1.1, 0); tb.ring(1.25, 1.42, 14, 0); tb.pop(); }
          tb.emissive(0);
        },
        barrel: null,
        turretY: 2.5, muzzle: [0, 1.1, 0.4]
      };
    },

    pharos: function (b, t, acc) {
      plinth(b, t, 2.3);
      /* A lighthouse. Tallest silhouette in the set, which is most of why it
         costs what it costs. */
      b.color(HULL.mid).tooth(1.0);
      b.prism(1.85, 1.15, 5.2, 7, 1.25, 0.2);
      b.color(HULL.trim).tooth(0.7);
      b.ring(1.15, 1.5, 7, 6.4);
      b.color(HULL.light).tooth(0.8);
      b.prism(1.05, 1.0, 0.7, 7, 6.45, 0.2);
      return {
        turret: function (tb) {
          tb.color(acc).tooth(0.06).emissive(1.0);
          tb.prism(0.7, 0.62, 1.0, 6, 0);
          tb.emissive(0);
          tb.color(HULL.dark).tooth(0.5);
          tb.lathe([[0.85, 1.0], [0.9, 1.15], [0.35, 1.5], [0, 1.62]], 7);
          /* The reflector: a solid wedge that occludes the lamp, so the beam
             direction is legible from the model alone. */
          tb.color(HULL.trim).tooth(0.4);
          tb.push(); tb.translate(0, 0.5, -0.55); tb.box(1.35, 1.0, 0.28); tb.pop();
          if (t >= 2) {
            tb.color(acc).tooth(0.06).emissive(1.0);
            tb.push(); tb.translate(0, 1.85, 0); tb.prism(0.42, 0.36, 0.6, 6, 0); tb.pop();
            tb.emissive(0);
          }
        },
        barrel: null,
        turretY: 7.15, muzzle: [0, 0.5, 0.8]
      };
    },

    toxin: function (b, t, acc) {
      /* Xeno hardware is accumulated, never designed. No plinth ring: a
         swollen sac that grew where it landed. */
      b.color(HULL.dark).tooth(1.0);
      b.prism(2.1, 1.95, 0.6, 7, 0);
      b.color('#1b1526').tooth(1.0);
      b.push(); b.translate(0, 1.35, 0); b.scale(1.15, 0.95, 1.15); b.ico(1.35, 0); b.pop();
      b.color(acc).tooth(0.35).emissive(0.5);
      for (var i = 0; i < 4 + t * 2; i++) {
        var a = (i / (4 + t * 2)) * U.TAU + 0.7;
        b.push();
        b.translate(Math.cos(a) * 1.15, 1.6 + Math.sin(i * 2.1) * 0.3, Math.sin(a) * 1.15);
        b.rotateZ(Math.cos(a) * 0.5); b.rotateX(Math.sin(a) * 0.5);
        b.shard(0.14, 0.7, 0.15, 4, 0);
        b.pop();
      }
      b.emissive(0);
      return {
        turret: function (tb) {
          tb.color('#241a33').tooth(0.95);
          tb.push(); tb.scale(1, 0.8, 1.2); tb.ico(0.85, 0); tb.pop();
          tb.color(acc).tooth(0.15).emissive(0.95);
          tb.push(); tb.translate(0, 0.15, 0.62); tb.shard(0.28, 0.34, 0.3, 5, 0); tb.pop();
          tb.emissive(0);
        },
        barrel: function (bb) {
          bb.color('#1b1526').tooth(0.8);
          bb.limb([0, 0, 0.3], [0, 0.12, 1.5 + t * 0.2], 0.24, 0.14, 5);
        },
        turretY: 2.55, muzzle: [0, 0.12, 1.7]
      };
    },

    maw: function (b, t, acc) {
      b.color(HULL.dark).tooth(1.0);
      b.prism(2.2, 2.05, 0.7, 6, 0);
      b.color('#170f22').tooth(1.0);
      b.push(); b.translate(0, 1.3, 0); b.scale(1.25, 1.0, 1.25); b.ico(1.45, 0); b.pop();
      return {
        turret: function (tb) {
          /* Two jaw halves that open on the wind-up. Modelled as one part
             each so the animation can hinge them. */
          tb.color('#241428').tooth(0.95);
          tb.push(); tb.scale(1.1, 0.75, 1.0); tb.ico(0.95, 0); tb.pop();
          tb.color(acc).tooth(0.1).emissive(1.0);
          tb.push(); tb.translate(0, 0, 0.5); tb.scale(0.8, 0.55, 0.5); tb.ico(0.6, 0); tb.pop();
          tb.emissive(0);
          /* Teeth. Count is the tier. */
          tb.color('#c9c2d8').tooth(0.3);
          var n = 5 + t * 2;
          for (var i = 0; i < n; i++) {
            var a = -0.9 + (i / (n - 1)) * 1.8;
            tb.push();
            tb.translate(Math.sin(a) * 0.9, 0.35, Math.cos(a) * 0.9);
            tb.rotateX(0.5); tb.rotateY(a);
            tb.cone(0.11, 0.5, 4, 0);
            tb.pop();
            tb.push();
            tb.translate(Math.sin(a) * 0.9, -0.35, Math.cos(a) * 0.9);
            tb.rotateX(Math.PI - 0.5); tb.rotateY(a);
            tb.cone(0.11, 0.5, 4, 0);
            tb.pop();
          }
        },
        barrel: null,
        turretY: 2.45, muzzle: [0, 0, 1.2]
      };
    },

    pyre: function (b, t, acc) {
      plinth(b, t);
      b.color(HULL.mid).tooth(1.0);
      b.frustum(2.0, 2.0, 1.7, 1.7, 1.0, 1.25);
      /* Fuel tanks, welded on at angles. The Pirates build like this. */
      b.color('#3a2318').tooth(0.9);
      for (var i = 0; i < 2 + t; i++) {
        var a = 2.3 + i * 0.9;
        b.push();
        b.translate(Math.cos(a) * 1.25, 1.85, Math.sin(a) * 1.25);
        b.rotateZ(0.14 * (i % 2 ? 1 : -1));
        b.prism(0.42, 0.4, 1.5, 6, -0.75);
        b.pop();
      }
      b.color(HULL.trim).tooth(0.7);
      b.push(); b.translate(0, 2.3, 0); b.box(1.5, 0.22, 1.5); b.pop();
      return {
        turret: function (tb) {
          tb.color(HULL.light).tooth(0.85);
          tb.box(1.25, 0.75, 1.35);
          tb.color('#4a2a1a').tooth(0.8);
          tb.push(); tb.translate(0, 0.5, -0.35); tb.prism(0.45, 0.42, 0.7, 6, 0); tb.pop();
        },
        barrel: function (bb) {
          bb.color(HULL.dark).tooth(0.6);
          bb.limb([0, 0, 0.2], [0, 0, 1.5], 0.22, 0.34, 6);
          bb.color(acc).tooth(0.1).emissive(0.9);
          bb.push(); bb.translate(0, 0, 1.6); bb.prism(0.36, 0.44, 0.22, 6, 0); bb.pop();
          bb.emissive(0);
          /* Pilot light: always lit, so the tower reads as armed at rest. */
          bb.color(acc).tooth(0).emissive(1.0);
          bb.push(); bb.translate(0.3, 0.22, 1.35); bb.shard(0.07, 0.2, 0.06, 4, 0); bb.pop();
          bb.emissive(0);
        },
        turretY: 2.6, muzzle: [0, 0, 1.85]
      };
    },

    cyclone: function (b, t, acc) {
      plinth(b, t);
      b.color(HULL.mid).tooth(0.95);
      b.prism(1.7, 1.5, 1.5, 6, 1.25);
      return {
        turret: function (tb) {
          tb.color(HULL.light).tooth(0.8);
          tb.prism(1.2, 1.15, 0.55, 8, 0);
          tb.color(HULL.trim).tooth(0.6);
          tb.ring(1.2, 1.5, 8, 0.3);
          tb.color(acc).tooth(0.15).emissive(0.7);
          tb.push(); tb.translate(0, 0.35, 0); tb.prism(0.35, 0.3, 0.3, 6, 0); tb.pop();
          tb.emissive(0);
        },
        /* The fan is the "barrel": it spins continuously, which is this
           tower's whole read at a distance. */
        barrel: function (bb) {
          bb.color(HULL.dark).tooth(0.45);
          var n = 3 + t;
          for (var i = 0; i < n; i++) {
            var a = (i / n) * U.TAU;
            bb.push();
            bb.rotateY(a);
            bb.translate(0, 0, 0.75);
            bb.rotateX(0.62);
            bb.box(0.55, 0.09, 1.35);
            bb.pop();
          }
          bb.color(HULL.trim);
          bb.prism(0.3, 0.26, 0.28, 6, -0.14);
        },
        turretY: 2.75, muzzle: [0, 0.4, 0]
      };
    },

    railgun: function (b, t, acc) {
      plinth(b, t, 2.35);
      b.color(HULL.mid).tooth(0.95);
      b.frustum(2.5, 1.9, 2.1, 1.5, 0.75, 1.25);
      /* Capacitor bank down one flank: cold, industrial, Parallel. */
      b.color(HULL.trim).tooth(0.75);
      for (var i = 0; i < 4; i++) {
        b.push(); b.translate(-1.5 + i * 1.0, 1.45, -1.15); b.prism(0.3, 0.28, 0.85, 6, 0); b.pop();
      }
      return {
        turret: function (tb) {
          tb.color(HULL.light).tooth(0.8);
          tb.box(1.35, 0.6, 2.1);
          tb.color(HULL.mid);
          tb.push(); tb.translate(0, 0.42, -0.75); tb.box(1.0, 0.55, 0.9); tb.pop();
          tb.color(acc).tooth(0.15).emissive(0.85);
          tb.push(); tb.translate(0, 0.5, -0.72); tb.box(0.45, 0.2, 0.14); tb.pop();
          tb.emissive(0);
        },
        barrel: function (bb) {
          /* Two parallel rails with a charged gap between them, which is the
             whole silhouette and the reason the name is legible. */
          bb.color(HULL.dark).tooth(0.5);
          var sep = 0.30, len = 3.4 + t * 0.5;
          bb.limb([sep, 0, 0], [sep, 0, len], 0.14, 0.11, 5);
          bb.limb([-sep, 0, 0], [-sep, 0, len], 0.14, 0.11, 5);
          if (t >= 2) {
            bb.limb([0, sep, 0], [0, sep, len], 0.12, 0.10, 5);
            bb.limb([0, -sep, 0], [0, -sep, len], 0.12, 0.10, 5);
          }
          bb.color(acc).tooth(0.05).emissive(1.0);
          for (var i = 1; i <= 3 + t; i++) {
            bb.push(); bb.translate(0, 0, (len / (4 + t)) * i); bb.box(0.5, 0.06, 0.09); bb.pop();
          }
          bb.emissive(0);
          bb.color(HULL.trim);
          bb.push(); bb.translate(0, 0, 0.2); bb.box(0.95, 0.55, 0.35); bb.pop();
        },
        turretY: 2.2, muzzle: [0, 0, 3.6 + t * 0.5]
      };
    },

    singularity: function (b, t, acc) {
      plinth(b, t);
      b.color(HULL.mid).tooth(0.9);
      /* A containment cage. The tower is the thing inside it. */
      for (var i = 0; i < 4 + t; i++) {
        var a = (i / (4 + t)) * U.TAU;
        b.push();
        b.translate(Math.cos(a) * 1.35, 1.25, Math.sin(a) * 1.35);
        b.rotateY(-a);
        b.rotateX(-0.3);
        b.box(0.22, 3.1, 0.3);
        b.pop();
      }
      b.color(HULL.trim).tooth(0.6);
      b.ring(1.05, 1.45, 9, 2.85);
      return {
        turret: function (tb) {
          /* Emissive is deliberately ZERO here and the colour is nearly black:
             a singularity that glows is a lamp. The read comes from the ring
             around it and from what it does to everything nearby. */
          tb.color('#05030a').tooth(0.0);
          tb.ico(0.62 + t * 0.08, 1);
          tb.color(acc).tooth(0.05).emissive(1.0);
          tb.ring(0.85 + t * 0.08, 1.0 + t * 0.08, 16, 0);
          tb.emissive(0);
        },
        barrel: null,
        turretY: 2.85, muzzle: [0, 0, 0]
      };
    },

    vault: function (b, t, acc) {
      plinth(b, t, 2.25);
      b.color(HULL.mid).tooth(1.0);
      b.box(3.0, 2.1, 2.4);
      b.push(); b.translate(0, 1.05, 0); b.pop();
      b.color(HULL.trim).tooth(0.8);
      b.push(); b.translate(0, 2.2, 0); b.box(3.15, 0.28, 2.55); b.pop();
      /* Ledger spools: one per tier, the visible income upgrade. */
      b.color(acc).tooth(0.2).emissive(0.7);
      for (var i = 0; i <= t; i++) {
        b.push();
        b.translate(-0.85 + i * 0.85, 2.62, 0);
        b.rotateX(Math.PI / 2);
        b.prism(0.3, 0.3, 0.34, 8, -0.17);
        b.pop();
      }
      b.emissive(0);
      return {
        turret: function (tb) {
          /* The door. Rotates slowly and opens on payout. */
          tb.color(HULL.light).tooth(0.85);
          tb.push(); tb.rotateX(Math.PI / 2); tb.prism(1.0, 0.95, 0.28, 8, -0.14); tb.pop();
          tb.color(acc).tooth(0.1).emissive(0.9);
          tb.push(); tb.rotateX(Math.PI / 2); tb.prism(0.34, 0.3, 0.34, 6, -0.17); tb.pop();
          tb.emissive(0);
          tb.color(HULL.trim);
          for (var i = 0; i < 4; i++) {
            var a = (i / 4) * U.TAU + 0.4;
            tb.push();
            tb.translate(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62);
            tb.box(0.16, 0.16, 0.5);
            tb.pop();
          }
        },
        barrel: null,
        turretY: 1.1, muzzle: [0, 0, 1.4]
      };
    }
  };

  /* Public tower accessor. Returns cached meshes plus the metadata the rig
     and the sim need. */
  function tower(id, tier) {
    var key = 'tower:' + id + ':' + tier;
    return memo(key, function () {
      var def = DATA.TOWERS[id];
      if (!def) throw new Error('MODELS.tower: unknown tower "' + id + '"');
      var builder = TOWER_BUILD[id];
      if (!builder) throw new Error('MODELS.tower: no builder for "' + id + '"');
      var acc = elementColor(def.element);

      var baseB = MESH.builder('tw:' + id + ':' + tier);
      var meta = builder(baseB, tier, acc);

      /* THE ELEMENT COLLAR. Added here rather than in each builder so it is
         identical on all fourteen towers: same height, same size, same shape.
         Reactions are the deepest system in the game and they are unplayable
         if the player cannot tell a frost tower from a storm tower at a
         glance, and the per-tower accents alone could not carry that: on a
         blue-grey hull the frost and kinetic accents disappeared entirely
         while radiant and void popped, so the readability of a tower depended
         on which element it happened to be.
         A collar is emissive, so it bypasses the lighting ramp and reads at
         any distance, in any faction palette, in shadow or out of it. */
      baseB.color(acc).tooth(0.05).emissive(1.0);
      baseB.ring(2.00, 2.34, 6, 0.60);
      baseB.emissive(0);

      var baseMesh = GL.mesh(baseB.build({ jitter: 0.028, mat: 'stone' }));

      var turretMesh = null, barrelMesh = null;
      if (meta.turret) {
        var tb = MESH.builder('tw:' + id + ':t:' + tier);
        meta.turret(tb);
        turretMesh = GL.mesh(tb.build({ jitter: 0.024, mat: 'hull' }));
      }
      if (meta.barrel) {
        var bb = MESH.builder('tw:' + id + ':b:' + tier);
        meta.barrel(bb);
        barrelMesh = GL.mesh(bb.build({ jitter: 0.02, mat: 'metal' }));
      }
      return {
        base: baseMesh, turret: turretMesh, barrel: barrelMesh,
        turretY: meta.turretY, muzzle: meta.muzzle,
        accent: U.hex2rgb(acc)
      };
    });
  }

  /* ---------- denizens ----------
     Four rig archetypes cover every enemy. Each is built once per (rig, scale
     bucket) and shared, with the faction only changing the emissive core
     colour, which is a uniform rather than geometry. */

  var DENIZEN_BUILD = {
    /* CRAWLER: low, four legs, fast. The chaff. */
    crawler: function (core) {
      return [
        { name: 'body', bind: [0, 1.12, 0], build: function (b) {
            b.color('#100c1c').tooth(0.95);
            b.push(); b.scale(1.0, 0.72, 1.35); b.ico(0.92, 0); b.pop();
            b.color('#1a1330');
            b.push(); b.translate(0, 0.26, -0.5); b.scale(0.8, 0.6, 0.7); b.ico(0.66, 0); b.pop();
          } },
        { name: 'core', parent: 'body', bind: [0, 0.08, 0.74], build: function (b) {
            b.color(core).tooth(0.05).emissive(1.0);
            b.shard(0.26, 0.36, 0.3, 5, 0);
          } },
        legs('crawler', 4, '#171126')
      ].flat();
    },
    /* WALKER: bipedal-ish, mid weight, the line infantry. */
    walker: function (core) {
      return [
        { name: 'body', bind: [0, 1.95, 0], build: function (b) {
            b.color('#100c1c').tooth(0.95);
            b.push(); b.scale(0.95, 1.15, 0.85); b.ico(1.02, 0); b.pop();
            b.color('#1a1330').tooth(0.9);
            b.push(); b.translate(0, 0.78, 0.14); b.scale(0.75, 0.55, 0.75); b.ico(0.72, 0); b.pop();
            b.color('#231a3d').tooth(0.85);
            b.push(); b.translate(0, -0.14, 0.78); b.box(1.05, 0.7, 0.4); b.pop();
          } },
        { name: 'head', parent: 'body', bind: [0, 1.22, 0.2], build: function (b) {
            b.color('#150f26').tooth(0.9);
            b.push(); b.scale(0.8, 0.7, 1.0); b.ico(0.52, 0); b.pop();
          } },
        { name: 'core', parent: 'head', bind: [0, 0.03, 0.44], build: function (b) {
            b.color(core).tooth(0.05).emissive(1.0);
            b.shard(0.23, 0.3, 0.24, 5, 0);
          } },
        legs('walker', 2, '#171126')
      ].flat();
    },
    /* STRIDER: tall, heavy, four long legs. Bosses and elites. */
    strider: function (core) {
      return [
        { name: 'body', bind: [0, 2.4, 0], build: function (b) {
            b.color('#0d0918').tooth(1.0);
            b.push(); b.scale(1.35, 0.95, 1.7); b.ico(0.95, 0); b.pop();
            b.color('#191128').tooth(0.95);
            b.push(); b.translate(0, 0.6, -0.2); b.scale(1.0, 0.7, 1.1); b.ico(0.72, 0); b.pop();
            /* Carapace plates: the heavy silhouette. */
            b.color('#241a3d').tooth(0.9);
            for (var i = 0; i < 5; i++) {
              var a = -0.9 + i * 0.45;
              b.push();
              b.translate(Math.sin(a) * 1.0, 0.72, Math.cos(a) * 0.5 - 0.1);
              b.rotateY(a); b.rotateX(-0.5);
              b.box(0.5, 0.14, 0.85);
              b.pop();
            }
          } },
        { name: 'head', parent: 'body', bind: [0, 0.35, 1.35], build: function (b) {
            b.color('#150f26').tooth(0.9);
            b.push(); b.scale(0.9, 0.75, 1.2); b.ico(0.5, 0); b.pop();
            b.color('#c9c2d8').tooth(0.3);
            for (var i = 0; i < 4; i++) {
              var a = -0.5 + i * 0.33;
              b.push(); b.translate(Math.sin(a) * 0.36, -0.2, 0.42); b.rotateX(1.4); b.cone(0.07, 0.4, 4, 0); b.pop();
            }
          } },
        { name: 'core', parent: 'head', bind: [0, 0.18, 0.3], build: function (b) {
            b.color(core).tooth(0.05).emissive(1.0);
            b.shard(0.22, 0.3, 0.24, 6, 0);
          } },
        legs('strider', 4, '#151024')
      ].flat();
    },
    /* FLYER: no legs, a hovering hull with vanes. */
    flyer: function (core) {
      return [
        { name: 'body', bind: [0, 2.9, 0], build: function (b) {
            b.color('#100c1c').tooth(0.9);
            b.push(); b.scale(1.25, 0.45, 1.5); b.ico(0.88, 0); b.pop();
            b.color('#1a1330').tooth(0.85);
            b.push(); b.translate(0, 0.22, -0.28); b.scale(0.7, 0.4, 0.7); b.ico(0.6, 0); b.pop();
          } },
        { name: 'vaneL', parent: 'body', bind: [0.88, 0.02, -0.14], build: function (b) {
            b.color('#231a3d').tooth(0.75);
            b.push(); b.rotateZ(-0.25); b.box(1.6, 0.12, 0.86); b.pop();
          } },
        { name: 'vaneR', parent: 'body', bind: [-0.88, 0.02, -0.14], build: function (b) {
            b.color('#231a3d').tooth(0.75);
            b.push(); b.rotateZ(0.25); b.box(1.6, 0.12, 0.86); b.pop();
          } },
        { name: 'core', parent: 'body', bind: [0, -0.03, 0.8], build: function (b) {
            b.color(core).tooth(0.05).emissive(1.0);
            b.shard(0.24, 0.32, 0.26, 5, 0);
          } }
      ];
    }
  };

  /* Leg part generator shared by the three walking rigs. Upper and lower are
     SIBLINGS rather than parent and child, because the IK solver writes each
     bone an absolute aim in the creature's local space and composing that
     through a parent would require inverting the parent every frame for no
     visual gain. See the note in 07-rig.js driveLeg. */
  function legs(rigType, count, col) {
    var D = RIG_DIMS[rigType];
    var out = [];
    for (var i = 0; i < count; i++) {
      var side = (i % 2) ? 1 : -1;
      var row = Math.floor(i / 2);
      var zOff = count > 2 ? (row === 0 ? D.zOff : -D.zOff) : 0;
      (function (idx, sx, sz) {
        out.push({
          name: 'legU' + idx, bind: [D.spread * sx, D.hipY, sz],
          build: function (b) {
            b.color(col).tooth(0.8);
            b.limb([0, 0, 0], [0, -D.upper, 0], D.radius, D.radius * 0.78, 4);
          }
        });
        out.push({
          name: 'legL' + idx, bind: [D.spread * sx, D.hipY, sz],
          build: function (b) {
            b.color(col).tooth(0.8);
            b.limb([0, 0, 0], [0, -D.lower, 0], D.radius * 0.78, D.radius * 0.54, 4);
            /* A foot. Without one the leg ends in a point and the contact with
               the ground has nothing to read against. */
            b.push(); b.translate(0, -D.lower, D.radius * 0.5);
            b.box(D.radius * 2.0, D.radius * 0.9, D.radius * 3.0); b.pop();
          }
        });
      })(i, side, zOff);
    }
    return out;
  }

  /* Build (and cache) the mesh set for a denizen archetype. The faction only
     changes the core colour. */
  function denizen(rigType, faction) {
    var key = 'den:' + rigType + ':' + faction;
    return memo(key, function () {
      var pal = PAINT.FACTIONS[faction] || PAINT.FACTIONS.xeno;
      var builder = DENIZEN_BUILD[rigType];
      if (!builder) throw new Error('MODELS.denizen: unknown rig "' + rigType + '"');
      var spec = builder(pal.accent);
      var parts = [];
      for (var i = 0; i < spec.length; i++) {
        var s = spec[i];
        var b = MESH.builder('den:' + rigType + ':' + faction + ':' + s.name);
        s.build(b);
        var data = b.build({ jitter: 0.022, mat: s.mat || (s.name === 'core' ? 'energy' : 'organic') });
        parts.push({
          name: s.name,
          parent: s.parent || null,
          bind: s.bind,
          /* Only the trunk goes in the shadow map. See RIG.draw. */
          cast: /^(body|head)$/.test(s.name),
          mesh: GL.mesh(data),
          /* The raw vertex data is retained alongside the uploaded mesh so the
             death effect can read the model's own facets back out and throw
             them individually. GL.mesh uploads and then forgets, so without
             this the shatter has nothing to shatter, and the central visual
             idea of the whole art direction (a body comes apart into the brush
             strokes it was painted with) has no data to work from. */
          data: data
        });
      }
      return { parts: parts, rigType: rigType };
    });
  }

  /* ---------- projectiles and shared props ---------- */
  function projectile(kind, colorHex) {
    var key = 'proj:' + kind + ':' + colorHex;
    return memo(key, function () {
      var b = MESH.builder(key);
      b.color(colorHex).tooth(0.05).emissive(1.0);
      if (kind === 'shell') b.ico(0.28, 0);
      else if (kind === 'bolt') b.shard(0.10, 0.42, 0.14, 4, 0);
      else b.shard(0.08, 0.3, 0.1, 4, 0);
      return GL.mesh(b.build({ jitter: 0.01 }));
    });
  }

  function ring(rInner, rOuter, segs, colorHex) {
    var key = 'ring:' + rInner + ':' + rOuter + ':' + segs + ':' + colorHex;
    return memo(key, function () {
      var b = MESH.builder(key);
      b.color(colorHex);
      b.ring(rInner, rOuter, segs, 0);
      return GL.mesh(b.build({ jitter: 0 }));
    });
  }

  function beam(colorHex) {
    return memo('beam:' + colorHex, function () {
      var b = MESH.builder('beam:' + colorHex);
      b.color(colorHex).tooth(0).emissive(1.0);
      /* A UNIT BEAM FROM THE ORIGIN TO (0,0,1), ALONG +Z.
         The axis is load bearing. GAME.drawBeam builds a matrix whose THIRD
         column carries the beam direction and its length, so the mesh's long
         axis has to be Z. This was authored with prism(), which extrudes along
         +Y, and the mismatch mapped the mesh's long axis onto the perpendicular
         and its cross-section radius onto the length. Measured with
         tools/beamgeom.js: on a 20 unit beam the geometry stopped 12.93 units
         short of the target and extended 7.07 units BACKWARD through the tower.
         Every beam, sweep, chain arc and hitscan trail in the game was drawing
         a stub. limb() takes explicit endpoints, so the axis cannot drift
         again, and beamgeom.js asserts the primitive as well as the result. */
      b.limb([0, 0, 0], [0, 0, 1], 0.5, 0.5, 4);
      return GL.mesh(b.build({ jitter: 0 }));
    });
  }

  function dome(colorHex) {
    return memo('dome:' + colorHex, function () {
      var b = MESH.builder('dome:' + colorHex);
      b.color(colorHex);
      b.lathe([[0, 1], [0.45, 0.92], [0.78, 0.68], [0.95, 0.35], [1.0, 0]], 12);
      return GL.mesh(b.build({ jitter: 0 }));
    });
  }

  /* The goal marker: what the denizens are walking toward, and the thing the
     player is defending. It has to read as important from the first frame. */
  function goalMesh(accentHex) {
    return memo('goal:' + accentHex, function () {
      var b = MESH.builder('goal:' + accentHex);
      b.color(HULL.dark).tooth(1.0);
      b.prism(3.1, 2.7, 1.0, 8, 0);
      b.color(HULL.mid).tooth(0.9);
      b.prism(2.4, 1.7, 1.6, 8, 1.0);
      b.color(HULL.trim).tooth(0.7);
      b.ring(1.75, 2.25, 8, 2.6);
      b.color(accentHex).tooth(0.05).emissive(1.0);
      b.push(); b.translate(0, 4.3, 0); b.shard(0.85, 2.1, 1.5, 6, 0); b.pop();
      b.emissive(0);
      b.color(HULL.light).tooth(0.8);
      for (var i = 0; i < 4; i++) {
        var a = (i / 4) * U.TAU + 0.4;
        b.push();
        b.translate(Math.cos(a) * 1.9, 2.6, Math.sin(a) * 1.9);
        b.rotateY(-a); b.rotateX(-0.18);
        b.box(0.28, 2.6, 0.4);
        b.pop();
      }
      return GL.mesh(b.build({ jitter: 0.03 }));
    });
  }

  function spawnMesh(accentHex) {
    return memo('spawn:' + accentHex, function () {
      var b = MESH.builder('spawn:' + accentHex);
      b.color('#0a0714').tooth(1.0);
      b.prism(3.3, 3.0, 0.7, 7, 0);
      b.color('#150d22').tooth(0.95);
      for (var i = 0; i < 5; i++) {
        var a = (i / 5) * U.TAU + 0.2;
        b.push();
        b.translate(Math.cos(a) * 2.2, 0.5, Math.sin(a) * 2.2);
        b.rotateY(-a); b.rotateZ(Math.cos(a * 2) * 0.3);
        b.prism(0.5, 0.18, 3.4 + (i % 3), 5, 0);
        b.pop();
      }
      b.color(accentHex).tooth(0.05).emissive(1.0);
      b.ring(1.5, 2.1, 14, 0.75);
      return GL.mesh(b.build({ jitter: 0.05 }));
    });
  }

  function clearCache() {
    for (var k in cache) delete cache[k];
  }

  return {
    tower: tower,
    denizen: denizen,
    projectile: projectile,
    ring: ring,
    beam: beam,
    dome: dome,
    goalMesh: goalMesh,
    spawnMesh: spawnMesh,
    elementColor: elementColor,
    HULL: HULL,
    RIG_DIMS: RIG_DIMS,
    clearCache: clearCache
  };
})();


