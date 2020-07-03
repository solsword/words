// player.js
// Holds all player-specific information in one place so that it can be saved
// and loaded.

"use strict";

import * as anarchy from "../anarchy.mjs";
import * as avatar from "./avatar.js";

/**
 * All current players by ID
 */
export var CURRENT_PLAYERS = {};

/**
 * ID of the player currently controlled by input in this session
 */
export var INPUT_PLAYER_ID = undefined;

/**
 * Different types of experience points (EXP) the player can earn.
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
 * Starting experience points (EXP) for each of the EXP_TYPES will fall
 * into this range (inclusive).
 */
export const STARTING_EXP = [8, 43];

/**
 * The range of starting affinity values for each experience type.
 * Affinity values multiply EXP gained. The distribution over these
 * values should be pseudo-gaussian, not uniform.
 */
export const STARTING_AFF = [0.9, 1.1];

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
 * @param seed An integer seed that determines the player's starting
 *     experience values.
 *
 * @return A player object with the following fields:
 *
 *     id: The player ID, a unique string.
 *
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
 *
 *     stats: A sub-object which keeps track of quantities that the
 *         player can upgrade permanently, including:
 *
 *         memory_limit: How many matches the player can remember at once.
 *         precise_memory_limit: How many match locations the player can
 *             remember at once (locations are forgotten before words).
 *         unlock_limit: How many words can be held unlocked at once.
 *         poke_limit: How many pokes can be held unlocked at once.
 *         poke_delay: How long it takes for a poke to unlock after being
 *             initiated (integer seconds; may be 0).
 *         poke_cooldown: How long the player must wait after a poke
 *             before starting a new one (integer seconds; may be 0).
 *         poke_duration: How long a poke by this agent should last.
 *         glyph_mastery_rate: How fast the player earns progress
 *             towards mastering glyphs.
 *         glyph_pickup_rate: How fast the player earns mastered glyphs.
 *         splice_slots: How many slots are available to store glyphs for
 *             spicing.
 *         match_brightness: How much light unlocked tiles generate.
 *         night_vision: How much brighter each tile appears than it
 *             normally would.
 *         hidden_sense: How easily hidden elements can be sensed.
 *         learning_affinities: For each experience type, how quickly the
 *             player gains experience points of that type relative to
 *             the baseline rate.
 *         TODO: More of these?
 *
 *     domain_upgrades: A sub-object that maps domain/combo names to
 *         objects with the same keys as stats (but most will be
 *         missing). These represent domain-specific stat boosts for that
 *         player, when working in a dimension that uses that domain.
 *     experience: An sub-object that tracks experience points in each of
 *         the different types of experience. Each string from EXP_TYPES
 *         is mapped to an integer. TODO: Something else less siloed?
 *     domains_visited: An array containing the names of domains this
 *         player has visited.
 *     words_unlocked: An array containing 3-element [dimension, path,
 *         when] arrays, where the path is an array containing 2-element
 *         grid position x/y arrays. This stores which locations the
 *         player has currently unlocked.
 *     positions_poked: An array containing 3-element [dimension,
 *         position, when] arrays, where the position is a 2-element grid
 *         coordinate x/y array. Store all locations where this player
 *         has initiated a poke.
 *     words_found: An object whose keys are strings and whose values are
 *         2-element arrays containing a dimension object (see
 *         dimensions.key__dim) and a 2-element xy global tile coordinate
 *         array indicating where the initial glyph of the word was found
 *         in the specified dimension.
 *     playtime: A number indicating how many seconds (& fractions of a
 *         second) of in-game time have elapsed while this player was
 *         active.
 *     avatar: A sub-object with the following keys:
 *         static_img_src: The filename of the avatar's static image within
 *             the images folder in the format "../../images/<filename>.svg" 
 *             where <filename> is the name of the file.
 *         animation_srcs: A list containing the filenames of the avatar's
 *             animations within the images folder in the format 
 *             "../../images/<filename>.svg" where <filename> is the
 *             name of each file.
 */
export function new_player(seed) {
    let id = next_id();
    let exp = {};
    let affinities = {};
    let r = anarchy.prng(seed, seed);
    for (let exp_type of EXP_TYPES) {
        exp[exp_type] = anarchy.idist(r, STARTING_EXP[0], STARTING_EXP[1] + 1);
        r = anarchy.prng(r, seed);
        affinities[exp_type] = (
            STARTING_AFF[0]
          + anarchy.pgdist(r) * (STARTING_AFF[1] - STARTING_AFF[0])
        );
        r = anarchy.prng(r, seed);
    }

    let result = {
        "id": id,
        "activity": {
            "pokes": [],
            "matches": {},
        },
        "stats": {
            "memory_limit": 10, // TODO: unused
            "unlock_limit": 3,
            "poke_limit": 1, // TODO: Start at 0
            "reach": 0, // TODO: Start at 1? (unused)
            "poke_delay": 20, // seconds (TODO: unused)
            "poke_cooldown": 120, // seconds (TODO: unused)
            "poke_duration": 60, // seconds (TODO: unused)
            "glyph_mastery_rate": 0, // TODO: unused
            "glyph_pickup_rate": 0, // TODO: unused
            "splice_slots": 3, // TODO: Start at 0 (unused)
            "match_brightness": 3, // TODO: unused
            "night_vision": 0, // TODO: unused
            "hidden_sense": 0, // TODO: unused
            "learning_affinities": affinities // TODO: unused
        },
        "domain_upgrades": {},
        "experience": exp,
        "domains_visited": [],
        "words_found": {},
        "words_unlocked": [],
        "positions_poked": [],
        "playtime": 0,
        "avatar": avatar.new_avatar("SVGavatar"),
    };
    CURRENT_PLAYERS[id] = result;
    return result;
}

/**
 * Sets the given player as the one whose actions are controlled by the
 * main inputs.
 *
 * @param agent A player object.
 */
export function set_input_player(agent) {
    INPUT_PLAYER_ID = agent.id;
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
    let result = false;
    for (let pid of Object.keys(CURRENT_PLAYERS)) {
        let agent = CURRENT_PLAYERS[pid];
        if (tick_player(agent)) {
            result = true;
        }
    }
    return result;
}

/**
 * Updates an individual player given that the given number of seconds
 * have elapsed since the previous update.
 *
 * @param elapsed The number of seconds since the previous update (or
 *     since the start of play).
 * @return True if player state has changed in a way that implies a
 *     redraw is required.
 */
export function tick_player(agent, elapsed) {
    // Update playtime
    agent.playtime += elapsed;

    // Expire old pokes
    for (let poke of agent.positions_poked) {
        let when = poke[2];
        if (agent.playtime - when > agent.stats.poke_duration) {
            // TODO: resolve import direction between player <-> content
        }
    }

    // TODO: expire unlocks here?
}

/**
 * Returns a player-specific timestamp.
 *
 * @param agent The player object to use.
 * @return A number of seconds (w/ fractional part) indicating the
 *     elapsed in-game time since the first time this player saw play.
 */
export function elapsed(agent) {
    return agent.playtime;
}

/**
 * Updates the player by adding some experience points of a certain type.
 * This function takes into account the player's learning affinities to
 * modify the actual amount of experience gained.
 *
 * @param agent The player who is earning the EXP.
 * @param exp_type The type of experience earned (see EXP_TYPES).
 * @param amount How many points to award (may be fractional).
 */
export function earn_exp(agent, exp_type, amount) {
    if (!EXP_TYPES.includes(exp_type)) {
        console.warn("Invalid EXP type '" + exp_type + "' will be ignored.");
    }
    let adjusted = amount * agent.stats.learning_affinities[exp_type];
    agent.experience[exp_type] += adjusted;
    // TODO: Do any other updates need to happen as a result?
}

/**
 * Adds a poked location to the player's memory.
 *
 * @param agent The player object to use (e.g. current_input_player()).
 * @param dimension The dimension object where the location was unlocked.
 * @param gp The position (a 2-element x/y tile coordinate array) which
 *     was unlocked.
 */
export function remember_poke(agent, dimension, gp) {
    let now = elapsed(agent);
    agent.activity.pokes.push([dimension, gp, now]);
}

/**
 * Add a matched word to the player's memory.
 *
 * @param agent The player object to use (e.g., current_input_player()).
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
export function remember_match(agent, dimension, gp, domain, index) {
    let matches = agent.activity.matches;
    let now = elapsed(agent);
    if (!matches.hasOwnProperty(domain)) {
        matches[domain] = [];
    }
    matches[domain].push([index, dimension, gp, now]);
}

/**
 * Adds an entry to the player's unlocked words list, which specifies
 * the dimension and path that were unlocked.
 *
 * @param agent The player to update.
 * @param dimension The dimension where the word was unlocked.
 * @param path The path (an array of 2-element grid coordinate x/y
 *     arrays) that was unlocked.
 */
export function add_unlocked(agent, dimension, path) {
    agent.words_unlocked.push([dimension, path, elapsed(agent)]);
}

/**
 * Checks the given player's unlock limit, and removes old entries from
 * their unlocked words list which are in excess of that limit. Returns
 * an array of the removed entries.
 *
 * @param agent The player to update.
 *
 * @return An array of 2-element [dimension, path] arrays specifying
 *     which entries were removed from the player's unlocked list. When
 *     nothing was removed, this will be an empty array.
 */
export function limit_unlocked(agent) {
    let limit = agent.stats.unlock_limit;
    let over = agent.words_unlocked.length - limit;
    let result = [];
    if (over > 0) {
        result = agent.words_unlocked.splice(0, over).map(x => [x[0], x[1]]);
    }
    return result;
}

/**
 * Records the given player's support for holding a single position
 * unlocked via a "poke."
 *
 * @param agent The player who is performing the poke.
 * @param dimension The dimension where it occurs.
 * @param pos A 2-element grid position x/y array specifying the location
 *     of the poke.
 */
export function add_poke(agent, dimension, pos) {
    agent.positions_poked.push([dimension, pos, elapsed(agent)]);
}

/**
 * Works just like limit_unlocked, but for pokes instead of unlocked
 * words.
 *
 * @param agent The player to update.
 *
 * @return An array of 2-element [dimension, position] arrays specifying
 *     which entrie(s) were removed from the player's pokes list.
 */
export function limit_pokes(agent) {
    let limit = agent.stats.poke_limit;
    let over = agent.positions_poked.length - limit;
    let result = [];
    if (over > 0) {
        result = agent.positions_poked.splice(0, over).map(x => [x[0], x[1]]);
    }
    return result;
}
