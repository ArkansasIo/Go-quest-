import { InputManager } from 'gtp';
import { Bubble } from './Bubble';
import { BattleState } from './BattleState';
import { DwGame } from './DwGame';

/** Left column then right column. */
const COMMANDS = [ 'FIGHT', 'RUN', 'SKILL', 'SPELL', 'ITEM', 'GUARD' ];
const ROWS = 3;

export class BattleCommandBubble extends Bubble {

    selection: number;

    constructor(game: DwGame) {

        const tileSize: number = game.getTileSize();

        super(game, 'COMMAND', 8 * tileSize, tileSize, tileSize * 8, tileSize * 4);

        this.selection = 0;
    }

    handleCommandChosen(state: BattleState) {

        switch (COMMANDS[this.selection]) {

            case 'FIGHT':
                state.fight();
                break;

            case 'RUN':
                state.run();
                break;

            case 'SKILL':
                state.skill();
                break;

            case 'SPELL':
                //state.spell();
                break;

            case 'ITEM':
                state.item();
                break;

            case 'GUARD':
                state.guard();
                break;

        }

    }

    handleInput() {

        const im: InputManager = this.game.inputManager;
        const count = COMMANDS.length;

        if (im.up(true)) {
            this.selection = (this.selection - 1 + count) % count;
        } else if (im.down(true)) {
            this.selection = (this.selection + 1) % count;
        } else if (this.selection >= ROWS && im.left(true)) {
            this.selection -= ROWS;
        } else if (this.selection < ROWS && im.right(true)) {
            this.selection += ROWS;
        } else if (this.game.cancelKeyPressed()) {
            this.reset();
            return false;
        } else if (this.game.actionKeyPressed()) {
            this.game.audio.playSound('menu');
            return true;
        }

        return false;

    }

    override paintContent(ctx: CanvasRenderingContext2D, x: number, y: number) {

        const SCALE: number = this.game.scale;
        const Y_INC: number = this.game.stringHeight() + 6 * SCALE;
        const colW = 64 * SCALE;

        COMMANDS.forEach((command, index) => {
            const col = Math.floor(index / ROWS);
            const row = index % ROWS;
            this.game.drawString(command, x + col * colW, y + row * Y_INC);
        });

        const arrowX = x + Math.floor(this.selection / ROWS) * colW - this.game.stringWidth('>') - 2 * SCALE;
        this.drawArrow(arrowX, y + Y_INC * (this.selection % ROWS));

    }

    reset() {
        this.selection = 0;
    }
}
