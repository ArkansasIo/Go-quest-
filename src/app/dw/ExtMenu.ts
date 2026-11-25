import { ChoiceBubble } from './ChoiceBubble';
import { DwGame } from './DwGame';
import { InfoBubble } from './InfoBubble';

/** Text shown after a menu action, optionally titled. */
export interface MenuInfo {
    title?: string;
    lines: string[];
}

/** What choosing an item does: open a submenu, show text, or close everything. */
export type MenuResult = MenuNodeFactory | MenuInfo | 'close' | undefined;

export interface MenuItem {
    label: string;
    /** Optional color for the label (e.g. 'blue' for item quality). */
    color?: string;
    run: () => MenuResult;
}

export interface MenuNode {
    title: string;
    items: MenuItem[];
}

/** Menus are rebuilt from their factory after each action so labels stay current. */
export type MenuNodeFactory = () => MenuNode;

const PAGE_SIZE = 9;

interface StackEntry {
    factory: MenuNodeFactory;
    page: number;
    selected: number;
    bubble?: ChoiceBubble<MenuItem>;
}

export const isMenuInfo = (result: MenuResult): result is MenuInfo =>
    typeof result === 'object';

/**
 * A stack of nested choice menus with paging for long lists, plus an info bubble for
 * showing results. Cancel goes up one level; closing the root ends the menu.
 */
export class ExtMenu {

    private readonly game: DwGame;
    private readonly stack: StackEntry[] = [];
    private info?: InfoBubble;
    private closeAfterInfo = false;
    private closed = false;

    constructor(game: DwGame, root: MenuNodeFactory) {
        this.game = game;
        this.push(root);
    }

    isClosed(): boolean {
        return this.closed;
    }

    /** Shows text immediately (e.g. from outside the menu tree), closing when dismissed. */
    showInfo(info: MenuInfo, closeAfter = false) {
        this.info = new InfoBubble(this.game, info.title, info.lines);
        this.closeAfterInfo = closeAfter;
    }

    private push(factory: MenuNodeFactory) {
        const entry: StackEntry = { factory, page: 0, selected: 0 };
        this.stack.push(entry);
        this.rebuild(entry);
    }

    private rebuild(entry: StackEntry) {
        const node = entry.factory();
        const pageCount = Math.max(1, Math.ceil(node.items.length / PAGE_SIZE));
        entry.page = Math.min(entry.page, pageCount - 1);
        let items = node.items.slice(entry.page * PAGE_SIZE, (entry.page + 1) * PAGE_SIZE);
        if (pageCount > 1) {
            items = items.concat([
                { label: `NEXT (${entry.page + 1}/${pageCount})`, color: 'blue', run: () => {
                    entry.page = (entry.page + 1) % pageCount;
                    entry.selected = 0;
                    return undefined;
                } },
            ]);
        }
        if (!items.length) {
            items = [ { label: '(nothing)', run: () => undefined } ];
        }

        const game = this.game;
        const tileSize = game.getTileSize();
        const depth = this.stack.indexOf(entry);
        let x: number;
        let y: number;
        let w: number;
        if (depth === 0) {
            // Root menu: a narrow vertical panel down the right side
            w = Math.min(game.getWidth() - tileSize, tileSize * 9.5);
            x = game.getWidth() - w - tileSize / 2;
            y = tileSize / 2;
        } else {
            // Submenus open over the screen, stepping in as they nest
            x = tileSize / 2 + (depth - 1) * tileSize / 2;
            y = tileSize / 2 + (depth - 1) * tileSize / 2;
            w = game.getWidth() - tileSize - (depth - 1) * tileSize;
        }
        const h = Math.min(game.getHeight() - y - tileSize / 2, (items.length + 2) * 18 * game.scale);
        const bubble = new ChoiceBubble<MenuItem>(game, x, y, w, h, items,
            (item) => item.color ? `\\c{${item.color}}${item.label}\\c` : item.label, true, node.title);
        bubble.setSelectedIndex(entry.selected); // Restore the previous selection
        entry.bubble = bubble;
    }

    update(delta: number) {
        if (this.closed) {
            return;
        }

        if (this.info) {
            this.info.update(delta);
            if (this.info.handleInput()) {
                delete this.info;
                if (this.closeAfterInfo) {
                    this.closed = true;
                    return;
                }
                const top = this.stack[this.stack.length - 1];
                if (top) {
                    this.rebuild(top);
                } else {
                    this.closed = true;
                }
            }
            return;
        }

        const top = this.stack[this.stack.length - 1];
        if (!top?.bubble) {
            this.closed = true;
            return;
        }
        top.bubble.update(delta);
        if (!top.bubble.handleInput()) {
            return;
        }

        const item = top.bubble.getSelectedItem();
        if (!item) { // Cancelled
            this.stack.pop();
            if (!this.stack.length) {
                this.closed = true;
            }
            return;
        }

        top.selected = top.bubble.getSelectedIndex();
        const result = item.run();
        if (result === 'close') {
            this.closed = true;
        } else if (typeof result === 'function') {
            this.push(result);
        } else if (isMenuInfo(result)) {
            this.info = new InfoBubble(this.game, result.title, result.lines);
            this.closeAfterInfo = false;
        } else {
            this.rebuild(top);
        }
    }

    paint(ctx: CanvasRenderingContext2D) {
        if (this.closed) {
            return;
        }
        // Paint only the top two menus to keep the small screen readable
        const visible = this.stack.slice(-2);
        visible.forEach((entry) => entry.bubble?.paint(ctx));
        this.info?.paint(ctx);
    }
}
