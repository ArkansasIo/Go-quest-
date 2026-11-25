/**
 * World events and the group finder.
 *
 * World events rotate every hour (real time) across the overworld zones. While the hero is
 * in the event's zone, random encounters become event foes; defeating enough of them
 * completes the event once per rotation.
 *
 * The group finder matches the hero with NPC adventurers for a role-based dungeon run.
 * (There are no other real players: this is a single-player game.)
 */
import { Role } from './jobs';
import { Rng, hashString, pick, seededRng } from './rng';
import { ZONES, ZoneDef } from './world';

export type EventKind = 'invasion' | 'world_boss' | 'treasure_beast' | 'blood_moon' | 'meteor';

export interface EventDef {
    kind: EventKind;
    name: string;
    description: string;
    /** Foes to defeat to complete. */
    goal: number;
    /** Enemy key used for event foes. */
    enemy: string;
    /** Multipliers on event foes. */
    hpMult: number;
    strMult: number;
    rewardGold: number;
    rewardXp: number;
}

export const EVENT_TYPES: EventDef[] = [
    { kind: 'invasion', name: 'INVASION', description: 'Monsters pour from a rift. Drive them back!', goal: 6, enemy: 'Skeleton', hpMult: 1.5, strMult: 1.2, rewardGold: 400, rewardXp: 300 },
    { kind: 'world_boss', name: 'WORLD BOSS', description: 'A colossal foe stalks the land.', goal: 1, enemy: 'Golem', hpMult: 6, strMult: 1.6, rewardGold: 1500, rewardXp: 1200 },
    { kind: 'treasure_beast', name: 'TREASURE BEAST', description: 'A gold-laden beast flees. Catch it!', goal: 1, enemy: 'Goldman', hpMult: 2, strMult: 0.6, rewardGold: 2500, rewardXp: 200 },
    { kind: 'blood_moon', name: 'BLOOD MOON', description: 'Undead rise under a red moon.', goal: 8, enemy: 'Wraith', hpMult: 1.4, strMult: 1.3, rewardGold: 600, rewardXp: 500 },
    { kind: 'meteor', name: 'FALLEN STAR', description: 'A meteor fell; creatures guard its ore.', goal: 4, enemy: 'Stoneman', hpMult: 1.2, strMult: 1.1, rewardGold: 800, rewardXp: 400 },
];

export const EVENT_PERIOD_MS = 60 * 60 * 1000;

export interface ActiveEvent {
    key: string;
    def: EventDef;
    zone: ZoneDef;
    endsAt: number;
}

/** The current world event: stable for each hour. */
export const currentEvent = (now = Date.now()): ActiveEvent => {
    const slot = Math.floor(now / EVENT_PERIOD_MS);
    const rng: Rng = seededRng(hashString(`event:${slot}`));
    const def = pick(rng, EVENT_TYPES);
    // Events favour the gentler western half so early heroes can join
    const zone = pick(rng, ZONES.filter((z) => z.gridCol < 7));
    return { key: `ev${slot}`, def, zone, endsAt: (slot + 1) * EVENT_PERIOD_MS };
};

export interface EventProgress {
    key: string;
    kills: number;
    claimed: boolean;
}

export const minutesLeft = (event: ActiveEvent, now = Date.now()): number => Math.max(0, Math.ceil((event.endsAt - now) / 60000));

// ---------------------------------------------------------------------------
// Group finder

export interface Adventurer {
    name: string;
    role: Role;
    /** Contribution per turn: damage multiplier or heal %. */
    power: number;
}

const ADVENTURER_NAMES = [ 'Aria', 'Bram', 'Cora', 'Dain', 'Elsa', 'Finn', 'Gwen', 'Holt', 'Iris', 'Jory', 'Kael', 'Lyra',
    'Moss', 'Nell', 'Oren', 'Pia', 'Quin', 'Rook', 'Sage', 'Tam', 'Una', 'Vale', 'Wren', 'Yara' ];

/** Builds a five-member group (1 tank, 1 healer, 3 dps) around the hero's role. */
export const formGroup = (rng: Rng, heroRole: Role): Adventurer[] => {
    const needed: Role[] = [ 'tank', 'healer', 'dps', 'dps', 'dps' ];
    needed.splice(needed.indexOf(heroRole), 1);
    const names = ADVENTURER_NAMES.slice();
    return needed.map((role) => {
        const name = names.splice(Math.floor(rng() * names.length), 1)[0];
        return { name, role, power: role === 'healer' ? 8 : role === 'tank' ? 0.2 : 0.3 };
    });
};

/** Queue wait in seconds: healers and tanks are always in demand. */
export const queueTime = (role: Role): number => role === 'dps' ? 12 : 3;

/** Bonus gold for finishing a group finder run, for the role in demand. */
export const groupFinderBonus = (role: Role): number => role === 'dps' ? 100 : 250;
