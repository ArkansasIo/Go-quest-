import { Delay, InputManager, Keys, TiledLayerData } from 'gtp';
import { BaseState } from './BaseState';
import { DwGame } from './DwGame';
import { CommandBubble } from './CommandBubble';
import { StatBubble } from './StatBubble';
import { TextBubble } from './TextBubble';
import { Conversation } from './Conversation';
import { StatusBubble } from './StatusBubble';
import { ItemBubble } from './ItemBubble';
import { Item } from './Item';
import { Npc } from './Npc';
import { Hero } from './Hero';
import { MapLogic } from './mapLogic/MapLogic';
import { CheatOption, Cheats, GoldOption, WarpLocation } from './Cheats';
import { EnemyData } from './Enemy';
import { Armor } from './Armor';
import { ChoiceBubble } from './ChoiceBubble';
import { Shield } from './Shield';
import { Weapon } from './Weapon';
import { Door } from './Door';
import { DwMap } from './DwMap';
import { Chest } from './Chest';
import { toRowAndColumn } from './LocationString';
import { getChestConversation } from './ChestConversations';
import { getSearchConversation } from './SearchConversations';
import { SpellBubble } from '@/app/dw/SpellBubble';
import { Spell } from '@/app/dw/Spell';
import { ExtMenu } from '@/app/dw/ExtMenu';
import { ExtMenus } from '@/app/dw/ExtMenus';
import { EASTER_EGGS, InputKey, SequenceRecognizer, discover, discoverEgg, getDiscovery, withinGlimmer } from '@/app/dw/systems/discoveries';
import { pickRareBoss } from '@/app/dw/systems/bosses';
import { seededRng, hashString } from '@/app/dw/systems/rng';
import { describeLocation } from '@/app/dw/systems/world';

type RoamingSubState = 'ROAMING' | 'MENU' | 'TALKING' | 'OVERNIGHT' | 'WARP_SELECTION' | 'CHEAT_SELECTION' | 'BATTLE_SELECTION' | 'WEAPON_SELECTION' | 'ARMOR_SELECTION' | 'SHIELD_SELECTION' | 'GOLD_SELECTION' | 'EXT_MENU';

/** Keys watched for button-code secrets, and the symbol each maps to. */
const EGG_KEYS: [number, InputKey][] = [
    [ Keys.KEY_UP_ARROW, 'U' ], [ Keys.KEY_DOWN_ARROW, 'D' ], [ Keys.KEY_LEFT_ARROW, 'L' ],
    [ Keys.KEY_RIGHT_ARROW, 'R' ], [ Keys.KEY_Z, 'A' ], [ Keys.KEY_X, 'B' ], [ Keys.KEY_ENTER, 'S' ],
];

type UpdateFunction = (delta: number) => void;

export class RoamingState extends BaseState {

    private readonly commandBubble: CommandBubble;
    private readonly statBubble: StatBubble;
    private statusBubble?: StatusBubble;
    private itemBubble?: ItemBubble;
    private spellBubble?: SpellBubble;
    private warpBubble?: ChoiceBubble<WarpLocation>;
    private cheatBubble?: ChoiceBubble<CheatOption>;
    private battleBubble?: ChoiceBubble<EnemyData>;
    private weaponSelectBubble?: ChoiceBubble<Weapon>;
    private armorBubble?: ChoiceBubble<Armor>;
    private shieldBubble?: ChoiceBubble<Shield>;
    private goldSelectBubble?: ChoiceBubble<GoldOption>;
    private readonly stationaryTimer: Delay;
    private overnightDelay?: Delay;
    private readonly updateMethods: Map<RoamingSubState, UpdateFunction>;
    private readonly textBubble: TextBubble;
    private showTextBubble: boolean;
    private substate: RoamingSubState;
    private showStats: boolean;
    private extMenu?: ExtMenu;
    private readonly extMenus: ExtMenus;
    private readonly eggRecognizer = new SequenceRecognizer();
    private readonly eggKeysDown = new Set<number>();
    private glimmerMillis = 0;
    private lastLocationId?: string;

    private static readonly OVERNIGHT_DARK_TIME: number = 2500;

    private static readonly OVERNIGHT_FADE_TIME: number = 500;

    private static totalTime = 0;

    constructor(game: DwGame) {

        super(game);

        this.commandBubble = new CommandBubble(game);
        this.statBubble = new StatBubble(this.game);
        this.stationaryTimer = new Delay({ millis: 1000 });

        this.updateMethods = new Map<RoamingSubState, UpdateFunction>();
        this.updateMethods.set('ROAMING', this.updateRoaming.bind(this));
        this.updateMethods.set('MENU', this.updateMenu.bind(this));
        this.updateMethods.set('TALKING', this.updateTalking.bind(this));
        this.updateMethods.set('OVERNIGHT', this.updateOvernight.bind(this));
        this.updateMethods.set('WARP_SELECTION', this.updateWarpSelection.bind(this));
        this.updateMethods.set('CHEAT_SELECTION', this.updateCheatSelection.bind(this));
        this.updateMethods.set('BATTLE_SELECTION', this.updateBattleSelection.bind(this));
        this.updateMethods.set('WEAPON_SELECTION', this.updateWeaponSelection.bind(this));
        this.updateMethods.set('ARMOR_SELECTION', this.updateArmorSelection.bind(this));
        this.updateMethods.set('SHIELD_SELECTION', this.updateShieldSelection.bind(this));
        this.updateMethods.set('GOLD_SELECTION', this.updateGoldSelection.bind(this));
        this.updateMethods.set('EXT_MENU', this.updateExtMenu.bind(this));
        this.extMenus = new ExtMenus(game);

        this.textBubble = new TextBubble(this.game);
        this.showTextBubble = false;
        this.substate = 'ROAMING'; // Can't call setState to appease tsc
        this.showStats = false;
    }

    search() {
        if (this.searchForDiscovery()) {
            return;
        }
        this.showTextBubble = true;
        this.textBubble.setConversation(getSearchConversation(this));
        this.setSubstate('TALKING');
    }

    take() {
        this.showTextBubble = true;
        this.textBubble.setConversation(getChestConversation(this));
        this.setSubstate('TALKING');
    }

    takeStairs() {
        if (this.game.hero.possiblyHandleIntersectedObject()) {
            this.setSubstate('ROAMING');
        } else {
            this.showOneLineConversation(true, 'There are no stairs here.');
        }
    }

    override update(delta: number) {

        const game: DwGame = this.game;

        this.handleDefaultKeys();
        if (game.inputManager.isKeyDown(Keys.KEY_R, true)) {
            game.startRandomEncounter();
            return;
        } else if (game.inputManager.isKeyDown(Keys.KEY_O, true)) {
            this.setSubstate('OVERNIGHT');
        }

        game.hero.update(delta);

        RoamingState.totalTime += delta;
        if (RoamingState.totalTime >= 1000) {
            RoamingState.totalTime = 0;
        }

      this.updateMethods.get(this.substate)!.call(this, delta);
    }

    private updateCheatSelection(delta: number) {

        // Do check here to appease tsc of cheatBubble being defined
        this.cheatBubble ??= Cheats.createCheatBubble(this.game);

        this.cheatBubble.update(delta);
        if (this.cheatBubble.handleInput()) {
            const cheat: CheatOption | undefined = this.cheatBubble.getSelectedItem();
            this.cheatBubble = undefined;
            if (cheat) {
                switch (cheat) {
                    case 'Change Gold...':
                        this.setSubstate('GOLD_SELECTION');
                        break;
                    case 'Level Up':
                        this.game.audio.playSound('bump');
                        break;
                    case 'Change Weapon...':
                        this.setSubstate('WEAPON_SELECTION');
                        break;
                    case 'Change Armor...':
                        this.setSubstate('ARMOR_SELECTION');
                        break;
                    case 'Change Shield...':
                        this.setSubstate('SHIELD_SELECTION');
                        break;
                    case 'Max HP/MP':
                        this.game.setHeroStats(255, 255, 255, 255);
                        this.game.audio.playSound('castSpell');
                        this.setSubstate('ROAMING');
                        break;
                    case 'Min HP/MP':
                        this.game.setHeroStats(1, 1, 1, 1);
                        this.game.audio.playSound('castSpell');
                        this.setSubstate('ROAMING');
                        break;
                    case 'Battle...':
                        this.setSubstate('BATTLE_SELECTION');
                        break;
                    default:
                        this.game.audio.playSound('bump');
                        break;
                }
            } else {
                this.setSubstate('MENU');
            }
            delete this.cheatBubble;
        }
    }

    private updateMenu(delta: number) {

        if (this.statBubble) {
            this.statBubble.update(delta);
        }

        if (this.statusBubble) {
            this.statusBubble.update(delta);
            if (this.game.anyKeyDown()) {
                delete this.statusBubble;
                return;
            }
        }

        let done: boolean;
        if (this.spellBubble) {
            this.spellBubble.update(delta);
            done = this.spellBubble.handleInput();
            if (done) {
                const selectedSpell: Spell | undefined = this.spellBubble.getSelectedItem();

                if (selectedSpell) {
                    const conversation = new Conversation(this.game, false);

                    if (selectedSpell.cost <= this.game.hero.mp) {
                        conversation.setSegments([
                            {
                                text: `\\w{hero.name} chanted the spell of ${selectedSpell.name}.`,
                                afterSound: 'castSpell',
                                afterAutoAdvanceDelay: 900,
                                afterAction: () => {
                                    // Stats are updated after the sound effect
                                    this.game.hero.mp -= selectedSpell.cost;
                                    const result = selectedSpell.cast(this.game.hero, undefined);
                                    return result.conversationSegments;
                                },
                            },
                        ]);
                        this.textBubble.setConversation(conversation);
                    } else {
                        conversation.addSegment('Thy MP is too low.');
                    }

                    this.showConversation(conversation);
                }

                delete this.spellBubble;
            }
            return;
        } else if (this.itemBubble) {
            this.itemBubble.update(delta);
            done = this.itemBubble.handleInput();
            if (done) {
                let success = false;
                const selectedItem: Item | undefined = this.itemBubble.getSelectedItem();

                if (selectedItem) {
                    success = selectedItem.use(this);
                    if (success) {
                        this.game.getParty().getInventory().remove(selectedItem.name);
                    }
                } else {
                    // Either canceled the dialog or selected item is unimplemented
                    success = false;
                }

                if (success) {
                    // Only bump back to roaming state if the item didn't change it first.
                    // TODO: Find a better way to do this
                    if (this.substate === 'MENU') {
                        this.setSubstate('ROAMING');
                    }
                }
                delete this.itemBubble;
            }
            return;
        }

        this.commandBubble.update(delta);
        done = this.commandBubble.handleInput();
        if (done) {
            this.commandBubble.handleCommandChosen(this);
            return;
        }
    }

    // ---------------------------------------------------------------------
    // Extended menus, button-code secrets and hidden discoveries

    showGearMenu() {
        this.extMenu = new ExtMenu(this.game, this.extMenus.gearRoot());
        this.setSubstate('EXT_MENU');
    }

    showMoreMenu() {
        this.extMenu = new ExtMenu(this.game, this.extMenus.moreRoot());
        this.setSubstate('EXT_MENU');
    }

    private updateExtMenu(delta: number) {
        if (this.statBubble) {
            this.statBubble.update(delta);
        }
        if (!this.extMenu || this.extMenu.isClosed()) {
            delete this.extMenu;
            this.startRoaming();
            return;
        }
        this.extMenu.update(delta);
    }

    /**
     * Feeds newly pressed keys to the button-code recognizer.
     */
    private sampleEggKeys() {
        const im: InputManager = this.game.inputManager;
        for (const [ key, symbol ] of EGG_KEYS) {
            const down = im.isKeyDown(key, false);
            if (down && !this.eggKeysDown.has(key)) {
                this.eggKeysDown.add(key);
                const egg = this.eggRecognizer.push(symbol);
                if (egg) {
                    this.eggRecognizer.clear();
                    const reward = discoverEgg(this.game.ext.save.eggs, egg);
                    if (reward) {
                        this.game.ext.record(undefined, 'eggs');
                        const lines = [
                            `A secret: ${egg.name}!`,
                            ...this.game.ext.grantReward(reward, this.game.hero, this.game.party, (n) => this.extMenus.addHerbs(n)),
                            ...this.game.ext.achievementLines(this.game.hero),
                            `(${this.game.ext.save.eggs.length}/${EASTER_EGGS.length} secrets found.)`,
                        ];
                        this.game.audio.playSound('openChest');
                        this.game.setNpcsPaused(true);
                        this.showOneLineConversation(false, ...lines);
                        return true;
                    }
                }
            } else if (!down) {
                this.eggKeysDown.delete(key);
            }
        }
        return false;
    }

    /**
     * Checks for a hidden discovery under the hero. Returns whether one was handled.
     */
    private searchForDiscovery(): boolean {
        const hero = this.game.hero;
        const locations = this.game.getDiscoveryLocations();
        for (const [ id, loc ] of locations) {
            if (loc.row !== hero.mapRow || loc.col !== hero.mapCol) {
                continue;
            }
            const d = getDiscovery(id);
            if (!d) {
                return false;
            }
            const ext = this.game.ext;
            const result = discover(ext.save.discoveries, d, hero.level, d.type === 'boss');
            if (result.status === 'too_low') {
                this.showOneLineConversation(false, `${hero.name} searched the ground.`,
                    'Something hidden is here, but thou art not yet strong enough to uncover it.');
                return true;
            }
            if (result.status === 'already') {
                return false; // Normal search
            }
            if (d.type === 'boss') {
                const boss = pickRareBoss(seededRng(hashString(d.id)), Math.max(hero.level, d.minLevel));
                if (boss && this.game.getEnemy(boss.baseEnemy)) {
                    this.startRoaming();
                    this.game.startEncounter(boss.baseEnemy, { bossId: boss.id, discoveryId: d.id, name: d.title.replace(/^The /, '') });
                    return true;
                }
                ext.save.discoveries.push(d.id); // No battle possible; grant directly
            }
            ext.record('dungeons', 'secrets');
            this.game.audio.playSound('openChest');
            this.showOneLineConversation(false, d.text,
                ...ext.grantReward(d.reward, hero, this.game.party, (n) => this.extMenus.addHerbs(n)),
                ...ext.achievementLines(hero));
            return true;
        }
        return false;
    }

    /** Draws a faint glimmer over undiscovered places within range. */
    private renderGlimmers(ctx: CanvasRenderingContext2D) {
        const hero = this.game.hero;
        const found = this.game.ext.save.discoveries;
        const tileSize = this.game.getTileSize();
        const pulse = 0.35 + 0.35 * Math.sin(this.glimmerMillis / 180);
        const heroLoc = { row: hero.mapRow, col: hero.mapCol };
        for (const [ id, loc ] of this.game.getDiscoveryLocations()) {
            if (found.includes(id) || !withinGlimmer(heroLoc, loc)) {
                continue;
            }
            const x = loc.col * tileSize - this.game.getMapXOffs() + tileSize / 2;
            const y = loc.row * tileSize - this.game.getMapYOffs() + tileSize / 2;
            const s = tileSize / 8;
            ctx.fillStyle = `rgba(255, 255, 210, ${pulse})`;
            ctx.fillRect(x - s / 2, y - s * 2, s, s * 4);
            ctx.fillRect(x - s * 2, y - s / 2, s * 4, s);
        }
    }

    /** Announces the zone / sub-zone / settlement when the hero enters a new one. */
    private checkLocation() {
        const map = this.game.getMap();
        const hero = this.game.hero;
        const loc = describeLocation(map.name, hero.mapRow, hero.mapCol, map.height, map.width);
        if (loc.id !== this.lastLocationId) {
            this.lastLocationId = loc.id;
            const isNew = this.game.ext.visit(loc.id);
            this.game.setStatusMessage(isNew ? `${loc.label} *NEW*` : loc.label);
        }
    }

    private updateRoaming(delta: number) {

        this.glimmerMillis += delta;
        if (!this.game.hero.isMoving()) {
            this.checkLocation();
        }
        if (this.sampleEggKeys()) {
            return;
        }

        if (this.showStats) {
            this.statBubble.update(delta);
        }

        const hero: Hero = this.game.hero;
        const im: InputManager = this.game.inputManager;

        if (this.game.actionKeyPressed()) {
            this.game.setNpcsPaused(true);
            this.commandBubble.reset();
            this.game.audio.playSound('menu');
            this.setSubstate('MENU');
            this.showStats = true;
            return;
        }

        // Make sure we're not in BattleTransitionState
        if (!hero.isMoving() && this.game.state === this) {

            if (im.up()) {
                hero.tryToMoveUp();
                this.stationaryTimer.reset();
                this.statBubble.init();
            //this.yOffs = Math.max(this.yOffs-inc, 0);
            } else if (im.down()) {
                hero.tryToMoveDown();
                this.stationaryTimer.reset();
                this.statBubble.init();
            //this.yOffs = Math.min(this.yOffs+inc, maxY);
            } else if (im.left()) {
                hero.tryToMoveLeft();
                this.stationaryTimer.reset();
                this.statBubble.init();
            //this.xOffs = Math.max(this.xOffs-inc, 0);
            } else if (im.right()) {
                hero.tryToMoveRight();
                this.stationaryTimer.reset();
                this.statBubble.init();
            //this.xOffs = Math.min(this.xOffs+inc, maxX);
            }

        }

        this.showStats = this.stationaryTimer.update(delta);

        if (im.isKeyDown(Keys.KEY_SHIFT)) {
            if (im.isKeyDown(Keys.KEY_C, true)) {
                this.game.toggleShowCollisionLayer();
            }
            if (im.isKeyDown(Keys.KEY_T, true)) {
                this.game.toggleShowTerritoryLayer();
            }
        }

        this.game.getMap().npcs.forEach((npc: Npc) => {
            npc.update(delta);
        });

    }

    private updateTalking(delta: number) {

        const done: boolean = this.textBubble.handleInput();
        if (/*this._textBubble.currentTextDone() && */this.textBubble.isOvernight()) {
            this.setSubstate('OVERNIGHT');
            this.textBubble.clearOvernight();
        } else if (this.showTextBubble) {
            this.textBubble.update(delta);
        }

        if (done) {
            this.startRoaming();
            return;
        }
    }

    private updateOvernight(delta: number) {

        if (this.overnightDelay) {
            this.overnightDelay.update(delta);
        } else {
            this.game.audio.playMusic('overnight', false);
            this.overnightDelay = new Delay({
                millis: [ RoamingState.OVERNIGHT_DARK_TIME ],
                callback: this.overnightOver.bind(this),
            });
        }
    }

    private updateWarpSelection(delta: number) {

        // Do check here to appease tsc of warpBubble being defined
        this.warpBubble ??= Cheats.createWarpBubble(this.game);

        this.warpBubble.update(delta);
        if (this.warpBubble.handleInput()) {
            const warpTo: WarpLocation | undefined = this.warpBubble.getSelectedItem();
            this.warpBubble = undefined;
            if (warpTo) {
                this.warpTo(warpTo); // TODO: Make me cleaner
                this.setSubstate('ROAMING');
            } else {
                this.setSubstate('MENU');
            }
            this.warpBubble = undefined;
        }
    }

    private updateBattleSelection(delta: number) {

        // Do check here to appease tsc of battleBubble being defined
        this.battleBubble ??= Cheats.createBattleBubble(this.game);

        this.battleBubble.update(delta);
        if (this.battleBubble.handleInput()) {
            const enemy = this.battleBubble.getSelectedItem();
            this.battleBubble = undefined;
            if (enemy) {
                this.game.startEncounter(enemy.name);
                this.setSubstate('ROAMING');
            } else {
                this.setSubstate('MENU');
            }
        }
    }

    private updateWeaponSelection(delta: number) {

        // Do check here to appease tsc of weaponSelectBubble being defined
        this.weaponSelectBubble ??= Cheats.createWeaponSelectBubble(this.game);

        this.weaponSelectBubble.update(delta);
        if (this.weaponSelectBubble.handleInput()) {
            const weapon: Weapon | undefined = this.weaponSelectBubble.getSelectedItem();
            this.weaponSelectBubble = undefined;
            if (weapon) {
                this.game.hero.weapon = weapon;
                this.game.setStatusMessage('Weapon changed to: ' + weapon.name);
                this.setSubstate('ROAMING');
            } else {
                this.setSubstate('CHEAT_SELECTION');
            }
        }
    }

    private updateArmorSelection(delta: number) {

        // Do check here to appease tsc of armorBubble being defined
        this.armorBubble ??= Cheats.createArmorSelectBubble(this.game);

        this.armorBubble.update(delta);
        if (this.armorBubble.handleInput()) {
            const armor = this.armorBubble.getSelectedItem();
            this.armorBubble = undefined;
            if (armor) {
                this.game.hero.armor = armor;
                this.game.setStatusMessage(`Armor changed to: ${armor.displayName}`);
                this.setSubstate('ROAMING');
            } else {
                this.setSubstate('CHEAT_SELECTION');
            }
        }
    }

    private updateShieldSelection(delta: number) {

        // Do check here to appease tsc of shieldBubble being defined
        this.shieldBubble ??= Cheats.createShieldSelectBubble(this.game);

        this.shieldBubble.update(delta);
        if (this.shieldBubble.handleInput()) {
            const shield = this.shieldBubble.getSelectedItem();
            this.shieldBubble = undefined;
            if (shield) {
                this.game.setShield(shield);
                this.setSubstate('ROAMING');
            } else {
                this.setSubstate('CHEAT_SELECTION');
            }
        }
    }

    private updateGoldSelection(delta: number) {

        // Do check here to appease tsc of goldSelectBubble being defined
        this.goldSelectBubble ??= Cheats.createGoldSelectBubble(this.game);

        this.goldSelectBubble.update(delta);
        if (this.goldSelectBubble.handleInput()) {
            const goldOption: GoldOption | undefined = this.goldSelectBubble.getSelectedItem();
            this.goldSelectBubble = undefined;
            if (goldOption) {
                const goldAmountMap = new Map<GoldOption, number>([
                    [ '9999 Gold', 9999 ],
                    [ '1000 Gold', 1000 ],
                    [ '1 Gold', 1 ],
                    [ '0 Gold', 0 ],
                ]);
                const newGold = goldAmountMap.get(goldOption)!;
                this.game.party.gold = newGold;
                this.game.setStatusMessage(`Gold changed to ${newGold}`);
                this.game.audio.playSound('openChest');
                this.setSubstate('ROAMING');
            } else {
                this.setSubstate('CHEAT_SELECTION');
            }
        }
    }

    private overnightOver() {
        this.game.audio.playMusic('MUSIC_TOWN');
        delete this.overnightDelay;
        this.setSubstate('TALKING');
        //         this._textBubble.nudgeConversation(); // User doesn't have to press a key
    }

    openDoor(): boolean {

        const door: Door | undefined = this.game.getDoorHeroIsFacing();

        if (door) {

            const game: DwGame = this.game;
            if (!game.party.getInventory().remove('Magic Key')) {
                this.showOneLineConversation(false, 'You do not have a key!'); // TODO: Verify text
                return false;
            }

            this.game.audio.playSound('door');
            const map: DwMap = this.game.getMap();
            map.getLayer('tileLayer').setData(door.row, door.col, door.replacementTileIndex);
            const index: number = map.doors.indexOf(door);
            if (index > -1) {
                map.doors.splice(index, 1);
                map.getLayer('collisionLayer').setData(door.row, door.col, 0);
            } else { // Should never happen
                console.error(`Door not found in map.doors! - ${door.toString()}`);
            }
            this.setSubstate('ROAMING');
            return true;
        }

        this.showOneLineConversation(false, 'There is no door here.');
        return false;
    }

    private possiblyRenderNpc(npc: Npc, ctx: CanvasRenderingContext2D) {

        const row: number = npc.mapRow;
        const col: number = npc.mapCol;
        const underRoof: boolean = this.game.hasRoofTile(row, col);
        if (underRoof && this.game.inside || !underRoof && !this.game.inside) {
            npc.render(ctx);
        }
    }

    override render(ctx: CanvasRenderingContext2D) {

        if (this.game.getMap().propertiesByName.get('requiresTorch')) {
            this.game.clearScreen('#000000');
            ctx.save();
            const clipRadius: number = this.game.getUsingTorch() ? this.game.getTileSize() * 3 / 2 :
                this.game.getTileSize() / 2;
            const x0: number = this.game.getWidth() / 2 - clipRadius;
            const y0: number = this.game.getHeight() / 2 - clipRadius;
            ctx.beginPath();
            ctx.rect(x0, y0, 2 * clipRadius, 2 * clipRadius);
            ctx.clip();
        } else if (this.game.inside) {
            this.game.clearScreen('#000000');
        }

        this.game.drawMap(ctx);

        // TODO: Be more efficient here
        this.game.getMap().chests.forEach((chest: Chest) => {

            const { row, col } = toRowAndColumn(chest.location);

            let x: number = col * this.game.getTileSize();
            x -= this.game.getMapXOffs();
            let y: number = row * this.game.getTileSize();
            y -= this.game.getMapYOffs();
            this.game.getMap().drawTile(ctx, x, y, 5, {} as TiledLayerData);
        });

        this.renderGlimmers(ctx);

        this.game.hero.render(ctx);

        this.game.getMap().npcs.forEach((npc: Npc) => {
            this.possiblyRenderNpc(npc, ctx);
        });

        if (this.game.getMap().propertiesByName.get('requiresTorch')) {
            ctx.restore();
        }

        if (this.substate !== 'ROAMING') {
            this.commandBubble.paint(ctx);
        }

        if (this.showTextBubble) {
            this.textBubble.paint(ctx);
        }

        if (this.substate !== 'ROAMING' || this.showStats) {
            this.statBubble.paint(ctx);
        }
        if (this.statusBubble) {
            this.statusBubble.paint(ctx);
        }
        if (this.spellBubble) {
            this.spellBubble.paint(ctx);
        }
        if (this.itemBubble) {
            this.itemBubble.paint(ctx);
        }
        if (this.warpBubble) {
            this.warpBubble.paint(ctx);
        }
        if (this.cheatBubble) {
            this.cheatBubble.paint(ctx);
        }
        if (this.battleBubble) {
            this.battleBubble.paint(ctx);
        }
        if (this.weaponSelectBubble) {
            this.weaponSelectBubble.paint(ctx);
        }
        if (this.armorBubble) {
            this.armorBubble.paint(ctx);
        }
        if (this.shieldBubble) {
            this.shieldBubble.paint(ctx);
        }
        if (this.goldSelectBubble) {
            this.goldSelectBubble.paint(ctx);
        }
        this.extMenu?.paint(ctx);

        if (this.overnightDelay) {
            ctx.save();
            const overnightRemaining: number = this.overnightDelay.getRemaining();
            let alpha: number;
            const fadeInTime: number = RoamingState.OVERNIGHT_FADE_TIME;
            if (overnightRemaining > RoamingState.OVERNIGHT_DARK_TIME - fadeInTime) {
                alpha = (RoamingState.OVERNIGHT_DARK_TIME - overnightRemaining) / fadeInTime;
                ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
            } else if (overnightRemaining < fadeInTime) {
                alpha = overnightRemaining / fadeInTime;
                ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
            } else {
                ctx.fillStyle = 'rgba(0, 0, 0, 1)';
            }
            ctx.fillRect(0, 0, this.game.getWidth(), this.game.getHeight());
            ctx.restore();
        }
    }

    private setSubstate(substate: RoamingSubState) {
        const prevSubstate: RoamingSubState = this.substate;
        this.substate = substate;
        if (substate === 'MENU' && prevSubstate === 'ROAMING') {
            this.commandBubble.init();
        } else if (substate === 'TALKING' && prevSubstate !== 'OVERNIGHT') {
            this.textBubble.init();
        }
    }

    showCheatBubble() {
        this.setSubstate('CHEAT_SELECTION');
    }

    showInventory() {
        this.itemBubble = new ItemBubble(this.game);
    }

    private showNoSpellsMessage() {
        this.showOneLineConversation(false, 'You have not learned any spells yet!');
    }

    /**
     * Displays one or more static lines of text in the conversation bubble.
     *
     * @param voice Whether to play the "talking" sound effect.
     * @param text The text to display.
     */
    showOneLineConversation(voice: boolean, ...text: string[]) {
        const conversation: Conversation = new Conversation(this.game, voice);
        text.forEach((line) => {
            conversation.addSegment(line);
        });
        this.showConversation(conversation);
    }

    showConversation(conversation: Conversation) {
        this.showTextBubble = true;
        this.textBubble.setConversation(conversation);
        this.setSubstate('TALKING');
    }

    showSpellList() {

        const hero: Hero = this.game.hero;

        if (!hero.spells.length) {
            this.showNoSpellsMessage();
            return;
        }

        this.spellBubble = new SpellBubble(this.game);
    }

    showStatus() {
        this.statusBubble = new StatusBubble(this.game);
    }

    showWarpBubble() {
        this.setSubstate('WARP_SELECTION');
    }

    startRoaming() {
        this.game.setNpcsPaused(false);
        this.showTextBubble = false;
        this.setSubstate('ROAMING');
    }

    talkToNpc() {

        const logic: MapLogic | undefined = this.game.getMapLogic();
        if (!logic) {
            console.log('Error: No map logic found for this map!  Cannot talk to NPCs!');
            return;
        }

        const npc: Npc | undefined = this.game.getNpcHeroIsFacing();
        const conversation: Conversation = new Conversation(this.game, true);

        if (npc) {
            const hero: Hero = this.game.hero;
            //var newNpcDir = this.getHero().direction.opposite();
            const newNpcDir: number = (hero.direction + 2) % 4;
            npc.direction = newNpcDir;
            conversation.setSegments(logic.npcText(npc, this.game));
        } else {
            conversation.addSegment('There is no one there.');
        }
        this.showTextBubble = true;
        this.textBubble.setConversation(conversation);
        this.setSubstate('TALKING');
    }

    warpTo(location: WarpLocation) {
        this.setSubstate('ROAMING');
        Cheats.warp(this.game, location);
    }
}
