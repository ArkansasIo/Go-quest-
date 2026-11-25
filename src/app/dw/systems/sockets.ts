/**
 * Gems (docs/GEMS_AND_SOCKETS.md) and runes (docs/RUNES_AND_FORGE.md). Both are nine
 * families with nine tiers each, socketed into weapons and armour, fusable 3 -> 1.
 * Gem and rune sockets are stored separately so both systems coexist on an item.
 */
import { StatMods, SubstatKey, addMods } from './stats';

export type SocketKind = 'gem' | 'rune';

export interface SocketFamily {
    id: string;
    name: string;
    stat: SubstatKey;
    /** Modifier value at tier 1; scales linearly with tier. */
    perTier: number;
}

export const GEM_FAMILIES: SocketFamily[] = [
    { id: 'ruby', name: 'RUBY', stat: 'dmg', perTier: 1 },
    { id: 'sapphire', name: 'SAPPHIRE', stat: 'resist', perTier: 1 },
    { id: 'emerald', name: 'EMERALD', stat: 'hit', perTier: 1 },
    { id: 'amethyst', name: 'AMETHYST', stat: 'hp', perTier: 5 },
    { id: 'topaz', name: 'TOPAZ', stat: 'haste', perTier: 1 },
    { id: 'diamond', name: 'DIAMOND', stat: 'saves', perTier: 1 },
    { id: 'onyx', name: 'ONYX', stat: 'crit', perTier: 1 },
    { id: 'opal', name: 'OPAL', stat: 'mf', perTier: 1 },
    { id: 'garnet', name: 'GARNET', stat: 'leech', perTier: 1 },
];

export const RUNE_FAMILIES: SocketFamily[] = [
    { id: 'flame', name: 'FLAME', stat: 'fire', perTier: 2 },
    { id: 'frost', name: 'FROST', stat: 'cold', perTier: 2 },
    { id: 'storm', name: 'STORM', stat: 'lightning', perTier: 2 },
    { id: 'ward', name: 'WARD', stat: 'resist', perTier: 1 },
    { id: 'vigor', name: 'VIGOR', stat: 'hp', perTier: 5 },
    { id: 'might', name: 'MIGHT', stat: 'dmg', perTier: 2 },
    { id: 'precision', name: 'PRECISION', stat: 'hit', perTier: 1 },
    { id: 'shadow', name: 'SHADOW', stat: 'crit', perTier: 1 },
    { id: 'leech', name: 'LEECH', stat: 'leech', perTier: 1 },
];

export const MAX_TIER = 9;
export const MAX_GEM_SOCKETS = 4;
export const MAX_RUNE_SOCKETS = 3;

const families = (kind: SocketKind) => kind === 'gem' ? GEM_FAMILIES : RUNE_FAMILIES;

export interface ParsedSocketable {
    kind: SocketKind;
    family: SocketFamily;
    tier: number;
}

/** Builds an id such as "ruby_t3". */
export const socketableId = (familyId: string, tier: number): string => `${familyId}_t${tier}`;

export const parseSocketable = (id: string): ParsedSocketable | undefined => {
    const match = /^([a-z]+)_t([1-9])$/.exec(id);
    if (!match) {
        return undefined;
    }
    const tier = parseInt(match[2], 10);
    for (const kind of [ 'gem', 'rune' ] as SocketKind[]) {
        const family = families(kind).find((f) => f.id === match[1]);
        if (family) {
            return { kind, family, tier };
        }
    }
    return undefined;
};

export const isValidSocketable = (kind: SocketKind, id: string): boolean => parseSocketable(id)?.kind === kind;

/** All 81 variants of a kind. */
export const allSocketableIds = (kind: SocketKind): string[] => {
    const ids: string[] = [];
    for (const f of families(kind)) {
        for (let t = 1; t <= MAX_TIER; t++) {
            ids.push(socketableId(f.id, t));
        }
    }
    return ids;
};

export const socketableName = (id: string): string => {
    const p = parseSocketable(id);
    return p ? `${p.family.name} T${p.tier}` : id;
};

export const socketableMods = (id: string): StatMods => {
    const p = parseSocketable(id);
    return p ? { [p.family.stat]: p.family.perTier * p.tier } : {};
};

/**
 * Socket capacity by item level. Gems: 1-180 = 1 ... 541-720 = 4. Runes: 1-240 = 1 ... 481-720 = 3.
 */
export const socketCapacity = (kind: SocketKind, itemLevel: number): number => {
    const band = kind === 'gem' ? 180 : 240;
    const max = kind === 'gem' ? MAX_GEM_SOCKETS : MAX_RUNE_SOCKETS;
    return Math.max(1, Math.min(max, Math.ceil(Math.max(1, itemLevel) / band)));
};

/** A socket array; empty sockets are null. */
export type Sockets = (string | null)[];

export const emptySockets = (kind: SocketKind, itemLevel: number): Sockets =>
    new Array<string | null>(socketCapacity(kind, itemLevel)).fill(null);

export type SocketResult = { ok: true; sockets: Sockets; removed?: string } | { ok: false; error: string };

/** Immutable insert. Fails on invalid id, bad index or occupied socket. */
export const insertSocketable = (kind: SocketKind, sockets: Sockets, index: number, id: string): SocketResult => {
    if (!isValidSocketable(kind, id)) {
        return { ok: false, error: `Not a valid ${kind}.` };
    }
    if (index < 0 || index >= sockets.length) {
        return { ok: false, error: 'No such socket.' };
    }
    if (sockets[index]) {
        return { ok: false, error: 'That socket is occupied.' };
    }
    const copy = sockets.slice();
    copy[index] = id;
    return { ok: true, sockets: copy };
};

/** Immutable extract. */
export const extractSocketable = (sockets: Sockets, index: number): SocketResult => {
    if (index < 0 || index >= sockets.length || !sockets[index]) {
        return { ok: false, error: 'That socket is empty.' };
    }
    const copy = sockets.slice();
    const removed = copy[index]!;
    copy[index] = null;
    return { ok: true, sockets: copy, removed };
};

export const socketsMods = (sockets: Sockets): StatMods =>
    addMods(...sockets.filter((s): s is string => !!s).map(socketableMods));

/** Inventory of gems or runes: id -> count. */
export type SocketableBag = Record<string, number>;

export const addToBag = (bag: SocketableBag, id: string, count = 1): void => {
    bag[id] = (bag[id] ?? 0) + count;
};

export const removeFromBag = (bag: SocketableBag, id: string, count = 1): boolean => {
    if ((bag[id] ?? 0) < count) {
        return false;
    }
    bag[id] -= count;
    if (bag[id] === 0) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete bag[id];
    }
    return true;
};

/** Inserts from a bag; consumes the item only when insertion succeeds. */
export const socketFromBag = (kind: SocketKind, bag: SocketableBag, sockets: Sockets, index: number, id: string): SocketResult => {
    if ((bag[id] ?? 0) < 1) {
        return { ok: false, error: `You have no ${socketableName(id)}.` };
    }
    const result = insertSocketable(kind, sockets, index, id);
    if (result.ok) {
        removeFromBag(bag, id);
    }
    return result;
};

/** Extracts back to a bag. */
export const unsocketToBag = (bag: SocketableBag, sockets: Sockets, index: number): SocketResult => {
    const result = extractSocketable(sockets, index);
    if (result.ok && result.removed) {
        addToBag(bag, result.removed);
    }
    return result;
};

/** Three identical tier 1-8 items fuse into one of the next tier. */
export const fuse = (bag: SocketableBag, id: string): { ok: true; created: string } | { ok: false; error: string } => {
    const p = parseSocketable(id);
    if (!p) {
        return { ok: false, error: 'Nothing to fuse.' };
    }
    if (p.tier >= MAX_TIER) {
        return { ok: false, error: 'Already at the highest tier.' };
    }
    if ((bag[id] ?? 0) < 3) {
        return { ok: false, error: 'Fusion needs three identical stones.' };
    }
    removeFromBag(bag, id, 3);
    const created = socketableId(p.family.id, p.tier + 1);
    addToBag(bag, created);
    return { ok: true, created };
};

/** Picks a family/tier appropriate to a monster level. Tier = ceil(level / 80) in the 720 scale. */
export const tierForItemLevel = (itemLevel: number): number =>
    Math.max(1, Math.min(MAX_TIER, Math.ceil(itemLevel / 80)));

export const getFamilies = families;
