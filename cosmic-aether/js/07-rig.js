/* RELIQUARY :: 07-rig
   Procedural skeletal animation.

   WHY NOT VERTEX SKINNING. Every model in this game is low-poly and built from
   separate rigid pieces, so a bone can simply own a whole mesh and be drawn
   with its own matrix. That removes the entire skinning pipeline (weights,
   bind poses, a skinning shader, a bone texture) and costs nothing visually
   at this facet density. It also keeps the hard facet edges intact, which
   smooth skinning would soften at exactly the joints where this art direction
   wants them sharpest.

   WHAT MAKES ANIMATION READ AS EXPENSIVE. Not bone count. Four things, all of
   which are here:

   1. FEET THAT PLANT. A walk cycle where the foot slides along the ground is
      the single loudest tell of cheap animation. Legs here are driven by
      two-bone IK to a foot TARGET that is stationary in world space during
      the stance phase, so the foot is genuinely planted and the body moves
      over it.

   2. WEIGHT. The body bobs twice per stride, dips on the loaded leg, and
      leans into turns and acceleration. A body that translates at constant
      height reads as a hovering prop.

   3. OVERLAP AND FOLLOW-THROUGH. Heads, tails and antennae lag the body by a
      few frames through a spring, so nothing starts and stops at once.

   4. ANTICIPATION. An attack winds back before it strikes. Without it a hit
      lands with no readable cause.

   All of it is procedural: there is not a single authored keyframe in this
   project, which is what keeps the whole game inside one HTML file. */
'use strict';

var RIG = (function () {

  var V = U.V;

  /* ---------- two-bone IK ----------
     Solves for the knee/elbow angle that puts the end effector at `target`,
     in the plane defined by the root, the target and a pole vector.

     The law of cosines gives the joint angles directly. The only subtlety is
     the clamp: when the target is further than the limb can reach, the naive
     acos returns NaN and the leg vanishes. Clamping the cosine keeps the limb
     straight and stretched toward the target, which is also what a real leg
     does at full extension. */
  function ik2(rootPos, target, len1, len2, poleDir) {
    var toTarget = V.sub(target, rootPos);
    var dist = V.len(toTarget);
    var maxReach = len1 + len2 - 1e-4;
    var minReach = Math.abs(len1 - len2) + 1e-4;
    if (dist > maxReach) { dist = maxReach; }
    if (dist < minReach) { dist = minReach; }
    var dir = V.len(toTarget) > 1e-6 ? V.scale(toTarget, 1 / V.len(toTarget)) : [0, -1, 0];
    var clampedTarget = V.add(rootPos, V.scale(dir, dist));

    /* Angle at the root between the limb's first bone and the root-to-target
       line. cos A = (len1^2 + dist^2 - len2^2) / (2 * len1 * dist) */
    var cosA = (len1 * len1 + dist * dist - len2 * len2) / (2 * len1 * dist);
    cosA = U.clamp(cosA, -1, 1);
    var a = Math.acos(cosA);

    /* Build an orthonormal basis: along the target, and a bend axis derived
       from the pole. The pole is what stops the knee choosing an arbitrary
       rotation about the target axis, which is the classic IK popping bug. */
    var pole = poleDir || [0, 0, 1];
    var side = V.cross(dir, pole);
    if (V.len2(side) < 1e-8) {
      side = V.cross(dir, [1, 0, 0]);
      if (V.len2(side) < 1e-8) side = V.cross(dir, [0, 0, 1]);
    }
    side = V.norm(side);
    var bendAxis = V.norm(V.cross(side, dir));

    var kneeDir = V.add(V.scale(dir, Math.cos(a)), V.scale(bendAxis, Math.sin(a)));
    var knee = V.add(rootPos, V.scale(kneeDir, len1));
    return { knee: knee, foot: clampedTarget, stretched: V.len(toTarget) > maxReach };
  }

  /* ---------- gait ----------
     A foot's position over one stride. `phase` is 0..1. The foot is in STANCE
     for `duty` of the cycle (planted, moving backward relative to the body at
     exactly body speed, so it does not slide) and in SWING for the rest,
     arcing forward and up.

     Returning the planted flag matters: the caller uses it to decide when to
     kick up dust and when to apply the body's weight dip. */
  function gait(phase, strideLen, liftHeight, duty) {
    duty = duty === undefined ? 0.62 : duty;
    phase = phase - Math.floor(phase);
    if (phase < duty) {
      /* STANCE. Travels from +half a stride to -half a stride, linearly, which
         is what keeps the foot stationary in world space while the body
         advances at constant speed. Any easing here reintroduces sliding. */
      var t = phase / duty;
      return {
        x: strideLen * (0.5 - t),
        y: 0,
        planted: true,
        t: t
      };
    }
    /* SWING. A raised cosine forward, and a sine arc upward with a slight
       forward bias so the foot reaches its peak before mid-swing, the way a
       real leg does. */
    var s = (phase - duty) / (1 - duty);
    var eased = s * s * (3 - 2 * s);
    return {
      x: strideLen * (-0.5 + eased),
      y: Math.sin(Math.pow(s, 0.85) * Math.PI) * liftHeight,
      planted: false,
      t: s
    };
  }

  /* ---------- spring ----------
     A critically damped spring, used for every piece of secondary motion.
     Returns the new [value, velocity]. Critically damped because overshoot on
     a head or a turret reads as wobble, not as weight. */
  function spring(cur, vel, target, stiffness, dt) {
    var damping = 2 * Math.sqrt(stiffness);
    var accel = (target - cur) * stiffness - vel * damping;
    vel += accel * dt;
    cur += vel * dt;
    return [cur, vel];
  }

  function spring3(cur, vel, target, stiffness, dt) {
    for (var i = 0; i < 3; i++) {
      var r = spring(cur[i], vel[i], target[i], stiffness, dt);
      cur[i] = r[0]; vel[i] = r[1];
    }
  }

  /* ---------- part tree ----------
     A model is a flat list of parts, each naming its parent. Parts must be
     declared after their parent so a single forward pass resolves every world
     matrix, which is enforced rather than assumed: an out-of-order parent
     would silently animate against the previous frame's matrix, a bug that
     looks like mysterious one-frame lag. */
  function build(spec) {
    var parts = [];
    var byName = Object.create(null);
    for (var i = 0; i < spec.length; i++) {
      var s = spec[i];
      var parentIdx = -1;
      if (s.parent) {
        if (!(s.parent in byName)) {
          throw new Error('RIG: part "' + s.name + '" names parent "' + s.parent +
            '" which is not declared before it');
        }
        parentIdx = byName[s.parent];
      }
      byName[s.name] = parts.length;
      parts.push({
        name: s.name,
        parent: parentIdx,
        mesh: s.mesh || null,
        /* bind: the rest offset of this part from its parent */
        bind: s.bind || [0, 0, 0],
        /* animated local transform, written by the pose function each frame */
        pos: [0, 0, 0],
        rot: [0, 0, 0],
        scl: [1, 1, 1],
        /* scratch */
        local: U.m4ident(),
        world: U.m4ident(),
        hidden: !!s.hidden,
        emissive: s.emissive || 0,
        /* Whether this part goes into the shadow map. A creature only needs
           its body and head there: the legs are thin enough that their cast
           shadow is invisible at play distance, and they are eight of its ten
           draws. */
        cast: s.cast !== false,
        /* free-form per-part state for springs */
        v: [0, 0, 0],
        s: [0, 0, 0]
      });
    }
    return {
      parts: parts,
      byName: byName,
      get: function (n) {
        var idx = byName[n];
        return idx === undefined ? null : parts[idx];
      }
    };
  }

  /* Reset every part to its bind pose. Called at the top of each pose
     function so a pose that forgets to write a joint gets the rest value
     rather than last frame's, which is how animation state leaks between
     two different actions and produces drift over minutes of play. */
  function rest(rig) {
    for (var i = 0; i < rig.parts.length; i++) {
      var p = rig.parts[i];
      p.pos[0] = 0; p.pos[1] = 0; p.pos[2] = 0;
      p.rot[0] = 0; p.rot[1] = 0; p.rot[2] = 0;
      p.scl[0] = 1; p.scl[1] = 1; p.scl[2] = 1;
      p.hidden = false;
    }
  }

  /* Resolve world matrices for the whole tree given a root transform. */
  function resolve(rig, rootMatrix) {
    for (var i = 0; i < rig.parts.length; i++) {
      var p = rig.parts[i];
      U.m4trs(
        p.bind[0] + p.pos[0], p.bind[1] + p.pos[1], p.bind[2] + p.pos[2],
        p.rot[0], p.rot[1], p.rot[2],
        p.scl[0], p.scl[1], p.scl[2],
        p.local
      );
      if (p.parent < 0) U.m4mul(rootMatrix, p.local, p.world);
      else U.m4mul(rig.parts[p.parent].world, p.local, p.world);
    }
  }

  /* Submit every visible part. `opts` is passed through to R.push so a whole
     creature can flash or dissolve as one. */
  function draw(rig, opts) {
    var castAll = !opts || opts.castShadow !== false;
    for (var i = 0; i < rig.parts.length; i++) {
      var p = rig.parts[i];
      if (p.hidden || !p.mesh) continue;
      /* Mutating the shared opts object per part would be a per-frame
         allocation for every rig; the flag is written and restored instead. */
      var prev = opts.castShadow;
      opts.castShadow = castAll && p.cast;
      R.push(p.mesh, p.world, opts);
      opts.castShadow = prev;
    }
  }

  /* ---------- leg driver ----------
     Wraps gait + ik2 for a limb whose root is a part in the tree. Writes the
     upper and lower bone rotations so they point along the solved segments.

     Bones are modelled as pointing down -Y in their bind pose, which matches
     how the limb primitive is authored in the model files. */
  function driveLeg(rig, upperName, lowerName, hipLocal, footTarget, len1, len2, poleDir) {
    var upper = rig.get(upperName), lower = rig.get(lowerName);
    if (!upper || !lower) return null;
    var sol = ik2(hipLocal, footTarget, len1, len2, poleDir || [0, 0, 1]);

    /* AIM A BONE ALONG A DIRECTION, DERIVED RATHER THAN GUESSED.
       A bone is modelled pointing along -Y. U.m4trs composes YXZ, so with
       roll zero the transformed -Y axis works out to
           (-sin(ry)sin(rx), -cos(rx), -cos(ry)sin(rx))
       Setting that equal to the desired unit direction d gives
           cos(rx) = -d.y        so  rx = acos(-d.y)
           sin(ry) = -d.x/sin(rx)
           cos(ry) = -d.z/sin(rx)   so  ry = atan2(-d.x, -d.z)

       The previous version used atan2(d.x, d.z) with a pitch of
       acos(-d.y) - PI. Those two errors are each a half turn and CANCEL for
       axis-aligned directions, which is why straight-down and straight-forward
       bones looked fine and nothing obviously broke. For a general direction
       they do not cancel: aiming at a unit direction of (0.707, -0.707, 0)
       produced (0.707, +0.707, 0), with the vertical component inverted.

       Measured before the fix, on a strider whose entire leg is 2.88 units
       long: the distance from where the IK asked for the foot to where the rig
       actually put it was 1.86, 4.74, 3.83 and 5.01 units on its four legs.
       The legs were not walking badly, they were in arbitrary poses, and no
       amount of gait tuning above this could have helped. */
    function aim(from, to, part) {
      var d = V.norm(V.sub(to, from));
      var rx = Math.acos(U.clamp(-d[1], -1, 1));
      var sx = Math.sin(rx);
      /* Degenerate when the bone points straight up or straight down: any yaw
         gives the same axis, so keep the previous one rather than snapping. */
      var ry = (sx > 1e-5) ? Math.atan2(-d[0], -d[2]) : part.rot[1];
      part.rot[0] = rx;
      part.rot[1] = ry;
      part.rot[2] = 0;
      return { yaw: ry, pitch: rx };
    }
    aim(hipLocal, sol.knee, upper);
    /* The lower bone is a child of the upper, so its rotation must be
       expressed relative to the parent. Rather than compose inverses, the
       lower bone is authored as a SIBLING in every model that uses this,
       positioned at the knee. That keeps the maths readable and costs one
       extra part per limb. */
    lower.pos[0] = sol.knee[0] - lower.bind[0];
    lower.pos[1] = sol.knee[1] - lower.bind[1];
    lower.pos[2] = sol.knee[2] - lower.bind[2];
    aim(sol.knee, sol.foot, lower);
    return sol;
  }

  return {
    build: build,
    rest: rest,
    resolve: resolve,
    draw: draw,
    ik2: ik2,
    gait: gait,
    spring: spring,
    spring3: spring3,
    driveLeg: driveLeg
  };
})();


