# Daily Mystery Merge — Game Design & Asset Prompts

25 Oct 2026 · @Paresh

## 1. Game overview

Daily Mystery Merge is a physics drop-and-merge puzzle in a glass jar: two identical items merge into the next tier, and every day the 11-tier chain is a secret you uncover as you play.

### Core loop
1. Move the next item left or right above the jar, then tap to drop it.
2. Two identical items touching merge into the next tier, with a big juicy merge animation.
3. Tiers you have not made yet show as "?" silhouettes in the chain strip. Making one reveals it with a fun fact.
4. The run ends when the pile stays above the danger line for 2 seconds.
5. Results show score, tiers found (x/11), daily rank and a share card.

### Daily rules
- Same chain and same drop sequence for every player each day (seeded by date), so scores are fair and comparable.
- One ranked run per day; unlimited practice runs on the same chain.
- Streak counter for consecutive days played.
- New chain at 00:00 local time.

### Modes
- Today's Mystery (main): the daily ranked chain.
- Practice: replay today's chain, unranked.
- Archive: past daily chains (one-time unlock purchase).
- Create a Chain: player types a theme, AI generates an 11-tier chain, player sends it to friends as a challenge link (credit packs).

### Launch chain: World Fruits (smallest to largest; also the default practice chain)

| Tier | Fruit | Main color | Fun fact |
|---|---|---|---|
| 1 | Blueberry | Indigo #4B5BD7 | One of the few naturally blue foods |
| 2 | Lychee | Coral pink #F2687B | Its bumpy red shell peels off by hand |
| 3 | Kiwi (halved) | Lime green #8CC63F | Named after New Zealand's kiwi bird |
| 4 | Passion fruit | Violet #7A3E9D | Named after its flower by 16th-century missionaries |
| 5 | Pomegranate | Crimson #C8233A | One fruit holds hundreds of juicy seeds |
| 6 | Dragon fruit | Magenta #E4307F | It grows on a cactus |
| 7 | Mango | Golden orange #FFA726 | The national fruit of India |
| 8 | Coconut | Brown #8B5A3C | Botanically a drupe, not a nut |
| 9 | Pineapple | Gold #F5C518 | One plant takes about two years to fruit |
| 10 | Watermelon | Deep green #2E8B57 | About 92% water |
| 11 | Jackfruit | Yellow-green #C5D93A | The largest fruit that grows on trees |

Ending on jackfruit, not watermelon, keeps the chain clearly different from Suika-style games. Every fruit is drawn as a near-round, chubby shape, because the physics bodies are circles.

### Game feel goals
- Every merge should feel like a reward: squash, pop, splash, sound, haptic.
- Fast chains of merges (combos) escalate in pitch and particles.
- The first reveal of each tier is a mini celebration.
- Calm, cozy look; tension only near the danger line.

## 2. UI design (summary)

Portrait 390x844 (iPhone 15) and 412x915 (Android). Soft 3D "toy" look; warm, cozy, playful.

Design tokens: cream #FFF6E9; frosted cards #FFFFFF at 85%; primary mango gradient #FFB547 to #FF7A3D; secondary mint #3DD6A3; accent berry #E4307F; mystery purple #6C4BD8; text deep plum #2B1D3A, muted #7B6E8A; danger #FF4D5E. Dark mode: background #1C1528, cards #2A2138, text #FFF6E9. Radius: cards 28, buttons 22 (pill), chips 999. Fonts: Fredoka 600–700 for headings and numbers, Nunito for body, Baloo 2 for Hindi/Gujarati. 8pt grid, 16px side margins, minimum tap target 48px. Chunky 3D pill buttons with a 4px darker bottom edge that sinks 3px on press.

Gameplay screen: top HUD (score with count-up, best, pause), chain strip of 11 circles (found fruits, purple "?" with shimmer for unfound, glow ring on the highest tier), "Next" bubble, tall glass jar (~62% height, 86% width) with fruits inside and front glass highlights over them, danger line that fades in and pulses red near the top, current fruit hanging above the jar with a dotted aim line, bottom bar with "Shake" and "Pop" power-ups with counts, soft low-contrast background.

Discovery reveal (1.2s, non-blocking): game slows, screen dims 40% except the new fruit, a purple card flips to show the fruit, name, fun fact and tier badge "6/11", confetti in the fruit's color. Pause sheet: Resume, Restart (practice only), Sound and Music toggles, Quit. Results: "Jar full!" or "Jackfruit reached!", score count-up, "New best" ribbon, tiers found, rank, share.

Other screens (later): splash, onboarding, home, leaderboard, archive, create a chain, shop, settings, share card.

Motion: transitions 250ms ease-out; button press squash 0.95 with spring release; nothing longer than 600ms except the discovery reveal.

## 3. Merge animation and game feel

Standard merge timeline (two identical fruits touch):

| Time | What happens |
|---|---|
| 0 ms | Contact detected. Both fruits freeze physics, squash 10% toward each other. Haptic: light tap. |
| 0–90 ms | Both fruits slide to their midpoint (ease-in), scale down to 70%, faces switch to "happy". |
| 90 ms | White flash on both (additive, 60ms). Both removed. |
| 90 ms | New fruit spawns at midpoint at 40% scale, physics re-enabled with a small upward pop velocity. |
| 90–320 ms | Spring scale 40% → 118% → 95% → 100% (spring stiffness 300, damping 12). |
| 90–500 ms | Juice splash: 12–24 droplet particles in the new fruit's color, radial burst, gravity on, fade out. Plus one expanding ring (scale 0.5 → 2.0, alpha 0.8 → 0, 300ms). |
| 90–400 ms | Score popup "+56" floats up 40px from the merge point and fades. |
| 90 ms | Merge sound plays (pitch by tier). Screen shake 1–5px, scaled by tier. |
| 120 ms | Neighbouring fruits get a small outward impulse, so the pile visibly reacts. |

Combo merges: a merge within 1.2s of the previous one counts as a combo. Each combo step: merge sound pitch +1 semitone (cap at +7), particles +30%, combo label "x2", "x3"... Combo of 4+: brief golden rim light around the jar and a bonus score multiplier.

First discovery of a tier: time slows to 30% for 400ms; the screen dims 40% except the new fruit; the tier's "?" slot shakes then bursts into purple sparkles; a card flips (rotate Y, 300ms) showing art, name and fun fact for 1.2s while play continues; discovery stinger, medium haptic, confetti in the fruit's color. Tier 11 (Jackfruit): full celebration, "Jackfruit reached!" banner.

Always-on fruit animation: drop wobble and 8% vertical stretch while falling; landing squash (x 1.15, y 0.85) for 80ms then spring back; faces counter-rotate 70% of the body rotation; idle breathing 100% ↔ 102% on a 2.5s loop with random phase; blink every 2–6s; danger state within 15% of the danger line (line pulses red, tension layer, heartbeat); game over: jar shakes, fruits pop one by one from the top (40ms apart) into score, then the results sheet slides up.

Physics (Matter.js starting values; tune by feel): gravity y 1.0; restitution 0.2; friction 0.1; density scales with tier. Fruit radius by tier as a fraction of jar inner width: 0.045, 0.06, 0.075, 0.09, 0.11, 0.13, 0.155, 0.18, 0.21, 0.245, 0.29. Drop pool: only tiers 1–5 can be dropped, seeded by date.

Haptics: light for drop and normal merge; medium for combo x3+ and discovery; heavy for tier 10–11 and game over.

## 4–8. Assets, store, audio, chain generator, export specs

- Art: one master style, 11 fruits × 4 faces (neutral, blink, happy, scared), mystery "?" badge, jar back/front layers, base, danger strip, backgrounds (home, gameplay, night), white particles (droplet, splash, sparkle, glow, confetti, ring), coin, gold star, UI icons and elements.
- Audio: one key (C major pentatonic, 100 BPM). Merge sample pitched by tier along C D E G A (tier 1 highest); combo +1 semitone per step (max +7); tiers 9–11 add a low boom; merges 3–6 dB louder than music, music ducked 4 dB for 300ms on each merge. SFX list: drop, land small/big, merge, combo, discovery, danger heartbeat, game over, button tap, count-up tick, coin, share, shake, pop.
- Daily chain generator: an LLM returns 11 tiers as JSON (name, color, detail, fun fact, sprite prompt), validated and human-reviewed, with a 14-day buffer of approved chains.
- File names: t01_blueberry_neutral.png, t01_blueberry_blink.png, …; one texture atlas for sprites; keep 2x sources.
