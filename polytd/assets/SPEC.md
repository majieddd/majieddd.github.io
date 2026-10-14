
POLY SKIN ASSET SPEC v1
=======================
asset.json
{
  "name": "crawler",
  "verts": 1234,          // float count of vertices array
  "grid":  "asset.bin",   // Float32Array: pos3 nrm3 col3 joint4 weight4  (stride 14 floats = 56 bytes)
  "indices": null,        // non-indexed (triangle soup) for simplicity
  "joints": [             // hierarchy, index = joint id
    {"name":"root","parent":-1,"rest":[t,q,s...]}, ...
  ],
  "clipFps": 30,
  "clips": {
    "walk": {"frames": 24, "data": [...] }, // per frame: per joint: q4+pos3 (7 floats), ordered joint 0..N-1
    "attack": {...},
    "death": {...}
  },
  "bound": { "min":[x,y,z], "max":[x,y,z] }   // rest pose bounds
}
