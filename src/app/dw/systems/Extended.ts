/**
 * Orchestrates every extended system on top of the classic game: derived stats, rewards,
 * level ups, loot, jobs, gear, sockets, professions, companions, mounts, seasons and
 * achievements. It works on plain hero/party shapes so it can be unit tested without a
 * canvas or the gtp engine.
 */
import { AchievementDef, CounterKey, bump, checkAchievements, titlesFor } from './achievements';
import {
    BossDef, SET_PIECE_CHANCE, getBoss, recordBossVictory, rollBossGem, rollBossRunes,
} from './bosses';
import {
    COMPANIONS, CompanionState, MountDef, Stance, addAffinity, affinityForGift, affinityForVictory, bondTier,
    getCompanion, getMount, mountPrice, rollMountDrop, ENCOUNTER_MULT,
} from './companions';
import { Reward, getDiscovery } from './discoveries';
import { BAG_MAX_SIZE, ExtSave, SlotEnhancement } from './ExtSave';
import {
    EquipSlot, GearEnhancement, GearInstance, LEGENDARY_SETS, QUALITIES, SocketSlot, aggregateEquipmentStats,
    createEnhancement, createGearInstance, createSetPiece, gearDisplayName, quoteVendorPrice, repairCost,
} from './gear';
import {
    JOBS, RACES, addJobXp, getJob, getRace, isTown, supportLevel, supportTraitMods, SUPPORT_UNLOCK_LEVEL,
    Role } from './jobs';
import {
    MaterialFamily, PROFESSIONS, RecipeDef, SUPPLIES, SupplyId, contentLevel, craft, createProfessionState,
    gather, getMaterial, getProfession, lessonCap, lessonCost, perkValue, MATERIALS,
} from './professions';
import { MASTERY_GAIN, MasteryStat, checkLevelUp, masteryPointsForLevel } from './progression';
import { Rng, chance, defaultRng, pick } from './rng';
import { SeasonObjective, recordSeasonProgress, refreshSeason , weekKey } from './seasons';
import {
    GEM_FAMILIES, RUNE_FAMILIES, SocketKind, addToBag, fuse, socketFromBag, socketableId, socketableName,
    tierForItemLevel, unsocketToBag, emptySockets, socketCapacity,
} from './sockets';
import { StatMods, SubstatKey, addMods, capMods } from './stats';
import { TALENT_RESPEC_COST_PER_POINT, canLearn, getTalent, learnTalent, talentMods, talentPointsForLevel, talentPointsSpent } from './talents';
import { FORGE_SHARD_COST, IMPRINT_COST, extractAspect, forgeAffix, imprintAspect, initialPotential, salvageShards } from './forge';
import { Adventurer, EventProgress, currentEvent, formGroup, groupFinderBonus, queueTime } from './events';
import { rollUnique } from './legendaries';
import { CHECK_REWARD_BONUS, STORY, abilityCheck, currentAct, getAct } from './story';
import {
    ArmoryItem, MAX_UPGRADE, UpgradeSlot, attemptUpgrade, masteryMods, masteryRank, upgradeCost, weaponTypeOf,
} from './armory';
import {
    AttributeScores, SUBCLASS_LEVEL, SkillCoreDef, attributeMods, computeAttributes, coreSlotsFor, getClass, getCore,
    getSubclass, rollCore, rollGearBase,
} from './characters';
import {
    MAX_WORLD_TIER, WORLD_TIER_NAMES, availableInstances, getInstance, heroContentLevel, instanceBoss, instanceClearGold, isLockedOut,
    stageEnemy, worldTierScaling, worldTierUnlockLevel,
} from './instances';

export interface EquipmentLike {
    name: string;
    displayName: string;
}

export interface HeroLike {
    name: string;
    level: number;
    exp: number;
    strength: number;
    agility: number;
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    weapon?: EquipmentLike;
    armor?: EquipmentLike;
    shield?: EquipmentLike;
}

export interface PartyLike {
    gold: number;
}

/** Dragon Warrior caps gold at 9999 on screen; the extended game allows more. */
export const GOLD_CAP = 999999;

export interface VictoryContext {
    hero: HeroLike;
    party: PartyLike;
    enemyName: string;
    baseXp: number;
    baseGold: number;
    bossId?: string;
    elite: boolean;
    discoveryId?: string;
}

export interface VictoryResult {
    xp: number;
    gold: number;
    lines: string[];
}

export class Extended {

    save: ExtSave;
    private readonly rng: Rng;

    constructor(save: ExtSave, rng: Rng = defaultRng) {
        this.save = save;
        this.rng = rng;
    }

    // -----------------------------------------------------------------------
    // Equipment enhancements and derived stats

    /**
     * Makes sure each equipped Dragon Warrior item has an enhancement record. Equipping a
     * different item (shop, chest, cheat) gives it a fresh Common enhancement.
     */
    syncEnhancements(hero: HeroLike): void {
        const slots: [SocketSlot, EquipmentLike | undefined][] = [
            [ 'weapon', hero.weapon ], [ 'armor', hero.armor ], [ 'shield', hero.shield ],
        ];
        for (const [ slot, item ] of slots) {
            const current = this.save.enhancements[slot];
            if (!item) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete this.save.enhancements[slot];
            } else if (current?.baseName !== item.name) {
                const enh = createEnhancement(this.rng, Math.max(1, Math.round(contentLevel(hero.level))), 'Common');
                this.save.enhancements[slot] = { ...enh, baseName: item.name };
            }
        }
    }

    /** All equipped extended gear pieces, with their slot. */
    equippedPieces(): (GearEnhancement & { slot: EquipSlot; catalogIndex?: number })[] {
        const pieces: (GearEnhancement & { slot: EquipSlot; catalogIndex?: number })[] = [];
        for (const slot of [ 'weapon', 'armor', 'shield' ] as SocketSlot[]) {
            const enh = this.save.enhancements[slot];
            if (enh) {
                pieces.push({ ...enh, slot });
            }
        }
        if (this.save.artifact) {
            pieces.push(this.save.artifact);
        }
        if (this.save.relic) {
            pieces.push(this.save.relic);
        }
        return pieces;
    }

    companionMods(): StatMods {
        const id = this.save.activeCompanion;
        const state = id ? this.save.companions[id] : undefined;
        return state ? bondTier(state.affinity).mods : {};
    }

    jobMods(hero: HeroLike): StatMods {
        const main = getJob(this.save.job);
        let support: StatMods = {};
        if (this.save.supportJob && hero.level >= SUPPORT_UNLOCK_LEVEL) {
            const supJob = getJob(this.save.supportJob);
            const supLevel = supportLevel(this.jobLevel(this.save.job), this.jobLevel(supJob.id));
            support = supportTraitMods(supJob, supLevel);
        }
        return addMods(main.mods, support);
    }

    /** Every passive modifier on the hero, capped to gear caps. */
    derivedMods(hero: HeroLike): StatMods {
        return capMods(addMods(
            getRace(this.save.race).mods,
            this.jobMods(hero),
            attributeMods(this.attributes()),
            getSubclass(this.save.job, this.save.subclasses[this.save.job])?.mods,
            ...this.save.equippedCores.map((id) => getCore(id)?.mods),
            talentMods(this.save.talents),
            masteryMods(this.weaponMasteryRank(hero)),
            aggregateEquipmentStats(this.equippedPieces()),
            this.companionMods(),
        ));
    }

    // -----------------------------------------------------------------------
    // Attributes, subclasses and skill cores

    attributes(): AttributeScores {
        return computeAttributes(this.save.race, this.save.job);
    }

    chooseSubclass(subclassId: string, hero: HeroLike): { ok: boolean; message: string } {
        const cls = getClass(this.save.job);
        if (!cls) {
            return { ok: false, message: 'Advanced jobs have no subclasses.' };
        }
        if (this.jobLevel(cls.id) < SUBCLASS_LEVEL) {
            return { ok: false, message: `Subclasses unlock at ${cls.name} level ${SUBCLASS_LEVEL}.` };
        }
        const sub = cls.subclasses.find((s) => s.id === subclassId);
        if (!sub) {
            return { ok: false, message: 'No such subclass.' };
        }
        this.save.subclasses[cls.id] = sub.id;
        this.applyDerived(hero);
        return { ok: true, message: `Thou art now a ${sub.name} ${cls.name}.` };
    }

    equipCore(coreId: string, hero: HeroLike): { ok: boolean; message: string } {
        const owned = this.save.cores.filter((c) => c === coreId).length;
        const slotted = this.save.equippedCores.filter((c) => c === coreId).length;
        if (owned <= slotted) {
            return { ok: false, message: 'Thou hast no spare core of that kind.' };
        }
        if (this.save.equippedCores.length >= coreSlotsFor(hero.level)) {
            return { ok: false, message: 'Every core slot is full. Remove a core first.' };
        }
        this.save.equippedCores.push(coreId);
        this.applyDerived(hero);
        return { ok: true, message: `${getCore(coreId)?.name ?? 'Core'} slotted.` };
    }

    unequipCore(index: number, hero: HeroLike): string {
        const [ removed ] = this.save.equippedCores.splice(index, 1);
        this.applyDerived(hero);
        return removed ? `${getCore(removed)?.name ?? 'Core'} removed.` : 'Nothing there.';
    }

    /** Battle skills granted by slotted cores. */
    coreSkills(): { name: string; skill: NonNullable<SkillCoreDef['skill']> }[] {
        return this.save.equippedCores.map((id) => getCore(id)).filter((c): c is SkillCoreDef => !!c?.skill)
            .map((c) => ({ name: c.name, skill: c.skill! }));
    }

    // -----------------------------------------------------------------------
    // Exploration and world tier

    /** Records a visit; returns true the first time. */
    visit(locationId: string): boolean {
        if (this.save.zonesVisited.includes(locationId)) {
            return false;
        }
        this.save.zonesVisited.push(locationId);
        bump(this.save.counters, 'zonesExplored');
        return true;
    }

    setWorldTier(tier: number, hero: HeroLike): { ok: boolean; message: string } {
        if (tier < 1 || tier > MAX_WORLD_TIER) {
            return { ok: false, message: 'No such world tier.' };
        }
        if (hero.level < worldTierUnlockLevel(tier)) {
            return { ok: false, message: `World tier ${tier} unlocks at level ${worldTierUnlockLevel(tier)}.` };
        }
        this.save.worldTier = tier;
        return { ok: true, message: `World tier is now ${tier}: ${WORLD_TIER_NAMES[tier - 1]}.` };
    }

    // -----------------------------------------------------------------------
    // Instances (dungeons, raids, trials, towers)

    startRun(instanceId: string, hero: HeroLike): { ok: boolean; message: string } {
        const instance = getInstance(instanceId);
        if (!instance) {
            return { ok: false, message: 'No such place.' };
        }
        if (isLockedOut(this.save.lockouts, instance)) {
            return { ok: false, message: 'Thou hast cleared this raid this week. It resets next week.' };
        }
        if (heroContentLevel(hero.level) + 20 < instance.level) {
            return { ok: false, message: 'Thou art not strong enough to enter.' };
        }
        this.save.activeRun = { instanceId, stage: 0 };
        return { ok: true, message: `Thou enterest ${instance.name}.` };
    }

    /** The encounter for the current stage of the active run. */
    currentRunEncounter(): { enemy: string; bossId?: string; label: string } | undefined {
        const run = this.save.activeRun;
        const instance = run ? getInstance(run.instanceId) : undefined;
        if (!run || !instance) {
            return undefined;
        }
        if (run.stage >= instance.stages) {
            const boss = instanceBoss(instance);
            return { enemy: boss.baseEnemy, bossId: boss.id, label: `${instance.name}: BOSS` };
        }
        return { enemy: stageEnemy(instance, run.stage), label: `${instance.name} ${run.stage + 1}/${instance.stages}` };
    }

    /**
     * Advances the run after a victory. Returns lines, and whether the run is complete.
     */
    advanceRun(party: PartyLike): { done: boolean; lines: string[] } {
        const run = this.save.activeRun;
        const instance = run ? getInstance(run.instanceId) : undefined;
        if (!run || !instance) {
            return { done: true, lines: [] };
        }
        if (run.stage < instance.stages) {
            run.stage++;
            return { done: false, lines: [] };
        }
        // Boss defeated: the run is complete
        delete this.save.activeRun;
        const record = this.save.instances[instance.id] ??= { clears: 0 };
        const first = record.clears === 0;
        record.clears++;
        record.lastClear = new Date().toISOString();
        if (instance.kind === 'raid') {
            this.save.lockouts[instance.id] = weekKey(new Date());
        }
        if (instance.kind === 'tower') {
            record.best = Math.max(record.best ?? 0, instance.stages);
        }
        const objective: Record<string, SeasonObjective> = { dungeon: 'dungeons', raid: 'raids', trial: 'trials', tower: 'trials' };
        this.record(objective[instance.kind], 'instancesCleared');
        const lines = [ `Thou hast conquered ${instance.name}!` ];
        if (this.save.groupRole) {
            const bonus = groupFinderBonus(this.save.groupRole);
            this.addGold(party, bonus);
            lines.push(`Group finder bonus: ${bonus} gold. Thy party disbands.`);
            delete this.save.groupRole;
        }
        if (first) {
            const gold = Math.round(instanceClearGold(instance) * worldTierScaling(this.save.worldTier).rewardMult);
            this.addGold(party, gold);
            lines.push(`First clear chest: ${gold} gold.`);
        }
        return { done: true, lines };
    }

    // -----------------------------------------------------------------------
    // Story

    /** Rolls the current act's 5e ability check once. */
    rollStoryCheck(hero: HeroLike): { ok: boolean; lines: string[] } {
        const act = currentAct(this.save.story);
        if (!act) {
            return { ok: false, lines: [ 'Thy legend is complete.' ] };
        }
        if (act.act in this.save.story.checks) {
            return { ok: false, lines: [ 'Thou hast already made this check.' ] };
        }
        const r = abilityCheck(this.rng, act.check, this.attributes(), hero.level);
        this.save.story.checks[act.act] = r.success;
        const crit = r.critical === 'nat20' ? ' NATURAL 20!' : r.critical === 'nat1' ? ' NATURAL 1!' : '';
        return { ok: true, lines: [
            `${act.check.skill} check (${act.check.ability}) DC ${r.dc}:`,
            `d20 = ${r.roll}, +${r.modifier} = ${r.total}.${crit} ${r.success ? 'SUCCESS' : 'FAILURE'}`,
            r.success ? act.check.success : act.check.failure,
        ] };
    }

    /** Completes an act after its villain falls; returns narrative and reward lines. */
    completeAct(actNumber: number, hero: HeroLike, party: PartyLike): string[] {
        const act = getAct(actNumber);
        if (!act || this.save.story.completed >= actNumber) {
            return [];
        }
        this.save.story.completed = actNumber;
        const bonus = this.save.story.checks[actNumber] ? CHECK_REWARD_BONUS : 1;
        const gold = Math.round(act.reward.gold * bonus);
        const xp = Math.round(act.reward.xp * bonus);
        this.addGold(party, gold);
        const lines = [ act.finale, `ACT ${act.act} COMPLETE: ${act.title}`, `Thou earnest ${gold} gold.` ];
        lines.push(...this.gainExperience(hero, xp));
        if (actNumber === STORY.length) {
            this.save.extraTitles.push('the Souldcrest');
            lines.push('Title earned: the Souldcrest.');
        }
        return lines;
    }

    // -----------------------------------------------------------------------
    // Weapon mastery, upgrades and the armory

    currentWeaponType(hero: HeroLike): string {
        return weaponTypeOf(hero.weapon?.name, this.save.enhancements.weapon?.name);
    }

    weaponMasteryRank(hero: HeroLike): number {
        return masteryRank(this.save.weaponKills[this.currentWeaponType(hero)] ?? 0);
    }

    /** Counts a kill toward the equipped weapon's mastery; returns a line on rank up. */
    addWeaponKill(hero: HeroLike): string | undefined {
        const type = this.currentWeaponType(hero);
        const before = masteryRank(this.save.weaponKills[type] ?? 0);
        this.save.weaponKills[type] = (this.save.weaponKills[type] ?? 0) + 1;
        const after = masteryRank(this.save.weaponKills[type]);
        return after > before ? `${type.toUpperCase()} mastery rank ${after}!` : undefined;
    }

    upgradeGear(slot: UpgradeSlot, hero: HeroLike, party: PartyLike): { ok: boolean; message: string } {
        const gear = this.save.enhancements[slot];
        if (!gear) {
            return { ok: false, message: 'Nothing is equipped there.' };
        }
        const level = gear.upgrade ?? 0;
        if (level >= MAX_UPGRADE) {
            return { ok: false, message: `Already at +${MAX_UPGRADE}.` };
        }
        const cost = upgradeCost(level, gear.itemLevel);
        if (party.gold < cost.gold || this.save.shards < cost.shards) {
            return { ok: false, message: `Upgrading needs ${cost.gold} gold and ${cost.shards} shards.` };
        }
        party.gold -= cost.gold;
        this.save.shards -= cost.shards;
        const result = attemptUpgrade(this.rng, level);
        gear.upgrade = result.level;
        this.applyDerived(hero);
        switch (result.outcome) {
            case 'success': return { ok: true, message: `Success! Thy ${slot} is now +${result.level}.` };
            case 'downgrade': return { ok: false, message: `The upgrade failed. Thy ${slot} fell to +${result.level}.` };
            default: return { ok: false, message: 'The upgrade failed, but thy gear is unharmed.' };
        }
    }

    buyFromArmory(item: ArmoryItem, hero: HeroLike, party: PartyLike): { ok: boolean; message: string } {
        if (party.gold < item.price) {
            return { ok: false, message: `The ${item.name} costs ${item.price} gold.` };
        }
        if (this.save.bag.length >= BAG_MAX_SIZE) {
            return { ok: false, message: 'Thy bag is full.' };
        }
        party.gold -= item.price;
        const gear = createGearInstance(this.rng, item.slot, Math.max(1, Math.round(contentLevel(hero.level))),
            { quality: 'Rare', name: item.name, baseMods: item.mods, worldTier: this.save.worldTier });
        this.addToBag(gear);
        return { ok: true, message: `Thou hast bought the ${item.name}. EQUIP it from the BAG.` };
    }

    // -----------------------------------------------------------------------
    // Talents

    talentPointsLeft(hero: HeroLike): number {
        return talentPointsForLevel(hero.level) - talentPointsSpent(this.save.talents);
    }

    learn(talentId: string, hero: HeroLike): { ok: boolean; message: string } {
        const check = canLearn(this.save.talents, hero.level, talentId);
        if (!check.ok) {
            return { ok: false, message: check.reason ?? 'Thou canst not learn that.' };
        }
        learnTalent(this.save.talents, hero.level, talentId);
        this.applyDerived(hero);
        return { ok: true, message: `${getTalent(talentId)?.name ?? 'Talent'} is now rank ${this.save.talents[talentId]}.` };
    }

    respecTalents(hero: HeroLike, party: PartyLike): { ok: boolean; message: string } {
        const cost = talentPointsSpent(this.save.talents) * TALENT_RESPEC_COST_PER_POINT;
        if (party.gold < cost) {
            return { ok: false, message: `Resetting talents costs ${cost} gold.` };
        }
        party.gold -= cost;
        this.save.talents = {};
        this.applyDerived(hero);
        return { ok: true, message: `Thy talents are reset for ${cost} gold.` };
    }

    // -----------------------------------------------------------------------
    // Salvage, aspects and forging

    salvage(index: number): { ok: boolean; message: string } {
        const gear = this.save.bag[index];
        if (!gear) {
            return { ok: false, message: 'No such item.' };
        }
        this.save.bag.splice(index, 1);
        const shards = salvageShards(gear);
        this.save.shards += shards;
        const aspect = extractAspect(gear);
        let extra = '';
        if (aspect && !this.save.aspects.some((a) => a.key === aspect.key && a.value >= aspect.value)) {
            this.save.aspects = this.save.aspects.filter((a) => a.key !== aspect.key);
            this.save.aspects.push(aspect);
            extra = ` ${aspect.name} added to the codex!`;
        }
        return { ok: true, message: `Salvaged ${gearDisplayName(gear, gear.slot)} for ${shards} shards.${extra}` };
    }

    imprint(aspectIndex: number, slot: SocketSlot, hero: HeroLike): { ok: boolean; message: string } {
        const aspect = this.save.aspects[aspectIndex];
        const gear = this.save.enhancements[slot];
        if (!aspect || !gear) {
            return { ok: false, message: 'Nothing to imprint.' };
        }
        if (this.save.shards < IMPRINT_COST) {
            return { ok: false, message: `Imprinting costs ${IMPRINT_COST} shards.` };
        }
        this.save.shards -= IMPRINT_COST;
        imprintAspect(gear, aspect);
        this.applyDerived(hero);
        return { ok: true, message: `${aspect.name} imprinted on thy ${slot}.` };
    }

    forge(slot: SocketSlot, key: SubstatKey, hero: HeroLike): { ok: boolean; message: string } {
        const gear = this.save.enhancements[slot];
        if (!gear) {
            return { ok: false, message: 'Nothing is equipped there.' };
        }
        if (this.save.shards < FORGE_SHARD_COST) {
            return { ok: false, message: `Forging costs ${FORGE_SHARD_COST} shards.` };
        }
        gear.potential ??= initialPotential(gear);
        const result = forgeAffix(this.rng, gear, gear.potential, key);
        if (result.ok) {
            this.save.shards -= FORGE_SHARD_COST;
            gear.potential -= result.spent;
            this.applyDerived(hero);
        }
        return { ok: result.ok, message: result.message };
    }

    // -----------------------------------------------------------------------
    // World events and group finder

    /** Event progress for the current rotation (resetting stale progress). */
    eventProgress(now = Date.now()): EventProgress {
        const event = currentEvent(now);
        if (this.save.eventProgress?.key !== event.key) {
            this.save.eventProgress = { key: event.key, kills: 0, claimed: false };
        }
        return this.save.eventProgress;
    }

    /** Records an event foe defeated; returns lines (completion reward on the last one). */
    eventKill(hero: HeroLike, party: PartyLike): string[] {
        const event = currentEvent();
        const progress = this.eventProgress();
        if (progress.claimed) {
            return [];
        }
        progress.kills++;
        if (progress.kills < event.def.goal) {
            return [ `${event.def.name}: ${progress.kills}/${event.def.goal}.` ];
        }
        progress.claimed = true;
        const mult = worldTierScaling(this.save.worldTier).rewardMult;
        const gold = Math.round(event.def.rewardGold * mult);
        this.addGold(party, gold);
        this.record(event.def.kind === 'world_boss' ? 'worldBosses' : undefined, 'eventsCompleted');
        return [ `${event.def.name} complete! Thou earnest ${gold} gold.`, ...this.gainExperience(hero, Math.round(event.def.rewardXp * mult)) ];
    }

    /** Queues for a random dungeon at the hero's level with an NPC group. */
    groupFinder(role: Role, hero: HeroLike): { ok: boolean; message: string; group?: Adventurer[] } {
        const options = availableInstances('dungeon', hero.level).filter((i) => !isLockedOut(this.save.lockouts, i));
        if (!options.length) {
            return { ok: false, message: 'No dungeons are open to thee.' };
        }
        const instance = options[options.length - 1 - Math.floor(this.rng() * Math.min(3, options.length))];
        const started = this.startRun(instance.id, hero);
        if (!started.ok) {
            return started;
        }
        this.save.groupRole = role;
        const group = formGroup(this.rng, role);
        return {
            ok: true,
            message: `Group found in ${queueTime(role)}s! ${instance.name} with ${group.map((g) => `${g.name} (${g.role})`).join(', ')}.`,
            group,
        };
    }

    abandonRun(): string {
        delete this.save.groupRole;
        const run = this.save.activeRun;
        delete this.save.activeRun;
        return run ? 'Thou hast left the instance.' : 'Thou art not in an instance.';
    }

    /**
     * Folds the flat max HP / MP bonuses into the hero's stats, keeping track of what was
     * applied so it can be adjusted when gear changes.
     */
    applyDerived(hero: HeroLike): StatMods {
        this.syncEnhancements(hero);
        const mods = this.derivedMods(hero);
        const hpBonus = Math.round(mods.hp ?? 0);
        const mpBonus = Math.round(mods.mp ?? 0);
        const hpDelta = hpBonus - this.save.appliedHpBonus;
        const mpDelta = mpBonus - this.save.appliedMpBonus;
        if (hpDelta !== 0) {
            hero.maxHp = Math.max(1, hero.maxHp + hpDelta);
            hero.hp = Math.max(1, Math.min(hero.maxHp, hero.hp + Math.max(0, hpDelta)));
            this.save.appliedHpBonus = hpBonus;
        }
        if (mpDelta !== 0) {
            hero.maxMp = Math.max(0, hero.maxMp + mpDelta);
            hero.mp = Math.min(hero.maxMp, hero.mp + Math.max(0, mpDelta));
            this.save.appliedMpBonus = mpBonus;
        }
        return mods;
    }

    // -----------------------------------------------------------------------
    // Experience and rewards

    jobLevel(jobId: string): number {
        return this.save.jobs[jobId]?.level ?? 1;
    }

    /** Adds XP to the hero (and job), handling level ups. Returns text lines. */
    gainExperience(hero: HeroLike, xp: number): string[] {
        const lines: string[] = [];
        hero.exp += xp;
        const result = checkLevelUp(hero.level, hero.exp);
        if (result) {
            hero.level = result.newLevel;
            hero.strength += result.gains.strength;
            hero.agility += result.gains.agility;
            hero.maxHp += result.gains.maxHp;
            hero.maxMp += result.gains.maxMp;
            lines.push('Courage and wit have served thee well. Thou hast been promoted to the next level.');
            if (result.newLevel - result.oldLevel > 1) {
                lines.push(`Thou art now level ${result.newLevel}.`);
            }
            if (result.gains.strength > 0) {
                lines.push(`Thy power increases by ${result.gains.strength}.`);
            }
            if (result.gains.agility > 0) {
                lines.push(`Thy Response Speed increases by ${result.gains.agility}.`);
            }
            if (result.gains.maxHp > 0) {
                lines.push(`Thy Maximum Hit Points increase by ${result.gains.maxHp}.`);
            }
            if (result.gains.maxMp > 0) {
                lines.push(`Thy Maximum Magic Points increase by ${result.gains.maxMp}.`);
            }
            for (const m of result.milestones) {
                lines.push(m.text);
                if (m.type === 'title' || m.type === 'prestige') {
                    this.save.extraTitles.push(m.type === 'prestige' ? 'Legend of Alefgard' : `Paragon ${m.level - 30}`);
                }
            }
            bump(this.save.counters, 'levelUps', result.newLevel - result.oldLevel);
        }
        const job = this.save.jobs[this.save.job] ??= { level: 1, xp: 0 };
        const jobGain = addJobXp(job, Math.max(1, Math.floor(xp / 2)));
        if (jobGain > 0) {
            lines.push(`${getJob(this.save.job).name} job level is now ${job.level}.`);
            const learned = getJob(this.save.job).abilities.filter((a) => a.level > job.level - jobGain && a.level <= job.level);
            learned.forEach((a) => lines.push(`Thou hast learned ${a.name}!`));
        }
        return lines;
    }

    addGold(party: PartyLike, amount: number): void {
        party.gold = Math.max(0, Math.min(GOLD_CAP, party.gold + amount));
        if (amount > 0) {
            bump(this.save.counters, 'goldEarned', amount);
        }
    }

    /** Grants a reward bundle; returns text lines describing it. */
    grantReward(reward: Reward, hero: HeroLike, party: PartyLike, herbHook?: (count: number) => number): string[] {
        const lines: string[] = [];
        if (reward.gold) {
            this.addGold(party, reward.gold);
            lines.push(`Thou hast gained ${reward.gold} gold.`);
        }
        if (reward.sigils) {
            this.save.bossProgress.sigils += reward.sigils;
            lines.push(`Thou hast gained ${reward.sigils} boss sigil${reward.sigils > 1 ? 's' : ''}.`);
        }
        if (reward.herbs) {
            const added = herbHook ? herbHook(reward.herbs) : 0;
            const overflow = reward.herbs - added;
            if (overflow > 0) {
                this.save.supplies.bandage = (this.save.supplies.bandage ?? 0) + overflow;
            }
            lines.push(`Thou hast received ${reward.herbs} herb${reward.herbs > 1 ? 's' : ''}.`);
        }
        reward.gems?.forEach((g) => {
            addToBag(this.save.gems, g);
            lines.push(`Thou hast found a ${socketableName(g)} gem.`);
        });
        reward.runes?.forEach((r) => {
            addToBag(this.save.runes, r);
            lines.push(`Thou hast found a ${socketableName(r)} rune.`);
        });
        if (reward.relic) {
            const relic = createGearInstance(this.rng, 'relic', Math.round(contentLevel(hero.level)) + 20,
                { quality: 'Legendary', name: reward.relic });
            if (this.addToBag(relic)) {
                lines.push(`Thou hast obtained the legendary ${reward.relic}!`);
                bump(this.save.counters, 'artifacts');
            }
        }
        if (reward.xp) {
            lines.push(`Thy experience increases by ${reward.xp}.`);
            lines.push(...this.gainExperience(hero, reward.xp));
        }
        return lines;
    }

    addToBag(gear: GearInstance): boolean {
        if (this.save.bag.length >= BAG_MAX_SIZE) {
            return false;
        }
        this.save.bag.push(gear);
        return true;
    }

    /** Advances a season objective and lifetime counters. */
    record(objective: SeasonObjective | undefined, counter: CounterKey | undefined, amount = 1): void {
        this.save.season = refreshSeason(this.save.season, new Date());
        if (objective) {
            recordSeasonProgress(this.save.season, objective, amount);
        }
        if (counter) {
            bump(this.save.counters, counter, amount);
        }
    }

    /** Returns lines for any newly unlocked achievements. */
    achievementLines(hero: HeroLike): string[] {
        const newly: AchievementDef[] = checkAchievements(this.save.achievements, this.save.counters, hero.level);
        return newly.map((a) => `Achievement unlocked: ${a.name}!${a.title ? ` Title: ${a.title}.` : ''}`);
    }

    titles(): string[] {
        return titlesFor(this.save.achievements, this.save.extraTitles);
    }

    /**
     * Handles everything after an enemy is defeated: bonus XP/gold, loot, boss progression,
     * companion affinity, season progress and achievements.
     */
    onVictory(ctx: VictoryContext): VictoryResult {
        const { hero, party } = ctx;
        const mods = this.derivedMods(hero);
        const lines: string[] = [];
        const boss: BossDef | undefined = ctx.bossId ? getBoss(ctx.bossId) : undefined;

        const tierMult = worldTierScaling(this.save.worldTier).rewardMult;
        let xp = ctx.baseXp * (1 + (mods.xp ?? 0) / 100) * tierMult;
        if (ctx.elite) {
            xp *= 1.2;
        }
        xp = Math.max(ctx.baseXp, Math.round(xp));
        const gold = Math.max(ctx.baseGold, Math.round(ctx.baseGold * (1 + (mods.gf ?? 0) / 100) * tierMult));

        this.addGold(party, gold);
        lines.push(...this.gainExperience(hero, xp));

        this.record('kills', 'kills');
        const masteryLine = this.addWeaponKill(hero);
        if (masteryLine) {
            lines.push(masteryLine);
        }
        if (ctx.elite) {
            this.record('eliteKills', 'eliteKills');
        }

        const mf = mods.mf ?? 0;
        const mfMult = 1 + mf / 100;
        const level = Math.max(1, Math.round(contentLevel(hero.level)));

        // Monster parts for beast lore
        if (chance(this.rng, 0.3)) {
            const beastSkill = this.save.professions.beastlore?.skill ?? 0;
            const slot = MATERIALS.filter((m) => m.family === 'BEAST' && m.level <= Math.max(level, 1) && m.level <= Math.max(beastSkill, 1) + 40).length - 1;
            const mat = MATERIALS.find((m) => m.family === 'BEAST' && m.slot === Math.max(0, slot))!;
            this.save.materials[mat.id] = (this.save.materials[mat.id] ?? 0) + 1;
            lines.push(`Thou hast collected ${mat.name}.`);
        }
        if (chance(this.rng, 0.04 * mfMult)) {
            const gem = socketableId(pick(this.rng, GEM_FAMILIES).id, tierForItemLevel(level));
            addToBag(this.save.gems, gem);
            lines.push(`The enemy dropped a ${socketableName(gem)} gem.`);
        }
        if (chance(this.rng, 0.02 * mfMult)) {
            const rune = socketableId(pick(this.rng, RUNE_FAMILIES).id, tierForItemLevel(level));
            addToBag(this.save.runes, rune);
            lines.push(`The enemy dropped a ${socketableName(rune)} rune.`);
        }
        if (chance(this.rng, (boss ? 0.5 : 0.04) * mfMult)) {
            const base = rollGearBase(this.rng, level);
            const gear = createGearInstance(this.rng, base.slot, level,
                { magicFind: mf, worldTier: this.save.worldTier, name: base.name, baseMods: base.mods });
            if (this.addToBag(gear)) {
                lines.push(`Thou hast found ${base.name} (${gear.quality}, rarity ${QUALITIES.indexOf(gear.quality) + 1}).`);
            }
        }
        if (chance(this.rng, (boss ? 0.1 : 0.003) * mfMult)) {
            const unique = rollUnique(this.rng, level);
            if (unique) {
                const gear = createGearInstance(this.rng, unique.slot, Math.max(level, unique.level),
                    { quality: 'Legendary', name: unique.name, baseMods: unique.mods, worldTier: this.save.worldTier });
                if (this.addToBag(gear)) {
                    lines.push(`A legendary! Thou hast found ${unique.name}.`);
                }
            }
        }
        if (boss && chance(this.rng, 0.25 * mfMult)) {
            const core = rollCore(this.rng, level);
            this.save.cores.push(core.id);
            lines.push(`The ${boss.name} dropped a skill core: ${core.name}!`);
        }
        if (chance(this.rng, 0.015 * mfMult)) {
            const gear = createGearInstance(this.rng, chance(this.rng, 0.5) ? 'artifact' : 'relic', level,
                { magicFind: mf, worldTier: this.save.worldTier });
            if (this.addToBag(gear)) {
                lines.push(`Thou hast found ${gearDisplayName(gear)} (${gear.quality})!`);
                bump(this.save.counters, 'artifacts');
            }
        }

        if (boss) {
            lines.push(...this.bossRewards(boss, ctx, mf));
        }

        if (ctx.discoveryId) {
            const d = getDiscovery(ctx.discoveryId);
            if (d && !this.save.discoveries.includes(d.id)) {
                this.save.discoveries.push(d.id);
                this.record('dungeons', 'secrets');
                lines.push(...this.grantReward(d.reward, hero, party));
            }
        }

        const companion = this.save.activeCompanion ? this.save.companions[this.save.activeCompanion] : undefined;
        if (companion) {
            const before = bondTier(companion.affinity).name;
            addAffinity(companion, affinityForVictory(!!boss));
            const after = bondTier(companion.affinity).name;
            if (before !== after) {
                lines.push(`${getCompanion(this.save.activeCompanion!)?.name ?? 'Thy companion'} is now thy ${after}.`);
            }
        }

        lines.push(...this.achievementLines(hero));
        return { xp, gold, lines };
    }

    private bossRewards(boss: BossDef, ctx: VictoryContext, mf: number): string[] {
        const lines: string[] = [];
        const result = recordBossVictory(this.save.bossProgress, boss.id);
        this.record(undefined, 'bossKills');
        const objective: Partial<Record<string, SeasonObjective>> = { world: 'worldBosses', raid: 'raids', trial: 'trials', arc: 'raids', dungeon: 'dungeons', tower: 'trials' };
        if (objective[boss.category]) {
            this.record(objective[boss.category], undefined);
        }
        if (result.firstClear) {
            this.addGold(ctx.party, result.gold);
            lines.push(`First clear! Thou hast earned ${result.gold} gold and ${result.sigils} sigil${result.sigils > 1 ? 's' : ''}.`);
        }
        for (const rune of rollBossRunes(this.rng, boss, mf)) {
            addToBag(this.save.runes, rune);
            lines.push(`The ${boss.name} dropped a ${socketableName(rune)} rune.`);
        }
        const gem = rollBossGem(this.rng, boss);
        addToBag(this.save.gems, gem);
        lines.push(`The ${boss.name} dropped a ${socketableName(gem)} gem.`);
        if (chance(this.rng, SET_PIECE_CHANCE[boss.category] * (1 + mf / 100))) {
            const set = pick(this.rng, LEGENDARY_SETS);
            const piece = createSetPiece(this.rng, set.id, Math.floor(this.rng() * set.pieces.length), boss.level);
            if (piece && this.addToBag(piece)) {
                this.save.bossProgress.named[piece.name!] = (this.save.bossProgress.named[piece.name!] ?? 0) + 1;
                bump(this.save.counters, 'setPieces');
                lines.push(`Thou hast found ${piece.name}, a piece of the ${set.name} set!`);
            }
        }
        const mount = rollMountDrop(this.rng, boss.category);
        if (mount && !this.save.mounts.includes(mount.id)) {
            this.save.mounts.push(mount.id);
            lines.push(`The ${boss.name} left behind a ${mount.name} mount!`);
        }
        return lines;
    }

    // -----------------------------------------------------------------------
    // Jobs, races and mastery

    changeJob(jobId: string, mapName: string): { ok: boolean; message: string } {
        if (!isTown(mapName)) {
            return { ok: false, message: 'Thou canst change jobs only in a town.' };
        }
        if (!JOBS.some((j) => j.id === jobId)) {
            return { ok: false, message: 'No such job.' };
        }
        if (this.save.job === jobId) {
            return { ok: false, message: 'That is already thy job.' };
        }
        this.save.job = jobId;
        this.save.jobs[jobId] ??= { level: 1, xp: 0 };
        if (this.save.supportJob === jobId) {
            delete this.save.supportJob;
        }
        bump(this.save.counters, 'jobChanges');
        return { ok: true, message: `Thou art now a ${getJob(jobId).name}.` };
    }

    setSupportJob(jobId: string | undefined, hero: HeroLike): { ok: boolean; message: string } {
        if (this.jobLevel(this.save.job) < SUPPORT_UNLOCK_LEVEL) {
            return { ok: false, message: `A support job unlocks at ${getJob(this.save.job).name} level ${SUPPORT_UNLOCK_LEVEL}.` };
        }
        if (jobId === this.save.job) {
            return { ok: false, message: 'The support job must differ from thy main job.' };
        }
        this.save.supportJob = jobId;
        if (jobId) {
            this.save.jobs[jobId] ??= { level: 1, xp: 0 };
        }
        this.applyDerived(hero);
        return { ok: true, message: jobId ? `Support job set to ${getJob(jobId).name}.` : 'Support job removed.' };
    }

    /** Race can be chosen freely until level 5. */
    setRace(raceId: string, hero: HeroLike): { ok: boolean; message: string } {
        if (hero.level > 5) {
            return { ok: false, message: 'Thy heritage is set; it can be chosen only before level 6.' };
        }
        if (!RACES.some((r) => r.id === raceId)) {
            return { ok: false, message: 'No such race.' };
        }
        this.save.race = raceId;
        this.applyDerived(hero);
        return { ok: true, message: `Thou art of the ${getRace(raceId).name}.` };
    }

    masteryAvailable(hero: HeroLike): number {
        const spent = Object.values(this.save.masterySpent).reduce((s, v) => s + (v ?? 0), 0);
        return masteryPointsForLevel(hero.level) - spent;
    }

    spendMastery(hero: HeroLike, stat: MasteryStat): boolean {
        if (this.masteryAvailable(hero) <= 0) {
            return false;
        }
        this.save.masterySpent[stat] = (this.save.masterySpent[stat] ?? 0) + 1;
        hero[stat] += MASTERY_GAIN[stat];
        if (stat === 'maxHp') {
            hero.hp += MASTERY_GAIN.maxHp;
        } else if (stat === 'maxMp') {
            hero.mp += MASTERY_GAIN.maxMp;
        }
        return true;
    }

    // -----------------------------------------------------------------------
    // Gear: sockets, bag, artifacts/relics

    getSlotGear(slot: EquipSlot): GearEnhancement | undefined {
        if (slot === 'artifact') {
            return this.save.artifact;
        }
        if (slot === 'relic') {
            return this.save.relic;
        }
        return this.save.enhancements[slot];
    }

    socket(kind: SocketKind, slot: SocketSlot, id: string): { ok: boolean; message: string } {
        const gear = this.save.enhancements[slot];
        if (!gear) {
            return { ok: false, message: 'Nothing is equipped there.' };
        }
        const sockets = kind === 'gem' ? gear.gems : gear.runes;
        const index = sockets.indexOf(null);
        if (index < 0) {
            return { ok: false, message: 'Every socket is full.' };
        }
        const bag = kind === 'gem' ? this.save.gems : this.save.runes;
        const result = socketFromBag(kind, bag, sockets, index, id);
        if (!result.ok) {
            return { ok: false, message: result.error };
        }
        if (kind === 'gem') {
            gear.gems = result.sockets;
        } else {
            gear.runes = result.sockets;
        }
        bump(this.save.counters, 'gemsSocketed');
        return { ok: true, message: `${socketableName(id)} socketed.` };
    }

    unsocket(kind: SocketKind, slot: SocketSlot, index: number): { ok: boolean; message: string } {
        const gear = this.save.enhancements[slot];
        if (!gear) {
            return { ok: false, message: 'Nothing is equipped there.' };
        }
        const bag = kind === 'gem' ? this.save.gems : this.save.runes;
        const result = unsocketToBag(bag, kind === 'gem' ? gear.gems : gear.runes, index);
        if (!result.ok) {
            return { ok: false, message: result.error };
        }
        if (kind === 'gem') {
            gear.gems = result.sockets;
        } else {
            gear.runes = result.sockets;
        }
        return { ok: true, message: `${socketableName(result.removed!)} removed.` };
    }

    fuseStones(kind: SocketKind, id: string): { ok: boolean; message: string } {
        const result = fuse(kind === 'gem' ? this.save.gems : this.save.runes, id);
        if (!result.ok) {
            return { ok: false, message: result.error };
        }
        bump(this.save.counters, 'fusions');
        return { ok: true, message: `Fused into ${socketableName(result.created)}!` };
    }

    /** Equips a bag item; whatever was in that slot goes back to the bag. */
    equipFromBag(index: number, hero: HeroLike): { ok: boolean; message: string } {
        const gear = this.save.bag[index];
        if (!gear) {
            return { ok: false, message: 'No such item.' };
        }
        this.save.bag.splice(index, 1);
        if (gear.slot === 'artifact' || gear.slot === 'relic') {
            const old = this.save[gear.slot];
            this.save[gear.slot] = gear;
            if (old) {
                this.save.bag.push(old);
            }
        } else {
            const baseItem = hero[gear.slot];
            if (!baseItem) {
                this.save.bag.splice(index, 0, gear);
                return { ok: false, message: `Thou needest a base ${gear.slot} to bind this to.` };
            }
            const old = this.save.enhancements[gear.slot];
            const enh: SlotEnhancement = { ...gear, baseName: baseItem.name };
            if (enh.gems.length < socketCapacity('gem', enh.itemLevel)) {
                enh.gems = [ ...enh.gems, ...emptySockets('gem', enh.itemLevel) ].slice(0, socketCapacity('gem', enh.itemLevel));
            }
            this.save.enhancements[gear.slot] = enh;
            if (old && (old.quality !== 'Common' || old.setId)) {
                const { baseName: _baseName, ...rest } = old;
                this.save.bag.push({ ...rest, id: `${gear.id}_old`, slot: gear.slot });
            }
        }
        this.applyDerived(hero);
        return { ok: true, message: `Equipped ${gearDisplayName(gear, gear.slot)}.` };
    }

    unequip(slot: 'artifact' | 'relic', hero: HeroLike): { ok: boolean; message: string } {
        const gear = this.save[slot];
        if (!gear) {
            return { ok: false, message: 'Nothing is equipped there.' };
        }
        if (!this.addToBag(gear)) {
            return { ok: false, message: 'Thy bag is full.' };
        }
        this.save[slot] = undefined;
        this.applyDerived(hero);
        return { ok: true, message: `Removed ${gearDisplayName(gear)}.` };
    }

    sellFromBag(index: number, party: PartyLike): { ok: boolean; message: string } {
        const gear = this.save.bag[index];
        if (!gear) {
            return { ok: false, message: 'No such item.' };
        }
        const price = quoteVendorPrice(gear, 'sell');
        this.save.bag.splice(index, 1);
        this.addGold(party, price);
        return { ok: true, message: `Sold ${gearDisplayName(gear, gear.slot)} for ${price} gold.` };
    }

    repairAll(party: PartyLike): { ok: boolean; message: string } {
        const all: (GearEnhancement | undefined)[] = [ ...Object.values(this.save.enhancements), this.save.artifact, this.save.relic ];
        const pieces = all.filter((g): g is GearEnhancement => !!g && g.durability < g.maxDurability);
        const cost = pieces.reduce((s, g) => s + repairCost(g), 0);
        if (!pieces.length) {
            return { ok: false, message: 'Thy gear needs no repair.' };
        }
        if (party.gold < cost) {
            return { ok: false, message: `Repairs cost ${cost} gold. Thou hast not enough.` };
        }
        party.gold -= cost;
        pieces.forEach((g) => {
            g.durability = g.maxDurability;
        });
        return { ok: true, message: `Thy gear is repaired for ${cost} gold.` };
    }

    // -----------------------------------------------------------------------
    // Professions

    profession(id: string) {
        return this.save.professions[id] ??= createProfessionState();
    }

    /** Gathers with the profession suited to where the hero stands. */
    gatherHere(profId: string, hero: HeroLike): { ok: boolean; lines: string[] } {
        const prof = getProfession(profId);
        if (prof?.kind !== 'gathering') {
            return { ok: false, lines: [ 'That is not a gathering profession.' ] };
        }
        const state = this.profession(profId);
        const result = gather(this.rng, profId, state, Math.round(contentLevel(hero.level)))!;
        this.save.materials[result.material.id] = (this.save.materials[result.material.id] ?? 0) + result.count;
        bump(this.save.counters, 'gathered', result.count);
        const lines = [ `Thou hast gathered ${result.count > 1 ? `${result.count} ` : ''}${result.material.name}.` ];
        if (result.skillUp) {
            lines.push(`${prof.name} skill is now ${state.skill}.`);
        }
        if (result.rareBonus) {
            const gem = socketableId(pick(this.rng, GEM_FAMILIES).id, 1);
            addToBag(this.save.gems, gem);
            lines.push(`A glimmer! Thou hast found a ${socketableName(gem)}.`);
        }
        if (result.heroXp > 0) {
            lines.push(...this.gainExperience(hero, result.heroXp));
        }
        lines.push(...this.achievementLines(hero));
        return { ok: true, lines };
    }

    craftRecipe(recipe: RecipeDef, hero: HeroLike): { ok: boolean; lines: string[] } {
        const state = this.profession(recipe.profession);
        const result = craft(this.rng, recipe, state, this.save.materials);
        if (!result.ok) {
            return { ok: false, lines: [ result.reason ?? 'Thou canst not craft that.' ] };
        }
        const lines: string[] = [];
        const output = recipe.output;
        for (let i = 0; i < result.count; i++) {
            if (output.type === 'supply') {
                this.save.supplies[output.supply] = (this.save.supplies[output.supply] ?? 0) + 1;
            } else if (output.type === 'gem') {
                addToBag(this.save.gems, socketableId(pick(this.rng, GEM_FAMILIES).id, Math.min(9, 1 + Math.floor(recipe.tier / 3))));
            } else {
                const base = hero[output.slot];
                if (base) {
                    const masterwork = perkValue(state, 'crafting', 'extra') > 0 && chance(this.rng, 0.2);
                    const enh = createEnhancement(this.rng, recipe.skill + 10, masterwork ? 'Epic' : 'Rare');
                    const old = this.save.enhancements[output.slot];
                    enh.gems = old?.gems.length ? [ ...old.gems, ...enh.gems ].slice(0, enh.gems.length) : enh.gems;
                    this.save.enhancements[output.slot] = { ...enh, baseName: base.name };
                }
            }
        }
        const label = output.type === 'supply' ? SUPPLIES[output.supply].name :
            output.type === 'gem' ? 'cut gem' : `${output.slot} reforge`;
        lines.push(`Thou hast crafted ${result.count > 1 ? `${result.count}x ` : ''}${label}.`);
        if (result.savedMaterials) {
            lines.push('Thy thrift saved the materials!');
        }
        if (result.skillUp) {
            lines.push(`${getProfession(recipe.profession)?.name ?? ''} skill is now ${state.skill}.`);
        }
        bump(this.save.counters, 'crafted', result.count);
        this.record('crafts', undefined, result.count);
        this.applyDerived(hero);
        lines.push(...this.achievementLines(hero));
        return { ok: true, lines };
    }

    buyLesson(profId: string, hero: HeroLike, party: PartyLike): { ok: boolean; message: string } {
        const state = this.profession(profId);
        const cap = lessonCap(hero.level);
        if (state.skill >= cap) {
            return { ok: false, message: `Thou must reach a higher level for lessons past ${cap}.` };
        }
        const cost = lessonCost(state.skill);
        if (party.gold < cost) {
            return { ok: false, message: `A lesson costs ${cost} gold.` };
        }
        party.gold -= cost;
        state.skill = Math.min(cap, state.skill + 3);
        return { ok: true, message: `${getProfession(profId)?.name ?? ''} skill rises to ${state.skill}.` };
    }

    /** Uses a crafted supply outside battle. Returns lines. */
    useSupply(id: SupplyId, hero: HeroLike, healMult = 1): { ok: boolean; message: string } {
        if ((this.save.supplies[id] ?? 0) < 1) {
            return { ok: false, message: 'Thou hast none.' };
        }
        const def = SUPPLIES[id];
        this.save.supplies[id] = (this.save.supplies[id] ?? 0) - 1;
        const parts: string[] = [];
        if (def.healPct) {
            const amount = Math.max(1, Math.round(hero.maxHp * def.healPct / 100 * healMult));
            hero.hp = Math.min(hero.maxHp, hero.hp + amount);
            parts.push(`recovered ${amount} HP`);
        }
        if (def.buff && !this.save.pendingBuffs.includes(def.buff)) {
            this.save.pendingBuffs.push(def.buff);
            parts.push('will feel its effect in the next battle');
        }
        return { ok: true, message: `${hero.name} used the ${def.name} and ${parts.join(' and ')}.` };
    }

    // -----------------------------------------------------------------------
    // Companions and mounts

    recruitCompanion(id: string, hero: HeroLike, party: PartyLike): { ok: boolean; message: string } {
        const def = getCompanion(id);
        if (!def) {
            return { ok: false, message: 'No one by that name.' };
        }
        if (this.save.companions[id]) {
            this.save.activeCompanion = id;
            this.applyDerived(hero);
            return { ok: true, message: `${def.name} joins thee again.` };
        }
        if (hero.level < def.levelReq) {
            return { ok: false, message: `${def.name} will follow only a hero of level ${def.levelReq}.` };
        }
        if (party.gold < def.fee) {
            return { ok: false, message: `${def.name} asks ${def.fee} gold to join thee.` };
        }
        party.gold -= def.fee;
        this.save.companions[id] = { affinity: 0, stance: 'BALANCED' };
        this.save.activeCompanion = id;
        bump(this.save.counters, 'companionsRecruited');
        this.applyDerived(hero);
        return { ok: true, message: `${def.name} the ${getJob(def.job).name} has joined thee!` };
    }

    dismissCompanion(hero: HeroLike): string {
        const def = this.save.activeCompanion ? getCompanion(this.save.activeCompanion) : undefined;
        delete this.save.activeCompanion;
        this.applyDerived(hero);
        return def ? `${def.name} waits at the inn.` : 'Thou travelest alone.';
    }

    activeCompanionState(): CompanionState | undefined {
        return this.save.activeCompanion ? this.save.companions[this.save.activeCompanion] : undefined;
    }

    setStance(stance: Stance): void {
        const state = this.activeCompanionState();
        if (state) {
            state.stance = stance;
        }
    }

    giveGift(supply: SupplyId): { ok: boolean; message: string } {
        const id = this.save.activeCompanion;
        const def = id ? getCompanion(id) : undefined;
        const state = this.activeCompanionState();
        if (!def || !state) {
            return { ok: false, message: 'Thou hast no companion.' };
        }
        if ((this.save.supplies[supply] ?? 0) < 1) {
            return { ok: false, message: 'Thou hast none to give.' };
        }
        this.save.supplies[supply] = (this.save.supplies[supply] ?? 0) - 1;
        const gain = affinityForGift(def, SUPPLIES[supply].name);
        addAffinity(state, gain);
        return { ok: true, message: gain >= 10 ? `${def.name} loves it! Affinity +${gain}.` : `${def.name} thanks thee. Affinity +${gain}.` };
    }

    buyMount(mount: MountDef, party: PartyLike): { ok: boolean; message: string } {
        if (this.save.mounts.includes(mount.id)) {
            this.save.activeMount = mount.id;
            return { ok: true, message: `Thou wilt now ride the ${mount.name}.` };
        }
        const price = mountPrice(mount);
        if (party.gold < price) {
            return { ok: false, message: `The ${mount.name} costs ${price} gold.` };
        }
        party.gold -= price;
        this.save.mounts.push(mount.id);
        this.save.activeMount = mount.id;
        return { ok: true, message: `Thou hast bought the ${mount.name}!` };
    }

    toggleRide(mapName: string): { ok: boolean; message: string } {
        const mount = this.save.activeMount ? getMount(this.save.activeMount) : undefined;
        if (!mount) {
            return { ok: false, message: 'Thou hast no mount.' };
        }
        if (!this.save.riding && mapName !== 'overworld') {
            return { ok: false, message: 'Thou canst ride only in the open world.' };
        }
        this.save.riding = !this.save.riding;
        if (this.save.riding) {
            bump(this.save.counters, 'mountRides');
        }
        return { ok: true, message: this.save.riding ? `Thou mountest the ${mount.name}.` : 'Thou dismountest.' };
    }

    /** Random encounter multiplier from riding. */
    encounterMultiplier(): number {
        const mount = this.save.riding && this.save.activeMount ? getMount(this.save.activeMount) : undefined;
        return mount ? ENCOUNTER_MULT[mount.tier] : 1;
    }
}

export const JOB_LIST = JOBS;
export const RACE_LIST = RACES;
export const COMPANION_LIST = COMPANIONS;
export const PROFESSION_LIST = PROFESSIONS;
export const materialName = (id: string): string => getMaterial(id)?.name ?? id;
export type { MaterialFamily };
