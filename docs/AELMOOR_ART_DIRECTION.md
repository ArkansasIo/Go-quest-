# Aelmoor art direction

## Visual north star

Build an original high-fantasy adventure look with the tactile clarity of 16-bit pixel art and the scale, expressive silhouettes, and luminous environments of a modern party-based MMO. The mood moves from the warm refuge of a single lantern to the cold, starless reach of Duskmoor. Use genre-level inspiration only: no copied franchise characters, symbols, maps, UI, or audio.

## Story motifs and palette

- **The last lantern:** warm antique gold and ember orange; the player-facing focal light and the sign of hope.
- **The Ember Codex:** a dark teal-black book with eight school sigils, gold filigree, and page-edge fire; a recurring campaign emblem.
- **The Dusk King:** a distant, shadowless crowned figure in charcoal and muted violet; ominous and readable without gore.
- **Aelmoor:** forest teal, moss, slate blue, midnight indigo, and restrained gold highlights; biomes can introduce local accent colors without losing the shared world identity.

Prefer clean silhouettes, readable values at handheld scale, richly layered fantasy environments, and ornamental detail reserved for close focal points. Interface surfaces should be dark, quiet, and high contrast, with a persistent left-side navigation rail on wide layouts and a compact top navigation on narrow screens.

## First asset set

| Asset | Narrative role | Runtime use |
|---|---|---|
| `public/res/aelmoor/title_bg.png` | The lantern-bearer looks across Elderwood toward the citadel during the long night. | Full-screen title background. |
| `public/res/aelmoor/hero.png` | The newly chosen bearer of the lantern. | Foreground title-screen adventurer. |
| `public/res/aelmoor/codex.png` | The eight schools bound in the Ember Codex. | Title-screen campaign emblem. |
| `public/res/aelmoor/dusk_king.png` | The shadowless ruler at the heart of the prologue. | Foreground title-screen antagonist. |

Keep the artwork separate from gameplay rules and world data. Future player, NPC, enemy, tile, and item assets should follow the same palette logic and be mapped to their actual story roles before replacing runtime sprites.
