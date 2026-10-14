/* MODELS. Box data for the sandbox, one per unit and tower.

   Palettes come from the BRAND.md section 2 four-value ladder, so what renders
   here is the same colour contract the illustration classes already use:
   index 0 near-black ground, 1 shadow, 2 light, 3 spark.

   Subjects are taken from FACTION_TROOPS and TOWER_PLATES in
   artgen/krea_jobs.py so a unit here is the same unit the art pipeline knows. */
'use strict';

var MODELS = {

  /* ---- enemies -------------------------------------------------------- */

  /* HUMAN trooper: disciplined line infantry in a powered hard-suit. */
  trooper: {
    name: 'TROOPER',
    pal: ['#0a0e17', '#164e63', '#38e8ff', '#ff2fd6'],
    boxes: [
      [-1,11,-1,  1,13, 1, 2],   /* head        */
      [-1,12, 2,  1,12, 2, 3],   /* visor spark */
      [-2, 6,-1,  2,10, 1, 2],   /* torso       */
      [-2, 8,-1,  2, 9, 1, 3],   /* chest band  */
      [-3,10,-1,  3,10, 1, 1],   /* shoulders   */
      [-3, 7,-1, -3, 9, 1, 1],
      [ 3, 7,-1,  3, 9, 1, 1],
      [-2, 5,-1,  2, 5, 1, 0],   /* hips        */
      [-2, 0,-1, -1, 4, 1, 2],
      [ 1, 0,-1,  2, 4, 1, 2],
      [-2, 0,-1, -1, 0, 2, 0],   /* feet        */
      [ 1, 0,-1,  2, 0, 2, 0],
      [ 2, 8, 2,  5, 8, 2, 0],   /* rifle       */
      [ 2, 7, 2,  3, 8, 2, 1]
    ]
  },

  /* XENO gnawling: a low scuttling mouth-creature, mostly teeth on thin legs. */
  gnawling: {
    name: 'GNAWLING',
    pal: ['#0a0e17', '#3b0764', '#a855f7', '#ff2fd6'],
    boxes: [
      [-3, 3,-3,  3, 7, 2, 2],   /* bulk        */
      [-3, 4, 3,  3, 6, 3, 0],   /* maw shadow  */
      [-2, 5, 3,  2, 5, 4, 3],   /* teeth glow  */
      [-3, 7,-2,  3, 7, 1, 1],   /* carapace    */
      [-4, 0,-3, -4, 3,-2, 1],   /* legs        */
      [ 4, 0,-3,  4, 3,-2, 1],
      [-4, 0, 1, -4, 3, 2, 1],
      [ 4, 0, 1,  4, 3, 2, 1],
      [-4, 0,-3, -4, 0,-2, 0],
      [ 4, 0,-3,  4, 0,-2, 0],
      [-4, 0, 1, -4, 0, 2, 0],
      [ 4, 0, 1,  4, 0, 2, 0]
    ]
  },

  /* PIRATE ironhulk: a walking heap of salvage welded onto salvage. */
  ironhulk: {
    name: 'IRONHULK',
    pal: ['#0a0e17', '#7f1d1d', '#ef4444', '#ff6b6b'],
    boxes: [
      [-3, 5,-2,  3,10, 2, 2],   /* mass          */
      [-4, 7,-1,  4, 9, 1, 1],   /* welded slabs  */
      [-2,11,-1,  2,12, 1, 1],   /* stacked scrap */
      [-1,13,-1,  1,13, 1, 3],   /* spark         */
      [ 3, 8, 1,  6, 8, 2, 0],   /* gun           */
      [-4, 4,-2, -2, 4, 2, 0],
      [ 2, 4,-2,  4, 4, 2, 0],
      [-3, 0,-2, -2, 4,-1, 1],   /* legs          */
      [ 2, 0,-2,  3, 4,-1, 1],
      [-3, 0, 1, -2, 4, 2, 1],
      [ 2, 0, 1,  3, 4, 2, 1]
    ]
  },

  /* VIGIL splicer: a headless four-legged chassis, torch on the stump. */
  splicer: {
    name: 'SPLICER',
    pal: ['#0a0e17', '#1e293b', '#e2e8f0', '#5eead4'],
    boxes: [
      [-3, 6,-2,  3, 9, 2, 2],   /* body        */
      [-3, 9,-2,  3, 9, 2, 1],   /* back plate  */
      [ 0,10, 0,  1,11, 1, 1],   /* neck stump  */
      [ 0,12, 0,  1,12, 1, 3],   /* torch       */
      [-3, 0,-2, -2, 5,-1, 2],   /* four legs   */
      [ 2, 0,-2,  3, 5,-1, 2],
      [-3, 0, 1, -2, 5, 2, 2],
      [ 2, 0, 1,  3, 5, 2, 2],
      [-3, 0,-2, -2, 0,-1, 1],
      [ 2, 0,-2,  3, 0,-1, 1],
      [-3, 0, 1, -2, 0, 2, 1],
      [ 2, 0, 1,  3, 0, 2, 1]
    ]
  },

  /* ---- towers ---------------------------------------------------------- */

  /* BOLT: the starter emplacement, a plain braced gun on a plinth. */
  bolt: {
    name: 'BOLT',
    pal: ['#0a0e17', '#164e63', '#38e8ff', '#ff2fd6'],
    boxes: [
      [-4, 0,-4,  4, 1, 4, 0],   /* plinth      */
      [-3, 1,-3,  3, 3, 3, 1],
      [-2, 3,-2,  2, 6, 2, 2],   /* housing     */
      [-2, 6,-2,  2, 6, 2, 3],   /* lens        */
      [ 0, 4, 2,  1, 5, 6, 0],   /* barrel      */
      [-3, 4,-3, -3, 5,-3, 1],
      [ 3, 4,-3,  3, 5,-3, 1]
    ]
  },

  /* SEPULCHRE: a gilded reliquary casket, lid ajar, gun barrel within. */
  sepulchre: {
    name: 'SEPULCHRE',
    pal: ['#0a0e17', '#78350f', '#fbbf24', '#fff7e0'],
    boxes: [
      [-4, 0,-4,  4, 1, 4, 1],   /* plinth       */
      [-3, 1,-3,  3, 2, 3, 0],
      [-3, 2,-2,  3, 8, 2, 2],   /* casket       */
      [-3, 4,-2,  3, 4, 2, 1],   /* engraved band*/
      [-3, 6,-2,  3, 6, 2, 1],
      [-3, 9,-2,  1,10, 0, 3],   /* lid ajar     */
      [ 0, 5, 2,  1, 6, 6, 0],   /* barrel       */
      [-4, 1,-4, -4, 3,-4, 3],   /* corner spark */
      [ 4, 1,-4,  4, 3,-4, 3]
    ]
  },

  /* MAW: a lamprey funnel out of the ground, rings of teeth going down. */
  maw: {
    name: 'MAW',
    pal: ['#0a0e17', '#3b0764', '#a855f7', '#ff2fd6'],
    boxes: [
      [-5, 0,-5,  5, 1, 5, 1],   /* ground ring  */
      [-4, 1,-4,  4, 2, 4, 2],
      [-3, 2,-3,  3, 4, 3, 1],   /* funnel walls */
      [-2, 4,-2,  2, 6, 2, 2],
      [-1, 6,-1,  1, 7, 1, 0],   /* throat       */
      [-3, 3, 3,  3, 5, 3, 3],   /* teeth glow   */
      [-3, 3,-3,  3, 5,-3, 3],
      [-4, 2,-4, -4, 4,-4, 0],
      [ 4, 2,-4,  4, 4,-4, 0]
    ]
  }
};
