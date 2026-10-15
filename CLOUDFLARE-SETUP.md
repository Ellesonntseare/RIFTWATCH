# Play with friends through your Cloudflare subdomain

## Run the game server

Install Node.js 20 or newer if needed. Extract the entire RIFTWATCH folder.
Run START-GAME.cmd, or run `npm start` from that folder.
The server listens on http://127.0.0.1:3000. Keep its window open.

## Connect your existing Cloudflare Tunnel

In your Cloudflare Tunnel's published application/public hostname settings:
- Hostname: your chosen game subdomain (for example, play.your-domain.com).
- Service type: HTTP.
- Service URL: 127.0.0.1:3000.
- Route the whole hostname; do not restrict the path to only `/`.

Run cloudflared on the same PC as the game server. Cloudflare supplies the public HTTPS URL; the local game remains HTTP. The game uses WSS automatically on HTTPS for `/multiplayer`, on the same hostname. Preserve the WebSocket upgrade and the original public Host header. If you intentionally override the origin Host header, set RIFTWATCH_ORIGIN to the full public HTTPS origin before starting Node.

The subdomain and tunnel were not configured by this project; you said you will connect them yourself.

Official routing guide: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/

## Start a room

1. Everyone opens the same HTTPS game URL and chooses their own hero.
2. One player chooses a 4–16 letter or number code, clicks CREATE ROOM, and shares that code.
3. Friends enter that code and click JOIN ROOM.
4. The room host selects a map. All players load that map.
5. Up to four people can share a room. The room host's browser simulates the enemies, missions and shared pickups. Keep that browser open and active; pausing the host pauses the shared world. If the host leaves, the room closes. There is no host migration or persistent saved room.

For 1v1, create a room with exactly two players, select 1V1 DUEL, then choose a map. The server checks shots, owns player health and records kills. First to five kills wins. The 1v1 rules are for casual matches, not ranked competitive play.

The Node process relays room messages and validates basic 1v1 damage. It is not a standalone headless simulation server or a hardened anti-cheat service.

## Voice

Click ENABLE VOICE after joining a room, then allow microphone access. MUTE MIC silences your microphone; LEAVE VOICE stops microphone tracks. Speech is sent to room participants through WebRTC and is not recorded by the game. Headphones avoid feedback. Music defaults to 9% and is lowered further while speech is detected.

HTTPS (or localhost for testing) is needed for browser microphone access. The Cloudflare Tunnel carries game traffic and voice signaling. Voice audio uses WebRTC, with a default Cloudflare STUN server; restrictive networks may need TURN relay credentials.

Optional Cloudflare Realtime TURN relay support:
- Create a TURN key in your own Cloudflare Realtime account.
- Set CF_TURN_KEY_ID and CF_TURN_API_TOKEN in the server's environment before starting Node.
- Keep the API token on the server. Never place it in public/ or share it with players.
- The game server obtains temporary ICE credentials for clients. No TURN account or paid relay was created for you.

Official TURN credential guide: https://developers.cloudflare.com/realtime/turn/generate-credentials/

## Check your public setup

Open the HTTPS URL on a second device using another Internet connection. Join a room, choose different heroes, start a map, move/shoot, and collect a medkit or gun. Enable voice on both devices, speak, mute, and leave voice. This external-domain and two-person microphone check remains for your actual tunnel setup.
