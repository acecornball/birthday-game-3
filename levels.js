// ============================================================
//  LEVELS. Everything is on a grid of 32px tiles.
//  Map is 12 rows tall (row 0 = top, row 11 = bottom).
//  Normal ground has its top at row 10, so things STANDING on
//  it sit in row 9.
//
//  ground:      [fromCol, toCol, topRow?]   (topRow defaults to 10)
//  blocks:      [row, fromCol, toCol]       solid waffle blocks
//  plats:       [row, fromCol, toCol]       candy platforms (jump up through them)
//  item:        'present' | 'cupcake' | 'star'  (what the collectibles are in this level)
//  gifts:       [col, row]                  the collectibles
//  enemies:     [col, row]                  grumpy broccoli
//  springs:     [col, row]                  bouncy trampolines
//  checkpoints: [col, row]
//  start/finish:[col, row]
// ============================================================
const line = (c1, c2, r) => { const a = []; for (let c = c1; c <= c2; c++) a.push([c, r]); return a; };

window.LEVELS = [
  // ---------------------------------------------------------- 1
  {
    name: "Party Garden",
    theme: "garden",
    item: "present",          // what you collect here: present | cupcake | star
    width: 100,
    unlock: null,
    tip: [
      "Run, jump, and tap jump twice to DOUBLE JUMP!",
      "Land on grumpy broccoli to squash it!",
    ],
    ground: [[0, 22], [26, 45], [49, 70], [73, 99]],
    plats: [[8, 9, 12], [6, 14, 17], [8, 30, 33], [6, 34, 37], [8, 53, 56], [6, 58, 61], [5, 63, 66]],
    blocks: [],
    gifts: [
      ...line(5, 7, 9), ...line(9, 12, 7), ...line(14, 17, 5),
      [23, 8], [24, 7], [25, 8],
      ...line(30, 33, 7), ...line(34, 37, 5),
      [41, 3], [42, 3], [43, 3],
      [46, 8], [47, 7], [48, 8],
      ...line(53, 56, 7), ...line(58, 61, 5), ...line(63, 66, 4),
      [71, 8], [72, 8],
      ...line(76, 79, 9), ...line(86, 89, 9),
    ],
    enemies: [[16, 9], [38, 9], [53, 9], [66, 9], [82, 9], [90, 9]],
    springs: [[41, 9]],
    checkpoints: [[27, 9], [50, 9], [74, 9]],
    start: [2, 9],
    finish: [96, 9],
  },

  // ---------------------------------------------------------- 2
  {
    name: "Candy Canyon",
    theme: "candy",
    item: "cupcake",
    width: 115,
    unlock: "confetti",
    tip: [
      "NEW POWER: Confetti Popper!",
      "Press the party button to pop broccoli from far away.",
    ],
    ground: [[0, 18], [22, 34], [39, 52], [56, 75], [79, 95], [99, 114]],
    plats: [[8, 23, 26], [6, 28, 31], [8, 36, 37], [8, 41, 44], [6, 46, 49], [8, 57, 60], [8, 70, 73]],
    blocks: [[9, 62, 65], [8, 63, 65], [7, 64, 65], [9, 85, 85], [8, 85, 85], [7, 85, 85]],
    gifts: [
      ...line(4, 7, 9),
      [19, 8], [20, 7], [21, 8],
      ...line(23, 26, 7), ...line(28, 31, 5),
      [35, 8], [36, 7], [37, 7], [38, 8],
      ...line(41, 44, 7), ...line(46, 49, 5),
      [53, 8], [54, 7], [55, 8],
      ...line(57, 60, 7), [64, 6], [65, 6], ...line(70, 73, 7),
      [76, 8], [77, 7], [78, 8],
      ...line(80, 83, 9), [85, 5], ...line(88, 91, 9), [92, 3], [93, 3],
      [96, 8], [97, 7], [98, 8],
      ...line(102, 105, 9),
    ],
    enemies: [[10, 9], [14, 9], [30, 9], [42, 9], [48, 9], [60, 9], [68, 9], [82, 9], [90, 9], [104, 9], [108, 9]],
    springs: [[92, 9]],
    checkpoints: [[23, 9], [40, 9], [57, 9], [80, 9], [100, 9]],
    start: [2, 9],
    finish: [111, 9],
  },

  // ---------------------------------------------------------- 3
  {
    name: "Cake Mountain",
    theme: "cake",
    item: "star",
    width: 130,
    unlock: "glide",
    tip: [
      "NEW POWER: Balloon Glide!",
      "Hold jump while falling to float down to the cake.",
    ],
    ground: [
      [0, 16], [20, 30], [34, 46, 8], [50, 60, 8], [64, 72, 6],
      [77, 86, 6], [91, 100, 8], [106, 112], [118, 129],
    ],
    plats: [[9, 103, 104], [9, 114, 116]],
    blocks: [],
    gifts: [
      ...line(4, 7, 9),
      [17, 8], [18, 7], [19, 8],
      ...line(21, 24, 9),
      [31, 7], [32, 6], [33, 7],
      ...line(35, 38, 7),
      [47, 6], [48, 5], [49, 6],
      ...line(51, 54, 7), ...line(56, 58, 5),
      [61, 5], [62, 4], [63, 5],
      ...line(65, 68, 5),
      ...line(73, 76, 3),
      ...line(78, 81, 5),
      ...line(87, 90, 4),
      ...line(92, 95, 7),
      ...line(101, 105, 6), [103, 8], [104, 8],
      ...line(107, 110, 9),
      ...line(113, 117, 7),
      ...line(120, 123, 9),
    ],
    enemies: [
      [8, 9], [12, 9], [24, 9], [28, 9], [38, 7], [43, 7], [54, 7], [58, 7],
      [67, 5], [70, 5], [79, 5], [84, 5], [94, 7], [98, 7], [108, 9], [121, 9],
    ],
    springs: [],
    checkpoints: [[21, 9], [35, 7], [51, 7], [65, 5], [78, 5], [92, 7], [106, 9], [118, 9]],
    start: [2, 9],
    finish: [125, 9],
  },
];
