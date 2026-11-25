/**
 * Loot crafting in the style of modern action RPGs (original rules):
 * - SALVAGE gear into shards (more shards for higher rarity).
 * - ASPECTS: salvaging a Legendary-or-better item extracts its strongest affix as an
 *   aspect into the codex; aspects can be IMPRINTED onto other gear for shards.
 * - FORGING POTENTIAL: every item has a limited potential; crafting a new affix or
 *   upgrading one spends some (with a random cost), so items can't be perfected forever.
 */
import { GearEnhancement, QUALITIES, gearMods, rarityGrade } from './gear';
import { Rng, rollInt } from './rng';
import { SubstatKey, describeMods } from './stats';

/** Shards earned for salvaging, by rarity grade. */
export const salvageShards = (gear: GearEnhancement): number => {
    const grade = rarityGrade(gear.quality);
    return grade * grade + Math.floor(gear.itemLevel / 20);
};

export interface Aspect {
    id: string;
    key: SubstatKey;
    value: number;
    name: string;
}

/** The strongest affix of an item becomes an aspect (Legendary or better only). */
export const extractAspect = (gear: GearEnhancement): Aspect | undefined => {
    if (rarityGrade(gear.quality) < QUALITIES.indexOf('Legendary') + 1) {
        return undefined;
    }
    const entries = Object.entries(gear.affixes) as [SubstatKey, number][];
    if (!entries.length) {
        return undefined;
    }
    const [ key, value ] = entries.sort((a, b) => b[1] - a[1])[0];
    return { id: `aspect_${key}_${value}`, key, value, name: `ASPECT OF ${describeMods({ [key]: value })}` };
};

export const IMPRINT_COST = 25;

/** Imprints an aspect onto an item, adding to (or replacing a weaker) affix. */
export const imprintAspect = (gear: GearEnhancement, aspect: Aspect): void => {
    gear.affixes[aspect.key] = Math.max(gear.affixes[aspect.key] ?? 0, aspect.value);
};

/** Starting forging potential by rarity grade: plain items have more room to grow. */
export const initialPotential = (gear: GearEnhancement): number => Math.max(6, 30 - rarityGrade(gear.quality) * 2);

export const FORGE_SHARD_COST = 10;

/** Affix keys the forge can add. */
export const FORGEABLE: SubstatKey[] = [ 'hit', 'acb', 'hp', 'dmg', 'resist', 'crit', 'dodge', 'leech', 'haste', 'gf', 'xp', 'mf' ];

/** Value added per forge step for each key. */
const FORGE_STEP: Partial<Record<SubstatKey, number>> = {
    hit: 1, acb: 1, hp: 6, dmg: 3, resist: 1, crit: 1, dodge: 1, leech: 1, haste: 1, gf: 5, xp: 3, mf: 5,
};

export interface ForgeResult {
    ok: boolean;
    message: string;
    spent: number;
}

/**
 * Adds or improves an affix. Spends 1-4 potential (random); fails when the item has none.
 * <code>potential</code> is tracked separately per item by the caller.
 */
export const forgeAffix = (rng: Rng, gear: GearEnhancement, potential: number, key: SubstatKey): ForgeResult => {
    if (potential <= 0) {
        return { ok: false, message: 'This item has no forging potential left.', spent: 0 };
    }
    const step = FORGE_STEP[key] ?? 1;
    const before = gear.affixes[key] ?? 0;
    gear.affixes[key] = before + step;
    const spent = Math.min(potential, rollInt(rng, 1, 4));
    return { ok: true, message: `${describeMods({ [key]: step })} forged. Potential -${spent}.`, spent };
};

export const describeGearShort = (gear: GearEnhancement): string => describeMods(gearMods(gear));
