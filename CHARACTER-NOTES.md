# Serame character notes

The active skin uses the first generated face image preferred by the user: `public/assets/hero-face.png`. The later UV-atlas experiment at `public/assets/serame-head-atlas.png` is retained as a source asset but is not used by the game.

The head is adapted from the supplied Winter Soldier head geometry, attached to the supplied MAIN HERO skeleton. Its neck is continuous, the lower neck tapers into the collar, and the entire assembly is lowered 3 cm from the earlier preview. The face uses landmark alignment and blends to skin at the temples and beneath the jaw. Dense short curls follow the scalp surface. Bounds are recalculated after reshaping to prevent the head being culled out of the preview.

Serame's black tactical body, name, character selection, and gameplay stats are retained. The four new references guide jaw taper, hair silhouette, head-to-body proportions, and neck placement. This is an adapted game character, not a scanned likeness.

## Image generation

Built-in image generation was used. Workspace asset: `public/assets/serame-head-atlas.png` (superseded by the user's preference for the original portrait).

Prompt:

Use case: identity-preserve / game texture edit. Image 1 is an existing 2048x2048 UV diffuse texture atlas for an anatomically modelled male head. EDIT IMAGE 1 only. Images 2, 3 and 4 show the target man Serame from several angles. Replace the skin, facial features and hair of image 1 with Serame's identity: medium warm brown skin, short dense natural curls, his defined but gently tapered jaw, narrow mustache and small chin goatee. Crucial: preserve EXACTLY the unusual UV layout of image 1: face is upside down in the central region; mouth centered around x=1024,y=650; nose around x=1024,y=890; eye openings centered near x=720 and1320,y=1050; ears around x=400 and1640,y=930; forehead below eye row and scalp occupies lower half. Preserve feature positions, scale, UV island outlines, inverted orientation and the stretching of neck skin at top. The eyes on this atlas remain small dark eye socket openings because separate eyeball meshes render eyes. Make the atlas a realistic evenly lit ALBEDO texture, no painted directional shadows, no stylized polygons, no highlights, no background checkerboard. All exposed scalp and neck areas have the same warm brown skin color as the face; small short black curls near the forehead/hairline. DO NOT output a portrait, scene or normal upright face. Output ONLY the complete square UV texture in the exact layout of image 1, no labels, no watermark. Retain Serame's facial resemblance from references.
