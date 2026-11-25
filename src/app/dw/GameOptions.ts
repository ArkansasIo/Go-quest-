/**
 * Player options (screen size, sound, random encounters), remembered in localStorage.
 * Storage can be unavailable (private windows, blocked site data), so every access is
 * guarded and the game falls back to defaults.
 */

/** The game's name, shown on the title screen and menus. */
export const GAME_TITLE = 'SOULDCREST STORMFIRE';

/**
 * Draws the game title centered in a box, shrinking the font until it fits the width.
 */
export const drawTitleText = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number,
    maxWidth: number, maxFontPx: number, shadow: number): void => {
    ctx.save();
    let size = Math.round(maxFontPx);
    const font = (px: number) => `bold ${px}px "Souldcrest Pixel", monospace`;
    ctx.font = font(size);
    while (size > 8 && ctx.measureText(GAME_TITLE).width > maxWidth) {
        size--;
        ctx.font = font(size);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';
    ctx.fillText(GAME_TITLE, centerX + shadow, centerY + shadow);
    ctx.fillStyle = '#fcfcfc';
    ctx.fillText(GAME_TITLE, centerX, centerY);
    ctx.restore();
};

export type ScreenSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'FIT';

export const SCREEN_SIZES: ScreenSize[] = [ 'SMALL', 'MEDIUM', 'LARGE', 'FIT' ];

/** CSS zoom of the canvas for each size (relative to its native resolution). */
const SIZE_ZOOM: Record<Exclude<ScreenSize, 'FIT'>, number> = { SMALL: 0.75, MEDIUM: 1, LARGE: 1.5 };

export interface GameOptions {
    screenSize: ScreenSize;
    sound: boolean;
    encounters: boolean;
}

const KEY = 'dw:options';

export const DEFAULT_OPTIONS: GameOptions = { screenSize: 'MEDIUM', sound: true, encounters: true };

export const loadOptions = (): GameOptions => {
    try {
        const json = localStorage.getItem(KEY);
        return json ? { ...DEFAULT_OPTIONS, ...JSON.parse(json) as Partial<GameOptions> } : { ...DEFAULT_OPTIONS };
    } catch {
        return { ...DEFAULT_OPTIONS };
    }
};

export const saveOptions = (options: GameOptions): void => {
    try {
        localStorage.setItem(KEY, JSON.stringify(options));
    } catch {
        // Storage unavailable: options just won't persist
    }
};

export const nextScreenSize = (size: ScreenSize): ScreenSize =>
    SCREEN_SIZES[(SCREEN_SIZES.indexOf(size) + 1) % SCREEN_SIZES.length];

/**
 * Sizes the canvas on the page. FIT scales to the window while keeping the aspect ratio.
 */
export const applyScreenSize = (canvas: HTMLCanvasElement, size: ScreenSize): void => {
    const w = canvas.width;
    const h = canvas.height;
    let zoom: number;
    if (size === 'FIT') {
        const availW = Math.max(200, window.innerWidth - 32);
        const availH = Math.max(200, window.innerHeight - 160);
        zoom = Math.min(availW / w, availH / h);
    } else {
        zoom = SIZE_ZOOM[size];
    }
    canvas.style.width = `${Math.round(w * zoom)}px`;
    canvas.style.height = `${Math.round(h * zoom)}px`;
};
