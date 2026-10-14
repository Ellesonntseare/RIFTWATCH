# Additional playable hero slot

The supplied model `models/figure_360.glb` is integrated as KAI.
Configuration is in `public/extra-hero.json`, with enabled set to true.
The saved id remains `serame-civilian` for compatibility; the visible name is KAI.
The carousel and multiplayer server recognize the configured additional hero.

His supplied face, hair and clothing are retained. The attempted facial replacements were reverted. Additional head/body/leg/finger/grip cosmetic polish is deferred at the user's request.

For a future replacement, update the model filename and configuration, inspect its rig/native clips, adapt hero-motion.js if necessary, and restart the server. Do not enable a missing file.
