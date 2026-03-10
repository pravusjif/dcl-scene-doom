# DOOM in Decentraland

A DOOM-style first-person shooter rendered entirely through Decentraland SDK7's UI system. No 3D entities, no external assets — just pure TypeScript raycasting drawn as colored UI columns inside a single 1x1 parcel.

## How It Works

The game uses DDA raycasting (the same algorithm behind Wolfenstein 3D) to project a 24x24 tile map into an 80-column pseudo-3D viewport. Each column is an absolutely-positioned `UiEntity` with its height and color determined by ray-wall intersection distance. Enemy sprites are depth-tested per-column against wall distances and rendered as vertical strips layered between the ceiling and walls via z-index ordering.

The entire rendering pipeline — walls, sprites, ceiling, floor, minimap, HUD, and overlays — runs through `ReactEcsRenderer` with ~360 UI elements updated every frame.

## Features

- **Raycasting engine** — 80-column DDA raycaster with distance fog and side-darkened walls
- **Three enemy types** — Imps (ranged), Demons (melee), and Sergeants (long-range) with idle/chase/attack AI and line-of-sight checks
- **Hitscan weapons** — Click to shoot with per-column sprite hit detection
- **Doors** — Interactive doors with open/close state machine, triggered with the F key
- **Minimap** — 11x11 real-time minimap showing walls, player direction, and enemy positions
- **HUD** — Health, ammo, kill counter
- **Death and respawn** — Full game reset on death with map/enemy/door restoration
- **Toggle mode** — Press 4 to switch between DOOM mode and normal DCL exploration

## Controls

| Action | Key |
|--------|-----|
| Move | W / A / S / D |
| Look | Mouse |
| Shoot | Left Click |
| Use Door | F |
| Toggle Game | 4 |

## Getting Started

### Prerequisites

- Node.js >= 16
- Decentraland SDK7 (`@dcl/sdk`)

### Run Locally

```bash
npm install
npm start
```

## Technical Details

- **Viewport:** 1920x960 pixels, 80 ray columns at 24px each
- **Map:** 24x24 grid, row-major indexing (`WORLD_MAP[y][x]`)
- **Depth sorting:** Per-column strip system — sprites are split into vertical strips and individually depth-tested against wall distances
- **Performance:** Pre-allocated pools (160 sprite strips, 16 enemy sprite slots) mutated in-place to minimize GC pressure
- **Zero 3D entities:** Everything is UI — the DCL avatar is locked and hidden during gameplay

## License

MIT
