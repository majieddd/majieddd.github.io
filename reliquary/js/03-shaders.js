/* RELIQUARY :: 03-shaders
   Every GLSL source in the project. This is the file that decides what the
   game LOOKS like, so the reasoning is written down next to the code.

   THE PROBLEM
   Low-poly 3D defaults to a clean, cheerful, vector-art look: smooth ramps,
   pastel palettes, ambient occlusion, soft shadows. That is the opposite of
   this universe. The ART-BIBLE style law asks for a painted cutscene
   illustration: flat interlocking shapes, the drawing carried by heavy shadow
   masses, hard cel edges, spot blacks, screen-print grain, and colour that is
   faction identity before it is anything else.

   THE SOLUTION, in the order the fragment shader applies it:

   1. WRAP-LIT, THEN POSTERISED. Lighting is wrapped (n dot l remapped to 0..1
      rather than clamped) so the terminator is wide, then quantised to a small
      number of hard bands. Wrapping first is what gives the big readable
      shadow mass; quantising second is what gives the cel edge.

   2. THE BAND BOUNDARY IS JITTERED PER FACET. Each triangle carries a stable
      random seed. That seed nudges where the band boundary falls for that
      facet alone, so two coplanar-ish facets of the same paint land on
      different steps. This is the single trick that makes the result read as
      knife strokes instead of as a shaded polyhedron, and it costs one add.

   3. SHADOWS ARE HUED, NEVER BLACK. The dark end of the ramp is a mix toward
      a saturated void-violet, not toward zero. The plates in this universe
      have purple and magenta living inside their blacks, and a neutral shadow
      instantly reads as generic 3D.

   4. RIM LIGHT IN THE FACTION KEY. A Fresnel rim in the faction's neon,
      biased toward the light side. This is what separates a silhouette from
      the background, which the style law demands happen before detail is read.

   5. A WET SPECULAR. A narrow, also-posterised Blinn lobe. Oil paint is
      glossy; this is the catch-light on the ridge of a knife stroke, and it
      is why the surfaces read as wet rather than as matte cardboard.

   6. PAINT TOOTH. Triplanar canvas-weave noise modulating value, weighted per
      facet by aux.y, so stone and hull carry texture while glass and energy
      stay clean.

   Post then adds ink outlines (Sobel over depth and normals), bloom, a
   screen-space canvas grain, halftone dots that only bite in the shadow
   bands, chromatic aberration and a vignette. */
'use strict';

var SH = (function () {

  /* ---------- shared chunks ---------- */

  /* Hash and value noise. Used for paint tooth and for the sky. Kept cheap:
     this runs per pixel on every surface in the scene. */
  var NOISE = [
    'float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }',
    'float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }',
    'vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));',
    '  p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash12(i), hash12(i + vec2(1,0)), u.x),',
    '             mix(hash12(i + vec2(0,1)), hash12(i + vec2(1,1)), u.x), u.y);',
    '}',
    'float fbm(vec2 p){',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 4; i++){ v += a * vnoise(p); p *= 2.03; a *= 0.5; }',
    '  return v;',
    '}'
  ].join('\n');

  /* The posterised ramp, shared by the mesh pass and by anything that needs to
     match it (the tower preview thumbnails, the shatter facets). Extracted so
     there is exactly ONE definition of what this game's light looks like: two
     copies would drift apart the first time the art direction was tuned. */
  var RAMP = [
    'uniform float uBands;',
    'uniform float uRampGamma;',
    'uniform float uFacetJitter;',
    'uniform vec3  uShadowColor;',
    'uniform vec3  uLightColor;',
    'uniform float uShadowLift;',
    '',
    'float posterise(float ndl, float seed){',
    /* Wrap lighting: remap -1..1 to 0..1 rather than clamping at zero. The
       back of a form keeps a readable value instead of going flat black, and
       the terminator becomes a wide band that the quantiser can carve up. */
    '  float t = ndl * 0.5 + 0.5;',
    '  t = pow(clamp(t, 0.0, 1.0), uRampGamma);',
    /* The per-facet band offset. Centred on zero so the mean brightness of a
       surface is unchanged and only its internal break-up varies. */
    '  t += (seed - 0.5) * uFacetJitter;',
    '  t = clamp(t, 0.0, 0.9999);',
    '  return floor(t * uBands) / max(1.0, uBands - 1.0);',
    '}',
    '',
    'vec3 rampColor(float q, vec3 albedo){',
    /* Three stops, sampled by the already-quantised t, so the mixes never
       produce a gradient: they only choose which of a few discrete colours
       this facet is painted with.

       THE LIT STOP KEEPS ALBEDO DOMINANT (mix 0.18, not the 0.28 an earlier
       pass used). Pushing the lit band hard toward the light colour makes
       every surface converge on the same off-white in its highlights, which
       throws away exactly the thing the style law puts first: a scene has to
       read as its faction in the first half second. A cyan tower and a gold
       tower whose lit faces are both near-white do not.

       The deep stop is nearly pure hued shadow (shadowLift 0.24), which is
       what "the drawing is carried by heavy shadow masses" means in a
       shader. */
    /* THE LIT STOP STAYS NEAR THE ALBEDO. At mix 0.18 and a 1.30 multiplier
       the lit band landed around 0.48 luminance for a 0.13 albedo: a dark
       violet ground rendered as pale lavender, because the ramp was doing the
       job of a light source instead of the job of a palette. The reference
       plates are dark AND saturated at the same time, which is only possible
       if the lit band is the albedo's own colour with a little light in it,
       not a march toward white. */
    '  vec3 deep = mix(uShadowColor, albedo * 0.22, uShadowLift);',
    '  vec3 mid  = albedo * 0.62;',
    '  vec3 lite = mix(albedo, uLightColor, 0.11) * 1.07;',
    '  return q < 0.5 ? mix(deep, mid, q * 2.0) : mix(mid, lite, (q - 0.5) * 2.0);',
    '}'
  ].join('\n');

  /* ---------- main mesh pass ---------- */

  var MESH_VS = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec3 aPos;',
    'layout(location=1) in vec3 aNrm;',
    'layout(location=2) in vec3 aCol;',
    'layout(location=3) in vec3 aAux;',
    '',
    'uniform mat4 uProj, uView, uModel, uLightVP;',
    'uniform mat3 uNormalMat;',
    'uniform vec3 uTint;',
    'uniform float uTintMix;',
    /* Dissolve drives both the spawn-in and the death burn. Kept in the vertex
       stage as well as the fragment stage because the facet also PUSHES along
       its normal as it burns, which is what makes a unit come apart into
       strokes rather than simply fade. */
    'uniform float uDissolve;',
    'uniform float uExplode;',
    '',
    'out vec3 vWorld;',
    'out vec3 vView;',
    'flat out vec3 vNormal;',
    'flat out vec3 vAlbedo;',
    'flat out float vSeed;',
    'flat out float vTooth;',
    'flat out float vEmis;',
    'out vec4 vShadowCoord;',
    '',
    'void main(){',
    '  vec3 nrm = normalize(uNormalMat * aNrm);',
    '  vec3 pos = aPos + aNrm * uExplode;',
    '  vec4 world = uModel * vec4(pos, 1.0);',
    '  vWorld = world.xyz;',
    '  vNormal = nrm;',
    '  vAlbedo = mix(aCol, uTint, uTintMix);',
    '  vSeed = aAux.x;',
    '  vTooth = aAux.y;',
    '  vEmis = aAux.z;',
    '  vShadowCoord = uLightVP * world;',
    '  vec4 vp = uView * world;',
    '  vView = vp.xyz;',
    '  gl_Position = uProj * vp;',
    '}'
  ].join('\n');

  var MESH_FS = [
    '#version 300 es',
    'precision highp float;',
    'precision highp sampler2DShadow;',
    '',
    'in vec3 vWorld;',
    'in vec3 vView;',
    'flat in vec3 vNormal;',
    'flat in vec3 vAlbedo;',
    'flat in float vSeed;',
    'flat in float vTooth;',
    'flat in float vEmis;',
    'in vec4 vShadowCoord;',
    '',
    'layout(location=0) out vec4 oColor;',
    'layout(location=1) out vec4 oNormal;',
    '',
    'uniform vec3 uLightDir;',
    'uniform vec3 uCamPos;',
    'uniform vec3 uRimColor;',
    'uniform float uRimStrength;',
    'uniform float uRimScale;',
    'uniform float uRimPower;',
    'uniform vec3 uAmbientSky;',
    'uniform vec3 uAmbientGround;',
    'uniform float uAmbient;',
    'uniform float uSpecStrength;',
    'uniform float uSpecPower;',
    'uniform sampler2DShadow uShadow;',
    'uniform float uShadowTexel;',
    'uniform float uShadowStrength;',
    'uniform sampler2D uTooth;',
    'uniform float uToothScale;',
    'uniform float uToothStrength;',
    'uniform float uTime;',
    'uniform float uFlash;',
    'uniform vec3 uFlashColor;',
    'uniform float uDissolve;',
    'uniform vec3 uDissolveColor;',
    'uniform float uFogDensity;',
    'uniform vec3 uFogColor;',
    'uniform float uAlpha;',
    'uniform float uDebugMode;',
    '',
    NOISE,
    RAMP,
    '',
    /* Five-tap PCF in a plus pattern. The hardware comparison sampler already
       gives bilinear filtering inside each tap, so five taps buys a soft edge
       that looks like about twenty. A wider kernel is wasted here because the
       shadow is going to be posterised into the ramp anyway. */
    'float shadowVis(){',
    '  vec3 pc = vShadowCoord.xyz / vShadowCoord.w;',
    '  pc = pc * 0.5 + 0.5;',
    '  if (pc.z > 1.0 || pc.x < 0.0 || pc.x > 1.0 || pc.y < 0.0 || pc.y > 1.0) return 1.0;',
    /* Slope-scaled bias. A constant bias either peters out into acne on
       surfaces facing the light edge-on, or detaches contact shadows on
       surfaces facing it square. */
    '  float ndl = max(dot(vNormal, uLightDir), 0.0);',
    '  float bias = mix(0.0035, 0.0006, ndl);',
    '  float z = pc.z - bias;',
    '  float s = texture(uShadow, vec3(pc.xy, z));',
    '  s += texture(uShadow, vec3(pc.xy + vec2( uShadowTexel, 0.0), z));',
    '  s += texture(uShadow, vec3(pc.xy + vec2(-uShadowTexel, 0.0), z));',
    '  s += texture(uShadow, vec3(pc.xy + vec2(0.0,  uShadowTexel), z));',
    '  s += texture(uShadow, vec3(pc.xy + vec2(0.0, -uShadowTexel), z));',
    '  return s * 0.2;',
    '}',
    '',
    /* Triplanar so the tooth follows the surface without any UVs, which the
       procedural meshes do not have and would be a lot of code to give them.
       The blend weights are raised to a power so the seams between the three
       projections are narrow. */
    'float toothSample(vec3 p, vec3 n){',
    '  vec3 w = pow(abs(n), vec3(4.0));',
    '  w /= max(w.x + w.y + w.z, 1e-4);',
    '  float x = texture(uTooth, p.zy * uToothScale).r;',
    '  float y = texture(uTooth, p.xz * uToothScale).r;',
    '  float z = texture(uTooth, p.xy * uToothScale).r;',
    '  return x * w.x + y * w.y + z * w.z;',
    '}',
    '',
    'void main(){',
    '  vec3 N = normalize(vNormal);',
    '  vec3 Vd = normalize(uCamPos - vWorld);',
    '  vec3 L = normalize(uLightDir);',
    '',
    /* DISSOLVE. A noise threshold over world position. Facets vanish in a
       ragged front with a hot emissive edge, which is the death effect and
       also (played backwards) the build-in effect.
       Computed ONCE and reused below for the burn edge: an earlier draft
       evaluated this same fbm twice per fragment, which is four octaves of
       noise paid for and thrown away on every lit pixel in the scene. */
    '  float dNoise = 0.0;',
    '  if (uDissolve > 0.0){',
    '    dNoise = fbm(vWorld.xz * 3.1 + vWorld.y * 2.0) * 0.7 + vSeed * 0.3;',
    '    if (dNoise < uDissolve) discard;',
    '  }',
    '',
    '  float ndl = dot(N, L);',
    '  float sh = mix(1.0, shadowVis(), uShadowStrength);',
    /* The shadow is folded into the lighting term BEFORE quantising, so a
       shadowed facet steps down a whole band rather than being darkened
       smoothly. That keeps the cel edge intact inside shadows, which is where
       most cel-shaded renderers give themselves away. */
    '  float lit = posterise(ndl * mix(0.25, 1.0, sh), vSeed);',
    '  vec3 col = rampColor(lit, vAlbedo);',
    '',
    /* Hemispheric ambient. Sky colour from above, bounce colour from below.
       Cheap, and it is what stops the unlit side reading as a hole rather
       than as a shadow. Kept deliberately low (uAmbient defaults to 0.20):
       ambient is the enemy of a heavy shadow mass, and every point of it
       spent here is contrast taken out of the picture. */
    '  float hemi = N.y * 0.5 + 0.5;',
    '  col += vAlbedo * mix(uAmbientGround, uAmbientSky, hemi) * uAmbient;',
    '',
    /* Paint tooth. Modulates value only, never hue, so it reads as the canvas
       under the paint rather than as dirt on top of it. */
    '  float tooth = toothSample(vWorld, N);',
    '  col *= 1.0 + (tooth - 0.5) * uToothStrength * vTooth;',
    '',
    /* The wet specular. Posterised to two steps: either the knife ridge
       catches the light or it does not. A smooth lobe here would drag the
       whole image back toward conventional 3D. */
    '  vec3 H = normalize(L + Vd);',
    '  float spec = pow(max(dot(N, H), 0.0), uSpecPower);',
    '  spec = step(0.35, spec) * (0.55 + 0.45 * step(0.75, spec));',
    '  col += uLightColor * spec * uSpecStrength * sh;',
    '',
    /* Rim. Biased toward the light side so it reads as light wrapping around
       the form, not as a uniform outline glow. */
    '  float fres = pow(1.0 - clamp(dot(N, Vd), 0.0, 1.0), uRimPower);',
    '  float rimSide = clamp(dot(N, L) * 0.5 + 0.65, 0.0, 1.0);',
    '  col += uRimColor * fres * rimSide * uRimStrength * uRimScale;',
    '',
    /* Emissive facets bypass the ramp entirely. */
    '  col = mix(col, vAlbedo * 1.9 + uRimColor * 0.35, vEmis);',
    '',
    /* Damage flash and the dissolve burn edge. */
    '  col = mix(col, uFlashColor, uFlash);',
    '  if (uDissolve > 0.0){',
    '    float edge = 1.0 - smoothstep(uDissolve, uDissolve + 0.16, dNoise);',
    '    col += uDissolveColor * edge * 0.85;',
    '  }',
    '',
    /* Height and distance fog, tinted to the sky so distant scenery sinks
       into the backdrop the way it does in the painted plates. */
    '  float depth = length(vView);',
    '  float fog = 1.0 - exp(-depth * uFogDensity);',
    '  fog *= clamp(1.0 - vWorld.y * 0.03, 0.0, 1.0);',
    '  col = mix(col, uFogColor, clamp(fog, 0.0, 0.85));',
    '',
    /* DEBUG CHANNELS. Kept in the shipping shader on purpose: the ground once
       rendered seven times darker than the arithmetic said it should, and no
       amount of bisecting the POST chain could find it because the divergence
       was upstream. Being able to display the albedo, the band and the ramp
       output directly is what turns that from an argument into a measurement.
       uDebugMode is 0 in every normal frame and the branch is uniform, so it
       costs nothing real. */
    '  if (uDebugMode > 0.5){',
    '    if (uDebugMode < 1.5)      { oColor = vec4(vAlbedo, 1.0); }',
    '    else if (uDebugMode < 2.5) { oColor = vec4(vec3(lit), 1.0); }',
    '    else if (uDebugMode < 3.5) { oColor = vec4(rampColor(lit, vAlbedo), 1.0); }',
    '    else if (uDebugMode < 4.5) { oColor = vec4(vec3(ndl * 0.5 + 0.5), 1.0); }',
    '    else if (uDebugMode < 5.5) { oColor = vec4(vec3(sh), 1.0); }',
    '    else                       { oColor = vec4(N * 0.5 + 0.5, 1.0); }',
    '    oNormal = vec4(N * 0.5 + 0.5, depth);',
    '    return;',
    '  }',
    '  oColor = vec4(col, uAlpha);',
    /* Attachment 1 carries the surface normal and the linear view depth for
       the ink pass. WORLD space normals are correct here even though the edge
       detection is done in screen space: Sobel compares a normal against its
       neighbours, and a difference between two normals is equally visible in
       any single consistent space. Converting to view space would cost a
       matrix multiply per fragment and change nothing on screen.
       Packed to 0..1 because this target falls back to RGBA8 on drivers with
       no float render target support. */
    '  oNormal = vec4(N * 0.5 + 0.5, depth);',
    '}'
  ].join('\n');

  /* ---------- shadow depth pass ---------- */

  var SHADOW_VS = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec3 aPos;',
    'layout(location=1) in vec3 aNrm;',
    'uniform mat4 uLightVP, uModel;',
    'uniform float uExplode;',
    'void main(){',
    '  vec3 pos = aPos + aNrm * uExplode;',
    '  gl_Position = uLightVP * uModel * vec4(pos, 1.0);',
    '}'
  ].join('\n');

  var SHADOW_FS = [
    '#version 300 es',
    'precision highp float;',
    'void main(){}'
  ].join('\n');

  /* ---------- sky ----------
     Not a cubemap and not a gradient quad: a full-screen shader that paints a
     nebula in the faction palette with the same posterised logic as the
     meshes, so the background belongs to the same picture as the foreground.
     This is where most stylised 3D falls down, with a beautifully shaded
     subject sitting in front of a smooth gradient that gives the whole thing
     away as computer graphics. */
  var SKY_VS = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec2 aPos;',
    'out vec2 vUV;',
    'void main(){ vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 1.0, 1.0); }'
  ].join('\n');

  var SKY_FS = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUV;',
    'layout(location=0) out vec4 oColor;',
    'layout(location=1) out vec4 oNormal;',
    'uniform vec2 uRes;',
    'uniform float uTime;',
    'uniform vec3 uSkyTop, uSkyBottom, uNebulaA, uNebulaB;',
    'uniform float uStarDensity;',
    'uniform mat4 uInvViewProj;',
    'uniform vec3 uCamPos;',
    NOISE,
    'void main(){',
    '  vec2 uv = vUV;',
    '  float aspect = uRes.x / max(uRes.y, 1.0);',
    /* Reconstruct a world ray so the sky parallaxes correctly when the camera
       orbits. A screen-space-only sky slides with the camera and instantly
       reads as a painted backdrop on a stage flat. */
    '  vec4 ndc = vec4(uv * 2.0 - 1.0, 1.0, 1.0);',
    '  vec4 wp = uInvViewProj * ndc;',
    '  vec3 dir = normalize(wp.xyz / max(wp.w, 1e-6) - uCamPos);',
    '',
    '  float h = dir.y * 0.5 + 0.5;',
    '  vec3 col = mix(uSkyBottom, uSkyTop, pow(clamp(h, 0.0, 1.0), 0.72));',
    '',
    /* Two nebula layers at different scales, each posterised into a handful of
       steps so they read as laid-in shapes rather than as airbrush. */
    '  vec2 np = dir.xz / max(abs(dir.y) + 0.35, 0.2);',
    '  float n1 = fbm(np * 0.75 + uTime * 0.004);',
    '  float n2 = fbm(np * 1.9 - uTime * 0.007 + 21.3);',
    '  float b1 = floor(clamp(n1 * 1.35, 0.0, 0.999) * 5.0) / 4.0;',
    '  float b2 = floor(clamp(n2 * 1.15, 0.0, 0.999) * 4.0) / 3.0;',
    '  col = mix(col, uNebulaA, b1 * 0.55 * smoothstep(-0.15, 0.5, dir.y));',
    '  col = mix(col, uNebulaB, b2 * 0.34 * smoothstep(-0.05, 0.7, dir.y));',
    '',
    /* Stars on a hashed lattice, with a size and brightness spread so the
       field has structure instead of reading as uniform noise. */
    '  vec2 sp = dir.xz / max(abs(dir.y) + 0.25, 0.15) * 26.0;',
    '  vec2 sc = floor(sp);',
    '  vec2 sf = fract(sp);',
    '  float sh = hash12(sc);',
    '  if (sh > 1.0 - uStarDensity){',
    '    vec2 off = hash22(sc + 3.7) * 0.6 + 0.2;',
    '    float d = length(sf - off);',
    '    float mag = hash11(sh * 71.3);',
    '    float star = smoothstep(0.10 + mag * 0.06, 0.0, d);',
    '    col += vec3(0.85, 0.92, 1.0) * star * (0.35 + mag * 0.9) * smoothstep(-0.1, 0.35, dir.y);',
    '  }',
    '',
    /* A single large body low on the horizon. Every plate in this universe has
       one, and it gives the eye a scale reference the star field cannot. */
    '  vec3 planetDir = normalize(vec3(0.55, 0.16, -0.82));',
    '  float pd = dot(dir, planetDir);',
    '  float disc = smoothstep(0.9955, 0.9972, pd);',
    '  if (disc > 0.0){',
    '    vec3 pn = normalize(dir - planetDir * 0.995);',
    '    float term = clamp(dot(pn, normalize(vec3(-0.6, 0.5, 0.3))) * 0.5 + 0.5, 0.0, 1.0);',
    '    float band = floor(term * 4.0) / 3.0;',
    '    vec3 pc = mix(uNebulaA * 0.35, uNebulaB * 1.25, band);',
    '    pc = mix(pc, vec3(0.02, 0.01, 0.05), 1.0 - band);',
    '    col = mix(col, pc, disc);',
    '  }',
    '',
    '  oColor = vec4(col, 1.0);',
    /* The sky must write a normal and a huge depth so the ink pass does not
       find an edge between sky pixels, and DOES find one at the horizon of
       every solid object. */
    '  oNormal = vec4(0.5, 0.5, 0.5, 1e5);',
    '}'
  ].join('\n');

  /* ---------- ink outline ----------
     Sobel over the packed normal and linear depth. Depth alone misses the
     interior creases that make a silhouette legible; normals alone find every
     facet edge and turn the model into a wireframe. The two thresholds
     together give the spot-black ink the style law asks for. */
  var POST_VS = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec2 aPos;',
    'out vec2 vUV;',
    'void main(){ vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var INK_FS = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUV;',
    'out vec4 oColor;',
    'uniform sampler2D uColor;',
    'uniform sampler2D uNormalDepth;',
    'uniform vec2 uTexel;',
    'uniform float uDepthThreshold;',
    'uniform float uNormalThreshold;',
    'uniform vec3 uInkColor;',
    'uniform float uInkStrength;',
    'uniform float uThickness;',
    '',
    'void main(){',
    '  vec3 base = texture(uColor, vUV).rgb;',
    '  vec2 t = uTexel * uThickness;',
    '',
    '  vec4 c  = texture(uNormalDepth, vUV);',
    '  vec4 l  = texture(uNormalDepth, vUV - vec2(t.x, 0.0));',
    '  vec4 r  = texture(uNormalDepth, vUV + vec2(t.x, 0.0));',
    '  vec4 u  = texture(uNormalDepth, vUV + vec2(0.0, t.y));',
    '  vec4 d  = texture(uNormalDepth, vUV - vec2(0.0, t.y));',
    '',
    /* Depth edge, scaled by the centre depth. Without the scale, a fixed
       threshold produces heavy outlines up close and none in the distance. */
    '  float dc = c.a;',
    '  float dd = (abs(l.a - dc) + abs(r.a - dc) + abs(u.a - dc) + abs(d.a - dc));',
    '  float depthEdge = step(uDepthThreshold * max(dc, 1.0) * 0.06, dd);',
    '',
    /* Normal edge. Sum of angular differences from the centre normal. */
    '  vec3 nc = c.rgb * 2.0 - 1.0;',
    '  float nd = 0.0;',
    '  nd += 1.0 - dot(nc, l.rgb * 2.0 - 1.0);',
    '  nd += 1.0 - dot(nc, r.rgb * 2.0 - 1.0);',
    '  nd += 1.0 - dot(nc, u.rgb * 2.0 - 1.0);',
    '  nd += 1.0 - dot(nc, d.rgb * 2.0 - 1.0);',
    /* Creases fade with distance, silhouettes do not. Without this the whole
       far half of the board turns into a mesh of ink lines as facets get
       smaller than a pixel. */
    '  float fade = clamp(1.0 - (dc - 18.0) / 55.0, 0.15, 1.0);',
    '  float normalEdge = step(uNormalThreshold, nd) * fade;',
    '',
    '  float edge = clamp(max(depthEdge, normalEdge), 0.0, 1.0) * uInkStrength;',
    /* Ink DARKENS rather than replaces: min() against the ink colour. A bright
       emissive surface therefore keeps its glow and only gains a dark seam,
       which is how ink sits over paint. Replacing outright (the usual
       mix-to-black) puts flat black holes through every glowing edge in the
       scene, and this game is mostly glowing edges. */
    '  vec3 col = mix(base, min(base, uInkColor), edge);',
    '  oColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ---------- bloom ---------- */

  var BRIGHT_FS = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUV;',
    'out vec4 oColor;',
    'uniform sampler2D uColor;',
    'uniform float uThreshold;',
    'uniform float uSoftKnee;',
    'void main(){',
    '  vec3 c = texture(uColor, vUV).rgb;',
    '  float br = max(c.r, max(c.g, c.b));',
    /* Soft knee so a surface hovering at the threshold does not pop in and out
       between frames as the camera moves. */
    '  float knee = uThreshold * uSoftKnee + 1e-5;',
    '  float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);',
    '  soft = soft * soft / (4.0 * knee + 1e-5);',
    '  float contrib = max(soft, br - uThreshold) / max(br, 1e-5);',
    '  oColor = vec4(c * contrib, 1.0);',
    '}'
  ].join('\n');

  /* Separable 9-tap Gaussian, run at half resolution over several mip levels.
     Cheaper and wider than one big kernel at full res. */
  var BLUR_FS = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUV;',
    'out vec4 oColor;',
    'uniform sampler2D uColor;',
    'uniform vec2 uDir;',
    'void main(){',
    '  vec3 sum = texture(uColor, vUV).rgb * 0.227027;',
    '  vec2 o1 = uDir * 1.3846153846;',
    '  vec2 o2 = uDir * 3.2307692308;',
    '  sum += (texture(uColor, vUV + o1).rgb + texture(uColor, vUV - o1).rgb) * 0.3162162162;',
    '  sum += (texture(uColor, vUV + o2).rgb + texture(uColor, vUV - o2).rgb) * 0.0702702703;',
    '  oColor = vec4(sum, 1.0);',
    '}'
  ].join('\n');

  /* ---------- final composite ----------
     Tonemap, grade, then the print-shop layer: halftone that only bites in the
     shadows, canvas weave in screen space, grain, chromatic aberration and a
     vignette. Screen space is the important part for the canvas: it must feel
     like the whole image was painted on one surface, which means it does NOT
     move with the camera. */
  var COMPOSITE_FS = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUV;',
    'out vec4 oColor;',
    'uniform sampler2D uColor;',
    'uniform sampler2D uBloom;',
    'uniform sampler2D uTooth;',
    'uniform vec2 uRes;',
    'uniform float uTime;',
    'uniform float uBloomStrength;',
    'uniform float uExposure;',
    'uniform float uSaturation;',
    'uniform float uContrast;',
    'uniform vec3 uLift, uGain;',
    'uniform float uVignette;',
    'uniform float uGrain;',
    'uniform float uHalftone;',
    'uniform float uCanvas;',
    'uniform float uAberration;',
    'uniform float uShake;',
    'uniform float uFlashWhite;',
    'uniform float uDesaturate;',
    NOISE,
    '',
    /* ACES-ish filmic curve. The approximation rather than the full fit:
       cheaper, and the difference is invisible under a posterised palette. */
    'vec3 tonemap(vec3 x){',
    '  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;',
    '  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);',
    '}',
    '',
    'void main(){',
    '  vec2 uv = vUV;',
    /* Chromatic aberration, radial, strongest at the corners. Driven by hit
       impact and by the shake amount, so it is a gameplay signal rather than a
       constant filter. */
    '  vec2 ctr = uv - 0.5;',
    '  float r2 = dot(ctr, ctr);',
    '  float ab = uAberration * (0.4 + r2 * 2.2);',
    '  vec3 col;',
    '  if (ab > 0.0001){',
    '    col.r = texture(uColor, uv - ctr * ab).r;',
    '    col.g = texture(uColor, uv).g;',
    '    col.b = texture(uColor, uv + ctr * ab).b;',
    '  } else {',
    '    col = texture(uColor, uv).rgb;',
    '  }',
    '',
    '  vec3 bloom = texture(uBloom, uv).rgb;',
    '  col += bloom * uBloomStrength;',
    '',
    '  col *= uExposure;',
    '  col = tonemap(col);',
    '',
    /* Grade: lift and gain, then contrast about mid grey, then saturation. */
    '  col = col * uGain + uLift;',
    '  col = (col - 0.5) * uContrast + 0.5;',
    '  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));',
    '  col = mix(vec3(lum), col, uSaturation);',
    '  col = mix(col, vec3(lum), uDesaturate);',
    '',
    /* HALFTONE. A rotated dot screen whose dot SIZE tracks luminance, applied
       only where the image is already dark. Applying it everywhere is the
       classic mistake: it turns highlights into a moire mess and reads as a
       filter. Confined to the shadow mass it reads as the print process that
       the style law actually asks for. */
    '  if (uHalftone > 0.0){',
    '    float ang = 0.4363;',
    '    vec2 hp = vec2(uv.x * uRes.x, uv.y * uRes.y);',
    '    vec2 rp = vec2(hp.x * cos(ang) - hp.y * sin(ang), hp.x * sin(ang) + hp.y * cos(ang));',
    '    vec2 cell = fract(rp / 3.4) - 0.5;',
    '    float dotR = length(cell) * 2.0;',
    '    float shadowMask = 1.0 - smoothstep(0.06, 0.42, lum);',
    '    float screen = smoothstep(dotR - 0.35, dotR + 0.35, 0.35 + lum * 1.1);',
    '    col = mix(col, col * (0.62 + 0.38 * screen), shadowMask * uHalftone);',
    '  }',
    '',
    /* CANVAS WEAVE in screen space. Value only. This is the layer that makes
       the whole frame feel like one painted surface. */
    '  if (uCanvas > 0.0){',
    '    float weave = texture(uTooth, uv * uRes / 512.0).g;',
    '    col *= 1.0 + (weave - 0.5) * uCanvas;',
    '  }',
    '',
    /* Vignette, hued rather than black, matching the shadow logic in the mesh
       shader so the frame edge belongs to the same palette. */
    '  float vig = 1.0 - uVignette * smoothstep(0.25, 0.95, length(ctr) * 1.35);',
    '  col *= vig;',
    '  col = mix(col, vec3(0.035, 0.015, 0.06), (1.0 - vig) * 0.55);',
    '',
    /* Grain, animated. Kept subtle and monochrome: coloured grain reads as
       sensor noise, monochrome grain reads as print. */
    '  if (uGrain > 0.0){',
    '    float g = hash12(uv * uRes + fract(uTime) * 813.7) - 0.5;',
    '    col += g * uGrain;',
    '  }',
    '',
    '  col = mix(col, vec3(1.0), uFlashWhite);',
    '  oColor = vec4(clamp(col, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  /* ---------- particles ----------
     Instanced billboards. One draw call for every spark, ember, smoke puff and
     damage flake in the scene. The vertex shader builds the quad from
     gl_VertexID so there is no quad buffer at all. */
  var PARTICLE_VS = [
    '#version 300 es',
    'precision highp float;',
    /* instance attributes */
    'layout(location=0) in vec3 iPos;',
    'layout(location=1) in vec4 iColor;',
    'layout(location=2) in vec4 iParams;',  /* size, rot, kind, stretch */
    'layout(location=3) in vec3 iVel;',
    'uniform mat4 uProj, uView;',
    'uniform vec3 uRight, uUp;',
    'out vec2 vUV;',
    'out vec4 vColor;',
    'flat out float vKind;',
    'flat out float vStretch;',
    /* Six vertices per instance, built from gl_VertexID against a constant
       table. An earlier draft derived the corners with a chain of ternaries
       and got the winding wrong on the second triangle, which showed up as
       every particle being a triangle rather than a quad: cheap to get wrong,
       and invisible until you look closely at a single spark. A literal table
       cannot be wrong. */
    'const vec2 CORNERS[6] = vec2[6](',
    '  vec2(-1.0, -1.0), vec2( 1.0, -1.0), vec2( 1.0,  1.0),',
    '  vec2(-1.0, -1.0), vec2( 1.0,  1.0), vec2(-1.0,  1.0));',
    'void main(){',
    '  vec2 corner = CORNERS[gl_VertexID];',
    '  vUV = corner * 0.5 + 0.5;',
    '  vColor = iColor;',
    '  vKind = iParams.z;',
    '  float size = iParams.x;',
    '  float ang = iParams.y;',
    '  float stretchAmt = iParams.w;',
    '',
    /* VELOCITY STRETCH, computed in the vertex shader rather than on the CPU.
       A spark that does not elongate along its own motion is the loudest tell
       of a cheap particle system: real sparks are motion-blurred streaks, and
       a round dot moving fast reads as a bug crawling across the screen.
       The velocity is projected onto the camera basis, so the streak is
       correct from any angle and costs two dot products. Doing it here also
       means the CPU never has to know where the camera is. */
    '  float sy = 1.0;',
    '  if (stretchAmt > 0.001){',
    '    vec2 sv = vec2(dot(iVel, uRight), dot(iVel, uUp));',
    '    float sp = length(sv);',
    '    if (sp > 0.02){',
    '      ang = atan(sv.x, sv.y);',
    '      sy = 1.0 + stretchAmt * min(sp * 0.055, 5.0);',
    '    }',
    '  }',
    '  vStretch = sy;',
    /* Scale along the local Y BEFORE rotating, so the elongation lands on the
       velocity axis and not on the screen axis. */
    '  vec2 c2 = vec2(corner.x, corner.y * sy) * size;',
    '  float cs = cos(ang), sn = sin(ang);',
    '  vec2 rc = vec2(c2.x * cs - c2.y * sn, c2.x * sn + c2.y * cs);',
    '  vec3 world = iPos + uRight * rc.x + uUp * rc.y;',
    '  gl_Position = uProj * uView * vec4(world, 1.0);',
    '}'
  ].join('\n');

  var PARTICLE_FS = [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUV;',
    'in vec4 vColor;',
    'flat in float vKind;',
    'flat in float vStretch;',
    'out vec4 oColor;',
    NOISE,
    'void main(){',
    '  vec2 p = vUV * 2.0 - 1.0;',
    '  float d = length(p);',
    '  float a = 0.0;',
    '  vec3 col = vColor.rgb;',
    '  if (vKind < 0.5){',
    /* SPARK: a hard-edged diamond, not a soft round blob. Round soft sprites
       are the fastest way to make a stylised game look like a 2009 particle
       demo. A diamond with a crisp edge reads as a chip of paint. */
    '    float dm = abs(p.x) + abs(p.y);',
    '    a = 1.0 - step(0.95, dm);',
    '    a *= 0.65 + 0.35 * step(dm, 0.55);',
    '  } else if (vKind < 1.5){',
    /* SMOKE: soft, but with a posterised alpha so it still bands. */
    '    float n = fbm(vUV * 3.5 + vColor.r * 17.0);',
    '    a = smoothstep(1.0, 0.25, d) * n * 1.4;',
    '    a = floor(a * 4.0) / 3.5;',
    '  } else if (vKind < 2.5){',
    /* RING: an expanding shock annulus. */
    '    a = smoothstep(0.55, 0.78, d) * (1.0 - smoothstep(0.9, 1.0, d));',
    '  } else if (vKind < 3.5){',
    /* FLAKE: a rotated hard square, the paint-chip debris. */
    '    a = (abs(p.x) < 0.72 && abs(p.y) < 0.72) ? 1.0 : 0.0;',
    '  } else if (vKind < 4.5){',
    /* STREAK: a tapered capsule along the stretched axis, with a hot core.
       The taper is what makes it read as motion rather than as a stick. */
    '    float across = abs(p.x);',
    '    float along = abs(p.y);',
    '    float body = (1.0 - smoothstep(0.0, 1.0, across)) * (1.0 - smoothstep(0.35, 1.0, along));',
    '    a = body;',
    '    float core = (1.0 - smoothstep(0.0, 0.34, across)) * (1.0 - smoothstep(0.1, 0.8, along));',
    '    col += vec3(0.9, 0.85, 0.75) * core * 0.85;',
    '  } else if (vKind < 5.5){',
    /* EMBER: a soft glow with a hard bright centre. The two-part falloff is
       what makes a small bright thing read as HOT rather than as a dot. */
    '    float glow = pow(1.0 - clamp(d, 0.0, 1.0), 2.4);',
    '    float core = 1.0 - smoothstep(0.0, 0.30, d);',
    '    a = glow * 0.75 + core;',
    '    col += vec3(1.0, 0.92, 0.8) * core * 0.7;',
    '  } else {',
    /* SHARD: a sharp asymmetric chip, the debris that is not paint. */
    '    float tri = p.y + 1.0 - abs(p.x) * 1.9;',
    '    a = step(0.0, tri) * step(abs(p.x), 0.85);',
    '  }',
    '  if (a <= 0.003) discard;',
    '  oColor = vec4(col, vColor.a * a);',
    '}'
  ].join('\n');

  /* ---------- unlit / additive geometry ----------
     Beams, range rings, placement ghosts, projectile trails. Shares the mesh
     vertex layout so it can reuse any built mesh, but skips lighting. */
  var UNLIT_VS = [
    '#version 300 es',
    'precision highp float;',
    'layout(location=0) in vec3 aPos;',
    'layout(location=1) in vec3 aNrm;',
    'layout(location=2) in vec3 aCol;',
    'layout(location=3) in vec3 aAux;',
    'uniform mat4 uProj, uView, uModel;',
    'uniform vec3 uCamPos;',
    'out vec3 vWorld;',
    'flat out vec3 vCol;',
    'flat out vec3 vNrm;',
    'flat out float vSeed;',
    'void main(){',
    '  vec4 w = uModel * vec4(aPos, 1.0);',
    '  vWorld = w.xyz;',
    '  vCol = aCol;',
    '  vNrm = mat3(uModel) * aNrm;',
    '  vSeed = aAux.x;',
    '  gl_Position = uProj * uView * w;',
    '}'
  ].join('\n');

  var UNLIT_FS = [
    '#version 300 es',
    'precision highp float;',
    'in vec3 vWorld;',
    'flat in vec3 vCol;',
    'flat in vec3 vNrm;',
    'flat in float vSeed;',
    'layout(location=0) out vec4 oColor;',
    'layout(location=1) out vec4 oNormal;',
    'uniform vec3 uTint;',
    'uniform float uAlpha;',
    'uniform float uDebugMode;',
    'uniform float uTime;',
    'uniform float uPulse;',
    'uniform vec3 uCamPos;',
    'uniform float uFresnel;',
    'void main(){',
    '  vec3 col = vCol * uTint;',
    '  float a = uAlpha;',
    '  if (uFresnel > 0.0){',
    /* Edge-on falloff for the range ring and shield domes, so a flat disc
       does not read as a sticker. */
    '    vec3 V = normalize(uCamPos - vWorld);',
    '    float f = pow(1.0 - abs(dot(normalize(vNrm), V)), 2.0);',
    '    a *= mix(1.0, f, uFresnel);',
    '    col += vCol * f * 0.8;',
    '  }',
    '  col *= 1.0 + uPulse * (0.5 + 0.5 * sin(uTime * 6.0 + vSeed * 12.0));',
    '  if (a <= 0.004) discard;',
    '  oColor = vec4(col, a);',
    /* Unlit geometry must NOT contribute an ink edge: a range ring outlined in
       black looks like a decal. Writing a huge depth keeps the Sobel blind to
       it while still letting it composite over the scene. */
    '  oNormal = vec4(0.5, 0.5, 0.5, 1e5);',
    '}'
  ].join('\n');

  return {
    NOISE: NOISE, RAMP: RAMP,
    MESH_VS: MESH_VS, MESH_FS: MESH_FS,
    SHADOW_VS: SHADOW_VS, SHADOW_FS: SHADOW_FS,
    SKY_VS: SKY_VS, SKY_FS: SKY_FS,
    POST_VS: POST_VS, INK_FS: INK_FS,
    BRIGHT_FS: BRIGHT_FS, BLUR_FS: BLUR_FS, COMPOSITE_FS: COMPOSITE_FS,
    PARTICLE_VS: PARTICLE_VS, PARTICLE_FS: PARTICLE_FS,
    UNLIT_VS: UNLIT_VS, UNLIT_FS: UNLIT_FS
  };
})();
