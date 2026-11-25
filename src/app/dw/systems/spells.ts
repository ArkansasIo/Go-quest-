/**
 * Battle spells by class (docs/CHARACTERS.md spell schools). Casting costs MP. Each class
 * learns spells at job levels; every hero also knows the classic HEAL and HURT.
 */

export type SpellSchool = 'AEGIS' | 'CALLING' | 'OMEN' | 'THRALL' | 'STORM' | 'VEIL' | 'GRAVE' | 'FLUX';

export interface BattleSpell {
    id: string;
    name: string;
    school: SpellSchool;
    mp: number;
    /** Damage dice: [count, sides, flat]. */
    damage?: [number, number, number];
    /** Heal dice: [count, sides, flat]. */
    heal?: [number, number, number];
    selfEffect?: { id: string; turns: number; pool?: number };
    enemyEffect?: { id: string; turns: number; stacks?: number };
}

const s = (id: string, name: string, school: SpellSchool, mp: number, rest: Partial<BattleSpell>): BattleSpell =>
    ({ id, name, school, mp, ...rest });

export const BATTLE_SPELLS: BattleSpell[] = [
    s('heal', 'HEAL', 'CALLING', 4, { heal: [ 1, 8, 10 ] }),
    s('hurt', 'HURT', 'STORM', 2, { damage: [ 1, 8, 5 ] }),
    s('emberdart', 'EMBERDART', 'STORM', 3, { damage: [ 1, 10, 4 ] }),
    s('rimetouch', 'RIMETOUCH', 'STORM', 3, { damage: [ 1, 8, 3 ], enemyEffect: { id: 'frostbite', turns: 2 } }),
    s('flamefan', 'FLAME FAN', 'STORM', 6, { damage: [ 3, 6, 2 ], enemyEffect: { id: 'burning', turns: 3 } }),
    s('thunder', 'THUNDER WAVE', 'STORM', 7, { damage: [ 2, 8, 4 ], enemyEffect: { id: 'shocked', turns: 2 } }),
    s('darts', 'MAGIC DARTS', 'STORM', 5, { damage: [ 3, 4, 3 ] }),
    s('mending', 'MENDING TOUCH', 'CALLING', 5, { heal: [ 1, 8, 12 ] }),
    s('greatheal', 'GREATER MEND', 'CALLING', 12, { heal: [ 4, 8, 20 ] }),
    s('blessing', 'BLESSING CHANT', 'THRALL', 4, { selfEffect: { id: 'bless', turns: 4 } }),
    s('drowse', 'DROWSE', 'THRALL', 5, { enemyEffect: { id: 'asleep', turns: 3 } }),
    s('stillness', 'STILLNESS', 'THRALL', 9, { enemyEffect: { id: 'paralyzed', turns: 2 } }),
    s('wardforce', 'WARD OF FORCE', 'AEGIS', 4, { selfEffect: { id: 'ac', turns: 3 } }),
    s('barrier', 'ARCANE BARRIER', 'AEGIS', 8, { selfEffect: { id: 'barrier', turns: 6, pool: 30 } }),
    s('omen', 'OMEN OF RUIN', 'OMEN', 5, { enemyEffect: { id: 'marked', turns: 4 } }),
    s('foresight', 'FORESIGHT', 'OMEN', 10, { selfEffect: { id: 'foresight', turns: 3 } }),
    s('mirror', 'MIRROR SELVES', 'VEIL', 6, { selfEffect: { id: 'mirror', turns: 4 } }),
    s('dread', 'WHISPERED DREAD', 'VEIL', 4, { enemyEffect: { id: 'frightened', turns: 3 } }),
    s('siphon', 'LIFE SIPHON', 'GRAVE', 7, { damage: [ 3, 6, 0 ], heal: [ 1, 6, 0 ] }),
    s('gravechill', 'GRAVECHILL', 'GRAVE', 3, { damage: [ 1, 8, 2 ], enemyEffect: { id: 'cursed', turns: 3 } }),
    s('haste', 'QUICKEN', 'FLUX', 8, { selfEffect: { id: 'haste', turns: 3 } }),
    s('ironbark', 'IRON BARK', 'FLUX', 6, { selfEffect: { id: 'fortify', turns: 4 } }),
    s('sunburst', 'SUNBURST', 'STORM', 10, { damage: [ 4, 8, 6 ], enemyEffect: { id: 'blinded', turns: 2 } }),
    s('meteor', 'METEOR', 'STORM', 18, { damage: [ 8, 8, 10 ], enemyEffect: { id: 'burning', turns: 3, stacks: 3 } }),
];

/** Spells each class learns, with the job level required. */
export const CLASS_SPELLS: Record<string, [string, number][]> = {
    hero: [ [ 'heal', 1 ], [ 'hurt', 1 ], [ 'blessing', 8 ], [ 'sunburst', 20 ] ],
    warden: [ [ 'wardforce', 6 ] ],
    berserker: [ [ 'dread', 8 ] ],
    vanguard: [ [ 'mending', 2 ], [ 'blessing', 5 ], [ 'sunburst', 18 ] ],
    strider: [ [ 'omen', 3 ], [ 'ironbark', 9 ] ],
    shade: [ [ 'mirror', 7 ], [ 'dread', 12 ] ],
    ascetic: [ [ 'haste', 10 ] ],
    arcanist: [ [ 'emberdart', 1 ], [ 'darts', 3 ], [ 'flamefan', 6 ], [ 'barrier', 10 ], [ 'thunder', 14 ], [ 'meteor', 25 ] ],
    wildblood: [ [ 'emberdart', 1 ], [ 'flamefan', 4 ], [ 'haste', 12 ], [ 'meteor', 22 ] ],
    pactbound: [ [ 'gravechill', 1 ], [ 'dread', 4 ], [ 'siphon', 10 ] ],
    cantor: [ [ 'mending', 1 ], [ 'blessing', 3 ], [ 'drowse', 6 ], [ 'stillness', 14 ] ],
    chaplain: [ [ 'mending', 1 ], [ 'blessing', 2 ], [ 'greatheal', 10 ], [ 'sunburst', 16 ] ],
    verdant: [ [ 'mending', 1 ], [ 'rimetouch', 2 ], [ 'ironbark', 6 ], [ 'greatheal', 14 ] ],
    necromancer: [ [ 'gravechill', 1 ], [ 'siphon', 5 ], [ 'dread', 8 ], [ 'stillness', 16 ] ],
    summoner: [ [ 'darts', 1 ], [ 'barrier', 8 ], [ 'thunder', 14 ] ],
    sunwarden: [ [ 'mending', 1 ], [ 'sunburst', 8 ], [ 'greatheal', 14 ] ],
    runeblade: [ [ 'rimetouch', 1 ], [ 'gravechill', 5 ], [ 'barrier', 12 ] ],
    artificer: [ [ 'darts', 1 ], [ 'wardforce', 4 ], [ 'thunder', 12 ] ],
    scalesage: [ [ 'emberdart', 1 ], [ 'mending', 3 ], [ 'flamefan', 8 ] ],
    stormcaller: [ [ 'thunder', 1 ], [ 'mending', 4 ], [ 'greatheal', 16 ] ],
    bladedancer: [ [ 'mending', 1 ], [ 'haste', 10 ] ],
};

export const getBattleSpell = (id: string): BattleSpell | undefined => BATTLE_SPELLS.find((x) => x.id === id);

/** HEAL and HURT for everyone, plus the current job's learned spells. */
export const knownSpells = (jobId: string, jobLevel: number): BattleSpell[] => {
    const ids = new Set<string>([ 'heal', 'hurt' ]);
    for (const [ id, level ] of CLASS_SPELLS[jobId] ?? []) {
        if (jobLevel >= level) {
            ids.add(id);
        }
    }
    return [ ...ids ].map(getBattleSpell).filter((x): x is BattleSpell => !!x);
};

export const rollDice = (rng: () => number, [ count, sides, flat ]: [number, number, number]): number => {
    let total = flat;
    for (let i = 0; i < count; i++) {
        total += 1 + Math.floor(rng() * sides);
    }
    return total;
};
