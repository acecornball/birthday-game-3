// ============================================================
//  EDIT THIS FILE to personalise the game. No coding needed.
// ============================================================
window.CONFIG = {
  name: "Azaan",                         // his name, shown on title + win screens
  age: 7,                                // turning this age
  sender: "Moeez",                       // who the little messages come from
  from: "Love, your big brother Moeez",  // shown at the very end
  finalMessage: "You did it, Azaan! Now it's cake time!",

  // Little notes that pop up at the flags, picked at random.
  // {name} is replaced with his name. Keep them short (about 60 letters).
  firstMessage: "Happy 7th Birthday, {name}! Let's go!",   // first flag of the game
  lastMessage: "Almost there, {name}! The cake is waiting!", // last flag of the game
  messages: [
    "{name}, you're the fastest runner in the whole world!",
    "Your big brother is SO proud of you!",
    "Psst... the broccoli is scared of you.",
    "Seven years of awesome, and this is only the start!",
    "You jump better than me, {name}. For real!",
    "{name} the Champion! That's you!",
    "You're doing amazing. Don't stop now!",
    "Cake is waiting at the end. Hurry!",
    "High five, {name}! Virtual, but it counts.",
    "Squash the broccoli. Then eat cake. Good plan!",
    "You're my favourite little brother, {name}.",
    "Careful... that broccoli looks grumpy!",
    "Best birthday player ever. Official fact.",
  ],

  // Sprite sheet: one row of 32x32 frames (made by tools/build_azaan_sheet.py).
  // `anim` says which frames to use for which move.
  sprite: {
    file: "assets/player.png",
    frameW: 32,
    frameH: 32,
    frames: 29,
    drawSize: 64,   // how big he appears (2x the art = crisp pixels). Keep a multiple of 32.
    footPad: 1,     // empty pixel rows under his feet inside each frame
    anim: {
      idle:    [0, 1, 0, 1, 0, 2],          // breathing, then a wink
      run:     [3, 4, 5, 6, 7, 8],
      jump:    [9],
      jumpTop: [10],
      fall:    [11],
      glide:   [13, 14],
      shoot:   [15, 16, 17, 18],
      cheer:   [19, 20, 21, 22, 23, 24],
      cheer2:  [25, 26, 27, 28],
    },
  },
};
