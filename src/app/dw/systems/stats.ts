/**
 * Substats contributed by gear, gems, runes, sets, buffs, jobs, races, companions and
 * paragon mastery. See docs/COMBAT_EFFECTS.md.
 *
 * How each key maps onto Dragon Warrior's combat:
 * - hit: flat attack power      - acb: flat defense power   - hp: flat max HP
 * - dmg: % damage dealt         - resist: % damage taken reduction
 * - crit: % chance of an excellent move  - critdmg: % extra damage on an excellent move
 * - dodge: % chance to dodge an enemy attack  - block: % chance to halve an enemy hit
 * - leech: % of damage dealt healed  - haste: % chance of a second attack
 * - thorns: flat damage dealt back to attackers
 * - mf / gf / xp: % magic find / gold find / experience bonus
 * - heal: % more healing received  - saves: % chance to resist enemy spells
 * - fire / cold / lightning / necrotic / radiant: % bonus elemental damage (added to dmg)
 */
export const SUBSTAT_KEYS = [
    'hit', 'acb', 'hp', 'mp', 'dmg', 'resist', 'crit', 'critdmg', 'dodge', 'block',
    'leech', 'haste', 'thorns', 'mf', 'gf', 'xp', 'heal', 'saves',
    'fire', 'cold', 'lightning', 'necrotic', 'radiant',
] as const;

export type SubstatKey = typeof SUBSTAT_KEYS[number];

export type StatMods = Partial<Record<SubstatKey, number>>;

export interface SubstatInfo {
    name: string;
    unit: '%' | 'flat';
    cap: number;
}

export const SUBSTATS: Record<SubstatKey, SubstatInfo> = {
    hit: { name: 'ACCURACY', unit: 'flat', cap: 30 },
    acb: { name: 'ARMOUR', unit: 'flat', cap: 30 },
    hp: { name: 'MAX HP', unit: 'flat', cap: 99999 },
    mp: { name: 'MAX MP', unit: 'flat', cap: 9999 },
    dmg: { name: 'DAMAGE', unit: '%', cap: 500 },
    resist: { name: 'RESIST ALL', unit: '%', cap: 60 },
    crit: { name: 'CRIT CHANCE', unit: '%', cap: 50 },
    critdmg: { name: 'CRIT DAMAGE', unit: '%', cap: 300 },
    dodge: { name: 'DODGE', unit: '%', cap: 40 },
    block: { name: 'BLOCK', unit: '%', cap: 40 },
    leech: { name: 'LIFESTEAL', unit: '%', cap: 20 },
    haste: { name: 'HASTE', unit: '%', cap: 50 },
    thorns: { name: 'THORNS', unit: 'flat', cap: 9999 },
    mf: { name: 'MAGIC FIND', unit: '%', cap: 400 },
    gf: { name: 'GOLD FIND', unit: '%', cap: 400 },
    xp: { name: 'XP BONUS', unit: '%', cap: 200 },
    heal: { name: 'HEALING', unit: '%', cap: 200 },
    saves: { name: 'SAVES', unit: '%', cap: 50 },
    fire: { name: 'FIRE DMG', unit: '%', cap: 300 },
    cold: { name: 'COLD DMG', unit: '%', cap: 300 },
    lightning: { name: 'SHOCK DMG', unit: '%', cap: 300 },
    necrotic: { name: 'SHADOW DMG', unit: '%', cap: 300 },
    radiant: { name: 'HOLY DMG', unit: '%', cap: 300 },
};

/** Temporary combat effects may push these keys past their gear cap, up to these values. */
export const COMBAT_CAPS: StatMods = { crit: 75, dodge: 60, haste: 75, resist: 75 };

/**
 * Adds any number of modifier sets together into a new object.
 */
export const addMods = (...mods: (StatMods | undefined)[]): StatMods => {
    const result: StatMods = {};
    for (const m of mods) {
        if (!m) {
            continue;
        }
        for (const key of Object.keys(m) as SubstatKey[]) {
            const value = m[key] ?? 0;
            if (value !== 0) {
                result[key] = (result[key] ?? 0) + value;
            }
        }
    }
    return result;
};

/** Multiplies every value in a modifier set. */
export const scaleMods = (mods: StatMods, factor: number): StatMods => {
    const result: StatMods = {};
    for (const key of Object.keys(mods) as SubstatKey[]) {
        result[key] = (mods[key] ?? 0) * factor;
    }
    return result;
};

/**
 * Clamps each value to its gear cap (or combat cap when <code>combat</code> is true).
 */
export const capMods = (mods: StatMods, combat = false): StatMods => {
    const result: StatMods = {};
    for (const key of Object.keys(mods) as SubstatKey[]) {
        const cap = combat ? COMBAT_CAPS[key] ?? SUBSTATS[key].cap : SUBSTATS[key].cap;
        result[key] = Math.min(mods[key] ?? 0, cap);
    }
    return result;
};

export const getMod = (mods: StatMods, key: SubstatKey): number => mods[key] ?? 0;

/** Total elemental bonus, which is folded into damage dealt. */
export const elementalBonus = (mods: StatMods): number =>
    getMod(mods, 'fire') + getMod(mods, 'cold') + getMod(mods, 'lightning') +
    getMod(mods, 'necrotic') + getMod(mods, 'radiant');

/** A short human readable string such as "+3 ACCURACY, +5% DAMAGE". */
export const describeMods = (mods: StatMods): string => {
    return (Object.keys(mods) as SubstatKey[])
        .filter((key) => (mods[key] ?? 0) !== 0)
        .map((key) => {
            const info = SUBSTATS[key];
            const value = Math.round((mods[key] ?? 0) * 10) / 10;
            return `+${value}${info.unit === '%' ? '%' : ''} ${info.name}`;
        })
        .join(', ');
};
