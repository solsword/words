// player.js
// Holds all player-specific information in one place so that it can be saved
// and loaded.

"use strict";

import * as anarchy from "../anarchy.mjs";

/**
 * All current players by ID
 */
export var CURRENT_PLAYERS = {};

/**
 * ID of the player currently controlled by input in this session
 */
export var INPUT_PLAYER_ID = undefined;

/**
 * Different types of experience points the player can earn.
 * TODO: What are these? How do they work?
 */
export var EXP_TYPES = [
    "memory",
    "intuition",
    "concentration",
    "dexterity",
    "acuity",
    "creativity",
    "compassion",
    "leadership",
];

/**
 * Starting EXP for each of the EXP_TYPES will fall into this range
 * (inclusive).
 */
export const STARTING_EXP = [8, 43];

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
 * @param An integer seed that determines the player's starting
 *      experience values.
 *
 * @return A player object with the following fields:
 *     id: The player ID, a unique string.
 *     activity: A sub-object with the following keys:
 *         pokes: Tracks locations that have been unlocked individually.
 *            An array holding 3-element [dimension, position, time]
 *            arrays that include a dimension object, a 2-element tile
 *            grid x/y coordinate position array, and a numerical player
 *            timestamp value in seconds. Each of those arrays represent
 *            a single completed poke which allows for temporarily
 *            unlocking any single tile.
 *         matches: Tracks matched word locations. An object whose keys
 *            are domain names and whose values are arrays of matches,
 *            where each match is an array that holds holds an entry
 *            index in the associated domain, a dimension key indicating
 *            which dimension the word was found in, a 2-element tile
 *            grid coordinate array indicating the position of the start
 *            of the match, and a numerical player timestamp indicating
 *            when the match was found.
 *     experience: An sub-object that tracks experience points in each of
 *         the different types of experience. Each string from EXP_TYPES
 *         is mapped to an integer. TODO: Something else less siloed?
 *     poke_cooldown: The delay after completing a poke before another
 *         poke may be initiated. TODO: Implement this.
 *     poke_delay: The delay (in integer seconds; may be 0)
 *     unlock_limit: The limit for the number of words that the player
 *         can unlock at once.
 *     domains_visited: An array containing the names of domains this
 *        player has visited.
 *     words_found: An object whose keys are strings and whose values are
 *        2-element arrays containing a dimension object (see
 *        dimensions.key__dim) and a 2-element xy global tile coordinate
 *        array indicating where the initial glyph of the word was found
 *        in the specified dimension.
 *     playtime: A number indicating how many seconds (& fractions of a
 *         second) of in-game time have elapsed while this player was
 *         active.
       glyphs_mastered: A mapping from domain names or combo names to
           arrays of glyphys avaiable to the player to choose from when
           splice.
 */
export function new_player(seed) {
    let id = next_id();
    let exp = {};
    let r = anarchy.prng(seed, seed);
    for (let exp_type of EXP_TYPES) {
        exp[exp_type] = anarchy.idist(r, STARTING_EXP[0], STARTING_EXP[1]+1);
        r = anarchy.prng(r, seed);
    }

    let result = {
        "id": id,
        "activity": {
            "pokes": [],
            "matches": {},
        },
        "experience": exp,
        "poke_delay": 1,
        "poke_cooldown": 1,
        "unlock_limit": 1,
        "domains_visited": [],
        "words_found": {},
        "playtime": 0,
        "glyphs_mastered": {},
    };
    CURRENT_PLAYERS[id] = result;
    return result;
}

/**
 * Sets the given player as the one whose actions are controlled by the
 * main inputs.
 *
 * @param player A player object.
 */
export function set_input_player(player) {
    INPUT_PLAYER_ID = player.id;
}

/**
 * @return The player who is currently being controlled by input from
 *     this session (see new_player on the data structure details).
 */
export function current_input_player() {
    return CURRENT_PLAYERS[INPUT_PLAYER_ID];
}

/**
 * To be called regularly during play; updates player timers and triggers
 * any resulting changes that need to be made.
 *
 * @param elapsed The number of seconds since the previous call to
 *     tick_players, or since the start of play.
 * @return True if something changed that requires a redraw, false if
 *     nothing visible has changed.
 */
export function tick_players(elapsed) {
    for (let pid of Object.keys(CURRENT_PLAYERS)) {
        let player = CURRENT_PLAYERS[pid];
        player.playtime += elapsed;
        // TODO: expire pokes and/or other unlocks here?
    }
    return false;
}

/**
 * Returns a player-specific timestamp.
 *
 * @param player The player object to use.
 * @return A number of seconds (w/ fractional part) indicating the
 *     elapsed in-game time since the first time this player saw play.
 */
export function elapsed(player) {
    return player.playtime;
}

/**
 * Adds a poked location to the player's memory.
 *
 * @param player The player object to use (e.g. current_input_player()).
 * @param dimension The dimension object where the location was unlocked.
 * @param gp The position (a 2-element x/y tile coordinate array) which
 *     was unlocked.
 */
export function remember_poke(player, dimension, gp) {
    let now = elapsed(player);
    player.activity.pokes.push([dimension, gp, now]);
}

/**
 * Add a matched word to the player's memory.
 *
 * @param player The player object to use (e.g., current_input_player()).
 * @param dimension The dimension object where the match was made.
 * @param gp The tile position (a 2-element x/y coordinate array) of the
 *     first glyph in the match.
 * @param domain The name of the domain that the matched word belongs to,
 *     or "_custom_" if it's a custom word. TODO: Implement those? TODO:
 *     Are combos allowed?
 * @param index The index of the entry for the matched word within its
 *     domain. For custom words, it must be an index into the player's
 *     custom words array. TODO: implement that.
 */
export function remember_match(player, dimension, gp, domain, index) {
    let matches = player.activity.matches;
    let now = elapsed(player);
    if (!matches.hasOwnProperty(domain)) {
        matches[domain] = [];
    }
    matches[domain].push([index, dimension, gp, now]);
}

/**
* call this when the player is mastering a glyph
*if they have already mastered the glyph, a warning will appear
* in the console
* @param player is the person mastering the glyph
* @param glyph is the letter that is being mastered
* @param domain_name is the name of a domain or como to master the glyph

* @returns glyphs_mastered for the player
*/
export function master_glyph(player,glyph,domain_name){
    let domain_mastered = player.glyphs_mastered[domain_name];

    if (domain_mastered === undefined){
        domain_mastered = [glyph];
        player.glyphs_mastered[domain_name] = domain_mastered;
    }
    else if (domain_mastered.includes(glyph)) {
        console.log("glyph already mastered!");
    }
    else{
        domain_mastered.push(glyph);
    }
    return domain_mastered;
}

/**
*   this function decides if one has mastered the words
*   @param domain_name the domain
*   @param player the person playing the game
*   @returns a glyph
*
*/
export function mastering_glyph(player,domain_name){
    let domain = lookup_domain(domain_name);

}

// /**
// *   this function finds a glyph on the domain
// *   @param domain_name the domain
// *   @param glyph the glyph that needs to be found
// *   @returns a glyph
// */
//
// export function find_glyph(glyph, domain_name){
//     let domain = lookup_domain(domain_name);
//
// }
