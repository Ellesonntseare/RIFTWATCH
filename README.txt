RIFTWATCH — browser co-op shooter

START
Extract the whole folder. Install Node.js 20+ if needed, then double-click START-GAME.cmd.
Open http://localhost:3000. Keep the server window running.
Dependencies and browser libraries are bundled. If node_modules is missing, run npm ci.

ANDROID APK
Open GitHub Actions > Build Android APK > latest successful run > Artifacts, then download RIFTWATCH-Android-APK. Unzip it and install app-debug.apk on an Android phone (Android 8 or newer). This is a debug-signed APK for direct installation, not a Play Store release.
The app opens https://rift.teamtrader.co.za/ and uses the game's touch controls. Operator selection and callsign editing are integrated into the main menu. It rotates when the phone rotates and auto-rotate is enabled; no landscape button is needed. Optimized character, combat and map models are bundled in the APK to avoid downloading them through the tunnel. The game server and Cloudflare tunnel must still be running and reachable for the app to play. A successful APK build does not prove remote gameplay works.

PLAY
Choose a hero with left/right arrows before deploying. Each hero has its own health, speed and reload stats.
Select one of five maps. Recover the relay data, clear the hostiles, return to the relay, and hold E to extract.
Campaign has ten sectors; Endless keeps deploying. Refit at the upgrade shop between sectors.
1V1 DUEL uses a private two-player room. Create a room, invite one friend with the code, select 1V1 DUEL, then choose a map. Find your rival; first to five eliminations wins. Players respawn after four seconds. Enemy waves and relay missions are disabled in this mode.

CONTROLS
WASD or arrow keys: move. Mouse: look. Shift: sprint. Space: jump.
Left mouse: fire. Hold right mouse or press C: aim. R: reload.
Scope View in the deployment settings switches the dark circular scope surround on or off.
Performance is the default on PC and phone: it reduces distant animation, lights and effect particles. Quality restores the fuller PC lighting and effects and raises render resolution; on phones it raises resolution while keeping shadows off.
1 / 2 / Q / mouse wheel: switch weapon. X: melee attack. G: throw C4. F: detonate.
E: interact, hold for relay recovery/extraction, pick up a ground gun.
V: shoulder / wide / first-person POV. Esc: pause. M: mute game audio.
Menus use original soft sci-fi clicks and a distinct deployment confirmation; M also mutes these sounds during gameplay.
Click RESUME / CAPTURE MOUSE after loading. Continuous turning requires browser pointer lock.
Esc releases the mouse and pauses. If capture is blocked, open the game in Chrome or Edge.
On a phone, use the left joystick to move and drag the right side to look. Hold FIRE, AIM, JUMP or RUN; tap HIT for a close-range melee attack. Hold the HOLD E button to recover data or extract; tap it to pick up a gun or open a cache. Use RELOAD, SWAP, C4 and VIEW as needed. Tap C4 again after it arms to detonate. The HUD rearranges when the phone rotates; no landscape button is needed.

SUPPLIES
Green-cross medkits restore 55 health. Walk over medkits, ammo and power-ups.
Ground M4A1/Laser MG pickups require E; they equip that weapon and give ammunition.
Mystery caches require E. Shields, speed and damage boosts last 20 seconds.
Relaxed difficulty adds regeneration, a deployment shield and gentler damage; Standard is selectable.

FRIENDS
Create a room, share its six-character code, and let friends join before the host selects a map.
Up to four players can choose different heroes. Shared enemies, missions and pickups are host-controlled.
ENABLE VOICE is optional. Microphone access is requested only when clicked. MUTE MIC and LEAVE VOICE are available.
See CLOUDFLARE-SETUP.md for your domain/tunnel and optional TURN relay setup.

MUSIC
Dark Alleys, Dark Times by Section 31, CC0. See MUSIC-CREDITS.md.
Default 9%; the Music slider adjusts 0–30%. Speech reduces music further.

CURRENT LIMITATIONS
The host browser must remain open and active. Host departure closes the room.
The existing Cloudflare tunnel serves the game, but full remote gameplay and a real two-person microphone call remain unverified. No TURN account was configured by this project.
The four remaining operators' limb/grip visual polish is deferred at your request.
Large imported maps can still take time to decode and require a capable GPU. The loading panel shows download progress and preparation stages.
Phone Performance starts at one rendered pixel per CSS pixel and only lowers resolution during sustained slow frames; it can recover resolution when performance improves.

DEVELOPMENT
npm test
Source: public/js/. Server: server.js and multiplayer-server.cjs.
Progress and deferred work: PROGRESS.md. Character assets: CHARACTER-NOTES.md.

MOVEMENT ANIMATIONS
Choose an operator and play normally; the existing game models use the movement pack automatically.
In third-person, jumping, walking, running, moving sideways, rifle fire, C4 throws, and five cycling melee moves trigger matching animations. The normal soldier jump and rifle poses replace exaggerated showcase moves; walking and running keep the lower body moving during rifle fire and throws.
Melee hits one nearby target after a short windup. The pack's swimming and showcase moves are not used in combat.
To rebuild or expand the pack from compatible FBX files, use Blender with
scripts/import-movement-pack.py; run it with -- OUTPUT.glb FIRST_SKIN.fbx OTHER_MOVE.fbx ...

Locomotion update (2026-10-17): Shift (either key) or the mobile Run control plus forward movement selects the run animation. Sprint state is relayed to peers. Winter Soldier uses forward-plane thigh/knee/ankle cycles; Fire Demon and Minotaur receive a lightweight lower-body skeleton while loading, preserving their existing meshes. Distant enemy silhouettes also step. Biped regressions check both feet travel and both knees bend on the actual delivery models. No animation selection menu was added.

COMBAT UPDATE (2026-10-17)
1 / 2 selects a gun; 3 selects fists; X punches. Phone users can tap the weapon slots.
Hold Shift to run; Caps Lock toggles run lock. Phone Run and Run Lock are separate controls.
B / phone ICE deploys a rising frost barrier in solo/co-op: 18-second lifetime, 25-second cooldown. Requires clear level ground. Not enabled in 1v1.
Pause settings: optional after-kill aim assist (solo/co-op, visible enemies within a small forward cone; manual looking cancels it).
Recoil stabilizer pickups last 20 seconds. Reloads: rifle 1.3s, laser 1.6s before upgrades/operator modifiers.
Directional hit arcs show the incoming attack side. Enemy corpses persist until the map resets.
Native Android orientation now uses sensorLandscape. Build and install a new APK for this native change; physical-phone performance/build was not verified locally.
