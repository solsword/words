// player.js
// Holds all player-specific information in one place so that it can be saved
// and loaded.
/* global console */

"use strict";

import * as anarchy from "../anarchy.mjs";
import * as content from "./content.js";
import * as dimensions from "./dimensions.js";
import * as generate from "./generate.js";
import * as dict from "./dict.js";
import * as utils from "./utils.js";
import * as grid from "./grid.js";
import * as quests from "./quests.js";

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
 * Specifies how domain-specific upgrades should be applied to stats: for
 * each stat, should upgrades multiply (*) or add to (+) the base stat
 * when working in a domain with a modifier? If the method ends with '_',
 * the result after adjustments will be rounded to the nearest integer.
 */
export const UPGRADE_METHODS = {
    "memory_limit": '*_',
    "precise_memory_limit": '*_',
    "unlock_limit": '+',
    "poke_limit": '+',
    "reach": '+',
    "poke_delay": '*', // bonuses should be < 1
    "poke_cooldown": '*', // bonuses should be < 1
    "poke_duration": '*', // bonuses should be < 1
    "glyph_mastery_rate": '?', // TODO
    "glyph_pickup_rate": '?', // TODO
    "splice_slots": '+',
    "match_brightness": '+',
    "night_vision": '+',
    "hidden_sense": '+',
    "learning_affinities": '*' // applied to each entry
};

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
 *     activity: A sub-object which keeps track of what the player has
 *         done/is doing. It has the following keys:
 *
 *         unlocks: An array containing 3-element [dimension_index, path,
 *             when] arrays, where the dimension index is an index into
 *             the player's visited array, the path is an array
 *             containing 2-element grid position x/y arrays, and the
 *             when is a timestamp number in player-time. This stores
 *             which locations the player is currently keeping unlocked.
 *         pokes: Tracks locations that have been unlocked individually.
 *             An array holding 3-element [dimension_index, position, time]
 *             arrays that include a visited-dimension-index, a 2-element
 *             tile grid x/y coordinate position array, and a numerical
 *             player timestamp value in seconds. Each of those arrays
 *             represent a single completed poke which allows for
 *             temporarily unlocking any single tile.
 *         matches: Tracks matched word locations. An object whose keys
 *             are domain names and whose values are arrays of matches,
 *             where each match is an array that holds holds an entry
 *             index in the associated domain, a dimension index
 *             indicating which dimension the word was found in (it's an
 *             index into this player's visited dimensions list), a
 *             2-element tile grid coordinate array indicating the
 *             position of the start of the match, and a numerical player
 *             timestamp indicating when the match was found. The
 *             "_custom_" and "_personal_" keys will be used to hold
 *             matches within custom domains and against player-specific
 *             words respectively. For matches in custom dimensions, the
 *             entry index for the match will be an index into the
 *             dimension's words list. For matches against the player's
 *             personal words list, the index will be an index into that
 *             list.
 *         words_known: Tracks just the words that the player knows,
 *             independent of where they were found. An object whose keys
 *             are domain names and whose values are arrays of entry
 *             indices in those domains paired with player timestamps of
 *             when the word was most recently found. The "_custom_" and
 *             "_personal_" keys will be used to store words remembered
 *             from custom dimensions and from the player's personal
 *             words list. For the "_custom_" key, entries will simply be
 *             2-element arrays containing strings for the glyph sequence
 *             of the word that was found and the actual word itself, or
 *             just strings when the word and the glyph sequence are
 *             identical. For the "_personal_" key, entries are indices
 *             into the player's personal_words array.
 *         visited: Tracks which dimensions a player has visited. This is
 *             an array where each entry is a dimension key string (see
 *             dim__key).
 *         locations: Tracks the positions (and dimensions) that the
 *             player has teleported from, so that the player can return
 *             to a previous position. An array of 2-element arrays
 *             containing a dimension string and a position (which is a
 *             2-element tile coordinate array).
 *
 *     stats: A sub-object which keeps track of quantities that the
 *         player can upgrade permanently, including:
 *
 *         memory_limit: How many matches the player can remember at once
 *             (per domain).
 *         precise_memory_limit: How many match locations the player can
 *             remember at once (per domain; should be > memory_limit so
 *             that locations are forgotten before words).
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
 *     domain_adjustments: A sub-object that maps domain/combo names to
 *         objects with the same keys as stats (but most will be
 *         missing). These represent domain-specific stat boosts for that
 *         player, when working with words in that domain. Each value
 *         will either add to or multiply the base value for that stat,
 *         and if a domain is part of a combo, bonuses that are specific
 *         to both the domain and the combo will be applied if both
 *         exist.
 *     experience: An sub-object that tracks experience points in each of
 *         the different types of experience. Each string from EXP_TYPES
 *         is mapped to an integer. TODO: Something else less siloed?
 *     playtime: A number indicating how many seconds (& fractions of a
 *         second) of in-game time have elapsed while this player was
 *         active.
 *     personal_words: An array of two-element arrays that contain a
 *         glyph-sequence string and a word string for words that the
 *         player supplies themselves.
 *     quests: A sub-object with 'active' and 'completed' attributes,
 *         each of which are arrays of Quest objects.
 *     position: A sub-object with 'dimension' and 'pos' slots that hold
 *         the string key for the player's current dimension and a
 *         2-element x/y tile position within that dimension.
 *     glyphs_mastered: A mapping from domain names or combo names to
 *         arrays of glyphys avaiable to the player to choose from when
 *         splice.
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
            "unlocks": [],
            "pokes": [],
            "matches": {},
            "words_known": {},
            "visited": [],
            "locations": [],
        },
        "stats": {
            "memory_limit": 100,
            "precise_memory_limit": 10,
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
        "domain_adjustments": {},
        "experience": exp,
        "playtime": 0,
        "personal_words": [],
        "quests": { "active": [], "completed": [] },
        "position": { "dimension": undefined, "pos": undefined },
        "glyphs_mastered": {},
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
        if (tick_player(agent, elapsed)) {
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
    // TODO: Allow per-domain poke duration adjustments?
    let limit = compute_stat(agent, undefined, "poke_duration");
    for (let poke of agent.activity.pokes) {
        let when = poke[2];
        if (agent.playtime - when > limit) {
            let entry = content.find_poke(
                agent.activity.visited[poke[0]],
                poke[1]
            );
            content.expire_poke(agent, entry);
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
    // TODO: Per-domain EXP affinity adjustments?
    let adjust = compute_stat(
        agent,
        undefined,
        "learning_affinities." + exp_type
    );
    agent.experience[exp_type] += amount * adjust;
    // TODO: Do any other updates need to happen as a result?
}

/**
 * Computes the value of a player statistic relevant to a specific
 * dimension. Use undefined as the dimension to compute the generic stat.
 *
 * @param agent The player to compute a stat for.
 * @param domname The name of the domain to compute the stat for.
 * @param stat A string naming which statistic to compute. Must be one of
 *     the keys of the player's .stats object (see new_player).
 *
 * @return The value for the requested statistic, including any
 *     domain-specific adjustments that apply to the named domain or any
 *     of its ancestors.
 */
export function compute_stat(agent, domname, stat) {
    // Figure out method and base value
    let method = UPGRADE_METHODS[stat];
    let result = agent.stats[stat];

    // Handle nested nature of learning_affinities
    if (stat.startsWith("learning_affinities")) {
        method = UPGRADE_METHODS["learning_affinities"];
        result = agent.stats.learning_affinities[
            stat.slice("learning_affinities".length + 1)
        ];
    }

    // No adjustments for domain-free value
    if (domname == undefined) {
        return result;
    }

    // Gather adjustments
    let adjustments = [];
    let ancestors = generate.ancestor_domains(domname);
    let check = [domname, ...ancestors];
    for (let name of check) {
        if (agent.domain_adjustments[name]) {
            adjustments.push(agent.domain_adjustments[name][stat]);
        }
    }

    // Apply adjustments
    if (method[0] == '+') {
        for (let adj of adjustments) {
            result += adj;
        }
    } else { // '*'
        for (let adj of adjustments) {
            result *= adj;
        }
    }

    // Round results
    if (method[1] == "_") {
        result = Math.round(result);
    }
    return result;
}

/**
 * Adds a quest to a player's list of active quests. The quest will be
 * initialized using the player as part of that process, so it should not
 * have already been initialized. The given claim callback will be called
 * when the quest reward is claimed.
 *
 * @param agent The player to add the quest to.
 * @param quest The quest object to initialize and start tracking.
 * @param claim_callback A function to call when the quest reward is
 *     claimed. Note: if the reward includes a refresh, this callback may
 *     be called multiple times. It will be given the quest object as an
 *     argument.
 */
export function activate_quest(agent, quest, claim_callback) {
    quests.initialize_quest(
        quest,
        agent,
        function (completed_quest) {
            complete_quest(agent, completed_quest, claim_callback);
            claim_callback(completed_quest);
        }
        // TODO: retroactivity decision...
    );
    agent.quests.active.push(quest);
}

/**
 * Moves the given quest to the completed quests list and redeems its
 * associated rewards. If the quest has refreshes remaining, it will
 * remain on the active quests list but all progress will be reset (and
 * when re-initialized, retroactivity will be disabled). Note that for
 * some quest types, resetting progress is relatively meaningless, so
 * they should not be offered with refreshes as a reward.
 *
 * @param agent The player that the quest belongs to.
 * @param quest The quest that is now complete. Note that we don't check
 *     whether it's actually complete or not.
 * @param claim_callback A function to call when a quest is claimed, to
 *     be applied to any quests activated as quest rewards for this
 *     quest.
 */
export function complete_quest(agent, quest, claim_callback) {
    // Apply quest rewards
    let refreshes_remaining = claim_rewards(
        agent,
        quest.rewards,
        claim_callback
    );

    if (refreshes_remaining > 0) {
        // Reset all quest progress
        quests.initialize_quest(
            quest,
            agent,
            undefined, // use old claim function
            false
        );
        // Reduce remaining refreshes for this quest
        for (let reward of quest.rewards) {
            if (reward[0] == "refresh") {
                reward[1] = refreshes_remaining;
            }
        }
        // Note completion
        quest.completed = true;
    } else {
        // Remove from active list
        let idx = agent.quests.active.indexOf(quest);
        agent.quests.active.splice(idx, 1);
        // Add to completed list
        agent.quests.completed.push(quest);
        // Note completion
        quest.completed = true;
    }
}

/**
 * Applies a series of rewards to this player. Note that if there are
 * multiple portal and/or return rewards, the player will potentially
 * gain location history entries, but will only be placed at the last of
 * the positions they're supposed to be transported to.
 *
 * @param agent The player to apply rewards to.
 * @param rewards An array of rewards, which are 2-element arrays holding
 *     an award type string and a reward value based on that type (see
 *     quests.REWARD_TYPES).
 * @param claim_callback A function to call when a quest activated as a
 *     quest reward is claimed.
 *
 * @return An integer number of remaining refreshes based on the presence
 *     of a "refresh" reward in the rewards list, or 0 if there is no
 *     such reward.
 */
export function claim_rewards(agent, rewards, claim_callback) {
    let result = 0;
    // TODO: Animations here?
    for (let reward of rewards) {
        let [type, value] = reward;
        if (type == "exp") {
            earn_exp(agent, value[0], value[1]);
        } else if (type == "quest") {
            activate_quest(agent, value, claim_callback);
        } else if (type == "refresh") {
            result = value - 1;
        } else if (type == "portal") {
            // TODO: always true? Move MODE into the player?
            teleport(agent, value[1], value[0], true);
        } else if (type == "return") {
            let n_hist = agent.activity.locations.length;
            if (n_hist > 0) {
                let prev = agent.activity.locations[n_hist-1];
                // TODO: always true?
                teleport(agent, prev[1], prev[0], true);
            }
        } else {
            throw `Invalid reward type ${type}.`;
        }
    }
    return result;
}

/**
 * Adds a dimension to the given player's list of visited dimensions.
 * Does nothing if the player has already visited that dimension.
 *
 * @param agent The player to modify.
 * @param dimension The string key of the dimension that should be
 *     remembered.
 */
export function remember_dimension(agent, dimkey) {
    let vis = agent.activity.visited;
    if (vis.indexOf(dimkey) < 0) {
        vis.push(dimkey);
    }
}

/**
 * Add a matched word to the player's memory, including separate entries
 * for the position of the match and for the word itself. Depending on
 * memory limits, will cause the player to forget their oldest match
 * position and/or word from the same dimension.
 *
 * @param agent The player object to use (e.g., current_input_player()).
 * @param dimkey The string key of the dimension object where the match
 *     was made.
 * @param path The path of the match (an array of 2-element x/y
 *     coordinate arrays).
 * @param domain The name of the domain that the matched word belongs to,
 *     or "_custom_" if it's a word in a custom dimension that doesn't
 *     belong to the underlying domain, or "_personal_" if it's a word
 *     specific to this player. TODO: Are combos allowed?
 * @param index The index of the entry for the matched word within its
 *     domain. For personal words, it must be an index into the player's
 *     personal_words array, while for non-domain words in custom
 *     dimensions, it must be an index into that dimension's words list.
 */
export function remember_match(agent, dimkey, path, domname, index, glyphs) {
    let start = path[0]; // start of the path
    agent.position.pos = start.slice(); // remember this as current position
    let matches = agent.activity.matches;
    let known = agent.activity.words_known;

    let now = elapsed(agent);

    // Update matches
    if (!matches.hasOwnProperty(domname)) {
        matches[domname] = [];
    }
    let dim_idx = agent.activity.visited.indexOf(dimkey);
    // TODO: check for duplicates here?
    matches[domname].push([index, dim_idx, start, now]);

    // Forget old words
    // TODO: Not just by age?
    let plim = compute_stat(agent, domname, "precise_memory_limit");
    let over = matches[domname].length - plim;
    if (over > 0) {
        matches[domname] = matches[domname].slice(over);
    }

    // Update known list
    if (!known.hasOwnProperty(domname)) {
        known[domname] = [];
    }

    let entry = [index, now];
    if (domname == "_custom_") {
        // We extract entries here since we don't want to store
        // references to the dimensions the words came from (each would
        // need to include the entire word list for the dimension!)
        let dimension = dimensions.key__dim(dimkey);
        let w = dimensions.pocket_nth_word(dimension, index);
        if (typeof w == "string") {
            entry = [w, now];
        } else {
            entry = [...w, now];
        }
    }

    // Check for and delete the first duplicate
    for (let idx = 0; idx < known[domname].length; ++idx) {
        let old_entry = known[domname][idx];
        if (
            entry.length == old_entry.length
         && entry[0] == old_entry[0]
         && (
                entry.length < 3
             || entry[1] == old_entry[1]
            )
        ) {
            known[domname].splice(idx, 1);
            break;
        }
    }

    // Push new entry
    known[domname].push(entry);

    // Forget old known words
    // TODO: Not just by age?
    let mlim = compute_stat(agent, domname, "memory_limit");
    over = known[domname].length - mlim;
    if (over > 0) {
        known[domname] = known[domname].slice(over);
    }

    // Update our active quests
    for (let quest of agent.quests.active) {
        quests.update_quest(quest, glyphs, path, agent.position.dimension);
    }
}

/**
 * Given a domain name and an entry stored in the format used by the
 * words_known list, returns a 3-element array containing a glyphs
 * string, a word string, and a player timestamp for that entry.
 *
 * @param agent The player that the word is known by.
 * @param domname The name of the domain associated with the entry.
 *     "_custom_" and "_private" have special meanings.
 * @param known_entry The entry from the words_known list to look up; see
 *     the new_player documentation.
 *
 * @return A 3-element array containing a glyphs string, a word string,
 *     and a player timestamp. Returns undefined if a required domain is
 *     not yet loaded.
 */
export function retrieve_word(agent, domname, known_entry) {
    if (domname == "_custom_") {
        if (known_entry.length == 2) {
            return [known_entry[0], known_entry[0], known_entry[1]];
        } else {
            return known_entry.slice();
        }
    } else if (domname == "_personal_") {
        let idx = known_entry[0];
        return [...agent.personal_words[idx], known_entry[1]];
    } else {
        let dobj = dict.lookup_domain(domname);
        if (dobj == undefined) {
            return undefined;
        }
        let idx = known_entry[0];
        let dentry = dobj.entries[idx];
        return [dentry[0], dentry[1], known_entry[1]];
    }
}

/**
 * Returns an array containing all of the words known by the player for
 * the given domain.
 *
 * @param agent The player to query.
 * @param domname The string name of the domain of interest.
 *
 * @return An array of 3-element arrays containing a string of glyphs,
 *     then a word string, and then a player timestamp indicating when
 *     the word was found. Returns undefined when the relevant domain is
 *     not currently loaded.
 */
export function known_words(agent, domname) {
    let wl = agent.activity.words_known[domname];
    let result = [];
    for (let entry of wl) {
        let normalized = retrieve_word(agent, domname, entry);
        if (normalized == undefined) {
            return undefined;
        }
        result.push(normalized);
    }
    return result;
}

/**
 * Returns an array of words recently found by the given player, across
 * all domains.
 *
 * @param agent The player to query.
 * @param horizon (optional) The number of seconds into the past to
 *     include words from. Defaults to 3600 (one hour).
 *
 * @return An array of 4-element arrays each containing a domain name, a
 *     glyphs string, a word string, and a timestamp indicating when it
 *     was most recently matched. The array will be grouped by domain and
 *     then sorted by time matched. Words associated with
 *     currently-unloaded domains will be omitted from the result.
 *     TODO: Group by locale, not by domain!
 */
export function recent_words(agent, horizon) {
    if (horizon == undefined) { horizon = 3600; }
    let result = [];
    let now = elapsed(agent);

    for (let domname of Object.keys(agent.activity.words_known)) {
        let entries = agent.activity.words_known[domname];
        let recent = false;
        let idx;
        for (idx = 0; idx < entries.length; ++idx) {
            let entry = entries[idx];
            if (!recent) {
                let when = entry[entry.length - 1];
                if (now - when <= horizon) {
                    recent = true;
                }
            }
            // Note: there's a reason this is not an elif!
            if (recent) {
                let normalized = retrieve_word(agent, domname, entry);
                if (normalized == undefined) {
                    return undefined;
                }
                result.push([domname, ...normalized]);
            }
        }
    }

    return result;
}

/**
 * Adds an entry to the player's unlocked words list, which specifies
 * the dimension and path that were unlocked. The player must have
 * already visited the dimension in which the unlock is happening, or an
 * error will be thrown.
 *
 * @param agent The player to update.
 * @param dimkey The string key of the dimension where the word was unlocked.
 * @param path The path (an array of 2-element grid coordinate x/y
 *     arrays) that was unlocked.
 */
export function add_unlocked(agent, dimkey, path) {
    let unlocks = agent.activity.unlocks;
    let dim_idx = agent.activity.visited.indexOf(dimkey);
    if (dim_idx < 0) {
        throw "Tried to add an unlocked entry for an unvisited dimension.";
    }

    // ignore duplicates
    for (var i = 0; i < unlocks.length; ++i) {
        if (
            utils.equivalent(
                [unlocks[i][0], unlocks[i][1]],
                [dim_idx, path]
            )
        ) {
            return;
        }
    }

    // add this unlock to our list
    unlocks.push([dim_idx, path, elapsed(agent)]);
    // inform the content system of our support for a new unlock
    content.unlock_path(agent, dimkey, path);

    // check whether we need to expire one of our unlocks
    let expired = limit_unlocked(agent);
    for (let exp of expired) {
        let entry = content.find_unlocked(
            agent.activity.visited[exp[0]],
            exp[1]
        );
        content.expire_unlocked(agent, entry);
    }

    // Always recalculate energies after expiration is handled
    content.recalculate_unlocked_energies();
}

/**
 * Checks the given player's unlock limit, and removes old entries from
 * their unlocked words list which are in excess of that limit. Returns
 * an array of the removed entries.
 *
 * @param agent The player to update.
 *
 * @return An array of 2-element [dimension-index, path] arrays
 *     specifying which entries were removed from the player's unlocked
 *     list. When nothing was removed, this will be an empty array.
 */
export function limit_unlocked(agent) {
    let limit = compute_stat(agent, undefined, "unlock_limit");
    let over = agent.activity.unlocks.length - limit;
    let result = [];
    if (over > 0) {
        result = agent.activity.unlocks.splice(0, over).map(x => [x[0], x[1]]);
    }
    return result;
}

/**
 * Records the given player's support for holding a single position
 * unlocked via a "poke." Throws an error if the given agent has never
 * visited the specified dimension.
 *
 * @param agent The player who is performing the poke.
 * @param dimkey The string key of the dimension where it occurs.
 * @param pos A 2-element grid position x/y array specifying the location
 *     of the poke.
 */
export function add_poke(agent, dimkey, pos) {
    let didx = agent.activity.visited.indexOf(dimkey);
    if (didx < 0) {
        throw "Attempted to poke tile in unvisited dimension.";
    }
    agent.activity.pokes.push([didx, pos, elapsed(agent)]);

    content.unlock_poke(agent, dimkey, pos);

    let expired = limit_pokes(agent);
    for (let exp of expired) {
        let entry = content.find_poke(agent.activity.visited[exp[0]], exp[1]);
        content.expire_poke(agent, entry);
    }

    // Always recalculate energies after expirations are handled
    content.recalculate_unlocked_energies();
}

/**
 * Works just like limit_unlocked, but for pokes instead of unlocked
 * words.
 *
 * @param agent The player to update.
 *
 * @return An array of 2-element [dimension-index, position] arrays
 *     specifying which entrie(s) were removed from the player's pokes
 *     list.
 */
export function limit_pokes(agent) {
    let limit = compute_stat(agent, undefined, "poke_limit");
    let over = agent.activity.pokes.length - limit;
    let result = [];
    if (over > 0) {
        result = agent.activity.pokes.splice(0, over).map(x => [x[0], x[1]]);
    }
    return result;
}

/**
 * Changes the player's current position and possibly which dimension
 * they're in. The player's position and dimension before the teleport
 * will be remembered in the player's location history.
 *
 * Swaps dimensions and moves the viewport to center the given
 * coordinates. Except in "free" mode, also unlocks a few tiles around
 * the given destination.
 *
 * @param agent The player to move.
 * @param coordinates The coordinates to move to.
 * @param dimkey (optional) The string key of the dimension to swap to.
 * @param unlock_nearby (optional) If true, a 7-tile area centered on the
 *      destination will be unlocked.
 */
export function teleport(agent, coordinates, dimkey, unlock_nearby) {
    if (
        agent.position.dimension != undefined
     && agent.position.pos != undefined
    ) {
        agent.activity.locations.push(
            [agent.position.dimension, agent.position.pos.slice()]
        );
    }

    if (dimkey) {
        agent.position.dimension = dimkey;
        remember_dimension(agent, dimkey);
    }
    if (unlock_nearby) {
        let x = coordinates[0];
        let y = coordinates[1];
        let nearby = [
            [x, y],
            [x, y+1],
            [x-1, y],
            [x-1, y-1],
            [x, y-1],
            [x+1, y],
            [x+1, y+1],
        ];
        // TODO: Unlock these as unremembered tiles instead of as a path.
        add_unlocked(
            agent,
            agent.position.dimension,
            nearby
        );
    }
}

/**
 * Call this to add a glyph to a player's list of mastered glyphs for a
 * certain domain. If the player has already mastered the glyph, a
 * warning will appear in the console.
 *
 * @param agent The player mastering the glyph
 * @param glyph The letter being mastered
 * @param domain_name The name of a domain or combo to master the glyph
 *     in.
 *     TODO: Should this be a locale instead?
 *
 * @return The array of strings representing glyphs mastered in the given
 *     domain by the player, which now includes the given glyph at the
 *     end.
 */
export function master_glyph(agent, glyph, domain_name) {
    let domain_mastered = agent.glyphs_mastered[domain_name];

    if (domain_mastered === undefined){
        domain_mastered = [glyph];
        agent.glyphs_mastered[domain_name] = domain_mastered;
    } else if (domain_mastered.includes(glyph)) {
        console.log("glyph already mastered!");
    } else{
        domain_mastered.push(glyph);
    }
    return domain_mastered;
}

/**
 * Returns an array of 5-element match entries specifying any matches
 *
 * @param agent The player to ask for matches.
 * @param glyphs The glyph sequence to match.
 *
 * @return An array of 5-element match entries containing:
 *     0: The string "_personal_"
 *     1: The index of the match within the player's known_words array.
 *     2: The glyph string that matched.
 *     3: The associated word.
 *     4: The number 1 (default frequency).
 * between the given glyph sequence and a player's personal words list.
 */
export function personal_matches(agent, glyphs) {
    let result = [];
    for (let idx = 0; idx < agent.personal_words.length; ++idx) {
        let entry = agent.personal_words[idx];
        if (entry[0] == glyphs) {
            result.push(["_personal_", idx, entry[0], entry[1], 1]);
        }
    }
    return result;
}
