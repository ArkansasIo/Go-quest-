/**
 * Saved state of every extended system. Stored on the adventure log as <code>ext</code>,
 * so older saves without it load fine (see {@link migrateExtSave}).
 */
import { Counters } from './achievements';
import { BossProgress, createBossProgress } from './bosses';
import { CompanionState } from './companions';
import { GearEnhancement, GearInstance, SocketSlot } from './gear';
import { JobProgress } from './jobs';
import { MaterialBag, ProfessionState, SupplyId } from './professions';
import { MasteryStat } from './progression';
import { SeasonState, createSeasonState } from './seasons';
import { SocketableBag } from './sockets';
import { InstanceRecord, InstanceRun } from './instances';

export const EXT_SAVE_VERSION = 1;
export const BAG_MAX_SIZE = 30;

export interface SlotEnhancement extends GearEnhancement {
    /** Name of the Dragon Warrior item this enhancement belongs to. */
    baseName: string;
}

export interface ExtSave {
    version: number;
    race: string;
    job: string;
    supportJob?: string;
    jobs: Record<string, JobProgress>;
    masterySpent: Partial<Record<MasteryStat, number>>;
    /** Max HP / MP bonus currently folded into the hero's stats. */
    appliedHpBonus: number;
    appliedMpBonus: number;
    enhancements: Partial<Record<SocketSlot, SlotEnhancement>>;
    artifact?: GearInstance;
    relic?: GearInstance;
    bag: GearInstance[];
    gems: SocketableBag;
    runes: SocketableBag;
    bossProgress: BossProgress;
    eggs: string[];
    discoveries: string[];
    achievements: string[];
    counters: Counters;
    title?: string;
    extraTitles: string[];
    professions: Record<string, ProfessionState>;
    materials: MaterialBag;
    supplies: Partial<Record<SupplyId, number>>;
    /** Buffs from supplies applied at the start of the next battle. */
    pendingBuffs: string[];
    companions: Record<string, CompanionState>;
    activeCompanion?: string;
    mounts: string[];
    activeMount?: string;
    riding: boolean;
    season: SeasonState;
    stepsSinceGather: number;
    /** Chosen subclass per class id. */
    subclasses: Record<string, string>;
    /** Skill cores owned (ids, may repeat) and slotted. */
    cores: string[];
    equippedCores: string[];
    /** Zone, sub-zone, settlement and underground ids visited. */
    zonesVisited: string[];
    /** World tier 1-9. */
    worldTier: number;
    instances: Record<string, InstanceRecord>;
    /** Raid id -> week key of the last clear. */
    lockouts: Record<string, string>;
    activeRun?: InstanceRun;
}

export const createExtSave = (now = new Date()): ExtSave => ({
    version: EXT_SAVE_VERSION,
    race: 'hearthkin',
    job: 'hero',
    jobs: { hero: { level: 1, xp: 0 } },
    masterySpent: {},
    appliedHpBonus: 0,
    appliedMpBonus: 0,
    enhancements: {},
    bag: [],
    gems: {},
    runes: {},
    bossProgress: createBossProgress(),
    eggs: [],
    discoveries: [],
    achievements: [],
    counters: {},
    extraTitles: [],
    professions: {},
    materials: {},
    supplies: {},
    pendingBuffs: [],
    companions: {},
    mounts: [],
    riding: false,
    season: createSeasonState(now),
    stepsSinceGather: 0,
    subclasses: {},
    cores: [],
    equippedCores: [],
    zonesVisited: [],
    worldTier: 1,
    instances: {},
    lockouts: {},
});

/**
 * Fills in any fields missing from an older or partial save.
 */
export const migrateExtSave = (raw: Partial<ExtSave> | undefined, now = new Date()): ExtSave => {
    const fresh = createExtSave(now);
    if (!raw || typeof raw !== 'object') {
        return fresh;
    }
    const merged: ExtSave = { ...fresh, ...raw, version: EXT_SAVE_VERSION };
    merged.bossProgress = { ...fresh.bossProgress, ...raw.bossProgress ?? {} };
    merged.season = { ...fresh.season, ...raw.season ?? {} };
    merged.jobs = { ...fresh.jobs, ...raw.jobs ?? {} };
    if (!merged.jobs[merged.job]) {
        merged.jobs[merged.job] = { level: 1, xp: 0 };
    }
    return merged;
};
