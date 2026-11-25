/**
 * Buffs, debuffs and conditions engine. See docs/COMBAT_EFFECTS.md. Effects live on a
 * combatant for a number of turns and contribute modifiers, per-turn ticks and flags
 * (lose turn, cannot cast, etc.).
 */
import { Rng, rollInt } from './rng';
import { StatMods, addMods, scaleMods } from './stats';

export type EffectKind = 'buff' | 'debuff' | 'condition';

export interface EffectTick {
    /** Heal this % of max HP each turn. */
    healPct?: number;
    /** Damage dice per stack each turn, e.g. [1, 6] for 1d6. */
    dice?: [number, number];
}

export interface EffectDef {
    id: string;
    name: string;
    kind: EffectKind;
    description: string;
    mods?: StatMods;
    /** % more damage taken. */
    takenPct?: number;
    tick?: EffectTick;
    maxStacks?: number;
    loseTurn?: boolean;
    cannotCast?: boolean;
    /** Ends when the bearer takes damage. */
    breaksOnDamage?: boolean;
    /** Attacks against the bearer always crit. */
    autoCritAgainst?: boolean;
    /** Damage absorbed before HP (barrier, beastshape). */
    absorbs?: boolean;
}

const def = (d: EffectDef): EffectDef => d;

export const EFFECTS: Record<string, EffectDef> = {
    // Buffs
    bless: def({ id: 'bless', name: 'BLESSED', kind: 'buff', description: '+5 accuracy, +10% saves.', mods: { hit: 5, saves: 10 } }),
    haste: def({ id: 'haste', name: 'HASTED', kind: 'buff', description: '+2 armour, +25% chance of an extra attack.', mods: { acb: 2, haste: 25 } }),
    regen: def({ id: 'regen', name: 'REGENERATING', kind: 'buff', description: 'Heals 6% of max HP each turn.', tick: { healPct: 6 } }),
    fortify: def({ id: 'fortify', name: 'FORTIFIED', kind: 'buff', description: '25% less damage taken.', mods: { resist: 25 } }),
    might: def({ id: 'might', name: 'MIGHTY', kind: 'buff', description: '+15% damage dealt.', mods: { dmg: 15 } }),
    fed: def({ id: 'fed', name: 'WELL FED', kind: 'buff', description: '+10% saves, +10 max HP.', mods: { saves: 10, hp: 10 } }),
    inspired: def({ id: 'inspired', name: 'INSPIRED', kind: 'buff', description: '+3 accuracy.', mods: { hit: 3 } }),
    rage: def({ id: 'rage', name: 'RAGING', kind: 'buff', description: '+20% damage, physical damage taken halved.', mods: { dmg: 20, resist: 50 } }),
    barrier: def({ id: 'barrier', name: 'BARRIER', kind: 'buff', description: 'A shield absorbs damage.', absorbs: true }),
    ac: def({ id: 'ac', name: 'WARDED', kind: 'buff', description: '+5 armour.', mods: { acb: 5 } }),
    mirror: def({ id: 'mirror', name: 'MIRRORED', kind: 'buff', description: 'Images may take hits in your place.', mods: { dodge: 30 } }),
    trueveil: def({ id: 'trueveil', name: 'VEILED', kind: 'buff', description: 'Attacks against you often miss.', mods: { dodge: 25, hit: 4 } }),
    foresight: def({ id: 'foresight', name: 'FORESIGHT', kind: 'buff', description: 'Dodge and saves improved.', mods: { dodge: 25, hit: 4, saves: 20 } }),
    frenzy: def({ id: 'frenzy', name: 'FRENZIED', kind: 'buff', description: '+10% haste and damage (stacks 3).', mods: { haste: 10, dmg: 10 }, maxStacks: 3 }),
    focus: def({ id: 'focus', name: 'FOCUSED', kind: 'buff', description: '+15% critical chance.', mods: { crit: 15 } }),
    thornskin: def({ id: 'thornskin', name: 'THORNSKIN', kind: 'buff', description: 'Attackers take 6 damage.', mods: { thorns: 6 } }),
    wildshape: def({ id: 'wildshape', name: 'BEASTSHAPE', kind: 'buff', description: 'A beast body soaks damage.', absorbs: true }),
    // Debuffs
    burning: def({ id: 'burning', name: 'BURNING', kind: 'debuff', description: '1d6 fire damage per stack each turn.', tick: { dice: [ 1, 6 ] }, maxStacks: 5 }),
    bleeding: def({ id: 'bleeding', name: 'BLEEDING', kind: 'debuff', description: '1d4 damage per stack each turn.', tick: { dice: [ 1, 4 ] }, maxStacks: 5 }),
    venom: def({ id: 'venom', name: 'ENVENOMED', kind: 'debuff', description: '1d6 poison damage per stack each turn.', tick: { dice: [ 1, 6 ] }, maxStacks: 5 }),
    frostbite: def({ id: 'frostbite', name: 'FROSTBITTEN', kind: 'debuff', description: '-1 armour, less haste (stacks 3).', mods: { acb: -1, haste: -25 }, maxStacks: 3 }),
    shocked: def({ id: 'shocked', name: 'SHOCKED', kind: 'debuff', description: '-10% dodge, 10% more damage taken.', mods: { dodge: -10 }, takenPct: 10 }),
    weakened: def({ id: 'weakened', name: 'WEAKENED', kind: 'debuff', description: '-25% damage dealt.', mods: { dmg: -25 } }),
    vulnerable: def({ id: 'vulnerable', name: 'VULNERABLE', kind: 'debuff', description: '25% more damage taken.', takenPct: 25 }),
    sundered: def({ id: 'sundered', name: 'SUNDERED', kind: 'debuff', description: '-2 armour (stacks 3).', mods: { acb: -2 }, maxStacks: 3 }),
    slowed: def({ id: 'slowed', name: 'SLOWED', kind: 'debuff', description: '-2 armour, half haste.', mods: { acb: -2, haste: -50 } }),
    doomed: def({ id: 'doomed', name: 'DOOMED', kind: 'debuff', description: '-2 accuracy, -10% saves.', mods: { hit: -2, saves: -10 } }),
    // Conditions
    poisoned: def({ id: 'poisoned', name: 'POISONED', kind: 'condition', description: 'Attacks are weaker.', mods: { dmg: -20 } }),
    frightened: def({ id: 'frightened', name: 'FRIGHTENED', kind: 'condition', description: 'Attacks are weaker.', mods: { dmg: -20 } }),
    blinded: def({ id: 'blinded', name: 'BLINDED', kind: 'condition', description: 'Attacks weaker, attacks against you stronger.', mods: { dmg: -20 }, takenPct: 20 }),
    stunned: def({ id: 'stunned', name: 'STUNNED', kind: 'condition', description: 'Lose your turns.', loseTurn: true, takenPct: 20 }),
    paralyzed: def({ id: 'paralyzed', name: 'PARALYZED', kind: 'condition', description: 'Lose your turns; every hit is critical.', loseTurn: true, autoCritAgainst: true }),
    asleep: def({ id: 'asleep', name: 'ASLEEP', kind: 'condition', description: 'Lose your turns until damaged.', loseTurn: true, breaksOnDamage: true, autoCritAgainst: true }),
    silenced: def({ id: 'silenced', name: 'SILENCED', kind: 'condition', description: 'Cannot cast spells.', cannotCast: true }),
    marked: def({ id: 'marked', name: 'MARKED', kind: 'condition', description: 'Takes 15% more damage.', takenPct: 15 }),
    cursed: def({ id: 'cursed', name: 'NO HEALING', kind: 'condition', description: 'Cannot be healed.', mods: { heal: -100 } }),
};

export interface ActiveEffect {
    id: string;
    turns: number;
    stacks: number;
    /** Remaining absorb pool for barrier-like effects. */
    pool?: number;
    /** Extra damage per tick from the applier's level. */
    bonus?: number;
}

export interface TickResult {
    damage: number;
    heal: number;
    expired: string[];
}

/**
 * Tracks the active effects on a single combatant.
 */
export class EffectSet {

    private readonly effects: ActiveEffect[] = [];

    apply(id: string, turns: number, opts: { stacks?: number; pool?: number; bonus?: number } = {}): ActiveEffect | undefined {
        const d = EFFECTS[id];
        if (!d) {
            return undefined;
        }
        const existing = this.effects.find((e) => e.id === id);
        const maxStacks = d.maxStacks ?? 1;
        if (existing) {
            existing.turns = Math.max(existing.turns, turns);
            existing.stacks = Math.min(maxStacks, existing.stacks + (opts.stacks ?? 1));
            if (opts.pool) {
                existing.pool = (existing.pool ?? 0) + opts.pool;
            }
            existing.bonus = Math.max(existing.bonus ?? 0, opts.bonus ?? 0);
            return existing;
        }
        const effect: ActiveEffect = {
            id, turns,
            stacks: Math.min(maxStacks, opts.stacks ?? 1),
            pool: opts.pool,
            bonus: opts.bonus,
        };
        this.effects.push(effect);
        return effect;
    }

    has(id: string): boolean {
        return this.effects.some((e) => e.id === id);
    }

    remove(id: string) {
        const index = this.effects.findIndex((e) => e.id === id);
        if (index > -1) {
            this.effects.splice(index, 1);
        }
    }

    clear() {
        this.effects.length = 0;
    }

    list(): readonly ActiveEffect[] {
        return this.effects;
    }

    /** Combined modifiers of every active effect, multiplied by stacks. */
    getMods(): StatMods {
        return addMods(...this.effects.map((e) => {
            const d = EFFECTS[e.id];
            return d.mods ? scaleMods(d.mods, e.stacks) : undefined;
        }));
    }

    /** Total % extra damage taken. */
    getTakenPct(): number {
        return this.effects.reduce((sum, e) => sum + (EFFECTS[e.id].takenPct ?? 0) * e.stacks, 0);
    }

    losesTurn(): boolean {
        return this.effects.some((e) => EFFECTS[e.id].loseTurn);
    }

    cannotCast(): boolean {
        return this.effects.some((e) => EFFECTS[e.id].cannotCast);
    }

    attacksAutoCrit(): boolean {
        return this.effects.some((e) => EFFECTS[e.id].autoCritAgainst);
    }

    /**
     * Runs absorb pools and break-on-damage effects for incoming damage.
     * Returns the damage that gets through to HP.
     */
    absorbDamage(damage: number): number {
        let remaining = damage;
        for (const e of this.effects) {
            if (EFFECTS[e.id].absorbs && (e.pool ?? 0) > 0 && remaining > 0) {
                const absorbed = Math.min(e.pool ?? 0, remaining);
                e.pool = (e.pool ?? 0) - absorbed;
                remaining -= absorbed;
            }
        }
        if (damage > 0) {
            for (let i = this.effects.length - 1; i >= 0; i--) {
                const e = this.effects[i];
                const d = EFFECTS[e.id];
                if (d.breaksOnDamage || d.absorbs && (e.pool ?? 0) <= 0) {
                    this.effects.splice(i, 1);
                }
            }
        }
        return remaining;
    }

    /**
     * Applies per-turn ticks and counts down durations.
     */
    tick(maxHp: number, rng: Rng): TickResult {
        const result: TickResult = { damage: 0, heal: 0, expired: [] };
        for (const e of this.effects) {
            const d = EFFECTS[e.id];
            if (d.tick?.healPct) {
                result.heal += Math.max(1, Math.floor(maxHp * d.tick.healPct / 100));
            }
            if (d.tick?.dice) {
                const [ count, sides ] = d.tick.dice;
                for (let s = 0; s < e.stacks; s++) {
                    for (let c = 0; c < count; c++) {
                        result.damage += rollInt(rng, 1, sides);
                    }
                    result.damage += e.bonus ?? 0;
                }
            }
            e.turns--;
        }
        for (let i = this.effects.length - 1; i >= 0; i--) {
            if (this.effects[i].turns <= 0) {
                result.expired.push(this.effects[i].id);
                this.effects.splice(i, 1);
            }
        }
        return result;
    }
}
