# Daily Mystery Merge — React Native Game Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bare React Native app whose game screen plays Daily Mystery Merge exactly as designed on the canvas, and stays smooth (60/120 fps) on real phones.

**Architecture:** The whole simulation (circle physics, merge rules, particles) is plain TypeScript written as worklets and runs on the UI thread inside a Reanimated `useFrameCallback`, so React work on the JS thread can never stall a frame. Skia draws the world (background, jar layers, fruit and particle atlases, aim line, popups) from that UI-thread state. React only renders the HUD and overlays, fed by a small event queue the worklet flushes to JS.

**Tech Stack:** React Native 0.88.0 (bare, New Architecture), TypeScript, @shopify/react-native-skia 2.14, react-native-reanimated 4.7 + react-native-worklets 0.13, react-native-gesture-handler 3.4, react-native-safe-area-context 5.10, react-native-haptic-feedback 3.0, @react-native-async-storage/async-storage 3.1, react-native-audio-api 0.13, Jest.

**Spec:** `docs/game-design.md` (sections 1 and 3 drive this plan) and the design canvas https://claude.ai/artifact/4hBC8nBkMuxEsoFfpKGRpt (frames: Gameplay live, Merge combo, Discovery reveal, Danger zone, Pause sheet, Jar full). Art already generated in `assets/raw` and `assets/web`.

## Global Constraints

- React Native 0.88.0 bare project (no Expo), project root = repo root, app name `MysteryMerge`, display name "Mystery Merge", bundle id / package `com.mysterymerge.game`. No git commits unless the user asks (`--skip-git-init`).
- World coordinates are the canvas design's 390×844 frame; the stage is scaled uniformly to the device and letterboxed by the background.
- Jar inner walls x 33–357 (W = 324), inner floor y 704, rim band y 240–266, danger line y 296, hanging fruit y 205, inner bottom corner radius 30.
- Fruit radius = W × [0.045, 0.06, 0.075, 0.09, 0.11, 0.13, 0.155, 0.18, 0.21, 0.245, 0.29][tier−1].
- Drop pool tiers 1–5 with weights [30, 28, 22, 13, 7], mulberry32 seeded by local date YYYYMMDD; identical sequence for everyone that day and on every restart.
- Merge pays tier×(tier+1) for the new tier; two Jackfruits vanish for 500. Combo window 1.2s; ×1.5 points at combo ≥ 4.
- Merge timeline: ghosts slide to midpoint and shrink to 70% over 90ms; white flash; new fruit at 40% scale with upward pop; visual spring 40% → ~118% → ~95% → 100% over 230ms; 12–24 droplets (+30% per combo step); ring 0.5 → 2.0 over 320ms; "+pts" floats 42px; screen shake 1–5px by tier; neighbour impulse 30ms after spawn.
- Discovery (first time a tier is made by merging): time scale 0.3 for 400ms, dim 48% with a hole around the new fruit, reveal card with name, fun fact and "t/11" for 1.95s, confetti; non-blocking.
- Danger: pile top within 15% of the danger line → line pulses red + red vignette; game over when the pile top stays above the line for 2000ms (fresh drops < 900ms old and growing fruits ignored).
- Faces draw at 30% of body rotation; breathing ±1.1% over 2.5s; landing squash 0.15 amplitude; falling stretch x0.95 y1.07.
- Colors: cream #FFF6E9, plum #2B1D3A, muted text #6E6180, mystery purple #6C4BD8 / #5A3BD0, mango CTA #FF9A4D → #E0520C, mint #2FBF8F, danger #FF4D5E, gold #FFB547. Fonts: Fredoka 600/700, Nunito 700/800. Tap targets ≥ 48pt.
- Haptics: light for drop and merge; medium for combo ×3+ and discovery; heavy for tier 10–11 and game over. Sound: synthesized, C major pentatonic, tier 1 highest pitch, +1 semitone per combo step (cap +7), low boom for tiers 9–11.
- Smoothness budget: simulation + draw ≤ 4ms per frame on an iPhone 12-class device; no React state updates inside the frame loop except through the event queue (≤ a few per second).

## Review Focus

- Small and odd screens (iPhone SE 375×667, 430×932, Android 412×915): stage must fit between safe-area insets with no HUD/jar overlap.
- Frame gaps (app backgrounded, debugger pause, dropped frames): dt is clamped and substeps capped, so the pile never explodes on resume.
- Rapid or multi-finger taps: one drop per 480ms cooldown; no drops while paused, during game over, or before assets load.
- Chain reactions: a fruit can merge at most once per step; a 3-way contact of equal tiers makes exactly one merge.
- Restart/background during a reveal or game-over sequence: timers and pending merges are dropped, never applied to the new run.

---

### Task 1: Scaffold the bare app and toolchain

**Files:**
- Create (CLI): `package.json`, `App.tsx`, `index.js`, `ios/`, `android/`, `babel.config.js`, `metro.config.js`, `tsconfig.json`, `jest.config.js`
- Create: `react-native.config.js` (font assets), `src/assets/fonts/` (Fredoka 600/700, Nunito 700/800 TTFs from @expo-google-fonts)

**Interfaces:**
- Produces: a building iOS + Android app; `npm test` runs Jest over `src/**/__tests__`.

- [ ] **Step 1:** `npx @react-native-community/cli@20.2.0 init MysteryMerge --version 0.88.0 --skip-git-init --skip-install` in a temp dir, move the project into the repo root (keep `assets/`, `docs/`, `refs/`).
- [ ] **Step 2:** Install the Tech Stack libraries at the listed versions; add `react-native-worklets/plugin` as the last Babel plugin; set bundle id `com.mysterymerge.game`, portrait only, status bar hidden.
- [ ] **Step 3:** Copy fonts, link with `npx react-native-asset`.
- [ ] **Step 4:** Verify: `npm test` passes the template test; `npx react-native run-ios --simulator "iPhone 16 Pro"` launches the app.

### Task 2: Game config, RNG and sprite atlases

**Files:**
- Create: `src/game/config.ts`, `src/game/rng.ts`, `tools/build_atlas.py`, `src/assets/sprites/fruits.png`, `src/assets/sprites/fruits.json`, `src/assets/sprites/particles.png`
- Test: `src/game/__tests__/rng.test.ts`

**Interfaces:**
- Produces: `JAR`, `W`, `RADII: number[]`, `DANGER_Y`, `HANG_Y`, `CORNER_R`, `TIERS: {name, color, juice, fact}[]` (values from the canvas Main.dc.html), `mulberry32(seed): () => number`, `daySeed(d: Date): number`, `pickTier(rand: () => number): 1|2|3|4|5` — all worklets. Atlas JSON: per tier `{x, y, w, h, cx, cy, r}` in atlas pixels at 3× the on-screen size (`k = RADII*1.04/r`).

- [ ] **Step 1:** Test: `daySeed(new Date(2026, 9, 25)) === 20261025`; same seed ⇒ identical first 50 picks; picks ⊂ {1..5}; over 10 000 picks tier 1 frequency within 30% ± 2%.
- [ ] **Step 2:** Implement; run tests (PASS).
- [ ] **Step 3:** `tools/build_atlas.py` packs the 11 trimmed fruit sprites (shadow baked in, like the canvas) and white particle sprites (droplet, spark star, confetti, ring dot) into PNG atlases + JSON; run it.

### Task 3: UI-thread circle physics

**Files:**
- Create: `src/game/physics.ts`
- Test: `src/game/__tests__/physics.test.ts`

**Interfaces:**
- Produces (all worklets, struct-of-arrays world): `createWorld(cap: number): World`, `addBody(w, tier, x, y, angle?): number` (returns id), `removeBody(w, id)`, `stepWorld(w, dt): void` (fixed 1/120s step: integrate, 8 solver iterations of walls + chamfers + circle contacts, mass ∝ r²·density(tier), restitution ≈ 0.2, friction via tangential damping, rolling angle from contact slip), `contactsOfSameTier(w): [idA, idB][]` (each id at most once), `setVelocity(w, id, vx, vy)`, `scaleBody(w, id, s)`.

- [ ] **Step 1:** Tests: 20 random drops settle within 4s sim with no pair overlapping > 1.5px and every body inside the jar; at rest max speed < 0.02 px/ms after 6s (no jitter); a body dropped at the wall never escapes; 3 equal-tier bodies in mutual contact yield exactly one pair; `stepWorld` with dt clamped from 500ms keeps everything inside.
- [ ] **Step 2:** Implement; run tests (PASS). Tune until the settled pile from `presets` in the canvas looks equally packed.

### Task 4: Game rules engine

**Files:**
- Create: `src/game/engine.ts`, `src/game/fx.ts`
- Test: `src/game/__tests__/engine.test.ts`

**Interfaces:**
- Consumes: Task 2 config/rng, Task 3 physics.
- Produces (worklets): `createGame(seed, opts): Game`, `tickGame(g, dtMs): void` (time scale, physics substeps with interpolation snapshots, merge pipeline per Global Constraints, growth, danger, game over sequence, fx update), `dropFruit(g, x): boolean`, `useShake(g)`, `usePop(g)`, `restartGame(g, seed)`, `drainEvents(g): GameEvent[]` where `GameEvent = {type: 'score'|'next'|'discover'|'reveal'|'danger'|'gold'|'over'|'haptic'|'sound', ...}`. `fx.ts`: `spawnBurst`, `spawnConfetti`, `updateFx`.

- [ ] **Step 1:** Tests: merging two tier-3 makes one tier-4 and +20 points; four merges within 1.2s each set combo 4 and pay ×1.5; first tier-6 merge emits `discover` + `reveal`, a second one doesn't; two Jackfruits vanish for 500; drop cooldown 480ms rejects a second drop; pile held above y 296 for 2000ms emits `over` once; pop removes the smallest (highest on ties); restart resets score, counters and pending timers.
- [ ] **Step 2:** Implement; run tests (PASS).

### Task 5: Skia game canvas and frame loop

**Files:**
- Create: `src/render/GameCanvas.tsx`, `src/render/Jar.tsx`, `src/render/useStageLayout.ts`
- Test: `src/render/__tests__/layout.test.ts`

**Interfaces:**
- Consumes: Task 4 `Game` in a shared value, atlases from Task 2.
- Produces: `<GameCanvas game={SharedValue<Game>} layout={StageLayout} />`; `useStageLayout(win, insets): {s, ox, oy}` with `s = min(W/390, (H − extra)/844)`.

- [ ] **Step 1:** Layout tests for 375×667, 390×844, 402×874, 430×932, 412×915: stage fits inside insets, HUD top ≥ inset top.
- [ ] **Step 2:** Implement: one `useFrameCallback` calls `tickGame`; Skia `Atlas` for fruits (`useRSXformBuffer` from interpolated positions, 30% rotation, squash/breath/spring scales), second `Atlas` for particles with per-sprite colors, aim dots, hanging fruit with spawn spring and wobble, jar back/front paths ported from the canvas SVG, popups with Fredoka.

### Task 6: Input, HUD and overlays

**Files:**
- Create: `src/ui/GameScreen.tsx`, `src/ui/Hud.tsx`, `src/ui/ChainStrip.tsx`, `src/ui/PowerUps.tsx`, `src/ui/RevealCard.tsx`, `src/ui/PauseSheet.tsx`, `src/ui/GameOverCard.tsx`, `src/ui/Button3D.tsx`, `src/ui/theme.ts`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: Task 4 events via a 100ms-or-on-change `runOnJS` flush, Task 5 canvas.
- Produces: the finished game screen matching the six canvas frames.

- [ ] **Step 1:** Pan + tap gestures run on the UI thread: aim follows the finger with 45ms easing; release drops.
- [ ] **Step 2:** HUD, chain strip (shimmer, burst, top glow), next bubble (swap pop), Shake/Pop pills with 3D press, reveal card flip, pause sheet, game over card with Play again.
- [ ] **Step 3:** Verify on the iPhone 16 Pro simulator with the dev autoplay flag: screenshots of live play, a merge burst, discovery card, danger and game over; compare against the canvas frames.

### Task 7: Sound, haptics, persistence, release check

**Files:**
- Create: `src/services/sound.ts`, `src/services/haptics.ts`, `src/services/storage.ts`

**Interfaces:**
- Produces: `playSfx(name, tier?, combo?)`, `haptic('light'|'medium'|'heavy')`, `loadBest()/saveBest(n)`; toggles in the pause sheet.

- [ ] **Step 1:** Port the canvas synth (`sfx` in Main.dc.html) to react-native-audio-api; map events to haptics per Global Constraints; persist best score.
- [ ] **Step 2:** Verify: iOS simulator run plays sounds; `cd android && ./gradlew assembleDebug` succeeds; Release build of iOS compiles.
