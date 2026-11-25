/**
 * An original 8-bit chiptune synthesizer and the game's 48 sounds: 16 music tracks and
 * 32 sound effects, all generated in code.
 *
 * Voices imitate classic console sound chips: pulse channels (12.5%, 25% or 50% duty),
 * a triangle channel and a noise channel. Music is composed procedurally from each track's
 * key, mode, tempo, chord progression and a repeating motif, so every track is distinct and
 * identical every time. Sounds render to PCM samples and encode as WAV.
 */
import { seededRng } from './rng';

export const SAMPLE_RATE = 22050;

export type Wave = 'pulse12' | 'pulse25' | 'pulse50' | 'triangle' | 'noise' | 'sine';

/** One note or sound event. */
export interface ToneEvent {
    /** Start time in seconds. */
    t: number;
    /** Duration in seconds. */
    dur: number;
    /** Frequency in Hz (for noise: the sample-and-hold rate). */
    freq: number;
    /** Frequency at the end of the note, for slides. */
    freqEnd?: number;
    wave: Wave;
    vol: number;
    /** Fraction of the note spent decaying to silence (default 0.3). */
    decay?: number;
    /** Vibrato depth in semitones. */
    vibrato?: number;
}

export const midiToFreq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

const sampleWave = (wave: Wave, phase: number): number => {
    switch (wave) {
        case 'pulse12': return phase < 0.125 ? 1 : -1;
        case 'pulse25': return phase < 0.25 ? 1 : -1;
        case 'pulse50': return phase < 0.5 ? 1 : -1;
        case 'triangle': return 4 * Math.abs(phase - 0.5) - 1;
        default: return Math.sin(phase * 2 * Math.PI);
    }
};

/**
 * Renders events to mono samples in [-1, 1].
 */
export const renderEvents = (events: ToneEvent[], duration: number, rate = SAMPLE_RATE): Float32Array => {
    const total = Math.ceil(duration * rate);
    const out = new Float32Array(total);
    let noiseState = 0x7001;
    for (const ev of events) {
        const start = Math.floor(ev.t * rate);
        const len = Math.min(total - start, Math.floor(ev.dur * rate));
        if (len <= 0) {
            continue;
        }
        const decay = ev.decay ?? 0.3;
        const attack = Math.min(len, Math.floor(rate * 0.004));
        const decayStart = Math.floor(len * (1 - decay));
        let phase = 0;
        let noiseValue = 1;
        let noiseCounter = 0;
        for (let i = 0; i < len; i++) {
            const progress = i / len;
            let freq = ev.freqEnd !== undefined ? ev.freq + (ev.freqEnd - ev.freq) * progress : ev.freq;
            if (ev.vibrato) {
                freq *= 2 ** (ev.vibrato * Math.sin(i / rate * 2 * Math.PI * 6) / 12);
            }
            let s: number;
            if (ev.wave === 'noise') {
                noiseCounter += freq / rate;
                if (noiseCounter >= 1) {
                    noiseCounter -= 1;
                    // 15-bit LFSR, like a console noise channel
                    const bit = (noiseState ^ noiseState >> 1) & 1;
                    noiseState = noiseState >> 1 | bit << 14;
                    noiseValue = noiseState & 1 ? 1 : -1;
                }
                s = noiseValue;
            } else {
                phase = (phase + freq / rate) % 1;
                s = sampleWave(ev.wave, phase);
            }
            let env = 1;
            if (i < attack) {
                env = i / attack;
            } else if (i >= decayStart) {
                env = 1 - (i - decayStart) / Math.max(1, len - decayStart);
            }
            out[start + i] += s * env * ev.vol;
        }
    }
    // Soft clip so stacked channels never distort harshly
    for (let i = 0; i < total; i++) {
        out[i] = Math.tanh(out[i] * 1.2) * 0.9;
    }
    return out;
};

/**
 * Encodes mono samples as a 16-bit PCM WAV file.
 */
export const encodeWav = (samples: Float32Array, rate = SAMPLE_RATE): ArrayBuffer => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeString = (offset: number, text: string) => {
        for (let i = 0; i < text.length; i++) {
            view.setUint8(offset + i, text.charCodeAt(i));
        }
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
        view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 0x7fff), true);
    }
    return buffer;
};

// ---------------------------------------------------------------------------
// Music composition

const MODES = {
    major: [ 0, 2, 4, 5, 7, 9, 11 ],
    minor: [ 0, 2, 3, 5, 7, 8, 10 ],
    dorian: [ 0, 2, 3, 5, 7, 9, 10 ],
    mixolydian: [ 0, 2, 4, 5, 7, 9, 10 ],
    phrygian: [ 0, 1, 3, 5, 7, 8, 10 ],
    harmonic: [ 0, 2, 3, 5, 7, 8, 11 ],
};

export interface TrackSpec {
    seed: number;
    bpm: number;
    /** MIDI note of the key's root (e.g. 60 = middle C). */
    root: number;
    mode: keyof typeof MODES;
    /** Chord roots as scale degrees (0-6), one per bar, repeated to fill the track. */
    progression: number[];
    bars: number;
    lead: Wave;
    drums: 'none' | 'march' | 'rock' | 'driving' | 'gentle';
    /** Arpeggio speed in notes per beat (0 = off). */
    arp: number;
    /** Notes per beat in the melody's busiest rhythm. */
    density: number;
    leadVol?: number;
}

/** Scale degree (may exceed 6 or go negative) to MIDI. */
const degreeToMidi = (spec: TrackSpec, degree: number): number => {
    const scale = MODES[spec.mode];
    const octave = Math.floor(degree / scale.length);
    const idx = (degree % scale.length + scale.length) % scale.length;
    return spec.root + octave * 12 + scale[idx];
};

const RHYTHMS: number[][] = [
    [ 1, 1, 1, 1 ], [ 1.5, 0.5, 1, 1 ], [ 0.5, 0.5, 1, 2 ], [ 1, 0.5, 0.5, 2 ],
    [ 2, 1, 1 ], [ 0.5, 0.5, 0.5, 0.5, 1, 1 ], [ 3, 1 ], [ 1, 1, 2 ],
];

interface MelodyNote {
    beat: number;
    len: number;
    degree: number;
}

/**
 * Composes a track: melody in A A' B A form, arpeggiated harmony, bass and drums.
 */
export const composeTrack = (spec: TrackSpec): { events: ToneEvent[]; duration: number } => {
    const rnd = seededRng(spec.seed);
    const beat = 60 / spec.bpm;
    const barLen = beat * 4;
    const duration = spec.bars * barLen;
    const events: ToneEvent[] = [];
    const rhythms = RHYTHMS.filter((r) => r.length <= spec.density * 4 + 1);

    const makePhrase = (startDegree: number, chords: number[]): MelodyNote[] => {
        const notes: MelodyNote[] = [];
        let degree = startDegree;
        chords.forEach((chord, bar) => {
            const rhythm = rhythms[Math.floor(rnd() * rhythms.length)];
            let pos = 0;
            rhythm.forEach((len, i) => {
                if (i === 0) {
                    // Strong beats land on the nearest chord tone
                    let best = chord + 7;
                    for (const tone of [ chord, chord + 2, chord + 4 ]) {
                        const cand = tone + 7 * Math.round((degree - tone) / 7);
                        if (Math.abs(cand - degree) < Math.abs(best - degree)) {
                            best = cand;
                        }
                    }
                    degree = best;
                } else {
                    degree += Math.floor(rnd() * 5) - 2;
                }
                degree = Math.max(2, Math.min(13, degree));
                notes.push({ beat: bar * 4 + pos, len, degree });
                pos += len;
            });
        });
        return notes;
    };

    const prog = spec.progression;
    const chordAt = (bar: number) => prog[bar % prog.length];
    const motifA = makePhrase(7, [ chordAt(0), chordAt(1) ]);
    const motifB = makePhrase(9, [ chordAt(2), chordAt(3) ]);

    for (let bar = 0; bar < spec.bars; bar += 2) {
        const section = Math.floor(bar / 2) % 4;
        const motif = section === 2 ? motifB : motifA;
        const transpose = section === 1 ? 1 : 0;
        motif.forEach((note, i) => {
            const t = bar * barLen + note.beat * beat;
            if (t >= duration) {
                return;
            }
            const ending = section === 3 && i === motif.length - 1;
            events.push({
                t, dur: note.len * beat * 0.92,
                freq: midiToFreq(degreeToMidi(spec, ending ? 7 : note.degree + transpose) + 12),
                wave: spec.lead, vol: spec.leadVol ?? 0.22, decay: 0.35, vibrato: note.len >= 2 ? 0.15 : 0,
            });
        });
    }

    const kick = (t: number) => events.push({ t, dur: 0.08, freq: 900, freqEnd: 200, wave: 'noise', vol: 0.22, decay: 0.8 });
    const snare = (t: number) => events.push({ t, dur: 0.1, freq: 7000, wave: 'noise', vol: 0.14, decay: 0.8 });
    const hat = (t: number) => events.push({ t, dur: 0.03, freq: 14000, wave: 'noise', vol: 0.06, decay: 0.9 });

    for (let bar = 0; bar < spec.bars; bar++) {
        const chord = chordAt(bar);
        const t0 = bar * barLen;
        // Bass: root on beats 1 and 3, fifth on 2 and 4
        for (let b = 0; b < 4; b++) {
            const degree = chord + (b % 2 === 1 ? 4 : 0) - 7;
            events.push({ t: t0 + b * beat, dur: beat * 0.85, freq: midiToFreq(degreeToMidi(spec, degree) - 12), wave: 'triangle', vol: 0.32, decay: 0.2 });
        }
        // Arpeggio of chord tones on a thin pulse
        if (spec.arp > 0) {
            const tones = [ chord, chord + 2, chord + 4, chord + 7 ];
            for (let s = 0; s < 4 * spec.arp; s++) {
                events.push({
                    t: t0 + s * beat / spec.arp, dur: beat / spec.arp * 0.8,
                    freq: midiToFreq(degreeToMidi(spec, tones[s % tones.length])), wave: 'pulse12', vol: 0.08, decay: 0.5,
                });
            }
        }
        switch (spec.drums) {
            case 'march':
                kick(t0);
                snare(t0 + beat);
                kick(t0 + beat * 2);
                snare(t0 + beat * 3);
                snare(t0 + beat * 3.5);
                break;
            case 'rock':
                for (let b = 0; b < 8; b++) {
                    hat(t0 + b * beat / 2);
                }
                kick(t0);
                kick(t0 + beat * 2.5);
                snare(t0 + beat);
                snare(t0 + beat * 3);
                break;
            case 'driving':
                for (let b = 0; b < 4; b++) {
                    kick(t0 + b * beat);
                    hat(t0 + b * beat + beat / 2);
                }
                snare(t0 + beat);
                snare(t0 + beat * 3);
                break;
            case 'gentle':
                hat(t0);
                hat(t0 + beat * 2);
                break;
            default:
                break;
        }
    }
    return { events, duration };
};

// ---------------------------------------------------------------------------
// The catalog

export interface SoundDef {
    /** Asset id the game plays it by. */
    id: string;
    name: string;
    kind: 'music' | 'sfx';
    /** Music loops by default; jingles and effects don't. */
    loop: boolean;
    build: () => { events: ToneEvent[]; duration: number };
}

const music = (id: string, name: string, spec: TrackSpec): SoundDef =>
    ({ id, name, kind: 'music', loop: true, build: () => composeTrack(spec) });

const sfx = (id: string, name: string, duration: number, events: ToneEvent[]): SoundDef =>
    ({ id, name, kind: 'sfx', loop: false, build: () => ({ events, duration }) });

const n = midiToFreq;

/** A short non-looping jingle: [midi, beats] notes on a lead, doubled by a triangle bass. */
const jingle = (id: string, name: string, bpm: number, notes: [number, number][], wave: Wave = 'pulse25'): SoundDef => {
    const beat = 60 / bpm;
    return {
        id, name, kind: 'music', loop: false,
        build: () => {
            const events: ToneEvent[] = [];
            let t = 0;
            for (const [ midi, beats ] of notes) {
                events.push({ t, dur: beats * beat * 0.9, freq: n(midi), wave, vol: 0.25, decay: 0.4, vibrato: beats >= 2 ? 0.2 : 0 });
                events.push({ t, dur: beats * beat * 0.9, freq: n(midi - 24), wave: 'triangle', vol: 0.25, decay: 0.3 });
                t += beats * beat;
            }
            return { events, duration: t + 0.3 };
        },
    };
};

/** Evenly spaced notes, for arpeggio-like effects. */
const run = (notes: number[], step: number, len: number, wave: Wave, vol: number, decay = 0.5): ToneEvent[] =>
    notes.map((midi, i) => ({ t: i * step, dur: len, freq: n(midi), wave, vol, decay }));

export const SOUNDS: SoundDef[] = [
    // --- 16 music tracks ---
    music('MUSIC_TITLE_SCREEN', 'Souldcrest Overture', { seed: 101, bpm: 96, root: 62, mode: 'major', progression: [ 0, 4, 5, 3, 0, 4, 3, 4 ], bars: 16, lead: 'pulse50', drums: 'march', arp: 2, density: 1 }),
    music('MUSIC_TANTEGEL', 'Halls of Tantegel', { seed: 202, bpm: 88, root: 60, mode: 'major', progression: [ 0, 3, 4, 0, 5, 3, 1, 4 ], bars: 16, lead: 'pulse25', drums: 'none', arp: 2, density: 1 }),
    music('MUSIC_TANTEGEL_LOWER', 'Castle Undercroft', { seed: 203, bpm: 80, root: 57, mode: 'dorian', progression: [ 0, 3, 0, 4 ], bars: 16, lead: 'pulse25', drums: 'none', arp: 1, density: 1 }),
    music('MUSIC_TOWN', 'Hearth and Market', { seed: 303, bpm: 112, root: 65, mode: 'major', progression: [ 0, 5, 3, 4 ], bars: 16, lead: 'pulse50', drums: 'gentle', arp: 2, density: 1.5 }),
    music('MUSIC_OVERWORLD', 'Roads of the Realm', { seed: 404, bpm: 120, root: 62, mode: 'mixolydian', progression: [ 0, 6, 3, 0, 4, 6, 3, 4 ], bars: 16, lead: 'pulse50', drums: 'rock', arp: 2, density: 1.5 }),
    music('MUSIC_DUNGEON_FLOOR_1', 'Echoes Below', { seed: 505, bpm: 72, root: 57, mode: 'phrygian', progression: [ 0, 1, 0, 6 ], bars: 16, lead: 'pulse12', drums: 'none', arp: 1, density: 0.5, leadVol: 0.18 }),
    music('MUSIC_BATTLE', 'Clash of Steel', { seed: 606, bpm: 152, root: 57, mode: 'minor', progression: [ 0, 5, 6, 4 ], bars: 8, lead: 'pulse50', drums: 'driving', arp: 4, density: 2 }),
    music('MUSIC_BOSS', 'Wrath of the Storm Drake', { seed: 707, bpm: 160, root: 52, mode: 'harmonic', progression: [ 0, 5, 1, 4 ], bars: 8, lead: 'pulse25', drums: 'driving', arp: 4, density: 2 }),
    jingle('victory', 'Victory Fanfare', 150, [ [ 72, 0.5 ], [ 72, 0.5 ], [ 72, 0.5 ], [ 72, 1.5 ], [ 68, 1 ], [ 70, 1 ], [ 72, 0.67 ], [ 70, 0.33 ], [ 72, 3 ] ]),
    jingle('dead', 'The Light Fades', 70, [ [ 67, 1 ], [ 63, 1 ], [ 62, 1 ], [ 60, 2 ], [ 59, 1 ], [ 55, 3 ] ], 'triangle'),
    jingle('overnight', 'Rest at the Inn', 90, [ [ 72, 1 ], [ 76, 1 ], [ 79, 1 ], [ 84, 2 ], [ 79, 0.5 ], [ 84, 2.5 ] ], 'pulse12'),
    jingle('levelUp', 'Level Up', 180, [ [ 72, 0.5 ], [ 76, 0.5 ], [ 79, 0.5 ], [ 84, 0.5 ], [ 79, 0.5 ], [ 84, 2 ] ]),
    music('MUSIC_STORY', 'Legend of the Souldcrest', { seed: 808, bpm: 76, root: 60, mode: 'minor', progression: [ 0, 5, 2, 6 ], bars: 16, lead: 'pulse25', drums: 'gentle', arp: 2, density: 1 }),
    music('MUSIC_EVENT', 'The Rift Opens', { seed: 909, bpm: 138, root: 59, mode: 'dorian', progression: [ 0, 3, 6, 4 ], bars: 8, lead: 'pulse50', drums: 'rock', arp: 4, density: 2 }),
    music('MUSIC_RAID', 'March of the Many', { seed: 1010, bpm: 128, root: 55, mode: 'minor', progression: [ 0, 6, 5, 4 ], bars: 16, lead: 'pulse50', drums: 'march', arp: 2, density: 1.5 }),
    music('MUSIC_FINALE', 'Stormfire', { seed: 1111, bpm: 168, root: 50, mode: 'harmonic', progression: [ 0, 1, 5, 4, 0, 6, 5, 4 ], bars: 16, lead: 'pulse25', drums: 'driving', arp: 4, density: 2 }),

    // --- 32 sound effects ---
    sfx('menu', 'Menu Cursor', 0.06, [ { t: 0, dur: 0.05, freq: n(84), wave: 'pulse25', vol: 0.25, decay: 0.6 } ]),
    sfx('confirmation', 'Confirm', 0.16, run([ 79, 86 ], 0.07, 0.07, 'pulse25', 0.25)),
    sfx('cancel', 'Cancel', 0.14, run([ 79, 72 ], 0.07, 0.06, 'pulse25', 0.22)),
    sfx('talk', 'Text Blip', 0.03, [ { t: 0, dur: 0.025, freq: n(91), wave: 'pulse12', vol: 0.12, decay: 0.5 } ]),
    sfx('attack', 'Swing', 0.18, [ { t: 0, dur: 0.16, freq: 3000, freqEnd: 600, wave: 'noise', vol: 0.3, decay: 0.7 } ]),
    sfx('hit', 'Hit', 0.14, [ { t: 0, dur: 0.12, freq: 2200, freqEnd: 300, wave: 'noise', vol: 0.4, decay: 0.8 }, { t: 0, dur: 0.06, freq: n(48), wave: 'pulse50', vol: 0.2 } ]),
    sfx('excellentMove', 'Critical Hit', 0.4, [ { t: 0, dur: 0.1, freq: n(84), freqEnd: n(96), wave: 'pulse25', vol: 0.25 }, { t: 0.1, dur: 0.25, freq: 3000, freqEnd: 200, wave: 'noise', vol: 0.4, decay: 0.8 } ]),
    sfx('missed1', 'Miss', 0.2, [ { t: 0, dur: 0.18, freq: 6000, freqEnd: 9000, wave: 'noise', vol: 0.15, decay: 0.9 } ]),
    sfx('missed2', 'Dodge', 0.25, [ { t: 0, dur: 0.2, freq: n(76), freqEnd: n(88), wave: 'pulse12', vol: 0.2, decay: 0.6 } ]),
    sfx('receiveDamage', 'Take Damage', 0.35, [ { t: 0, dur: 0.3, freq: n(60), freqEnd: n(36), wave: 'pulse50', vol: 0.3, decay: 0.6 }, { t: 0, dur: 0.2, freq: 1500, wave: 'noise', vol: 0.25, decay: 0.8 } ]),
    sfx('prepareToAttack', 'Enemy Readies', 0.3, run([ 55, 58 ], 0.14, 0.13, 'pulse25', 0.22, 0.3)),
    sfx('castSpell', 'Cast Spell', 0.6, run([ 72, 75, 78, 81, 84, 87 ], 0.08, 0.12, 'pulse12', 0.2)),
    sfx('heal', 'Healing Light', 0.75, run([ 79, 83, 86, 91 ], 0.12, 0.3, 'triangle', 0.3, 0.6)),
    sfx('breatheFire', 'Fire Breath', 0.9, [ { t: 0, dur: 0.85, freq: 1200, freqEnd: 4000, wave: 'noise', vol: 0.35, decay: 0.4 } ]),
    sfx('lightning', 'Lightning Strike', 0.9, [ { t: 0, dur: 0.15, freq: 12000, wave: 'noise', vol: 0.45, decay: 0.5 }, { t: 0.1, dur: 0.75, freq: 900, freqEnd: 120, wave: 'noise', vol: 0.4, decay: 0.8 } ]),
    sfx('ice', 'Frost', 0.5, run([ 96, 94, 92, 90, 88 ], 0.06, 0.1, 'pulse12', 0.15, 0.7)),
    sfx('door', 'Open Door', 0.4, [ { t: 0, dur: 0.15, freq: n(40), wave: 'pulse50', vol: 0.25 }, { t: 0.12, dur: 0.25, freq: 500, freqEnd: 200, wave: 'noise', vol: 0.2, decay: 0.7 } ]),
    sfx('openChest', 'Open Treasure', 0.7, run([ 72, 76, 79, 84 ], 0.1, 0.18, 'pulse25', 0.25, 0.4)),
    sfx('stairs', 'Stairs Down', 0.5, run([ 72, 70, 68, 66, 64, 62 ], 0.07, 0.06, 'pulse25', 0.2, 0.3)),
    sfx('stairsUp', 'Stairs Up', 0.5, run([ 62, 64, 66, 68, 70, 72 ], 0.07, 0.06, 'pulse25', 0.2, 0.3)),
    sfx('run', 'Flee', 0.5, run([ 79, 74, 79, 74, 79, 74, 79, 74 ], 0.05, 0.04, 'pulse12', 0.2, 0.3)),
    sfx('bump', 'Bump Wall', 0.1, [ { t: 0, dur: 0.08, freq: n(36), wave: 'pulse50', vol: 0.3, decay: 0.7 } ]),
    sfx('step', 'Footstep', 0.05, [ { t: 0, dur: 0.04, freq: 800, wave: 'noise', vol: 0.08, decay: 0.9 } ]),
    sfx('gold', 'Coins', 0.3, run([ 88, 95 ], 0.08, 0.15, 'pulse25', 0.2, 0.7)),
    sfx('itemGet', 'Item Get', 0.45, run([ 76, 81, 88 ], 0.1, 0.15, 'pulse50', 0.22, 0.4)),
    sfx('equip', 'Equip', 0.2, [ { t: 0, dur: 0.05, freq: 5000, wave: 'noise', vol: 0.2, decay: 0.9 }, { t: 0.05, dur: 0.12, freq: n(67), wave: 'pulse25', vol: 0.2 } ]),
    sfx('upgradeSuccess', 'Upgrade Success', 0.8, run([ 72, 76, 80, 84, 88 ], 0.09, 0.2, 'pulse25', 0.22)),
    sfx('upgradeFail', 'Upgrade Fail', 0.6, [ { t: 0, dur: 0.5, freq: n(60), freqEnd: n(40), wave: 'pulse50', vol: 0.25, decay: 0.5 } ]),
    sfx('achievement', 'Achievement', 0.9, run([ 79, 83, 86, 91 ], 0.12, 0.4, 'pulse12', 0.2, 0.6)),
    sfx('discovery', 'Secret Found', 0.9, run([ 79, 78, 75, 69, 68, 76 ], 0.1, 0.15, 'pulse25', 0.2, 0.3)),
    sfx('save', 'Save Game', 0.5, run([ 76, 83 ], 0.12, 0.28, 'triangle', 0.3, 0.6)),
    sfx('error', 'Error', 0.25, run([ 45, 45 ], 0.12, 0.1, 'pulse50', 0.25, 0.3)),
];

export const MUSIC_COUNT = SOUNDS.filter((s) => s.kind === 'music').length;
export const SFX_COUNT = SOUNDS.filter((s) => s.kind === 'sfx').length;

export const getSound = (id: string): SoundDef | undefined => SOUNDS.find((s) => s.id === id);

/** Renders a catalog sound to WAV bytes. */
export const renderSound = (def: SoundDef): ArrayBuffer => {
    const { events, duration } = def.build();
    return encodeWav(renderEvents(events, duration));
};
