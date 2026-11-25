/**
 * The open world atlas: 3 continents, 9 countries, 90 overworld zones (each with 3
 * sub-zones), 9 biomes with sub-biomes, cities and towns, and underground zones with
 * floors. See docs/WORLD_ATLAS.md and docs/WORLD_SCALE_AND_MAPS.md.
 *
 * Overworld zones are laid out on a 9 x 10 grid over the overworld map, so walking the
 * map moves the hero through them. Towns and caves map onto the existing town and cave maps.
 */
import { pick, seededRng } from './rng';

export interface BiomeDef {
    id: string;
    name: string;
    subBiomes: string[];
}

export const BIOMES: BiomeDef[] = [
    { id: 'grassland', name: 'GRASSLAND', subBiomes: [ 'Meadow', 'Rolling Hills', 'Wildflower Steppe' ] },
    { id: 'forest', name: 'FOREST', subBiomes: [ 'Old Growth', 'Pine Wood', 'Mossy Glade' ] },
    { id: 'swamp', name: 'SWAMP', subBiomes: [ 'Fen', 'Bog', 'Mangrove' ] },
    { id: 'desert', name: 'DESERT', subBiomes: [ 'Dune Sea', 'Salt Flat', 'Red Mesa' ] },
    { id: 'mountain', name: 'MOUNTAIN', subBiomes: [ 'Foothills', 'High Pass', 'Glacier' ] },
    { id: 'tundra', name: 'TUNDRA', subBiomes: [ 'Frost Plain', 'Ice Field', 'Taiga' ] },
    { id: 'coast', name: 'COAST', subBiomes: [ 'Beach', 'Cliffs', 'Reef' ] },
    { id: 'volcanic', name: 'VOLCANIC', subBiomes: [ 'Ash Waste', 'Lava Field', 'Cinder Cone' ] },
    { id: 'blight', name: 'BLIGHT', subBiomes: [ 'Dead Wood', 'Shadow Moor', 'Crystal Scar' ] },
];

export interface ContinentDef {
    id: string;
    name: string;
}

export const CONTINENTS: ContinentDef[] = [
    { id: 'alefgard', name: 'ALEFGARD' },
    { id: 'rhone', name: 'RHONE' },
    { id: 'charlock', name: 'CHARLOCK REACH' },
];

export interface CountryDef {
    id: string;
    name: string;
    continent: string;
    capital: string;
}

export const COUNTRIES: CountryDef[] = [
    { id: 'tantegel', name: 'KINGDOM OF TANTEGEL', continent: 'alefgard', capital: 'Tantegel' },
    { id: 'brecconia', name: 'BRECCONIA', continent: 'alefgard', capital: 'Brecconary' },
    { id: 'garinlands', name: 'GARIN LANDS', continent: 'alefgard', capital: 'Garinham' },
    { id: 'kolheim', name: 'KOLHEIM', continent: 'rhone', capital: 'Kol' },
    { id: 'rimuldar', name: 'RIMULDAR MARCH', continent: 'rhone', capital: 'Rimuldar' },
    { id: 'cantlin', name: 'CANTLIN FREEHOLD', continent: 'rhone', capital: 'Cantlin' },
    { id: 'hauksness', name: 'HAUKSNESS RUIN', continent: 'charlock', capital: 'Hauksness' },
    { id: 'emberwaste', name: 'EMBERWASTE', continent: 'charlock', capital: 'Cinderhold' },
    { id: 'duskmoor', name: 'DUSKMOOR', continent: 'charlock', capital: 'Gloamspire' },
];

export type SettlementKind = 'capital' | 'city' | 'town' | 'village';

export interface SettlementDef {
    id: string;
    name: string;
    kind: SettlementKind;
    country: string;
    /** Map file for settlements that exist as playable maps. */
    map?: string;
    services: string[];
}

const SERVICES: Record<SettlementKind, string[]> = {
    capital: [ 'INN', 'SHOP', 'SMITH', 'TRAINERS', 'STABLE', 'COMPANION BOARD', 'BANK' ],
    city: [ 'INN', 'SHOP', 'SMITH', 'TRAINERS', 'COMPANION BOARD' ],
    town: [ 'INN', 'SHOP', 'TRAINERS' ],
    village: [ 'INN', 'TRAINER' ],
};

const TOWN_NAMES = [ 'Ashford', 'Briarwick', 'Coldwater', 'Dunmere', 'Elmstead', 'Foxhollow', 'Greyharbor', 'Hearthvale',
    'Ironbridge', 'Juniper', 'Kingsrest', 'Larkspur', 'Millbrook', 'Northwatch', 'Oakenshaw', 'Pebblecross', 'Quarry End',
    'Ravenhold', 'Stonehaven', 'Thornbury', 'Umberfield', 'Valewood', 'Westmarch', 'Yarrowby', 'Zephyr Point', 'Amberlee', 'Bramblegate' ];

const MAPPED: Record<string, string> = {
    Tantegel: 'tantegelCastle', Brecconary: 'brecconary', Garinham: 'garinham', Kol: 'kol',
};

const buildSettlements = (): SettlementDef[] => {
    const list: SettlementDef[] = [];
    COUNTRIES.forEach((country, ci) => {
        list.push({
            id: country.capital.toLowerCase(), name: country.capital, kind: 'capital', country: country.id,
            map: MAPPED[country.capital], services: SERVICES.capital,
        });
        for (let t = 0; t < 3; t++) {
            const name = TOWN_NAMES[ci * 3 + t];
            const kind: SettlementKind = t === 0 ? 'city' : t === 1 ? 'town' : 'village';
            list.push({ id: name.toLowerCase().replace(/ /g, '_'), name, kind, country: country.id, services: SERVICES[kind] });
        }
    });
    return list;
};

/** 9 capitals, 9 cities, 9 towns and 9 villages. */
export const SETTLEMENTS: SettlementDef[] = buildSettlements();

export interface SubZoneDef {
    id: string;
    name: string;
    subBiome: string;
}

export interface ZoneDef {
    id: string;
    index: number;
    name: string;
    country: string;
    biome: string;
    /** Level band on the 1-720 content scale. */
    minLevel: number;
    maxLevel: number;
    subZones: SubZoneDef[];
    /** Grid cell on the overworld. */
    gridRow: number;
    gridCol: number;
}

export const ZONE_GRID_ROWS = 9;
export const ZONE_GRID_COLS = 10;
export const ZONE_COUNT = ZONE_GRID_ROWS * ZONE_GRID_COLS;

const ZONE_FIRST = [ 'Whisper', 'Gold', 'Raven', 'Silver', 'Thorn', 'Ember', 'Frost', 'Storm', 'Moon', 'Sun', 'Iron', 'Ash',
    'Mist', 'Stone', 'Wolf', 'Dragon', 'Hollow', 'Bright', 'Gloom', 'Wild' ];
const ZONE_LAST: Record<string, string[]> = {
    grassland: [ 'field', 'meadows', 'downs', 'plains' ],
    forest: [ 'wood', 'weald', 'grove', 'thicket' ],
    swamp: [ 'mire', 'fen', 'marsh', 'bog' ],
    desert: [ 'sands', 'wastes', 'dunes', 'barrens' ],
    mountain: [ 'peaks', 'crags', 'heights', 'spine' ],
    tundra: [ 'reach', 'frostlands', 'expanse', 'tundra' ],
    coast: [ 'shore', 'strand', 'cove', 'coast' ],
    volcanic: [ 'caldera', 'cinders', 'forge', 'scorch' ],
    blight: [ 'blight', 'scar', 'gloom', 'deadlands' ],
};
const SUB_PARTS = [ 'Northern', 'Central', 'Southern' ];

/** Biome by grid position: coasts on the edges, harsher lands in the far rows. */
const biomeFor = (row: number, col: number, rng: () => number): string => {
    if (col === 0 || col === ZONE_GRID_COLS - 1) {
        return rng() < 0.6 ? 'coast' : 'grassland';
    }
    const bands = [
        [ 'grassland', 'forest', 'grassland' ], [ 'forest', 'grassland', 'swamp' ], [ 'swamp', 'forest', 'mountain' ],
        [ 'mountain', 'tundra', 'forest' ], [ 'desert', 'grassland', 'mountain' ], [ 'desert', 'volcanic', 'swamp' ],
        [ 'tundra', 'mountain', 'volcanic' ], [ 'volcanic', 'blight', 'desert' ], [ 'blight', 'volcanic', 'blight' ],
    ];
    return pick(rng, bands[row]);
};

const buildZones = (): ZoneDef[] => {
    const rng = seededRng(9090);
    const zones: ZoneDef[] = [];
    const used = new Set<string>();
    for (let row = 0; row < ZONE_GRID_ROWS; row++) {
        for (let col = 0; col < ZONE_GRID_COLS; col++) {
            const index = row * ZONE_GRID_COLS + col;
            const biome = biomeFor(row, col, rng);
            let name = '';
            for (let tries = 0; tries < 50 && (!name || used.has(name)); tries++) {
                name = `${pick(rng, ZONE_FIRST)}${pick(rng, ZONE_LAST[biome])}`;
            }
            used.add(name);
            // Countries: 3 grid rows each, split into column thirds
            const country = COUNTRIES[Math.floor(row / 3) * 3 + Math.min(2, Math.floor(col / 3.34))];
            // Levels rise with distance from Tantegel (top-left)
            const distance = (row + col) / (ZONE_GRID_ROWS + ZONE_GRID_COLS - 2);
            const minLevel = Math.max(1, Math.round(distance ** 1.3 * 700));
            const biomeDef = BIOMES.find((b) => b.id === biome)!;
            zones.push({
                id: `zone_${index}`,
                index,
                name: name.toUpperCase(),
                country: country.id,
                biome,
                minLevel,
                maxLevel: Math.min(720, minLevel + 20),
                gridRow: row,
                gridCol: col,
                subZones: SUB_PARTS.map((part, i) => ({
                    id: `zone_${index}_${i}`,
                    name: `${part} ${name}`.toUpperCase(),
                    subBiome: biomeDef.subBiomes[i],
                })),
            });
        }
    }
    return zones;
};

export const ZONES: ZoneDef[] = buildZones();

export const getZone = (id: string): ZoneDef | undefined => ZONES.find((z) => z.id === id);

/**
 * Finds the overworld zone and sub-zone at a map position.
 */
export const zoneAt = (row: number, col: number, mapRows: number, mapCols: number): { zone: ZoneDef; subZone: SubZoneDef } => {
    const gridRow = Math.min(ZONE_GRID_ROWS - 1, Math.max(0, Math.floor(row / mapRows * ZONE_GRID_ROWS)));
    const gridCol = Math.min(ZONE_GRID_COLS - 1, Math.max(0, Math.floor(col / mapCols * ZONE_GRID_COLS)));
    const zone = ZONES[gridRow * ZONE_GRID_COLS + gridCol];
    const cellHeight = mapRows / ZONE_GRID_ROWS;
    const within = row - gridRow * cellHeight;
    const sub = Math.min(2, Math.max(0, Math.floor(within / cellHeight * 3)));
    return { zone, subZone: zone.subZones[sub] };
};

export type UndergroundKind = 'cave' | 'crypt' | 'mine' | 'catacomb' | 'abyss';

export interface UndergroundDef {
    id: string;
    name: string;
    kind: UndergroundKind;
    country: string;
    minLevel: number;
    floors: string[];
    /** Playable cave map, if any. */
    map?: string;
}

const UNDER_KINDS: UndergroundKind[] = [ 'cave', 'crypt', 'mine', 'catacomb', 'abyss' ];
const UNDER_NAMES = [ 'Gloomhollow', 'Ashen Barrow', 'Deepdelve', 'Sunken Vault', 'Wyrmden', 'Echo Grotto', 'Bonepit',
    'Silverseam', 'Lost Halls', 'Black Root' ];

const buildUnderground = (): UndergroundDef[] => {
    const rng = seededRng(3030);
    const list: UndergroundDef[] = [
        { id: 'erdricks_cave', name: 'ERDRICK\'S CAVE', kind: 'cave', country: 'tantegel', minLevel: 4, floors: [ 'B1', 'B2' ], map: 'erdricksCave1' },
    ];
    COUNTRIES.forEach((country, ci) => {
        const count = ci === 0 ? 2 : 3;
        for (let i = 0; i < count; i++) {
            const kind = pick(rng, UNDER_KINDS);
            const name = `${pick(rng, UNDER_NAMES)} ${kind}`.toUpperCase();
            const floors = Math.max(2, Math.round(2 + ci / 2 + rng() * 3));
            list.push({
                id: `under_${ci}_${i}`, name, kind, country: country.id,
                minLevel: Math.round(10 + ci * 75 + i * 20),
                floors: Array.from({ length: floors }, (unused, f) => `B${f + 1}`),
            });
        }
    });
    return list;
};

/** 27 underground zones, each with floors (sub-zones). */
export const UNDERGROUND: UndergroundDef[] = buildUnderground();

/** Which underground zone a playable cave map belongs to. */
export const UNDERGROUND_BY_MAP: Record<string, string> = { erdricksCave1: 'erdricks_cave', erdricksCave2: 'erdricks_cave' };

export const SETTLEMENT_BY_MAP: Record<string, string> = {
    ...Object.fromEntries(SETTLEMENTS.filter((s) => s.map).map((s) => [ s.map!, s.id ])),
    tantegelCastleUpstairs: 'tantegel',
};

export const getCountry = (id: string): CountryDef | undefined => COUNTRIES.find((c) => c.id === id);
export const getContinent = (id: string): ContinentDef | undefined => CONTINENTS.find((c) => c.id === id);
export const getBiome = (id: string): BiomeDef | undefined => BIOMES.find((b) => b.id === id);

/**
 * A short "where am I" label for any map position, and a stable id for tracking visits.
 */
export const describeLocation = (mapName: string, row: number, col: number, mapRows: number, mapCols: number): { id: string; label: string } => {
    if (mapName === 'overworld') {
        const { zone, subZone } = zoneAt(row, col, mapRows, mapCols);
        return { id: subZone.id, label: `${subZone.name} (${getBiome(zone.biome)?.name ?? ''})` };
    }
    const settlementId = SETTLEMENT_BY_MAP[mapName];
    if (settlementId) {
        const s = SETTLEMENTS.find((x) => x.id === settlementId)!;
        return { id: s.id, label: `${s.name.toUpperCase()} - ${s.kind.toUpperCase()}` };
    }
    const underId = UNDERGROUND_BY_MAP[mapName];
    if (underId) {
        const u = UNDERGROUND.find((x) => x.id === underId)!;
        const floor = mapName.endsWith('2') ? 'B2' : 'B1';
        return { id: `${u.id}_${floor}`, label: `${u.name} ${floor}` };
    }
    return { id: mapName, label: mapName.toUpperCase() };
};
