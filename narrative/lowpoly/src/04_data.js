/* 04 data. Towers, enemies, factions, waves, maps.
   Towers copy from TOWER_PRESETS and add per-instance fields. Same for enemies. */
(function(){
  const LP=window.LP;
  const P=LP.Art.TOWER_PRESETS, E=LP.Art.ENEMY_PRESETS, F=LP.FAC;

  // 8 towers in the dock. Order: pulse, prism, thorn, mortar, gauss, cryo, spore, tesla.
  const TOWERS=[
    {key:"1", preset:P.pulse,  name:"PULSE",   blurb:"Single-target energy bolt. Cheap, reliable starter.", tag:"BASIC"},
    {key:"2", preset:P.prism,  name:"PRISM",   blurb:"Splash damage in a sphere of light. Punishes groups.", tag:"SPLASH"},
    {key:"3", preset:P.thorn,  name:"THORN",   blurb:"High-velocity spike, ignores armor, no splash.", tag:"PIERCE"},
    {key:"4", preset:P.mortar, name:"MORTAR",  blurb:"Heavy arcing shell. Long range, slow cadence, big boom.", tag:"SIEGE"},
    {key:"5", preset:P.gauss,  name:"GAUSS",   blurb:"Mach-7 magnetic slug. Cheap, fast, fragile to tanks.", tag:"RAPID"},
    {key:"6", preset:P.cryo,   name:"CRYO",    blurb:"Cryo beam that slows units and chips armor.", tag:"CONTROL"},
    {key:"7", preset:P.spore,  name:"SPORE",   blurb:"Toxic spore. Small DoT ticks stack up on the path.", tag:"DoT"},
    {key:"8", preset:P.tesla,  name:"TESLA",   blurb:"Lightning arc that chains to a second target.", tag:"CHAIN"}
  ];

  // Wave plan: 12 waves across 3 acts.
  // act 1 (1-3) intro, act 2 (4-8) escalation, act 3 (9-12) climax with boss on 12.
  // Each wave: {delay, spawns:[{enemy,count,gap,bucket}]}
  // bucket (optional): "earlywoods" to add a small early surge.
  const WAVES=[
    // 1
    {delay:7, spawns:[{enemy:E.crawler,count:8,gap:0.7}]},
    // 2
    {delay:8, spawns:[{enemy:E.crawler,count:10,gap:0.65},{enemy:E.drone,count:4,gap:0.6,offset:5}]},
    // 3
    {delay:9, spawns:[{enemy:E.drone,count:10,gap:0.55}]},
    // 4
    {delay:9, spawns:[{enemy:E.crawler,count:14,gap:0.5},{enemy:E.xenosw,count:8,gap:0.5,offset:6}]},
    // 5
    {delay:10, spawns:[{enemy:E.impaler,count:8,gap:0.65},{enemy:E.seraph,count:6,gap:0.6,offset:4}]},
    // 6 (mid boss-tier tank)
    {delay:10, spawns:[{enemy:E.sledger,count:4,gap:1.4},{enemy:E.crawler,count:14,gap:0.45,offset:2}]},
    // 7
    {delay:9, spawns:[{enemy:E.knight,count:6,gap:0.7},{enemy:E.ranger,count:8,gap:0.5,offset:3}]},
    // 8
    {delay:9, spawns:[{enemy:E.viper,count:14,gap:0.35},{enemy:E.revenant,count:3,gap:1.2,offset:5}]},
    // 9
    {delay:8, spawns:[{enemy:E.oracle,count:10,gap:0.55},{enemy:E.impaler,count:10,gap:0.45,offset:3}]},
    // 10
    {delay:8, spawns:[{enemy:E.sledger,count:6,gap:0.9},{enemy:E.knight,count:6,gap:0.7,offset:2},{enemy:E.crawler,count:18,gap:0.3,offset:6}]},
    // 11
    {delay:7, spawns:[{enemy:E.revenant,count:6,gap:0.9},{enemy:E.xenosw,count:24,gap:0.22,offset:4}]},
    // 12 BOSS
    {delay:9, spawns:[{enemy:E.overlord,count:1,gap:1.0},{enemy:E.revenant,count:4,gap:1.2,offset:8},{enemy:E.viper,count:18,gap:0.32,offset:14}]}
  ];

  // 4 maps. Each: {name, w, h, path:[{x,z}], decor:[{x,z,kind}]}
  // The path is an array of world coordinates (in tile units, so multiply by TILE for px).
  // All maps are 12x9 grid. Path always starts left, ends at the Core (right of centre).
  // 1: Open Field : long sweep
  // 2: Twin Channel : splits then merges
  // 3: Spiral : wraps around a centre island
  // 4: Fortress Ring : converging from two sides
  const MAPS=[
    {id:"open",      name:"OPEN FIELD",     desc:"A long sweep. Best for a single solid line of PULSE + PRISM.",
      w:14, h:9,
      path:[
        {x:-1.5,z:1.5},{x:2,z:1.5},{x:2,z:5.5},{x:5.5,z:5.5},
        {x:5.5,z:2.0},{x:9.0,z:2.0},{x:9.0,z:7.0},{x:12.5,z:7.0},{x:12.5,z:4.5},{x:15.5,z:4.5}
      ],
      decor:[
        {x:3.5,z:8.0,kind:"crystal"},{x:6.5,z:0.5,kind:"crystal"},
        {x:11.0,z:0.5,kind:"star"},{x:0.5,z:7.0,kind:"star"},
        {x:8.0,z:4.0,kind:"crystal"}
      ]},
    {id:"twin",      name:"TWIN CHANNEL",   desc:"The path splits. Two chokepoints, two answers.",
      w:14, h:9,
      path:[
        {x:-1.5,z:4.5},{x:2.5,z:4.5},{x:2.5,z:1.5},
        {x:6.5,z:1.5},{x:6.5,z:7.5},
        {x:10.5,z:7.5},{x:10.5,z:4.5},{x:15.5,z:4.5}
      ],
      decor:[
        {x:4.0,z:3.0,kind:"crystal"},{x:4.0,z:6.0,kind:"crystal"},
        {x:8.0,z:3.0,kind:"crystal"},{x:8.0,z:6.0,kind:"crystal"},
        {x:13.0,z:0.5,kind:"star"}
      ]},
    {id:"spiral",    name:"SPIRAL",         desc:"A long curve around a central island.",
      w:14, h:9,
      path:[
        {x:-1.5,z:0.5},{x:2.5,z:0.5},{x:2.5,z:8.5},{x:11.5,z:8.5},
        {x:11.5,z:0.5},{x:8.0,z:0.5},{x:8.0,z:6.0},{x:5.0,z:6.0},
        {x:5.0,z:3.0},{x:13.5,z:3.0},{x:13.5,z:5.5},{x:15.5,z:5.5}
      ],
      decor:[
        {x:6.5,z:4.0,kind:"crystal"},{x:7.0,z:5.0,kind:"crystal"},
        {x:7.5,z:4.0,kind:"star"}
      ]},
    {id:"fortress",  name:"FORTRESS RING",  desc:"Path approaches from two sides at once. Spread out.",
      w:14, h:9,
      path:[
        {x:-1.5,z:2.0},{x:3.5,z:2.0},{x:3.5,z:6.0},{x:8.0,z:6.0},
        {x:8.0,z:2.0},{x:15.5,z:2.0},
        // second branch (joins mid-route, conceptually)
        {x:-1.5,z:7.0},{x:3.5,z:7.0}
      ],
      decor:[
        {x:6.0,z:0.5,kind:"star"},{x:11.0,z:8.0,kind:"star"},
        {x:1.0,z:4.5,kind:"crystal"},{x:13.0,z:4.5,kind:"crystal"}
      ]}
  ];

  // Faction : selected by user, drives the dock's accent and the cutscene plate.
  // All towers remain available regardless; faction only colours the UI.
  const FACTIONS=[
    {id:"human",    name:"HUMANITY",       desc:"Cold competent industry. Pulse and Gauss at home.", accent:"#38e8ff"},
    {id:"light",    name:"FEDERATION",     desc:"Luminous contact species. Prism and Cryo sing here.", accent:"#fbbf24"},
    {id:"xeno",     name:"THE XENO",       desc:"Predatory. Thorn and Spore thrive.",               accent:"#7c3aed"},
    {id:"pirate",   name:"THE PIRATES",    desc:"Patchwork fleet. Mortar and Tesla run hot.",       accent:"#ef4444"},
    {id:"parallel", name:"THE PARALLEL",   desc:"Chrome and pale teal. Gauss and Tesla are native.",accent:"#94a3b8"}
  ];

  // Per-tower upgrade paths. Each level adds 1 to {damage, range, fireRate}.
  // Simple linear growth: 1.0x -> 1.5x -> 2.2x.
  function upgradeStats(t){
    const lvl=t.level||0;
    const mult=[1,1.0,1.5,2.2][Math.min(lvl+1,3)];
    return {
      damage:t.preset.damage*mult,
      range:t.preset.range*(1+(lvl*0.08)),
      fireInterval:t.preset.fireInterval/Math.min(1+lvl*0.18,2),
      splash:t.preset.splash*(1+lvl*0.25)
    };
  }
  // Sell refund: 60% of total invested
  function sellRefund(t){
    let total=t.preset.cost;
    for(let i=0;i<(t.level||0);i++) total+=Math.floor(t.preset.cost*0.6*(i+1));
    return Math.floor(total*0.6);
  }
  // Upgrade cost: 70% of base
  function upgradeCost(t){
    return Math.floor(t.preset.cost*0.7*(t.level||0)+1);
  }

  LP.Data={TOWERS,WAVES,MAPS,FACTIONS,upgradeStats,sellRefund,upgradeCost};
})();
