/**
 * Procedural 8-bit art: monster sprites and gear icons, generated in code (no image files).
 *
 * Monsters: every family has a hand-made half-silhouette (mirrored for symmetry). Each
 * monster adds its own seeded variation, element palette, outline, shading and eyes, so all
 * 420 look distinct while reading clearly as their family.
 *
 * Gear: weapons, armor and shields have 16x16 icon templates recoloured by gear tier.
 */
import { Element, MonsterDef } from './monsters';
import { seededRng } from './rng';

/** Monster sprite size in art pixels (before game scaling). */
export const MONSTER_SIZE = 32;
export const ICON_SIZE = 16;

interface Palette {
    dark: string;
    base: string;
    light: string;
    eye: string;
}

export const ELEMENT_PALETTES: Record<Element, Palette> = {
    fire: { dark: '#781800', base: '#d83800', light: '#fca044', eye: '#fcfc54' },
    ice: { dark: '#24508c', base: '#3cbcfc', light: '#c4f0fc', eye: '#ffffff' },
    storm: { dark: '#3c3c78', base: '#7c7cfc', light: '#fcfc78', eye: '#fcfcfc' },
    poison: { dark: '#005800', base: '#38b838', light: '#b8f818', eye: '#f8f800' },
    shadow: { dark: '#200838', base: '#58189c', light: '#a878e8', eye: '#fc2828' },
    holy: { dark: '#886800', base: '#e8b800', light: '#fcf0a8', eye: '#ffffff' },
    earth: { dark: '#4c2c08', base: '#8c5c24', light: '#d0a060', eye: '#fcd838' },
    water: { dark: '#00287c', base: '#1868d8', light: '#6cc8fc', eye: '#fcfcfc' },
    arcane: { dark: '#68004c', base: '#d0209c', light: '#fc8ce4', eye: '#5cfcfc' },
};

const OUTLINE = '#080810';

/**
 * Half-silhouettes, 8 columns x 16 rows, mirrored to 16 x 16 and doubled to 32 x 32.
 * '#' body, 'e' eye, '+' optional (varies per monster), '.' empty.
 */
const SILHOUETTES: Record<string, string[]> = {
    slime: [
        '........', '........', '........', '........', '.......+', '......##', '.....###', '....####',
        '...#e###', '..######', '..######', '.#######', '.#######', '.#######', '..######', '........',
    ],
    beast: [
        '..#.....', '..##....', '..###...', '...#####', '...#####', '...e####', '....####', '.....###',
        '..++####', '.#######', '.#######', '.##..###', '.##..##.', '.##..##.', '.##.....', '........',
    ],
    bird: [
        '........', '......##', '.....###', '.....e##', '......##', '#.....##', '##...###', '###.####',
        '.#######', '..######', '...#####', '....####', '.....##.', '.....#..', '....##..', '........',
    ],
    insect: [
        '........', '+.......', '#.......', '##....##', '.#...###', '..#..e##', '...#####', '..######',
        '.#######', '#..#####', '...#####', '..######', '.#..####', '#...#..#', '...#...#', '........',
    ],
    serpent: [
        '........', '.....###', '....####', '....e###', '.....###', '......##', '......##', '.....###',
        '....###.', '...###..', '..###...', '..##....', '..###...', '...#####', '....####', '........',
    ],
    plant: [
        '..#.....', '.###....', '..##..#.', '...#.###', '....####', '..++####', '.#..#e##', '....####',
        '.....###', '.....+##', '......##', '...#..##', '..##..##', '.###.###', '########', '........',
    ],
    fungus: [
        '........', '....####', '..######', '.#######', '########', '###+####', '########', '....####',
        '.....e##', '......##', '......##', '.....###', '.....###', '....####', '...#####', '........',
    ],
    skeleton: [
        '........', '.....###', '....####', '....e#.#', '.....###', '......#.', '...+####', '..#.#.##',
        '.#..####', '....#.##', '.....###', '.....#.#', '.....#.#', '.....#.#', '....##.#', '........',
    ],
    ghost: [
        '........', '.....###', '....####', '...#####', '...#e###', '...#####', '..######', '.+######',
        '.#######', '..######', '..######', '...#####', '...#####', '..#.##.#', '.#..#..#', '........',
    ],
    golem: [
        '........', '....####', '....####', '....e###', '....####', '.#######', '########', '###.####',
        '###.####', '##..####', '##..####', '....####', '...##.##', '...##.##', '..###.##', '........',
    ],
    elemental: [
        '.....#..', '....##+.', '...###..', '..####.#', '..##e###', '.#######', '.#######', '..######',
        '+..#####', '...#####', '..######', '.#######', '..######', '...#####', '....####', '........',
    ],
    demon: [
        '..#.....', '..##....', '...##.##', '....####', '....e###', '.....###', '#..#####', '##.#####',
        '.#######', '...#####', '....####', '....##.#', '...##..#', '..##...#', '..#.....', '........',
    ],
    dragon: [
        '#.......', '##...#..', '###..###', '####.e##', '#####.##', '.#######', '..######', '...#####',
        '..++####', '.....###', '....####', '...##.##', '...#...#', '..##...#', '........', '........',
    ],
    giant: [
        '....####', '....####', '....e###', '....####', '..######', '.#######', '########', '##.#####',
        '##.#####', '##.#####', '...#####', '...##.##', '...##.##', '...##.##', '..###.##', '........',
    ],
    goblin: [
        '........', '........', '#...####', '##..####', '.#..e###', '....####', '.....###', '...+####',
        '..#.####', '.#..####', '....####', '....#.##', '....#.##', '...##.##', '........', '........',
    ],
    orc: [
        '........', '....####', '....####', '...#e###', '....####', '....#.##', '..######', '.#######',
        '##.#####', '#..#####', '...#####', '...##.##', '...##.##', '..###.##', '........', '........',
    ],
    mage: [
        '......#.', '.....###', '....####', '...#####', '.....e##', '.....###', '..+.####', '.#.#####',
        '#...####', '....####', '...#####', '...#####', '..######', '.#######', '########', '........',
    ],
    knight: [
        '......#.', '.....###', '....####', '....##e#', '....####', '..######', '.#######', '##.#####',
        '#..#####', '#..#####', '...#####', '...##.##', '...##.##', '..###.##', '........', '........',
    ],
    eye: [
        '..#.....', '...#....', '....####', '..######', '.#######', '.###eeee', '########', '########',
        '.#######', '.#######', '..######', '...#####', '..+.##.#', '.#..#..#', '#...#...', '........',
    ],
    fey: [
        '#.......', '##......', '###...##', '.###.###', '..##.e##', '...#####', '....####', '..+.####',
        '.#..####', '....####', '.....###', '.....#.#', '....##.#', '........', '........', '........',
    ],
    kraken: [
        '........', '....####', '...#####', '..######', '..#e####', '..######', '...#####', '....####',
        '..#.#.##', '.#.#.#.#', '#..#.#.#', '#.#..#.#', '.#..#..#', '#..#..#.', '..#..#..', '........',
    ],
};

/** Mirrors a half-silhouette and applies the monster's own variation. */
const buildMask = (familyId: string, seed: number): string[][] => {
    const half = SILHOUETTES[familyId] ?? SILHOUETTES.slime;
    const rnd = seededRng(seed);
    const grid: string[][] = half.map((row) => {
        const cells = row.split('').map((ch) => {
            if (ch === '+') {
                return rnd() < 0.5 ? '#' : '.';
            }
            return ch;
        });
        return [ ...cells, ...cells.slice().reverse() ];
    });
    // Seeded variation: grow a few edge cells so siblings differ
    for (let i = 0; i < 6; i++) {
        const y = Math.floor(rnd() * 16);
        const x = Math.floor(rnd() * 8);
        const neighbour = grid[y][x + 1] === '#' || x > 0 && grid[y][x - 1] === '#';
        if (grid[y][x] === '.' && neighbour) {
            grid[y][x] = '#';
            grid[y][15 - x] = '#';
        }
    }
    return grid;
};

/** Creates an off-screen canvas. */
const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas;
};

/**
 * Paints a monster sprite at the given pixel scale. <code>hit</code> draws the damage-flash
 * variant used when the monster is struck.
 */
export const renderMonster = (m: MonsterDef, scale: number, hit = false): HTMLCanvasElement => {
    const grid = buildMask(m.family.id, m.seed);
    const pal = ELEMENT_PALETTES[m.element];
    const canvas = makeCanvas(MONSTER_SIZE * scale, MONSTER_SIZE * scale);
    const ctx = canvas.getContext('2d')!;
    const cell = 2 * scale; // 16x16 mask doubled to 32x32
    const filled = (x: number, y: number) => y >= 0 && y < 16 && x >= 0 && x < 16 && grid[y][x] !== '.';

    // Outline pass
    ctx.fillStyle = OUTLINE;
    for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
            if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) {
                ctx.fillRect(x * cell, y * cell, cell, cell);
            }
        }
    }
    // Body with shading: light on top-left edges, dark on bottom-right edges
    for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
            const ch = grid[y][x];
            if (ch === '.') {
                continue;
            }
            let color = pal.base;
            if (ch === 'e') {
                color = pal.eye;
            } else if (!filled(x, y - 1) || !filled(x - 1, y) && x < 8) {
                color = pal.light;
            } else if (!filled(x, y + 1) || !filled(x + 1, y) && x >= 8) {
                color = pal.dark;
            }
            if (hit) {
                color = ch === 'e' ? pal.eye : '#fcfcfc';
            }
            ctx.fillStyle = color;
            ctx.fillRect(x * cell, y * cell, cell, cell);
            // Inner texture: a small speckle on body cells gives an 8-bit dither
            if (ch === '#' && !hit && (x * 7 + y * 3 + m.rank) % 5 === 0) {
                ctx.fillStyle = pal.dark;
                ctx.fillRect(x * cell + scale, y * cell + scale, scale, scale);
            }
        }
    }
    // Eye pupils
    if (!hit) {
        ctx.fillStyle = OUTLINE;
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                if (grid[y][x] === 'e') {
                    ctx.fillRect(x * cell + scale, y * cell + scale, scale, scale);
                }
            }
        }
    }
    // Higher ranks get a crown of the element's light colour
    if (m.rank >= 15 && !hit) {
        ctx.fillStyle = pal.light;
        for (let i = 0; i < 3; i++) {
            ctx.fillRect((6 + i * 2) * cell, 0, scale * 2, scale * 3);
        }
    }
    return canvas;
};

// ---------------------------------------------------------------------------
// Gear icons

/** 16x16 icon templates: 'M' metal, 'L' metal light, 'D' metal dark, 'H' handle, 'G' gem. */
const ICONS: Record<string, string[]> = {
    sword: [
        '..............LM', '.............LMD', '............LMD.', '...........LMD..', '..........LMD...',
        '.........LMD....', '........LMD.....', '.......LMD......', '..G...LMD.......', '...G.LMD........',
        '....GMD.........', '...HGG..........', '..HH..G.........', '.HH.............', 'HH..............', 'G...............',
    ],
    greatsword: [
        '.............LMM', '............LMMD', '...........LMMD.', '..........LMMD..', '.........LMMD...',
        '........LMMD....', '.......LMMD.....', '......LMMD......', '.G...LMMD.......', '..G.LMMD........',
        '...GMMD.........', '..HGGG..........', '.HH..G..........', 'HH..............', 'H...............', '................',
    ],
    dagger: [
        '................', '................', '................', '................', '..........LM....',
        '.........LMD....', '........LMD.....', '.......LMD......', '...G..LMD.......', '....GLMD........',
        '.....GD.........', '....HG..........', '...HH.G.........', '..HH............', '..G.............', '................',
    ],
    katana: [
        '...............L', '..............LM', '.............LM.', '............LM..', '...........LM...',
        '..........LM....', '.........LM.....', '........LM......', '.......LM.......', '......LM........',
        '....GGM.........', '....GG..........', '...H............', '..H.............', '.H..............', 'H...............',
    ],
    axe: [
        '........LLM.....', '.......LMMMD....', '......LMMMMD....', '......LMMHMD....', '.......DMHD.....',
        '........H.......', '.......H........', '......H.........', '.....H..........', '....H...........',
        '...H............', '..H.............', '.H..............', 'H...............', '................', '................',
    ],
    greataxe: [
        '.....LLM..LLM...', '....LMMMDMMMD...', '....LMMMHMMMD...', '.....DMMHMMD....', '.......H........',
        '.......H........', '......H.........', '......H.........', '.....H..........', '.....H..........',
        '....H...........', '....H...........', '...H............', '..G.............', '................', '................',
    ],
    mace: [
        '...........L.L..', '..........LMMM..', '.........LMMMMD.', '..........MMMD..', '.........H.D.D..',
        '........H.......', '.......H........', '......H.........', '.....H..........', '....H...........',
        '...H............', '..H.............', '.G..............', '................', '................', '................',
    ],
    hammer: [
        '.........LLLM...', '........LMMMMD..', '........LMMMMD..', '.........DHDD...', '........H.......',
        '.......H........', '......H.........', '.....H..........', '....H...........', '...H............',
        '..H.............', '.H..............', 'G...............', '................', '................', '................',
    ],
    spear: [
        '..............L.', '.............LM.', '............LMD.', '.............D..', '...........H....',
        '..........H.....', '.........H......', '........H.......', '.......H........', '......H.........',
        '.....H..........', '....H...........', '...H............', '..H.............', '.G..............', '................',
    ],
    halberd: [
        '.............LM.', '.........LL.LMD.', '.........LMMMD..', '..........DMH...', '..........H.....',
        '.........H......', '........H.......', '.......H........', '......H.........', '.....H..........',
        '....H...........', '...H............', '..H.............', '.G..............', '................', '................',
    ],
    bow: [
        '.......HH.......', '......H..M......', '.....H....M.....', '....H......M....', '....H......M....',
        '...H.......M....', '...H...LLLLGL...', '...H.......M....', '....H......M....', '....H......M....',
        '.....H....M.....', '......H..M......', '.......HH.......', '................', '................', '................',
    ],
    crossbow: [
        '................', '................', '..H.......H.....', '...H.....H......', '....HMMMH.......',
        '.....LMMLLLLLLG.', '....HMMMH.......', '...H..D..H......', '..H...D...H.....', '......D.........',
        '.....HHH........', '................', '................', '................', '................', '................',
    ],
    staff: [
        '.............GG.', '............GLLG', '............GLLG', '.............GG.', '............H...',
        '...........H....', '..........H.....', '.........H......', '........H.......', '.......H........',
        '......H.........', '.....H..........', '....H...........', '...H............', '..H.............', '................',
    ],
    wand: [
        '................', '................', '................', '.........G.G....', '..........G.....',
        '.........GLG....', '..........G.....', '.........M......', '........M.......', '.......H........',
        '......H.........', '.....H..........', '....H...........', '................', '................', '................',
    ],
    armor: [
        '................', '....LL....LL....', '...LMMLLLLMML...', '..LMMMMMMMMMMD..', '..LMMMMGGMMMMD..',
        '..LMMMMMMMMMMD..', '...MMMMMMMMMD...', '...LMMMMMMMMD...', '...LMMMMMMMMD...', '...LMMMMMMMMD...',
        '...DMMMMMMMMD...', '....DDDDDDDD....', '................', '................', '................', '................',
    ],
    shield: [
        '................', '...LLLLLLLLLL...', '..LMMMMMMMMMMD..', '..LMMMMGGMMMMD..', '..LMMMGLLGMMMD..',
        '..LMMMMGGMMMMD..', '..LMMMMMMMMMMD..', '...LMMMMMMMMD...', '...LMMMMMMMMD...', '....LMMMMMMD....',
        '.....LMMMMD.....', '......LMMD......', '.......DD.......', '................', '................', '................',
    ],
};

/** Metal colours by gear tier group (crude iron to celestial). */
const METALS: [string, string, string][] = [
    [ '#583c24', '#8c6c48', '#bc9c78' ], // crude
    [ '#585858', '#9c9c9c', '#dcdcdc' ], // iron / steel
    [ '#4c5c7c', '#8ca0c8', '#d8e4fc' ], // fine / masterwork
    [ '#5c3800', '#b88800', '#fce080' ], // knight / gilded
    [ '#3c5c5c', '#6cbcbc', '#c8fcfc' ], // mithril / elven
    [ '#38085c', '#8c38c8', '#d8a8fc' ], // moonsilver / starforged
    [ '#5c0000', '#c82818', '#fca088' ], // dragonbone / voidsteel
    [ '#5c4800', '#e8c020', '#fcfcc8' ], // sunforged / celestial
];

const HANDLE = '#6c3c14';
const GEMS = [ '#fc3838', '#38a8fc', '#38fc68', '#fcd838', '#c838fc', '#fcfcfc' ];

/**
 * Paints a 16x16 gear icon for a template id ('sword', 'armor', ...) at a gear tier (0-22).
 */
export const renderGearIcon = (template: string, tier: number, scale: number): HTMLCanvasElement => {
    const rows = ICONS[template] ?? ICONS.sword;
    const [ dark, base, light ] = METALS[Math.min(METALS.length - 1, Math.floor(tier / 3))];
    const gem = GEMS[tier % GEMS.length];
    const canvas = makeCanvas(ICON_SIZE * scale, ICON_SIZE * scale);
    const ctx = canvas.getContext('2d')!;
    const colors: Record<string, string> = { M: base, L: light, D: dark, H: HANDLE, G: gem };
    rows.forEach((row, y) => {
        row.split('').forEach((ch, x) => {
            const color = colors[ch];
            if (color) {
                ctx.fillStyle = color;
                ctx.fillRect(x * scale, y * scale, scale, scale);
            }
        });
    });
    return canvas;
};

/** Icon template for an armory/catalog item by slot and type id. */
export const iconTemplateFor = (slot: 'weapon' | 'armor' | 'shield', typeId: string): string =>
    slot === 'weapon' ? typeId : slot;
