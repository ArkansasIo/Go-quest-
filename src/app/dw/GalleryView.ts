import { InputManager, Keys } from 'gtp';
import { DwGame } from './DwGame';
import { ARMOR_CLASSES, GEAR_TIERS, SHIELD_TYPES, WEAPON_TYPES, scaleTypeMods } from './systems/characters';
import { MONSTERS, MonsterDef } from './systems/monsters';
import { renderGearIcon, renderMonster } from './systems/sprites';
import { StatMods, describeMods } from './systems/stats';

export type GalleryMode = 'bestiary' | 'armory';

interface GalleryEntry {
    name: string;
    detail: string;
    draw: () => HTMLCanvasElement;
}

const title = (s: string) => s.charAt(0) + s.substring(1).toLowerCase();

/** Every weapon, armor and shield base across all gear tiers. */
const armoryEntries = (scale: number): GalleryEntry[] => {
    const list: GalleryEntry[] = [];
    GEAR_TIERS.forEach((tierName, tier) => {
        const add = (name: string, template: string, mods: StatMods, kind: string) => {
            list.push({
                name: `${tierName} ${name}`,
                detail: `${kind} T${tier + 1}: ${describeMods(scaleTypeMods(mods, tier))}`,
                draw: () => renderGearIcon(template, tier, scale * 2),
            });
        };
        WEAPON_TYPES.forEach((w) => {
            add(title(w.name), w.id, w.mods, `${w.hands}H ${w.subtype.toUpperCase()}`);
        });
        ARMOR_CLASSES.forEach((a) => {
            add(a.subtypes[0], 'armor', a.mods, `${a.name} ARMOR`);
        });
        SHIELD_TYPES.forEach((s) => {
            add(title(s.name), 'shield', s.mods, 'SHIELD');
        });
    });
    return list;
};

const bestiaryEntries = (scale: number, seen: (m: MonsterDef) => boolean): GalleryEntry[] =>
    MONSTERS.map((m) => ({
        name: seen(m) ? m.name : '??? (not yet defeated)',
        detail: `LV${m.level} ${m.family.type.toUpperCase()} ${m.element.toUpperCase()} HP${m.hp} STR${m.str}`,
        draw: () => renderMonster(m, scale),
    }));

/**
 * A full-screen picture gallery of the bestiary or the armory, with a cursor and paging.
 */
export class GalleryView {

    private readonly game: DwGame;
    private readonly mode: GalleryMode;
    private readonly entries: GalleryEntry[];
    private readonly cache = new Map<number, HTMLCanvasElement>();
    private selected = 0;
    private closed = false;
    private readonly cols: number;
    private readonly rows: number;

    constructor(game: DwGame, mode: GalleryMode) {
        this.game = game;
        this.mode = mode;
        const defeated = new Set(game.ext.save.bestiarySeen);
        this.entries = mode === 'bestiary' ?
            bestiaryEntries(game.scale, (m) => defeated.has(m.id)) :
            armoryEntries(game.scale);
        this.cols = mode === 'bestiary' ? 4 : 6;
        this.rows = mode === 'bestiary' ? 3 : 4;
    }

    isClosed(): boolean {
        return this.closed;
    }

    private perPage(): number {
        return this.cols * this.rows;
    }

    update(delta: number) {
        const im: InputManager = this.game.inputManager;
        const n = this.entries.length;
        if (im.left(true)) {
            this.selected = (this.selected + n - 1) % n;
        } else if (im.right(true)) {
            this.selected = (this.selected + 1) % n;
        } else if (im.up(true)) {
            this.selected = (this.selected + n - this.cols) % n;
        } else if (im.down(true)) {
            this.selected = (this.selected + this.cols) % n;
        } else if (this.game.cancelKeyPressed() || this.game.actionKeyPressed() ||
            im.isKeyDown(Keys.KEY_2, true) || im.isKeyDown(Keys.KEY_3, true)) {
            this.closed = true;
        }
    }

    private image(index: number): HTMLCanvasElement {
        let img = this.cache.get(index);
        if (!img) {
            img = this.entries[index].draw();
            this.cache.set(index, img);
        }
        return img;
    }

    paint(ctx: CanvasRenderingContext2D) {
        const game = this.game;
        const w = game.getWidth();
        const h = game.getHeight();
        const tile = game.getTileSize();
        const scale = game.scale;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);

        const page = Math.floor(this.selected / this.perPage());
        const pages = Math.ceil(this.entries.length / this.perPage());
        const heading = this.mode === 'bestiary' ?
            `BESTIARY ${game.ext.save.bestiarySeen.length}/${this.entries.length}` :
            `ARMORY ${this.entries.length} ITEMS`;
        game.drawString(heading, tile / 2, tile / 4);
        game.drawString(`${page + 1}/${pages}`, w - tile * 2.5, tile / 4);

        const gridTop = tile * 1.25;
        const gridH = h - gridTop - tile * 2.5;
        const cellW = (w - tile) / this.cols;
        const cellH = gridH / this.rows;
        const start = page * this.perPage();
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        for (let i = 0; i < this.perPage() && start + i < this.entries.length; i++) {
            const index = start + i;
            const cx = tile / 2 + i % this.cols * cellW;
            const cy = gridTop + Math.floor(i / this.cols) * cellH;
            const img = this.image(index);
            ctx.drawImage(img, cx + (cellW - img.width) / 2, cy + (cellH - img.height) / 2);
            if (index === this.selected) {
                ctx.strokeStyle = '#fcfcfc';
                ctx.lineWidth = 2 * scale;
                ctx.strokeRect(cx + scale, cy + scale, cellW - 2 * scale, cellH - 2 * scale);
            }
        }
        ctx.restore();

        const entry = this.entries[this.selected];
        game.drawString(entry.name.substring(0, 32), tile / 2, h - tile * 2);
        game.drawString(entry.detail.substring(0, 32), tile / 2, h - tile * 1.2);
    }
}
