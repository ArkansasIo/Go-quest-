/**
 * The 12-act campaign of SOULDCREST STORMFIRE.
 *
 * The structure follows the adventure-design guidance in the D&D 5th edition rules:
 * four tiers of play (local heroes, heroes of the realm, masters of the realm, masters of
 * the world), three acts per tier, every act opening with a hook, balancing the three
 * pillars (combat, exploration, social interaction), using ability checks against a
 * Difficulty Class, and closing on a climactic encounter.
 *
 * All characters, places and plot are original to this game. Monster types are taken from
 * the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC, available at
 * https://dnd.wizards.com/resources/systems-reference-document and licensed under the
 * Creative Commons Attribution 4.0 International License
 * (https://creativecommons.org/licenses/by/4.0/legalcode).
 */
import { Attribute, AttributeScores, attributeModifier } from './characters';
import { Rng, rollInt } from './rng';

export type Pillar = 'COMBAT' | 'EXPLORATION' | 'SOCIAL';

export interface StoryChapter {
    title: string;
    pillar: Pillar;
    text: string;
}

export interface AbilityCheck {
    /** 5e skill name, for flavour. */
    skill: string;
    ability: Attribute;
    dc: number;
    prompt: string;
    success: string;
    failure: string;
}

export interface StoryAct {
    act: number;
    tier: 1 | 2 | 3 | 4;
    title: string;
    /** Hero level needed to begin the act. */
    level: number;
    hook: string;
    chapters: StoryChapter[];
    npcs: string[];
    /** SRD 5.1 monster types met in this act. */
    monsters: string[];
    check: AbilityCheck;
    villain: string;
    /** Enemy sprite used for the act's climactic battle. */
    bossEnemy: string;
    /** Multipliers on the boss's base stats. */
    bossHp: number;
    bossStr: number;
    finale: string;
    reward: { gold: number; xp: number };
}

/** Tier names, indexed by tier (1-4). */
export const TIER_NAMES: readonly string[] = [
    '', 'LOCAL HEROES', 'HEROES OF THE REALM', 'MASTERS OF THE REALM', 'MASTERS OF THE WORLD',
];

const ch = (title: string, pillar: Pillar, text: string): StoryChapter => ({ title, pillar, text });

export const STORY: StoryAct[] = [
    {
        act: 1, tier: 1, title: 'THE STORM-TOUCHED', level: 1,
        hook: 'Lightning strikes the well in Brecconary and the water glows. Thou alone touched it, and now a crest of light burns on thy palm.',
        chapters: [
            ch('The Glowing Well', 'EXPLORATION', 'Search the old well and find a cracked shard of soulglass humming with stormlight.'),
            ch('Elder Maren\'s Warning', 'SOCIAL', 'The village elder recognizes the crest: the mark of the Souldcrest, wardens who once sealed away the Stormfire.'),
            ch('Goblins at the Gate', 'COMBAT', 'Goblins and their wolves raid the village, hunting the shard for a master they fear.'),
        ],
        npcs: [ 'Elder Maren Thatch', 'Pell the stablehand' ],
        monsters: [ 'Goblin', 'Wolf', 'Giant Rat' ],
        check: {
            skill: 'Investigation', ability: 'INT', dc: 10,
            prompt: 'Study the soulglass shard for markings.',
            success: 'Tiny runes spell a name: VAELRITH. The goblins\' master.',
            failure: 'The runes swim before thine eyes. Thou must learn the hard way.',
        },
        villain: 'Skrag, goblin boss', bossEnemy: 'Drakee', bossHp: 4, bossStr: 1.6,
        finale: 'Skrag falls, clutching a black feather. "The Ashen Herald comes," he gasps.',
        reward: { gold: 150, xp: 40 },
    },
    {
        act: 2, tier: 1, title: 'ROAD OF RAVENS', level: 3,
        hook: 'Ravens follow thee on the road to Garinham. A caravan lies broken ahead, its drivers missing.',
        chapters: [
            ch('The Broken Caravan', 'EXPLORATION', 'Track the missing drivers into the hills by wagon ruts and dropped coins.'),
            ch('Bandits of the Red Hand', 'SOCIAL', 'Parley with bandit captain Ilsa Crowe, who took the drivers to trade for her own captured brother.'),
            ch('The Hobgoblin Camp', 'COMBAT', 'Free the prisoners from a disciplined hobgoblin war camp.'),
        ],
        npcs: [ 'Ilsa Crowe, bandit captain', 'Tobin Crowe' ],
        monsters: [ 'Bandit', 'Hobgoblin', 'Giant Spider' ],
        check: {
            skill: 'Persuasion', ability: 'CHA', dc: 12,
            prompt: 'Convince Ilsa to fight beside thee instead of against thee.',
            success: 'Ilsa grins. "Fine. But my brother comes home first." Her bandits join the assault.',
            failure: 'Ilsa spits. "Go alone, then." Thou facest the camp without her.',
        },
        villain: 'Warchief Korgath', bossEnemy: 'Skeleton', bossHp: 4, bossStr: 1.6,
        finale: 'Korgath\'s orders bear the same black feather: the Ashen Herald pays the hobgoblins in soulglass.',
        reward: { gold: 300, xp: 120 },
    },
    {
        act: 3, tier: 1, title: 'THE DROWNED CHAPEL', level: 5,
        hook: 'A drowned chapel rises from the lake each full moon. Tonight, its bell rings on its own.',
        chapters: [
            ch('Moonrise on the Lake', 'EXPLORATION', 'Cross the lake on stepping stones that only appear in moonlight.'),
            ch('The Sexton\'s Ghost', 'SOCIAL', 'A ghost sexton guards the crypt and will speak only to one who answers his riddle.'),
            ch('The Restless Dead', 'COMBAT', 'Skeletons and zombies rise from flooded tombs around the first Souldcrest reliquary.'),
        ],
        npcs: [ 'Brother Ansel, the ghost sexton' ],
        monsters: [ 'Skeleton', 'Zombie', 'Ghoul', 'Specter' ],
        check: {
            skill: 'Religion', ability: 'WIS', dc: 13,
            prompt: 'Recite the old funeral rite so the dead may rest.',
            success: 'Half the dead lie back down. The rest are weaker for it.',
            failure: 'The rite falters. Every grave opens.',
        },
        villain: 'The Wight of the Bell', bossEnemy: 'Wraith', bossHp: 4.5, bossStr: 1.5,
        finale: 'Within the reliquary waits a second shard. Together the shards show a map: five reliquaries, five shards, one prison.',
        reward: { gold: 500, xp: 300 },
    },
    {
        act: 4, tier: 2, title: 'THE ASHEN HERALD', level: 7,
        hook: 'Kol burns. A herald in ash-grey robes demands the shards, or the next town burns too.',
        chapters: [
            ch('Kol in Flames', 'COMBAT', 'Hold the bridge while the people of Kol flee from cultists and their hell hounds.'),
            ch('The Herald\'s Bargain', 'SOCIAL', 'The herald, Sereth Vale, offers to spare the realm if thou wilt give up the crest.'),
            ch('Trail of Ash', 'EXPLORATION', 'Follow the cult into the cinder hills.'),
        ],
        npcs: [ 'Sereth Vale, the Ashen Herald', 'Captain Odra of Kol' ],
        monsters: [ 'Cult Fanatic', 'Cultist', 'Hell Hound' ],
        check: {
            skill: 'Insight', ability: 'WIS', dc: 14,
            prompt: 'Read Sereth Vale while she bargains.',
            success: 'She is afraid. Someone above her holds her leash.',
            failure: 'Her calm reveals nothing.',
        },
        villain: 'Sereth Vale', bossEnemy: 'Magician', bossHp: 6, bossStr: 2,
        finale: 'Sereth escapes through a gate of black fire, leaving one word: "Stormfire."',
        reward: { gold: 900, xp: 700 },
    },
    {
        act: 5, tier: 2, title: 'CITY OF SPIRES', level: 9,
        hook: 'The capital\'s council will not believe thee without proof, and someone on the council serves the cult.',
        chapters: [
            ch('The Council Chamber', 'SOCIAL', 'Argue before the five councillors of Tantegel.'),
            ch('Masks at the Masquerade', 'SOCIAL', 'Unmask the traitor at the Lord Mayor\'s masquerade.'),
            ch('Sewers Beneath the Spires', 'COMBAT', 'Chase the traitor through sewers full of rats and something larger.'),
        ],
        npcs: [ 'Councillor Hollis Grey', 'Lord Mayor Aldwyn Penhallow', 'Mira Penhallow' ],
        monsters: [ 'Spy', 'Veteran', 'Otyugh', 'Swarm of Rats' ],
        check: {
            skill: 'Deception', ability: 'CHA', dc: 14,
            prompt: 'Pose as a cultist to draw the traitor out.',
            success: 'Councillor Grey takes the bait and leads thee straight to the cult.',
            failure: 'Grey sees through thee and flees into the sewers.',
        },
        villain: 'Councillor Hollis Grey', bossEnemy: 'Warlock', bossHp: 6, bossStr: 2,
        finale: 'Grey\'s confession: the cult serves VAELRITH, a storm drake bound to the Stormfire.',
        reward: { gold: 1500, xp: 1500 },
    },
    {
        act: 6, tier: 2, title: 'THE SKY-SHARD', level: 12,
        hook: 'The third shard rests atop a mountain no one has climbed since the Sundering.',
        chapters: [
            ch('The Frostwind Pass', 'EXPLORATION', 'Climb the pass through avalanche and blizzard.'),
            ch('The Griffon Riders', 'SOCIAL', 'Earn the trust of the mountain clans and their griffons.'),
            ch('The Peak', 'COMBAT', 'A young blue dragon claims the shard as treasure.'),
        ],
        npcs: [ 'Clan-mother Yeva Stonehelm', 'Rook, griffon rider' ],
        monsters: [ 'Griffon', 'Yeti', 'Young Blue Dragon' ],
        check: {
            skill: 'Athletics', ability: 'STR', dc: 15,
            prompt: 'Climb the ice wall before the storm hits.',
            success: 'Thou reachest the peak with strength to spare.',
            failure: 'Thou slippest; the climb costs thee dearly.',
        },
        villain: 'Ithrask the Young Blue', bossEnemy: 'Wyvern', bossHp: 7, bossStr: 2.2,
        finale: 'With three shards, the crest blazes: thou canst hear the Stormfire stirring in its prison.',
        reward: { gold: 2500, xp: 3000 },
    },
    {
        act: 7, tier: 3, title: 'THE SUNKEN ARCHIVE', level: 15,
        hook: 'The Souldcrest\'s records lie in an archive swallowed by the sea.',
        chapters: [
            ch('Below the Waves', 'EXPLORATION', 'Dive into the drowned library with a water-breathing charm.'),
            ch('The Sahuagin Court', 'SOCIAL', 'Bargain with the sahuagin baron who has made the archive his throne room.'),
            ch('The Archive Guardian', 'COMBAT', 'An ancient golem still guards the forbidden stacks.'),
        ],
        npcs: [ 'Baron Kesh of the Deep', 'Archivist Lune (a ghost)' ],
        monsters: [ 'Sahuagin', 'Merrow', 'Water Elemental', 'Stone Golem' ],
        check: {
            skill: 'History', ability: 'INT', dc: 15,
            prompt: 'Find the true account of the Sundering in the archive.',
            success: 'The truth: the first Souldcrest did not seal the Stormfire. She became its prison.',
            failure: 'Thou findest only half the story.',
        },
        villain: 'The Archive Golem', bossEnemy: 'Golem', bossHp: 3, bossStr: 1.6,
        finale: 'The crest is a key, and a cage. Whoever bears all five shards must choose to hold the Stormfire or free it.',
        reward: { gold: 4000, xp: 6000 },
    },
    {
        act: 8, tier: 3, title: 'THE BURNING WASTE', level: 18,
        hook: 'The fourth shard lies in the Emberwaste, where a fire giant forge-lord melts reliquaries into weapons.',
        chapters: [
            ch('Across the Waste', 'EXPLORATION', 'Survive heat, salamanders and sinking sand.'),
            ch('The Forge-Lord\'s Hall', 'SOCIAL', 'Pose as a smith to enter the fire giant\'s hall.'),
            ch('The Great Forge', 'COMBAT', 'Battle the forge-lord beside his molten anvil.'),
        ],
        npcs: [ 'Forge-Lord Brann Emberheart', 'Tessa, escaped smith' ],
        monsters: [ 'Salamander', 'Fire Elemental', 'Fire Giant', 'Magma Mephit' ],
        check: {
            skill: 'Survival', ability: 'WIS', dc: 16,
            prompt: 'Find a safe path through the waste.',
            success: 'Thou findest an old road of black glass, cool underfoot.',
            failure: 'The waste nearly claims thee.',
        },
        villain: 'Forge-Lord Brann Emberheart', bossEnemy: 'Stoneman', bossHp: 4, bossStr: 1.6,
        finale: 'Brann dies laughing: "The Herald already holds the fifth shard."',
        reward: { gold: 6000, xp: 10000 },
    },
    {
        act: 9, tier: 3, title: 'THE HERALD\'S REDEMPTION', level: 21,
        hook: 'Sereth Vale sends thee a message in ash: she wants out, and she has the fifth shard.',
        chapters: [
            ch('A Trap or a Plea', 'SOCIAL', 'Meet Sereth on neutral ground and decide whether to trust her.'),
            ch('Vaelrith\'s Eyes', 'EXPLORATION', 'Slip past the storm drake\'s spies in the Duskmoor.'),
            ch('The Cult\'s Wrath', 'COMBAT', 'Defend Sereth from the cult she betrayed.'),
        ],
        npcs: [ 'Sereth Vale', 'High Priest Morvain' ],
        monsters: [ 'Wraith', 'Vampire Spawn', 'Wight', 'Banshee' ],
        check: {
            skill: 'Insight', ability: 'WIS', dc: 17,
            prompt: 'Decide if Sereth\'s change of heart is real.',
            success: 'She is sincere. She gives thee the fifth shard willingly.',
            failure: 'Thou doubtest her, and the cult strikes while ye argue.',
        },
        villain: 'High Priest Morvain', bossEnemy: 'Wizard', bossHp: 7, bossStr: 2,
        finale: 'Five shards. The crest becomes a crown of lightning, and far away, Vaelrith roars.',
        reward: { gold: 9000, xp: 16000 },
    },
    {
        act: 10, tier: 4, title: 'STORMWALL', level: 24,
        hook: 'Vaelrith tears down the Stormwall, the barrier that kept the storm-lands sealed for a thousand years.',
        chapters: [
            ch('Rally the Realm', 'SOCIAL', 'Unite the council, the clans, the bandits and the sea court for one last stand.'),
            ch('The Siege of Tantegel', 'COMBAT', 'Hold the capital against storm giants and air elementals.'),
            ch('Into the Storm-lands', 'EXPLORATION', 'Cross the broken wall into lands where the sky is the ground.'),
        ],
        npcs: [ 'Every ally thou hast made', 'King Aldric III' ],
        monsters: [ 'Storm Giant', 'Air Elemental', 'Wyvern', 'Chimera' ],
        check: {
            skill: 'Persuasion', ability: 'CHA', dc: 18,
            prompt: 'Speak to the gathered armies before the siege.',
            success: 'The armies roar thy name. None break.',
            failure: 'Some waver, and the walls are harder to hold.',
        },
        villain: 'Thrym Stormcaller, storm giant', bossEnemy: 'BlueDragon', bossHp: 3, bossStr: 1.4,
        finale: 'The capital stands. Beyond the broken wall, Vaelrith waits on a throne of thunder.',
        reward: { gold: 14000, xp: 24000 },
    },
    {
        act: 11, tier: 4, title: 'THE EYE OF THE STORM', level: 27,
        hook: 'At the center of the storm-lands, the Stormfire\'s prison is cracking.',
        chapters: [
            ch('The Floating Isles', 'EXPLORATION', 'Leap between isles that drift through the storm.'),
            ch('The Last Warden', 'SOCIAL', 'Speak with the spirit of the first Souldcrest, still holding the prison closed.'),
            ch('Vaelrith', 'COMBAT', 'Face the ancient storm drake that would free its master.'),
        ],
        npcs: [ 'Aeryn, the First Souldcrest' ],
        monsters: [ 'Adult Blue Dragon', 'Djinni', 'Invisible Stalker' ],
        check: {
            skill: 'Arcana', ability: 'INT', dc: 19,
            prompt: 'Understand the prison\'s weave before it breaks.',
            success: 'Thou seest how to reinforce it without taking Aeryn\'s place.',
            failure: 'The prison weave is beyond thee. Only a sacrifice will hold it.',
        },
        villain: 'Vaelrith, the Storm Drake', bossEnemy: 'RedDragon', bossHp: 3.5, bossStr: 1.5,
        finale: 'Vaelrith falls. But the prison shatters, and the Stormfire wakes.',
        reward: { gold: 20000, xp: 36000 },
    },
    {
        act: 12, tier: 4, title: 'SOULDCREST STORMFIRE', level: 30,
        hook: 'The Stormfire, a living tempest older than the gods, rises over the world. Only the bearer of the crest can stand before it.',
        chapters: [
            ch('The Crown of Lightning', 'SOCIAL', 'Choose with Aeryn and Sereth how the story ends: seal, bind or free the Stormfire.'),
            ch('The Unmaking Sky', 'EXPLORATION', 'Climb the storm itself toward its burning heart.'),
            ch('Stormfire', 'COMBAT', 'Battle the Stormfire for the fate of the world.'),
        ],
        npcs: [ 'Aeryn, the First Souldcrest', 'Sereth Vale' ],
        monsters: [ 'Ancient Blue Dragon', 'Storm Giant', 'Air Elemental' ],
        check: {
            skill: 'Arcana', ability: 'WIS', dc: 20,
            prompt: 'Bind the Stormfire into the crest without losing thyself.',
            success: 'The storm becomes a crest of light on thy palm, gentle as a heartbeat. Thou art the new warden, and thou art free.',
            failure: 'The storm is sealed, but its echo will always burn in thee.',
        },
        villain: 'The Stormfire', bossEnemy: 'DragonlordForm2', bossHp: 2, bossStr: 1.3,
        finale: 'The sky clears for the first time in a thousand years. The legend of the Souldcrest is written anew, and its name is thine.',
        reward: { gold: 50000, xp: 60000 },
    },
];

export const getAct = (act: number): StoryAct | undefined => STORY.find((a) => a.act === act);

export interface StoryProgress {
    /** Highest act completed (0 = none). */
    completed: number;
    /** Act numbers whose ability check has been rolled, and whether it passed. */
    checks: Record<number, boolean>;
}

export const createStoryProgress = (): StoryProgress => ({ completed: 0, checks: {} });

/** The act the hero is on (the next uncompleted act), or undefined when the story is over. */
export const currentAct = (progress: StoryProgress): StoryAct | undefined => getAct(progress.completed + 1);

/** 5e proficiency bonus by level (capped at character level 20). */
export const proficiencyBonus = (level: number): number => 2 + Math.floor((Math.min(level, 20) - 1) / 4);

export interface CheckResult {
    roll: number;
    modifier: number;
    total: number;
    dc: number;
    success: boolean;
    critical: 'nat20' | 'nat1' | undefined;
}

/**
 * A 5e ability check: d20 + ability modifier + proficiency bonus against the DC.
 * A natural 20 always succeeds and a natural 1 always fails (a common table rule).
 */
export const abilityCheck = (rng: Rng, check: AbilityCheck, scores: AttributeScores, level: number): CheckResult => {
    const roll = rollInt(rng, 1, 20);
    const modifier = attributeModifier(scores[check.ability]) + proficiencyBonus(level);
    const total = roll + modifier;
    const critical = roll === 20 ? 'nat20' : roll === 1 ? 'nat1' : undefined;
    const success = critical === 'nat20' || critical !== 'nat1' && total >= check.dc;
    return { roll, modifier, total, dc: check.dc, success, critical };
};

/** A passed check makes the act's boss weaker and the reward richer. */
export const CHECK_BOSS_WEAKEN = 0.8;
export const CHECK_REWARD_BONUS = 1.25;
