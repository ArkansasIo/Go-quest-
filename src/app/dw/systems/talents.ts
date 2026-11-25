/**
 * Talent trees (docs/MMORPG_CLASS_TALENT_TREES.md). Three trees, OFFENSE, DEFENSE and
 * UTILITY, each with 4 tiers of 3 talents. A tier opens after 4 points in the tree.
 */
import { StatMods } from './stats';

export type TreeId = 'offense' | 'defense' | 'utility';

export interface TalentDef {
    id: string;
    name: string;
    tree: TreeId;
    tier: number;
    maxRank: number;
    /** Modifiers per rank. */
    perRank: StatMods;
}

const t = (tree: TreeId, tier: number, id: string, name: string, perRank: StatMods, maxRank = 3): TalentDef =>
    ({ id: `${tree}_${id}`, name, tree, tier, maxRank, perRank });

export const TALENTS: TalentDef[] = [
    t('offense', 1, 'edge', 'KEEN EDGE', { crit: 1 }),
    t('offense', 1, 'force', 'BRUTE FORCE', { dmg: 3 }),
    t('offense', 1, 'aim', 'STEADY AIM', { hit: 1 }),
    t('offense', 2, 'fury', 'FURY', { haste: 2 }),
    t('offense', 2, 'savage', 'SAVAGERY', { critdmg: 8 }),
    t('offense', 2, 'element', 'ELEMENTAL TOUCH', { fire: 4, cold: 4, lightning: 4 }),
    t('offense', 3, 'thirst', 'BLOODTHIRST', { leech: 1 }),
    t('offense', 3, 'ruin', 'RUIN', { dmg: 5 }),
    t('offense', 3, 'precise', 'PRECISION', { crit: 2 }),
    t('offense', 4, 'executioner', 'EXECUTIONER', { dmg: 10, crit: 3 }, 1),
    t('offense', 4, 'tempest', 'TEMPEST', { haste: 8 }, 1),
    t('offense', 4, 'annihilate', 'ANNIHILATION', { critdmg: 40 }, 1),
    t('defense', 1, 'hide', 'THICK HIDE', { hp: 5 }),
    t('defense', 1, 'guard', 'GUARDED', { acb: 1 }),
    t('defense', 1, 'nimble', 'NIMBLE', { dodge: 1 }),
    t('defense', 2, 'resolve', 'RESOLVE', { resist: 2 }),
    t('defense', 2, 'shield', 'SHIELD WALL', { block: 2 }),
    t('defense', 2, 'spikes', 'SPIKED', { thorns: 3 }),
    t('defense', 3, 'iron', 'IRON SKIN', { acb: 1, hp: 5 }),
    t('defense', 3, 'ward', 'WARDING', { saves: 4 }),
    t('defense', 3, 'mend', 'SECOND WIND', { heal: 6 }),
    t('defense', 4, 'bastion', 'BASTION', { resist: 8, acb: 2 }, 1),
    t('defense', 4, 'undying', 'UNDYING', { hp: 40 }, 1),
    t('defense', 4, 'phantom', 'PHANTOM', { dodge: 6 }, 1),
    t('utility', 1, 'greed', 'GREED', { gf: 5 }),
    t('utility', 1, 'scholar', 'SCHOLAR', { xp: 4 }),
    t('utility', 1, 'luck', 'LUCKY', { mf: 5 }),
    t('utility', 2, 'focus', 'FOCUS', { mp: 4 }),
    t('utility', 2, 'medic', 'MEDIC', { heal: 5 }),
    t('utility', 2, 'swift', 'SWIFT', { haste: 1, dodge: 1 }),
    t('utility', 3, 'treasure', 'TREASURE HUNTER', { mf: 8, gf: 8 }),
    t('utility', 3, 'sage', 'SAGE', { xp: 6 }),
    t('utility', 3, 'will', 'IRON WILL', { saves: 5 }),
    t('utility', 4, 'fortune', 'FORTUNE\'S FAVOR', { mf: 30, gf: 30 }, 1),
    t('utility', 4, 'prodigy', 'PRODIGY', { xp: 25 }, 1),
    t('utility', 4, 'archmage', 'ARCHMAGE', { mp: 30, fire: 10 }, 1),
];

export const TREE_NAMES: Record<TreeId, string> = { offense: 'OFFENSE', defense: 'DEFENSE', utility: 'UTILITY' };

export const POINTS_PER_TIER = 4;
export const TALENT_RESPEC_COST_PER_POINT = 50;

/** One point per level from level 5 to 30, plus one every 10 paragon ranks. */
export const talentPointsForLevel = (level: number): number =>
    Math.max(0, Math.min(level, 30) - 4) + Math.floor(Math.max(0, level - 30) / 10);

export type TalentRanks = Record<string, number>;

export const getTalent = (id: string): TalentDef | undefined => TALENTS.find((x) => x.id === id);

export const talentPointsSpent = (ranks: TalentRanks): number => Object.values(ranks).reduce((s, r) => s + r, 0);

export const pointsInTree = (ranks: TalentRanks, tree: TreeId): number =>
    Object.entries(ranks).reduce((s, [ id, r ]) => s + (getTalent(id)?.tree === tree ? r : 0), 0);

export const canLearn = (ranks: TalentRanks, level: number, talentId: string): { ok: boolean; reason?: string } => {
    const talent = getTalent(talentId);
    if (!talent) {
        return { ok: false, reason: 'No such talent.' };
    }
    if ((ranks[talentId] ?? 0) >= talent.maxRank) {
        return { ok: false, reason: 'Already at max rank.' };
    }
    if (talentPointsSpent(ranks) >= talentPointsForLevel(level)) {
        return { ok: false, reason: 'No talent points left.' };
    }
    const needed = (talent.tier - 1) * POINTS_PER_TIER;
    if (pointsInTree(ranks, talent.tree) < needed) {
        return { ok: false, reason: `Needs ${needed} points in ${TREE_NAMES[talent.tree]}.` };
    }
    return { ok: true };
};

export const learnTalent = (ranks: TalentRanks, level: number, talentId: string): boolean => {
    if (!canLearn(ranks, level, talentId).ok) {
        return false;
    }
    ranks[talentId] = (ranks[talentId] ?? 0) + 1;
    return true;
};

export const talentMods = (ranks: TalentRanks): StatMods => {
    const result: StatMods = {};
    for (const [ id, rank ] of Object.entries(ranks)) {
        const talent = getTalent(id);
        if (!talent) {
            continue;
        }
        for (const [ key, value ] of Object.entries(talent.perRank)) {
            const k = key as keyof StatMods;
            result[k] = (result[k] ?? 0) + value * rank;
        }
    }
    return result;
};
