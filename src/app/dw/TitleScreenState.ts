import { Delay, Image, InputManager } from 'gtp';
import { drawTitleText } from './GameOptions';
import { BaseState } from './BaseState';
import { DwGame } from './DwGame';
import { InitialMenuState } from './InitialMenuState';

export class TitleScreenState extends BaseState {

    private delay?: Delay;
    private blink: boolean;

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

        // Title panel drawn in the same style as the original banner art
        const img: Image = game.assets.get('title');
        const panelW = img.width;
        const panelH = img.height;
        let x: number = (w - panelW) / 2;
        let y = 30;
        const scale = game.scale;
        ctx.fillStyle = '#7c7c7c';
        ctx.fillRect(x, y, panelW, panelH);
        ctx.strokeStyle = '#fcfcfc';
        ctx.lineWidth = 2 * scale;
        ctx.strokeRect(x + 4 * scale, y + 4 * scale, panelW - 8 * scale, panelH - 8 * scale);
        drawTitleText(ctx, w / 2, y + panelH / 2, panelW - 24 * scale, 30 * scale, 2 * scale);

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

        if (this.blink) {
            const prompt = 'Press Enter';
            x = (w - game.stringWidth(prompt)) / 2;
            y = 240;
            game.drawString(prompt, x, y);
        }
    }

    private loadNextState() {
        this.game.setState(new InitialMenuState(this.game));
    }
}
