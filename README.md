# Azaan's Birthday Adventure

A 3-level birthday platformer that runs in the browser on any Android phone or iPad.
No game engine, no installs needed to play, just plain HTML + JavaScript.

Azaan's pixel character is already in (`assets/player.png`), and the game is already
personalised for him. Everything left is testing it and putting it on his device.

## What's in the game

| | |
|---|---|
| Moves | run, jump (tap = hop, hold = high), double jump, stomp enemies |
| Level 1 Party Garden | collect **presents**, grumpy broccoli, trampoline |
| Level 2 Candy Canyon | collect **cupcakes**, unlocks the **confetti popper** (wand pose, pops enemies) |
| Level 3 Cake Mountain | collect **stars**, unlocks the **balloon glide** (hold jump while falling), ends at a giant cake with 7 candles |
| Name letters | the letters **A-Z-A-A-N** are hidden in every level (always reachable, left to right). They fill in at the top of the screen, and finding all five gives a **BONUS!** fanfare. Change `name` in `config.js` and the letters change too (up to 10) |
| Messages | little notes "from Moeez" pop up at the flags, picked at random |
| Ending | fireworks, two cheering Azaans, "Happy 7th Birthday Azaan!", "Love, your big brother Moeez", the Happy Birthday tune |
| Kid-friendly | no game over, falling = back to the last flag, forgiving jump timing and a small hitbox |

## 1. Change the words (no coding)

Open `config.js`:

- `name`, `age`, `sender`, `from` (the line shown at the very end), `finalMessage`
- `firstMessage` shows at the first flag, `lastMessage` at the last flag
- `messages` is the pool of random notes. Add, remove or rewrite them. `{name}` becomes his name. Keep each under about 60 letters so it fits on two lines.

Look and feel: the colours come from Azaan's sprite (navy jeans, sky blue, cream, red, orange, green).
Fonts are bundled in `assets/fonts` (Fredoka for text, Pixelify Sans for the big name), so they work offline.
Both are free under the SIL Open Font License (licence files included).

## 2. Play it on your computer

```bash
cd birthday-game
python3 -m http.server 8000
```

Open http://localhost:8000. Keyboard: arrows/WASD move, Space or Up = jump, X = confetti.

To test on your phone: same wifi, open `http://YOUR-COMPUTER-IP:8000` on the phone.

## 3. Put it on his Android phone / iPad

Phones can't open the files directly, so the game needs a web address. Free options:

- **Netlify Drop** (easiest): drag the whole `birthday-game` folder onto app.netlify.com/drop.
  Make a free account so the link doesn't expire.
- **GitHub Pages** or **Cloudflare Pages** also work.

Then, on HIS device:

- **iPad (Safari):** open the link, tap Share, **Add to Home Screen**. It opens full screen like an app.
- **Android (Chrome):** open the link, menu, **Install app** / **Add to Home screen**.

After the first load it works **offline**. Do this once on the device before the party.
Updating later: upload again, then open the game and reload it twice.

Privacy: only the cartoon sprite goes online, never his real photo. Keep the link private
(don't post it), since anyone with the link can play. The game files contain no photos.

## 4. Change the levels

Everything is in `levels.js`: gaps, platforms, enemies, flags, and which collectible each
level uses (`item: "present" | "cupcake" | "star"`). See the legend at the top of the file.
After editing, run `node tools/test_game.js` (needs Node) to check nothing is placed inside
a wall and that a test bot can still finish every level.

## 5. Changing the character later

`assets/player.png` is a row of 32x32 frames. It was built from `source/azaan_sprite_sheet.png`
by `tools/build_azaan_sheet.py` (it removes the fake checkerboard, shrinks the art back to
true pixels, and lines up head and feet). To use a different sheet, edit the `FRAMES` list in
that script, run it, and update the `anim` frame numbers in `config.js`.

Simpler route for a brand new character: make 8 poses (`idle1 idle2 run1 run2 run3 run4 jump fall`,
solid magenta background) and run `python3 tools/make_sheet.py my_poses/`. Then in `config.js`
delete the `anim` block and set `frameW: 64, frameH: 64, frames: 8, drawSize: 52, footPad: 2`.

## Files

```
index.html      page + touch buttons
config.js       names, messages, sprite settings   <- edit
levels.js       the 3 levels                       <- edit
game.js         the game itself
assets/         player.png (Azaan), app icons, fonts/
source/         the original sprite sheet
tools/          build_azaan_sheet.py, make_sheet.py, make_icons.py, test_game.js
```

## Troubleshooting

- **He's tiny or huge:** `drawSize` in `config.js` (keep it a multiple of 32 so the pixels stay crisp).
- **A cartoon kid in a party hat shows instead of Azaan:** `assets/player.png` didn't load. Check the file is in `assets/`, then reload twice.
- **No sound on iPad:** make sure the silent switch is off, then tap once. Browsers only allow audio after a tap.
- **Buttons don't show on a computer:** they only appear on touch devices. Press **T** to show or hide them, or add `?touch=1` to the address.
- **Portrait mode:** the game asks to rotate to landscape.
