/**
 * Companions (affinity, bond tiers, stances) and mounts (120 across 12 families x 10 coats).
 * See docs/PROFESSIONS_AND_COMPANIONS.md.
 */
import { StatMods } from './stats';

export type Stance = 'BALANCED' | 'AGGRESSIVE' | 'DEFENSIVE' | 'SUPPORT';
export const STANCES: Stance[] = [ 'BALANCED', 'AGGRESSIVE', 'DEFENSIVE', 'SUPPORT' ];

export interface CompanionDef {
    id: string;
    name: string;
    job: string;
    race: string;
    home: string;
    likedGift: string;
    levelReq: number;
    fee: number;
    bio: string;
}

export const COMPANIONS: CompanionDef[] = [
    { id: 'aldric', name: 'ALDRIC', job: 'warden', race: 'hearthkin', home: 'Tantegel', likedGift: 'Herb', levelReq: 1, fee: 50, bio: 'A retired castle guard who misses the road.' },
    { id: 'mira', name: 'MIRA', job: 'chaplain', race: 'starkin', home: 'Brecconary', likedGift: 'Feast', levelReq: 2, fee: 80, bio: 'A shrine keeper with a gentle hand.' },
    { id: 'kestrel', name: 'KESTREL', job: 'strider', race: 'thornelf', home: 'Kol', likedGift: 'Feast', levelReq: 3, fee: 120, bio: 'Tracks wolves through the northern woods.' },
    { id: 'brom', name: 'BROM', job: 'berserker', race: 'tuskborn', home: 'Garinham', likedGift: 'Rune Oil', levelReq: 4, fee: 150, bio: 'Loud, loyal and always hungry.' },
    { id: 'sable', name: 'SABLE', job: 'shade', race: 'lunari', home: 'Rimuldar', likedGift: 'Lucky Charm', levelReq: 5, fee: 200, bio: 'Says she was never a thief. Was a thief.' },
    { id: 'orin', name: 'ORIN', job: 'arcanist', race: 'pipkin', home: 'Garinham', likedGift: 'Elixir', levelReq: 6, fee: 260, bio: 'Studies the old runes of Garin.' },
    { id: 'thessa', name: 'THESSA', job: 'vanguard', race: 'drakkin', home: 'Cantlin', likedGift: 'Armor Kit', levelReq: 8, fee: 340, bio: 'Swore an oath to see the Dragonlord fall.' },
    { id: 'pip', name: 'PIP', job: 'cantor', race: 'wispling', home: 'Brecconary', likedGift: 'Feast', levelReq: 9, fee: 380, bio: 'Sings badly. Fights well.' },
    { id: 'garrow', name: 'GARROW', job: 'dreadknight', race: 'stonekin', home: 'Hauksness', likedGift: 'Ward Shawl', levelReq: 11, fee: 480, bio: 'The last knight of a ruined town.' },
    { id: 'yuki', name: 'YUKI', job: 'ronin', race: 'felinar', home: 'Rimuldar', likedGift: 'Rune Oil', levelReq: 12, fee: 540, bio: 'A wandering blade seeking a worthy duel.' },
    { id: 'fen', name: 'FEN', job: 'verdant', race: 'thornelf', home: 'Kol', likedGift: 'Herb', levelReq: 13, fee: 600, bio: 'Talks to trees. Sometimes they answer.' },
    { id: 'dax', name: 'DAX', job: 'corsair', race: 'twinblood', home: 'Cantlin', likedGift: 'Lucky Charm', levelReq: 14, fee: 700, bio: 'A sailor without a sea.' },
    { id: 'nyx', name: 'NYX', job: 'necromancer', race: 'emberborn', home: 'Charlock', likedGift: 'Elixir', levelReq: 16, fee: 850, bio: 'Left the Dragonlord\'s service. Mostly.' },
    { id: 'hald', name: 'HALD', job: 'beastcaller', race: 'hornfolk', home: 'Garinham', likedGift: 'Feast', levelReq: 17, fee: 950, bio: 'Travels with a very large dog.' },
    { id: 'rune', name: 'RUNE', job: 'runeblade', race: 'wolfkin', home: 'Tantegel', likedGift: 'Rune Oil', levelReq: 19, fee: 1200, bio: 'Carves frost runes into every blade.' },
    { id: 'solenne', name: 'SOLENNE', job: 'sunwarden', race: 'starkin', home: 'Tantegel', likedGift: 'Elixir', levelReq: 21, fee: 1500, bio: 'Carries the light of Erdrick\'s line.' },
];

export const getCompanion = (id: string): CompanionDef | undefined => COMPANIONS.find((c) => c.id === id);

export interface BondTier {
    name: string;
    at: number;
    mods: StatMods;
}

export const BOND_TIERS: BondTier[] = [
    { name: 'STRANGER', at: 0, mods: {} },
    { name: 'ALLY', at: 20, mods: { hp: 5 } },
    { name: 'FRIEND', at: 45, mods: { hp: 10, dmg: 5 } },
    { name: 'TRUSTED', at: 70, mods: { hp: 15, dmg: 8, crit: 3 } },
    { name: 'SWORN', at: 100, mods: { hp: 20, dmg: 12, crit: 5, resist: 5 } },
];

export const bondTier = (affinity: number): BondTier => {
    let tier = BOND_TIERS[0];
    for (const t of BOND_TIERS) {
        if (affinity >= t.at) {
            tier = t;
        }
    }
    return tier;
};

export interface CompanionState {
    affinity: number;
    stance: Stance;
    lastTalk?: string;
}

export const addAffinity = (state: CompanionState, amount: number): void => {
    state.affinity = Math.max(0, Math.min(100, state.affinity + amount));
};

/** +1 per battle won together, +3 for bosses. */
export const affinityForVictory = (boss: boolean): number => boss ? 3 : 1;

/** +3 per gift, +10 for the liked gift. */
export const affinityForGift = (companion: CompanionDef, gift: string): number =>
    companion.likedGift.toUpperCase() === gift.toUpperCase() ? 10 : 3;

/** Talking gives +1 once per day. */
export const talkToCompanion = (state: CompanionState, today = new Date()): boolean => {
    const day = today.toISOString().substring(0, 10);
    if (state.lastTalk === day) {
        return false;
    }
    state.lastTalk = day;
    addAffinity(state, 1);
    return true;
};

export type AssistAction = { type: 'attack'; multiplier: number } | { type: 'heal'; pct: number } | { type: 'guard' } | { type: 'none' };

/**
 * Decides a companion's battle assist for the turn based on stance, job role and the
 * hero's HP ratio.
 */
export const companionAssist = (stance: Stance, role: 'tank' | 'dps' | 'healer', heroHpRatio: number): AssistAction => {
    switch (stance) {
        case 'AGGRESSIVE':
            return heroHpRatio <= 0.15 && role === 'healer' ? { type: 'heal', pct: 25 } : { type: 'attack', multiplier: 0.6 };
        case 'DEFENSIVE':
            if (role === 'healer' && heroHpRatio < 0.55) {
                return { type: 'heal', pct: 20 };
            }
            return { type: 'guard' };
        case 'SUPPORT':
            if (heroHpRatio < 0.7) {
                return { type: 'heal', pct: role === 'healer' ? 22 : 12 };
            }
            return { type: 'attack', multiplier: 0.3 };
        case 'BALANCED':
        default:
            if (role === 'healer') {
                return heroHpRatio < 0.6 ? { type: 'heal', pct: 20 } : { type: 'attack', multiplier: 0.3 };
            }
            if (role === 'tank') {
                return heroHpRatio < 0.4 ? { type: 'guard' } : { type: 'attack', multiplier: 0.4 };
            }
            return { type: 'attack', multiplier: 0.5 };
    }
};

// ---------------------------------------------------------------------------
// Mounts

export type MountTier = 'ground' | 'swift' | 'flying';

export interface MountFamily {
    id: string;
    name: string;
    tier: MountTier;
    source: string;
    /** Stable price in gold, or 0 if not sold. */
    price: number;
    levelReq: number;
}

export const MOUNT_FAMILIES: MountFamily[] = [
    { id: 'steed', name: 'STEED', tier: 'ground', source: 'Stable', price: 100, levelReq: 15 },
    { id: 'warwolf', name: 'WARWOLF', tier: 'ground', source: 'Stable', price: 100, levelReq: 15 },
    { id: 'raptor', name: 'RAPTOR', tier: 'ground', source: 'Stable', price: 100, levelReq: 15 },
    { id: 'warboar', name: 'WARBOAR', tier: 'ground', source: 'Stable', price: 400, levelReq: 18 },
    { id: 'ram', name: 'MOUNTAIN RAM', tier: 'ground', source: 'Stable', price: 600, levelReq: 20 },
    { id: 'stag', name: 'GREAT STAG', tier: 'ground', source: 'Stable (10 achievements)', price: 900, levelReq: 20 },
    { id: 'bear', name: 'WAR BEAR', tier: 'swift', source: '4% from dungeon/tower bosses', price: 0, levelReq: 1 },
    { id: 'sabrecat', name: 'SABRECAT', tier: 'swift', source: '4% from dungeon/tower bosses', price: 0, levelReq: 1 },
    { id: 'strider', name: 'CLOCKWORK STRIDER', tier: 'swift', source: 'Crafted (blacksmithing 60)', price: 0, levelReq: 1 },
    { id: 'spectral', name: 'SPECTRAL STEED', tier: 'swift', source: '6% from world bosses', price: 0, levelReq: 1 },
    { id: 'gryphon', name: 'GRYPHON', tier: 'flying', source: '8% from raid bosses', price: 0, levelReq: 1 },
    { id: 'drake', name: 'DRAKE', tier: 'flying', source: '8% from raid bosses', price: 0, levelReq: 1 },
];

export const COATS = [ 'BROWN', 'GREY', 'BLACK', 'WHITE', 'CRIMSON', 'GOLDEN', 'FROST', 'EMBER', 'SHADOW', 'CELESTIAL' ];

export interface MountDef {
    id: string;
    name: string;
    family: MountFamily;
    coat: string;
    tier: MountTier;
}

const TIER_ORDER: MountTier[] = [ 'ground', 'swift', 'flying' ];

export const MOUNTS: MountDef[] = MOUNT_FAMILIES.flatMap((family) => COATS.map((coat) => {
    // SHADOW / CELESTIAL coats are one tier higher
    const bump = coat === 'SHADOW' || coat === 'CELESTIAL' ? 1 : 0;
    const tier = TIER_ORDER[Math.min(2, TIER_ORDER.indexOf(family.tier) + bump)];
    return { id: `${family.id}_${coat.toLowerCase()}`, name: `${coat} ${family.name}`, family, coat, tier };
}));

export const getMount = (id: string): MountDef | undefined => MOUNTS.find((m) => m.id === id);

/** Random encounter multiplier while riding. */
export const ENCOUNTER_MULT: Record<MountTier, number> = { ground: 0.6, swift: 0.45, flying: 0.3 };

/** Achievements needed to claim the SHADOW / CELESTIAL coat at the stable. */
export const COAT_ACHIEVEMENTS: Record<string, number> = { SHADOW: 10, CELESTIAL: 20 };

/** Mounts a stable sells to this hero. */
export const stableStock = (heroLevel: number, achievements: number): MountDef[] => MOUNTS.filter((m) => {
    if (m.family.price <= 0 || heroLevel < m.family.levelReq) {
        return false;
    }
    if (m.family.id === 'stag' && achievements < 10) {
        return false;
    }
    const need = COAT_ACHIEVEMENTS[m.coat];
    if (need !== undefined) {
        return achievements >= need;
    }
    // Before 18, only the three starter brown/grey mounts
    return heroLevel >= 18 || m.coat === 'BROWN' || m.coat === 'GREY';
});

export const mountPrice = (mount: MountDef): number => {
    const coatIndex = COATS.indexOf(mount.coat);
    return mount.family.price + coatIndex * 50;
};

/** Boss mount drops, by boss category. */
export const rollMountDrop = (rng: () => number, category: string): MountDef | undefined => {
    let pool: string[] = [];
    let p = 0;
    if (category === 'dungeon' || category === 'tower') {
        pool = [ 'bear', 'sabrecat' ];
        p = 0.04;
    } else if (category === 'world') {
        pool = [ 'spectral' ];
        p = 0.06;
    } else if (category === 'raid') {
        pool = [ 'gryphon', 'drake' ];
        p = 0.08;
    }
    if (!pool.length || rng() >= p) {
        return undefined;
    }
    const family = pool[Math.floor(rng() * pool.length)];
    const coat = COATS[Math.floor(rng() * 8)]; // shadow/celestial come from the stable
    return getMount(`${family}_${coat.toLowerCase()}`);
};
