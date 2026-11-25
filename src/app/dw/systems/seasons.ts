/**
 * Quarterly seasons, the 12-chapter season journey, weekly quests, monthly events,
 * seasonal currency, a 50-tier free season pass and seasonal rank.
 * See docs/SEASONAL_SYSTEMS.md. Everything here is local to the save.
 */
import { hashString, seededRng } from './rng';

export interface SeasonDef {
    id: string;
    name: string;
    theme: string;
    currency: string;
    affix: string;
    /** Buff enemies begin with during this season's challenge fights. */
    affixBuff: string;
    events: [string, string, string];
}

export const SEASONS: SeasonDef[] = [
    { id: 'emberfall', name: 'EMBERFALL', theme: 'Ash, flame and ancient forges', currency: 'EMBER SIGILS', affix: 'CINDERBOUND', affixBuff: 'might', events: [ 'Forge Festival', 'Ashen Hunt', 'Kindling Night' ] },
    { id: 'frostwake', name: 'FROSTWAKE', theme: 'Winter, ice and northern hunts', currency: 'FROST MARKS', affix: 'PERMAFROST', affixBuff: 'fortify', events: [ 'Thaw Fair', 'Frost Hunt', 'Long Night Vigil' ] },
    { id: 'greentide', name: 'GREENTIDE', theme: 'Worldroot, wild growth and corruption', currency: 'BLOOM SEALS', affix: 'OVERGROWN', affixBuff: 'thornskin', events: [ 'Bloom Day', 'Rootwalk', 'Harvest Moon' ] },
    { id: 'suncrown', name: 'SUNCROWN', theme: 'Solar relics, storms and eclipse', currency: 'SOLAR CRESTS', affix: 'ECLIPSED', affixBuff: 'haste', events: [ 'Sunfair', 'Storm Chase', 'Eclipse Eve' ] },
];

/** The season for a date: Jan-Mar Emberfall, Apr-Jun Frostwake, Jul-Sep Greentide, Oct-Dec Suncrown (UTC). */
export const seasonFor = (date: Date): SeasonDef => SEASONS[Math.floor(date.getUTCMonth() / 3)];

export const seasonKey = (date: Date): string => `Y${date.getUTCFullYear()}_${seasonFor(date).id}`;

export const monthlyEvent = (date: Date): string => seasonFor(date).events[date.getUTCMonth() % 3];

export const eventKey = (date: Date): string => `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;

/** ISO-ish week number used for weekly quest rotation. */
export const weekKey = (date: Date): string => {
    const start = Date.UTC(date.getUTCFullYear(), 0, 1);
    const week = Math.floor((date.getTime() - start) / (7 * 86400000));
    return `${date.getUTCFullYear()}-W${week}`;
};

export type SeasonObjective = 'kills' | 'eliteKills' | 'dungeons' | 'quests' | 'worldBosses' | 'raids' | 'trials' | 'crafts' | 'keystones';

export interface JourneyChapter {
    chapter: number;
    objective: SeasonObjective;
    target: number;
    text: string;
    reward: { currency: number; renown: number; gold: number };
}

/** Objective names mapped onto this game's activities. */
export const JOURNEY: JourneyChapter[] = [
    { chapter: 1, objective: 'kills', target: 60, text: 'Defeat enemies', reward: { currency: 10, renown: 20, gold: 200 } },
    { chapter: 2, objective: 'eliteKills', target: 8, text: 'Defeat elites (monsters with jobs)', reward: { currency: 10, renown: 25, gold: 250 } },
    { chapter: 3, objective: 'dungeons', target: 2, text: 'Discover hidden places', reward: { currency: 12, renown: 30, gold: 300 } },
    { chapter: 4, objective: 'quests', target: 5, text: 'Complete weekly quests', reward: { currency: 12, renown: 30, gold: 300 } },
    { chapter: 5, objective: 'worldBosses', target: 1, text: 'Defeat a world boss', reward: { currency: 15, renown: 40, gold: 400 } },
    { chapter: 6, objective: 'raids', target: 1, text: 'Defeat a raid boss', reward: { currency: 15, renown: 40, gold: 500 } },
    { chapter: 7, objective: 'trials', target: 2, text: 'Defeat trial bosses', reward: { currency: 15, renown: 45, gold: 500 } },
    { chapter: 8, objective: 'crafts', target: 12, text: 'Craft items', reward: { currency: 18, renown: 50, gold: 600 } },
    { chapter: 9, objective: 'keystones', target: 2, text: 'Win seasonal challenge fights', reward: { currency: 18, renown: 55, gold: 700 } },
    { chapter: 10, objective: 'kills', target: 250, text: 'Defeat many enemies', reward: { currency: 20, renown: 60, gold: 800 } },
    { chapter: 11, objective: 'dungeons', target: 6, text: 'Discover more hidden places', reward: { currency: 22, renown: 70, gold: 900 } },
    { chapter: 12, objective: 'worldBosses', target: 3, text: 'Defeat world bosses', reward: { currency: 30, renown: 100, gold: 1500 } },
];

export interface WeeklyQuestDef {
    id: string;
    text: string;
    objective: SeasonObjective;
    target: number;
}

export const WEEKLY_POOL: WeeklyQuestDef[] = [
    { id: 'w_kills', text: 'Defeat 40 enemies', objective: 'kills', target: 40 },
    { id: 'w_elites', text: 'Defeat 5 elites', objective: 'eliteKills', target: 5 },
    { id: 'w_boss', text: 'Defeat a world boss', objective: 'worldBosses', target: 1 },
    { id: 'w_craft', text: 'Craft 5 items', objective: 'crafts', target: 5 },
    { id: 'w_discover', text: 'Discover a hidden place', objective: 'dungeons', target: 1 },
    { id: 'w_trial', text: 'Defeat a trial boss', objective: 'trials', target: 1 },
    { id: 'w_kills2', text: 'Defeat 80 enemies', objective: 'kills', target: 80 },
    { id: 'w_key', text: 'Win a challenge fight', objective: 'keystones', target: 1 },
    { id: 'w_raid', text: 'Defeat a raid boss', objective: 'raids', target: 1 },
];

/** Three deterministic weekly quests from the pool of nine. */
export const weeklyQuests = (date: Date): WeeklyQuestDef[] => {
    const rng = seededRng(hashString(weekKey(date)));
    const pool = WEEKLY_POOL.slice();
    const picked: WeeklyQuestDef[] = [];
    for (let i = 0; i < 3; i++) {
        picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
    return picked;
};

export interface SeasonState {
    key: string;
    progress: Partial<Record<SeasonObjective, number>>;
    claimedChapters: number[];
    currency: number;
    renown: number;
    passXp: number;
    claimedPassTiers: number[];
    weekKey: string;
    weekBaseline: Partial<Record<SeasonObjective, number>>;
    weekClaimed: string[];
    eventClaims: string[];
    /** World bosses defeated this month (enables the event cache). */
    eventBossKills: Record<string, number>;
}

export const createSeasonState = (date: Date): SeasonState => ({
    key: seasonKey(date),
    progress: {},
    claimedChapters: [],
    currency: 0,
    renown: 0,
    passXp: 0,
    claimedPassTiers: [],
    weekKey: weekKey(date),
    weekBaseline: {},
    weekClaimed: [],
    eventClaims: [],
    eventBossKills: {},
});

/** Rolls the state over when a new season or week begins. */
export const refreshSeason = (state: SeasonState, date: Date): SeasonState => {
    if (state.key !== seasonKey(date)) {
        return createSeasonState(date);
    }
    if (state.weekKey !== weekKey(date)) {
        state.weekKey = weekKey(date);
        state.weekBaseline = { ...state.progress };
        state.weekClaimed = [];
    }
    return state;
};

export const PASS_TIERS = 50;
export const PASS_XP_PER_TIER = 100;

export const recordSeasonProgress = (state: SeasonState, objective: SeasonObjective, amount = 1, date = new Date()): void => {
    state.progress[objective] = (state.progress[objective] ?? 0) + amount;
    state.passXp += amount * (objective === 'kills' ? 2 : 15);
    const key = eventKey(date);
    if (objective === 'worldBosses') {
        state.eventBossKills[key] = (state.eventBossKills[key] ?? 0) + amount;
    }
};

export const passTier = (state: SeasonState): number => Math.min(PASS_TIERS, Math.floor(state.passXp / PASS_XP_PER_TIER));

export const passTierReward = (tier: number): { gold: number; currency: number } =>
    ({ gold: 50 + tier * 20, currency: tier % 5 === 0 ? 10 : 2 });

export const chapterComplete = (state: SeasonState, chapter: JourneyChapter): boolean =>
    (state.progress[chapter.objective] ?? 0) >= chapter.target;

/** Claims a completed journey chapter; chapters must be claimed in order. */
export const claimChapter = (state: SeasonState, chapterNumber: number): JourneyChapter['reward'] | undefined => {
    const chapter = JOURNEY.find((c) => c.chapter === chapterNumber);
    if (!chapter || state.claimedChapters.includes(chapterNumber) || !chapterComplete(state, chapter)) {
        return undefined;
    }
    if (chapterNumber > 1 && !state.claimedChapters.includes(chapterNumber - 1)) {
        return undefined;
    }
    state.claimedChapters.push(chapterNumber);
    state.currency += chapter.reward.currency;
    state.renown += chapter.reward.renown;
    return chapter.reward;
};

export const weeklyProgress = (state: SeasonState, quest: WeeklyQuestDef): number =>
    (state.progress[quest.objective] ?? 0) - (state.weekBaseline[quest.objective] ?? 0);

export const claimWeekly = (state: SeasonState, quest: WeeklyQuestDef): boolean => {
    if (state.weekClaimed.includes(quest.id) || weeklyProgress(state, quest) < quest.target) {
        return false;
    }
    state.weekClaimed.push(quest.id);
    state.currency += 5;
    state.renown += 15;
    recordSeasonProgress(state, 'quests');
    return true;
};

/** The monthly event cache: once per month, after defeating a world boss that month. */
export const claimEventCache = (state: SeasonState, date: Date): boolean => {
    const key = eventKey(date);
    if (state.eventClaims.includes(key) || !(state.eventBossKills[key] ?? 0)) {
        return false;
    }
    state.eventClaims.push(key);
    state.currency += 15;
    return true;
};

export const SEASON_RANKS: [string, number][] = [
    [ 'INITIATE', 0 ], [ 'ADVENTURER', 100 ], [ 'CHAMPION', 300 ], [ 'VETERAN', 600 ], [ 'PARAGON', 1000 ],
];

export const seasonRank = (state: SeasonState): string => {
    let rank = SEASON_RANKS[0][0];
    for (const [ name, at ] of SEASON_RANKS) {
        if (state.renown >= at) {
            rank = name;
        }
    }
    return rank;
};
