/**
 * Hidden button-code easter eggs (docs/EASTER_EGGS.md) and 100 hidden world discoveries
 * (docs/HIDDEN_WORLD_SECRETS.md). Both are one-time rewards per save.
 */
import { Rng, hashString, pick, rollInt, seededRng } from './rng';

export type InputKey = 'U' | 'D' | 'L' | 'R' | 'A' | 'B' | 'S';

export interface Reward {
    gold?: number;
    xp?: number;
    sigils?: number;
    herbs?: number;
    gems?: string[];
    runes?: string[];
    /** Name of a guaranteed legendary relic (secret bosses). */
    relic?: string;
}

export interface EasterEgg {
    id: string;
    name: string;
    hint: string;
    sequence: InputKey[];
    reward: Reward;
}

// A = action (Z), B = cancel (X), S = start (Enter)
export const EASTER_EGGS: EasterEgg[] = [
    {
        id: 'old_world', name: 'THE OLD WORLD', hint: 'An old ten-button legend.',
        sequence: [ 'U', 'U', 'D', 'D', 'L', 'R', 'L', 'R', 'B', 'A' ],
        reward: { gold: 1337, sigils: 1, xp: 2500 },
    },
    {
        id: 'hello_builder', name: 'HELLO, BUILDER', hint: 'Left, right, left, right... then act.',
        sequence: [ 'L', 'R', 'L', 'R', 'L', 'R', 'A' ],
        reward: { gold: 4242, xp: 4200 },
    },
    {
        id: 'slime_whisperer', name: 'THE SLIME WHISPERER', hint: 'Bounce like a slime.',
        sequence: [ 'U', 'D', 'U', 'D', 'B', 'B' ],
        reward: { gold: 250, herbs: 3, xp: 500 },
    },
    {
        id: 'light_in_dark', name: 'LIGHT IN THE DARK', hint: 'Walk the four winds, then begin.',
        sequence: [ 'U', 'R', 'D', 'L', 'A', 'S' ],
        reward: { gold: 777, sigils: 2, xp: 1777 },
    },
];

/**
 * Recognizes easter egg sequences from a stream of newly pressed keys.
 */
export class SequenceRecognizer {

    private readonly buffer: InputKey[] = [];
    private readonly maxLength: number;

    constructor(private readonly eggs: EasterEgg[] = EASTER_EGGS) {
        this.maxLength = Math.max(...eggs.map((e) => e.sequence.length));
    }

    /** Feeds one key press; returns an egg if a sequence just completed. */
    push(key: InputKey): EasterEgg | undefined {
        this.buffer.push(key);
        if (this.buffer.length > this.maxLength) {
            this.buffer.shift();
        }
        return this.eggs.find((egg) => {
            const seq = egg.sequence;
            if (seq.length > this.buffer.length) {
                return false;
            }
            const offset = this.buffer.length - seq.length;
            return seq.every((k, i) => this.buffer[offset + i] === k);
        });
    }

    clear() {
        this.buffer.length = 0;
    }
}

/** Grants an egg once; returns the reward only the first time. */
export const discoverEgg = (found: string[], egg: EasterEgg): Reward | undefined => {
    if (found.includes(egg.id)) {
        return undefined;
    }
    found.push(egg.id);
    return egg.reward;
};

export const eggArchive = (found: string[]) => EASTER_EGGS.map((egg) => ({
    name: found.includes(egg.id) ? egg.name : '???',
    hint: found.includes(egg.id) ? egg.hint : 'Undiscovered.',
    found: found.includes(egg.id),
}));

// ---------------------------------------------------------------------------
// Hidden world discoveries

export type DiscoveryType = 'npc' | 'cache' | 'dungeon' | 'boss' | 'portal' | 'shrine';

export interface WorldDiscovery {
    id: string;
    title: string;
    clue: string;
    map: string;
    type: DiscoveryType;
    minLevel: number;
    reward: Reward;
    /** Line shown on discovery. */
    text: string;
}

/** Maps discoveries can be placed on, with how many each gets (100 total). */
export const DISCOVERY_MAP_WEIGHTS: [string, number][] = [
    [ 'overworld', 52 ], [ 'brecconary', 7 ], [ 'garinham', 7 ], [ 'kol', 7 ],
    [ 'tantegelCastle', 9 ], [ 'erdricksCave1', 9 ], [ 'erdricksCave2', 9 ],
];

const NAMED_DISCOVERIES: WorldDiscovery[] = [
    {
        id: 'lantern_keeper', title: 'The Drowned Lantern Keeper', clue: 'A lantern glows where no one lives.',
        map: 'overworld', type: 'npc', minLevel: 4, reward: { gold: 1200, herbs: 2 },
        text: 'A ghostly keeper hands thee his last supplies.',
    },
    {
        id: 'ice_cache', title: 'The Ice-Sealed Cache', clue: 'Cold stone hides warm gold.',
        map: 'garinham', type: 'cache', minLevel: 8, reward: { gold: 3200, sigils: 2, herbs: 3 },
        text: 'Thou hast broken open a cache sealed in ice!',
    },
    {
        id: 'king_under_ash', title: 'The King Under Ash', clue: 'Beneath the cave, a crown sleeps.',
        map: 'erdricksCave2', type: 'dungeon', minLevel: 20, reward: { gold: 4000, gems: [ 'diamond_t3' ] },
        text: 'Thou findest a hidden passage and the old king\'s treasure.',
    },
    {
        id: 'builder_workshop', title: 'The Builder\'s Hidden Workshop', clue: 'Someone built this world.',
        map: 'brecconary', type: 'dungeon', minLevel: 1, reward: { gold: 500, xp: 100, runes: [ 'precision_t1' ] },
        text: 'A tiny workshop full of half-made worlds.',
    },
    {
        id: 'void_herald', title: 'The Void Herald', clue: 'Where the sea meets the dark.',
        map: 'overworld', type: 'boss', minLevel: 28, reward: { gold: 12000, sigils: 8, relic: 'HERALD\'S LAST STAR' },
        text: 'The air tears open. The Void Herald appears!',
    },
    {
        id: 'ember_gate', title: 'The Ember Gate', clue: 'Warm sand, a door of fire.',
        map: 'overworld', type: 'portal', minLevel: 14, reward: { gold: 2500, runes: [ 'flame_t2' ] },
        text: 'An ember gate flickers, then fades, leaving treasure.',
    },
];

const GEN_TITLES = [ 'Forgotten', 'Whispering', 'Sunken', 'Moonlit', 'Silent', 'Buried', 'Lost', 'Gilded',
    'Shattered', 'Veiled', 'Ancient', 'Hollow', 'Wandering', 'Ashen', 'Starlit' ];
const GEN_NOUNS: Record<DiscoveryType, string[]> = {
    npc: [ 'Hermit', 'Pilgrim', 'Minstrel', 'Ghost', 'Scholar', 'Fisher' ],
    cache: [ 'Cache', 'Chest', 'Hoard', 'Coffer', 'Stash' ],
    dungeon: [ 'Cellar', 'Crypt', 'Tunnel', 'Vault' ],
    boss: [ 'Beast', 'Knight', 'Wyrm', 'Shade' ],
    portal: [ 'Gate', 'Rift', 'Arch' ],
    shrine: [ 'Shrine', 'Altar', 'Stone', 'Spring' ],
};
const GEN_CLUES = [ 'Search where the path bends.', 'A faint glimmer betrays it.', 'Few walk here.',
    'Count the steps from the gate.', 'The old ones left a mark.', 'Listen for the hum of magic.' ];
const RELIC_WORDS = [ 'Star', 'Tear', 'Ember', 'Crown', 'Fang', 'Seal', 'Shard', 'Eye' ];

const generateDiscoveries = (): WorldDiscovery[] => {
    const rng = seededRng(100100);
    const types: DiscoveryType[] = [ 'npc', 'cache', 'cache', 'shrine', 'dungeon', 'portal', 'boss' ];
    const mapSlots: string[] = [];
    for (const [ map, count ] of DISCOVERY_MAP_WEIGHTS) {
        for (let i = 0; i < count; i++) {
            mapSlots.push(map);
        }
    }
    // Named discoveries take one slot on their map
    for (const s of NAMED_DISCOVERIES) {
        const index = mapSlots.indexOf(s.map);
        if (index > -1) {
            mapSlots.splice(index, 1);
        }
    }
    const result: WorldDiscovery[] = [];
    mapSlots.forEach((map, i) => {
        const type = map === 'overworld' ? pick(rng, types) : pick(rng, types.filter((t) => t !== 'portal'));
        const minLevel = rollInt(rng, 1, 30);
        const scale = 1 + minLevel / 5;
        const tier = Math.min(9, 1 + Math.floor(minLevel / 6));
        const reward: Reward = { gold: Math.round(rollInt(rng, 80, 300) * scale) };
        switch (type) {
            case 'npc': reward.herbs = rollInt(rng, 1, 3); break;
            case 'cache': reward.sigils = rollInt(rng, 0, 2); break;
            case 'shrine': reward.xp = Math.round(rollInt(rng, 50, 150) * scale); break;
            case 'dungeon': reward.gems = [ `${pick(rng, [ 'ruby', 'sapphire', 'emerald', 'amethyst', 'onyx' ])}_t${tier}` ]; break;
            case 'portal': reward.runes = [ `${pick(rng, [ 'flame', 'frost', 'storm', 'ward' ])}_t${tier}` ]; break;
            case 'boss':
                reward.gold = (reward.gold ?? 0) * 3;
                reward.sigils = rollInt(rng, 2, 4);
                reward.relic = `${pick(rng, GEN_TITLES).toUpperCase()} ${pick(rng, RELIC_WORDS).toUpperCase()}`;
                break;
        }
        const title = `The ${pick(rng, GEN_TITLES)} ${pick(rng, GEN_NOUNS[type])}`;
        result.push({
            id: `discovery_${i}`, title, clue: pick(rng, GEN_CLUES), map, type, minLevel, reward,
            text: type === 'boss' ? `${title} awakens!` : `Thou hast discovered ${title}!`,
        });
    });
    return result;
};

export const WORLD_DISCOVERIES: WorldDiscovery[] = [ ...NAMED_DISCOVERIES, ...generateDiscoveries() ];

export const discoveriesForMap = (map: string): WorldDiscovery[] => WORLD_DISCOVERIES.filter((s) => s.map === map);

export const getDiscovery = (id: string): WorldDiscovery | undefined => WORLD_DISCOVERIES.find((s) => s.id === id);

export interface TileLocation {
    row: number;
    col: number;
}

/**
 * Picks a stable location for every discovery on a map. Locations are derived from the
 * map name and discovery id, are walkable, and never collide with each other or with
 * <code>blocked</code> spots (warps, NPCs, chests).
 */
export const placeDiscoveries = (map: string, rows: number, cols: number,
    isWalkable: (row: number, col: number) => boolean,
    blocked: (row: number, col: number) => boolean = () => false): Map<string, TileLocation> => {
    const result = new Map<string, TileLocation>();
    const taken = new Set<string>();
    for (const d of discoveriesForMap(map)) {
        const rng: Rng = seededRng(hashString(`${map}:${d.id}`));
        for (let attempt = 0; attempt < 400; attempt++) {
            const row = Math.floor(rng() * rows);
            const col = Math.floor(rng() * cols);
            const key = `${row},${col}`;
            if (!taken.has(key) && isWalkable(row, col) && !blocked(row, col)) {
                taken.add(key);
                result.set(d.id, { row, col });
                break;
            }
        }
    }
    return result;
};

export const GLIMMER_RANGE = 3;

export const withinGlimmer = (a: TileLocation, b: TileLocation): boolean =>
    Math.abs(a.row - b.row) <= GLIMMER_RANGE && Math.abs(a.col - b.col) <= GLIMMER_RANGE;

export type DiscoverResult =
    | { status: 'found'; discovery: WorldDiscovery; reward: Reward }
    | { status: 'too_low'; discovery: WorldDiscovery }
    | { status: 'already'; discovery: WorldDiscovery };

/**
 * Attempts a discovery. Rewards are granted once. Boss discoveries are recorded by the
 * caller after the boss is defeated (pass <code>defer</code>).
 */
export const discover = (found: string[], d: WorldDiscovery, heroLevel: number, defer = false): DiscoverResult => {
    if (heroLevel < d.minLevel) {
        return { status: 'too_low', discovery: d };
    }
    if (found.includes(d.id)) {
        return { status: 'already', discovery: d };
    }
    if (!defer) {
        found.push(d.id);
    }
    return { status: 'found', discovery: d, reward: d.reward };
};
