import { Keys } from 'gtp';

/**
 * Hotkeys available while walking around. Debug keys stay behind SHIFT (see BaseState),
 * so plain letters are free for these.
 */
export type HotkeyAction =
    | 'worldMap' | 'mainMenu' | 'gear' | 'character' | 'items' | 'bag' | 'journal' | 'talents'
    | 'spells' | 'cores' | 'forge' | 'season' | 'adventure' | 'atlas' | 'worldTier' | 'ride'
    | 'professions' | 'companion' | 'save' | 'help' | 'status';

export interface Keybind {
    key: number;
    keyName: string;
    action: HotkeyAction;
    label: string;
}

const bind = (key: number, keyName: string, action: HotkeyAction, label: string): Keybind => ({ key, keyName, action, label });

/** Every hotkey, in the order shown on the help screen. */
export const KEYBINDS: Keybind[] = [
    bind(Keys.KEY_M, 'M', 'worldMap', 'World map'),
    bind(Keys.KEY_SPACE, 'SPACE', 'mainMenu', 'Main menu'),
    bind(Keys.KEY_G, 'G', 'gear', 'Gear'),
    bind(Keys.KEY_C, 'C', 'character', 'Character'),
    bind(Keys.KEY_I, 'I', 'items', 'Items'),
    bind(Keys.KEY_B, 'B', 'bag', 'Bag'),
    bind(Keys.KEY_J, 'J', 'journal', 'Journal'),
    bind(Keys.KEY_K, 'K', 'talents', 'Talents'),
    bind(Keys.KEY_L, 'L', 'spells', 'Spells'),
    bind(Keys.KEY_N, 'N', 'cores', 'Skill cores'),
    bind(Keys.KEY_F, 'F', 'forge', 'Forge'),
    bind(Keys.KEY_Q, 'Q', 'season', 'Season & quests'),
    bind(Keys.KEY_E, 'E', 'adventure', 'Dungeons & group finder'),
    bind(Keys.KEY_T, 'T', 'atlas', 'Atlas'),
    bind(Keys.KEY_V, 'V', 'worldTier', 'World tier'),
    bind(Keys.KEY_U, 'U', 'ride', 'Ride / dismount'),
    bind(Keys.KEY_P, 'P', 'professions', 'Professions'),
    bind(Keys.KEY_Y, 'Y', 'companion', 'Companion'),
    bind(Keys.KEY_S, 'S', 'save', 'Save game'),
    bind(Keys.KEY_H, 'H', 'help', 'Help (this list)'),
    bind(Keys.KEY_1, '1', 'status', 'Status'),
];

/** The fixed movement and confirm keys, for the help screen. */
export const BASIC_CONTROLS: string[] = [
    'ARROWS  Move',
    'Z       Action / command menu / confirm',
    'X       Cancel / back',
    'ENTER   Start (title screen)',
];

export const keybindHelpLines = (): string[] => [
    ...BASIC_CONTROLS,
    '',
    ...KEYBINDS.map((k) => `${k.keyName.padEnd(7, ' ')} ${k.label}`),
];
