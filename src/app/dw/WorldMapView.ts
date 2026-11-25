import { ImageUtils, InputManager, Keys, TiledLayer } from 'gtp';
import { DwGame } from './DwGame';
import { DwMap } from './DwMap';
import { currentEvent } from './systems/events';
import { BIOMES, COUNTRIES, ZONES, ZONE_GRID_COLS, ZONE_GRID_ROWS, ZoneDef, zoneAt } from './systems/world';

/** Pixel size of the cached, pre-rendered world map. */
const CACHE_SIZE = 600;

/**
 * A full-screen world map: the whole overworld scaled to fit, with zone borders, fog over
 * unexplored zones, the current world event, the hero's position and a zone cursor.
 */
export class WorldMapView {

    private static cache?: HTMLCanvasElement;
    private readonly game: DwGame;
    private cursorRow: number;
    private cursorCol: number;
    private blinkMillis = 0;
    private closed = false;

    constructor(game: DwGame) {
        this.game = game;
        const hero = this.heroZone();
        this.cursorRow = hero?.gridRow ?? 0;
        this.cursorCol = hero?.gridCol ?? 0;
    }

    private overworld(): DwMap | undefined {
        return this.game.maps['overworld.json'];
    }

    /** The zone the hero is standing in, if on the overworld. */
    private heroZone(): ZoneDef | undefined {
        const map = this.overworld();
        if (!map || this.game.getMap().name !== 'overworld') {
            return undefined;
        }
        return zoneAt(this.game.hero.mapRow, this.game.hero.mapCol, map.height, map.width).zone;
    }

    /**
     * Renders every overworld tile once into a cached canvas.
     */
    private buildCache(map: DwMap): HTMLCanvasElement {
        const tile = this.game.getTileSize();
        const big = ImageUtils.createCanvas(map.width * tile, map.height * tile);
        const bigCtx = big.getContext('2d')!;
        const layer: TiledLayer = map.getLayer('tileLayer');
        for (let row = 0; row < map.height; row++) {
            for (let col = 0; col < map.width; col++) {
                const gid = layer.getData(row, col);
                if (gid > 0) {
                    map.drawTile(bigCtx, col * tile, row * tile, gid, layer);
                }
            }
        }
        const small = ImageUtils.createCanvas(CACHE_SIZE, CACHE_SIZE);
        const smallCtx = small.getContext('2d')!;
        smallCtx.imageSmoothingEnabled = true;
        smallCtx.drawImage(big, 0, 0, CACHE_SIZE, CACHE_SIZE);
        return small;
    }

    isClosed(): boolean {
        return this.closed;
    }

    update(delta: number) {
        this.blinkMillis += delta;
        const im: InputManager = this.game.inputManager;
        if (im.up(true)) {
            this.cursorRow = (this.cursorRow + ZONE_GRID_ROWS - 1) % ZONE_GRID_ROWS;
        } else if (im.down(true)) {
            this.cursorRow = (this.cursorRow + 1) % ZONE_GRID_ROWS;
        } else if (im.left(true)) {
            this.cursorCol = (this.cursorCol + ZONE_GRID_COLS - 1) % ZONE_GRID_COLS;
        } else if (im.right(true)) {
            this.cursorCol = (this.cursorCol + 1) % ZONE_GRID_COLS;
        } else if (this.game.cancelKeyPressed() || this.game.actionKeyPressed() ||
            im.isKeyDown(Keys.KEY_M, true)) {
            this.closed = true;
        }
    }

    paint(ctx: CanvasRenderingContext2D) {
        const game = this.game;
        const map = this.overworld();
        const w = game.getWidth();
        const h = game.getHeight();
        const tile = game.getTileSize();
        const scale = game.scale;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
        if (!map) {
            game.drawString('The world map is not available.', tile, tile);
            return;
        }
        WorldMapView.cache ??= this.buildCache(map);

        // Fit the square map in the area between the title and the info lines
        const top = tile * 1.25;
        const size = Math.min(w - tile, h - top - tile * 2.75);
        const left = (w - size) / 2;
        ctx.drawImage(WorldMapView.cache, left, top, size, size);

        const cellW = size / ZONE_GRID_COLS;
        const cellH = size / ZONE_GRID_ROWS;
        const visited = game.ext.save.zonesVisited;

        // Fog of war over unexplored zones, then the zone grid
        for (const zone of ZONES) {
            const x = left + zone.gridCol * cellW;
            const y = top + zone.gridRow * cellH;
            if (!zone.subZones.some((s) => visited.includes(s.id))) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
                ctx.fillRect(x, y, cellW, cellH);
            }
        }
        ctx.strokeStyle = 'rgba(252, 252, 252, 0.35)';
        ctx.lineWidth = 1;
        for (let r = 0; r <= ZONE_GRID_ROWS; r++) {
            ctx.beginPath();
            ctx.moveTo(left, top + r * cellH);
            ctx.lineTo(left + size, top + r * cellH);
            ctx.stroke();
        }
        for (let c = 0; c <= ZONE_GRID_COLS; c++) {
            ctx.beginPath();
            ctx.moveTo(left + c * cellW, top);
            ctx.lineTo(left + c * cellW, top + size);
            ctx.stroke();
        }

        // Current world event
        const event = currentEvent();
        ctx.strokeStyle = '#f83800';
        ctx.lineWidth = 2 * scale;
        ctx.strokeRect(left + event.zone.gridCol * cellW + scale, top + event.zone.gridRow * cellH + scale,
            cellW - 2 * scale, cellH - 2 * scale);

        // Hero position (blinking)
        if (game.getMap().name === 'overworld' && Math.floor(this.blinkMillis / 300) % 2 === 0) {
            const hx = left + (game.hero.mapCol + 0.5) / map.width * size;
            const hy = top + (game.hero.mapRow + 0.5) / map.height * size;
            ctx.fillStyle = '#fcfcfc';
            ctx.fillRect(hx - 2 * scale, hy - 2 * scale, 4 * scale, 4 * scale);
        }

        // Zone cursor
        ctx.strokeStyle = '#fcfcfc';
        ctx.lineWidth = 2 * scale;
        ctx.strokeRect(left + this.cursorCol * cellW, top + this.cursorRow * cellH, cellW, cellH);

        // Title and info
        game.drawString('WORLD MAP', left, tile / 4);
        const zone = ZONES[this.cursorRow * ZONE_GRID_COLS + this.cursorCol];
        const explored = zone.subZones.some((s) => visited.includes(s.id));
        const biome = BIOMES.find((b) => b.id === zone.biome)?.name ?? '';
        const country = COUNTRIES.find((c) => c.id === zone.country)?.name ?? '';
        const infoY = top + size + tile / 4;
        game.drawString(explored ? zone.name : '??? (UNEXPLORED)', left, infoY);
        game.drawString(`${biome} LV${zone.minLevel}-${zone.maxLevel}`, left, infoY + tile * 0.75);
        game.drawString(country.substring(0, 24), left, infoY + tile * 1.5);
        if (zone.id === event.zone.id) {
            game.drawString(`EVENT: ${event.def.name}`, left + size / 2, infoY + tile * 0.75, 'red');
        }
        const here = this.heroZone();
        if (!here) {
            game.drawString('Thou art not in the open world.', left + size / 2, infoY + tile * 1.5);
        }
    }
}
