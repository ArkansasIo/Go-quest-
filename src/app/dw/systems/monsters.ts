/**
 * The bestiary: 420 monsters in 21 families of 20 ranks each, spanning levels 1-720.
 * Each monster has stats on the classic scale, an element, an AI and a generated sprite
 * (see sprites.ts). Family types follow the creature types of the System Reference
 * Document 5.1 (CC-BY-4.0); every name here is original to this game.
 */
import { hashString } from './rng';

export type Element = 'fire' | 'ice' | 'storm' | 'poison' | 'shadow' | 'holy' | 'earth' | 'water' | 'arcane';

export const ELEMENTS: Element[] = [ 'fire', 'ice', 'storm', 'poison', 'shadow', 'holy', 'earth', 'water', 'arcane' ];

export interface MonsterFamily {
    id: string;
    name: string;
    /** SRD creature type. */
    type: string;
    /** Base noun used in names. */
    noun: string;
    /** Stat multipliers relative to the baseline. */
    hp: number;
    str: number;
    agility: number;
    /** Level offset so families peak at different points. */
    levelBias: number;
    ai: string;
}

const fam = (id: string, name: string, type: string, noun: string, hp: number, str: number, agility: number,
    levelBias: number, ai = 'attackOnly'): MonsterFamily => ({ id, name, type, noun, hp, str, agility, levelBias, ai });

export const MONSTER_FAMILIES: MonsterFamily[] = [
    fam('slime', 'SLIMES', 'Ooze', 'Slime', 0.8, 0.7, 0.8, -40),
    fam('beast', 'BEASTS', 'Beast', 'Wolf', 1, 1.1, 1.2, -20),
    fam('bird', 'WINGED', 'Monstrosity', 'Harpy', 0.8, 1, 1.4, 0),
    fam('insect', 'CRAWLERS', 'Beast', 'Scorpion', 1, 1.1, 1, -10),
    fam('serpent', 'SERPENTS', 'Beast', 'Serpent', 1.1, 1, 1.1, 10),
    fam('plant', 'BLOOMS', 'Plant', 'Mandrake', 1.2, 0.9, 0.6, 0, 'halfHurtHalfAttack'),
    fam('fungus', 'SPOREKIN', 'Plant', 'Shroom', 1, 0.8, 0.7, -30, 'halfHurtHalfAttack'),
    fam('skeleton', 'BONEFOLK', 'Undead', 'Skeleton', 0.9, 1.1, 1, 20),
    fam('ghost', 'SHADES', 'Undead', 'Phantom', 0.8, 1, 1.3, 40, 'halfHurtHalfAttack'),
    fam('golem', 'GOLEMS', 'Construct', 'Golem', 1.8, 1.2, 0.5, 120),
    fam('elemental', 'ELEMENTALS', 'Elemental', 'Elemental', 1.3, 1.2, 1, 100, '75Hurt25Attack'),
    fam('demon', 'FIENDS', 'Fiend', 'Imp', 1.2, 1.3, 1.1, 140),
    fam('dragon', 'DRAGONS', 'Dragon', 'Drake', 1.6, 1.4, 1, 180),
    fam('giant', 'GIANTS', 'Giant', 'Giant', 1.9, 1.5, 0.6, 160),
    fam('goblin', 'GOBLINKIN', 'Humanoid', 'Goblin', 0.8, 0.9, 1.2, -30),
    fam('orc', 'ORCS', 'Humanoid', 'Orc', 1.2, 1.2, 0.9, 30),
    fam('mage', 'MAGES', 'Humanoid', 'Hexer', 0.8, 0.8, 1, 50, '75Hurt25Attack'),
    fam('knight', 'KNIGHTS', 'Humanoid', 'Knight', 1.3, 1.2, 0.9, 80),
    fam('eye', 'WATCHERS', 'Aberration', 'Eye', 1, 1.1, 0.8, 90, 'halfHurtHalfAttack'),
    fam('fey', 'FEY', 'Fey', 'Wisp', 0.7, 0.9, 1.5, 60, 'halfHurtHalfAttack'),
    fam('kraken', 'DEEP ONES', 'Monstrosity', 'Kraken', 1.5, 1.3, 0.8, 130),
];

/** Rank prefixes, weakest to strongest. Each pairs with an element. */
const RANKS: [string, Element][] = [
    [ 'Pale', 'water' ], [ 'Moss', 'poison' ], [ 'Cinder', 'fire' ], [ 'Frost', 'ice' ], [ 'Gloom', 'shadow' ],
    [ 'Sun', 'holy' ], [ 'Stone', 'earth' ], [ 'Storm', 'storm' ], [ 'Rune', 'arcane' ], [ 'Blood', 'fire' ],
    [ 'Venom', 'poison' ], [ 'Rime', 'ice' ], [ 'Void', 'shadow' ], [ 'Gilded', 'holy' ], [ 'Iron', 'earth' ],
    [ 'Thunder', 'storm' ], [ 'Abyss', 'water' ], [ 'Astral', 'arcane' ], [ 'Doom', 'shadow' ], [ 'Elder', 'arcane' ],
];

export const RANKS_PER_FAMILY = RANKS.length;
export const MONSTER_COUNT = MONSTER_FAMILIES.length * RANKS_PER_FAMILY;

export interface MonsterDef {
    id: string;
    name: string;
    family: MonsterFamily;
    rank: number;
    element: Element;
    level: number;
    hp: number;
    str: number;
    agility: number;
    xp: number;
    gp: number;
    /** Seed for sprite variation. */
    seed: number;
}

const clampLevel = (level: number) => Math.max(1, Math.min(720, Math.round(level)));

const buildMonsters = (): MonsterDef[] => {
    const list: MonsterDef[] = [];
    for (const family of MONSTER_FAMILIES) {
        RANKS.forEach(([ prefix, element ], rank) => {
            // Ranks spread over 1-720 on a curve; families shift by their bias at low ranks
            const level = clampLevel(1 + 719 * (rank / (RANKS.length - 1)) ** 1.6 + family.levelBias * (1 - rank / RANKS.length));
            list.push({
                id: `gen_${family.id}_${rank}`,
                name: `${prefix} ${family.noun}`,
                family,
                rank,
                element,
                level,
                hp: Math.max(3, Math.round((3 + level * 1.6) * family.hp)),
                str: Math.max(3, Math.round((5 + level * 1.0) * family.str)),
                agility: Math.max(2, Math.round((3 + level * 0.7) * family.agility)),
                xp: Math.max(1, Math.round(1 + level ** 1.35 * 0.5)),
                gp: Math.max(1, Math.round(2 + level * 1.2)),
                seed: hashString(`${family.id}:${rank}`),
            });
        });
    }
    return list;
};

export const MONSTERS: MonsterDef[] = buildMonsters();

export const getMonster = (id: string): MonsterDef | undefined => MONSTERS.find((m) => m.id === id);

export const isGeneratedMonster = (id: string): boolean => id.startsWith('gen_');

/**
 * Monsters suited to a content level (1-720): those within a band around it, widening the
 * band until at least one matches.
 */
export const monstersNear = (level: number, band = 25): MonsterDef[] => {
    for (let b = band; b <= 1440; b *= 2) {
        const list = MONSTERS.filter((m) => Math.abs(m.level - level) <= b);
        if (list.length) {
            return list;
        }
    }
    return MONSTERS;
};

/** Enemy data in the format the battle engine reads. */
export const toEnemyData = (m: MonsterDef) => ({
    name: m.name,
    image: m.id,
    damagedImage: `${m.id}_damaged`,
    str: m.str,
    agility: m.agility,
    hp: [ Math.round(m.hp * 0.85), m.hp ],
    resist: { sleep: 0, stopSpell: 0, hurt: 0 },
    dodge: 1,
    xp: m.xp,
    gp: [ Math.round(m.gp * 0.8), m.gp ],
    ai: m.family.ai,
});
