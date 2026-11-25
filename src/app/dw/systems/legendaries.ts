/**
 * Original named legendary weapons, legendary armor sets and titled boss names.
 * These are this game's own creations; they aren't taken from any other game.
 */
import { EquipSlot } from './gear';
import { Rng, pick } from './rng';
import { StatMods } from './stats';

export interface UniqueDef {
    id: string;
    name: string;
    slot: EquipSlot;
    /** Fixed modifiers in addition to rolled affixes. */
    mods: StatMods;
    lore: string;
    /** Minimum content level for it to drop. */
    level: number;
}

const u = (id: string, name: string, slot: EquipSlot, level: number, mods: StatMods, lore: string): UniqueDef =>
    ({ id, name, slot, level, mods, lore });

export const UNIQUES: UniqueDef[] = [
    u('lanternfang', 'LANTERNFANG', 'weapon', 20, { crit: 6, radiant: 20 }, 'A blade that still holds the first lantern\'s light.'),
    u('ashmourner', 'ASHMOURNER', 'weapon', 40, { fire: 30, dmg: 10 }, 'Forged in the fire that ended a kingdom.'),
    u('wintersigh', 'WINTER\'S SIGH', 'weapon', 60, { cold: 30, haste: 5 }, 'Its edge fogs the air it cuts.'),
    u('gravewhistle', 'GRAVEWHISTLE', 'weapon', 80, { necrotic: 30, leech: 4 }, 'The dead hum when it is drawn.'),
    u('stormherald', 'STORMHERALD', 'weapon', 110, { lightning: 35, crit: 4 }, 'Struck by lightning a thousand times, it learned to strike back.'),
    u('kingmaker', 'KINGMAKER', 'weapon', 150, { dmg: 25, gf: 40 }, 'Whoever holds it is followed.'),
    u('oathbreaker', 'OATHBREAKER', 'weapon', 200, { dmg: 35, critdmg: 60 }, 'It cut the bond between gods and men.'),
    u('starfall_edge', 'STARFALL EDGE', 'weapon', 300, { radiant: 50, crit: 8 }, 'Carved from a fallen star.'),
    u('dawnbreaker', 'DAWNBREAKER', 'weapon', 450, { dmg: 50, radiant: 40, hit: 6 }, 'Said to end the longest night.'),
    u('worldsunder', 'WORLDSUNDER', 'weapon', 650, { dmg: 80, critdmg: 120 }, 'Too heavy for any arm but a legend\'s.'),
    u('hollow_aegis', 'HOLLOW AEGIS', 'shield', 30, { block: 10, resist: 5 }, 'Empty inside, yet nothing gets through.'),
    u('tidewall', 'TIDEWALL', 'shield', 120, { block: 14, hp: 60 }, 'The sea itself breaks against it.'),
    u('last_bastion', 'LAST BASTION', 'shield', 400, { block: 20, acb: 6, thorns: 20 }, 'The final wall of a fallen citadel.'),
    u('mantle_of_dusk', 'MANTLE OF DUSK', 'armor', 50, { dodge: 8, necrotic: 15 }, 'Woven from the moment before night.'),
    u('emberplate', 'EMBERPLATE', 'armor', 140, { acb: 5, fire: 25, resist: 6 }, 'Always warm to the touch.'),
    u('seraph_robe', 'SERAPH ROBE', 'armor', 350, { heal: 40, mp: 50, saves: 15 }, 'Light as a feather, bright as noon.'),
];

export const getUnique = (id: string): UniqueDef | undefined => UNIQUES.find((x) => x.id === id);

export const rollUnique = (rng: Rng, contentLevel: number): UniqueDef | undefined => {
    const options = UNIQUES.filter((x) => x.level <= contentLevel + 20);
    return options.length ? pick(rng, options) : undefined;
};

/** Titles given to roaming bosses by rank. */
export const BOSS_TITLES: Record<string, string[]> = {
    F: [ 'the Lesser', 'the Wanderer' ],
    E: [ 'the Hungry', 'the Cruel' ],
    D: [ 'the Warlord', 'the Defiler' ],
    C: [ 'the Dread', 'Bane of Villages' ],
    B: [ 'the Undying', 'Breaker of Walls' ],
    A: [ 'the Tyrant', 'Lord of Ash' ],
    S: [ 'the Calamity', 'Devourer of Kings' ],
    SS: [ 'the Cataclysm', 'Eater of Stars' ],
    SSS: [ 'the Worldender', 'Last of the Old Gods' ],
};

/** A stable title for a boss from its rank and id hash. */
export const bossTitle = (rank: string, seed: number): string => {
    const titles = BOSS_TITLES[rank] ?? BOSS_TITLES.F;
    return titles[seed % titles.length];
};
