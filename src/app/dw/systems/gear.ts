/**
 * Gear quality, affixes, durability, legendary sets, artifacts/relics and vendor value.
 * See docs/GEAR_STATS_ECONOMY.md, docs/BOSS_LOOT_AND_LEGENDARY_SETS.md and
 * docs/ARTIFACTS_AND_RELICS.md.
 *
 * Dragon Warrior's own weapon/armor/shield stay as they are; a {@link GearEnhancement}
 * is attached to each equipped slot (quality, affixes, sockets, durability, set). Artifacts
 * and relics are two extra slots holding {@link GearInstance}s.
 */
import { Rng, chance, pick, rollInt } from './rng';
import { Sockets, emptySockets, socketsMods } from './sockets';
import { StatMods, SubstatKey, addMods } from './stats';
import { upgradeMods } from './armory';

/** Rarity grades 1-9. */
export const QUALITIES = [ 'Poor', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Exalted', 'Divine' ] as const;
export type Quality = typeof QUALITIES[number];

/** Rarity grade 1-9 of a quality. */
export const rarityGrade = (quality: Quality): number => QUALITIES.indexOf(quality) + 1;

/** Number of rolled affixes per quality tier. */
export const AFFIX_COUNT: Record<Quality, number> = {
    Poor: 0, Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4, Mythic: 5, Exalted: 6, Divine: 7,
};

/** Text color for each quality in menus. */
export const QUALITY_COLOR: Record<Quality, string | undefined> = {
    Poor: undefined, Common: undefined, Uncommon: undefined, Rare: 'blue', Epic: 'blue', Legendary: 'red',
    Mythic: 'red', Exalted: 'red', Divine: 'red',
};

export const EQUIP_SLOTS = [ 'weapon', 'armor', 'shield', 'artifact', 'relic' ] as const;
export type EquipSlot = typeof EQUIP_SLOTS[number];
export type SocketSlot = 'weapon' | 'armor' | 'shield';

/** Affix pool: key and value per item level. */
const AFFIX_POOL: { key: SubstatKey; perLevel: number; min: number }[] = [
    { key: 'hit', perLevel: 0.05, min: 1 },
    { key: 'acb', perLevel: 0.04, min: 1 },
    { key: 'hp', perLevel: 0.6, min: 3 },
    { key: 'dmg', perLevel: 0.25, min: 2 },
    { key: 'resist', perLevel: 0.1, min: 1 },
    { key: 'crit', perLevel: 0.08, min: 1 },
    { key: 'dodge', perLevel: 0.06, min: 1 },
    { key: 'leech', perLevel: 0.03, min: 1 },
    { key: 'haste', perLevel: 0.07, min: 1 },
    { key: 'gf', perLevel: 0.3, min: 3 },
    { key: 'xp', perLevel: 0.15, min: 2 },
    { key: 'mf', perLevel: 0.3, min: 3 },
    { key: 'thorns', perLevel: 0.2, min: 1 },
];

export interface LegendarySet {
    id: string;
    name: string;
    pieces: { slot: EquipSlot; name: string }[];
    two: StatMods;
    three: StatMods;
}

export const LEGENDARY_SETS: LegendarySet[] = [
    {
        id: 'crypt_warden', name: 'CRYPT WARDEN',
        pieces: [ { slot: 'weapon', name: 'Warden Blade' }, { slot: 'armor', name: 'Warden Mail' }, { slot: 'shield', name: 'Warden Aegis' } ],
        two: { acb: 4, resist: 5 }, three: { acb: 8, resist: 10, hp: 40 },
    },
    {
        id: 'forgefire', name: 'FORGEFIRE',
        pieces: [ { slot: 'weapon', name: 'Forgefire Hammer' }, { slot: 'armor', name: 'Forgefire Plate' }, { slot: 'relic', name: 'Forgefire Ember' } ],
        two: { dmg: 10, fire: 10 }, three: { dmg: 20, fire: 25, crit: 5 },
    },
    {
        id: 'rime_throne', name: 'RIME THRONE',
        pieces: [ { slot: 'armor', name: 'Rime Mantle' }, { slot: 'shield', name: 'Rime Ward' }, { slot: 'artifact', name: 'Rime Crown' } ],
        two: { cold: 15, dodge: 4 }, three: { cold: 30, dodge: 8, resist: 8 },
    },
    {
        id: 'long_night', name: 'LONG NIGHT',
        pieces: [ { slot: 'weapon', name: 'Long Night Edge' }, { slot: 'artifact', name: 'Long Night Lantern' }, { slot: 'relic', name: 'Long Night Shard' } ],
        two: { crit: 5, necrotic: 15 }, three: { crit: 10, critdmg: 50, leech: 4 },
    },
];

export const getSet = (id: string): LegendarySet | undefined => LEGENDARY_SETS.find((s) => s.id === id);

/** Base effect families of artifacts and relics (applied in Dragon Warrior terms). */
export type WondrousEffect = 'HP' | 'AC' | 'SAVE' | 'ABILITY' | 'HIT' | 'INITIATIVE';

const WONDROUS_EFFECTS: WondrousEffect[] = [ 'HP', 'AC', 'SAVE', 'ABILITY', 'HIT', 'INITIATIVE' ];

export const RELIC_NAMES: string[] = [
    'ASHEN HEART', 'VEILSTONE', 'MOONFALL SEAL', 'THORNBOUND IDOL', 'EMBER VESSEL', 'FROSTWORN SIGIL',
    'HOLLOW CROWN', 'TIDEBORN EYE', 'GRAVESONG TOKEN', 'STORMGLASS CORE', 'WOLF-KING TOTEM', 'DAWN SHARD',
    "NIGHTWARDEN'S MARK", 'ROOTS OF YSRA', 'SHATTERED HOUR', 'SABLE COMPASS', 'WRAITHBONE CHARM', 'SUNKEN STAR',
    'IRON OATH RELIC', 'GLOAMING LENS', "SERPENT'S MEMORY", 'SKYFIRE EMBER', "WINTER'S LAST BREATH", 'DUSKWARDEN SEAL',
    'BLOODMOON IDOL', 'WHISPERING FANG', 'ANCIENT WAYSTONE', "RAVEN QUEEN'S EYE", "FALLEN SAINT'S VOW", 'DEEPWATER PEARL',
    'CINDERHEART', 'PALE ORACLE', 'THUNDERBIRD FEATHER', 'OBSIDIAN TEAR', 'ETERNAL ASH', 'WILDHUNT HORN',
    'SILENT BELL', 'STARLESS MIRROR', "DRAGON'S REMNANT", 'AETHER SEED', "KINGDOM'S LAST LIGHT", 'WORLDROOT KNOT',
];

export const ARTIFACT_NAMES: string[] = [
    'AEGIS OF THE FIRST DAWN', 'CROWN OF ASHES', 'LANTERN OF LOST KINGS', 'CHRONICLE OF ECHOES', 'ASTRAL NAVIGATOR', 'HEART OF THE DEEP',
    'SUNSPIRE DIADEM', 'NIGHTGLASS PRISM', 'TOME OF THE VEILED PATH', 'CITADEL ENGINE', 'PHOENIX VESSEL', 'ORRERY OF AGES',
    'MANTLE OF THE FIRST WARDEN', 'SOULFORGE RELIQUARY', 'STARFALL SCEPTER', "GATEKEEPER'S KEY", 'TEMPEST CATALYST', 'EVERFROST MIRROR',
    'GARDEN OF WORLDS', 'OBELISK OF OATHS', 'DRAGONFIRE LENS', "VOIDWALKER'S COMPASS", 'HALLOWED HOURGLASS', 'EMBERTHRONE SEAL',
    'MOONWEAVER LOOM', 'THRONE OF TIDES', 'GRIMOIRE OF THE NINE', 'SKYBOUND STANDARD', "DREAD EMPEROR'S MASK", 'LIFEBLOOM CHALICE',
    "WORLD'S EDGE SHARD", 'PRISM OF MANY SUNS', 'SOUL ANCHOR', "WINDCALLER'S HARP", 'INFINITE COFFER', "ARCHON'S SIGIL",
    'VEILBREAKER TORCH', "FATE-SPINNER'S WHEEL", 'DAWNBRINGER RELIQUARY', 'ECLIPSE ENGINE', 'CROWN OF THE LAST STAR', 'AETHERION CORE',
];

/** Effect family is fixed by catalog position (cycling HP, AC, SAVE, ABILITY, HIT, INITIATIVE). */
export const wondrousEffect = (index: number): WondrousEffect => WONDROUS_EFFECTS[index % WONDROUS_EFFECTS.length];

export const wondrousBaseMods = (effect: WondrousEffect, itemLevel: number): StatMods => {
    const scale = 1 + Math.floor(itemLevel / 10);
    switch (effect) {
        case 'HP': return { hp: 4 * scale };
        case 'AC': return { acb: scale };
        case 'SAVE': return { saves: 2 * scale };
        case 'ABILITY': return { dmg: 2 * scale };
        case 'HIT': return { hit: scale };
        case 'INITIATIVE': return { haste: scale, dodge: Math.ceil(scale / 2) };
    }
};

/** Enhancement data attached to Dragon Warrior's weapon, armor or shield. */
export interface GearEnhancement {
    quality: Quality;
    itemLevel: number;
    affixes: StatMods;
    gems: Sockets;
    runes: Sockets;
    durability: number;
    maxDurability: number;
    setId?: string;
    /** Display name override, e.g. a named set piece. */
    name?: string;
    /** Forging potential left (set the first time the item is forged). */
    potential?: number;
    /** Upgrade level +0 to +15. */
    upgrade?: number;
}

/** A standalone piece of gear (artifact, relic, or a set piece / loot in the bag). */
export interface GearInstance extends GearEnhancement {
    id: string;
    slot: EquipSlot;
    /** Catalog index for artifacts/relics. */
    catalogIndex?: number;
}

/**
 * Rolls a rarity grade. Magic find and the world tier (1-9) shift the odds upward;
 * higher world tiers also remove the lowest grades.
 */
export const rollQuality = (rng: Rng, magicFind = 0, worldTier = 1): Quality => {
    const mf = (1 + magicFind / 100) * (1 + (worldTier - 1) * 0.35);
    const weights: [Quality, number][] = [
        [ 'Poor', worldTier >= 3 ? 0 : 18 ], [ 'Common', worldTier >= 6 ? 0 : 40 ], [ 'Uncommon', 25 * mf ], [ 'Rare', 11 * mf ],
        [ 'Epic', 4.5 * mf ], [ 'Legendary', 1.3 * mf ], [ 'Mythic', 0.35 * mf ], [ 'Exalted', 0.1 * mf ], [ 'Divine', 0.02 * mf ],
    ];
    const total = weights.reduce((s, [ , w ]) => s + w, 0);
    let r = rng() * total;
    for (const [ q, w ] of weights) {
        r -= w;
        if (r < 0) {
            return q;
        }
    }
    return 'Common';
};

export const rollGearAffixes = (rng: Rng, quality: Quality, itemLevel: number): StatMods => {
    const count = AFFIX_COUNT[quality];
    const pool = AFFIX_POOL.slice();
    const mods: StatMods = {};
    for (let i = 0; i < count && pool.length; i++) {
        const index = Math.floor(rng() * pool.length);
        const affix = pool.splice(index, 1)[0];
        const base = Math.max(affix.min, Math.round(affix.perLevel * itemLevel));
        mods[affix.key] = rollInt(rng, Math.max(1, Math.ceil(base * 0.7)), Math.max(1, base));
    }
    return mods;
};

export const createEnhancement = (rng: Rng, itemLevel: number, quality?: Quality, magicFind = 0, worldTier = 1): GearEnhancement => {
    const q = quality ?? rollQuality(rng, magicFind, worldTier);
    const maxDurability = 40 + QUALITIES.indexOf(q) * 10;
    return {
        quality: q,
        itemLevel,
        affixes: rollGearAffixes(rng, q, itemLevel),
        gems: emptySockets('gem', itemLevel),
        runes: emptySockets('rune', itemLevel),
        durability: maxDurability,
        maxDurability,
    };
};

let gearCounter = 0;

export const createGearInstance = (rng: Rng, slot: EquipSlot, itemLevel: number, opts: {
    quality?: Quality; magicFind?: number; catalogIndex?: number; setId?: string; name?: string;
    worldTier?: number; baseMods?: StatMods;
} = {}): GearInstance => {
    const enh = createEnhancement(rng, itemLevel, opts.quality, opts.magicFind, opts.worldTier);
    if (opts.baseMods) {
        enh.affixes = addMods(opts.baseMods, enh.affixes);
    }
    let catalogIndex = opts.catalogIndex;
    if (catalogIndex === undefined && (slot === 'artifact' || slot === 'relic')) {
        catalogIndex = Math.floor(rng() * 42);
    }
    gearCounter++;
    return {
        ...enh,
        id: `g${Date.now().toString(36)}${gearCounter.toString(36)}${Math.floor(rng() * 1e6).toString(36)}`,
        slot,
        catalogIndex,
        setId: opts.setId,
        name: opts.name,
    };
};

/** Creates one piece of a legendary set. */
export const createSetPiece = (rng: Rng, setId: string, pieceIndex: number, itemLevel: number): GearInstance | undefined => {
    const set = getSet(setId);
    const piece = set?.pieces[pieceIndex];
    if (!set || !piece) {
        return undefined;
    }
    return createGearInstance(rng, piece.slot, itemLevel, { quality: 'Legendary', setId, name: piece.name });
};

export const gearDisplayName = (gear: GearInstance | GearEnhancement & { slot?: EquipSlot; catalogIndex?: number }, baseName = ''): string => {
    const name = baseGearName(gear, baseName);
    return gear.upgrade ? `${name} +${gear.upgrade}` : name;
};

const baseGearName = (gear: GearInstance | GearEnhancement & { slot?: EquipSlot; catalogIndex?: number }, baseName: string): string => {
    if (gear.name) {
        return gear.name;
    }
    if (gear.slot === 'artifact' && gear.catalogIndex !== undefined) {
        return ARTIFACT_NAMES[gear.catalogIndex];
    }
    if (gear.slot === 'relic' && gear.catalogIndex !== undefined) {
        return RELIC_NAMES[gear.catalogIndex];
    }
    return baseName;
};

export const isBroken = (gear: GearEnhancement): boolean => gear.durability <= 0;

/** Stats from one piece: affixes + sockets + artifact/relic base. Broken gear gives nothing. */
export const gearMods = (gear: GearEnhancement & { slot?: EquipSlot; catalogIndex?: number }): StatMods => {
    if (isBroken(gear)) {
        return {};
    }
    let base: StatMods | undefined;
    if ((gear.slot === 'artifact' || gear.slot === 'relic') && gear.catalogIndex !== undefined) {
        base = wondrousBaseMods(wondrousEffect(gear.catalogIndex), gear.itemLevel);
    }
    return addMods(base, gear.affixes, socketsMods(gear.gems), socketsMods(gear.runes), upgradeMods(gear.slot, gear.upgrade ?? 0));
};

export interface SetBonusInfo {
    set: LegendarySet;
    pieces: number;
    mods: StatMods;
}

export const setBonuses = (equipped: (GearEnhancement | undefined)[]): SetBonusInfo[] => {
    const counts = new Map<string, number>();
    for (const g of equipped) {
        if (g?.setId && !isBroken(g)) {
            counts.set(g.setId, (counts.get(g.setId) ?? 0) + 1);
        }
    }
    const result: SetBonusInfo[] = [];
    counts.forEach((pieces, id) => {
        const set = getSet(id);
        if (set && pieces >= 2) {
            result.push({ set, pieces, mods: pieces >= 3 ? addMods(set.two, set.three) : set.two });
        }
    });
    return result;
};

export const aggregateEquipmentStats = (equipped: (GearEnhancement | undefined)[]): StatMods => {
    const pieces = equipped.filter((g): g is GearEnhancement => !!g);
    return addMods(...pieces.map(gearMods), ...setBonuses(pieces).map((s) => s.mods));
};

const SCORE_WEIGHTS: Partial<Record<SubstatKey, number>> = {
    hit: 3, acb: 3, hp: 0.5, dmg: 1.5, resist: 2, crit: 2, critdmg: 0.5, dodge: 2, block: 1.5,
    leech: 3, haste: 1.5, thorns: 0.5, gf: 0.3, xp: 0.5, mf: 0.3, saves: 1, fire: 0.8,
    cold: 0.8, lightning: 0.8, necrotic: 0.8, radiant: 0.8,
};

export const gearScore = (gear: GearEnhancement): number => {
    const mods = gearMods(gear);
    return Math.round((Object.keys(mods) as SubstatKey[])
        .reduce((s, key) => s + (mods[key] ?? 0) * (SCORE_WEIGHTS[key] ?? 1), 0));
};

export const compareGear = (current: GearEnhancement | undefined, candidate: GearEnhancement) => {
    const delta = gearScore(candidate) - (current ? gearScore(current) : 0);
    return { delta, upgrade: delta > 0 };
};

/** Value in gold, reduced by missing durability. */
export const calculateGearValue = (gear: GearEnhancement): number => {
    const qualityMult = 1 + QUALITIES.indexOf(gear.quality) * 0.75;
    const base = (10 + gear.itemLevel * 4 + gearScore(gear) * 3) * qualityMult;
    const durability = gear.maxDurability > 0 ? 0.4 + 0.6 * gear.durability / gear.maxDurability : 1;
    return Math.max(1, Math.round(base * durability));
};

/** Vendors buy at a quarter of value, adjusted for demand (1 = normal). */
export const quoteVendorPrice = (gear: GearEnhancement, mode: 'buy' | 'sell', markup = 0.25, demand = 1): number => {
    const value = calculateGearValue(gear);
    return mode === 'sell' ? Math.max(1, Math.floor(value * 0.25 * demand)) : Math.ceil(value * (1 + markup) * demand);
};

/** Wears gear by one point; returns true if this broke it. */
export const wearGear = (gear: GearEnhancement, rng: Rng, chancePerHit = 0.1): boolean => {
    if (gear.durability > 0 && chance(rng, chancePerHit)) {
        gear.durability--;
        return gear.durability === 0;
    }
    return false;
};

export const repairCost = (gear: GearEnhancement): number =>
    Math.ceil((gear.maxDurability - gear.durability) * (1 + gear.itemLevel / 10));

export const randomSlot = (rng: Rng): EquipSlot => pick(rng, EQUIP_SLOTS);
