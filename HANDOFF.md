# RIFTWATCH handoff — 13 October 2026

The user removed the fifth operator and requested that its dedicated code and asset be removed. Four operators remain. Visual leg/finger/grip polish for the remaining operators is deferred.

## Current implementation

Local Node static + WebSocket server, localhost port 3000. START-GAME.cmd launches it. Browser assets and model GLBs are local; dependencies are bundled.

- public/js/main.js: gameplay, weapons/camera, maps, survival balance, host/guest simulation.
- public/js/operations.js: mission recovery/defense/extraction; medkits, ammo, caches, temporary buffs, E-to-equip ground guns; shared pickups.
- public/js/roster.js: four operators. Old saved selections for removed operators fall back to the first entry.
- public/js/hero.js: model normalization, personal face only for Serame, weapons, motion.
- public/js/hero-motion.js: walking/running retarget from supplied soldier, bone orientation offsets, fade to standing pose.
- public/js/foot-grounding.js: sampled sole/toe/heel vertices keep models at ground elevation.
- public/js/arm-ik.js and hero-weapon.js: two-bone arm placement against gun grip/handguard points, muzzle flash and world muzzle location. Visual polish is deferred.
- public/js/network.js + multiplayer-server.cjs: room codes, four players, hero selection, position/speed/pitch/weapon messages, host world snapshots, combat and pickup requests, disconnect handling.
- public/js/voice.js: opt-in WebRTC room audio, mute/leave, speaking indicators, temporary TURN configuration if server credentials are set. No audio recording.
- public/js/audio.js: synthesized effects and quiet CC0 soundtrack. Music defaults 9% and ducks during speech.

## Controls and host setup

See README.txt and CLOUDFLARE-SETUP.md. The user owns a domain and will set up their Cloudflare tunnel/subdomain. No external domain, tunnel, paid TURN account or credentials have been configured here. The room host browser controls the simulation; there is no headless authority/host migration.

## Verification

Automated tests cover missions, supplies, ground gun interaction/shared grants, survival balance, WebSocket rooms and voice signaling, and CPU animation/grounding checks. Visual character polish is intentionally deferred and must not be inferred from those tests. A real two-person microphone call and deployment over the user's tunnel remain unverified.

## Source preservation

The active uploaded GLBs in models/ are retained. Serame's active portrait is public/assets/hero-face.png. See CHARACTER-NOTES.md and MUSIC-CREDITS.md.

Older one-off rebuild scripts at the repository root are historical tools and must not be rerun automatically; they can overwrite newer fixes. They are excluded from the release package.

## Next session, at the user's request

Do not start these in the current asset/map work: add solo or up-to-four-player missions for hostage rescue, bomb defusal, base defense, assassination, convoy escort, stealth infiltration, search and rescue, sabotage, supply recovery, survival, territory capture, and final assault. Completion should grant rewards; optional side missions may appear during open-world exploration.
