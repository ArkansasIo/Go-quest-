/**
 * Character building catalog: 9 attributes, 9 core races, 18 classes with subclasses,
 * types and subtypes, weapon and armor catalogs, items and skill cores.
 * See docs/CHARACTERS.md, docs/COMBAT_EFFECTS.md and docs/GEAR_TIERS_AND_ARTS.md.
 */
import { Rng, pick } from './rng';
import { StatMods } from './stats';

// ---------------------------------------------------------------------------
// Attributes

export const ATTRIBUTES = [ 'STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA', 'LCK', 'WIL', 'SPD' ] as const;
export type Attribute = typeof ATTRIBUTES[number];
export type AttributeScores = Record<Attribute, number>;

export const ATTRIBUTE_INFO: Record<Attribute, string> = {
    STR: 'Melee power: attack power.',
    DEX: 'Aim and footwork: dodge.',
    CON: 'Hit points and endurance.',
    INT: 'Arcane power: magic points and elemental damage.',
    WIS: 'Divine power: healing received.',
    CHA: 'Presence: gold find.',
    LCK: 'Critical chance and magic find.',
    WIL: 'Resist spells and conditions: saves.',
    SPD: 'Initiative and extra attacks: haste.',
};

export const BASE_ATTRIBUTE = 10;

/** 5e-style modifier. */
export const attributeModifier = (score: number): number => Math.floor((score - 10) / 2);

/**
 * Converts attribute modifiers to substats. Only positive modifiers give bonuses so a
 * starting hero keeps the classic numbers.
 */
export const attributeMods = (scores: AttributeScores): StatMods => {
    const m = (a: Attribute) => Math.max(0, attributeModifier(scores[a]));
    return {
        hit: m('STR'),
        dodge: m('DEX'),
        hp: m('CON') * 4,
        mp: m('INT') * 3,
        fire: m('INT') * 2,
        heal: m('WIS') * 5,
        gf: m('CHA') * 5,
        crit: m('LCK'),
        mf: m('LCK') * 5,
        saves: m('WIL') * 4,
        haste: m('SPD') * 2,
    };
};

// ---------------------------------------------------------------------------
// Races

export interface CoreRaceDef {
    id: string;
    name: string;
    attributes: Partial<AttributeScores>;
    description: string;
}

/** The 9 core playable races (they share ids with the race list in jobs.ts). */
export const CORE_RACES: CoreRaceDef[] = [
    { id: 'hearthkin', name: 'HEARTHKIN', attributes: { STR: 1, DEX: 1, CON: 1, INT: 1, WIS: 1, CHA: 1 }, description: 'Common folk of the river towns.' },
    { id: 'thornelf', name: 'THORNELF', attributes: { DEX: 2, WIS: 1 }, description: 'Long-lived forest kin with keen senses.' },
    { id: 'stonekin', name: 'STONEKIN', attributes: { CON: 2, STR: 1 }, description: 'Mountain delvers who shrug off poison.' },
    { id: 'wispling', name: 'WISPLING', attributes: { DEX: 2, CHA: 1, LCK: 2 }, description: 'Small, brave and very lucky.' },
    { id: 'emberborn', name: 'EMBERBORN', attributes: { CHA: 2, INT: 1 }, description: 'Touched by old fire.' },
    { id: 'burrowkin', name: 'BURROWKIN', attributes: { INT: 2, CON: 1, WIL: 1 }, description: 'Clever tunnel folk who resist magic.' },
    { id: 'twinblood', name: 'TWINBLOOD', attributes: { CHA: 2, DEX: 1, CON: 1 }, description: 'Born of two peoples.' },
    { id: 'tuskborn', name: 'TUSKBORN', attributes: { STR: 2, CON: 1 }, description: 'Fierce and hardy; hard to put down.' },
    { id: 'drakkin', name: 'DRAKKIN', attributes: { STR: 2, CHA: 1 }, description: 'Dragon-blooded, with fiery breath.' },
];

// ---------------------------------------------------------------------------
// Classes

export type ClassType = 'tank' | 'dps' | 'healer';
export type ClassSubtype = 'melee' | 'ranged' | 'caster' | 'hybrid';

export interface SubclassDef {
    id: string;
    name: string;
    mods: StatMods;
}

export interface ClassDef {
    /** Same id as the matching job in jobs.ts. */
    id: string;
    name: string;
    type: ClassType;
    subtype: ClassSubtype;
    primary: Attribute;
    subclasses: [SubclassDef, SubclassDef];
}

const sub = (id: string, name: string, mods: StatMods): SubclassDef => ({ id, name, mods });

/** The 18 base classes. Each picks one of two subclasses at job level 10. */
export const CLASSES: ClassDef[] = [
    { id: 'hero', name: 'HERO', type: 'dps', subtype: 'hybrid', primary: 'CHA', subclasses: [ sub('paragon', 'PARAGON', { hp: 10, dmg: 5 }), sub('chosen', 'CHOSEN', { crit: 4, saves: 10 }) ] },
    { id: 'warden', name: 'WARDEN', type: 'tank', subtype: 'melee', primary: 'STR', subclasses: [ sub('champion', 'CHAMPION', { crit: 5 }), sub('tactician', 'TACTICIAN', { acb: 3, block: 5 }) ] },
    { id: 'berserker', name: 'BERSERKER', type: 'tank', subtype: 'melee', primary: 'STR', subclasses: [ sub('frenzy', 'FRENZY', { haste: 8 }), sub('totem', 'TOTEM', { resist: 6 }) ] },
    { id: 'vanguard', name: 'VANGUARD', type: 'tank', subtype: 'hybrid', primary: 'STR', subclasses: [ sub('devotion', 'DEVOTION', { heal: 15, acb: 1 }), sub('vengeance', 'VENGEANCE', { dmg: 10 }) ] },
    { id: 'strider', name: 'STRIDER', type: 'dps', subtype: 'ranged', primary: 'DEX', subclasses: [ sub('hunter', 'HUNTER', { crit: 4, hit: 2 }), sub('beastmaster', 'BEASTMASTER', { hp: 12, thorns: 3 }) ] },
    { id: 'shade', name: 'SHADE', type: 'dps', subtype: 'melee', primary: 'DEX', subclasses: [ sub('thief', 'THIEF', { gf: 25, mf: 20 }), sub('assassin', 'ASSASSIN', { crit: 6, critdmg: 25 }) ] },
    { id: 'ascetic', name: 'ASCETIC', type: 'dps', subtype: 'melee', primary: 'DEX', subclasses: [ sub('open_hand', 'OPEN HAND', { haste: 6, dodge: 3 }), sub('shadow', 'WAY OF SHADOW', { dodge: 6 }) ] },
    { id: 'arcanist', name: 'ARCANIST', type: 'dps', subtype: 'caster', primary: 'INT', subclasses: [ sub('evoker', 'EVOKER', { fire: 15, lightning: 15 }), sub('abjurer', 'ABJURER', { resist: 8, saves: 10 }) ] },
    { id: 'wildblood', name: 'WILDBLOOD', type: 'dps', subtype: 'caster', primary: 'CHA', subclasses: [ sub('draconic', 'DRACONIC', { fire: 15, acb: 1 }), sub('wild_surge', 'WILD SURGE', { crit: 5, dmg: 5 }) ] },
    { id: 'pactbound', name: 'PACTBOUND', type: 'dps', subtype: 'caster', primary: 'CHA', subclasses: [ sub('fiend', 'FIEND PACT', { leech: 3 }), sub('archfey', 'ARCHFEY', { dodge: 5 }) ] },
    { id: 'cantor', name: 'CANTOR', type: 'healer', subtype: 'caster', primary: 'CHA', subclasses: [ sub('lore', 'LORE', { xp: 15 }), sub('valor', 'VALOR', { dmg: 8, acb: 1 }) ] },
    { id: 'chaplain', name: 'CHAPLAIN', type: 'healer', subtype: 'caster', primary: 'WIS', subclasses: [ sub('life', 'LIFE', { heal: 25 }), sub('tempest', 'TEMPEST', { lightning: 20 }) ] },
    { id: 'verdant', name: 'VERDANT', type: 'healer', subtype: 'hybrid', primary: 'WIS', subclasses: [ sub('moon', 'MOON', { hp: 15 }), sub('land', 'LAND', { heal: 15, resist: 4 }) ] },
    { id: 'necromancer', name: 'NECROMANCER', type: 'dps', subtype: 'caster', primary: 'INT', subclasses: [ sub('gravecaller', 'GRAVECALLER', { necrotic: 20 }), sub('boneweaver', 'BONEWEAVER', { acb: 2, leech: 2 }) ] },
    { id: 'summoner', name: 'SUMMONER', type: 'dps', subtype: 'caster', primary: 'CHA', subclasses: [ sub('spiritcaller', 'SPIRITCALLER', { dmg: 8 }), sub('wardbinder', 'WARDBINDER', { resist: 6, hp: 8 }) ] },
    { id: 'sunwarden', name: 'SUNWARDEN', type: 'healer', subtype: 'hybrid', primary: 'WIS', subclasses: [ sub('dawnkeeper', 'DAWNKEEPER', { heal: 20 }), sub('sunstriker', 'SUNSTRIKER', { radiant: 20 }) ] },
    { id: 'runeblade', name: 'RUNEBLADE', type: 'tank', subtype: 'hybrid', primary: 'STR', subclasses: [ sub('blood_rune', 'BLOOD RUNE', { leech: 3 }), sub('frost_brand', 'FROST BRAND', { cold: 20 }) ] },
    { id: 'artificer', name: 'ARTIFICER', type: 'dps', subtype: 'ranged', primary: 'INT', subclasses: [ sub('gunsmith', 'GUNSMITH', { crit: 4, dmg: 6 }), sub('armorer', 'ARMORER', { acb: 3, thorns: 4 }) ] },
];

export const SUBCLASS_LEVEL = 10;

export const getClass = (id: string): ClassDef | undefined => CLASSES.find((c) => c.id === id);

export const getSubclass = (classId: string, subclassId: string | undefined): SubclassDef | undefined =>
    subclassId ? getClass(classId)?.subclasses.find((s) => s.id === subclassId) : undefined;

/**
 * Attribute scores from race and class: base 10, race bonuses, +2 to the class primary.
 */
export const computeAttributes = (raceId: string, classId: string): AttributeScores => {
    const scores = Object.fromEntries(ATTRIBUTES.map((a) => [ a, BASE_ATTRIBUTE ])) as AttributeScores;
    const race = CORE_RACES.find((r) => r.id === raceId);
    for (const [ attr, bonus ] of Object.entries(race?.attributes ?? {})) {
        scores[attr as Attribute] += bonus;
    }
    const cls = getClass(classId);
    if (cls) {
        scores[cls.primary] += 2;
    }
    return scores;
};

// ---------------------------------------------------------------------------
// Weapons, armor and items

export const GEAR_TIERS = [ 'Crude', 'Iron', 'Steel', 'Fine', 'Masterwork', 'Knight', 'Silversteel', 'Runed', 'Mithril',
    'Elven', 'Dwarven', 'Moonsilver', 'Starforged', 'Dragonbone', 'Voidsteel', 'Sunforged', 'Abyssal', 'Celestial',
    'Primordial', 'Titanic', 'Mythic', 'Ascendant', 'Dawnsteel' ];

export interface WeaponTypeDef {
    id: string;
    name: string;
    subtype: 'blade' | 'blunt' | 'polearm' | 'ranged' | 'focus';
    hands: 1 | 2;
    mods: StatMods;
}

export const WEAPON_TYPES: WeaponTypeDef[] = [
    { id: 'sword', name: 'SWORD', subtype: 'blade', hands: 1, mods: { hit: 1, crit: 1 } },
    { id: 'greatsword', name: 'GREATSWORD', subtype: 'blade', hands: 2, mods: { dmg: 8 } },
    { id: 'dagger', name: 'DAGGER', subtype: 'blade', hands: 1, mods: { crit: 3 } },
    { id: 'katana', name: 'KATANA', subtype: 'blade', hands: 2, mods: { crit: 2, critdmg: 15 } },
    { id: 'axe', name: 'AXE', subtype: 'blunt', hands: 1, mods: { dmg: 5 } },
    { id: 'greataxe', name: 'GREATAXE', subtype: 'blunt', hands: 2, mods: { dmg: 10, crit: -1 } },
    { id: 'mace', name: 'MACE', subtype: 'blunt', hands: 1, mods: { dmg: 3, acb: 1 } },
    { id: 'hammer', name: 'WARHAMMER', subtype: 'blunt', hands: 2, mods: { dmg: 9 } },
    { id: 'spear', name: 'SPEAR', subtype: 'polearm', hands: 2, mods: { hit: 2, haste: 2 } },
    { id: 'halberd', name: 'HALBERD', subtype: 'polearm', hands: 2, mods: { dmg: 6, hit: 1 } },
    { id: 'bow', name: 'BOW', subtype: 'ranged', hands: 2, mods: { hit: 2, crit: 2 } },
    { id: 'crossbow', name: 'CROSSBOW', subtype: 'ranged', hands: 2, mods: { dmg: 6, hit: 1 } },
    { id: 'staff', name: 'STAFF', subtype: 'focus', hands: 2, mods: { mp: 8, fire: 6 } },
    { id: 'wand', name: 'WAND', subtype: 'focus', hands: 1, mods: { mp: 4, lightning: 6 } },
];

export interface ArmorClassDef {
    id: string;
    name: string;
    subtypes: string[];
    mods: StatMods;
}

export const ARMOR_CLASSES: ArmorClassDef[] = [
    { id: 'cloth', name: 'CLOTH', subtypes: [ 'Robe', 'Vestment', 'Mantle' ], mods: { mp: 6, saves: 4 } },
    { id: 'leather', name: 'LEATHER', subtypes: [ 'Jerkin', 'Brigandine', 'Hide Coat' ], mods: { dodge: 3 } },
    { id: 'mail', name: 'MAIL', subtypes: [ 'Hauberk', 'Scale Shirt', 'Ringmail' ], mods: { acb: 2, resist: 2 } },
    { id: 'plate', name: 'PLATE', subtypes: [ 'Cuirass', 'Full Plate', 'Breastplate' ], mods: { acb: 4, dodge: -2 } },
];

export const SHIELD_TYPES: { id: string; name: string; mods: StatMods }[] = [
    { id: 'buckler', name: 'BUCKLER', mods: { block: 4, dodge: 1 } },
    { id: 'kite', name: 'KITE SHIELD', mods: { block: 6 } },
    { id: 'tower', name: 'TOWER SHIELD', mods: { block: 9, acb: 1 } },
];

/** Tier (0-22) for a content level. */
export const gearTierFor = (contentLevel: number): number => Math.min(GEAR_TIERS.length - 1, Math.floor(contentLevel / 720 * GEAR_TIERS.length));

/** Mods from a weapon/armor/shield type, scaled by tier. */
export const scaleTypeMods = (mods: StatMods, tier: number): StatMods => {
    const result: StatMods = {};
    for (const [ key, value ] of Object.entries(mods)) {
        result[key as keyof StatMods] = Math.round(value * (1 + tier * 0.25));
    }
    return result;
};

export interface RolledBase {
    name: string;
    slot: 'weapon' | 'armor' | 'shield';
    mods: StatMods;
}

/** Picks a random weapon, armor or shield base of the right tier for loot. */
export const rollGearBase = (rng: Rng, contentLevel: number): RolledBase => {
    const tier = gearTierFor(contentLevel);
    const tierName = GEAR_TIERS[tier];
    const r = rng();
    if (r < 0.5) {
        const w = pick(rng, WEAPON_TYPES);
        return { name: `${tierName} ${w.name.charAt(0)}${w.name.substring(1).toLowerCase()}`, slot: 'weapon', mods: scaleTypeMods(w.mods, tier) };
    }
    if (r < 0.8) {
        const a = pick(rng, ARMOR_CLASSES);
        return { name: `${tierName} ${pick(rng, a.subtypes)}`, slot: 'armor', mods: scaleTypeMods(a.mods, tier) };
    }
    const s = pick(rng, SHIELD_TYPES);
    return { name: `${tierName} ${s.name.charAt(0)}${s.name.substring(1).toLowerCase()}`, slot: 'shield', mods: scaleTypeMods(s.mods, tier) };
};

export type ItemCategory = 'consumable' | 'material' | 'gem' | 'rune' | 'gear' | 'core' | 'key';

export const ITEM_CATEGORIES: { id: ItemCategory; name: string; description: string }[] = [
    { id: 'consumable', name: 'CONSUMABLES', description: 'Herbs, elixirs, feasts, bandages, kits and oils.' },
    { id: 'material', name: 'MATERIALS', description: '90 gathered materials across 9 families.' },
    { id: 'gem', name: 'GEMS', description: '9 families x 9 tiers, socketed into gear.' },
    { id: 'rune', name: 'RUNES', description: '9 families x 9 tiers, socketed into gear.' },
    { id: 'gear', name: 'GEAR', description: `14 weapon types, 4 armor classes, 3 shields across ${GEAR_TIERS.length} tiers.` },
    { id: 'core', name: 'SKILL CORES', description: '36 cores that grant skills or passives.' },
    { id: 'key', name: 'KEY ITEMS', description: 'Magic keys, torches and quest items.' },
];

// ---------------------------------------------------------------------------
// Skill cores

export type CoreSchool = 'MIGHT' | 'GUARD' | 'SWIFT' | 'FLAME' | 'FROST' | 'STORM' | 'LIFE' | 'SHADOW' | 'FORTUNE';

export interface SkillCoreDef {
    id: string;
    name: string;
    school: CoreSchool;
    tier: number;
    /** Passive bonus while slotted. */
    mods?: StatMods;
    /** Or a once-per-battle skill. */
    skill?: {
        strike?: number;
        healPct?: number;
        selfEffect?: { id: string; turns: number; pool?: number };
        enemyEffect?: { id: string; turns: number; stacks?: number };
    };
}

const SCHOOL_DATA: Record<CoreSchool, { passive: StatMods; skillName: string; skill: NonNullable<SkillCoreDef['skill']> }> = {
    MIGHT: { passive: { dmg: 4 }, skillName: 'CRUSHING BLOW', skill: { strike: 1.8 } },
    GUARD: { passive: { acb: 1, block: 2 }, skillName: 'BULWARK', skill: { selfEffect: { id: 'barrier', turns: 6, pool: 25 } } },
    SWIFT: { passive: { haste: 3, dodge: 1 }, skillName: 'FLURRY', skill: { selfEffect: { id: 'haste', turns: 3 } } },
    FLAME: { passive: { fire: 8 }, skillName: 'FIREBALL', skill: { strike: 1.4, enemyEffect: { id: 'burning', turns: 3, stacks: 2 } } },
    FROST: { passive: { cold: 8 }, skillName: 'ICE LANCE', skill: { strike: 1.3, enemyEffect: { id: 'frostbite', turns: 3 } } },
    STORM: { passive: { lightning: 8 }, skillName: 'THUNDERCLAP', skill: { strike: 1.3, enemyEffect: { id: 'shocked', turns: 3 } } },
    LIFE: { passive: { heal: 8, hp: 5 }, skillName: 'RENEW', skill: { healPct: 30, selfEffect: { id: 'regen', turns: 3 } } },
    SHADOW: { passive: { crit: 2, leech: 1 }, skillName: 'SHADOWSTEP', skill: { selfEffect: { id: 'trueveil', turns: 2 }, strike: 1.2 } },
    FORTUNE: { passive: { mf: 10, gf: 10 }, skillName: 'LUCKY STRIKE', skill: { selfEffect: { id: 'focus', turns: 3 } } },
};

const CORE_TIERS = [ 'LESSER', 'GREATER', 'GRAND', 'PRIME' ];

/** 9 schools x 4 tiers = 36 cores. Odd tiers grant a skill, even tiers a passive. */
export const SKILL_CORES: SkillCoreDef[] = (Object.keys(SCHOOL_DATA) as CoreSchool[]).flatMap((school) =>
    CORE_TIERS.map((tierName, i) => {
        const data = SCHOOL_DATA[school];
        const tier = i + 1;
        const id = `core_${school.toLowerCase()}_${tier}`;
        if (tier % 2 === 1) {
            return { id, name: `${tierName} ${data.skillName}`, school, tier, skill: data.skill };
        }
        const mods: StatMods = {};
        for (const [ key, value ] of Object.entries(data.passive)) {
            mods[key as keyof StatMods] = value * tier;
        }
        return { id, name: `${tierName} ${school} CORE`, school, tier, mods };
    }));

export const getCore = (id: string): SkillCoreDef | undefined => SKILL_CORES.find((c) => c.id === id);

/** Core slots unlock at hero levels 1, 10 and 20. */
export const coreSlotsFor = (level: number): number => level >= 20 ? 3 : level >= 10 ? 2 : 1;

/** Cores drop from bosses; better tiers from stronger bosses. */
export const rollCore = (rng: Rng, contentLevel: number): SkillCoreDef => {
    const maxTier = Math.min(4, 1 + Math.floor(contentLevel / 150));
    const options = SKILL_CORES.filter((c) => c.tier <= maxTier);
    return pick(rng, options);
};
