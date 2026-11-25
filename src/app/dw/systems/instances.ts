/**
 * Dungeons, raids, trials and towers (docs/INSTANCES.md), plus the world tier 1-9.
 *
 * An instance run is a chain of battles that ends with a boss from the matching boss
 * category. Raids have a weekly lockout after a clear. World tiers raise enemy strength
 * and loot rarity.
 */
import { BOSSES, BossCategory, BossDef } from './bosses';
import { hashString, pick, seededRng } from './rng';
import { COUNTRIES } from './world';
import { weekKey } from './seasons';

export type InstanceKind = 'dungeon' | 'raid' | 'trial' | 'tower';

export interface InstanceDef {
    id: string;
    name: string;
    kind: InstanceKind;
    country: string;
    /** Level on the 1-720 content scale. */
    level: number;
    /** Number of ordinary fights before the boss (tower: floors). */
    stages: number;
    bossCategory: BossCategory;
}

export const INSTANCE_COUNTS: Record<InstanceKind, number> = { dungeon: 104, raid: 35, trial: 16, tower: 18 };

const STAGES: Record<InstanceKind, number> = { dungeon: 3, raid: 5, trial: 0, tower: 6 };
const BOSS_CATEGORY: Record<InstanceKind, BossCategory> = { dungeon: 'dungeon', raid: 'raid', trial: 'trial', tower: 'tower' };

const NAME_A = [ 'Sunken', 'Burning', 'Frozen', 'Howling', 'Forsaken', 'Gilded', 'Shattered', 'Black', 'Crimson', 'Silent',
    'Hollow', 'Iron', 'Starlit', 'Withered', 'Drowned', 'Thundering' ];
const NAME_B: Record<InstanceKind, string[]> = {
    dungeon: [ 'Crypt', 'Catacombs', 'Halls', 'Depths', 'Warrens', 'Sanctum', 'Mines', 'Barrow' ],
    raid: [ 'Citadel', 'Throne', 'Fortress', 'Spire', 'Necropolis', 'Bastion' ],
    trial: [ 'Arena', 'Crucible', 'Proving Ground', 'Gauntlet' ],
    tower: [ 'Tower', 'Spire', 'Obelisk', 'Pinnacle' ],
};

const buildInstances = (): InstanceDef[] => {
    const list: InstanceDef[] = [];
    for (const kind of Object.keys(INSTANCE_COUNTS) as InstanceKind[]) {
        const rng = seededRng(hashString(`instances:${kind}`));
        const count = INSTANCE_COUNTS[kind];
        const used = new Set<string>();
        for (let i = 0; i < count; i++) {
            let name = '';
            for (let t = 0; t < 40 && (!name || used.has(name)); t++) {
                name = `${pick(rng, NAME_A)} ${pick(rng, NAME_B[kind])}`.toUpperCase();
            }
            if (used.has(name)) {
                name = `${name} ${i + 1}`;
            }
            used.add(name);
            const minLevel = kind === 'raid' ? 40 : kind === 'trial' ? 20 : kind === 'tower' ? 30 : 4;
            const level = Math.round(minLevel + (720 - minLevel) * (i / Math.max(1, count - 1)) ** 1.2);
            list.push({
                id: `${kind}_${i}`, name, kind,
                country: COUNTRIES[Math.min(COUNTRIES.length - 1, Math.floor(i / count * COUNTRIES.length))].id,
                level,
                stages: kind === 'tower' ? STAGES.tower + Math.floor(i / 3) : STAGES[kind],
                bossCategory: BOSS_CATEGORY[kind],
            });
        }
    }
    return list;
};

export const INSTANCES: InstanceDef[] = buildInstances();

export const getInstance = (id: string): InstanceDef | undefined => INSTANCES.find((i) => i.id === id);

/** Classic hero level (1-30, paragon beyond) to the 720 content scale. */
export const heroContentLevel = (heroLevel: number): number => Math.min(720, heroLevel <= 30 ? heroLevel * 4 : 120 + (heroLevel - 30) * 0.87);

/** Instances open to a hero: level within reach. */
export const availableInstances = (kind: InstanceKind, heroLevel: number): InstanceDef[] => {
    const reach = heroContentLevel(heroLevel) + 20;
    return INSTANCES.filter((i) => i.kind === kind && i.level <= reach);
};

/** Ordinary enemies, roughly weakest to strongest, used to populate instance fights. */
export const INSTANCE_ENEMIES = [ 'Slime', 'RedSlime', 'Drakee', 'Ghost', 'Magician', 'Magidrakee', 'Scorpion', 'Druin',
    'Poltergeist', 'Droll', 'Drakeema', 'Skeleton', 'Warlock', 'Metal Scorpion', 'Wolf', 'Wraith', 'Specter', 'Wolflord',
    'Druinlord', 'Drollmagi', 'Wyvern', 'RogueScorpion', 'WraithKnight', 'Knight', 'Magiwyvern', 'DemonKnight', 'Werewolf',
    'Starwyvern', 'Wizard', 'BlueDragon', 'Stoneman', 'ArmoredKnight', 'RedDragon' ];

/** The enemy for a stage; later stages and higher instances use stronger foes. */
export const stageEnemy = (instance: InstanceDef, stage: number): string => {
    const base = Math.floor(instance.level / 720 * (INSTANCE_ENEMIES.length - 4));
    const index = Math.min(INSTANCE_ENEMIES.length - 1, base + Math.floor(stage / 2));
    return INSTANCE_ENEMIES[index];
};

/** The final boss of an instance, from the matching category, nearest in level. */
export const instanceBoss = (instance: InstanceDef): BossDef => {
    const candidates = BOSSES.filter((b) => b.category === instance.bossCategory && !b.fixed);
    const rng = seededRng(hashString(instance.id));
    const sorted = candidates.slice().sort((a, b) => Math.abs(a.level - instance.level) - Math.abs(b.level - instance.level));
    return sorted[Math.floor(rng() * Math.min(3, sorted.length))];
};

export interface InstanceRun {
    instanceId: string;
    stage: number;
}

export interface InstanceRecord {
    clears: number;
    best?: number;
    lastClear?: string;
}

/** A raid cleared this week is locked until next week. */
export const isLockedOut = (lockouts: Record<string, string>, instance: InstanceDef, date = new Date()): boolean =>
    instance.kind === 'raid' && lockouts[instance.id] === weekKey(date);

/** First-clear chest gold for an instance. */
export const instanceClearGold = (instance: InstanceDef): number => {
    const mult: Record<InstanceKind, number> = { dungeon: 1, raid: 4, trial: 2, tower: 2.5 };
    return Math.round((200 + instance.level * 8) * mult[instance.kind]);
};

// ---------------------------------------------------------------------------
// World tier 1-9

export const MAX_WORLD_TIER = 9;

/** Hero level needed for each world tier: 1, 5, 9, ... 33. */
export const worldTierUnlockLevel = (tier: number): number => tier <= 1 ? 1 : 1 + (tier - 1) * 4;

export const WORLD_TIER_NAMES = [ 'NORMAL', 'HARD', 'VETERAN', 'EXPERT', 'MASTER', 'NIGHTMARE', 'HELL', 'TORMENT', 'APOCALYPSE' ];

export interface WorldTierScaling {
    hpMult: number;
    strMult: number;
    rewardMult: number;
}

export const worldTierScaling = (tier: number): WorldTierScaling => {
    const t = Math.max(1, Math.min(MAX_WORLD_TIER, tier)) - 1;
    return { hpMult: 1 + t * 0.3, strMult: 1 + t * 0.15, rewardMult: 1 + t * 0.2 };
};
