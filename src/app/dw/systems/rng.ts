/**
 * Random number helpers for the extended game systems. Every function that rolls
 * dice takes an injectable {@link Rng} so it can be tested deterministically.
 */

/** Returns a float in [0, 1). */
export type Rng = () => number;

export const defaultRng: Rng = () => Math.random();

/**
 * A small, fast seeded PRNG (mulberry32).
 */
export const seededRng = (seed: number): Rng => {
    let a = seed >>> 0;
    return () => {
        a = a + 0x6D2B79F5 >>> 0;
        let t = a;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
};

/**
 * A stable 32-bit hash of a string (FNV-1a).
 */
export const hashString = (str: string): number => {
    let h = 0x811C9DC5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
};

/** Returns an integer in [min, max], both inclusive. */
export const rollInt = (rng: Rng, min: number, max: number): number => {
    return min + Math.floor(rng() * (max - min + 1));
};

/** Returns true with the given probability (0-1). */
export const chance = (rng: Rng, probability: number): boolean => {
    return rng() < probability;
};

export const pick = <T>(rng: Rng, items: readonly T[]): T => {
    return items[Math.floor(rng() * items.length)];
};

export const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
};
