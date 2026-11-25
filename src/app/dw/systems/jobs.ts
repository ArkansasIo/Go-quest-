/**
 * Jobs (27), support jobs, job abilities, races (15) and monster jobs.
 * See docs/JOBS_AND_RACES.md and docs/CHARACTERS.md.
 */
import { Rng, chance, pick } from './rng';
import { StatMods } from './stats';

export type Role = 'tank' | 'dps' | 'healer';

/** What a job ability does in a Dragon Warrior battle. */
export interface AbilityEffect {
    /** Physical attack with this damage multiplier. */
    strike?: number;
    /** Heal this % of max HP. */
    healPct?: number;
    /** Apply effect to self. */
    selfEffect?: { id: string; turns: number; pool?: number };
    /** Apply effect to the enemy. */
    enemyEffect?: { id: string; turns: number; stacks?: number };
}

export interface JobAbility {
    name: string;
    level: number;
    effect: AbilityEffect;
}

export interface JobDef {
    id: string;
    name: string;
    role: Role;
    /** Passive bonus while this is the main job. */
    mods: StatMods;
    /** Support traits granted per 10 support levels (capped at 5 steps). */
    supportMods: StatMods;
    abilities: JobAbility[];
}

const job = (id: string, name: string, role: Role, mods: StatMods, supportMods: StatMods, abilities: JobAbility[]): JobDef =>
    ({ id, name, role, mods, supportMods, abilities });

const ab = (name: string, level: number, effect: AbilityEffect): JobAbility => ({ name, level, effect });

export const JOBS: JobDef[] = [
    // The 16 classes
    job('hero', 'HERO', 'dps', {}, { hp: 4 }, [ ab('VALOR', 1, { selfEffect: { id: 'inspired', turns: 3 } }) ]),
    job('warden', 'WARDEN', 'tank', { acb: 2 }, { acb: 1 }, [ ab('SECOND WIND', 1, { healPct: 25 }), ab('ACTION SURGE', 10, { strike: 2 }) ]),
    job('berserker', 'BERSERKER', 'tank', { dmg: 10 }, { dmg: 2 }, [ ab('RAGE', 1, { selfEffect: { id: 'rage', turns: 4 } }) ]),
    job('vanguard', 'VANGUARD', 'tank', { acb: 1, heal: 10 }, { resist: 1 }, [ ab('SMITE', 1, { strike: 1.6 }), ab('LAY ON HANDS', 8, { healPct: 30 }) ]),
    job('strider', 'STRIDER', 'dps', { hit: 2 }, { hit: 1 }, [ ab('HUNTER MARK', 1, { enemyEffect: { id: 'marked', turns: 5 } }) ]),
    job('shade', 'SHADE', 'dps', { crit: 5 }, { crit: 1 }, [ ab('SNEAK ATTACK', 1, { strike: 1.8 }), ab('ENVENOM', 9, { enemyEffect: { id: 'venom', turns: 4, stacks: 2 } }) ]),
    job('ascetic', 'ASCETIC', 'dps', { dodge: 5 }, { dodge: 1 }, [ ab('STUNNING BLOW', 1, { strike: 1.2, enemyEffect: { id: 'stunned', turns: 1 } }) ]),
    job('arcanist', 'ARCANIST', 'dps', { mp: 10 }, { mp: 4 }, [ ab('FLAME FAN', 1, { strike: 1.5, enemyEffect: { id: 'burning', turns: 3 } }) ]),
    job('wildblood', 'WILDBLOOD', 'dps', { crit: 3, dmg: 5 }, { dmg: 1 }, [ ab('WILD SURGE', 1, { strike: 2.2 }) ]),
    job('pactbound', 'PACTBOUND', 'dps', { dmg: 5 }, { necrotic: 3 }, [ ab('HEXBOLT', 1, { strike: 1.4, enemyEffect: { id: 'doomed', turns: 3 } }) ]),
    job('cantor', 'CANTOR', 'healer', { heal: 10 }, { saves: 2 }, [ ab('INSPIRE', 1, { selfEffect: { id: 'bless', turns: 4 } }) ]),
    job('chaplain', 'CHAPLAIN', 'healer', { heal: 20 }, { heal: 4 }, [ ab('MENDING TOUCH', 1, { healPct: 35 }) ]),
    job('verdant', 'VERDANT', 'healer', { heal: 10, hp: 5 }, { hp: 3 }, [ ab('BEASTSHAPE', 1, { selfEffect: { id: 'wildshape', turns: 6, pool: 25 } }) ]),
    job('necromancer', 'NECROMANCER', 'dps', { leech: 2 }, { leech: 1 }, [ ab('LIFE SIPHON', 1, { strike: 1.3, healPct: 10 }) ]),
    job('summoner', 'SUMMONER', 'dps', { dmg: 5 }, { hp: 3 }, [ ab('SPECTRAL MACE', 1, { strike: 1.5 }) ]),
    job('sunwarden', 'SUNWARDEN', 'healer', { radiant: 10, heal: 10 }, { radiant: 2 }, [ ab('DAWN LIGHT', 1, { healPct: 20, enemyEffect: { id: 'blinded', turns: 2 } }) ]),
    job('runeblade', 'RUNEBLADE', 'tank', { acb: 1, cold: 10 }, { cold: 2 }, [ ab('FROST BRAND', 1, { strike: 1.3, enemyEffect: { id: 'frostbite', turns: 3 } }) ]),
    job('artificer', 'ARTIFICER', 'dps', { crit: 2, acb: 1 }, { acb: 1 }, [ ab('TURRET', 1, { strike: 1.4 }), ab('ARCANE PLATING', 10, { selfEffect: { id: 'barrier', turns: 6, pool: 30 } }) ]),
    // The 11 advanced jobs
    job('ronin', 'RONIN', 'dps', { crit: 4, dmg: 5 }, { crit: 1 }, [ ab('MEIKYO STRIKE', 1, { strike: 1.8 }), ab('THIRD EYE', 15, { selfEffect: { id: 'foresight', turns: 3 } }) ]),
    job('shinobi', 'SHINOBI', 'dps', { dodge: 6 }, { dodge: 1 }, [ ab('PAPER IMAGE', 1, { selfEffect: { id: 'mirror', turns: 4 } }), ab('SHURIKEN', 10, { strike: 1.5, enemyEffect: { id: 'bleeding', turns: 3 } }) ]),
    job('bladedancer', 'BLADEDANCER', 'healer', { dodge: 3, heal: 10 }, { haste: 2 }, [ ab('HEALING WALTZ', 1, { healPct: 25 }), ab('BOX STEP', 8, { enemyEffect: { id: 'slowed', turns: 3 } }), ab('FAN DANCE', 20, { selfEffect: { id: 'fortify', turns: 4 } }) ]),
    job('wyrmlancer', 'WYRMLANCER', 'dps', { dmg: 8 }, { dmg: 2 }, [ ab('JUMP', 1, { strike: 2 }), ab('CALL WYVERN', 5, { strike: 1.4, enemyEffect: { id: 'burning', turns: 3 } }), ab('ANCIENT CIRCLE', 25, { selfEffect: { id: 'might', turns: 5 } }) ]),
    job('corsair', 'CORSAIR', 'dps', { gf: 15, crit: 2 }, { gf: 5 }, [ ab('PHANTOM ROLL', 1, { selfEffect: { id: 'focus', turns: 4 } }), ab('QUICK DRAW', 10, { strike: 1.7 }) ]),
    job('beastcaller', 'BEASTCALLER', 'tank', { hp: 10 }, { hp: 4 }, [ ab('CALL BEAST', 1, { strike: 1.4 }), ab('FERAL HOWL', 12, { enemyEffect: { id: 'frightened', turns: 3 } }) ]),
    job('puppeteer', 'PUPPETEER', 'tank', { acb: 2 }, { acb: 1 }, [ ab('DEPLOY AUTOMATON', 1, { selfEffect: { id: 'barrier', turns: 8, pool: 20 } }), ab('OVERDRIVE', 15, { selfEffect: { id: 'haste', turns: 3 } }) ]),
    job('dreadknight', 'DREADKNIGHT', 'tank', { leech: 2, acb: 1 }, { leech: 1 }, [ ab('DEATH STRIKE', 1, { strike: 1.3, healPct: 15 }), ab('DARK GRASP', 5, { enemyEffect: { id: 'weakened', turns: 3 } }), ab('BONE SHIELD', 15, { selfEffect: { id: 'barrier', turns: 6, pool: 40 } }) ]),
    job('voidhunter', 'VOIDHUNTER', 'dps', { dmg: 6, dodge: 3 }, { dodge: 1 }, [ ab('CHAOS STRIKE', 1, { strike: 1.7 }), ab('BLUR', 8, { selfEffect: { id: 'trueveil', turns: 3 } }), ab('METAMORPHOSIS', 25, { selfEffect: { id: 'frenzy', turns: 6 } }) ]),
    job('scalesage', 'SCALESAGE', 'healer', { fire: 10, heal: 10 }, { fire: 2 }, [ ab('DRAGON BREATH', 1, { strike: 1.5, enemyEffect: { id: 'burning', turns: 3, stacks: 2 } }), ab('VERDANT EMBRACE', 5, { healPct: 30 }) ]),
    job('stormcaller', 'STORMCALLER', 'healer', { lightning: 10, heal: 5 }, { lightning: 2 }, [ ab('TOTEM OF MIGHT', 1, { selfEffect: { id: 'might', turns: 4 } }), ab('CHAIN SURGE', 8, { strike: 1.5, enemyEffect: { id: 'shocked', turns: 3 } }), ab('HEALING TIDE', 20, { selfEffect: { id: 'regen', turns: 5 } }) ]),
];

export const getJob = (id: string): JobDef => JOBS.find((j) => j.id === id) ?? JOBS[0];

export const SUPPORT_UNLOCK_LEVEL = 18;
export const JOB_MAX_LEVEL = 99;

/** XP for a job level; jobs level faster than the hero. */
export const jobXpForLevel = (level: number): number => level <= 1 ? 0 : Math.round(10 * (level - 1) ** 2.2);

export interface JobProgress {
    level: number;
    xp: number;
}

export const addJobXp = (progress: JobProgress, xp: number): number => {
    progress.xp += xp;
    let gained = 0;
    while (progress.level < JOB_MAX_LEVEL && progress.xp >= jobXpForLevel(progress.level + 1)) {
        progress.level++;
        gained++;
    }
    return gained;
};

/** Support level is half the main level, capped at the support job's own level. */
export const supportLevel = (mainLevel: number, supportJobLevel: number): number =>
    mainLevel < SUPPORT_UNLOCK_LEVEL ? 0 : Math.min(Math.floor(mainLevel / 2), supportJobLevel);

export const supportTraitMods = (supportJob: JobDef, level: number): StatMods => {
    const steps = Math.min(5, Math.floor(level / 10));
    const result: StatMods = {};
    for (const [ key, value ] of Object.entries(supportJob.supportMods)) {
        result[key as keyof StatMods] = value * steps;
    }
    return result;
};

/** Abilities available: main job's learned abilities plus the support job's up to support level. */
export const availableAbilities = (main: JobDef, mainLevel: number, support?: JobDef, supLevel = 0) => {
    const list: { ability: JobAbility; support: boolean }[] =
        main.abilities.filter((a) => a.level <= mainLevel).map((ability) => ({ ability, support: false }));
    if (support && support.id !== main.id) {
        list.push(...support.abilities.filter((a) => a.level <= supLevel).map((ability) => ({ ability, support: true })));
    }
    return list;
};

export interface RaceDef {
    id: string;
    name: string;
    bonus: string;
    mods: StatMods;
    trait: string;
}

export const RACES: RaceDef[] = [
    { id: 'hearthkin', name: 'HEARTHKIN', bonus: 'ALL+1', mods: { hit: 1, acb: 1, saves: 5 }, trait: 'Versatile: a little of everything.' },
    { id: 'thornelf', name: 'THORNELF', bonus: 'DEX+2 WIS+1', mods: { dodge: 3, saves: 10 }, trait: 'Keen senses; resists sleep.' },
    { id: 'stonekin', name: 'STONEKIN', bonus: 'CON+2 STR+1', mods: { hp: 8, resist: 3 }, trait: 'Stoneblood; resists poison.' },
    { id: 'wispling', name: 'WISPLING', bonus: 'DEX+2 CHA+1', mods: { mf: 15, dodge: 2 }, trait: 'Lucky; finds more treasure.' },
    { id: 'emberborn', name: 'EMBERBORN', bonus: 'CHA+2 INT+1', mods: { fire: 15 }, trait: 'Touched by old fire.' },
    { id: 'burrowkin', name: 'BURROWKIN', bonus: 'INT+2 CON+1', mods: { saves: 15 }, trait: 'Cunning; resists enemy magic.' },
    { id: 'twinblood', name: 'TWINBLOOD', bonus: 'CHA+2 DEX+1 CON+1', mods: { hp: 4, saves: 8 }, trait: 'Feyblood; versatile.' },
    { id: 'tuskborn', name: 'TUSKBORN', bonus: 'STR+2 CON+1', mods: { dmg: 5, hp: 4 }, trait: 'Relentless: once a battle, survive at 1 HP.' },
    { id: 'drakkin', name: 'DRAKKIN', bonus: 'STR+2 CHA+1', mods: { dmg: 4, fire: 8, resist: 2 }, trait: 'Dragon-blooded; resists fire.' },
    { id: 'hornfolk', name: 'HORNFOLK', bonus: 'STR+2 CON+1', mods: { hp: 10 }, trait: 'WAR STOMP stuns foes once a battle.' },
    { id: 'felinar', name: 'FELINAR', bonus: 'DEX+2 WIS+1', mods: { dodge: 5 }, trait: 'Keen senses, +5% dodge.' },
    { id: 'pipkin', name: 'PIPKIN', bonus: 'INT+2 DEX+1', mods: { fire: 10, cold: 10, lightning: 10, saves: 5 }, trait: 'Elemental damage; resists magic.' },
    { id: 'lunari', name: 'LUNARI', bonus: 'DEX+2 INT+1', mods: { dodge: 3, crit: 2 }, trait: 'Starts battles hidden.' },
    { id: 'wolfkin', name: 'WOLFKIN', bonus: 'STR+2 DEX+1', mods: { crit: 4, critdmg: 15 }, trait: '+4% crit, +15% crit damage.' },
    { id: 'starkin', name: 'STARKIN', bonus: 'WIS+2 CHA+1', mods: { heal: 15, radiant: 10 }, trait: '+15% healing, GIFT OF LIGHT.' },
];

export const getRace = (id: string): RaceDef => RACES.find((r) => r.id === id) ?? RACES[0];

/** Racial once-per-battle abilities. */
export const RACE_ABILITIES: Record<string, JobAbility> = {
    hornfolk: ab('WAR STOMP', 1, { enemyEffect: { id: 'stunned', turns: 1 } }),
    starkin: ab('GIFT OF LIGHT', 1, { healPct: 30 }),
    drakkin: ab('FIRE BREATH', 1, { strike: 1.5, enemyEffect: { id: 'burning', turns: 3 } }),
};

export type MonsterJobId = 'HEXER' | 'GUARDIAN' | 'ARCHER' | 'BRUTE' | 'MENDER';

export interface MonsterJob {
    id: MonsterJobId;
    hpMult: number;
    strMult: number;
    /** Hero damage reduced by this % (guardian armour). */
    armour: number;
    /** Enemy heals this % of max HP each turn. */
    regenPct: number;
    /** Enemy sometimes casts HURT. */
    casts: boolean;
}

export const MONSTER_JOBS: MonsterJob[] = [
    { id: 'HEXER', hpMult: 0.85, strMult: 1, armour: 0, regenPct: 0, casts: true },
    { id: 'GUARDIAN', hpMult: 1.3, strMult: 1, armour: 15, regenPct: 0, casts: false },
    { id: 'ARCHER', hpMult: 1, strMult: 1.15, armour: 0, regenPct: 0, casts: false },
    { id: 'BRUTE', hpMult: 1, strMult: 1.3, armour: -10, regenPct: 0, casts: false },
    { id: 'MENDER', hpMult: 1, strMult: 1, armour: 0, regenPct: 8, casts: false },
];

export const MONSTER_JOB_CHANCE = 0.35;
export const MONSTER_JOB_XP_BONUS = 0.2;

/** About 35% of ordinary foes get a job. Bosses never do. */
export const rollMonsterJob = (rng: Rng, isBoss: boolean): MonsterJob | undefined =>
    !isBoss && chance(rng, MONSTER_JOB_CHANCE) ? pick(rng, MONSTER_JOBS) : undefined;

export const TOWN_MAPS = [ 'brecconary', 'garinham', 'kol', 'tantegelCastle', 'tantegelCastleUpstairs', 'rimuldar', 'cantlin' ];

export const isTown = (mapName: string): boolean => TOWN_MAPS.includes(mapName);
