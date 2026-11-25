import { Delay, Image, InputManager } from 'gtp';
import { BaseState } from './BaseState';
import { DwGame } from './DwGame';
import { InitialMenuState } from './InitialMenuState';

export class TitleScreenState extends BaseState {
    private delay?: Delay;
    private blink: boolean;
    private readonly touchHandler = () => {
        this.loadNextState();
    };

    constructor(game: DwGame) {
        super(game);
        this.blink = true;
    }

    override enter() {
        super.enter();
        this.game.canvas.addEventListener('touchstart', this.touchHandler, false);
        this.delay = new Delay({ millis: [ 600, 400 ] });
        this.blink = true;
        this.game.audio.playMusic('MUSIC_TITLE_SCREEN');
    }

    override leaving() {
        this.game.canvas.removeEventListener('touchstart', this.touchHandler, false);
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
        const width = game.getWidth();
        const height = game.getHeight();
        const background: Image = game.assets.get('aelmoorTitleBg');
        const hero: Image = game.assets.get('aelmoorHero');
        const codex: Image = game.assets.get('aelmoorCodex');
        const duskKing: Image = game.assets.get('aelmoorDuskKing');

        background.drawScaled(ctx, 0, 0, width, height);

        const titleShade = ctx.createLinearGradient(0, 0, 0, 132);
        titleShade.addColorStop(0, 'rgba(3, 7, 15, 0.72)');
        titleShade.addColorStop(1, 'rgba(3, 7, 15, 0)');
        ctx.fillStyle = titleShade;
        ctx.fillRect(0, 0, width, 132);

        // Keep the landscape dominant while bringing the story's key figures forward.
        hero.drawScaled(ctx, width * 0.035, height * 0.47, width * 0.30, height * 0.51);
        duskKing.drawScaled(ctx, width * 0.715, height * 0.27, width * 0.255, height * 0.56);
        codex.drawScaled(ctx, width - 88, height - 126, 68, 68);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.font = 'bold 29px Georgia, "Times New Roman", serif';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(5, 8, 13, 0.9)';
        ctx.fillStyle = '#f4d99a';
        ctx.shadowColor = 'rgba(238, 163, 61, 0.48)';
        ctx.shadowBlur = 12;
        ctx.strokeText('LANTERNS OF AELMOOR', width / 2, 48);
        ctx.fillText('LANTERNS OF AELMOOR', width / 2, 48);

        ctx.font = 'bold 13px Georgia, "Times New Roman", serif';
        ctx.letterSpacing = '2px';
        ctx.fillStyle = '#e5b75f';
        ctx.shadowBlur = 5;
        ctx.fillText('THE EMBER CODEX', width / 2, 77);
        ctx.restore();

        if (!game.audio.isInitialized()) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = '12px Georgia, "Times New Roman", serif';
            ctx.fillStyle = '#f0d9a2';
            ctx.fillText('Sound is unavailable in this browser', width / 2, height - 52);
            ctx.restore();
        }

        if (this.blink) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = 'bold 15px Georgia, "Times New Roman", serif';
            ctx.fillStyle = '#fff1c6';
            ctx.shadowColor = 'rgba(255, 180, 62, 0.9)';
            ctx.shadowBlur = 10;
            ctx.fillText('PRESS ENTER TO BEGIN', width / 2, height - 18);
            ctx.restore();
        }
    }

    private loadNextState() {
        this.game.setState(new InitialMenuState(this.game));
    }
}
