import { describe, expect, it } from 'vitest';
import { seededRng } from './rng';
import {
    allSocketableIds, emptySockets, fuse, socketableId, insertSocketable, socketCapacity, socketFromBag, socketsMods, unsocketToBag,
} from './sockets';
import { CLASSIC_XP, checkLevelUp, levelForXp, masteryPointsForLevel, milestonesAt, xpForLevel } from './progression';
import { BOSSES, GENERATED_BOSS_COUNT, bossRank, createBossProgress, firstClearGold, recordBossVictory, rollBossRunes } from './bosses';
import { EASTER_EGGS, SequenceRecognizer, WORLD_DISCOVERIES, discover, discoverEgg, placeDiscoveries } from './discoveries';
import { aggregateEquipmentStats, createSetPiece, setBonuses, calculateGearValue, createEnhancement } from './gear';
import { EffectSet } from './effects';
import { heroHit, incomingHit } from './battleMath';
import { MATERIALS, RECIPES, buyPerk, canBuyPerk, createProfessionState, perkPointsForSkill } from './professions';
import { JOBS, RACES, rollMonsterJob, supportLevel } from './jobs';
import { MOUNTS, stableStock } from './companions';
import { claimChapter, createSeasonState, recordSeasonProgress, seasonFor, weeklyQuests } from './seasons';
import { checkAchievements } from './achievements';
import { Extended, HeroLike } from './Extended';
import { createExtSave, migrateExtSave } from './ExtSave';

const makeHero = (): HeroLike => ({
    name: 'Erdrick', level: 1, exp: 0, strength: 4, agility: 4, hp: 15, maxHp: 15, mp: 0, maxMp: 0,
    weapon: { name: 'club', displayName: 'Club' },
    armor: { name: 'clothes', displayName: 'Clothes' },
    shield: { name: 'smallShield', displayName: 'Small Shield' },
});

describe('sockets', () => {
    it('defines 81 gems and 81 runes', () => {
        expect(allSocketableIds('gem')).toHaveLength(81);
        expect(allSocketableIds('rune')).toHaveLength(81);
    });

    it('scales socket capacity with item level', () => {
        expect(socketCapacity('gem', 1)).toBe(1);
        expect(socketCapacity('gem', 181)).toBe(2);
        expect(socketCapacity('gem', 720)).toBe(4);
        expect(socketCapacity('rune', 480)).toBe(2);
        expect(socketCapacity('rune', 720)).toBe(3);
    });

    it('rejects occupied sockets and wrong kinds', () => {
        expect(insertSocketable('gem', [ 'ruby_t1' ], 0, 'ruby_t2').ok).toBe(false);
        expect(insertSocketable('gem', [ null ], 0, 'flame_t1').ok).toBe(false);
    });

    it('only consumes a gem when insertion succeeds, and refunds on extraction', () => {
        const bag: Record<string, number> = { [socketableId('ruby', 3)]: 1 };
        const result = socketFromBag('gem', bag, [ null ], 0, 'ruby_t3');
        expect(result.ok).toBe(true);
        expect(bag.ruby_t3).toBeUndefined();
        const sockets = result.ok ? result.sockets : [];
        expect(socketsMods(sockets)).toEqual({ dmg: 3 });
        expect(unsocketToBag(bag, sockets, 0).ok).toBe(true);
        expect(bag.ruby_t3).toBe(1);
    });

    it('fuses three stones into the next tier, but not past tier 9', () => {
        const bag: Record<string, number> = { [socketableId('onyx', 1)]: 4, [socketableId('onyx', 9)]: 3 };
        expect(fuse(bag, 'onyx_t1')).toEqual({ ok: true, created: 'onyx_t2' });
        expect(bag).toEqual({ [socketableId('onyx', 1)]: 1, [socketableId('onyx', 2)]: 1, [socketableId('onyx', 9)]: 3 });
        expect(fuse(bag, 'onyx_t9').ok).toBe(false);
    });
});

describe('progression', () => {
    it('keeps the classic experience table for levels 1-30', () => {
        expect(xpForLevel(2)).toBe(7);
        expect(xpForLevel(30)).toBe(CLASSIC_XP[29]);
        expect(levelForXp(0)).toBe(1);
        expect(levelForXp(23)).toBe(3);
    });

    it('continues into paragon ranks up to 720', () => {
        expect(xpForLevel(31)).toBeGreaterThan(xpForLevel(30));
        expect(levelForXp(Number.MAX_SAFE_INTEGER)).toBe(720);
    });

    it('returns stat gains and milestones on level up', () => {
        const result = checkLevelUp(1, 7);
        expect(result?.newLevel).toBe(2);
        expect(result?.gains).toEqual({ strength: 1, agility: 0, maxHp: 7, maxMp: 0 });
        expect(milestonesAt(35).map((m) => m.type)).toEqual([ 'mastery' ]);
        expect(milestonesAt(720).map((m) => m.type)).toContain('prestige');
        expect(masteryPointsForLevel(50)).toBe(5);
    });
});

describe('bosses', () => {
    it('has the named bosses plus the generated catalog', () => {
        expect(BOSSES).toHaveLength(GENERATED_BOSS_COUNT + 5);
        expect(new Set(BOSSES.map((b) => b.id)).size).toBe(BOSSES.length);
    });

    it('ranks by level', () => {
        expect(bossRank(1)).toBe('F');
        expect(bossRank(200)).toBe('C');
        expect(bossRank(700)).toBe('SSS');
    });

    it('awards first-clear rewards exactly once', () => {
        const progress = createBossProgress();
        expect(recordBossVictory(progress, 'boss_golem')).toEqual({ firstClear: true, gold: firstClearGold(40), sigils: 1, kills: 1 });
        const second = recordBossVictory(progress, 'boss_golem');
        expect(second.firstClear).toBe(false);
        expect(second.kills).toBe(2);
        expect(progress.sigils).toBe(1);
    });

    it('rolls raid boss runes from the dice', () => {
        const raid = BOSSES.find((b) => b.category === 'raid' && !b.fixed)!;
        expect(rollBossRunes(() => 0, raid)).toHaveLength(2);
        expect(rollBossRunes(() => 0.99, raid)).toEqual([]);
    });
});

describe('discoveries', () => {
    it('defines 100 world discoveries and 4 button secrets', () => {
        expect(WORLD_DISCOVERIES).toHaveLength(100);
        expect(EASTER_EGGS).toHaveLength(4);
    });

    it('recognizes a sequence in a stream of key presses', () => {
        const recognizer = new SequenceRecognizer();
        const results = [ 'R' as const, ...EASTER_EGGS[0].sequence ].map((key) => recognizer.push(key));
        expect(results[results.length - 1]?.id).toBe(EASTER_EGGS[0].id);
    });

    it('grants a button secret only once', () => {
        const found: string[] = [];
        expect(discoverEgg(found, EASTER_EGGS[1])).toBeDefined();
        expect(discoverEgg(found, EASTER_EGGS[1])).toBeUndefined();
    });

    it('places discoveries deterministically on walkable tiles', () => {
        const walkable = (row: number, col: number) => (row + col) % 3 !== 0;
        const a = placeDiscoveries('overworld', 100, 100, walkable);
        const b = placeDiscoveries('overworld', 100, 100, walkable);
        expect([ ...a.entries() ]).toEqual([ ...b.entries() ]);
        expect([ ...a.values() ].every((loc) => walkable(loc.row, loc.col))).toBe(true);
    });

    it('enforces level gates', () => {
        const d = WORLD_DISCOVERIES.find((x) => x.minLevel > 1 && x.type !== 'boss')!;
        const found: string[] = [];
        expect(discover(found, d, 1).status).toBe('too_low');
        expect(discover(found, d, 99).status).toBe('found');
        expect(discover(found, d, 99).status).toBe('already');
    });
});

describe('gear', () => {
    it('activates two- and three-piece set bonuses', () => {
        const rng = seededRng(1);
        const pieces = [ 0, 1, 2 ].map((i) => createSetPiece(rng, 'crypt_warden', i, 100)!);
        expect(setBonuses(pieces.slice(0, 1))).toEqual([]);
        expect(setBonuses(pieces.slice(0, 2))[0].pieces).toBe(2);
        expect(setBonuses(pieces)[0].mods.hp).toBe(40);
    });

    it('ignores broken gear', () => {
        const enh = createEnhancement(seededRng(2), 100, 'Epic');
        enh.durability = 0;
        expect(aggregateEquipmentStats([ enh ])).toEqual({});
    });

    it('values better gear higher', () => {
        const rng = seededRng(3);
        expect(calculateGearValue(createEnhancement(rng, 200, 'Legendary')))
            .toBeGreaterThan(calculateGearValue(createEnhancement(rng, 10, 'Common')));
    });
});

describe('effects and battle math', () => {
    it('stacks damage over time and expires effects', () => {
        const effects = new EffectSet();
        effects.apply('burning', 2);
        effects.apply('burning', 2);
        expect(effects.tick(100, () => 0).damage).toBe(2); // 2 stacks of 1d6 rolling 1
        effects.tick(100, () => 0);
        expect(effects.has('burning')).toBe(false);
    });

    it('absorbs damage with a barrier and wakes the sleeper', () => {
        const effects = new EffectSet();
        effects.apply('barrier', 5, { pool: 10 });
        effects.apply('asleep', 5);
        expect(effects.absorbDamage(15)).toBe(5);
        expect(effects.has('asleep')).toBe(false);
    });

    it('scales hero damage and resolves dodges', () => {
        expect(heroHit(() => 0.99, 10, { dmg: 50 }, 0, 0).damage).toBe(15);
        expect(incomingHit(() => 0, 10, { dodge: 40 }, 0, true).dodged).toBe(true);
        expect(incomingHit(() => 0.99, 10, { resist: 50 }, 0, true).damage).toBe(5);
    });
});

describe('professions, jobs, mounts, seasons', () => {
    it('defines 90 materials and 90 tiered recipes', () => {
        expect(MATERIALS).toHaveLength(90);
        expect(RECIPES).toHaveLength(90);
    });

    it('enforces perk tree costs and prerequisites', () => {
        const state = createProfessionState();
        state.skill = 100;
        expect(perkPointsForSkill(100)).toBe(3);
        expect(canBuyPerk(state, 'gathering', 'double_2').ok).toBe(false);
        expect(buyPerk(state, 'gathering', 'double_1')).toBe(true);
        expect(buyPerk(state, 'gathering', 'rare_2')).toBe(true);
        expect(buyPerk(state, 'gathering', 'xp_1')).toBe(false); // out of points
    });

    it('has 18 classes plus 11 advanced jobs and 15 races, and gates support levels', () => {
        expect(JOBS).toHaveLength(29);
        expect(RACES).toHaveLength(15);
        expect(supportLevel(17, 50)).toBe(0);
        expect(supportLevel(40, 12)).toBe(12);
        expect(rollMonsterJob(() => 0, true)).toBeUndefined();
    });

    it('has 120 mounts, sold from level 15', () => {
        expect(MOUNTS).toHaveLength(120);
        expect(stableStock(14, 0)).toEqual([]);
        expect(stableStock(15, 0).length).toBeGreaterThan(0);
    });

    it('picks the season by quarter and rotates three weekly quests', () => {
        expect(seasonFor(new Date(Date.UTC(2026, 0, 5))).id).toBe('emberfall');
        expect(seasonFor(new Date(Date.UTC(2026, 10, 25))).id).toBe('suncrown');
        expect(weeklyQuests(new Date(Date.UTC(2026, 10, 25)))).toHaveLength(3);
    });

    it('claims journey chapters in order once complete', () => {
        const state = createSeasonState(new Date());
        expect(claimChapter(state, 1)).toBeUndefined();
        recordSeasonProgress(state, 'kills', 60);
        expect(claimChapter(state, 1)).toBeDefined();
        expect(claimChapter(state, 1)).toBeUndefined();
    });

    it('unlocks achievements once', () => {
        const unlocked: string[] = [];
        expect(checkAchievements(unlocked, { kills: 1 }, 1).map((a) => a.id)).toEqual([ 'first_blood' ]);
        expect(checkAchievements(unlocked, { kills: 1 }, 1)).toEqual([]);
    });
});

describe('Extended', () => {
    it('migrates missing saves to defaults', () => {
        expect(migrateExtSave(undefined).job).toBe('hero');
        expect(migrateExtSave({ job: 'ronin' }).jobs.ronin).toEqual({ level: 1, xp: 0 });
    });

    it('keeps the classic starting stats for a new hero', () => {
        const ext = new Extended(createExtSave(), seededRng(4));
        const hero = makeHero();
        ext.applyDerived(hero);
        expect(hero.maxHp).toBe(15);
        expect(hero.hp).toBe(15);
    });

    it('levels the hero up on victory', () => {
        const ext = new Extended(createExtSave(), seededRng(5));
        const hero = makeHero();
        const party = { gold: 0 };
        const result = ext.onVictory({ hero, party, enemyName: 'Slime', baseXp: 10, baseGold: 5, elite: false });
        expect(hero.level).toBe(2);
        expect(hero.maxHp).toBe(22);
        expect(party.gold).toBe(5);
        expect(result.lines.some((l) => l.includes('promoted'))).toBe(true);
        expect(ext.save.achievements).toContain('first_blood');
    });

    it('applies and removes gem HP bonuses through applyDerived', () => {
        const ext = new Extended(createExtSave(), seededRng(6));
        const hero = makeHero();
        ext.applyDerived(hero);
        ext.save.gems = { [socketableId('amethyst', 2)]: 1 };
        expect(ext.socket('gem', 'armor', 'amethyst_t2').ok).toBe(true);
        ext.applyDerived(hero);
        expect(hero.maxHp).toBe(25);
        ext.unsocket('gem', 'armor', 0);
        ext.applyDerived(hero);
        expect(hero.maxHp).toBe(15);
    });

    it('only allows job changes in towns', () => {
        const ext = new Extended(createExtSave(), seededRng(7));
        expect(ext.changeJob('ronin', 'overworld').ok).toBe(false);
        expect(ext.changeJob('ronin', 'brecconary').ok).toBe(true);
        expect(ext.save.job).toBe('ronin');
    });

    it('sizes empty sockets by item level', () => {
        expect(emptySockets('gem', 400)).toEqual([ null, null, null ]);
    });
});
