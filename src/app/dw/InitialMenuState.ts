import { BaseState } from './BaseState';
import { DwGame } from './DwGame';
import { ExtMenu, MenuItem, MenuNodeFactory, MenuResult } from './ExtMenu';
import { AdventureLogSummary, deleteAdventureLog, getAdventureLogSummaries } from './AdventureLog';
import { GameOptions, drawTitleText, applyScreenSize, loadOptions, nextScreenSize, saveOptions } from './GameOptions';
import { keybindHelpLines } from './Keybinds';
import { MUSIC_COUNT, SFX_COUNT, SOUNDS } from './systems/chiptune';

const item = (label: string, run: () => MenuResult, color?: string): MenuItem => ({ label, run, color });

/** Short date such as 2026-11-25 14:05. */
const formatDate = (iso: string): string => iso.substring(0, 16).replace('T', ' ');

/**
 * Turns sound on or off. gtp only offers a toggle, so toggle until the state matches.
 */
export const setSound = (game: DwGame, on: boolean): void => {
    if (game.audio.toggleMuted() === on) {
        game.audio.toggleMuted();
    }
};

/**
 * Applies options to the running game.
 */
export const applyOptions = (game: DwGame, options: GameOptions, includeSound = true): void => {
    applyScreenSize(game.canvas, options.screenSize);
    game.setRandomEncounters(options.encounters);
    if (includeSound) {
        setSound(game, options.sound);
    }
};

/**
 * The options menu, shared by the title screen and the in-game menu.
 */
export const optionsMenu = (game: DwGame): MenuNodeFactory => {
    return () => {
        const options = loadOptions();
        const update = (change: Partial<GameOptions>, sound = false): MenuResult => {
            const next = { ...options, ...change };
            saveOptions(next);
            applyOptions(game, next, sound);
            return undefined;
        };
        return {
            title: 'OPTIONS',
            items: [
                item(`SCREEN SIZE:  ${options.screenSize}`, () => {
                    return update({ screenSize: nextScreenSize(options.screenSize) });
                }),
                item(`SOUND:        ${options.sound ? 'ON' : 'OFF'}`, () => {
                    return update({ sound: !options.sound }, true);
                }),
                item(`ENCOUNTERS:   ${options.encounters ? 'ON' : 'OFF'}`, () => {
                    return update({ encounters: !options.encounters });
                }),
                item(`SOUND TEST (${SOUNDS.length})`, () => () => ({
                    title: `SOUND TEST ${MUSIC_COUNT} MUSIC ${SFX_COUNT} SFX`,
                    items: SOUNDS.map((sound) => item(`${sound.kind === 'music' ? 'MUSIC' : 'SFX  '} ${sound.name}`.substring(0, 30), () => {
                        if (sound.kind === 'music') {
                            game.audio.playMusic(sound.id, sound.loop);
                        } else {
                            game.audio.playSound(sound.id);
                        }
                        return undefined;
                    })),
                })),
                item('CONTROLS', () => ({
                    title: 'CONTROLS',
                    lines: keybindHelpLines(),
                })),
            ],
        };
    };
};

/**
 * The menu shown after pressing Enter on the title screen: continue, new game, load game
 * and options.
 */
export class InitialMenuState extends BaseState {

    private menu: ExtMenu;

    constructor(game: DwGame) {
        super(game);
        this.menu = this.createMenu();
    }

    private createMenu(): ExtMenu {
        return new ExtMenu(this.game, this.rootMenu(), 'center');
    }

    private saves(): AdventureLogSummary[] {
        try {
            return getAdventureLogSummaries().slice().sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
        } catch {
            return [];
        }
    }

    private rootMenu(): MenuNodeFactory {
        return () => {
            const saves = this.saves();
            const items: MenuItem[] = [];
            if (saves.length) {
                items.push(item('CONTINUE', () => this.loadGame(saves[0].id)));
            }
            items.push(item('NEW GAME', () => this.newGame()));
            items.push(item(`LOAD GAME (${saves.length})`, () => saves.length ? this.loadMenu() :
                { lines: [ 'There are no saved quests yet.' ] }));
            items.push(item('OPTIONS', () => optionsMenu(this.game)));
            return { title: 'MAIN MENU', items };
        };
    }

    private loadMenu(): MenuNodeFactory {
        return () => ({
            title: 'LOAD GAME',
            items: this.saves().map((save) => item(
                `${save.heroName.padEnd(8, ' ').substring(0, 8)} LV${String(save.level).padEnd(4, ' ')}${formatDate(save.modifiedAt)}`,
                () => () => ({
                    title: `${save.heroName} LV${save.level}`,
                    items: [
                        item('LOAD', () => this.loadGame(save.id)),
                        item('DELETE', () => () => ({
                            title: 'DELETE THIS QUEST?',
                            items: [
                                item('NO', () => ({ lines: [ 'The quest is kept.' ] })),
                                item('YES, DELETE IT', () => {
                                    deleteAdventureLog(save.id);
                                    this.menu = this.createMenu();
                                    return undefined;
                                }, 'red'),
                            ],
                        })),
                    ],
                }))),
        });
    }

    private loadGame(id: string): MenuResult {
        this.game.audio.playSound('menu');
        this.game.continueGame(id);
        return 'close';
    }

    private newGame(): MenuResult {
        this.game.audio.playSound('menu');
        this.game.startNewGame();
        this.game.saveAdventureLog(); // Creates the save slot right away
        return 'close';
    }

    override enter() {
        super.enter();
        this.game.audio.playMusic('MUSIC_TOWN');
        applyOptions(this.game, loadOptions(), false);
    }

    override update(delta: number) {
        this.handleDefaultKeys();
        this.menu.update(delta);
        if (this.menu.isClosed() && this.game.state === this) {
            // Backed out of the main menu: reopen it
            this.menu = this.createMenu();
        }
    }

    override render(ctx: CanvasRenderingContext2D) {
        const game: DwGame = this.game;
        game.clearScreen();
        const w = game.getWidth();
        const tile = game.getTileSize();
        const scale = game.scale;

        // Title banner
        ctx.fillStyle = '#7c7c7c';
        ctx.fillRect(tile, tile, w - 2 * tile, tile * 4);
        ctx.strokeStyle = '#fcfcfc';
        ctx.lineWidth = 2 * scale;
        ctx.strokeRect(tile + 4 * scale, tile + 4 * scale, w - 2 * tile - 8 * scale, tile * 4 - 8 * scale);
        drawTitleText(ctx, w / 2, tile * 3, w - 4 * tile, 26 * scale, 2 * scale);

        this.menu.paint(ctx);

        const hint = 'Z: SELECT   X: BACK';
        game.drawString(hint, (w - game.stringWidth(hint)) / 2, game.getHeight() - tile);
    }
}
