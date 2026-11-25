/**
 * Menu trees for the extended systems: GEAR (equipment, gem/rune forges, bag, repairs)
 * and MORE (journals, jobs, professions, supplies, companions, mounts, season).
 */
import { STORY, TIER_NAMES, currentAct } from './systems/story';
import { DwGame } from './DwGame';
import { HERB } from './Item';
import { MenuInfo, MenuItem, MenuNodeFactory, MenuResult } from './ExtMenu';
import { ACHIEVEMENTS } from './systems/achievements';
import { BOSSES, BOSS_CATEGORIES, bossCompletion, bossRank } from './systems/bosses';
import {
    COMPANIONS, MOUNTS, STANCES, bondTier, companionAssist, getCompanion, getMount, stableStock, mountPrice,
    talkToCompanion,
} from './systems/companions';
import { WORLD_DISCOVERIES, eggArchive } from './systems/discoveries';
import { Extended } from './systems/Extended';
import {
    EquipSlot, GearEnhancement, QUALITY_COLOR, SocketSlot, gearDisplayName, gearMods, gearScore,
    quoteVendorPrice, setBonuses,
    AFFIX_COUNT, QUALITIES } from './systems/gear';
import { JOBS, RACES, availableAbilities, getJob, getRace, isTown, supportLevel, SUPPORT_UNLOCK_LEVEL , Role } from './systems/jobs';
import {
    PROFESSIONS, SUPPLIES, SupplyId, canBuyPerk, getMaterial, lessonCost, perkPointsForSkill, perkTree,
    pointsSpent, recipesFor, resetPerks, buyPerk, hasMaterials,
    contentLevel } from './systems/professions';
import { MasteryStat, paragonRank, xpToNextLevel } from './systems/progression';
import {
    JOURNEY, PASS_TIERS, chapterComplete, claimChapter, claimEventCache, claimWeekly, monthlyEvent, passTier,
    passTierReward, refreshSeason, seasonFor, seasonRank, weeklyProgress, weeklyQuests,
} from './systems/seasons';
import { SocketKind, parseSocketable, socketableName } from './systems/sockets';
import { SUBSTATS, describeMods } from './systems/stats';
import { TALENTS, TREE_NAMES, TreeId, pointsInTree } from './systems/talents';
import { FORGEABLE, FORGE_SHARD_COST, IMPRINT_COST, initialPotential } from './systems/forge';
import { currentEvent, groupFinderBonus, minutesLeft, queueTime } from './systems/events';
import { BATTLE_SPELLS, knownSpells } from './systems/spells';
import { BOSS_TITLES, UNIQUES } from './systems/legendaries';
import { optionsMenu } from './InitialMenuState';
import { HotkeyAction, keybindHelpLines } from './Keybinds';
import {
    MASTERY_THRESHOLDS, UpgradeSlot, armoryStock, masteryMods, masteryRank, upgradeChance, upgradeCost,
} from './systems/armory';
import {
    ARMOR_CLASSES, ATTRIBUTES, ATTRIBUTE_INFO, CLASSES, CORE_RACES, GEAR_TIERS, ITEM_CATEGORIES, SKILL_CORES, WEAPON_TYPES,
    attributeModifier, coreSlotsFor, getClass, getCore,
} from './systems/characters';
import { BIOMES, CONTINENTS, COUNTRIES, SETTLEMENTS, UNDERGROUND, ZONES, getBiome, getCountry } from './systems/world';
import {
    INSTANCE_COUNTS, InstanceKind, WORLD_TIER_NAMES, availableInstances, instanceBoss, instanceClearGold, isLockedOut,
    worldTierScaling, worldTierUnlockLevel,
} from './systems/instances';
import { EFFECTS } from './systems/effects';

/** Steps the hero must walk between gathering attempts. */
export const GATHER_STEP_COOLDOWN = 12;

const info = (title: string | undefined, ...lines: string[]): MenuInfo => ({ title, lines });

const item = (label: string, run: () => MenuResult, color?: string): MenuItem => ({ label, run, color });

const pad = (text: string, width: number): string => text.length >= width ? text.substring(0, width) : text + ' '.repeat(width - text.length);

export class ExtMenus {

    constructor(private readonly game: DwGame) {}

    private get ext(): Extended {
        return this.game.ext;
    }

    private mapName(): string {
        return this.game.getMap().name;
    }

    private refresh() {
        this.game.ext.applyDerived(this.game.hero);
    }

    /**
     * The menu (or message) a hotkey opens. Returns undefined for actions handled elsewhere
     * (world map, classic items, status).
     */
    hotkey(action: HotkeyAction): MenuNodeFactory | MenuInfo | undefined {
        switch (action) {
            case 'mainMenu': return this.moreRoot();
            case 'gear': return this.gearRoot();
            case 'character': return this.characterMenu();
            case 'bag': return this.bagMenu();
            case 'journal': return this.journalMenu();
            case 'talents': return this.talentsMenu();
            case 'spells': return info('SPELLS', ...knownSpells(this.ext.save.job, this.ext.jobLevel(this.ext.save.job))
                .map((sp) => `${sp.name} ${sp.mp}MP (${sp.school})`), 'Cast them in battle with SPELL.');
            case 'cores': return this.coresMenu();
            case 'forge': return this.forgeMenu();
            case 'season': return this.seasonMenu();
            case 'adventure': return this.adventureMenu();
            case 'atlas': return this.atlasMenu();
            case 'worldTier': return this.worldTierMenu();
            case 'ride': {
                const r = this.ext.toggleRide(this.mapName());
                return info(undefined, r.message);
            }
            case 'professions': return this.professionsMenu();
            case 'companion': return this.companionMenu();
            case 'save':
                if (this.ext.save.activeRun) {
                    return info(undefined, 'Thou canst not save inside a dungeon.');
                }
                this.game.saveAdventureLog();
                return info(undefined, 'Thy deeds have been recorded in the Adventure Log.');
            case 'help': return info('KEYBINDS', ...keybindHelpLines());
            default: return undefined;
        }
    }

    // =====================================================================
    // GEAR

    gearRoot(): MenuNodeFactory {
        return () => {
            this.ext.syncEnhancements(this.game.hero);
            return {
                title: 'GEAR',
                items: [
                    item('EQUIPMENT', () => this.equipmentInfo()),
                    item('GEM FORGE', () => this.forgeSlots('gem')),
                    item('RUNE FORGE', () => this.forgeSlots('rune')),
                    item(`BAG (${this.ext.save.bag.length})`, () => this.bagMenu()),
                    item('ARTIFACT & RELIC', () => this.wondrousMenu()),
                    item('REPAIR', () => this.repair()),
                    item(`FORGE (${this.ext.save.shards} SHARDS)`, () => this.forgeMenu()),
                    item('UPGRADE +1..+15', () => this.upgradeMenu()),
                    item('ARMORY', () => {
                        if (!isTown(this.mapName())) {
                            return info(undefined, 'The armory is in town.');
                        }
                        return this.armoryMenu();
                    }),
                    item('WEAPON MASTERY', () => this.masteryInfo()),
                    item('ALL BONUSES', () => this.bonusInfo()),
                ],
            };
        };
    }

    private describeGear(slot: EquipSlot, gear: GearEnhancement | undefined, baseName: string): string[] {
        if (!gear) {
            return [ `${slot.toUpperCase()}: none` ];
        }
        const lines = [ `${slot.toUpperCase()}: ${gearDisplayName({ ...gear, slot }, baseName)}` ];
        lines.push(`  ${gear.quality} IL${gear.itemLevel}  DUR ${gear.durability}/${gear.maxDurability}  SCORE ${gearScore(gear)}`);
        if (gear.gems.length) {
            lines.push(`  GEMS: ${gear.gems.map((g) => g ? socketableName(g) : '[ ]').join(' ')}`);
        }
        if (gear.runes.length) {
            lines.push(`  RUNES: ${gear.runes.map((g) => g ? socketableName(g) : '[ ]').join(' ')}`);
        }
        const mods = describeMods(gearMods({ ...gear, slot }));
        if (mods) {
            lines.push(`  ${mods}`);
        }
        return lines;
    }

    private equipmentInfo(): MenuInfo {
        const hero = this.game.hero;
        const s = this.ext.save;
        const lines = [
            ...this.describeGear('weapon', s.enhancements.weapon, hero.weapon?.displayName ?? ''),
            ...this.describeGear('armor', s.enhancements.armor, hero.armor?.displayName ?? ''),
            ...this.describeGear('shield', s.enhancements.shield, hero.shield?.displayName ?? ''),
            ...this.describeGear('artifact', s.artifact, ''),
            ...this.describeGear('relic', s.relic, ''),
        ];
        const sets = setBonuses(this.ext.equippedPieces());
        sets.forEach((b) => lines.push(`SET ${b.set.name} (${b.pieces}/3): ${describeMods(b.mods)}`));
        return info('EQUIPMENT', ...lines);
    }

    private bonusInfo(): MenuInfo {
        const hero = this.game.hero;
        const mods = this.ext.derivedMods(hero);
        const desc = describeMods(mods);
        return info('ALL BONUSES',
            `RACE ${getRace(this.ext.save.race).name}, JOB ${getJob(this.ext.save.job).name}`,
            ...desc ? desc.split(', ') : [ 'No bonuses yet.' ]);
    }

    private forgeSlots(kind: SocketKind): MenuNodeFactory {
        return () => ({
            title: kind === 'gem' ? 'GEM FORGE' : 'RUNE FORGE',
            items: [
                ...([ 'weapon', 'armor', 'shield' ] as SocketSlot[]).map((slot) => {
                    const gear = this.ext.save.enhancements[slot];
                    const sockets = gear ? kind === 'gem' ? gear.gems : gear.runes : [];
                    const used = sockets.filter((x) => x).length;
                    return item(`${slot.toUpperCase()} ${used}/${sockets.length}`, () => gear ? this.forgeSlot(kind, slot) : info(undefined, 'Nothing is equipped there.'));
                }),
                item('FUSE 3 INTO 1', () => this.fuseMenu(kind)),
                item('STONES OWNED', () => this.stonesInfo(kind)),
            ],
        });
    }

    private stonesInfo(kind: SocketKind): MenuInfo {
        const bag = kind === 'gem' ? this.ext.save.gems : this.ext.save.runes;
        const lines = Object.keys(bag).sort().map((id) => `${socketableName(id)} x${bag[id]}: ${describeMods({ [parseSocketable(id)!.family.stat]: parseSocketable(id)!.family.perTier * parseSocketable(id)!.tier })}`);
        return info(kind === 'gem' ? 'GEMS' : 'RUNES', ...lines.length ? lines : [ 'Thou hast none.' ]);
    }

    private forgeSlot(kind: SocketKind, slot: SocketSlot): MenuNodeFactory {
        return () => {
            const gear = this.ext.save.enhancements[slot];
            const sockets = gear ? kind === 'gem' ? gear.gems : gear.runes : [];
            const bag = kind === 'gem' ? this.ext.save.gems : this.ext.save.runes;
            const items: MenuItem[] = [];
            sockets.forEach((id, index) => {
                if (id) {
                    items.push(item(`REMOVE ${socketableName(id)}`, () => {
                        const r = this.ext.unsocket(kind, slot, index);
                        this.refresh();
                        return info(undefined, r.message);
                    }));
                }
            });
            if (sockets.includes(null)) {
                Object.keys(bag).sort().forEach((id) => {
                    items.push(item(`SET ${socketableName(id)} x${bag[id]}`, () => {
                        const r = this.ext.socket(kind, slot, id);
                        this.refresh();
                        return info(undefined, r.message, ...this.ext.achievementLines(this.game.hero));
                    }));
                });
            }
            if (!items.length) {
                items.push(item(sockets.length ? 'No stones to set.' : 'No sockets.', () => undefined));
            }
            return { title: slot.toUpperCase(), items };
        };
    }

    private fuseMenu(kind: SocketKind): MenuNodeFactory {
        return () => {
            const bag = kind === 'gem' ? this.ext.save.gems : this.ext.save.runes;
            const items = Object.keys(bag).filter((id) => bag[id] >= 3).sort().map((id) =>
                item(`${socketableName(id)} x${bag[id]}`, () => {
                    const r = this.ext.fuseStones(kind, id);
                    return info(undefined, r.message, ...this.ext.achievementLines(this.game.hero));
                }));
            return { title: 'FUSE', items: items.length ? items : [ item('Need 3 identical stones.', () => undefined) ] };
        };
    }

    private bagMenu(): MenuNodeFactory {
        return () => ({
            title: 'BAG',
            items: this.ext.save.bag.map((gear, index) => item(
                `${pad(gearDisplayName(gear, gear.slot.toUpperCase()), 22)}${gear.slot.substring(0, 3).toUpperCase()}`,
                () => this.bagItem(index), QUALITY_COLOR[gear.quality])),
        });
    }

    private bagItem(index: number): MenuNodeFactory {
        return () => {
            const gear = this.ext.save.bag[index];
            if (!gear) {
                return { title: 'BAG', items: [] };
            }
            const current = this.ext.getSlotGear(gear.slot);
            const delta = gearScore(gear) - (current ? gearScore(current) : 0);
            return {
                title: gearDisplayName(gear, gear.slot.toUpperCase()).substring(0, 18),
                items: [
                    item('INSPECT', () => info(gearDisplayName(gear, gear.slot.toUpperCase()).substring(0, 18),
                        ...this.describeGear(gear.slot, gear, gear.slot),
                        `Compared to equipped: ${delta >= 0 ? '+' : ''}${delta}`,
                        `Sells for ${quoteVendorPrice(gear, 'sell')} gold.`)),
                    item('EQUIP', () => {
                        const r = this.ext.equipFromBag(index, this.game.hero);
                        return r.ok ? { lines: [ r.message ] } : info(undefined, r.message);
                    }),
                    item('SALVAGE', () => info(undefined, this.ext.salvage(index).message)),
                    item('SELL', () => {
                        if (!isTown(this.mapName())) {
                            return info(undefined, 'Thou must be in a town to sell.');
                        }
                        return info(undefined, this.ext.sellFromBag(index, this.game.party).message);
                    }),
                ],
            };
        };
    }

    private wondrousMenu(): MenuNodeFactory {
        return () => ({
            title: 'ARTIFACT & RELIC',
            items: ([ 'artifact', 'relic' ] as const).map((slot) => {
                const gear = this.ext.save[slot];
                return item(`${slot.toUpperCase()}: ${gear ? gearDisplayName(gear) : 'none'}`.substring(0, 30),
                    () => gear ? info(undefined, this.ext.unequip(slot, this.game.hero).message) :
                        info(undefined, 'Find artifacts and relics from monsters and bosses, then EQUIP them from the BAG.'));
            }),
        });
    }

    private repair(): MenuInfo {
        if (!isTown(this.mapName())) {
            return info(undefined, 'There is no smith here. Repair in a town.');
        }
        return info(undefined, this.ext.repairAll(this.game.party).message);
    }

    // =====================================================================
    // MORE

    moreRoot(): MenuNodeFactory {
        return () => ({
            title: 'MENU',
            items: [
                item('STORY', () => this.storyMenu()),
                item('CHARACTER', () => this.characterMenu()),
                item('WORLD', () => () => ({
                    title: 'WORLD',
                    items: [
                        item('ATLAS', () => this.atlasMenu()),
                        item(`WORLD TIER ${this.ext.save.worldTier}`, () => this.worldTierMenu()),
                        item('MOUNTS', () => this.mountsMenu()),
                    ],
                })),
                item('ADVENTURE', () => this.adventureMenu()),
                item('CRAFT', () => () => ({
                    title: 'CRAFT',
                    items: [
                        item('PROFESSIONS', () => this.professionsMenu()),
                        item('SUPPLIES', () => this.suppliesMenu()),
                    ],
                })),
                item('SOCIAL', () => this.companionMenu()),
                item('JOURNAL', () => this.journalMenu()),
                item('SEASON', () => this.seasonMenu()),
                item('TITLE', () => this.titleMenu()),
                item('SAVE GAME', () => {
                    if (this.ext.save.activeRun) {
                        return info(undefined, 'Thou canst not save inside a dungeon.');
                    }
                    this.game.saveAdventureLog();
                    return info(undefined, 'Thy deeds have been recorded in the Adventure Log.');
                }),
                item('OPTIONS', () => optionsMenu(this.game)),
            ],
        });
    }

    // ---- Character ----

    private characterMenu(): MenuNodeFactory {
        return () => ({
            title: 'CHARACTER',
            items: [
                item('PROFILE', () => this.heroInfo()),
                item('ATTRIBUTES', () => this.attributesInfo()),
                item('CLASS & JOBS', () => this.jobsMenu()),
                item('SUBCLASS', () => this.subclassMenu()),
                item(`SKILL CORES ${this.ext.save.equippedCores.length}/${coreSlotsFor(this.game.hero.level)}`, () => this.coresMenu()),
                item(`TALENTS (${this.ext.talentPointsLeft(this.game.hero)})`, () => this.talentsMenu()),
                item('SPELLS', () => info('SPELLS', ...knownSpells(this.ext.save.job, this.ext.jobLevel(this.ext.save.job))
                    .map((sp) => `${sp.name} ${sp.mp}MP (${sp.school})`), 'Cast them in battle with SPELL.')),
                item('STATS', () => this.bonusInfo()),
                item('CATALOG', () => this.catalogMenu()),
            ],
        });
    }

    private attributesInfo(): MenuInfo {
        const scores = this.ext.attributes();
        return info('ATTRIBUTES',
            ...ATTRIBUTES.map((a) => {
                const mod = attributeModifier(scores[a]);
                return `${a} ${pad(String(scores[a]), 3)}(${mod >= 0 ? '+' : ''}${mod}) ${ATTRIBUTE_INFO[a]}`;
            }),
            'Race gives bonuses; thy class adds +2 to its primary.');
    }

    private subclassMenu(): MenuNodeFactory {
        return () => {
            const cls = getClass(this.ext.save.job);
            if (!cls) {
                return { title: 'SUBCLASS', items: [ item('Advanced jobs have none.', () => undefined) ] };
            }
            const chosen = this.ext.save.subclasses[cls.id];
            return {
                title: `${cls.name} (${cls.type.toUpperCase()}/${cls.subtype.toUpperCase()})`.substring(0, 24),
                items: cls.subclasses.map((s) => item(`${s.name}: ${describeMods(s.mods)}`.substring(0, 30),
                    () => info(undefined, this.ext.chooseSubclass(s.id, this.game.hero).message),
                    s.id === chosen ? 'blue' : undefined)),
            };
        };
    }

    private coresMenu(): MenuNodeFactory {
        return () => {
            const s = this.ext.save;
            const items: MenuItem[] = s.equippedCores.map((id, index) => item(`- ${getCore(id)?.name ?? id}`.substring(0, 30),
                () => info(undefined, this.ext.unequipCore(index, this.game.hero)), 'blue'));
            const counts = new Map<string, number>();
            s.cores.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
            counts.forEach((count, id) => {
                const core = getCore(id);
                const spare = count - s.equippedCores.filter((c) => c === id).length;
                if (core && spare > 0) {
                    items.push(item(`+ ${core.name} x${spare}`.substring(0, 30), () => {
                        const r = this.ext.equipCore(id, this.game.hero);
                        const detail = core.skill ? 'Grants a battle SKILL.' : describeMods(core.mods ?? {});
                        return info(core.name, detail, r.message);
                    }));
                }
            });
            if (!items.length) {
                items.push(item('Bosses drop skill cores.', () => undefined));
            }
            return { title: `CORES ${s.equippedCores.length}/${coreSlotsFor(this.game.hero.level)}`, items };
        };
    }

    private catalogMenu(): MenuNodeFactory {
        return () => ({
            title: 'CATALOG',
            items: [
                item('RACES (9)', () => info('RACES', ...CORE_RACES.map((r) => `${r.name}: ${Object.entries(r.attributes).map(([ k, v ]) => `${k}+${v}`).join(' ')}. ${r.description}`))),
                item('CLASSES (18)', () => info('CLASSES', ...CLASSES.map((c) => `${c.name} ${c.type}/${c.subtype} ${c.primary}: ${c.subclasses.map((s) => s.name).join(', ')}`))),
                item('WEAPONS (14)', () => info('WEAPON TYPES', ...WEAPON_TYPES.map((w) => `${w.name} (${w.subtype}, ${w.hands}H): ${describeMods(w.mods)}`))),
                item('ARMOR (4)', () => info('ARMOR CLASSES', ...ARMOR_CLASSES.map((a) => `${a.name} (${a.subtypes.join(', ')}): ${describeMods(a.mods)}`))),
                item(`GEAR TIERS (${GEAR_TIERS.length})`, () => info('GEAR TIERS', GEAR_TIERS.map((t, i) => `${i + 1}.${t}`).join('  '))),
                item('RARITY (1-9)', () => info('RARITY', ...QUALITIES.map((q, i) => `${i + 1}. ${q}: ${AFFIX_COUNT[q]} affixes`))),
                item('ITEMS', () => info('ITEMS', ...ITEM_CATEGORIES.map((c) => `${c.name}: ${c.description}`))),
                item('SKILL CORES (36)', () => info('SKILL CORES', ...SKILL_CORES.map((c) => `${c.name} (${c.school} T${c.tier}) ${c.skill ? 'SKILL' : describeMods(c.mods ?? {})}`))),
                item('BUFFS & DEBUFFS', () => info('EFFECTS', ...Object.values(EFFECTS).map((e) => `${e.name} (${e.kind}): ${e.description}`))),
                item('SUBSTATS', () => info('SUBSTATS', ...(Object.keys(SUBSTATS) as (keyof typeof SUBSTATS)[]).map((k) => `${SUBSTATS[k].name}: cap ${SUBSTATS[k].cap}${SUBSTATS[k].unit === '%' ? '%' : ''}`))),
                item(`LEGENDARIES (${UNIQUES.length})`, () => info('LEGENDARIES', ...UNIQUES.map((x) => `${x.name} (${x.slot}, LV${x.level}): ${describeMods(x.mods)}. ${x.lore}`))),
                item(`SPELLS (${BATTLE_SPELLS.length})`, () => info('SPELLS', ...BATTLE_SPELLS.map((sp) => `${sp.name} ${sp.mp}MP ${sp.school}`))),
                item('BOSS TITLES', () => info('BOSS TITLES', ...Object.entries(BOSS_TITLES).map(([ rank, titles ]) => `${rank}: ${titles.join(', ')}`))),
            ],
        });
    }

    // ---- Story ----

    private storyMenu(): MenuNodeFactory {
        return () => {
            const progress = this.ext.save.story;
            const act = currentAct(progress);
            const hero = this.game.hero;
            const items: MenuItem[] = [];
            if (act) {
                const ready = hero.level >= act.level;
                items.push(item(`ACT ${act.act}: ${act.title}`.substring(0, 30), () => info(`ACT ${act.act} - ${TIER_NAMES[act.tier]}`,
                    act.title, act.hook, '',
                    ...act.chapters.map((c, i) => `${i + 1}. ${c.title} [${c.pillar}] ${c.text}`), '',
                    `Allies and foes: ${act.npcs.join(', ')}`,
                    `Monsters: ${act.monsters.join(', ')}`,
                    ready ? `Villain: ${act.villain}` : `Begins at level ${act.level}.`)));
                if (ready && !(act.act in progress.checks)) {
                    items.push(item(`${act.check.skill.toUpperCase()} CHECK DC${act.check.dc}`, () =>
                        info(act.check.skill.toUpperCase(), act.check.prompt, ...this.ext.rollStoryCheck(hero).lines)));
                }
                if (ready) {
                    items.push(item(`CONFRONT ${act.villain}`.substring(0, 30), () => {
                        if (!this.game.getEnemy(act.bossEnemy)) {
                            return info(undefined, 'The villain cannot be found.');
                        }
                        this.game.startEncounter(act.bossEnemy, { story: act.act });
                        return 'close';
                    }, 'red'));
                }
            } else {
                items.push(item('THY LEGEND IS COMPLETE', () => info('THE END', STORY[STORY.length - 1].finale)));
            }
            items.push(item(`ACTS (${progress.completed}/${STORY.length})`, () => info('CAMPAIGN',
                ...STORY.map((a) => `${a.act <= progress.completed ? '*' : ' '}${a.act}. ${a.title} (LV${a.level}, ${TIER_NAMES[a.tier]})`))));
            items.push(item('CREDITS', () => info('CREDITS',
                'Story, characters and places are original to this game.',
                'Monster types from the System Reference Document 5.1 by Wizards of the Coast LLC, licensed under CC-BY-4.0.')));
            return { title: 'STORY', items };
        };
    }

    // ---- Upgrades, armory and mastery ----

    private upgradeMenu(): MenuNodeFactory {
        return () => ({
            title: `UPGRADE (${this.ext.save.shards} SHARDS)`,
            items: ([ 'weapon', 'armor', 'shield' ] as UpgradeSlot[]).map((slot) => {
                const gear = this.ext.save.enhancements[slot];
                const level = gear?.upgrade ?? 0;
                if (!gear) {
                    return item(`${slot.toUpperCase()}: none`, () => undefined);
                }
                const cost = upgradeCost(level, gear.itemLevel);
                const odds = Math.round(upgradeChance(level) * 100);
                return item(`${slot.toUpperCase()} +${level} -> +${level + 1} ${odds}%`.substring(0, 30), () => info(undefined,
                    `Cost: ${cost.gold} gold, ${cost.shards} shards.`,
                    this.ext.upgradeGear(slot, this.game.hero, this.game.party).message));
            }),
        });
    }

    private armoryMenu(): MenuNodeFactory {
        return () => ({
            title: `ARMORY (${this.game.party.gold}G)`,
            items: armoryStock(Math.round(contentLevel(this.game.hero.level))).map((stock) => item(
                `${pad(stock.name, 22)}${stock.price}G`,
                () => info(stock.name, describeMods(stock.mods), this.ext.buyFromArmory(stock, this.game.hero, this.game.party).message))),
        });
    }

    private masteryInfo(): MenuInfo {
        const kills = this.ext.save.weaponKills;
        const current = this.ext.currentWeaponType(this.game.hero);
        const lines = [ `Equipped: ${current.toUpperCase()} rank ${this.ext.weaponMasteryRank(this.game.hero)}`,
            `Bonus: ${describeMods(masteryMods(this.ext.weaponMasteryRank(this.game.hero))) || 'none yet'}`, '' ];
        Object.keys(kills).sort().forEach((type) => {
            const rank = masteryRank(kills[type]);
            const next = MASTERY_THRESHOLDS[rank];
            lines.push(`${type.toUpperCase()}: rank ${rank}, ${kills[type]} kills${next ? ` (next ${next})` : ' (MAX)'}`);
        });
        lines.push('Defeat foes to master the weapon in thy hand.');
        return info('WEAPON MASTERY', ...lines);
    }

    // ---- Talents ----

    private talentsMenu(): MenuNodeFactory {
        return () => ({
            title: `TALENTS ${this.ext.talentPointsLeft(this.game.hero)} LEFT`,
            items: [
                ...(Object.keys(TREE_NAMES) as TreeId[]).map((tree) => item(`${TREE_NAMES[tree]} (${pointsInTree(this.ext.save.talents, tree)})`, () => () => ({
                    title: TREE_NAMES[tree],
                    items: TALENTS.filter((tal) => tal.tree === tree).map((tal) => item(
                        `T${tal.tier} ${pad(tal.name, 16)}${this.ext.save.talents[tal.id] ?? 0}/${tal.maxRank}`,
                        () => info(tal.name, `Per rank: ${describeMods(tal.perRank)}`, this.ext.learn(tal.id, this.game.hero).message),
                        (this.ext.save.talents[tal.id] ?? 0) > 0 ? 'blue' : undefined)),
                }))),
                item('RESET TALENTS', () => info(undefined, this.ext.respecTalents(this.game.hero, this.game.party).message)),
            ],
        });
    }

    // ---- Forge: aspects and forging potential ----

    private forgeMenu(): MenuNodeFactory {
        return () => ({
            title: `FORGE ${this.ext.save.shards} SHARDS`,
            items: [
                item(`ASPECT CODEX (${this.ext.save.aspects.length})`, () => () => ({
                    title: 'IMPRINT ASPECT',
                    items: this.ext.save.aspects.map((aspect, ai) => item(aspect.name.substring(0, 30), () => () => ({
                        title: 'IMPRINT ON',
                        items: ([ 'weapon', 'armor', 'shield' ] as SocketSlot[]).map((slot) => item(slot.toUpperCase(),
                            () => info(undefined, this.ext.imprint(ai, slot, this.game.hero).message))),
                    }))),
                })),
                ...([ 'weapon', 'armor', 'shield' ] as SocketSlot[]).map((slot) => {
                    const gear = this.ext.save.enhancements[slot];
                    return item(`FORGE ${slot.toUpperCase()} (${gear?.potential ?? (gear ? initialPotential(gear) : 0)})`, () => () => ({
                        title: `FORGE ${slot.toUpperCase()}`,
                        items: FORGEABLE.map((key) => item(SUBSTATS[key].name,
                            () => info(undefined, this.ext.forge(slot, key, this.game.hero).message))),
                    }));
                }),
                item('HOW IT WORKS', () => info('FORGE',
                    'SALVAGE gear in the BAG for shards.',
                    'Salvaging Legendary or better gear adds its best affix to the ASPECT CODEX.',
                    `IMPRINT an aspect onto gear for ${IMPRINT_COST} shards.`,
                    `FORGE an affix for ${FORGE_SHARD_COST} shards; each forge spends 1-4 potential.`,
                    'When potential runs out, the item is finished.')),
            ],
        });
    }

    // ---- World ----

    private atlasMenu(): MenuNodeFactory {
        const visited = (id: string) => this.ext.save.zonesVisited.includes(id);
        return () => ({
            title: `ATLAS ${this.ext.save.zonesVisited.length}`,
            items: [
                ...CONTINENTS.map((continent) => item(continent.name, () => () => ({
                    title: continent.name,
                    items: COUNTRIES.filter((c) => c.continent === continent.id).map((country) => item(country.name.substring(0, 28), () => () => ({
                        title: country.name.substring(0, 22),
                        items: [
                            item('SETTLEMENTS', () => info(country.name, ...SETTLEMENTS.filter((s) => s.country === country.id)
                                .map((s) => `${visited(s.id) ? '*' : ' '}${s.name} (${s.kind}): ${s.services.join(', ')}`))),
                            item('UNDERGROUND', () => info('UNDERGROUND', ...UNDERGROUND.filter((u) => u.country === country.id)
                                .map((u) => `${u.name} LV${u.minLevel}: ${u.floors.join(' ')}`))),
                            ...ZONES.filter((z) => z.country === country.id).map((zone) => item(
                                `${zone.subZones.some((s) => visited(s.id)) ? '*' : ' '}${zone.name}`.substring(0, 28),
                                () => info(zone.name,
                                    `Biome: ${getBiome(zone.biome)?.name ?? ''}  Level ${zone.minLevel}-${zone.maxLevel}`,
                                    ...zone.subZones.map((s) => `${visited(s.id) ? '*' : ' '}${s.name} (${s.subBiome})`)))),
                        ],
                    }))),
                }))),
                item('BIOMES', () => info('BIOMES', ...BIOMES.map((b) => `${b.name}: ${b.subBiomes.join(', ')}`))),
                item('SUMMARY', () => info('ATLAS',
                    `${CONTINENTS.length} continents, ${COUNTRIES.length} countries`,
                    `${ZONES.length} zones, ${ZONES.length * 3} sub-zones`,
                    `${SETTLEMENTS.length} cities, towns and villages`,
                    `${UNDERGROUND.length} underground zones`,
                    `Explored: ${this.ext.save.zonesVisited.length} places`,
                    'Walk the overworld to cross zones. * marks places visited.')),
            ],
        });
    }

    private worldTierMenu(): MenuNodeFactory {
        return () => ({
            title: `WORLD TIER ${this.ext.save.worldTier}`,
            items: WORLD_TIER_NAMES.map((name, i) => {
                const tier = i + 1;
                const s = worldTierScaling(tier);
                return item(`${tier} ${pad(name, 11)}LV${worldTierUnlockLevel(tier)}`, () => info(`TIER ${tier} ${name}`,
                    `Enemy HP x${s.hpMult.toFixed(2)}, power x${s.strMult.toFixed(2)}`,
                    `XP and gold x${s.rewardMult.toFixed(2)}, rarer loot`,
                    this.ext.setWorldTier(tier, this.game.hero).message), tier === this.ext.save.worldTier ? 'blue' : undefined);
            }),
        });
    }

    // ---- Adventure: dungeons, raids, trials, towers ----

    private adventureMenu(): MenuNodeFactory {
        return () => {
            const run = this.ext.save.activeRun;
            const items: MenuItem[] = [];
            if (run) {
                const enc = this.ext.currentRunEncounter();
                items.push(item(`CONTINUE: ${enc?.label ?? ''}`.substring(0, 30), () => this.startRunFight()));
                items.push(item('ABANDON RUN', () => info(undefined, this.ext.abandonRun())));
            }
            const event = currentEvent();
            const progress = this.ext.eventProgress();
            items.push(item(`EVENT: ${event.def.name}`, () => info(event.def.name,
                event.def.description,
                `Where: ${event.zone.name} (${getCountry(event.zone.country)?.name ?? ''})`,
                `Progress: ${progress.claimed ? 'COMPLETE' : `${progress.kills}/${event.def.goal}`}`,
                `Reward: ${event.def.rewardGold} gold, ${event.def.rewardXp} XP`,
                `Ends in ${minutesLeft(event)} minutes. A new event begins each hour.`)));
            if (!run) {
                items.push(item('GROUP FINDER', () => () => ({
                    title: 'CHOOSE ROLE',
                    items: ([ 'tank', 'healer', 'dps' ] as Role[]).map((role) => item(
                        `${role.toUpperCase()} (wait ${queueTime(role)}s, +${groupFinderBonus(role)}G)`,
                        () => {
                            const r = this.ext.groupFinder(role, this.game.hero);
                            if (!r.ok) {
                                return info(undefined, r.message);
                            }
                            this.game.setStatusMessage(r.message);
                            return this.startRunFight();
                        })),
                })));
            }
            (Object.keys(INSTANCE_COUNTS) as InstanceKind[]).forEach((kind) => {
                items.push(item(`${kind.toUpperCase()}S (${INSTANCE_COUNTS[kind]})`, () => this.instanceList(kind)));
            });
            return { title: 'ADVENTURE', items };
        };
    }

    private instanceList(kind: InstanceKind): MenuNodeFactory {
        return () => ({
            title: `${kind.toUpperCase()}S`,
            items: availableInstances(kind, this.game.hero.level).map((inst) => {
                const rec = this.ext.save.instances[inst.id];
                const locked = isLockedOut(this.ext.save.lockouts, inst);
                return item(`${rec?.clears ? '*' : ' '}${pad(inst.name, 21)}${inst.level}`, () => {
                    const boss = instanceBoss(inst);
                    if (locked) {
                        return info(inst.name, 'Locked until next week.');
                    }
                    return () => ({
                        title: inst.name.substring(0, 22),
                        items: [
                            item('ENTER', () => {
                                const r = this.ext.startRun(inst.id, this.game.hero);
                                return r.ok ? this.startRunFight() : info(undefined, r.message);
                            }),
                            item('DETAILS', () => info(inst.name,
                                `${kind.toUpperCase()} level ${inst.level}, ${getCountry(inst.country)?.name ?? ''}`,
                                `${inst.stages} fights, then ${boss.name} (${bossRank(boss.level)})`,
                                `First clear chest: ${instanceClearGold(inst)} gold`,
                                `Cleared ${rec?.clears ?? 0} times`,
                                kind === 'raid' ? 'Raids lock for the week after a clear.' : '')),
                        ],
                    });
                }, locked ? 'blue' : undefined);
            }),
        });
    }

    private startRunFight(): MenuResult {
        const enc = this.ext.currentRunEncounter();
        if (!enc || !this.game.getEnemy(enc.enemy)) {
            this.ext.abandonRun();
            return info(undefined, 'The way is blocked.');
        }
        this.game.startEncounter(enc.enemy, { bossId: enc.bossId, instance: true });
        return 'close';
    }

    // ---- Journal ----

    private journalMenu(): MenuNodeFactory {
        return () => {
            const items: MenuItem[] = [
                item('HERO', () => this.heroInfo()),
                item('BOSS JOURNAL', () => this.bossJournal()),
                item('ACHIEVEMENTS', () => this.achievementsInfo()),
            ];
            if (this.ext.save.discoveries.length) {
                items.push(item('HIDDEN WORLD', () => this.hiddenWorldInfo()));
            }
            if (this.ext.save.eggs.length) {
                items.push(item('SECRET ARCHIVE', () => info('SECRET ARCHIVE',
                    ...eggArchive(this.ext.save.eggs).map((e) => `${e.name}: ${e.hint}`))));
            }
            return { title: 'JOURNAL', items };
        };
    }

    private heroInfo(): MenuInfo {
        const hero = this.game.hero;
        const s = this.ext.save;
        const lines = [
            `${hero.name}${s.title ? ` ${s.title}` : ''}`,
            `LEVEL ${hero.level}${paragonRank(hero.level) ? ` (PARAGON ${paragonRank(hero.level)})` : ''}`,
            `EXP ${hero.exp}  NEXT ${xpToNextLevel(hero.level, hero.exp)}`,
            `RACE ${getRace(s.race).name}: ${getRace(s.race).trait}`,
            `JOB ${getJob(s.job).name} LV ${this.ext.jobLevel(s.job)}`,
        ];
        if (s.supportJob) {
            lines.push(`SUPPORT ${getJob(s.supportJob).name} LV ${supportLevel(this.ext.jobLevel(s.job), this.ext.jobLevel(s.supportJob))}`);
        }
        lines.push(`GOLD ${this.game.party.gold}  SIGILS ${s.bossProgress.sigils}`);
        const mastery = this.ext.masteryAvailable(hero);
        if (mastery > 0) {
            lines.push(`${mastery} mastery point(s) to spend in JOBS.`);
        }
        return info('HERO', ...lines);
    }

    private bossJournal(): MenuNodeFactory {
        return () => {
            const progress = this.ext.save.bossProgress;
            const completion = bossCompletion(progress);
            return {
                title: `BOSSES ${completion.cleared}/${completion.total}`,
                items: [
                    item('SUMMARY', () => info('BOSS JOURNAL',
                        `Cleared ${completion.cleared} of ${completion.total} (${completion.percent}%).`,
                        `Sigils: ${progress.sigils}`,
                        `Set pieces found: ${Object.values(progress.named).reduce((a, b) => a + b, 0)}`,
                        'Rare bosses roam the land. Defeat each once for a first-clear reward.')),
                    ...BOSS_CATEGORIES.map((category) => item(category.toUpperCase(), () => {
                        const list = BOSSES.filter((b) => b.category === category);
                        const cleared = list.filter((b) => progress.clears[b.id]);
                        return info(`${category.toUpperCase()} ${cleared.length}/${list.length}`,
                            ...list.map((b) => {
                                const clear = progress.clears[b.id];
                                return clear ? `${bossRank(b.level)} ${b.name} LV${b.level} x${clear.kills}` : `${bossRank(b.level)} ??? LV${b.level}`;
                            }));
                    })),
                ],
            };
        };
    }

    private achievementsInfo(): MenuInfo {
        const unlocked = this.ext.save.achievements;
        return info(`ACHIEVEMENTS ${unlocked.length}/${ACHIEVEMENTS.length}`,
            ...ACHIEVEMENTS.map((a) => `${unlocked.includes(a.id) ? '*' : ' '} ${a.name}: ${a.description}`));
    }

    private hiddenWorldInfo(): MenuInfo {
        const found = this.ext.save.discoveries;
        return info(`HIDDEN WORLD ${found.length}/${WORLD_DISCOVERIES.length}`,
            ...WORLD_DISCOVERIES.filter((d) => found.includes(d.id)).map((d) => `${d.title} (${d.map})`),
            'Undiscovered places glimmer when thou art near. SEARCH there.');
    }

    // ---- Jobs ----

    private jobsMenu(): MenuNodeFactory {
        return () => {
            const hero = this.game.hero;
            const items: MenuItem[] = [
                item('ABOUT MY JOB', () => {
                    const job = getJob(this.ext.save.job);
                    const level = this.ext.jobLevel(job.id);
                    return info(job.name,
                        `Role: ${job.role.toUpperCase()}  Level ${level}`,
                        `Passive: ${describeMods(job.mods) || 'none'}`,
                        ...job.abilities.map((a) => `${a.level <= level ? '*' : ' '} ${a.name} (LV ${a.level})`),
                        'Abilities are used once per battle with SKILL.');
                }),
                item('CHANGE JOB', () => this.changeJobMenu()),
                item('SUPPORT JOB', () => this.supportJobMenu()),
            ];
            if (hero.level <= 5) {
                items.push(item('CHOOSE RACE', () => this.raceMenu()));
            }
            if (this.ext.masteryAvailable(hero) > 0) {
                items.push(item(`MASTERY (${this.ext.masteryAvailable(hero)})`, () => this.masteryMenu()));
            }
            items.push(item('ABILITIES', () => info('ABILITIES', ...availableAbilities(getJob(this.ext.save.job), this.ext.jobLevel(this.ext.save.job),
                this.ext.save.supportJob ? getJob(this.ext.save.supportJob) : undefined,
                this.ext.save.supportJob ? supportLevel(this.ext.jobLevel(this.ext.save.job), this.ext.jobLevel(this.ext.save.supportJob)) : 0)
                .map((a) => `${a.ability.name}${a.support ? ' (SUP)' : ''}`))));
            return { title: 'JOBS', items };
        };
    }

    private changeJobMenu(): MenuNodeFactory {
        return () => ({
            title: 'CHANGE JOB',
            items: JOBS.map((job) => item(`${pad(job.name, 13)}${job.role.substring(0, 1).toUpperCase()} LV${this.ext.jobLevel(job.id)}`, () => {
                const r = this.ext.changeJob(job.id, this.mapName());
                this.refresh();
                return info(undefined, r.message, ...r.ok ? this.ext.achievementLines(this.game.hero) : []);
            }, job.id === this.ext.save.job ? 'blue' : undefined)),
        });
    }

    private supportJobMenu(): MenuNodeFactory {
        return () => {
            if (this.ext.jobLevel(this.ext.save.job) < SUPPORT_UNLOCK_LEVEL) {
                return { title: 'SUPPORT JOB', items: [ item(`Unlocks at job level ${SUPPORT_UNLOCK_LEVEL}.`, () => undefined) ] };
            }
            return {
                title: 'SUPPORT JOB',
                items: [
                    item('NONE', () => info(undefined, this.ext.setSupportJob(undefined, this.game.hero).message)),
                    ...JOBS.filter((j) => j.id !== this.ext.save.job).map((job) => item(`${pad(job.name, 13)}LV${this.ext.jobLevel(job.id)}`,
                        () => info(undefined, this.ext.setSupportJob(job.id, this.game.hero).message),
                        job.id === this.ext.save.supportJob ? 'blue' : undefined)),
                ],
            };
        };
    }

    private raceMenu(): MenuNodeFactory {
        return () => ({
            title: 'RACE',
            items: RACES.map((race) => item(race.name, () => info(race.name, race.bonus, race.trait,
                this.ext.setRace(race.id, this.game.hero).message), race.id === this.ext.save.race ? 'blue' : undefined)),
        });
    }

    private masteryMenu(): MenuNodeFactory {
        const stats: [MasteryStat, string][] = [ [ 'strength', 'STRENGTH +2' ], [ 'agility', 'AGILITY +2' ], [ 'maxHp', 'MAX HP +6' ], [ 'maxMp', 'MAX MP +4' ] ];
        return () => ({
            title: `MASTERY ${this.ext.masteryAvailable(this.game.hero)}`,
            items: stats.map(([ stat, label ]) => item(label, () =>
                info(undefined, this.ext.spendMastery(this.game.hero, stat) ? `${label.split(' ')[0]} increased.` : 'No mastery points left.'))),
        });
    }

    // ---- Professions ----

    private professionsMenu(): MenuNodeFactory {
        return () => ({
            title: 'PROFESSIONS',
            items: PROFESSIONS.map((p) => item(`${pad(p.name, 15)}${this.ext.profession(p.id).skill}`, () => this.professionMenu(p.id))),
        });
    }

    private professionMenu(profId: string): MenuNodeFactory {
        return () => {
            const prof = PROFESSIONS.find((p) => p.id === profId)!;
            const state = this.ext.profession(profId);
            const items: MenuItem[] = [];
            if (prof.kind === 'gathering') {
                items.push(item('GATHER HERE', () => this.gather(profId)));
            } else {
                items.push(item('CRAFT', () => this.craftMenu(profId)));
            }
            items.push(item(`LESSON (${lessonCost(state.skill)}G)`, () => {
                if (!isTown(this.mapName())) {
                    return info(undefined, 'Trainers teach only in towns.');
                }
                return info(undefined, this.ext.buyLesson(profId, this.game.hero, this.game.party).message);
            }));
            items.push(item(`PERKS ${pointsSpent(state.perks)}/${perkPointsForSkill(state.skill)}`, () => this.perkMenu(profId)));
            items.push(item('MATERIALS', () => this.materialsInfo()));
            return { title: `${prof.name} ${state.skill}`, items };
        };
    }

    private gather(profId: string): MenuInfo {
        const map = this.mapName();
        if (isTown(map)) {
            return info(undefined, 'There is nothing to gather in town.');
        }
        if (this.ext.save.stepsSinceGather < GATHER_STEP_COOLDOWN) {
            return info(undefined, `Thou hast picked this area clean. Walk ${GATHER_STEP_COOLDOWN - this.ext.save.stepsSinceGather} more steps.`);
        }
        this.ext.save.stepsSinceGather = 0;
        return info(undefined, ...this.ext.gatherHere(profId, this.game.hero).lines);
    }

    private materialsInfo(): MenuInfo {
        const mats = this.ext.save.materials;
        const lines = Object.keys(mats).filter((id) => mats[id] > 0).sort().map((id) => {
            const m = getMaterial(id);
            return `${m ? m.name : id} x${mats[id]}${m ? ` (${m.family} T${m.tier})` : ''}`;
        });
        return info('MATERIALS', ...lines.length ? lines : [ 'Thou hast no materials.' ]);
    }

    private craftMenu(profId: string): MenuNodeFactory {
        return () => {
            const state = this.ext.profession(profId);
            return {
                title: 'CRAFT',
                items: recipesFor(profId).filter((r) => r.skill <= Math.max(1, state.skill) + 60).map((recipe) => item(
                    `${pad(recipe.name, 20)}${hasMaterials(this.ext.save.materials, recipe) ? 'OK' : '--'}`,
                    () => {
                        const mats = recipe.materials.map((m) => `${getMaterial(m.id)?.name ?? m.id} ${this.ext.save.materials[m.id] ?? 0}/${m.count}`);
                        if (!hasMaterials(this.ext.save.materials, recipe) || state.skill < recipe.skill && recipe.skill > 1) {
                            return info(recipe.name, `Skill ${recipe.skill}`, ...mats);
                        }
                        return info(undefined, ...this.ext.craftRecipe(recipe, this.game.hero).lines);
                    },
                    hasMaterials(this.ext.save.materials, recipe) ? 'blue' : undefined)),
            };
        };
    }

    private perkMenu(profId: string): MenuNodeFactory {
        return () => {
            const prof = PROFESSIONS.find((p) => p.id === profId)!;
            const state = this.ext.profession(profId);
            return {
                title: `PERKS ${perkPointsForSkill(state.skill) - pointsSpent(state.perks)} LEFT`,
                items: [
                    ...perkTree(prof.kind).map((perk) => item(`${state.perks.includes(perk.id) ? '*' : ' '}${perk.name} T${perk.tier}`, () => {
                        const check = canBuyPerk(state, prof.kind, perk.id);
                        if (!check.ok) {
                            return info(undefined, check.reason ?? '');
                        }
                        buyPerk(state, prof.kind, perk.id);
                        return info(undefined, `Learned ${perk.name}.`);
                    })),
                    item('RESET PERKS', () => {
                        const cost = pointsSpent(state.perks) * 100;
                        if (this.game.party.gold < cost) {
                            return info(undefined, `A reset costs ${cost} gold.`);
                        }
                        this.game.party.gold -= resetPerks(state);
                        return info(undefined, 'Thy perks are reset.');
                    }),
                ],
            };
        };
    }

    // ---- Supplies ----

    private suppliesMenu(): MenuNodeFactory {
        return () => {
            const s = this.ext.save.supplies;
            const owned = (Object.keys(SUPPLIES) as SupplyId[]).filter((id) => (s[id] ?? 0) > 0);
            return {
                title: 'SUPPLIES',
                items: owned.length ? owned.map((id) => item(`${pad(SUPPLIES[id].name, 14)}x${s[id]}`, () => {
                    const healMult = 1 + (this.ext.derivedMods(this.game.hero).heal ?? 0) / 100;
                    return info(undefined, this.ext.useSupply(id, this.game.hero, healMult).message);
                })) : [ item('Craft supplies with PROFESSIONS.', () => undefined) ],
            };
        };
    }

    // ---- Companions ----

    private companionMenu(): MenuNodeFactory {
        return () => {
            const s = this.ext.save;
            const active = s.activeCompanion ? getCompanion(s.activeCompanion) : undefined;
            const state = this.ext.activeCompanionState();
            const items: MenuItem[] = [];
            if (active && state) {
                const tier = bondTier(state.affinity);
                items.push(item('STATUS', () => info(active.name,
                    `${getJob(active.job).name}, ${getRace(active.race).name} of ${active.home}`,
                    active.bio,
                    `Affinity ${state.affinity}/100: ${tier.name}`,
                    `Bond bonus: ${describeMods(tier.mods) || 'none'}`,
                    `Stance: ${state.stance}`,
                    `Likes: ${active.likedGift}`)));
                items.push(item(`STANCE: ${state.stance}`, () => () => ({
                    title: 'STANCE',
                    items: STANCES.map((st) => item(st, () => {
                        this.ext.setStance(st);
                        const preview = companionAssist(st, getJob(active.job).role, 1);
                        return info(undefined, `${active.name} will fight ${st.toLowerCase()} (${preview.type}).`);
                    }, st === state.stance ? 'blue' : undefined)),
                })));
                items.push(item('TALK', () => info(undefined, talkToCompanion(state) ?
                    `${active.name}: "${active.bio}" (Affinity +1)` : `${active.name} smiles. Ye have talked today.`)));
                items.push(item('GIVE GIFT', () => () => ({
                    title: 'GIFT',
                    items: (Object.keys(SUPPLIES) as SupplyId[]).filter((id) => (s.supplies[id] ?? 0) > 0)
                        .map((id) => item(`${SUPPLIES[id].name} x${s.supplies[id]}`, () => info(undefined, this.ext.giveGift(id).message))),
                })));
                items.push(item('PART WAYS', () => info(undefined, this.ext.dismissCompanion(this.game.hero))));
            }
            items.push(item('COMPANION BOARD', () => {
                if (!isTown(this.mapName())) {
                    return info(undefined, 'The companion board is at the inns in town.');
                }
                return this.companionBoard();
            }));
            return { title: active ? active.name : 'COMPANION', items };
        };
    }

    private companionBoard(): MenuNodeFactory {
        return () => ({
            title: 'COMPANION BOARD',
            items: COMPANIONS.map((c) => {
                const known = !!this.ext.save.companions[c.id];
                return item(`${pad(c.name, 9)}${pad(getJob(c.job).name, 12)}${known ? 'OWN' : `${c.fee}G`}`, () => {
                    const r = this.ext.recruitCompanion(c.id, this.game.hero, this.game.party);
                    return info(undefined, r.message, ...r.ok ? this.ext.achievementLines(this.game.hero) : []);
                }, this.game.hero.level >= c.levelReq ? undefined : 'blue');
            }),
        });
    }

    // ---- Mounts ----

    private mountsMenu(): MenuNodeFactory {
        return () => {
            const s = this.ext.save;
            const active = s.activeMount ? getMount(s.activeMount) : undefined;
            return {
                title: 'MOUNTS',
                items: [
                    item(s.riding ? 'DISMOUNT' : `RIDE${active ? ` ${active.name}` : ''}`.substring(0, 28), () => {
                        const r = this.ext.toggleRide(this.mapName());
                        return info(undefined, r.message, ...r.ok ? this.ext.achievementLines(this.game.hero) : []);
                    }),
                    item(`COLLECTION ${s.mounts.length}/${MOUNTS.length}`, () => () => ({
                        title: 'COLLECTION',
                        items: s.mounts.map((id) => getMount(id)).filter((m) => !!m).map((m) => item(`${m.name} (${m.tier})`, () => {
                            s.activeMount = m.id;
                            return info(undefined, `Thou wilt ride the ${m.name}.`);
                        }, m.id === s.activeMount ? 'blue' : undefined)),
                    })),
                    item('STABLE', () => {
                        if (!isTown(this.mapName())) {
                            return info(undefined, 'The stablemaster is in town.');
                        }
                        const stock = stableStock(this.game.hero.level, s.achievements.length);
                        if (!stock.length) {
                            return info(undefined, 'The stablemaster teaches riding to heroes of level 15.');
                        }
                        return () => ({
                            title: 'STABLE',
                            items: stock.map((m) => item(`${pad(m.name, 22)}${s.mounts.includes(m.id) ? 'OWN' : `${mountPrice(m)}G`}`,
                                () => info(undefined, this.ext.buyMount(m, this.game.party).message))),
                        });
                    }),
                ],
            };
        };
    }

    // ---- Season ----

    private seasonMenu(): MenuNodeFactory {
        return () => {
            const now = new Date();
            this.ext.save.season = refreshSeason(this.ext.save.season, now);
            const st = this.ext.save.season;
            const season = seasonFor(now);
            return {
                title: season.name,
                items: [
                    item('OVERVIEW', () => info(season.name,
                        season.theme,
                        `Rank: ${seasonRank(st)}  Renown: ${st.renown}`,
                        `${season.currency}: ${st.currency}`,
                        `Season pass tier ${passTier(st)}/${PASS_TIERS}`,
                        `This month: ${monthlyEvent(now)}`,
                        `Challenge affix: ${season.affix}`)),
                    item('JOURNEY', () => () => ({
                        title: 'JOURNEY',
                        items: JOURNEY.map((ch) => item(`${st.claimedChapters.includes(ch.chapter) ? '*' : chapterComplete(st, ch) ? '!' : ' '}${ch.chapter} ${ch.text}`.substring(0, 30), () => {
                            const reward = claimChapter(st, ch.chapter);
                            if (reward) {
                                this.ext.addGold(this.game.party, reward.gold);
                                return info(undefined, `Chapter ${ch.chapter} complete! +${reward.gold} gold, +${reward.currency} ${season.currency}, +${reward.renown} renown.`);
                            }
                            return info(`CHAPTER ${ch.chapter}`, ch.text, `Progress ${Math.min(ch.target, st.progress[ch.objective] ?? 0)}/${ch.target}`,
                                st.claimedChapters.includes(ch.chapter) ? 'Claimed.' : 'Claim chapters in order.');
                        })),
                    })),
                    item('WEEKLY QUESTS', () => () => ({
                        title: 'WEEKLY',
                        items: weeklyQuests(now).map((q) => item(`${st.weekClaimed.includes(q.id) ? '*' : ' '}${q.text} ${Math.min(q.target, weeklyProgress(st, q))}/${q.target}`.substring(0, 30), () => {
                            if (claimWeekly(st, q)) {
                                this.ext.addGold(this.game.party, 300);
                                return info(undefined, 'Weekly quest complete! +300 gold, +5 currency, +15 renown.');
                            }
                            return info(undefined, st.weekClaimed.includes(q.id) ? 'Already claimed this week.' : 'Not finished yet.');
                        })),
                    })),
                    item('EVENT CACHE', () => {
                        if (claimEventCache(st, now)) {
                            this.ext.addGold(this.game.party, 1000);
                            return info(undefined, `${monthlyEvent(now)} cache opened! +1000 gold, +15 ${season.currency}.`);
                        }
                        return info(undefined, 'Defeat a world boss this month to open the event cache (once a month).');
                    }),
                    item('SEASON PASS', () => {
                        const tier = passTier(st);
                        const lines: string[] = [];
                        for (let t = 1; t <= tier; t++) {
                            if (!st.claimedPassTiers.includes(t)) {
                                st.claimedPassTiers.push(t);
                                const reward = passTierReward(t);
                                this.ext.addGold(this.game.party, reward.gold);
                                st.currency += reward.currency;
                                lines.push(`Tier ${t}: +${reward.gold} gold, +${reward.currency} ${season.currency}`);
                            }
                        }
                        return info('SEASON PASS', ...lines.length ? lines : [ `Tier ${tier}/${PASS_TIERS}. Fight and craft to earn pass XP.` ]);
                    }),
                ],
            };
        };
    }

    // ---- Title ----

    private titleMenu(): MenuNodeFactory {
        return () => {
            const titles = this.ext.titles();
            return {
                title: 'TITLE',
                items: [
                    item('NONE', () => {
                        delete this.ext.save.title;
                        return info(undefined, 'Title cleared.');
                    }),
                    ...titles.map((t) => item(t, () => {
                        this.ext.save.title = t;
                        return info(undefined, `Thou art now known as ${this.game.hero.name} ${t}.`);
                    }, t === this.ext.save.title ? 'blue' : undefined)),
                ],
            };
        };
    }

    /** Adds herbs to the classic inventory; returns how many fit. */
    addHerbs(count: number): number {
        let added = 0;
        for (let i = 0; i < count; i++) {
            if (this.game.party.addInventoryItem(HERB)) {
                added++;
            }
        }
        return added;
    }
}
