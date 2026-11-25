/**
 * 18 professions, 90 raw materials, perk trees and tiered crafting recipes.
 * See docs/PROFESSIONS_AND_COMPANIONS.md.
 */
import { Rng, chance, rollInt } from './rng';

export type ProfessionKind = 'gathering' | 'crafting';

export interface ProfessionDef {
    id: string;
    name: string;
    kind: ProfessionKind;
    /** Material family gathered (gathering professions). */
    family?: MaterialFamily;
}

export type MaterialFamily = 'HERB' | 'ORE' | 'WOOD' | 'HIDE' | 'FISH' | 'SALVAGE' | 'RELIC' | 'FIBER' | 'BEAST';

export const PROFESSIONS: ProfessionDef[] = [
    { id: 'herbalism', name: 'HERBALISM', kind: 'gathering', family: 'HERB' },
    { id: 'mining', name: 'ORE MINING', kind: 'gathering', family: 'ORE' },
    { id: 'forestry', name: 'FORESTRY', kind: 'gathering', family: 'WOOD' },
    { id: 'hidecraft', name: 'HIDECRAFT', kind: 'gathering', family: 'HIDE' },
    { id: 'fishing', name: 'FISHING', kind: 'gathering', family: 'FISH' },
    { id: 'salvaging', name: 'SALVAGING', kind: 'gathering', family: 'SALVAGE' },
    { id: 'relicsurvey', name: 'RELIC SURVEY', kind: 'gathering', family: 'RELIC' },
    { id: 'cultivation', name: 'CULTIVATION', kind: 'gathering', family: 'FIBER' },
    { id: 'beastlore', name: 'BEAST LORE', kind: 'gathering', family: 'BEAST' },
    { id: 'alchemy', name: 'ALCHEMY', kind: 'crafting' },
    { id: 'cooking', name: 'COOKING', kind: 'crafting' },
    { id: 'blacksmithing', name: 'BLACKSMITHING', kind: 'crafting' },
    { id: 'armorsmithing', name: 'ARMORSMITHING', kind: 'crafting' },
    { id: 'weaponsmithing', name: 'WEAPONSMITHING', kind: 'crafting' },
    { id: 'tailoring', name: 'TAILORING', kind: 'crafting' },
    { id: 'leatherwork', name: 'LEATHERWORK', kind: 'crafting' },
    { id: 'jewelcrafting', name: 'JEWELCRAFTING', kind: 'crafting' },
    { id: 'enchanting', name: 'ENCHANTING', kind: 'crafting' },
];

export const getProfession = (id: string): ProfessionDef | undefined => PROFESSIONS.find((p) => p.id === id);

export const MAX_SKILL = 720;

export const MATERIAL_NAMES: Record<MaterialFamily, string[]> = {
    HERB: [ 'Peacebloom', 'Silverleaf', 'Mageroyal', 'Briarthorn', 'Kingsblood', 'Goldthorn', 'Dreamfoil', 'Sungrass', 'Ghost Lily', 'Dawnrose' ],
    ORE: [ 'Iron Ore', 'Copper Ore', 'Silver Ore', 'Gold Ore', 'Mithril Ore', 'Truesilver', 'Moonsilver', 'Starmetal', 'Voidsteel', 'Dawnsteel Ore' ],
    WOOD: [ 'Living Sap', 'Ash Log', 'Oak Log', 'Yew Log', 'Ironwood', 'Silverbark', 'Emberwood', 'Moonwood', 'Elderheart', 'Worldroot' ],
    HIDE: [ 'Thick Hide', 'Rugged Leather', 'Scaled Hide', 'Wolf Pelt', 'Drake Scale', 'Wyvern Hide', 'Shadow Pelt', 'Dragon Scale', 'Titan Hide', 'Seraph Leather' ],
    FISH: [ 'Small Fish', 'River Trout', 'Silver Carp', 'Deep Eel', 'Sunfin', 'Frost Pike', 'Moon Ray', 'Abyss Angler', 'Kraken Ink', 'Lantern Whale Oil' ],
    SALVAGE: [ 'Scrap Iron', 'Bent Nails', 'Old Gears', 'Rusted Plate', 'Broken Blade', 'Knight Crest', 'Golem Core', 'Ancient Cog', 'Arcane Coil', 'Titan Plate' ],
    RELIC: [ 'Relic Fragment', 'Etched Shard', 'Old Coin', 'Sigil Stone', 'Rune Tablet', 'Sealed Urn', 'Star Chart', 'Royal Seal', 'Sun Disc', 'First Lantern Glass' ],
    FIBER: [ 'Field Fiber', 'Linen Flax', 'Wool Tuft', 'Cotton Boll', 'Silk Thread', 'Mageweave', 'Runecloth', 'Moonweave', 'Starsilk', 'Halo Silk' ],
    BEAST: [ 'Bone Dust', 'Slime Gel', 'Bat Wing', 'Scorpion Tail', 'Wolf Fang', 'Wraith Ash', 'Wyvern Claw', 'Demon Horn', 'Golem Heart', 'Dragon Heart' ],
};

/** Gear tier at which each material slot begins. */
export const MATERIAL_TIER_STARTS = [ 1, 3, 6, 8, 11, 13, 16, 18, 21, 23 ];

/** Level at which a gear tier (1-23) begins. Tier 23 begins at level 670. */
export const tierLevel = (tier: number): number => tier <= 1 ? 1 : Math.round((tier - 1) / 22 * 669) + 1;

export const RARITY_GRADES = [ 'Poor', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Exalted', 'Divine' ];

export interface MaterialDef {
    id: string;
    name: string;
    family: MaterialFamily;
    slot: number;
    tier: number;
    level: number;
    grade: string;
}

export const MATERIALS: MaterialDef[] = (Object.keys(MATERIAL_NAMES) as MaterialFamily[]).flatMap((family) =>
    MATERIAL_NAMES[family].map((name, slot) => ({
        id: `${family.toLowerCase()}_${slot}`,
        name,
        family,
        slot,
        tier: MATERIAL_TIER_STARTS[slot],
        level: tierLevel(MATERIAL_TIER_STARTS[slot]),
        grade: RARITY_GRADES[Math.min(8, Math.floor(slot * 0.9))],
    })));

export const getMaterial = (id: string): MaterialDef | undefined => MATERIALS.find((m) => m.id === id);

/** Converts a classic hero level (1-30, then paragon) to the 720 content scale. */
export const contentLevel = (heroLevel: number): number => Math.min(720, heroLevel <= 30 ? heroLevel * 4 : 120 + (heroLevel - 30) * 0.87);

/** The best material slot both the zone level and profession skill allow. */
export const bestMaterialSlot = (zoneLevel: number, skill: number): number => {
    const cap = Math.min(zoneLevel, Math.max(1, skill));
    let slot = 0;
    MATERIALS.filter((m) => m.family === 'HERB').forEach((m) => {
        if (m.level <= cap) {
            slot = m.slot;
        }
    });
    return slot;
};

// Perk trees: 4 tiers x 6 perks. Tier N costs N points and needs a perk in tier N-1.

export type PerkEffect = 'double' | 'rare' | 'xp' | 'gold' | 'pxp' | 'respawn' | 'check' | 'save' | 'extra';

export interface PerkDef {
    id: string;
    name: string;
    tier: number;
    effect: PerkEffect;
    /** Strength of the effect in % chance (or bonus). */
    value: number;
}

const GATHER_PERK_EFFECTS: PerkEffect[] = [ 'double', 'rare', 'xp', 'gold', 'pxp', 'check' ];
const CRAFT_PERK_EFFECTS: PerkEffect[] = [ 'double', 'rare', 'xp', 'save', 'extra', 'pxp' ];
const PERK_NAMES: Record<PerkEffect, string> = {
    double: 'BOUNTY', rare: 'GLIMMER', xp: 'STUDY', gold: 'TRADE', pxp: 'INSIGHT',
    respawn: 'REGROWTH', check: 'KNACK', save: 'THRIFT', extra: 'MASTERWORK',
};

export const perkTree = (kind: ProfessionKind): PerkDef[] => {
    const effects = kind === 'gathering' ? GATHER_PERK_EFFECTS : CRAFT_PERK_EFFECTS;
    const perks: PerkDef[] = [];
    for (let tier = 1; tier <= 4; tier++) {
        effects.forEach((effect) => {
            perks.push({ id: `${effect}_${tier}`, name: `${PERK_NAMES[effect]} ${'I'.repeat(tier)}`, tier, effect, value: tier * 5 });
        });
    }
    return perks;
};

export const PERK_GRID_COST = 60;
export const PERK_RESET_COST_PER_POINT = 100;

/** 1 point at skill 1, then +1 every 36 ranks, up to 21 at skill 720. */
export const perkPointsForSkill = (skill: number): number => skill < 1 ? 0 : Math.min(21, 1 + Math.floor(skill / 36));

export interface ProfessionState {
    skill: number;
    perks: string[];
}

export const createProfessionState = (): ProfessionState => ({ skill: 0, perks: [] });

export const pointsSpent = (perks: string[]): number =>
    perks.reduce((sum, id) => sum + parseInt(id.split('_')[1], 10), 0);

export const canBuyPerk = (state: ProfessionState, kind: ProfessionKind, perkId: string): { ok: boolean; reason?: string } => {
    const perk = perkTree(kind).find((p) => p.id === perkId);
    if (!perk) {
        return { ok: false, reason: 'No such perk.' };
    }
    if (state.perks.includes(perkId)) {
        return { ok: false, reason: 'Already learned.' };
    }
    if (pointsSpent(state.perks) + perk.tier > perkPointsForSkill(state.skill)) {
        return { ok: false, reason: 'Not enough perk points.' };
    }
    if (perk.tier > 1 && !state.perks.some((id) => parseInt(id.split('_')[1], 10) === perk.tier - 1)) {
        return { ok: false, reason: `Needs a tier ${perk.tier - 1} perk first.` };
    }
    return { ok: true };
};

export const buyPerk = (state: ProfessionState, kind: ProfessionKind, perkId: string): boolean => {
    if (!canBuyPerk(state, kind, perkId).ok) {
        return false;
    }
    state.perks.push(perkId);
    return true;
};

/** Refunds every point; returns the gold cost. */
export const resetPerks = (state: ProfessionState): number => {
    const cost = pointsSpent(state.perks) * PERK_RESET_COST_PER_POINT;
    state.perks = [];
    return cost;
};

export const perkValue = (state: ProfessionState, kind: ProfessionKind, effect: PerkEffect): number =>
    perkTree(kind).filter((p) => p.effect === effect && state.perks.includes(p.id)).reduce((s, p) => s + p.value, 0);

/** Skill gain chance falls as skill passes the material's level. */
const skillUpChance = (skill: number, materialLevel: number, bonus: number): number =>
    Math.min(1, Math.max(0.15, 1 - (skill - materialLevel) / 120) + bonus / 100);

export interface GatherResult {
    material: MaterialDef;
    count: number;
    skillUp: boolean;
    rareBonus: boolean;
    heroXp: number;
}

export const gather = (rng: Rng, profId: string, state: ProfessionState, zoneLevel: number): GatherResult | undefined => {
    const prof = getProfession(profId);
    if (prof?.kind !== 'gathering' || !prof.family) {
        return undefined;
    }
    const slot = bestMaterialSlot(zoneLevel, Math.max(state.skill, 1));
    const material = MATERIALS.find((m) => m.family === prof.family && m.slot === slot)!;
    const count = chance(rng, perkValue(state, 'gathering', 'double') / 100) ? 2 : 1;
    const skillUp = state.skill < MAX_SKILL && chance(rng, skillUpChance(state.skill, material.level, perkValue(state, 'gathering', 'xp')));
    if (skillUp) {
        state.skill++;
    }
    return {
        material, count, skillUp,
        rareBonus: chance(rng, 0.03 + perkValue(state, 'gathering', 'rare') / 200),
        heroXp: Math.round((1 + slot) * perkValue(state, 'gathering', 'pxp') / 10),
    };
};

/** What a crafting recipe produces. */
export type RecipeOutput =
    | { type: 'supply'; supply: SupplyId }
    | { type: 'gem' }
    | { type: 'reforge'; slot: 'weapon' | 'armor' | 'shield' };

export interface RecipeDef {
    id: string;
    name: string;
    profession: string;
    tier: number;
    skill: number;
    materials: { id: string; count: number }[];
    output: RecipeOutput;
}

export type SupplyId = 'elixir' | 'feast' | 'bandage' | 'armorKit' | 'runeOil' | 'wardShawl' | 'luckyCharm';

export interface SupplyDef {
    id: SupplyId;
    name: string;
    description: string;
    /** HP restored as % of max HP. */
    healPct?: number;
    /** Buff applied at the start of the next battle. */
    buff?: string;
}

export const SUPPLIES: Record<SupplyId, SupplyDef> = {
    elixir: { id: 'elixir', name: 'ELIXIR', description: 'Restores 50% HP.', healPct: 50 },
    feast: { id: 'feast', name: 'FEAST', description: 'Restores 30% HP; WELL FED next battle.', healPct: 30, buff: 'fed' },
    bandage: { id: 'bandage', name: 'BANDAGE', description: 'Restores 25% HP.', healPct: 25 },
    armorKit: { id: 'armorKit', name: 'ARMOR KIT', description: 'FORTIFIED next battle.', buff: 'fortify' },
    runeOil: { id: 'runeOil', name: 'RUNE OIL', description: 'MIGHTY next battle.', buff: 'might' },
    wardShawl: { id: 'wardShawl', name: 'WARD SHAWL', description: 'WARDED next battle.', buff: 'ac' },
    luckyCharm: { id: 'luckyCharm', name: 'LUCKY CHARM', description: 'FORESIGHT next battle.', buff: 'foresight' },
};

/** Material families used by each crafting profession. */
const RECIPE_FAMILIES: Record<string, [MaterialFamily, MaterialFamily]> = {
    alchemy: [ 'HERB', 'BEAST' ],
    cooking: [ 'FISH', 'HERB' ],
    tailoring: [ 'FIBER', 'HERB' ],
    leatherwork: [ 'HIDE', 'WOOD' ],
    enchanting: [ 'RELIC', 'BEAST' ],
    jewelcrafting: [ 'ORE', 'RELIC' ],
    blacksmithing: [ 'ORE', 'SALVAGE' ],
    armorsmithing: [ 'ORE', 'HIDE' ],
    weaponsmithing: [ 'ORE', 'WOOD' ],
};

const RECIPE_OUTPUTS: Record<string, RecipeOutput> = {
    alchemy: { type: 'supply', supply: 'elixir' },
    cooking: { type: 'supply', supply: 'feast' },
    tailoring: { type: 'supply', supply: 'bandage' },
    leatherwork: { type: 'supply', supply: 'armorKit' },
    enchanting: { type: 'supply', supply: 'runeOil' },
    jewelcrafting: { type: 'gem' },
    blacksmithing: { type: 'reforge', slot: 'shield' },
    armorsmithing: { type: 'reforge', slot: 'armor' },
    weaponsmithing: { type: 'reforge', slot: 'weapon' },
};

/** One blueprint per crafting profession per material slot (90 recipes). */
export const RECIPES: RecipeDef[] = Object.keys(RECIPE_FAMILIES).flatMap((profession) => {
    const [ a, b ] = RECIPE_FAMILIES[profession];
    return MATERIAL_TIER_STARTS.map((tier, slot) => {
        const output = RECIPE_OUTPUTS[profession];
        const label = output.type === 'supply' ? SUPPLIES[output.supply].name :
            output.type === 'gem' ? 'CUT GEM' : `${output.slot.toUpperCase()} REFORGE`;
        return {
            id: `${profession}_${slot}`,
            name: `${label} T${tier}`,
            profession,
            tier,
            skill: tierLevel(tier),
            materials: [ { id: `${a.toLowerCase()}_${slot}`, count: 2 }, { id: `${b.toLowerCase()}_${slot}`, count: 1 } ],
            output,
        };
    });
});

export const recipesFor = (profession: string): RecipeDef[] => RECIPES.filter((r) => r.profession === profession);

export type MaterialBag = Record<string, number>;

export const hasMaterials = (bag: MaterialBag, recipe: RecipeDef): boolean =>
    recipe.materials.every((m) => (bag[m.id] ?? 0) >= m.count);

export interface CraftResult {
    ok: boolean;
    reason?: string;
    count: number;
    skillUp: boolean;
    savedMaterials: boolean;
}

/**
 * Consumes materials (unless saved by a perk) and returns how many outputs to make.
 * The caller creates the actual output.
 */
export const craft = (rng: Rng, recipe: RecipeDef, state: ProfessionState, bag: MaterialBag): CraftResult => {
    if (state.skill < recipe.skill && recipe.skill > 1) {
        return { ok: false, reason: `Needs ${recipe.skill} skill.`, count: 0, skillUp: false, savedMaterials: false };
    }
    if (!hasMaterials(bag, recipe)) {
        return { ok: false, reason: 'Not enough materials.', count: 0, skillUp: false, savedMaterials: false };
    }
    const savedMaterials = chance(rng, perkValue(state, 'crafting', 'save') / 100);
    if (!savedMaterials) {
        for (const m of recipe.materials) {
            bag[m.id] -= m.count;
        }
    }
    let count = 1;
    if (chance(rng, perkValue(state, 'crafting', 'double') / 100)) {
        count++;
    }
    if (chance(rng, perkValue(state, 'crafting', 'extra') / 100)) {
        count++;
    }
    const skillUp = state.skill < MAX_SKILL && chance(rng, skillUpChance(state.skill, recipe.skill, perkValue(state, 'crafting', 'xp')));
    if (skillUp) {
        state.skill += rollInt(rng, 1, 2);
        state.skill = Math.min(MAX_SKILL, state.skill);
    }
    return { ok: true, count, skillUp, savedMaterials };
};

/** Lessons: +3 skill for gold, up to 10 x hero level, capped at 720. */
export const lessonCost = (skill: number): number => 20 + skill * 3;

export const lessonCap = (heroLevel: number): number => Math.min(MAX_SKILL, heroLevel * 10);
