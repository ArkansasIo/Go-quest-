/**
 * Level progression. Levels 1-30 follow the classic Dragon Warrior experience and stat
 * table (keeping the game authentic). Levels 31-720 are Paragon ranks (docs/LEVEL_1_TO_720.md):
 * a tunable quadratic XP curve with milestone rewards instead of unbounded stat growth.
 */

export interface LevelStats {
    strength: number;
    agility: number;
    maxHp: number;
    maxMp: number;
}

/** Experience needed to reach each level 1-30 (index 0 = level 1). */
export const CLASSIC_XP: readonly number[] = [
    0, 7, 23, 47, 110, 220, 450, 800, 1300, 2000,
    2900, 4000, 5500, 7500, 10000, 13000, 16000, 19000, 22000, 26000,
    30000, 34000, 38000, 42000, 46000, 50000, 54000, 58000, 62000, 65535,
];

/** Base stats for each level 1-30 (strength, agility, max HP, max MP). */
export const CLASSIC_STATS: readonly LevelStats[] = [
    [ 4, 4, 15, 0 ], [ 5, 4, 22, 0 ], [ 7, 6, 24, 5 ], [ 7, 8, 31, 16 ], [ 12, 10, 35, 20 ],
    [ 16, 10, 38, 24 ], [ 18, 17, 40, 26 ], [ 22, 20, 46, 29 ], [ 30, 22, 50, 36 ], [ 35, 31, 54, 40 ],
    [ 40, 35, 62, 50 ], [ 48, 40, 63, 58 ], [ 52, 48, 70, 64 ], [ 60, 55, 78, 70 ], [ 68, 64, 86, 72 ],
    [ 72, 70, 92, 95 ], [ 72, 78, 100, 100 ], [ 85, 84, 115, 108 ], [ 87, 86, 130, 115 ], [ 92, 88, 138, 128 ],
    [ 95, 90, 149, 135 ], [ 97, 90, 158, 146 ], [ 99, 94, 165, 153 ], [ 103, 98, 170, 161 ], [ 113, 100, 174, 161 ],
    [ 117, 105, 180, 168 ], [ 125, 107, 189, 175 ], [ 130, 115, 195, 180 ], [ 135, 120, 200, 190 ], [ 140, 130, 210, 200 ],
].map(([ strength, agility, maxHp, maxMp ]) => ({ strength, agility, maxHp, maxMp }));

export const CLASSIC_MAX_LEVEL = 30;
export const MAX_LEVEL = 720;

/** Experience needed to reach a level (1-720). */
export const xpForLevel = (level: number): number => {
    if (level <= 1) {
        return 0;
    }
    if (level <= CLASSIC_MAX_LEVEL) {
        return CLASSIC_XP[level - 1];
    }
    const rank = Math.min(level, MAX_LEVEL) - CLASSIC_MAX_LEVEL;
    return CLASSIC_XP[CLASSIC_MAX_LEVEL - 1] + rank * 2500 + rank * rank * 40;
};

export const levelForXp = (xp: number): number => {
    let level = 1;
    while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) {
        level++;
    }
    return level;
};

export const xpToNextLevel = (level: number, xp: number): number =>
    level >= MAX_LEVEL ? 0 : Math.max(0, xpForLevel(level + 1) - xp);

export const isParagon = (level: number): boolean => level > CLASSIC_MAX_LEVEL;

export const paragonRank = (level: number): number => Math.max(0, level - CLASSIC_MAX_LEVEL);

/** Base stats for a level; Paragon ranks keep level 30's base (growth comes from mastery). */
export const statsForLevel = (level: number): LevelStats => {
    return CLASSIC_STATS[Math.min(Math.max(level, 1), CLASSIC_MAX_LEVEL) - 1];
};

export type MilestoneType = 'mastery' | 'title' | 'perk' | 'renown' | 'prestige';

export interface Milestone {
    level: number;
    type: MilestoneType;
    text: string;
}

/** Milestones earned on reaching a given level. */
export const milestonesAt = (level: number): Milestone[] => {
    const rank = paragonRank(level);
    if (rank <= 0) {
        return [];
    }
    const result: Milestone[] = [];
    if (rank % 5 === 0) {
        result.push({ level, type: 'mastery', text: 'Thou hast earned a mastery point.' });
    }
    if (rank % 10 === 0) {
        result.push({ level, type: 'title', text: `Title earned: Paragon ${rank}.` });
    }
    if (rank % 20 === 0) {
        result.push({ level, type: 'perk', text: 'A specialization perk awaits thee.' });
    }
    if (rank % 50 === 0) {
        result.push({ level, type: 'renown', text: 'Thy renown spreads across the land.' });
    }
    if (level === MAX_LEVEL) {
        result.push({ level, type: 'prestige', text: 'Thou art a Legend of Alefgard!' });
    }
    return result;
};

/** Mastery points: one every 5 Paragon ranks, plus one per specialization perk milestone. */
export const masteryPointsForLevel = (level: number): number => {
    const rank = paragonRank(level);
    return Math.floor(rank / 5) + Math.floor(rank / 20);
};

export type MasteryStat = 'strength' | 'agility' | 'maxHp' | 'maxMp';

/** How much one mastery point adds. */
export const MASTERY_GAIN: Record<MasteryStat, number> = { strength: 2, agility: 2, maxHp: 6, maxMp: 4 };

export interface LevelUpResult {
    oldLevel: number;
    newLevel: number;
    gains: LevelStats;
    milestones: Milestone[];
}

/**
 * Computes the result of gaining XP. Stat gains are the difference between the base
 * stats of the old and new level.
 */
export const checkLevelUp = (oldLevel: number, xp: number): LevelUpResult | undefined => {
    const newLevel = levelForXp(xp);
    if (newLevel <= oldLevel) {
        return undefined;
    }
    const before = statsForLevel(oldLevel);
    const after = statsForLevel(newLevel);
    const milestones: Milestone[] = [];
    for (let l = oldLevel + 1; l <= newLevel; l++) {
        milestones.push(...milestonesAt(l));
    }
    return {
        oldLevel, newLevel, milestones,
        gains: {
            strength: after.strength - before.strength,
            agility: after.agility - before.agility,
            maxHp: after.maxHp - before.maxHp,
            maxMp: after.maxMp - before.maxMp,
        },
    };
};
