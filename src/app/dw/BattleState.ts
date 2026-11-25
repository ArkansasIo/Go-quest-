import { Delay, Image, Utils } from 'gtp';
import { BaseState } from './BaseState';
import { DwGame } from './DwGame';
import { RoamingState } from './RoamingState';
import { DeadState } from './DeadState';
import { StatBubble } from './StatBubble';
import { Enemy } from './Enemy';
import { BattleCommandBubble } from './BattleCommandBubble';
import { TextBubble } from './TextBubble';
import { Conversation } from './Conversation';
import { EnemyAiResult } from './EnemyAI';
import { ChoiceBubble } from './ChoiceBubble';
import { BossDef, FIXED_BOSS_BY_ENEMY, getBoss , bossRank, bossSeed } from './systems/bosses';
import { EffectSet, EFFECTS } from './systems/effects';
import { JobAbility, MonsterJob, RACE_ABILITIES, availableAbilities, getJob, rollMonsterJob, supportLevel } from './systems/jobs';
import { heroHit, incomingHit } from './systems/battleMath';
import { Rng, defaultRng } from './systems/rng';
import { StatMods, addMods, capMods , elementalBonus } from './systems/stats';
import { companionAssist, getCompanion } from './systems/companions';
import { wearGear } from './systems/gear';
import { SUPPLIES, SupplyId } from './systems/professions';
import { worldTierScaling } from './systems/instances';
import { BattleSpell, knownSpells, rollDice } from './systems/spells';
import { bossTitle } from './systems/legendaries';
import { CHECK_BOSS_WEAKEN, getAct } from './systems/story';

/**
 * Options for a battle beyond the enemy type.
 */
export interface BattleOptions {
    /** A boss from the boss catalog; its stats scale the base enemy. */
    bossId?: string;
    /** A hidden world discovery whose guardian this is. */
    discoveryId?: string;
    /** Display name override. */
    name?: string;
    /** Part of a dungeon / raid / trial / tower run. */
    instance?: boolean;
    /** A foe of the current world event. */
    event?: boolean;
    /** The climactic battle of a story act. */
    story?: number;
}

interface AbilityChoice {
    ability: JobAbility;
    label: string;
}

const HEALING_SUPPLIES: SupplyId[] = [ 'elixir', 'bandage', 'feast' ];

export class BattleState extends BaseState {

    private readonly enemyName: string;
    private readonly enemy: Enemy;
    private commandExecuting = false;
    private fightDelay?: Delay;
    private readonly textBubble: TextBubble;
    private readonly commandBubble: BattleCommandBubble;
    private readonly statBubble: StatBubble;
    private enemyFlashDelay?: Delay;
    private flashMillis = 0;
    private enemiesDead = false;
    private enemyAttackDelay?: Delay;
    private shake = false;
    private enemyAttackShakeDelay?: Delay;
    private shakeXOffs = 0;
    private shakeMillisCount = 0;
    private dead = false;

    private readonly rng: Rng = defaultRng;
    private readonly options: BattleOptions;
    private readonly boss?: BossDef;
    private readonly monsterJob?: MonsterJob;
    private readonly heroEffects = new EffectSet();
    private readonly enemyEffects = new EffectSet();
    private readonly usedAbilities = new Set<string>();
    private pendingEnemyResult?: EnemyAiResult;
    private relentlessUsed = false;
    private skillBubble?: ChoiceBubble<AbilityChoice>;
    private nextInstanceFight?: { enemy: string; bossId?: string };
    private spellBubble?: ChoiceBubble<BattleSpell>;

    constructor(game: DwGame, enemyName: string, options: BattleOptions = {}) {
        super(game);
        this.enemyName = enemyName;
        this.options = options;
        this.enemy = new Enemy(game, game.getEnemy(this.enemyName)).prepare();
        this.textBubble = new TextBubble(game);
        this.statBubble = new StatBubble(game);
        this.commandBubble = new BattleCommandBubble(game);

        const bossId = options.bossId ?? FIXED_BOSS_BY_ENEMY[enemyName];
        this.boss = bossId ? getBoss(bossId) : undefined;
        if (this.boss && !this.boss.fixed) {
            const e = this.enemy;
            e.name = options.name ?? `${this.boss.name} ${bossTitle(bossRank(this.boss.level), bossSeed(this.boss.id))}`;
            e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * this.boss.hpMult));
            e.str = Math.round(e.str * this.boss.strMult);
            e.xp = Math.round(e.xp * this.boss.hpMult);
            e.gp = Math.round(e.gp * this.boss.hpMult);
        } else if (options.name) {
            this.enemy.name = options.name;
        }

        this.monsterJob = rollMonsterJob(this.rng, !!this.boss);
        if (this.monsterJob) {
            const e = this.enemy;
            e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * this.monsterJob.hpMult));
            e.str = Math.round(e.str * this.monsterJob.strMult);
        }

        // Story villains
        const ext = game.ext;
        const act = options.story ? getAct(options.story) : undefined;
        if (act) {
            const weaken = ext.save.story.checks[act.act] ? CHECK_BOSS_WEAKEN : 1;
            this.enemy.name = act.villain;
            this.enemy.hp = this.enemy.maxHp = Math.max(1, Math.round(this.enemy.maxHp * act.bossHp * weaken));
            this.enemy.str = Math.round(this.enemy.str * act.bossStr * weaken);
        }

        // World tier scaling
        if (ext.save.worldTier > 1) {
            const tier = worldTierScaling(ext.save.worldTier);
            this.enemy.hp = this.enemy.maxHp = Math.max(1, Math.round(this.enemy.maxHp * tier.hpMult));
            this.enemy.str = Math.round(this.enemy.str * tier.strMult);
        }

        // Supplies used before battle, and racial starts
        for (const buff of ext.save.pendingBuffs) {
            this.heroEffects.apply(buff, 5, { pool: buff === 'barrier' ? 20 : undefined });
        }
        ext.save.pendingBuffs = [];
        if (ext.save.race === 'lunari') {
            this.heroEffects.apply('trueveil', 2);
        }
    }

    private backToRoaming() {
        if (this.options.instance && !this.enemiesDead) {
            this.game.ext.abandonRun(); // Fled from an instance
        }
        this.game.audio.fadeOutMusic('MUSIC_OVERWORLD');
        this.game.setState(new RoamingState(this.game));
    }

    /** Hero modifiers: passive bonuses plus active combat effects. */
    private heroMods(): StatMods {
        return capMods(addMods(this.game.getExtMods(), this.heroEffects.getMods()), true);
    }

    fight() {
        this.commandExecuting = true;
        this.fightDelay = new Delay({ millis: [ 300 ], callback: this.fightCallback.bind(this) });
        this.textBubble.addToConversation({ text: 'You attack!', sound: 'attack' }, true);
    }

    private fightCallback() {
        this.game.audio.playSound('hit');
        delete this.fightDelay;
        this.enemyFlashDelay = new Delay({ millis: 400, callback: this.enemyFlashCallback.bind(this) });
        this.flashMillis = 0;
    }

    /**
     * Resolves a hero strike against the enemy.
     */
    private strikeEnemy(multiplier: number): { damage: number; dead: boolean; lines: string[] } {
        const hero = this.game.hero;
        const base = hero.computePhysicalAttackDamage(this.enemy) * multiplier;
        const second = hero.computePhysicalAttackDamage(this.enemy) * multiplier;
        const hit = heroHit(this.rng, base, this.heroMods(), this.enemyEffects.getTakenPct(),
            this.monsterJob?.armour ?? 0, this.enemyEffects.attacksAutoCrit(), second);
        const lines: string[] = [];
        if (hit.crit) {
            lines.push('Excellent move!');
        }
        if (hit.extraHit) {
            lines.push('Thou strikest twice!');
        }
        this.enemyEffects.absorbDamage(hit.damage); // wakes sleeping foes
        const dead = this.enemy.takeDamage(hit.damage);
        if (hit.healed > 0) {
            hero.incHp(hit.healed);
            lines.push(`Thou drainest ${hit.healed} HP.`);
        }
        const weapon = this.game.ext.save.enhancements.weapon;
        if (weapon && wearGear(weapon, this.rng, 0.04)) {
            lines.push('Thy weapon has broken! Repair it in town.');
        }
        return { damage: hit.damage, dead, lines };
    }

    private enemyFlashCallback() {

        delete this.enemyFlashDelay;

        const { damage, dead, lines } = this.strikeEnemy(1);
        lines.forEach((text) => {
            this.textBubble.addToConversation({ text }, true);
        });

        const text = `Direct hit! Thy enemy's hit points have been reduced by ${damage}.`;
        this.textBubble.addToConversation({ text: text }, true);

        if (dead) {
            this.defeatedEnemy();
        } else {
            this.afterHeroAction();
        }
    }

    /**
     * The companion acts, then the enemy takes its turn.
     */
    private afterHeroAction() {
        if (this.companionTurn()) {
            this.defeatedEnemy();
            return;
        }
        this.enemyAttack();
    }

    /**
     * Lets the active companion assist. Returns whether the enemy died.
     */
    private companionTurn(): boolean {
        if (this.groupTurn()) {
            return true;
        }
        const ext = this.game.ext;
        const id = ext.save.activeCompanion;
        const state = ext.activeCompanionState();
        const def = id ? getCompanion(id) : undefined;
        if (!def || !state) {
            return false;
        }
        const hero = this.game.hero;
        const action = companionAssist(state.stance, getJob(def.job).role, hero.hp / Math.max(1, hero.maxHp));
        switch (action.type) {
            case 'attack': {
                const damage = Math.max(1, Math.round(hero.computePhysicalAttackDamage(this.enemy) * action.multiplier *
                    (1 + (ext.companionMods().dmg ?? 0) / 100)));
                this.textBubble.addToConversation({ text: `${def.name} attacks! ${damage} damage.` }, true);
                return this.enemy.takeDamage(damage);
            }
            case 'heal': {
                const amount = Math.max(1, Math.round(hero.maxHp * action.pct / 100));
                hero.incHp(amount);
                this.textBubble.addToConversation({ text: `${def.name} heals thee for ${amount}.` }, true);
                return false;
            }
            case 'guard':
                this.heroEffects.apply('fortify', 1);
                this.textBubble.addToConversation({ text: `${def.name} guards thee.` }, true);
                return false;
            default:
                return false;
        }
    }

    private defeatedEnemy() {

        this.enemiesDead = true;
        const ext = this.game.ext;
        const result = ext.onVictory({
            hero: this.game.hero,
            party: this.game.party,
            enemyName: this.enemyName,
            baseXp: this.enemy.xp,
            baseGold: this.enemy.gp,
            bossId: this.boss?.id,
            elite: !!this.monsterJob,
            discoveryId: this.options.discoveryId,
        });
        ext.applyDerived(this.game.hero);

        const text = `
Thou hast defeated the ${this.enemy.name}.
Thy experience increases by ${result.xp}.
Thy gold increases by ${result.gold}.`;

        this.textBubble.addToConversation({ text: text, music: 'victory' });
        result.lines.forEach((line) => {
            this.textBubble.addToConversation({ text: line });
        });

        if (this.options.story) {
            ext.completeAct(this.options.story, this.game.hero, this.game.party).forEach((line) => {
                this.textBubble.addToConversation({ text: line });
            });
        }

        if (this.options.event) {
            ext.eventKill(this.game.hero, this.game.party).forEach((line) => {
                this.textBubble.addToConversation({ text: line });
            });
        }

        // Instance runs chain into the next fight
        if (this.options.instance && ext.save.activeRun) {
            const run = ext.advanceRun(this.game.party);
            run.lines.forEach((line) => {
                this.textBubble.addToConversation({ text: line });
            });
            const next = run.done ? undefined : ext.currentRunEncounter();
            if (next) {
                this.textBubble.addToConversation({ text: `Onward: ${next.label}.` });
                this.nextInstanceFight = next;
            }
        }
        this.commandExecuting = false;
    }

    private rollEnemyAction(): EnemyAiResult {
        const result = this.enemy.ai(this.game.hero, this.enemy);
        if (this.monsterJob?.casts && this.rng() < 0.25) {
            return { type: 'magic', spellName: 'HURT', damage: this.enemy.computeHurtSpellDamage(this.game.hero) };
        }
        return result;
    }

    private enemyAttack() {

        if (this.enemyEffects.losesTurn()) {
            const lines = [ `The ${this.enemy.name} cannot move!`, ...this.endOfTurn() ];
            if (this.enemy.isDead()) {
                lines.forEach((text) => {
                    this.textBubble.addToConversation({ text }, true);
                });
                this.defeatedEnemy();
                return;
            }
            lines.push('Command?');
            this.textBubble.addToConversation({ text: lines.join('\n') }, true);
            this.commandExecuting = false;
            return;
        }

        const result: EnemyAiResult = this.rollEnemyAction();
        this.pendingEnemyResult = result;

        switch (result.type) {
            case 'physical': {
                const text = `The ${this.enemy.name} attacks!`;
                this.textBubble.addToConversation({ text,
                    afterSound: 'prepareToAttack' }, true);
                this.textBubble.onDone(() => {
                    this.enemyAttackDelay = new Delay({
                        millis: 350,
                        callback: this.enemyAttackCallback.bind(this),
                    });
                });
                break;
            }
            case 'magic': {
                const text = `The ${this.enemy.name} chants the spell of ${result.spellName}.`;
                // TODO: Should conversations auto-wait for afterSounds to complete?
                this.textBubble.addToConversation({ text, afterSound: 'castSpell' }, true);
                this.textBubble.onDone(() => {
                    this.enemyAttackDelay = new Delay({
                        millis: 900,
                        callback: this.enemyAttackCallback.bind(this),
                    });
                });
                break;
            }
            case 'fire': {
                const text = `The ${this.enemy.name} is breathing fire.`;
                this.textBubble.addToConversation({ text, afterSound: 'breatheFire' }, true);
                this.textBubble.onDone(() => {
                    this.enemyAttackDelay = new Delay({
                        millis: 600,
                        callback: this.enemyAttackCallback.bind(this),
                    });
                });
                break;
            }
        }
    }

    private enemyAttackCallback() {
        delete this.enemyAttackDelay;
        this.shake = true;
        this.game.audio.playSound('receiveDamage');
        this.enemyAttackShakeDelay = new Delay({
            millis: 1000,
            callback: this.enemyAttackShakeCallback.bind(this),
        });

    }

    private enemyAttackShakeCallback() {

        delete this.enemyAttackShakeDelay;
        this.shake = false;

        const hero = this.game.hero;
        const result = this.pendingEnemyResult ?? this.enemy.ai(hero, this.enemy);
        delete this.pendingEnemyResult;
        const physical = result.type === 'physical';
        const incoming = incomingHit(this.rng, result.damage, this.heroMods(), this.heroEffects.getTakenPct(), physical);
        const lines: string[] = [];

        if (incoming.dodged) {
            lines.push('Thou hast dodged the attack!');
        } else {
            if (incoming.blocked) {
                lines.push('Thou blockest with thy shield!');
            }
            const damage = this.heroEffects.absorbDamage(incoming.damage);
            if (damage < incoming.damage) {
                lines.push(`A barrier absorbs ${incoming.damage - damage} damage.`);
            }
            hero.takeDamage(damage);
            lines.push(`Thy Hit Points decreased by ${damage}.`);
            const armor = this.game.ext.save.enhancements.armor;
            if (armor && wearGear(armor, this.rng, 0.04)) {
                lines.push('Thy armor has broken! Repair it in town.');
            }
            if (hero.isDead() && this.game.ext.save.race === 'tuskborn' && !this.relentlessUsed) {
                this.relentlessUsed = true;
                hero.hp = 1;
                lines.push('Thou refusest to fall!');
            }
        }

        if (incoming.thorns > 0 && !hero.isDead()) {
            lines.push(`Thorns deal ${incoming.thorns} damage to the ${this.enemy.name}.`);
            if (this.enemy.takeDamage(incoming.thorns)) {
                this.textBubble.addToConversation({ text: lines.join('\n') }, true);
                this.commandExecuting = false;
                this.defeatedEnemy();
                return;
            }
        }

        if (!hero.isDead()) {
            lines.push(...this.endOfTurn());
        }

        if (hero.isDead()) {
            lines.push('Thou art dead.');
            this.textBubble.addToConversation({ text: lines.join('\n') }, true);
            this.dead = true;
        } else if (this.enemy.isDead()) {
            this.textBubble.addToConversation({ text: lines.join('\n') }, true);
            this.commandExecuting = false;
            this.defeatedEnemy();
            return;
        } else {
            lines.push('Command?');
            this.textBubble.addToConversation({ text: lines.join('\n') }, true);
        }

        this.commandExecuting = false;
    }

    /**
     * Applies per-turn effect ticks to both sides. Returns lines describing them.
     */
    private endOfTurn(): string[] {
        const lines: string[] = [];
        const hero = this.game.hero;
        const heroTick = this.heroEffects.tick(hero.maxHp, this.rng);
        if (heroTick.heal > 0 && hero.hp < hero.maxHp) {
            hero.incHp(heroTick.heal);
            lines.push(`Thou regainest ${heroTick.heal} HP.`);
        }
        if (heroTick.damage > 0) {
            hero.takeDamage(heroTick.damage);
            lines.push(`Thou sufferest ${heroTick.damage} damage.`);
        }
        const enemyTick = this.enemyEffects.tick(this.enemy.maxHp, this.rng);
        if (enemyTick.damage > 0) {
            this.enemy.takeDamage(enemyTick.damage);
            lines.push(`The ${this.enemy.name} suffers ${enemyTick.damage} damage.`);
        }
        if (this.monsterJob?.regenPct && !this.enemy.isDead() && this.enemy.hp < this.enemy.maxHp) {
            const amount = Math.max(1, Math.floor(this.enemy.maxHp * this.monsterJob.regenPct / 100));
            this.enemy.hp = Math.min(this.enemy.maxHp, this.enemy.hp + amount);
            lines.push(`The ${this.enemy.name} mends its wounds.`);
        }
        enemyTick.expired.forEach((id) => {
            if (EFFECTS[id] && !this.enemy.isDead()) {
                lines.push(`The ${this.enemy.name} is no longer ${EFFECTS[id].name.toLowerCase()}.`);
            }
        });
        return lines;
    }

    override enter() {

        super.enter();
        this.commandExecuting = false;
        const conversation: Conversation = new Conversation(this.game);
        let intro = `A ${this.enemy.name} draws near!`;
        if (this.boss && !this.boss.fixed) {
            intro = `The ${this.enemy.name} blocks thy path!`;
        }
        if (this.monsterJob) {
            intro += ` It is a ${this.monsterJob.id}.`;
        }
        conversation.addSegment({ text: intro + '  Command?' });
        this.textBubble.setConversation(conversation);
    }

    getEnemy(): Enemy {
        return this.enemy;
    }

    getTextBubble(): TextBubble {
        return this.textBubble;
    }

    getMonsterJob(): MonsterJob | undefined {
        return this.monsterJob;
    }

    /**
     * Uses the best healing item: a Herb, then crafted healing supplies.
     */
    item() {
        const game = this.game;
        const hero = game.hero;
        const healMult = 1 + (this.heroMods().heal ?? 0) / 100;
        if (game.party.getInventory().remove('Herb')) {
            const amount = Math.round(Utils.randomInt(23, 31) * healMult);
            hero.incHp(amount);
            this.commandExecuting = true;
            this.textBubble.addToConversation({ text: `${hero.name} used the Herb and recovered ${amount} HP.` }, true);
            this.afterHeroAction();
            return;
        }
        const supply = HEALING_SUPPLIES.find((id) => (game.ext.save.supplies[id] ?? 0) > 0);
        if (supply) {
            const result = game.ext.useSupply(supply, hero, healMult);
            const buff = SUPPLIES[supply].buff;
            if (buff) {
                // Supplies used in battle take effect right away
                game.ext.save.pendingBuffs = game.ext.save.pendingBuffs.filter((b) => b !== buff);
                this.heroEffects.apply(buff, 5);
            }
            this.commandExecuting = true;
            this.textBubble.addToConversation({ text: result.message }, true);
            this.afterHeroAction();
            return;
        }
        this.textBubble.addToConversation({ text: 'Thou hast no healing items. Command?' });
    }

    /**
     * Raises the hero's guard: takes less damage this turn.
     */
    guard() {
        this.commandExecuting = true;
        this.heroEffects.apply('fortify', 1);
        this.heroEffects.apply('ac', 1);
        this.textBubble.addToConversation({ text: `${this.game.hero.name} raises a guard.` }, true);
        this.afterHeroAction();
    }

    /**
     * Opens the list of spells the hero's class knows.
     */
    spell() {
        const ext = this.game.ext;
        const spells = knownSpells(ext.save.job, ext.jobLevel(ext.save.job));
        const tileSize = this.game.getTileSize();
        this.spellBubble = new ChoiceBubble<BattleSpell>(this.game, tileSize * 5, tileSize, tileSize * 11,
            Math.min(spells.length + 2, 11) * 18 * this.game.scale, spells,
            (sp) => `${sp.name.padEnd(14, ' ')}${sp.mp}MP`, true, `SPELL ${this.game.hero.mp}MP`);
    }

    private castSpell(spell: BattleSpell) {
        const hero = this.game.hero;
        if (this.heroEffects.cannotCast()) {
            this.textBubble.addToConversation({ text: 'Thou art silenced and cannot cast! Command?' });
            return;
        }
        if (hero.mp < spell.mp) {
            this.textBubble.addToConversation({ text: 'Thou dost not have enough magic to cast the spell. Command?' });
            return;
        }
        hero.mp -= spell.mp;
        this.commandExecuting = true;
        this.textBubble.addToConversation({ text: `${hero.name} chants the spell of ${spell.name}.`, sound: 'castSpell' }, true);
        const mods = this.heroMods();
        if (spell.damage) {
            const base = rollDice(this.rng, spell.damage);
            const damage = Math.max(1, Math.round(base * (1 + ((mods.dmg ?? 0) + elementalBonus(mods)) / 100) *
                (1 + this.enemyEffects.getTakenPct() / 100)));
            this.enemyEffects.absorbDamage(damage);
            const dead = this.enemy.takeDamage(damage);
            this.textBubble.addToConversation({ text: `The ${this.enemy.name}'s Hit Points have been reduced by ${damage}.` }, true);
            if (dead) {
                this.defeatedEnemy();
                return;
            }
        }
        if (spell.heal) {
            const amount = Math.round(rollDice(this.rng, spell.heal) * (1 + (mods.heal ?? 0) / 100));
            hero.incHp(amount);
            this.textBubble.addToConversation({ text: `Thou recoverest ${amount} HP.` }, true);
        }
        if (spell.selfEffect) {
            this.heroEffects.apply(spell.selfEffect.id, spell.selfEffect.turns, { pool: spell.selfEffect.pool });
            this.textBubble.addToConversation({ text: `Thou art ${EFFECTS[spell.selfEffect.id]?.name.toLowerCase() ?? 'empowered'}.` }, true);
        }
        if (spell.enemyEffect) {
            const saveChance = this.boss ? 0.45 : 0.2;
            if (this.rng() < saveChance) {
                this.textBubble.addToConversation({ text: `The ${this.enemy.name} resists the spell!` }, true);
            } else {
                this.enemyEffects.apply(spell.enemyEffect.id, spell.enemyEffect.turns,
                    { stacks: spell.enemyEffect.stacks, bonus: Math.floor(hero.level / 3) });
                this.textBubble.addToConversation({ text: `The ${this.enemy.name} is ${EFFECTS[spell.enemyEffect.id]?.name.toLowerCase() ?? 'afflicted'}.` }, true);
            }
        }
        this.afterHeroAction();
    }

    /**
     * Group finder allies act each turn during a group run. Returns whether the enemy died.
     */
    private groupTurn(): boolean {
        const ext = this.game.ext;
        const role = ext.save.groupRole;
        if (!role || !this.options.instance) {
            return false;
        }
        const hero = this.game.hero;
        const dpsCount = role === 'dps' ? 2 : 3;
        const damage = Math.max(1, Math.round(hero.computePhysicalAttackDamage(this.enemy) * 0.3 * dpsCount));
        this.textBubble.addToConversation({ text: `Thy party strikes for ${damage} damage.` }, true);
        if (role !== 'healer' && hero.hp < hero.maxHp * 0.7) {
            const heal = Math.max(1, Math.round(hero.maxHp * 0.1));
            hero.incHp(heal);
            this.textBubble.addToConversation({ text: `The party healer mends thee for ${heal}.` }, true);
        }
        if (role !== 'tank') {
            this.heroEffects.apply('fortify', 1); // The tank draws attacks
        }
        return this.enemy.takeDamage(damage);
    }

    private abilityChoices(): AbilityChoice[] {
        const ext = this.game.ext;
        const save = ext.save;
        const mainLevel = ext.jobLevel(save.job);
        const support = save.supportJob ? getJob(save.supportJob) : undefined;
        const supLevel = support ? supportLevel(mainLevel, ext.jobLevel(support.id)) : 0;
        const choices: AbilityChoice[] = availableAbilities(getJob(save.job), mainLevel, support, supLevel)
            .map((a) => ({ ability: a.ability, label: a.support ? `${a.ability.name} SUP` : a.ability.name }));
        const racial = RACE_ABILITIES[save.race] as JobAbility | undefined;
        if (racial) {
            choices.push({ ability: racial, label: `${racial.name} RACE` });
        }
        for (const core of ext.coreSkills()) {
            choices.push({ ability: { name: core.name, level: 1, effect: core.skill }, label: core.name.substring(0, 18) });
        }
        return choices.filter((c) => !this.usedAbilities.has(c.ability.name));
    }

    /**
     * Opens the list of once-per-battle job and racial abilities.
     */
    skill() {
        const choices = this.abilityChoices();
        if (!choices.length) {
            this.textBubble.addToConversation({ text: 'Thou hast no abilities left this battle. Command?' });
            return;
        }
        const tileSize = this.game.getTileSize();
        this.skillBubble = new ChoiceBubble<AbilityChoice>(this.game, tileSize * 6, tileSize, tileSize * 10,
            (choices.length + 2) * 18 * this.game.scale, choices, (c) => c.label, true, 'SKILL');
    }

    private useAbility(ability: JobAbility) {
        this.usedAbilities.add(ability.name);
        this.commandExecuting = true;
        const hero = this.game.hero;
        const effect = ability.effect;
        this.textBubble.addToConversation({ text: `${hero.name} uses ${ability.name}!`, sound: 'castSpell' }, true);

        if (effect.selfEffect) {
            this.heroEffects.apply(effect.selfEffect.id, effect.selfEffect.turns, { pool: effect.selfEffect.pool });
            this.textBubble.addToConversation({ text: `Thou art ${EFFECTS[effect.selfEffect.id]?.name.toLowerCase() ?? 'empowered'}.` }, true);
        }
        if (effect.healPct) {
            const amount = Math.max(1, Math.round(hero.maxHp * effect.healPct / 100 * (1 + (this.heroMods().heal ?? 0) / 100)));
            hero.incHp(amount);
            this.textBubble.addToConversation({ text: `Thou recoverest ${amount} HP.` }, true);
        }
        if (effect.strike) {
            const { damage, dead, lines } = this.strikeEnemy(effect.strike);
            lines.forEach((text) => {
                this.textBubble.addToConversation({ text }, true);
            });
            this.textBubble.addToConversation({ text: `The ${this.enemy.name} takes ${damage} damage.` }, true);
            if (dead) {
                this.defeatedEnemy();
                return;
            }
        }
        if (effect.enemyEffect) {
            const resisted = !!this.boss && this.rng() < 0.4 && !!EFFECTS[effect.enemyEffect.id]?.loseTurn;
            if (resisted) {
                this.textBubble.addToConversation({ text: `The ${this.enemy.name} resists!` }, true);
            } else {
                this.enemyEffects.apply(effect.enemyEffect.id, effect.enemyEffect.turns,
                    { stacks: effect.enemyEffect.stacks, bonus: Math.floor(hero.level / 3) });
                this.textBubble.addToConversation({ text: `The ${this.enemy.name} is ${EFFECTS[effect.enemyEffect.id]?.name.toLowerCase() ?? 'afflicted'}.` }, true);
            }
        }
        this.afterHeroAction();
    }

    override render(ctx: CanvasRenderingContext2D) {

        const game: DwGame = this.game;

        if (this.shake) {
            game.setCameraOffset(this.shakeXOffs, 0);
        }
        game.drawMap(ctx);
        if (this.shake) {
            game.setCameraOffset(0, 0);
        }

        const width: number = game.getWidth();
        const height: number = game.getHeight();
        const tileSize: number = game.getTileSize();

        const battleBG: Image = game.assets.get('battleBG');
        let x: number = (width - battleBG.width) / 2;
        let y: number = (height - battleBG.height) / 2 - tileSize;
        battleBG.draw(ctx, x, y);

        if (this.enemy && !this.enemiesDead) {

            const flash: boolean = Math.round(this.flashMillis) % 40 > 20;
            const enemyImg: Image = this.enemy.getImage(flash);
            x = (width - enemyImg.width) / 2;
            y += battleBG.height - tileSize / 2 - enemyImg.height;
            enemyImg.draw(ctx, x, y);

            if (!this.commandExecuting) {
                if (this.textBubble?.isDone()) {
                    this.commandBubble.paint(ctx);
                }
            }
            if (this.statBubble) {
                this.statBubble.paint(ctx);
            }
            if (this.textBubble) {
                this.textBubble.paint(ctx);
            }
            this.skillBubble?.paint(ctx);
            this.spellBubble?.paint(ctx);

        } else if (this.enemiesDead) {
            if (this.statBubble) {
                this.statBubble.paint(ctx);
            }
            if (this.textBubble) {
                this.textBubble.paint(ctx);
            }
        }

    }

    run() {

        const game: DwGame = this.game;

        this.commandExecuting = true;
        this.fightDelay = new Delay({ millis: [ 600 ], callback: this.runCallback.bind(this) });
        game.audio.playSound('run');
        this.textBubble.addToConversation({ text: game.hero.name + ' started to run away.' }, true);
    }

    private runCallback() {
        delete this.fightDelay;
        const temp: number = Utils.randomInt(2);
        // Roaming bosses are harder to escape
        const success: boolean = temp === 1 && !(this.boss && !this.boss.fixed && this.rng() < 0.5);
        if (success) {
            this.commandExecuting = false;
            this.backToRoaming();
        } else {
            this.commandBubble.reset();
            this.textBubble.addToConversation({ text: 'Couldn\'t run!' });
            this.textBubble.onDone(() => {
                this.enemyAttack();
            });
        }
    }

    override update(delta: number) {

        const game: DwGame = this.game;

        if (this.dead && this.textBubble.isDone()) {
            game.ext.abandonRun();
            game.setState(new DeadState(game, this));
            return;
        }

        this.statBubble.update(delta);
        this.commandBubble.update(delta);

        this.handleDefaultKeys();

        if (this.enemiesDead && this.textBubble.isDone()) {
            if (game.anyKeyDown()) {
                const next = this.nextInstanceFight;
                if (next) {
                    game.setState(new BattleState(game, next.enemy, { bossId: next.bossId, instance: true }));
                } else {
                    this.backToRoaming();
                }
                return;
            }
        }

        if (this.fightDelay) {
            this.fightDelay.update(delta);
        }
        if (this.enemyFlashDelay) {
            this.flashMillis += delta;
            this.enemyFlashDelay.update(delta);
        } else if (this.enemyAttackDelay) {
            this.enemyAttackDelay.update(delta);
        } else if (this.enemyAttackShakeDelay) {
            this.enemyAttackShakeDelay.update(delta);
            this.shakeMillisCount += delta;
            this.shakeXOffs = this.shakeMillisCount % 100 > 50 ? 4 : -4;
        }

        if (this.spellBubble) {
            this.spellBubble.update(delta);
            if (this.spellBubble.handleInput()) {
                const spell = this.spellBubble.getSelectedItem();
                delete this.spellBubble;
                if (spell) {
                    this.castSpell(spell);
                }
            }
            return;
        }

        if (this.skillBubble) {
            this.skillBubble.update(delta);
            if (this.skillBubble.handleInput()) {
                const choice = this.skillBubble.getSelectedItem();
                delete this.skillBubble;
                if (choice) {
                    this.useAbility(choice.ability);
                }
            }
            return;
        }

        if (!this.textBubble.isDone()) {
            this.textBubble.handleInput();
            this.textBubble.update(delta);
        } else if (!this.commandExecuting && this.commandBubble.handleInput()) {
            this.commandBubble.handleCommandChosen(this);
        }

    }
}
