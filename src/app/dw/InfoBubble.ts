import { Bubble } from './Bubble';
import { DwGame } from './DwGame';

/**
 * A bubble that shows several lines of text, word-wrapped and split into pages.
 * The action or cancel key advances to the next page; after the last page it is done.
 */
export class InfoBubble extends Bubble {

    private readonly pages: string[][];
    private page = 0;
    private readonly yInc: number;

    constructor(game: DwGame, title: string | undefined, lines: string[]) {
        const tileSize = game.getTileSize();
        const x = tileSize;
        const y = tileSize;
        const w = game.getWidth() - 2 * tileSize;
        const h = game.getHeight() - 2 * tileSize;
        super(game, title, x, y, w, h);
        this.yInc = game.stringHeight() + 5 * game.scale;

        const charWidth = game.stringWidth('x');
        const maxChars = Math.max(10, Math.floor((w - 2 * this.getXMargin()) / charWidth));
        const rows = Math.max(1, Math.floor((h - this.getYMargin() - 2 * game.scale * 8) / this.yInc));
        const wrapped = lines.flatMap((line) => InfoBubble.wrap(line, maxChars));
        this.pages = [];
        for (let i = 0; i < wrapped.length; i += rows) {
            this.pages.push(wrapped.slice(i, i + rows));
        }
        if (!this.pages.length) {
            this.pages.push([ '' ]);
        }
    }

    /** Word-wraps a line to a maximum number of characters. */
    static wrap(line: string, maxChars: number): string[] {
        if (line.length <= maxChars) {
            return [ line ];
        }
        const result: string[] = [];
        let current = '';
        for (const word of line.split(' ')) {
            if (!current.length) {
                current = word;
            } else if (current.length + 1 + word.length <= maxChars) {
                current += ' ' + word;
            } else {
                result.push(current);
                current = word;
            }
            while (current.length > maxChars) {
                result.push(current.substring(0, maxChars));
                current = current.substring(maxChars);
            }
        }
        if (current.length) {
            result.push(current);
        }
        return result;
    }

    getPageCount(): number {
        return this.pages.length;
    }

    /**
     * @return Whether the bubble has been dismissed.
     */
    handleInput(): boolean {
        if (this.game.actionKeyPressed() || this.game.cancelKeyPressed()) {
            this.page++;
            if (this.page >= this.pages.length) {
                return true;
            }
            this.resetArrowTimer();
        }
        return false;
    }

    override paintContent(ctx: CanvasRenderingContext2D, x: number, y: number) {
        let y0 = y;
        for (const line of this.pages[Math.min(this.page, this.pages.length - 1)]) {
            this.game.drawString(line, x, y0);
            y0 += this.yInc;
        }
        if (this.page < this.pages.length - 1) {
            this.drawDownArrow(this.x + this.w / 2, this.y + this.h - this.game.getTileSize() * 3 / 4);
        }
    }
}
