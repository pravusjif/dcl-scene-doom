# Decentraland Game Design Patterns

## Continuous World Design Rules

These are non-negotiable constraints of the Decentraland platform. Every design must account for them.

1. **Always-live scene**: There is no loading screen, no start button. The scene runs the moment a player's avatar enters the parcel. Design the default state to be visually interesting and functionally coherent.

2. **Drop-in / drop-out**: Players arrive and leave without warning. Never require a fixed player count to start. Never assume a player will stay for a set duration. Save progress incrementally — not at the end.

3. **No ejection**: You cannot remove a player from a scene. You can teleport them with consent (they must accept a prompt). Design around griefing with mechanics (invulnerability zones, cooldowns, ignore lists) rather than moderation tools.

4. **Visible boundaries**: Your scene is visible from neighboring parcels. The "idle state" of your scene is your storefront. Make it attractive even when no game is active.

5. **Shared presence**: Other players are always potentially visible and present. A "single-player" experience in DCL is really a "solo experience in a public space." Decide whether other players are spectators, collaborators, or competitors — but never pretend they do not exist.

6. **Persistent world**: The scene resets when the last player leaves (or on redeploy). There is no built-in persistence. If you need saved state, use an external server or blockchain storage.

## Game Loop Archetypes

### Exploration
- **Core loop**: Discover locations, find hidden items, unlock areas.
- **DCL fit**: Excellent. The 3D world and spatial navigation are strengths.
- **Design tips**: Use landmarks for wayfinding. Reward curiosity with hidden content. Use lighting and sound to guide attention.

### Collection
- **Core loop**: Gather items, complete sets, earn rewards.
- **DCL fit**: Strong. Combines well with exploration and daily engagement.
- **Design tips**: Use entity pooling for collectibles. Scatter items spatially. Tie collections to visual progress (display cases, counters).

### Puzzle
- **Core loop**: Solve spatial or logic challenges to progress.
- **DCL fit**: Good. Spatial puzzles (move objects, find paths, activate sequences) work well.
- **Design tips**: Provide clear feedback on progress. Avoid puzzles that require typing (input is limited). Use 3D interactions (click, proximity triggers) as puzzle inputs.

### Social
- **Core loop**: Interact with other players, attend events, roleplay.
- **DCL fit**: Excellent. This is the platform's native strength.
- **Design tips**: Create gathering spaces (seating, stages, open areas). Provide conversation starters (interactive objects, games). Design for groups of 5-20.

### Competitive
- **Core loop**: Race, fight, or outscore other players.
- **DCL fit**: Moderate. Latency and input limitations constrain fast-paced action.
- **Design tips**: Prefer turn-based or timing-based competition over twitch reflexes. Use server-authoritative state to prevent cheating. Keep rounds short (2-5 minutes).

## Engagement Patterns

### Daily Rewards
- Offer small rewards for daily visits (collectibles, progress points).
- Track visits via external server (DCL has no built-in daily tracking).
- Display streak counters in-scene to motivate return visits.

### Progression Systems
- Levels, ranks, or unlockable content tied to cumulative play.
- Store progress on a server or use NFT-based progression.
- Show progression visually (leaderboards, badges, evolving scene elements).

### Achievements
- Define clear milestones (first win, 100 collectibles, visited all rooms).
- Announce achievements with sound and visual effects.
- Display achievement history in-scene (trophy room, wall of fame).

## Spatial Design

### Landmarks
- Place a tall, visible landmark at the center or entrance of your scene. Players use it to orient themselves.
- Every distinct area should have a unique visual identity (color, shape, lighting).

### Pathfinding
- Guide players with visible paths (floor patterns, lighting, railings).
- Avoid dead ends that require backtracking — use loops.
- Place interactive elements along paths to maintain engagement during traversal.

### Sightlines
- Use open sightlines to draw players toward objectives.
- Block sightlines strategically to create mystery and discovery.
- Ensure the scene looks inviting from the parcel boundary (this is your "shop window").

### Parcel Transitions
- If your scene spans multiple parcels, ensure smooth visual transitions.
- Do not place critical interactive elements right at parcel boundaries (loading edge cases).
- Use open space at parcel edges as buffer zones.

## Monetization Approaches

### In-Scene Purchases
- Sell virtual items or abilities via MANA transactions.
- Use the `signedFetch` flow for secure server-verified purchases.
- Always provide free gameplay alongside paid upgrades — pay-to-win drives players away.

### Wearable Sales
- Create and sell wearables that complement your scene's theme.
- Display wearables on mannequins in-scene as advertisements.
- Offer wearables as prizes for game achievements.

### Entry Fees
- Charge MANA to enter a premium area or participate in a competition.
- Always have a free area that showcases what the paid area offers.
- Use token-gating (require ownership of a specific NFT) as an alternative to direct payment.

## Social Mechanics

### Cooperative Tasks
- Design objectives that require multiple players (two switches that must be pressed simultaneously, items too heavy for one player).
- Reward cooperation with shared benefits.
- Scale difficulty or rewards with player count.

### Shared Spaces
- Create common areas where players naturally congregate (lobbies, plazas, markets).
- Add ambient interactive objects that encourage casual interaction (musical instruments, ball toss, dance floors).

### Events
- Design scenes that can host scheduled events (concerts, launches, competitions).
- Include a "stage" area with good sightlines for audiences.
- Provide event host controls (start/stop game, reset scene, broadcast messages).

## Tutorial and Onboarding Patterns

### In-World Signs
- Place `TextShape` entities with short instructions at key locations.
- Use arrows, glowing outlines, or animated indicators to point to interactive objects.
- Keep text under 10 words per sign.

### NPC Guides
- Use an animated NPC at the scene entrance to greet and instruct.
- Deliver instructions through a dialog system (one message at a time, player advances).
- NPC dialog should be skippable for returning players.

### Progressive Complexity
- Introduce one mechanic at a time. The first interaction should be obvious (a big, glowing button).
- After the player succeeds at the simple task, introduce the next layer.
- Gate advanced mechanics behind early accomplishments (unlock new areas after completing the tutorial).

### Zero-Explanation Test
- If a new player cannot figure out the first action within 30 seconds without any text or instructions, the design needs work.
- Watch real players attempt your scene cold. Their confusion is your design feedback.

## MVP Checklist

Before expanding scope, verify these fundamentals:

- [ ] **Core loop defined**: One sentence describing what the player does.
- [ ] **First action obvious**: A new player knows what to do within 30 seconds.
- [ ] **Feedback present**: Every interaction produces visible and/or audible feedback.
- [ ] **Win/progress condition clear**: The player understands when they are succeeding.
- [ ] **Lose/fail condition fair**: If there is failure, the player understands why and can retry quickly.
- [ ] **Replay value exists**: There is a reason to play again (score improvement, new content, social competition).
- [ ] **Multiplayer compatible**: Works correctly with 1 player and with 5+ simultaneous players.
- [ ] **Within scene limits**: Triangle count, entity count, texture count, and file size all within budget for the target parcel count.
- [ ] **Performance acceptable**: Maintains 30+ FPS during gameplay with target entity/triangle counts.
- [ ] **Mobile compatible**: Core interactions work without a keyboard (pointer-only inputs available).
