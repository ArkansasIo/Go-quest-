import { Delay, InputManager } from 'gtp';
import { TitleArt } from './TitleArt';
import { drawTitleText } from './GameOptions';
import { BaseState } from './BaseState';
import { DwGame } from './DwGame';
import { InitialMenuState } from './InitialMenuState';

export class TitleScreenState extends BaseState {

    private delay?: Delay;
    private blink: boolean;
    private readonly art = new TitleArt();

    constructor(game: DwGame) {
        super(game);
        this.blink = true;
    }

    override enter() {
        super.enter();
        this.game.canvas.addEventListener('touchstart', this.handleStart.bind(this), false);
        this.delay = new Delay({ millis: [ 600, 400 ] });
        this.blink = true;
        this.game.audio.playMusic('MUSIC_TITLE_SCREEN');
    }

    override leaving() {
        this.game.canvas.removeEventListener('touchstart', this.handleStart.bind(this), false);
    }

    handleStart() {
        console.log('yee, touch detected!');
        this.loadNextState();
    }

    override update(delta: number) {

        this.handleDefaultKeys();
        this.art.update(delta);

        if (this.delay?.update(delta)) {
            this.delay.reset();
            this.blink = !this.blink;
        }

        const im: InputManager = this.game.inputManager;
        if (im.enter(true)) {
            this.loadNextState();
        }

    }

    override render(ctx: CanvasRenderingContext2D) {

        const game: DwGame = this.game;
        game.clearScreen();
        const w: number = game.getWidth();
        const h: number = game.getHeight();
        const scale = game.scale;
        const tile = game.getTileSize();

        // The animated 8-bit story scene fills the screen
        this.art.paint(ctx, 0, 0, w, h);

        // Title banner: dark glass panel with the classic white menu border
        const panelW = w - 2 * tile;
        const panelH = tile * 3;
        let x: number = tile;
        let y = tile / 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y, panelW, panelH);
        ctx.strokeStyle = this.art.isFlashing() ? '#7cdcfc' : '#fcfcfc';
        ctx.lineWidth = 2 * scale;
        ctx.strokeRect(x + 3 * scale, y + 3 * scale, panelW - 6 * scale, panelH - 6 * scale);
        drawTitleText(ctx, w / 2, y + panelH * 0.42, panelW - 20 * scale, 30 * scale, 2 * scale);
        const subtitle = 'A LEGEND OF THE SOULDCREST';
        game.drawString(subtitle, (w - game.stringWidth(subtitle)) / 2, y + panelH - tile * 0.85);

        if (!game.audio.isInitialized()) {
            let text = 'Sound is disabled as your';
            x = (w - game.stringWidth(text)) / 2;
            y = 390;
            game.drawString(text, x, y);
            text = 'browser does not support';
            x = (w - game.stringWidth(text)) / 2;
            y += 26;
            game.drawString(text, x, y);
            text = 'web audio';
            x = (w - game.stringWidth(text)) / 2;
            y += 26;
            game.drawString(text, x, y);
        }

        // Prompt on the dark foreground, and the credit line
        if (this.blink) {
            const prompt = 'PRESS ENTER';
            x = tile;
            y = h - tile * 1.75;
            game.drawString(prompt, x, y);
        }
        const credit = '(C) 2026 ARKANSASIO';
        game.drawString(credit, tile, h - tile * 0.9);
    }

    private loadNextState() {
        this.game.setState(new InitialMenuState(this.game));
    }
}
