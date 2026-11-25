import { ImageUtils } from 'gtp';

/**
 * The animated 8-bit title scene for SOULDCREST STORMFIRE, drawn entirely in code.
 *
 * The scene tells the story's opening: a storm-touched hero stands on a cliff holding up the
 * glowing Souldcrest, while the storm drake Vaelrith circles in the thunderheads over the
 * kingdom of Tantegel. Rain falls and lightning strikes.
 *
 * Everything is painted at a low "NES" resolution with a small palette, then scaled up with
 * nearest-neighbour sampling so the pixels stay crisp.
 */

/** A small, NES-like palette. */
const P = {
    black: '#000000',
    sky0: '#0b0a24',
    sky1: '#15123f',
    sky2: '#221a5e',
    sky3: '#33267a',
    cloudDark: '#2a2a4e',
    cloud: '#45457a',
    cloudLight: '#6a6aa8',
    mountainFar: '#1c1c3c',
    mountainNear: '#141430',
    castle: '#0e0e24',
    window: '#fcd85c',
    cliff: '#2a1c12',
    cliffLight: '#5a3a20',
    grass: '#1f4a28',
    skin: '#f0bc8c',
    hair: '#5c2c0c',
    armor: '#3c5cbc',
    armorLight: '#7c9cfc',
    cape: '#b8102c',
    capeDark: '#78081c',
    boots: '#3a2410',
    crest: '#fcfcfc',
    glow: '#7cdcfc',
    glowDeep: '#3c9cfc',
    bolt: '#fcfcfc',
    boltEdge: '#b8c8fc',
    rain: '#5c6cb8',
    dragon: '#06061a',
    dragonEdge: '#2c2c5c',
    eye: '#7cfcfc',
} as const;

export const ART_WIDTH = 272;
export const ART_HEIGHT = 240;

type Ctx = CanvasRenderingContext2D;

const rect = (c: Ctx, color: string, x: number, y: number, w: number, h: number) => {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

const px = (c: Ctx, color: string, x: number, y: number) => {
    rect(c, color, x, y, 1, 1);
};

/** Bresenham line. */
const line = (c: Ctx, color: string, x0: number, y0: number, x1: number, y1: number, width = 1) => {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const xe = Math.round(x1);
    const ye = Math.round(y1);
    const dx = Math.abs(xe - x);
    const dy = -Math.abs(ye - y);
    const sx = x < xe ? 1 : -1;
    const sy = y < ye ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 2000; guard++) {
        rect(c, color, x, y, width, width);
        if (x === xe && y === ye) {
            break;
        }
        const e2 = 2 * err;
        if (e2 >= dy) {
            err += dy;
            x += sx;
        }
        if (e2 <= dx) {
            err += dx;
            y += sy;
        }
    }
};

/** Filled triangle, scanline by scanline (keeps hard pixel edges). */
const tri = (c: Ctx, color: string, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
    const minY = Math.floor(Math.min(ay, by, cy));
    const maxY = Math.ceil(Math.max(ay, by, cy));
    const edges: [number, number, number, number][] = [ [ ax, ay, bx, by ], [ bx, by, cx, cy ], [ cx, cy, ax, ay ] ];
    for (let y = minY; y <= maxY; y++) {
        const xs: number[] = [];
        for (const [ x0, y0, x1, y1 ] of edges) {
            if (y0 !== y1 && y >= Math.min(y0, y1) && y < Math.max(y0, y1)) {
                xs.push(x0 + (y - y0) * (x1 - x0) / (y1 - y0));
            }
        }
        if (xs.length >= 2) {
            const left = Math.min(...xs);
            const right = Math.max(...xs);
            rect(c, color, left, y, right - left + 1, 1);
        }
    }
};

/** Filled pixel circle. */
const disc = (c: Ctx, color: string, cx: number, cy: number, r: number) => {
    for (let y = -r; y <= r; y++) {
        const half = Math.floor(Math.sqrt(r * r - y * y));
        rect(c, color, cx - half, cy + y, half * 2 + 1, 1);
    }
};

/** A deterministic pseudo-random sequence, so the cached scene is identical every time. */
const seeded = (seed: number) => {
    let s = seed;
    return () => {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648;
    };
};

// ---------------------------------------------------------------------------
// Static layers

const drawSky = (c: Ctx) => {
    // Hard NES-style colour bands instead of a smooth gradient
    const bands = [ P.sky0, P.sky1, P.sky2, P.sky3 ];
    const bandH = 34;
    bands.forEach((color, i) => {
        rect(c, color, 0, i * bandH, ART_WIDTH, bandH + 1);
    });
    rect(c, P.sky3, 0, bands.length * bandH, ART_WIDTH, ART_HEIGHT);
    // Dithered seams between bands
    for (let i = 1; i < bands.length; i++) {
        const y = i * bandH;
        for (let x = 0; x < ART_WIDTH; x += 2) {
            px(c, bands[i - 1], x + i % 2, y);
            px(c, bands[i], x + (i + 1) % 2, y - 1);
        }
    }
    // A few stars peeking through the storm
    const rnd = seeded(7);
    for (let i = 0; i < 26; i++) {
        px(c, i % 4 === 0 ? P.glow : P.cloudLight, Math.floor(rnd() * ART_WIDTH), Math.floor(rnd() * 60));
    }
};

const drawCloudBank = (c: Ctx, y: number, color: string, seed: number, puff: number) => {
    const rnd = seeded(seed);
    for (let x = -10; x < ART_WIDTH + 10; x += puff) {
        disc(c, color, x + Math.floor(rnd() * puff), y + Math.floor(rnd() * 6), puff - 2 + Math.floor(rnd() * 4));
    }
};

const drawClouds = (c: Ctx) => {
    drawCloudBank(c, 66, P.cloudDark, 11, 14);
    drawCloudBank(c, 58, P.cloud, 23, 12);
    drawCloudBank(c, 52, P.cloudDark, 31, 10);
    // Bright rims where the storm light catches the clouds
    const rnd = seeded(41);
    for (let i = 0; i < 70; i++) {
        px(c, P.cloudLight, Math.floor(rnd() * ART_WIDTH), 44 + Math.floor(rnd() * 10));
    }
};

/** Vaelrith, the storm drake, wings spread across the thunderheads. */
const drawDragon = (c: Ctx, cx: number, cy: number) => {
    const d = P.dragon;
    const e = P.dragonEdge;
    // Wings
    tri(c, d, cx - 4, cy - 2, cx - 44, cy - 22, cx - 30, cy + 6);
    tri(c, d, cx - 30, cy + 6, cx - 44, cy - 22, cx - 52, cy + 2);
    tri(c, d, cx + 4, cy - 2, cx + 44, cy - 22, cx + 30, cy + 6);
    tri(c, d, cx + 30, cy + 6, cx + 44, cy - 22, cx + 52, cy + 2);
    // Wing bones
    line(c, e, cx - 4, cy - 2, cx - 44, cy - 22);
    line(c, e, cx - 44, cy - 22, cx - 30, cy + 6);
    line(c, e, cx - 44, cy - 22, cx - 52, cy + 2);
    line(c, e, cx + 4, cy - 2, cx + 44, cy - 22);
    line(c, e, cx + 44, cy - 22, cx + 30, cy + 6);
    line(c, e, cx + 44, cy - 22, cx + 52, cy + 2);
    // Body, neck, head, horns, tail
    disc(c, d, cx, cy + 2, 6);
    rect(c, d, cx - 3, cy - 10, 6, 10);
    rect(c, d, cx - 5, cy - 15, 10, 6);
    tri(c, d, cx - 5, cy - 15, cx - 2, cy - 21, cx, cy - 15);
    tri(c, d, cx + 5, cy - 15, cx + 2, cy - 21, cx, cy - 15);
    line(c, d, cx, cy + 8, cx + 6, cy + 18, 2);
    line(c, d, cx + 6, cy + 18, cx + 14, cy + 20, 2);
    tri(c, d, cx + 14, cy + 17, cx + 20, cy + 20, cx + 14, cy + 23);
};

const drawMountains = (c: Ctx) => {
    const far: [number, number][] = [ [ 0, 150 ], [ 30, 118 ], [ 60, 140 ], [ 96, 110 ], [ 140, 146 ], [ 182, 116 ], [ 230, 144 ], [ 272, 122 ] ];
    for (let i = 0; i < far.length - 1; i++) {
        const [ x0, y0 ] = far[i];
        const [ x1, y1 ] = far[i + 1];
        tri(c, P.mountainFar, x0, y0, x1, y1, x0, 180);
        tri(c, P.mountainFar, x1, y1, x1, 180, x0, 180);
    }
    // Snow caps catching the storm light
    for (const [ x, y ] of far) {
        if (y < 125) {
            tri(c, P.cloudLight, x - 5, y + 6, x, y, x + 5, y + 6);
        }
    }
    rect(c, P.mountainNear, 0, 160, ART_WIDTH, 80);
    const rnd = seeded(5);
    for (let x = 0; x < ART_WIDTH; x += 6) {
        rect(c, P.mountainNear, x, 152 + Math.floor(rnd() * 8), 6, 10);
    }
};

/** Tantegel castle on the far ridge, with lit windows. */
const drawCastle = (c: Ctx, x: number, baseY: number) => {
    const k = P.castle;
    rect(c, k, x, baseY - 18, 44, 18);
    for (let i = 0; i < 44; i += 4) {
        rect(c, k, x + i, baseY - 21, 2, 3);
    }
    const tower = (tx: number, h: number) => {
        rect(c, k, tx, baseY - h, 9, h);
        tri(c, k, tx - 1, baseY - h, tx + 4, baseY - h - 9, tx + 9, baseY - h);
        px(c, P.window, tx + 4, baseY - h + 5);
    };
    tower(x - 4, 30);
    tower(x + 17, 40);
    tower(x + 39, 30);
    line(c, k, x + 21, baseY - 49, x + 21, baseY - 56);
    rect(c, P.cape, x + 22, baseY - 56, 5, 3);
    for (let i = 0; i < 5; i++) {
        px(c, P.window, x + 6 + i * 8, baseY - 9);
    }
};

const drawCliff = (c: Ctx) => {
    // Foreground cliff on the right where the hero stands
    tri(c, P.cliff, 150, 240, 182, 178, 272, 240);
    rect(c, P.cliff, 182, 178, 90, 62);
    tri(c, P.cliff, 182, 178, 196, 170, 272, 178);
    rect(c, P.cliff, 196, 170, 76, 8);
    rect(c, P.grass, 190, 168, 82, 3);
    const rnd = seeded(19);
    for (let i = 0; i < 40; i++) {
        px(c, P.cliffLight, 170 + Math.floor(rnd() * 100), 180 + Math.floor(rnd() * 55));
    }
    // Dark foreground on the left
    rect(c, P.black, 0, 214, 150, 26);
    tri(c, P.black, 0, 214, 150, 214, 0, 200);
};

/** The storm-touched hero, holding the Souldcrest high (the crest itself is animated). */
const drawHero = (c: Ctx, x: number, footY: number) => {
    const top = footY - 22;
    // Cape blowing in the storm
    tri(c, P.capeDark, x - 1, top + 7, x - 9, top + 20, x + 3, top + 20);
    tri(c, P.cape, x, top + 7, x - 7, top + 18, x + 3, top + 18);
    // Legs and boots
    rect(c, P.armor, x, top + 15, 2, 5);
    rect(c, P.armor, x + 4, top + 15, 2, 5);
    rect(c, P.boots, x - 1, top + 20, 3, 2);
    rect(c, P.boots, x + 4, top + 20, 3, 2);
    // Body armour
    rect(c, P.armor, x, top + 7, 6, 8);
    rect(c, P.armorLight, x + 1, top + 8, 2, 3);
    // Head
    rect(c, P.skin, x + 1, top + 2, 4, 5);
    rect(c, P.hair, x + 1, top + 1, 4, 2);
    px(c, P.hair, x, top + 2);
    // Left arm down, right arm raised to the sky
    rect(c, P.skin, x - 1, top + 8, 1, 5);
    rect(c, P.skin, x + 6, top + 1, 1, 7);
    rect(c, P.skin, x + 6, top - 1, 2, 2);
};

// ---------------------------------------------------------------------------
// Animated layers

/** A jagged lightning bolt from the clouds, seeded so each strike differs. */
const drawBolt = (c: Ctx, startX: number, seed: number) => {
    const rnd = seeded(seed);
    let x = startX;
    let y = 60;
    while (y < 160) {
        const nx = x + Math.floor(rnd() * 13) - 6;
        const ny = y + 6 + Math.floor(rnd() * 8);
        line(c, P.boltEdge, x - 1, y, nx - 1, ny);
        line(c, P.bolt, x, y, nx, ny);
        if (rnd() < 0.25) {
            line(c, P.boltEdge, nx, ny, nx + Math.floor(rnd() * 16) - 8, ny + 10);
        }
        x = nx;
        y = ny;
    }
};

/**
 * Builds and animates the title scene.
 */
export class TitleArt {

    private readonly base: HTMLCanvasElement;
    private readonly frame: HTMLCanvasElement;
    private time = 0;
    private nextStrike = 1500;
    private strikeLeft = 0;
    private strikeX = 90;
    private strikeSeed = 1;
    private readonly heroX = 214;
    private readonly heroFoot = 168;

    constructor() {
        this.base = ImageUtils.createCanvas(ART_WIDTH, ART_HEIGHT);
        this.frame = ImageUtils.createCanvas(ART_WIDTH, ART_HEIGHT);
        const c = this.base.getContext('2d')!;
        drawSky(c);
        drawClouds(c);
        drawDragon(c, 150, 92);
        drawMountains(c);
        drawCastle(c, 40, 162);
        drawCliff(c);
        drawHero(c, this.heroX, this.heroFoot);
    }

    update(delta: number) {
        this.time += delta;
        this.nextStrike -= delta;
        if (this.strikeLeft > 0) {
            this.strikeLeft -= delta;
        }
        if (this.nextStrike <= 0) {
            this.strikeLeft = 260;
            this.strikeSeed = Math.floor(this.time) + 1;
            this.strikeX = 30 + this.strikeSeed * 37 % 120;
            this.nextStrike = 2600 + this.strikeSeed * 53 % 2400;
        }
    }

    /** True while a lightning flash lights the sky. */
    isFlashing(): boolean {
        return this.strikeLeft > 160;
    }

    /**
     * Paints the scene, scaled to fill the given area with crisp pixels.
     */
    paint(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
        const c = this.frame.getContext('2d')!;
        c.drawImage(this.base, 0, 0);

        // Lightning: a white flash, then the bolt
        if (this.strikeLeft > 0) {
            if (this.isFlashing()) {
                c.globalAlpha = 0.35;
                rect(c, P.boltEdge, 0, 0, ART_WIDTH, 150);
                c.globalAlpha = 1;
            }
            drawBolt(c, this.strikeX, this.strikeSeed);
        }

        // Vaelrith's eyes glow, brighter during a strike
        const eyeColor = this.strikeLeft > 0 || Math.floor(this.time / 700) % 3 !== 0 ? P.eye : P.dragonEdge;
        px(c, eyeColor, 147, 79);
        px(c, eyeColor, 152, 79);

        // The Souldcrest pulses above the hero's raised hand
        const pulse = (Math.sin(this.time / 220) + 1) / 2;
        const cx = this.heroX + 7;
        const cy = this.heroFoot - 26;
        disc(c, P.glowDeep, cx, cy, 3 + Math.round(pulse * 2));
        disc(c, P.glow, cx, cy, 2 + Math.round(pulse));
        px(c, P.crest, cx, cy);
        px(c, P.crest, cx - 1, cy);
        px(c, P.crest, cx + 1, cy);
        px(c, P.crest, cx, cy - 1);
        px(c, P.crest, cx, cy + 1);
        if (pulse > 0.6) {
            line(c, P.glow, cx, cy - 4, cx, cy - 9);
            line(c, P.glow, cx - 4, cy - 3, cx - 7, cy - 6);
            line(c, P.glow, cx + 4, cy - 3, cx + 7, cy - 6);
        }

        // Slanted rain
        const offset = Math.floor(this.time / 16);
        for (let i = 0; i < 90; i++) {
            const rx = (i * 53 + offset * 2) % (ART_WIDTH + 40) - 20;
            const ry = (i * 97 + offset * 5) % ART_HEIGHT;
            line(c, P.rain, rx, ry, rx - 2, ry + 5);
        }

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.frame, x, y, w, h);
        ctx.restore();
    }
}
