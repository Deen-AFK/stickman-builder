# Stickman Builder

A small five-level 2D platformer made with **Phaser 3** and **Vite**. Phaser supplies the game loop, Arcade Physics, camera, and input handling; Vite gives the project a quick local development server. All characters and effects are drawn from original geometric shapes, with no external art assets.

## Project files

- `index.html` contains the game page and its play, pause, restart, and building controls.
- `src/main.js` starts Phaser, connects the HTML controls, and manages the level-select and campaign screens.
- `src/game.js` runs player physics, enemies, building placement, level transitions, and win/loss states.
- `src/levels.js` contains the five platform layouts, lava zones, enemy settings, and level-specific building inventories.
- `src/style.css` styles the responsive game interface.
- `package.json` lists Phaser and Vite and their development scripts.

## Run it

Install Node.js 20.19+ (or 22.12+) and npm, then run these commands from this folder:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To verify a production build, run `npm run build`.

## Controls

- Select an unlocked course from the level screen. Courses unlock in order as you reach their flags.
- Move with **A/D** or **Left/Right**; jump with **W**, **Up**, or **Space**.
- Choose **Wall**, **Ramp**, **Platform**, or **Ladder** on the toolbar (or press **1–4**), then click to place on the 32-pixel grid. Each course has a separate limited inventory.
- Click or tap a placed piece to remove it and recover that piece. Invalid placements show a pink preview and are rejected.
- Use **Pause** or **Restart** in the top bar. Touching lava or an enemy restarts the current course; the finish flag advances the campaign.
