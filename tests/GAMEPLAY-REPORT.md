# Gameplay and multiplayer test report

Date: 14 October 2026

## Result
23 automated tests passed with `npm test`.

## Browser checks
- Selected GHOST and deployed from hero selection into the game lobby.
- Created a room and joined with a second browser client on the same computer.
- Launched Warehouse Yard: both clients displayed the same room, two players, seven hostiles and the recovery objective. Both avatars rendered.
- Movement changed the relay distance. Weapon switching selected Laser MG; V changed the camera to wide view.
- Firing reduced ammunition from 60 to 52. Incoming damage reduced health. Co-op death automatically respawned the player with the BACK IN THE FIGHT banner and deployment shield.
- Escape opened the pause overlay.
- After fixes, an invalid room code preserved the host's room and both members.
- After the host left, guest map buttons became enabled and the guest successfully deployed solo into Crypt.
- Solo damage and the YOU DIED screen were observed.
- No warning/error console messages were returned for either tested browser client.

## Fixes
- Validate destination rooms before leaving the current room. Invalid/full joins no longer remove a player or close their hosted room.
- Treat joining the current room as a harmless no-op.
- Clear old player positions on a fresh room join.
- Restore map availability after room closure/disconnection, while preserving asset/map loading restrictions.

## Automated coverage
Existing gameplay tests cover objective/extraction rules, pickups, health protections, hero/enemy animation and multiplayer synchronization. Added regression coverage checks full rooms, failed host joins, same-room joins, leaving/rejoining, stale positions and client map-button recovery.

## Limits
This was a local smoke test, not a complete ten-sector playthrough or exhaustive test of every map. Reload completion and C4 behavior were not conclusively verified. Four-player capacity was tested through WebSocket clients; browser gameplay used two clients. Different-device internet/LAN connectivity, latency/loss and live microphone audio remain unverified. The server currently listens on 127.0.0.1; remote players require a configured tunnel or an explicitly configured network binding. The host browser must remain active.

## Character selection and performance follow-up
- Fixed the selector locking arrows and Deploy behind the complete 3D preview. UI initializes independently of WebGL; preview failures leave deployment available, and stale previews cannot replace the latest choice.
- Extracted unchanged head/eye positions, normals and indices into models/serame-head.glb: 672,856 bytes instead of the 28,571,560-byte full donor. Rebuild with python scripts/extract-head.py. Visually checked SERAME's head in the browser.
- Preview uses native-resolution rendering, no shadows, a 30 FPS cap, and pauses rendering in hidden tabs. Extra weapon assets are omitted from the preview; walking animations load when requested. Reduced decorative hair instances from 6,500 to 1,400.
- Gameplay defaults to Performance graphics (no shadow passes, pixel ratio capped at 1), with adaptive resolution down to 0.65 during sustained slow frames. Quality remains selectable. Static enemy meshes can be culled off-screen; skinned meshes retain conservative visibility.
- Added HTTP ETags and cache revalidation: confirmed an unchanged model request returns 304 instead of retransmitting the file.
- Confirmed the public website serves the updated selector. Local browser checks confirmed enabled selection controls, SERAME preview, deployment and Warehouse Yard gameplay with no console errors.
- Automated suite: 25 passing tests, including pending/failed previews and stale async completion.
- No measured FPS improvement or zero-lag guarantee is claimed. Large body/enemy/map assets remain; full asset compression and mesh simplification are not part of this pass.

## Cloudflare and continuous mouse-look follow-up
- At the start of investigation, localhost:3000 refused connections; Cloudflare returned 502 for hero.html and model files, while a JavaScript URL returned a stale cached copy. Restarted Node as a hidden background process. Subsequent public source checks matched the current local files; this does not prove older browser caches had the same files.
- Measured original MAIN HERO.glb delivery: 584,716 of 31,518,380 bytes in 60 seconds before timeout. The model download bottleneck was reproduced independently of the UI.
- Added a release identifier to HTML module entries and import-map entries for local JavaScript modules so an old cached script cannot mix with this release.
- Prepared delivery copies in models/web/; original models are preserved. Textures are capped at 512 pixels, opaque textures use JPEG quality 85, transparency uses PNG. This trades texture detail for lower download and GPU-memory cost.
- Applied glTF Transform 4.5.1 weld to MAIN HERO and the two large static demon models. Applied simplify ratio 0.15, error 0.001 to the two static demons only. Character skeletons and animation remain intact. Regenerated gzip files after processing.
- Server serves prepared GLBs when present, negotiates gzip, retains ETag revalidation and Vary: Accept-Encoding. Locally verified both identity and gzip responses against the delivery file bytes.
- MAIN HERO transfer is now 5,960,284 bytes; Fire Demon 4,538,214; Minotaur 5,160,479. The compressed public test transferred 5,448,313 bytes in 60 seconds; throughput varies and no instant-load guarantee is made.
- Removed the mouse fallback that incorrectly set locked=true without pointer capture. After loading, gameplay waits for a deliberate Resume click; capture failure stays paused with instructions; later clicks retry real pointer lock. Esc releases capture and pauses.
- All 28 tests passed, including tests against optimized delivery-model geometry/animations using RIFTWATCH_WEB_MODELS=1. The embedded browser blocks pointer capture; confirmed it remains paused rather than entering the faulty edge-limited mode. Physical continuous turning in Chrome still requires verification.
