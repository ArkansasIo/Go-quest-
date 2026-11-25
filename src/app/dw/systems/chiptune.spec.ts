import { describe, expect, it } from 'vitest';
import { MUSIC_COUNT, SAMPLE_RATE, SFX_COUNT, SOUNDS, encodeWav, renderEvents, renderSound } from './chiptune';

/** Every sound id the classic engine already plays. */
const ENGINE_IDS = [
    'MUSIC_TITLE_SCREEN', 'MUSIC_TANTEGEL', 'MUSIC_TANTEGEL_LOWER', 'MUSIC_TOWN', 'MUSIC_OVERWORLD',
    'MUSIC_BATTLE', 'MUSIC_DUNGEON_FLOOR_1', 'dead', 'overnight', 'victory', 'stairs', 'run', 'menu',
    'confirmation', 'hit', 'excellentMove', 'attack', 'receiveDamage', 'prepareToAttack', 'missed1',
    'missed2', 'bump', 'castSpell', 'openChest', 'door', 'breatheFire', 'talk',
];

describe('chiptune', () => {
    it('has 48 sounds: 16 music tracks and 32 effects, with unique ids', () => {
        expect(SOUNDS).toHaveLength(48);
        expect(MUSIC_COUNT).toBe(16);
        expect(SFX_COUNT).toBe(32);
        expect(new Set(SOUNDS.map((s) => s.id)).size).toBe(48);
    });

    it('replaces every sound the engine plays', () => {
        const ids = new Set(SOUNDS.map((s) => s.id));
        expect(ENGINE_IDS.filter((id) => !ids.has(id))).toEqual([]);
    });

    it('writes a valid mono 16-bit WAV header', () => {
        const wav = new DataView(encodeWav(new Float32Array([ 0, 0.5, -0.5 ])));
        const text = (o: number) => String.fromCharCode(wav.getUint8(o), wav.getUint8(o + 1), wav.getUint8(o + 2), wav.getUint8(o + 3));
        expect(text(0)).toBe('RIFF');
        expect(text(8)).toBe('WAVE');
        expect(wav.getUint16(22, true)).toBe(1);
        expect(wav.getUint32(24, true)).toBe(SAMPLE_RATE);
        expect(wav.getUint16(34, true)).toBe(16);
        expect(wav.getUint32(40, true)).toBe(6);
    });

    it('renders every sound to audible, unclipped audio quickly enough for load time', () => {
        const start = Date.now();
        const peaks = SOUNDS.map((sound) => {
            const { events, duration } = sound.build();
            return renderEvents(events, duration).reduce((m, s) => Math.max(m, Math.abs(s)), 0);
        });
        expect(peaks.every((p) => p > 0.05 && p <= 1)).toBe(true);
        expect(renderSound(SOUNDS[0]).byteLength).toBeGreaterThan(44);
        expect(Date.now() - start).toBeLessThan(15000);
    });

    it('composes the same track every time', () => {
        const track = SOUNDS.find((s) => s.id === 'MUSIC_OVERWORLD')!;
        expect(track.build().events).toEqual(track.build().events);
    });
});
