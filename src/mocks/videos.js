// Clips space (flag clipsSpace) — the seeded video library.
//
// Two real videos from the BETA test workspace (org 888 / ws 885), the same ones
// prod's crop-editor playground uses (content/studio/playgrounds/crop-editor/
// examples). They stream from the public library CDN; nothing is copied here.
// The prod case (YLE, a customer video) is left out on purpose.
//
// `analysis` is what the backend computed on the one window prod actually
// analysed (crop zones, scene cuts, faces.json samples), rebased from
// clip-relative to SOURCE-absolute ms. Outside that window the auto framing is
// simulated from `fallback` — honest for the StreamYard podcast (the two tiles
// never move), approximate for the panel talk.
//
// Times: ms, source-absolute. Faces: [tMs, [[x, y, w, h], …]] normalised.

const ANALYSIS = {
  "podcast-dual-stack": {
    fromMs: 481600,
    toMs: 550280,
    cutsMs: [],
    faces: [
      [
        480500,
        [
          [0.2156, 0.4556, 0.0896, 0.2074],
          [0.7385, 0.363, 0.0813, 0.2167],
        ],
      ],
      [
        481500,
        [
          [0.2146, 0.4556, 0.0896, 0.2093],
          [0.7229, 0.3722, 0.0854, 0.2259],
        ],
      ],
      [
        482500,
        [
          [0.2167, 0.4389, 0.0896, 0.2111],
          [0.7385, 0.3815, 0.0813, 0.2111],
        ],
      ],
      [
        483500,
        [
          [0.2219, 0.4426, 0.0875, 0.2],
          [0.7271, 0.3741, 0.0823, 0.2222],
        ],
      ],
      [
        484500,
        [
          [0.2229, 0.4407, 0.0854, 0.1981],
          [0.7333, 0.363, 0.0896, 0.2315],
        ],
      ],
      [
        485500,
        [
          [0.2208, 0.487, 0.076, 0.1796],
          [0.7323, 0.3574, 0.0896, 0.2241],
        ],
      ],
      [
        486500,
        [
          [0.726, 0.3778, 0.0969, 0.2315],
          [0.2073, 0.4907, 0.076, 0.1796],
        ],
      ],
      [
        487500,
        [
          [0.2208, 0.4556, 0.0875, 0.2019],
          [0.7344, 0.3741, 0.0854, 0.2204],
        ],
      ],
      [
        488500,
        [
          [0.2198, 0.4519, 0.0906, 0.2056],
          [0.7365, 0.3815, 0.0844, 0.2148],
        ],
      ],
      [
        489500,
        [
          [0.2219, 0.4426, 0.0865, 0.2056],
          [0.7406, 0.3741, 0.0865, 0.2167],
        ],
      ],
      [
        490500,
        [
          [0.2208, 0.4444, 0.0885, 0.2037],
          [0.7385, 0.3741, 0.0927, 0.2204],
        ],
      ],
      [
        491500,
        [
          [0.2156, 0.4463, 0.0927, 0.2093],
          [0.7302, 0.3741, 0.0927, 0.2296],
        ],
      ],
      [
        492500,
        [
          [0.2188, 0.4519, 0.0885, 0.2056],
          [0.7375, 0.3704, 0.0875, 0.2204],
        ],
      ],
      [
        493500,
        [
          [0.1927, 0.3889, 0.1104, 0.2463],
          [0.7302, 0.3741, 0.0927, 0.237],
          [0.3958, 0.237, 0.0885, 0.1907],
        ],
      ],
      [
        494500,
        [
          [0.2167, 0.4407, 0.0875, 0.2019],
          [0.7385, 0.3704, 0.0865, 0.2167],
          [0.3979, 0.2407, 0.0844, 0.1852],
        ],
      ],
      [
        495500,
        [
          [0.7313, 0.3778, 0.0906, 0.2259],
          [0.2198, 0.4852, 0.0927, 0.1833],
          [0.3979, 0.2407, 0.0833, 0.1833],
        ],
      ],
      [
        496500,
        [
          [0.7292, 0.363, 0.0781, 0.1981],
          [0.2531, 0.5037, 0.101, 0.1963],
          [0.3958, 0.2333, 0.0875, 0.1944],
        ],
      ],
      [
        497500,
        [
          [0.7156, 0.3759, 0.0875, 0.2204],
          [0.2458, 0.4963, 0.1031, 0.1981],
          [0.3958, 0.237, 0.0885, 0.1926],
        ],
      ],
      [
        498500,
        [
          [0.7385, 0.3685, 0.0823, 0.213],
          [0.2458, 0.5, 0.1021, 0.1944],
        ],
      ],
      [
        499500,
        [
          [0.7271, 0.3778, 0.0802, 0.2037],
          [0.2479, 0.5, 0.101, 0.1963],
          [0.3969, 0.237, 0.0865, 0.1907],
        ],
      ],
      [
        500500,
        [
          [0.7292, 0.3815, 0.0781, 0.1981],
          [0.2521, 0.5074, 0.0969, 0.1926],
        ],
      ],
      [
        501500,
        [
          [0.726, 0.3704, 0.0813, 0.213],
          [0.2531, 0.5074, 0.099, 0.1944],
        ],
      ],
      [
        502500,
        [
          [0.7042, 0.3944, 0.0906, 0.2167],
          [0.2531, 0.5093, 0.0979, 0.1926],
        ],
      ],
      [
        503500,
        [
          [0.2208, 0.4444, 0.0917, 0.2056],
          [0.7396, 0.3741, 0.0844, 0.2111],
        ],
      ],
      [
        504500,
        [
          [0.7354, 0.3815, 0.0833, 0.2204],
          [0.2125, 0.4759, 0.0938, 0.2],
        ],
      ],
      [
        505500,
        [
          [0.7323, 0.3778, 0.0802, 0.213],
          [0.2104, 0.4648, 0.0896, 0.1944],
        ],
      ],
      [
        506500,
        [
          [0.7354, 0.3852, 0.0844, 0.2148],
          [0.2052, 0.4444, 0.0917, 0.1963],
        ],
      ],
      [
        507500,
        [
          [0.2021, 0.4481, 0.0885, 0.1926],
          [0.7375, 0.3907, 0.0823, 0.2074],
        ],
      ],
      [
        508500,
        [
          [0.201, 0.45, 0.0896, 0.1926],
          [0.7406, 0.3981, 0.0844, 0.2185],
        ],
      ],
      [
        509500,
        [
          [0.2, 0.4537, 0.0958, 0.1852],
          [0.7323, 0.3852, 0.0875, 0.2278],
        ],
      ],
      [
        510500,
        [
          [0.2146, 0.4815, 0.0854, 0.1815],
          [0.7344, 0.3722, 0.0896, 0.237],
        ],
      ],
      [
        511500,
        [
          [0.7323, 0.3889, 0.0885, 0.2222],
          [0.2271, 0.4981, 0.0906, 0.187],
        ],
      ],
      [
        512500,
        [
          [0.7302, 0.3889, 0.0802, 0.2111],
          [0.2604, 0.5111, 0.1052, 0.1944],
        ],
      ],
      [
        513500,
        [
          [0.7427, 0.3759, 0.0823, 0.2352],
          [0.2583, 0.5167, 0.1021, 0.1926],
        ],
      ],
      [
        514500,
        [
          [0.7417, 0.3722, 0.0875, 0.2315],
          [0.2552, 0.4926, 0.1031, 0.2056],
        ],
      ],
      [
        515500,
        [
          [0.7469, 0.3741, 0.0813, 0.2148],
          [0.2552, 0.4981, 0.1, 0.2],
        ],
      ],
      [
        516500,
        [
          [0.7427, 0.3722, 0.0844, 0.2333],
          [0.251, 0.4926, 0.1021, 0.1981],
        ],
      ],
      [
        517500,
        [
          [0.2448, 0.4704, 0.0917, 0.2019],
          [0.7417, 0.3722, 0.0885, 0.2352],
        ],
      ],
      [
        518500,
        [
          [0.2365, 0.4593, 0.0906, 0.2093],
          [0.7438, 0.387, 0.0854, 0.2241],
        ],
      ],
      [
        519500,
        [
          [0.7323, 0.3759, 0.0875, 0.2259],
          [0.2167, 0.45, 0.0896, 0.2074],
        ],
      ],
      [
        520500,
        [
          [0.7333, 0.3778, 0.0885, 0.2241],
          [0.2094, 0.4463, 0.0927, 0.1981],
        ],
      ],
      [
        521500,
        [
          [0.2167, 0.4444, 0.0906, 0.2037],
          [0.7354, 0.387, 0.0875, 0.2037],
        ],
      ],
      [
        522500,
        [
          [0.2146, 0.4537, 0.0875, 0.1981],
          [0.7354, 0.3852, 0.0854, 0.2074],
        ],
      ],
      [
        523500,
        [
          [0.7365, 0.3889, 0.0875, 0.213],
          [0.2146, 0.4537, 0.0885, 0.2],
        ],
      ],
      [
        524500,
        [
          [0.2125, 0.4519, 0.0875, 0.1981],
          [0.7427, 0.3759, 0.0833, 0.2093],
        ],
      ],
      [
        525500,
        [
          [0.2104, 0.4463, 0.0906, 0.2],
          [0.7406, 0.3759, 0.0844, 0.2148],
        ],
      ],
      [
        526500,
        [
          [0.2052, 0.4463, 0.0927, 0.2019],
          [0.7385, 0.3759, 0.0865, 0.2204],
        ],
      ],
      [
        527500,
        [
          [0.2146, 0.4315, 0.0865, 0.2074],
          [0.7302, 0.3759, 0.0844, 0.2296],
        ],
      ],
      [
        528500,
        [
          [0.2177, 0.4389, 0.0885, 0.2037],
          [0.726, 0.3741, 0.0833, 0.213],
          [0.3927, 0.2426, 0.0927, 0.1907],
        ],
      ],
      [
        529500,
        [
          [0.2167, 0.4537, 0.0885, 0.2037],
          [0.7417, 0.3704, 0.0875, 0.2315],
          [0.3938, 0.237, 0.0885, 0.1944],
        ],
      ],
      [
        530500,
        [
          [0.7344, 0.3963, 0.0906, 0.2204],
          [0.2135, 0.4611, 0.0875, 0.1944],
          [0.3927, 0.2426, 0.0927, 0.1907],
        ],
      ],
      [
        531500,
        [
          [0.2146, 0.4481, 0.0917, 0.213],
          [0.7406, 0.3889, 0.0927, 0.2259],
          [0.3927, 0.2426, 0.0927, 0.187],
        ],
      ],
      [
        532500,
        [
          [0.2146, 0.463, 0.0896, 0.2019],
          [0.7354, 0.3704, 0.0865, 0.2241],
          [0.3938, 0.2389, 0.0885, 0.1907],
        ],
      ],
      [
        533500,
        [
          [0.2115, 0.4667, 0.0906, 0.2],
          [0.725, 0.3759, 0.0844, 0.2278],
        ],
      ],
      [
        534500,
        [
          [0.7385, 0.3852, 0.0833, 0.2093],
          [0.2198, 0.45, 0.0865, 0.1981],
        ],
      ],
      [
        535500,
        [
          [0.2073, 0.4519, 0.0938, 0.2074],
          [0.7281, 0.3833, 0.0823, 0.2167],
        ],
      ],
      [
        536500,
        [
          [0.2021, 0.4519, 0.0906, 0.2093],
          [0.7344, 0.3833, 0.0813, 0.2074],
          [0.3958, 0.237, 0.0875, 0.1907],
        ],
      ],
      [
        537500,
        [
          [0.7365, 0.3741, 0.0823, 0.2056],
          [0.2031, 0.4463, 0.0917, 0.2037],
          [0.3958, 0.2352, 0.0885, 0.1907],
        ],
      ],
      [
        538500,
        [
          [0.2156, 0.4426, 0.0875, 0.2],
          [0.7271, 0.3759, 0.0833, 0.2074],
          [0.3969, 0.2389, 0.0865, 0.187],
        ],
      ],
      [
        539500,
        [
          [0.2115, 0.4611, 0.1, 0.2241],
          [0.7396, 0.3833, 0.0844, 0.2111],
          [0.3969, 0.2389, 0.0865, 0.187],
        ],
      ],
      [
        540500,
        [
          [0.201, 0.4722, 0.1021, 0.2222],
          [0.7271, 0.3759, 0.0823, 0.213],
          [0.3969, 0.2389, 0.0865, 0.187],
        ],
      ],
      [
        541500,
        [
          [0.2219, 0.4722, 0.0896, 0.1963],
          [0.7375, 0.3704, 0.0885, 0.237],
          [0.3969, 0.237, 0.0865, 0.187],
        ],
      ],
      [
        542500,
        [
          [0.2208, 0.4426, 0.0875, 0.2093],
          [0.7385, 0.387, 0.0833, 0.2074],
        ],
      ],
      [
        543500,
        [
          [0.2052, 0.4537, 0.0906, 0.2],
          [0.7417, 0.3852, 0.0833, 0.2093],
        ],
      ],
      [
        544500,
        [
          [0.2063, 0.45, 0.0896, 0.2],
          [0.7323, 0.3759, 0.0792, 0.2093],
        ],
      ],
      [
        545500,
        [
          [0.2073, 0.4352, 0.0948, 0.2111],
          [0.7354, 0.3741, 0.076, 0.2056],
        ],
      ],
      [
        546500,
        [
          [0.2094, 0.4389, 0.0875, 0.2019],
          [0.7313, 0.3833, 0.0875, 0.2315],
        ],
      ],
      [
        547500,
        [
          [0.2063, 0.4315, 0.0938, 0.2111],
          [0.7354, 0.3741, 0.0906, 0.2333],
        ],
      ],
      [
        548500,
        [
          [0.2073, 0.4296, 0.0948, 0.2074],
          [0.7396, 0.3833, 0.0813, 0.2037],
        ],
      ],
      [
        549500,
        [
          [0.1979, 0.4333, 0.0927, 0.2056],
          [0.7323, 0.3778, 0.0813, 0.2111],
        ],
      ],
      [
        550500,
        [
          [0.2, 0.4426, 0.0885, 0.2019],
          [0.7385, 0.3778, 0.0833, 0.2074],
        ],
      ],
      [
        551500,
        [
          [0.199, 0.4426, 0.0865, 0.2037],
          [0.7281, 0.3741, 0.0833, 0.2241],
        ],
      ],
    ],
    segments: [
      {
        mode: "DUAL_STACK",
        layout: "TWO",
        startMs: 481600,
        endMs: 550280,
        two: {
          top: { x: 0, y: 0.1042, w: 0.5, h: 0.7903 },
          bottom: { x: 0.5, y: 0.1042, w: 0.5, h: 0.7903 },
          split: 0.5,
        },
      },
    ],
  },
  "podcast-complex": {
    fromMs: 31370,
    toMs: 67309,
    cutsMs: [38840, 43240, 50040, 62920],
    faces: [
      [
        29500,
        [
          [0.5698, 0.1259, 0.1073, 0.3296],
          [0.3292, 0.5537, 0.1417, 0.2889],
        ],
      ],
      [
        30500,
        [
          [0.5792, 0.1333, 0.1073, 0.3352],
          [0.3281, 0.5574, 0.1427, 0.2852],
        ],
      ],
      [
        31500,
        [
          [0.5979, 0.1426, 0.1177, 0.3056],
          [0.3177, 0.5444, 0.1573, 0.2907],
        ],
      ],
      [
        32500,
        [
          [0.5865, 0.1426, 0.1229, 0.3111],
          [0.3198, 0.5481, 0.1542, 0.2833],
        ],
      ],
      [
        33500,
        [
          [0.574, 0.1463, 0.1198, 0.3222],
          [0.325, 0.5481, 0.1458, 0.2907],
        ],
      ],
      [
        34500,
        [
          [0.574, 0.1426, 0.1125, 0.3093],
          [0.326, 0.5463, 0.1448, 0.2926],
        ],
      ],
      [
        35500,
        [
          [0.5802, 0.1426, 0.1083, 0.3148],
          [0.3229, 0.5537, 0.1479, 0.287],
        ],
      ],
      [36500, [[0.5938, 0.1444, 0.1052, 0.3056]]],
      [37500, [[0.6052, 0.1352, 0.1021, 0.3074]]],
      [38500, [[0.5927, 0.1463, 0.0979, 0.3111]]],
      [39500, []],
      [40500, []],
      [41500, []],
      [42500, []],
      [
        43500,
        [
          [0.5865, 0.1556, 0.1, 0.2963],
          [0.3406, 0.5352, 0.1604, 0.2889],
        ],
      ],
      [
        44500,
        [
          [0.5958, 0.1611, 0.1, 0.2889],
          [0.3427, 0.5222, 0.1469, 0.2944],
        ],
      ],
      [45500, [[0.5854, 0.1481, 0.0927, 0.2963]]],
      [
        46500,
        [
          [0.5865, 0.1685, 0.101, 0.2963],
          [0.3396, 0.5426, 0.1542, 0.263],
        ],
      ],
      [
        47500,
        [
          [0.6, 0.1722, 0.0958, 0.2815],
          [0.3375, 0.5389, 0.1635, 0.2852],
        ],
      ],
      [
        48500,
        [
          [0.6073, 0.1685, 0.0927, 0.3],
          [0.3396, 0.5315, 0.1594, 0.2963],
        ],
      ],
      [
        49500,
        [
          [0.5875, 0.1741, 0.0958, 0.2963],
          [0.3396, 0.5426, 0.1573, 0.2815],
        ],
      ],
      [50500, []],
      [51500, []],
      [52500, []],
      [53500, []],
      [54500, []],
      [55500, []],
      [56500, []],
      [57500, []],
      [58500, []],
      [59500, []],
      [60500, []],
      [61500, []],
      [62500, []],
      [
        63500,
        [
          [0.6031, 0.1407, 0.099, 0.3296],
          [0.3521, 0.5111, 0.15, 0.2963],
        ],
      ],
      [64500, [[0.6042, 0.1278, 0.1021, 0.3093]]],
      [
        65500,
        [
          [0.5719, 0.1407, 0.0979, 0.3111],
          [0.3323, 0.5204, 0.1708, 0.3426],
        ],
      ],
      [
        66500,
        [
          [0.5813, 0.1537, 0.0958, 0.3037],
          [0.3375, 0.5389, 0.1604, 0.2852],
        ],
      ],
      [
        67500,
        [
          [0.5625, 0.2037, 0.099, 0.2778],
          [0.3365, 0.5315, 0.1635, 0.2963],
        ],
      ],
    ],
    segments: [
      {
        mode: "DUAL_STACK",
        layout: "TWO",
        startMs: 31370,
        endMs: 37000,
        two: {
          top: { x: 0, y: 0.1037, w: 0.5, h: 0.7917 },
          bottom: { x: 0.5, y: 0.1037, w: 0.5, h: 0.7917 },
          split: 0.5,
        },
      },
      { mode: "CROP", layout: "ONE", startMs: 37000, endMs: 40000, one: { x: 0.4901, y: 0, w: 0.3156, h: 1 } },
      { mode: "CROP", layout: "ONE", startMs: 40000, endMs: 47000, one: { x: 0.474, y: 0, w: 0.3156, h: 1 } },
      {
        mode: "DUAL_STACK",
        layout: "TWO",
        startMs: 47000,
        endMs: 51000,
        two: {
          top: { x: 0, y: 0.1037, w: 0.5, h: 0.7917 },
          bottom: { x: 0.5, y: 0.1037, w: 0.5, h: 0.7917 },
          split: 0.5,
        },
      },
      { mode: "CROP", layout: "ONE", startMs: 51000, endMs: 67309, one: { x: 0.3661, y: 0, w: 0.3156, h: 1 } },
    ],
  },
};

export const seedVideos = [
  {
    id: "vid-social-podcast",
    name: "Podcast — Karl Ortmanns × Emeric Ernoult.mp4",
    url: "https://cdn.library.beta.agorapulse.com/organizations/888/workspaces/885/studio/studio_1JmSPgtn1nm2qZvLcz1wKK.mp4",
    width: 1280,
    height: 720,
    durationMs: 3119833,
    posterMs: 500000,
    addedAt: "2026-10-21T09:12:00Z",
    settings: { ratio: "9:16", subtitlePreset: "karaoke" },
    analysis: ANALYSIS["podcast-dual-stack"],
    fallback: {
      mode: "DUAL_STACK",
      layout: "TWO",
      two: {
        top: { x: 0, y: 0.1042, w: 0.5, h: 0.7903 },
        bottom: { x: 0.5, y: 0.1042, w: 0.5, h: 0.7903 },
        split: 0.5,
      },
    },
    clips: [
      {
        startMs: 92000,
        endMs: 128000,
        title: "Why most brands post too much",
        summary: "Posting more rarely buys reach; it buys fatigue.",
        why: "A contrarian opener that lands in one breath. Strong hook for a vertical feed.",
        tags: ["contrarian", "strategy"],
        network: "linkedin",
      },
      {
        startMs: 305000,
        endMs: 352000,
        title: "The one metric to report to a client",
        summary: "Skip the vanity numbers: report what the client's boss asks about.",
        why: "Concrete and quotable. Agencies share this kind of advice.",
        tags: ["agencies", "reporting"],
        network: "linkedin",
      },
      {
        startMs: 481600,
        endMs: 550280,
        title: "Building a social team that doesn't burn out",
        summary: "Rotations, quiet hours and a shared inbox keep a small team sane.",
        why: "Both speakers on screen, a real exchange. Works as a dialogue clip.",
        tags: ["team", "wellbeing"],
        network: "instagram",
      },
      {
        startMs: 702000,
        endMs: 741000,
        title: "Answering a negative comment in public",
        summary: "Reply once, in public, then take it private: never argue in a thread.",
        why: "A rule people can apply today. Short enough for Reels and TikTok.",
        tags: ["community", "crisis"],
        network: "tiktok",
      },
      {
        startMs: 960000,
        endMs: 1012000,
        title: "What AI changes for community managers",
        summary: "AI drafts the first reply; the human still decides the tone.",
        why: "Timely topic with a clear stance. Good for LinkedIn reach.",
        tags: ["ai", "community"],
        network: "linkedin",
      },
      {
        startMs: 1244000,
        endMs: 1281000,
        title: "Three questions before you hit publish",
        summary: "Who is it for, why now, what should they do next.",
        why: "A checklist format that reads well with subtitles on mute.",
        tags: ["checklist", "content"],
        network: "instagram",
      },
      {
        startMs: 1530000,
        endMs: 1578000,
        title: "Social ROI without a spreadsheet",
        summary: "Tie three posts a month to one business outcome and track only that.",
        why: "Plain-language take on a topic people find intimidating.",
        tags: ["roi", "measurement"],
        network: "linkedin",
      },
      {
        startMs: 1903000,
        endMs: 1950000,
        title: "Why LinkedIn wins for B2B",
        summary: "Decision-makers read there, and they read to the end.",
        why: "Opinionated, network-specific and easy to agree with: shareable.",
        tags: ["linkedin", "b2b"],
        network: "linkedin",
      },
      {
        startMs: 2310000,
        endMs: 2352000,
        title: "The mistake founders make on video",
        summary: "Over-producing it. A phone and a point of view beat a studio.",
        why: "Encouraging and specific; ends on a quotable line.",
        tags: ["video", "founders"],
        network: "tiktok",
      },
      {
        startMs: 2790000,
        endMs: 2836000,
        title: "Advice for your first social hire",
        summary: "Hire for judgment and writing; tools can be taught in a week.",
        why: "Closes the episode on practical advice. Good last clip of a series.",
        tags: ["hiring", "team"],
        network: "linkedin",
      },
    ],
  },
  {
    id: "vid-journey-panel",
    name: "Panel — For the journey.mp4",
    url: "https://cdn.library.beta.agorapulse.com/organizations/888/workspaces/885/studio/studio_1e270QqO2AqUyE7fgDdt0W.mp4",
    width: 1920,
    height: 1080,
    durationMs: 68120,
    posterMs: 10000,
    addedAt: "2026-10-23T15:40:00Z",
    settings: { ratio: "9:16", subtitlePreset: "deep-diver" },
    analysis: ANALYSIS["podcast-complex"],
    fallback: { mode: "CROP", layout: "ONE", one: { x: 0.49, y: 0, w: 0.3164, h: 1 } },
    clips: [
      {
        startMs: 2000,
        endMs: 28000,
        title: "Why the church opened its doors",
        summary: "The decision to shelter refugees, told by the people who made it.",
        why: "Sets the stakes in under thirty seconds. A strong first clip.",
        tags: ["story", "refugees"],
        network: "instagram",
      },
      {
        startMs: 31370,
        endMs: 51000,
        title: "The outcome nobody expected",
        summary: "Every family they protected was allowed to stay.",
        why: "The emotional peak of the talk, with a clear before and after.",
        tags: ["outcome", "impact"],
        network: "linkedin",
      },
      {
        startMs: 51000,
        endMs: 67309,
        title: "When protecting people led to an investigation",
        summary: "The success came at a price: a legal investigation against the pastor.",
        why: "A twist that makes people stop scrolling, and ends on a question.",
        tags: ["twist", "justice"],
        network: "tiktok",
      },
    ],
  },
];
