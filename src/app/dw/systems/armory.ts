/**
 * Weapon and armor progression: +1 to +15 upgrades, weapon-type mastery, and the
 * town armory's stock of tiered gear.
 */
import { ARMOR_CLASSES, GEAR_TIERS, SHIELD_TYPES, WEAPON_TYPES, gearTierFor, scaleTypeMods } from './characters';
import { Rng, chance } from './rng';
import { StatMods } from './stats';

// ---------------------------------------------------------------------------
// Upgrades

export const MAX_UPGRADE = 15;

/** Chance that upgrading from +level to +level+1 succeeds. */
export const upgradeChance = (level: number): number => {
    if (level < 5) {
        return 1;
    }
    if (level < 10) {
        return 0.85 - (level - 5) * 0.08;
    }
    return Math.max(0.12, 0.4 - (level - 10) * 0.06);
};

/** Gold and shard cost of the next upgrade. */
export const upgradeCost = (level: number, itemLevel: number): { gold: number; shards: number } => ({
    gold: Math.round((50 + itemLevel * 3) * (level + 1) ** 1.6),
    shards: level < 5 ? 0 : (level - 4) * 5,
});

export type UpgradeSlot = 'weapon' | 'armor' | 'shield';

/** Bonus modifiers from an item's upgrade level. */
export const upgradeMods = (slot: string | undefined, level: number): StatMods => {
    if (!level) {
        return {};
    }
    switch (slot) {
        case 'weapon': return { hit: Math.ceil(level / 2), dmg: level * 3 };
        case 'armor': return { acb: Math.ceil(level / 2), hp: level * 5 };
        case 'shield': return { block: level, acb: Math.floor(level / 3) };
        default: return { hp: level * 3 };
    }
};

export interface UpgradeResult {
    outcome: 'success' | 'fail' | 'downgrade';
    level: number;
}

/**
 * Attempts an upgrade. Failure above +7 drops a level; the item is never destroyed.
 */
export const attemptUpgrade = (rng: Rng, level: number): UpgradeResult => {
    if (chance(rng, upgradeChance(level))) {
        return { outcome: 'success', level: level + 1 };
    }
    if (level > 7) {
        return { outcome: 'downgrade', level: level - 1 };
    }
    return { outcome: 'fail', level };
};

// ---------------------------------------------------------------------------
// Weapon mastery

/** Weapon type for each classic weapon. */
export const CLASSIC_WEAPON_TYPES: Record<string, string> = {
    bambooPole: 'spear', club: 'mace', copperSword: 'sword', handAxe: 'axe', broadSword: 'sword',
    flameSword: 'sword', erdricksSword: 'sword',
};

/** Weapon type of whatever is equipped: a named weapon from the bag, or a classic weapon. */
export const weaponTypeOf = (classicName: string | undefined, gearName: string | undefined): string => {
    const lower = (gearName ?? '').toLowerCase();
    const named = WEAPON_TYPES.find((w) => lower.includes(w.name.toLowerCase()));
    if (named) {
        return named.id;
    }
    return classicName ? CLASSIC_WEAPON_TYPES[classicName] ?? 'sword' : 'unarmed';
};

/** Kills needed for each mastery rank (1-10). */
export const MASTERY_THRESHOLDS = [ 10, 30, 60, 100, 160, 250, 400, 600, 900, 1300 ];

export const masteryRank = (kills: number): number => MASTERY_THRESHOLDS.filter((t) => kills >= t).length;

export const masteryMods = (rank: number): StatMods =>
    rank ? { crit: Math.ceil(rank / 2), dmg: rank * 2, hit: Math.floor(rank / 3) } : {};

// ---------------------------------------------------------------------------
// Armory stock

export interface ArmoryItem {
    name: string;
    slot: UpgradeSlot;
    tier: number;
    mods: StatMods;
    price: number;
}

/** What a town armory sells: every weapon, armor and shield type at the hero's tier. */
export const armoryStock = (contentLevel: number): ArmoryItem[] => {
    const tier = gearTierFor(contentLevel);
    const tierName = GEAR_TIERS[tier];
    const price = Math.round(80 * (tier + 1) ** 1.8);
    const title = (s: string) => s.charAt(0) + s.substring(1).toLowerCase();
    return [
        ...WEAPON_TYPES.map((w) => ({ name: `${tierName} ${title(w.name)}`, slot: 'weapon' as const, tier, mods: scaleTypeMods(w.mods, tier), price })),
        ...ARMOR_CLASSES.map((a) => ({ name: `${tierName} ${a.subtypes[0]}`, slot: 'armor' as const, tier, mods: scaleTypeMods(a.mods, tier), price: Math.round(price * 1.2) })),
        ...SHIELD_TYPES.map((s) => ({ name: `${tierName} ${title(s.name)}`, slot: 'shield' as const, tier, mods: scaleTypeMods(s.mods, tier), price: Math.round(price * 0.8) })),
    ];
};
