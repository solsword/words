// player.js
// Holds all player-specific information in one place so that it can be saved
// and loaded.

/**
 * All current players by ID
 */
export var CURRENT_PLAYERS = {};

/**
 * ID of the player currently controlled by input in this session
 */
export var INPUT_PLAYER_ID = undefined;

/**
 * Player ID counter:
 */
var NEXT_ID = 0;

/**
 * Updates NEXT_ID and returns a new unique player ID.
 */
function next_id() {
    NEXT_ID += 1;
    return "player:" + NEXT_ID;
}

/**
 * Returns a new player object.
 *
 * @return A player object with the following fields:
 *     id: The player ID, a unique string.
 *     unlock_limit: The limit for the number of words that the player
 *         can unlock at once.
 *     unlock_xp: TODO: let's redesign this!
 *     domains_visited: An array containing the names of domains this
 *        player has visited.
 *     words_found: An object whose keys are strings and whose values are
 *        2-element arrays containing a dimension object (see
 *        dimensions.key__dim) and a 2-element xy global tile coordinate
 *        array indicating where the initial glyph of the word was found
 *        in the specified dimension.
 */
export function new_player() {
    let id = next_id();
    let result = {
        "id": id,
        "unlock_limit": 1,
        "unlock_xp": 0,
        "domains_visited": [],
        "words_found": {},
    }
    CURRENT_PLAYERS[id] = result;
    return result;
}

/**
 * @return The player who is currently being controlled by input from
 *     this session (see new_player on the data structure details).
 */
export function current_input_player() {
    return CURRENT_PLAYERS[INPUT_PLAYER_ID];
}
