/**
 * Boss catalog, progression journal, first-clear rewards and boss rune drops.
 * See docs/BOSS_PROGRESSION_AND_JOURNAL.md and docs/BOSS_LOOT_AND_LEGENDARY_SETS.md.
 *
 * The catalog has the game's own named bosses plus 350 generated bosses spread across
 * the world, dungeon, trial, tower, arc and raid categories. Generated bosses reuse an
 * existing monster's sprite with boosted stats, so they can be met in rare encounters.
 */
import { Rng, chance, hashString, pick, seededRng } from './rng';
import { GEM_FAMILIES, RUNE_FAMILIES, socketableId, tierForItemLevel } from './sockets';

export const BOSS_CATEGORIES = [ 'world', 'dungeon', 'trial', 'tower', 'arc', 'raid' ] as const;
export type BossCategory = typeof BOSS_CATEGORIES[number];

export interface BossDef {
    id: string;
    name: string;
    category: BossCategory;
    /** Level on the 1-720 scale. */
    level: number;
    /** Enemy data key whose sprite and base stats the boss uses. */
    baseEnemy: string;
    /** Multipliers applied to the base enemy. */
    hpMult: number;
    strMult: number;
    /** Fixed bosses from the original game are fought normally, not via rare encounters. */
    fixed?: boolean;
}

export const FIRST_CLEAR_SIGILS: Record<BossCategory, number> = {
    world: 1, dungeon: 2, trial: 2, tower: 2, arc: 4, raid: 6,
};

export const RUNE_DROP_CHANCE: Record<BossCategory, number> = {
    world: 0.40, dungeon: 0.50, trial: 0.60, tower: 0.65, arc: 0.75, raid: 0.85,
};

const RANKS: [string, number][] = [
    [ 'F', 40 ], [ 'E', 80 ], [ 'D', 120 ], [ 'C', 200 ], [ 'B', 300 ], [ 'A', 420 ], [ 'S', 540 ], [ 'SS', 640 ],
];

export const bossRank = (level: number): string => {
    for (const [ rank, max ] of RANKS) {
        if (level <= max) {
            return rank;
        }
    }
    return 'SSS';
};

export const firstClearGold = (level: number): number => Math.max(100, Math.round(500 + level * 25));

/** Game levels (1-30 classic) to the 720 boss scale and back. */
export const toBossScale = (heroLevel: number): number => Math.min(720, heroLevel <= 30 ? heroLevel * 4 : 120 + (heroLevel - 30) * 0.87);

const FIXED_BOSSES: BossDef[] = [
    { id: 'boss_golem', name: 'Golem', category: 'world', level: 40, baseEnemy: 'Golem', hpMult: 1, strMult: 1, fixed: true },
    { id: 'boss_axeknight', name: 'Axe Knight', category: 'dungeon', level: 72, baseEnemy: 'AxeKnight', hpMult: 1, strMult: 1, fixed: true },
    { id: 'boss_greendragon', name: 'Green Dragon', category: 'dungeon', level: 76, baseEnemy: 'GreenDragon', hpMult: 1, strMult: 1, fixed: true },
    { id: 'boss_dragonlord', name: 'Dragonlord', category: 'arc', level: 110, baseEnemy: 'Dragonlord', hpMult: 1, strMult: 1, fixed: true },
    { id: 'boss_dragonlord2', name: 'Dragonlord (True Form)', category: 'raid', level: 120, baseEnemy: 'DragonlordForm2', hpMult: 1, strMult: 1, fixed: true },
];

/** Enemy keys that are bosses in their own right. */
export const FIXED_BOSS_BY_ENEMY: Record<string, string> = Object.fromEntries(
    FIXED_BOSSES.map((b) => [ b.baseEnemy, b.id ]));

const PREFIXES = [ 'Ashen', 'Hollow', 'Grim', 'Storm', 'Frost', 'Ember', 'Iron', 'Pale', 'Dread', 'Sable',
    'Moon', 'Thorn', 'Gloom', 'Rune', 'Blood', 'Star', 'Deep', 'Wild', 'Bone', 'Sun' ];
const TITLES = [ 'Tyrant', 'Warden', 'Sovereign', 'Devourer', 'Herald', 'Reaver', 'Matriarch', 'Colossus',
    'Revenant', 'Overseer', 'Behemoth', 'Prophet', 'Executioner', 'Wyrm', 'Lord', 'Hierophant', 'Stalker' ];
/** Base enemies roughly ordered by strength, chosen by boss level. */
const BOSS_BASES = [ 'Slime', 'Drakee', 'Ghost', 'Magician', 'Scorpion', 'Droll', 'Skeleton', 'Warlock',
    'Wolf', 'Wraith', 'Wolflord', 'Wyvern', 'WraithKnight', 'Knight', 'DemonKnight', 'Werewolf',
    'Starwyvern', 'Wizard', 'BlueDragon', 'Stoneman', 'ArmoredKnight', 'RedDragon' ];

const CATEGORY_LEVEL_BANDS: Record<BossCategory, [number, number]> = {
    world: [ 4, 720 ], dungeon: [ 8, 700 ], trial: [ 30, 700 ], tower: [ 40, 720 ], arc: [ 60, 720 ], raid: [ 100, 720 ],
};

const CATEGORY_HP_MULT: Record<BossCategory, number> = {
    world: 4, dungeon: 3, trial: 3.5, tower: 3.5, arc: 5, raid: 7,
};

export const GENERATED_BOSS_COUNT = 350;

const generateBosses = (): BossDef[] => {
    const rng = seededRng(720350);
    const bosses: BossDef[] = [];
    const used = new Set<string>();
    for (let i = 0; i < GENERATED_BOSS_COUNT; i++) {
        const category = BOSS_CATEGORIES[i % BOSS_CATEGORIES.length];
        const [ min, max ] = CATEGORY_LEVEL_BANDS[category];
        const level = Math.round(min + (max - min) * (i / GENERATED_BOSS_COUNT) ** 1.4);
        let name: string;
        do {
            name = `${pick(rng, PREFIXES)} ${pick(rng, TITLES)}`;
        } while (used.has(name) && used.size < PREFIXES.length * TITLES.length);
        used.add(name);
        const baseIndex = Math.min(BOSS_BASES.length - 1, Math.floor(level / 720 * BOSS_BASES.length));
        bosses.push({
            id: `boss_${i}`,
            name,
            category,
            level,
            baseEnemy: BOSS_BASES[baseIndex],
            hpMult: CATEGORY_HP_MULT[category] * (1 + level / 360),
            strMult: 1.3 + level / 480,
        });
    }
    return bosses;
};

export const BOSSES: BossDef[] = [ ...FIXED_BOSSES, ...generateBosses() ];

export const getBoss = (id: string): BossDef | undefined => BOSSES.find((b) => b.id === id);

/**
 * Chooses a generated boss appropriate for a hero level, for a rare encounter.
 */
export const pickRareBoss = (rng: Rng, heroLevel: number): BossDef | undefined => {
    const target = toBossScale(heroLevel);
    const candidates = BOSSES.filter((b) => !b.fixed && b.level <= target + 12 && b.level >= target - 40);
    return candidates.length ? pick(rng, candidates) : BOSSES.find((b) => !b.fixed);
};

export interface BossClear {
    kills: number;
    firstClear: string;
    lastKill: string;
}

export interface BossProgress {
    clears: Record<string, BossClear>;
    named: Record<string, number>;
    sigils: number;
}

export const createBossProgress = (): BossProgress => ({ clears: {}, named: {}, sigils: 0 });

export interface BossVictoryResult {
    firstClear: boolean;
    gold: number;
    sigils: number;
    kills: number;
}

/**
 * Records a boss kill. First clears award gold and sigils exactly once.
 */
export const recordBossVictory = (progress: BossProgress, bossId: string, now = new Date()): BossVictoryResult => {
    const boss = getBoss(bossId);
    const timestamp = now.toISOString();
    const existing = progress.clears[bossId];
    if (existing) {
        existing.kills++;
        existing.lastKill = timestamp;
        return { firstClear: false, gold: 0, sigils: 0, kills: existing.kills };
    }
    progress.clears[bossId] = { kills: 1, firstClear: timestamp, lastKill: timestamp };
    const gold = boss ? firstClearGold(boss.level) : 0;
    const sigils = boss ? FIRST_CLEAR_SIGILS[boss.category] : 0;
    progress.sigils += sigils;
    return { firstClear: true, gold, sigils, kills: 1 };
};

export const bossCompletion = (progress: BossProgress) => {
    const cleared = Object.keys(progress.clears).filter((id) => getBoss(id)).length;
    return { cleared, total: BOSSES.length, percent: Math.floor(cleared / BOSSES.length * 100) };
};

/** Rune family pools themed by boss category; raids can award any family. */
const RUNE_POOLS: Record<BossCategory, string[]> = {
    world: [ 'storm', 'vigor', 'might' ],
    dungeon: [ 'shadow', 'leech', 'ward' ],
    trial: [ 'precision', 'might', 'flame' ],
    tower: [ 'frost', 'ward', 'precision' ],
    arc: [ 'flame', 'frost', 'storm', 'shadow' ],
    raid: RUNE_FAMILIES.map((f) => f.id),
};

/**
 * Rolls boss rune rewards: category chance, plus a 45% second rune for arc/raid bosses.
 */
export const rollBossRunes = (rng: Rng, boss: BossDef, magicFind = 0): string[] => {
    const runes: string[] = [];
    const mf = 1 + magicFind / 100;
    if (chance(rng, Math.min(0.98, RUNE_DROP_CHANCE[boss.category] * mf))) {
        const tier = tierForItemLevel(boss.level);
        runes.push(socketableId(pick(rng, RUNE_POOLS[boss.category]), tier));
        if ((boss.category === 'arc' || boss.category === 'raid') && chance(rng, 0.45)) {
            runes.push(socketableId(pick(rng, RUNE_POOLS[boss.category]), tier));
        }
    }
    return runes;
};

/** Bosses also drop a gem (always) for the forge. */
export const rollBossGem = (rng: Rng, boss: BossDef): string =>
    socketableId(pick(rng, GEM_FAMILIES).id, tierForItemLevel(boss.level));

/** Chance of a legendary set piece from a boss. */
export const SET_PIECE_CHANCE: Record<BossCategory, number> = {
    world: 0.08, dungeon: 0.12, trial: 0.15, tower: 0.15, arc: 0.25, raid: 0.4,
};

/** Stable pseudo-random per boss (e.g. which set it favours). */
export const bossSeed = (bossId: string): number => hashString(bossId);
