# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Clone of the arcade game Asteroids using HTML5 Canvas and plain ES6+ JavaScript. There are no dependencies, frameworks or bundler. All game logic lives in `game.js`, and `index.html` only provides the 800×600 canvas and loads the script. The project's docs and in-game text are in Spanish.

## Commands

There is no build, lint or test tooling. To run the game, open `index.html` directly in a browser or start a local server:

```bash
npx serve .
```

Then visit `http://localhost:3000`.

## Architecture

- **Game loop:** `loop()` calls `update(dt)` then `draw()` on each `requestAnimationFrame`. `dt` is in seconds and capped at 0.05.
- **Global state:** `ship`, `bullets`, `asteroids`, `particles`, `powerUps`, `score`, `lives`, `level`, `state`, `deadTimer`, `hitsUntilPowerUp` and `powerUpMsgTimer` are module-level variables. Classes draw through the global `ctx` and read input from the global `keys`.
- **State machine:** `state` is `'playing'`, `'dead'` or `'gameover'`. `update()` has a separate early-return branch for each non-playing state, and each branch updates only some entities. `draw()` always draws every entity, so anything a branch skips stays on screen frozen.
- **Entity lifecycle:** entities set `dead = true`, and `update()` removes them with `filter`. Asteroid fragments collect in `newAsteroids` and are merged after the collision loop.
- **Asteroid sizes:** `size` is 1 (small) to 3 (large) and indexes the `RADII`, `SPEEDS` and `POINTS` arrays, whose index 0 is unused.
- **Input:** `keys` holds keys that are currently down. `pressed(code)` reads and clears a one-shot flag in `justPressed`, and only `update()` branches that call it consume the press.
- **Toroidal space:** `Ship`, `Asteroid` and `PowerUp` positions go through `wrap()`. Particles don't wrap, and bullets die when they leave the screen.

## Known mismatch

`README.md` mentions a shooting-star asteroid, but it doesn't exist in `game.js`.
