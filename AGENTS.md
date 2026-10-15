# RIFTWATCH handoff for the next coding agent

## Current request

Improve **frame rate and smoothness while a match is running**, especially in the Android APK, without making the models noticeably blurrier. Also check PC play. This is the next task; the current change only records the handoff.

## Preserve working behavior

- Keep character selection, map deployment, campaign, Island Hunt, 1v1 rooms, touch controls, and the customizable mobile HUD working.
- Keep the phone menus and post-match controls usable at portrait and landscape sizes. The touch HUD is for phones, not desktop.
- Do not delete maps, models, effects, or gameplay systems as a shortcut to improve FPS. Prefer measured, reversible changes.
- Work in this repository and review the current code before changing settings. Run `npm test` after code changes and test an actual match, including the Android APK if available.
- Make one small optimization at a time. After it passes tests and an in-match check, create a separate Git commit for that working change before starting the next one. If FPS, visuals, or gameplay get worse, revert the specific commit instead of layering on more changes.

## Where frame rate is controlled now

- `public/js/main.js`: renderer creation and initial pixel ratio near lines 43-44; graphics modes, adaptive pixel ratio, and frame loop near `setGraphics()` and `frame()` around lines 1229-1256. Mobile currently skips frames sooner than desktop, uses no renderer antialiasing, and Performance mode may lower pixel ratio to 0.75.
- `public/js/hero-preview.js`: character-selection preview has its own renderer and pixel-ratio cap. This affects the menu preview, not match FPS.
- `public/js/monsters.js`: `setMonsterDetail()` switches distant monsters to simpler models. `public/js/main.js` also throttles distant animation, effects, radar, and other mobile work.
- `public/js/maps.js`, `public/js/scenery.js`, and `public/js/terrain.js`: map/model preparation and scenery. Keep loading performance separate from steady in-match frame rate.
- `app/src/main/java/za/co/teamtrader/riftwatch/MainActivity.java`: Android WebView configuration.

## Suggested approach

1. Measure steady frame times on a representative phone/APK and PC in a busy match, after loading finishes. Separate CPU update time, GPU render time, and pauses from asset loading; record baseline FPS and device details.
2. Identify the expensive work before changing visual quality. Look for per-frame allocations, full-scene traversals, monster animation/update frequency, particles/decals, draw calls, shadows, and large-map visibility. Optimize the measured bottleneck first.
3. Keep Performance and Quality modes meaningful. If adaptive resolution causes blur, tune it with FPS evidence and avoid rapid quality oscillation. Raising pixel ratio alone may make frame rate worse.
4. Verify gameplay and visuals on mobile and desktop. Run `npm test`, check character selection, match controls, 1v1, and the APK build. Report measured before/after FPS and any visual tradeoff.

Do not claim an FPS improvement from code inspection or passing unit tests alone; verify it during play.
