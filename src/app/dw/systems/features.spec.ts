import { describe, expect, it } from 'vitest';
import { seededRng } from './rng';
import { STORY, abilityCheck, createStoryProgress, currentAct, proficiencyBonus } from './story';
import { computeAttributes } from './characters';
import { MAX_UPGRADE, armoryStock, attemptUpgrade, masteryRank, upgradeChance, upgradeMods, weaponTypeOf } from './armory';
import { canLearn, learnTalent, talentMods, talentPointsForLevel } from './talents';
import { extractAspect, forgeAffix, salvageShards } from './forge';
import { createEnhancement } from './gear';
import { EVENT_PERIOD_MS, currentEvent, formGroup } from './events';
import { knownSpells } from './spells';
import { Extended } from './Extended';
import { createExtSave } from './ExtSave';

describe('story', () => {
    it('has 12 acts across 4 tiers with rising levels', () => {
        expect(STORY).toHaveLength(12);
        expect(new Set(STORY.map((a) => a.tier)).size).toBe(4);
        expect(STORY.every((act) => act.chapters.length === 3)).toBe(true);
        expect(STORY.every((act, i) => i === 0 || act.level > STORY[i - 1].level)).toBe(true);
    });

    it('uses the 5e proficiency bonus', () => {
        expect(proficiencyBonus(1)).toBe(2);
        expect(proficiencyBonus(5)).toBe(3);
        expect(proficiencyBonus(17)).toBe(6);
        expect(proficiencyBonus(30)).toBe(6);
    });

    it('treats natural 20s and 1s as automatic results', () => {
        const check = { ...STORY[11].check, dc: 30 };
        const scores = computeAttributes('hearthkin', 'hero');
        expect(abilityCheck(() => 0.999, check, scores, 1)).toMatchObject({ roll: 20, success: true, critical: 'nat20' });
        expect(abilityCheck(() => 0, { ...check, dc: 1 }, scores, 1)).toMatchObject({ roll: 1, success: false, critical: 'nat1' });
    });

    it('completes acts once and in order', () => {
        const ext = new Extended(createExtSave(), seededRng(1));
        const hero = { name: 'Hero', level: 1, exp: 0, strength: 4, agility: 4, hp: 15, maxHp: 15, mp: 0, maxMp: 0 };
        const party = { gold: 0 };
        expect(currentAct(ext.save.story)?.act).toBe(1);
        expect(ext.completeAct(1, hero, party).length).toBeGreaterThan(0);
        expect(ext.completeAct(1, hero, party)).toEqual([]);
        expect(currentAct(ext.save.story)?.act).toBe(2);
        expect(createStoryProgress().completed).toBe(0);
    });
});

describe('armory', () => {
    it('always succeeds early, gets risky later, and drops a level on high failures', () => {
        expect(upgradeChance(0)).toBe(1);
        expect(upgradeChance(12)).toBeLessThan(0.5);
        expect(attemptUpgrade(() => 0.99, 9)).toEqual({ outcome: 'downgrade', level: 8 });
        expect(attemptUpgrade(() => 0.99, 6)).toEqual({ outcome: 'fail', level: 6 });
        expect(MAX_UPGRADE).toBe(15);
        expect(upgradeMods('weapon', 4)).toEqual({ hit: 2, dmg: 12 });
    });

    it('tracks mastery by weapon type', () => {
        expect(weaponTypeOf('club', undefined)).toBe('mace');
        expect(weaponTypeOf('club', 'Runed Katana')).toBe('katana');
        expect(masteryRank(0)).toBe(0);
        expect(masteryRank(100)).toBe(4);
    });

    it('stocks every weapon, armor and shield type', () => {
        expect(armoryStock(40)).toHaveLength(14 + 4 + 3);
    });
});

describe('talents, forge, events, spells', () => {
    it('gates talent tiers behind points in the tree', () => {
        const ranks: Record<string, number> = {};
        expect(talentPointsForLevel(4)).toBe(0);
        expect(canLearn(ranks, 30, 'offense_executioner').ok).toBe(false);
        learnTalent(ranks, 30, 'offense_edge');
        learnTalent(ranks, 30, 'offense_edge');
        learnTalent(ranks, 30, 'offense_edge');
        learnTalent(ranks, 30, 'offense_force');
        expect(canLearn(ranks, 30, 'offense_fury').ok).toBe(true);
        expect(talentMods(ranks)).toEqual({ crit: 3, dmg: 3 });
    });

    it('salvages, extracts aspects only from legendaries, and spends potential', () => {
        const rng = seededRng(2);
        const common = createEnhancement(rng, 50, 'Common');
        const legendary = createEnhancement(rng, 50, 'Legendary');
        expect(salvageShards(legendary)).toBeGreaterThan(salvageShards(common));
        expect(extractAspect(common)).toBeUndefined();
        expect(extractAspect(legendary)).toBeDefined();
        expect(forgeAffix(rng, common, 0, 'dmg').ok).toBe(false);
        expect(forgeAffix(rng, common, 10, 'dmg').ok).toBe(true);
    });

    it('rotates world events hourly and forms groups around the hero role', () => {
        const first = currentEvent(0);
        expect(currentEvent(EVENT_PERIOD_MS - 1).key).toBe(first.key);
        expect(currentEvent(EVENT_PERIOD_MS).key).not.toBe(first.key);
        const group = formGroup(seededRng(3), 'healer');
        expect(group.map((g) => g.role).sort()).toEqual([ 'dps', 'dps', 'dps', 'tank' ]);
    });

    it('teaches class spells by job level', () => {
        expect(knownSpells('arcanist', 1).map((s) => s.id)).toEqual([ 'heal', 'hurt', 'emberdart' ]);
        expect(knownSpells('arcanist', 25).some((s) => s.id === 'meteor')).toBe(true);
    });
});
