/**
 * Achievements, titles and lifetime counters (docs/GDD.md collection pillar).
 */

export type CounterKey = 'kills' | 'bossKills' | 'secrets' | 'eggs' | 'gemsSocketed' | 'fusions' |
    'gathered' | 'crafted' | 'levelUps' | 'goldEarned' | 'jobChanges' | 'mountRides' | 'companionsRecruited' |
    'eliteKills' | 'setPieces' | 'artifacts' | 'zonesExplored' | 'instancesCleared' | 'eventsCompleted';

export type Counters = Partial<Record<CounterKey, number>>;

export interface AchievementDef {
    id: string;
    name: string;
    description: string;
    /** Unlocked when the counter reaches the target, or level reaches it. */
    counter: CounterKey | 'level';
    target: number;
    title?: string;
}

const a = (id: string, name: string, description: string, counter: CounterKey | 'level', target: number, title?: string): AchievementDef =>
    ({ id, name, description, counter, target, title });

export const ACHIEVEMENTS: AchievementDef[] = [
    a('first_blood', 'FIRST BLOOD', 'Defeat a monster.', 'kills', 1),
    a('slayer_100', 'SLAYER', 'Defeat 100 monsters.', 'kills', 100, 'the Slayer'),
    a('slayer_1000', 'SCOURGE', 'Defeat 1000 monsters.', 'kills', 1000, 'the Scourge'),
    a('elite_10', 'ELITE HUNTER', 'Defeat 10 monsters with jobs.', 'eliteKills', 10),
    a('boss_1', 'GIANT KILLER', 'Defeat a boss.', 'bossKills', 1),
    a('boss_25', 'BOSS HUNTER', 'Defeat 25 bosses.', 'bossKills', 25, 'Bossbane'),
    a('boss_100', 'LEGEND SLAYER', 'Defeat 100 bosses.', 'bossKills', 100, 'the Legend'),
    a('lv_10', 'SEASONED', 'Reach level 10.', 'level', 10),
    a('lv_30', 'CHAMPION', 'Reach level 30.', 'level', 30, 'Champion'),
    a('lv_100', 'PARAGON', 'Reach level 100.', 'level', 100, 'Paragon'),
    a('lv_720', 'ASCENDANT', 'Reach level 720.', 'level', 720, 'the Ascendant'),
    a('secret_1', 'CURIOUS', 'Find a hidden secret.', 'secrets', 1),
    a('secret_25', 'EXPLORER', 'Find 25 hidden secrets.', 'secrets', 25, 'the Explorer'),
    a('secret_100', 'CARTOGRAPHER', 'Find all 100 hidden secrets.', 'secrets', 100, 'the Cartographer'),
    a('egg_1', 'SECRET KEEPER', 'Find a button secret.', 'eggs', 1),
    a('egg_4', 'CODEBREAKER', 'Find every button secret.', 'eggs', 4, 'Codebreaker'),
    a('gem_1', 'JEWELLER', 'Socket a gem or rune.', 'gemsSocketed', 1),
    a('fuse_10', 'ALCHEMIST OF STONES', 'Fuse 10 times.', 'fusions', 10),
    a('gather_50', 'FORAGER', 'Gather 50 materials.', 'gathered', 50),
    a('craft_25', 'ARTISAN', 'Craft 25 items.', 'crafted', 25, 'the Artisan'),
    a('gold_10k', 'WEALTHY', 'Earn 10000 gold.', 'goldEarned', 10000),
    a('job_1', 'NEW CALLING', 'Change jobs.', 'jobChanges', 1),
    a('ride_1', 'RIDER', 'Ride a mount.', 'mountRides', 1),
    a('companion_1', 'FELLOWSHIP', 'Recruit a companion.', 'companionsRecruited', 1),
    a('set_3', 'COLLECTOR', 'Find 3 legendary set pieces.', 'setPieces', 3),
    a('artifact_1', 'RELIC HUNTER', 'Find an artifact or relic.', 'artifacts', 1),
    a('explore_25', 'WAYFARER', 'Explore 25 places.', 'zonesExplored', 25),
    a('explore_100', 'WORLDWALKER', 'Explore 100 places.', 'zonesExplored', 100, 'the Worldwalker'),
    a('instance_1', 'DELVER', 'Clear a dungeon, raid, trial or tower.', 'instancesCleared', 1),
    a('instance_25', 'CONQUEROR', 'Clear 25 instances.', 'instancesCleared', 25, 'the Conqueror'),
];

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;

/** Increments a counter. */
export const bump = (counters: Counters, key: CounterKey, amount = 1): void => {
    counters[key] = (counters[key] ?? 0) + amount;
};

/**
 * Returns newly unlocked achievements, recording them in <code>unlocked</code>.
 */
export const checkAchievements = (unlocked: string[], counters: Counters, level: number): AchievementDef[] => {
    const newly: AchievementDef[] = [];
    for (const ach of ACHIEVEMENTS) {
        if (unlocked.includes(ach.id)) {
            continue;
        }
        const value = ach.counter === 'level' ? level : counters[ach.counter] ?? 0;
        if (value >= ach.target) {
            unlocked.push(ach.id);
            newly.push(ach);
        }
    }
    return newly;
};

/** Titles unlocked by achievements and other sources. */
export const titlesFor = (unlocked: string[], extra: string[] = []): string[] => [
    ...ACHIEVEMENTS.filter((ach) => ach.title && unlocked.includes(ach.id)).map((ach) => ach.title!),
    ...extra,
];
