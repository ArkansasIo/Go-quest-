/**
 * Applies extended modifiers to the classic base damage formulas.
 */
import { Rng, chance } from './rng';
import { StatMods, elementalBonus, getMod } from './stats';

export interface HeroHitResult {
    damage: number;
    crit: boolean;
    /** A second strike from haste. */
    extraHit: boolean;
    healed: number;
}

/**
 * Hero attack: base damage (already includes accuracy as attack power) scaled by damage %
 * and elemental bonuses, with crits, haste second hits, enemy vulnerability, enemy armour
 * and lifesteal.
 *
 * @param base Damage from the classic formula.
 * @param mods Hero modifiers including combat effects.
 * @param takenPct Enemy's % extra damage taken.
 * @param armour Enemy's % damage reduction (monster jobs).
 * @param autoCrit Whether the enemy's condition makes every hit critical.
 * @param secondBase Classic damage for a possible second strike.
 */
export const heroHit = (rng: Rng, base: number, mods: StatMods, takenPct: number, armour: number,
    autoCrit = false, secondBase = base): HeroHitResult => {
    const scale = (dmg: number) => dmg * (1 + (getMod(mods, 'dmg') + elementalBonus(mods)) / 100) *
        (1 + takenPct / 100) * (1 - armour / 100);
    const crit = autoCrit || chance(rng, getMod(mods, 'crit') / 100);
    let damage = scale(base);
    if (crit) {
        damage = Math.max(damage * 1.5, 1) * (1 + getMod(mods, 'critdmg') / 100);
    }
    const extraHit = chance(rng, getMod(mods, 'haste') / 100);
    if (extraHit) {
        damage += scale(secondBase);
    }
    damage = Math.max(0, Math.round(damage));
    const healed = Math.floor(damage * getMod(mods, 'leech') / 100);
    return { damage, crit, extraHit, healed };
};

export interface IncomingResult {
    damage: number;
    dodged: boolean;
    blocked: boolean;
    thorns: number;
}

/**
 * Enemy attack against the hero: dodge, block (halves), resist and extra-taken modifiers.
 * Spells and breath can't be dodged or blocked but can be resisted by saves.
 */
export const incomingHit = (rng: Rng, base: number, mods: StatMods, takenPct: number, physical: boolean): IncomingResult => {
    if (physical && base > 0 && chance(rng, getMod(mods, 'dodge') / 100)) {
        return { damage: 0, dodged: true, blocked: false, thorns: 0 };
    }
    let damage = base * (1 - Math.min(75, getMod(mods, 'resist')) / 100) * (1 + takenPct / 100);
    if (!physical) {
        damage *= 1 - Math.min(50, getMod(mods, 'saves')) / 200;
    }
    const blocked = physical && chance(rng, getMod(mods, 'block') / 100);
    if (blocked) {
        damage /= 2;
    }
    return {
        damage: Math.max(0, Math.round(damage)),
        dodged: false,
        blocked,
        thorns: physical ? Math.round(getMod(mods, 'thorns')) : 0,
    };
};
