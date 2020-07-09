// generate.js
// Generates hex grid supertiles for word puzzling.
/* global console */

"use strict";

import * as anarchy from "../anarchy.mjs";
import * as dict from "./dict.js";
import * as grid from "./grid.js";
import * as dimensions from "./dimensions.js";
import * as caching from "./caching.js";
import * as active from "./active.js";

/**
 * Whether or not to issue warnings to the console.
 */
var WARNINGS = true;

/**
 * Whether to show sockets using tile colors or not.
 */
var DEBUG_SHOW_SOCKETS = false;

/**
 * Toggles whether socket colors should be attached to any new supertiles
 * we generate (doesn't affect existing supertiles).
 */
export function toggle_socket_colors() {
    DEBUG_SHOW_SOCKETS = !DEBUG_SHOW_SOCKETS;
}

/**
 * Whether to double-check assignment overlap when computing ultratile
 * context.
 */
var CHECK_ASSIGNMENT_OVERLAP = true;

/**
 * Min/max number of active elements in each ultratile.
 */
var MIN_ACTIVE_PER_ULTRATILE = Math.floor(grid.ULTRATILE_SUPERTILES/6);
var MAX_ACTIVE_PER_ULTRATILE = Math.floor(grid.ULTRATILE_SUPERTILES/3);

/**
 * Number of attempts to make before giving up on embedding.
 */
var EMBEDDING_ATTEMPTS = 500;

/**
 * Number of worm-based embedding attempts to make for an overlength
 * supertile before falling back to a pattern-based embedding.
 */
var OVERLENGTH_WORM_ATTEMPTS = 5;

/**
 * Number of sockets retained in an overlength-primary ultratile.
 */
var OVERLENGTH_ULTRATILE_SOCKETS = Math.floor(2*grid.ULTRATILE_SUPERTILES/3);

/**
 * Word length to ignore when filling worms.
 */
var WORM_FILL_SKIP = 2;

/**
 * If this many or more of the words in a domain are shorter than the
 * WORM_FILL_SKIP value, reduce the skip value to compensate until the
 * skipped words account for this many or fewer of the domain's words.
 */
var WORM_FILL_SKIP_BACKOFF_RATIO = 0.1;

/**
 * Minimum number of spaces to leave empty during worm-based augmentation.
 */
var WORMS_LEAVE_EMPTY = 5;

/**
 * Smoothing for glyph table sampling.
 *
 * TODO: Are the tables this gets applied to normalized?!? We should
 * really apply % smoothing, not absolute smoothing!
 */
var GLYPH_SMOOTHING = 1.5;

/**
 * Limits on the fraction of an available assignment grid spaces that can be
 * made up of inclusions. Computed as a fraction of remaining spaces after
 * MAX_LOCAL_INCLUSION_DENSITY and edge restrictions have been accounted for.
 * Actual inclusion density of each assignment grid tile is randomized.
 */
var MIN_INCLUSION_DENSITY = 0.03;
var MAX_INCLUSION_DENSITY = 0.2;

/**
 * Maximum fraction of a single ultragrid cell that can be assigned to
 * inclusions. Actually a fraction of the non-edge locations, instead of
 * fraction of the entire cell.
 */
var MAX_LOCAL_INCLUSION_DENSITY = 0.7;

/**
 * roughness of inclusions distribution
 */
var INCLUSION_ROUGHNESS = 0.75;

/**
 * Min/max sizes for inclusions (measured in assignment slots).
 */
var INCLUSION_MIN_SIZE = 6;
var INCLUSION_MAX_SIZE = 35;

/**
 * Cache size for multiplanar info:
 */
var MULTIPLANAR_INFO_CACHE_SIZE = 4096;

/**
 * Cache size for pocket dimension layouts
 */
var POCKET_LAYOUT_CACHE_SIZE = 128;

/**
 * All known combined domains.
 */
var DOMAIN_COMBOS = {
    "English": [ "adj", "adv", "noun", "verb", "stop" ]
};
// TODO: Allow words found in combo domains to appear in a common list!?!

/**
 * All possible basic paths through a single half-socket.
 * There are 46, defined here in the SE socket including anchors (see
 * EDGE_SOCKET_ANCHORS).
 *
 * The diagram below labels each tile in a supertile with its socket
 * index, showing all 6 half-sockets (the central tile is not part of a
 * socket). Within the south-east socket (socket index 0) it also labels
 * the three possible entry points referred to as 'sites.' Each
 * permutation entry in this array is a 2-element array pairing a site
 * index with an array of movement directions that trace out a particular
 * path through all tiles in the half-socket.
 *
 * ```
 *
 *                    2
 *                2       3
 *            2       2       3
 *        1       2       3       3
 *            1       2       3
 *        1       1       3       4
 *            1       6       4
 *        1       0       4       4
 * sites      0       5       4
 *  0 ->  0       0       5       4
 *  1 ----->  0       5       5
 *  2 --------->  0       5
 *                   5
 * ```
 *
 * This diagram shows the index of each tile in the south-east
 * half-socket according to the first permutation in our list:
 *
 * ```
 *                2
 *            1
 *        0       3
 *            4
 *                5
 * ```
 */
var BASE_PERMUTATIONS = [
    // 16 from the top-left
    [0, [ grid.NE, grid.NE, grid.S, grid.SW, grid.SE ]],
    [0, [ grid.NE, grid.NE, grid.S, grid.S, grid.NW ]],
    [0, [ grid.NE, grid.SE, grid.N ]],
    [0, [ grid.NE, grid.SE, grid.SW, grid.SE ]],
    [0, [ grid.NE, grid.SE, grid.S, grid.NW ]],
    [0, [ grid.NE, grid.S, grid.SE, grid.N, grid.N ]],
    [0, [ grid.NE, grid.S, grid.NE, grid.N ]],
    [0, [ grid.NE, grid.S, grid.NE, grid.S ]],

    [0, [ grid.SE, grid.N, grid.NE, grid.S, grid.S ]],
    [0, [ grid.SE, grid.N, grid.SE, grid.N ]],
    [0, [ grid.SE, grid.N, grid.SE, grid.S ]],
    [0, [ grid.SE, grid.NE, grid.NW, grid.NE ]],
    [0, [ grid.SE, grid.NE, grid.N, grid.SW ]],
    [0, [ grid.SE, grid.NE, grid.S ]],
    [0, [ grid.SE, grid.SE, grid.N, grid.NW, grid.NE ]],
    [0, [ grid.SE, grid.SE, grid.N, grid.N, grid.SW ]],

    // 14 from the middle
    [1, [ grid.NW, grid.NE, grid.NE, grid.S, grid.S ]],
    [1, [ grid.NW, grid.NE, grid.SE, grid.N ]],
    [1, [ grid.NW, grid.NE, grid.SE, grid.S ]],

    [1, [ grid.N, grid.SW ]],
    [1, [ grid.N, grid.NE, grid.S, grid.S ]],
    [1, [ grid.N, grid.SE, grid.N ]],
    [1, [ grid.N, grid.SE, grid.S ]],

    [1, [ grid.NE, grid.S ]],
    [1, [ grid.NE, grid.NW, grid.SW ]],
    [1, [ grid.NE, grid.NW, grid.NE ]],
    [1, [ grid.NE, grid.N, grid.SW, grid.SW ]],

    [1, [ grid.SE, grid.N, grid.NW, grid.SW ]],
    [1, [ grid.SE, grid.N, grid.NW, grid.NE ]],
    [1, [ grid.SE, grid.N, grid.N, grid.SW, grid.SW ]],

    // 16 from the bottom-right
    [2, [ grid.NW, grid.NW, grid.NE, grid.NE, grid.S ]],
    [2, [ grid.NW, grid.NW, grid.NE, grid.SE, grid.N ]],
    [2, [ grid.NW, grid.N, grid.SW ]],
    [2, [ grid.NW, grid.N, grid.NE, grid.S ]],
    [2, [ grid.NW, grid.N, grid.SE, grid.N ]],
    [2, [ grid.NW, grid.NE, grid.NW, grid.SW ]],
    [2, [ grid.NW, grid.NE, grid.NW, grid.NE ]],
    [2, [ grid.NW, grid.NE, grid.N, grid.SW, grid.SW ]],

    [2, [ grid.N, grid.SW, grid.NW, grid.NE, grid.NE ]],
    [2, [ grid.N, grid.SW, grid.N, grid.SW ]],
    [2, [ grid.N, grid.SW, grid.N, grid.NE ]],
    [2, [ grid.N, grid.NW, grid.SW, grid.SE ]],
    [2, [ grid.N, grid.NW, grid.S, grid.NW ]],
    [2, [ grid.N, grid.NW, grid.NE ]],
    [2, [ grid.N, grid.N, grid.SW, grid.SW, grid.SE ]],
    [2, [ grid.N, grid.N, grid.SW, grid.S, grid.NW ]],
];

/**
 * Index first by a socket index and then again by an anchor number to
 * retrieve the position of the anchor in that socket.
 */
var EDGE_SOCKET_ANCHORS = [
    [ [0, 3], [0, 2], [0, 1] ],
    [ [3, 6], [2, 5], [1, 4] ],
    [ [6, 6], [5, 6], [4, 6] ],
    [ [6, 3], [6, 4], [6, 5] ],
    [ [3, 0], [4, 1], [5, 2] ],
    [ [0, 0], [1, 0], [2, 0] ],
];

/**
 * Which permutation-site-value combinations are valid for crossover
 */
var CROSSOVER_POINTS = [
    [1, 2],
    [2, 1],
    [2, 2]
];

/**
 * Add rotations to compute per-socket permutations:
 */
var SOCKET_PERMUTATIONS = [];
var rotated = BASE_PERMUTATIONS;
for (var socket = 0; socket < grid.COMBINED_SOCKETS; ++socket) {
    SOCKET_PERMUTATIONS.push([]);
    for (var i = 0; i < rotated.length; ++i) {
        var site = rotated[i][0];
        var dirs = rotated[i][1];
        // Base is defined for socket 6, so rotate before appending:
        rotated[i] = [ site, grid.rotate_directions(dirs, 1) ];
        SOCKET_PERMUTATIONS[socket].push(
            [ rotated[i][0], EDGE_SOCKET_ANCHORS[socket][site], rotated[i][1] ]
        );
    }
}

/**
 * Lists domains in a given combo, or returns just the domain given to
 * it.
 *
 * @param domain_or_combo A string naming either a domain or a combo.
 *
 * @return An array of all domains in the given group or combo.
 */
export function domains_list(domain_or_combo) {
    if (DOMAIN_COMBOS.hasOwnProperty(domain_or_combo)) {
        let result = [];
        DOMAIN_COMBOS[domain_or_combo].forEach(function (d) {
            domains_list(d).forEach(function (rd) {
                result.push(rd);
            });
        });
        return result;
    } else {
        return [ domain_or_combo ];
    }
}

/**
 * Returns a list of all domains within which the given domain (or combo)
 * is a sub-domain. Does not include ancestors.
 *
 * @param domain_or_combo A string naming a domain or combo.
 *
 * @return An array of domain/combo name strings.
 */
export function parent_domains(domain_or_combo) {
    let name = dict.name_of(domain_or_combo);
    let parents = [];
    for (let cd of Object.keys(DOMAIN_COMBOS)) {
        let sub = DOMAIN_COMBOS[cd];
        if (sub.includes(name)) {
            parents.push(cd);
        }
    }
    return parents;
}

/**
 * Returns a list of all ancestor domains of the given domain (or combo).
 *
 * @param domain_or_combo A string naming a domain or a combo.
 *
 * @return An array of domain/combo name strings.
 */
export function ancestor_domains(domain_or_combo) {
    let name = dict.name_of(domain_or_combo);
    let ancestors = {};
    let check = [ name ];
    while (check.length > 0) {
        let here = check.pop();
        for (let p of parent_domains(here)) {
            if (!ancestors[p]) {
                ancestors[p] = true;
                check.push(p);
            }
        }
    }
    return Object.keys(ancestors);
}

/**
 * Mixes two seeds (variables) using a third offset (constant).
 *
 * @param s1 An integer rng seed.
 * @param s2 An integer rng seed.
 * @param off Another integer to mix in.
 *
 * @return An integer seed that depends on all three parameters.
 */
export function mix_seeds(s1, s2, off) {
    return (
        anarchy.prng(s1, 1731)
        ^ anarchy.prng(s2, off)
    );
}

/**
 * Hashes a seed and a supergrid position together into a combined seed
 * value.
 *
 * @param seed A integer seed value.
 * @param sgp A 2-element x/y supergrid position array.
 *
 * @return An integer seed that depends on both parameters.
 */
export function sghash(seed, sgp) {
    var r = anarchy.prng(
        sgp[0] ^ anarchy.prng(
            sgp[1],
            seed + 18921
        ),
        1748120
    );
    for (var i = 0; i < 1 + (sgp[0] + sgp[1] + seed) % 3; ++i) {
        r = anarchy.prng(r, seed);
    }
    return r;
}

/**
 * Computes the seed for an ultratile.
 *
 * @param ugp A 2-element x/y ultragrid position array.
 * @param dimension A dimension object.
 * @param world_seed The world seed (an integer).
 */
export function ultratile_seed(ugp, dimension, world_seed) {
    return sghash(world_seed ^ dimensions.seed(dimension), ugp);
}

/**
 * Samples a table of weights.
 *
 * @param table An object where values are numbers indicating relative
 *     weights to use for sampling.
 * @param seed An integer seed that will determine the result. Don't
 *     expect good uncorrelated samples if you pass in consecutive
 *     integer seeds, instead use anarchy.prng to move from one seed to
 *     the next for multiple samples.
 * @param smoothing (optional) A value that will be added to each table
 *     entry when determining relative probabilities, to make
 *     small-weight items relatively more likely. Defaults to 0 when
 *     omitted.
 *
 * @return One of the keys of the provided object, with probability
 *     proportional to its weight plus the smoothing value.
 */
export function sample_table(table, seed, smoothing) {
    if (smoothing == undefined) {
        smoothing = 0;
    }
    var total_weight = 0;
    for (var e in table) {
        if (table.hasOwnProperty(e)) {
            total_weight += table[e] + smoothing;
        }
    }
    var r = anarchy.udist(seed) * total_weight;

    var last = undefined;
    var selected = null;
    for (let e of Object.keys(table)) {
        selected = e;
        r -= table[e] + smoothing;
        if (r < 0) {
            break;
        }
    }
    return selected;
}

/**
 * Sample a glyph from counts given context, falling back to smaller
 * amounts of context/less complicated counts when other info isn't
 * available. context, bicounts, and tricounts may individually be given as
 * 'undefined.'
 *
 * @param seed An integer seed value that determines the result. Don't
 *     expect nice variation in results if you are giving it sequential
 *     integer seeds; use anarchy.prng to determine each seed instead.
 * @param context A string or array of glyphs; the first up-to-2 elements
 *     of which will be used to determine glyph probabilities. If this is
 *     an empty array, the unicounts will be used.
 * @param unicounts An object whose keys are glyph strings and whose
 *     values are weights for each glyph.
 * @param bicounts (optional) An object whose keys are glyph strings, and
 *     whose values are tables with the same format as unicounts.
 * @param tricounts (optional) An object whose keys are glyph strings,
 *     and whose values are tables with the same format as bicounts.
 */
export function sample_glyph(seed, context, unicounts, bicounts, tricounts) {
    var table = undefined;
    if (context != undefined && context.length >= 2 && tricounts != undefined) {
        // try tricounts
        if (tricounts.hasOwnProperty(context[0])) {
            if (tricounts[context[0]].hasOwnProperty(context[1])) {
                table = tricounts[context[0]][context[1]];
            }
        }
    }
    if (
        table == undefined
     && context != undefined
     && context.length >= 1
     && bicounts != undefined
    ) {
        // try bicounts
        if (bicounts.hasOwnProperty(context[0])) {
            table = bicounts[context[0]];
        }
    }
    if (table == undefined) {
        // unicounts must be given!
        table = unicounts;
    }
    return sample_table(table, seed, GLYPH_SMOOTHING);
}

/**
 * Distorts the given probability distribution (an object mapping options
 * to probabilities) according to the given bias value, which should be
 * between -1 and 1. A bias value of -1 skews the distribution towards
 * uncommon values, while a bias value of +1 skews it even more towards
 * already-common values. A bias value of zero returns the base
 * probabilities unchanged. The probability values should all be between 0
 * and 1, and should sum to 1.
 *
 * @param probabilities An object whose values are probability weights
 *     between 0 and 1, and which sum to 1 across all keys.
 * @param bias A number between -1 and 1 indicating how far towards
 *     common (positive) or uncommon (negative) values to distort the
 *     probabilities.
 *
 * @return A new probability table object with the same keys as the
 *     original and altered weights.
 */
export function distort_probabilities(probabilities, bias) {
    let result = {};
    var newsum = 0;
    var exp = 1;
    if (bias < 0) {
        exp = 1/(1 + (-bias*4));
    } else if (bias > 0) {
        exp = (1 + bias*4);
    }
    // distort
    for (let k in probabilities) {
        if (probabilities.hasOwnProperty(k)) {
            var adj = Math.pow(probabilities[k], exp);
            newsum += adj;
            result[k] = adj;
        }
    }
    // re-normalize:
    for (let k in result) {
        if (result.hasOwnProperty(k)) {
            result[k] /= newsum;
        }
    }
    return result;
}

/**
 * Returns an array containing keys from the items dictionary shuffled
 * according to their values. See:
 * https://softwareengineering.stackexchange.com/questions/233541/how-to-implement-a-weighted-shuffle
 *
 * @param items An object whose values are numerical weights.
 * @param seed An integer seed that determines the outcome.
 *
 * @return An array containing each of the keys of the items object,
 *     shuffled in such a way that items with higher weights are more
 *     likely to appear near the beginning of the shuffle.
 */
export function weighted_shuffle(items, seed) {
    var array = [];
    for (var k of Object.keys(items)) {
        var w = items[k];
        array.push([k, w * anarchy.expdist(seed)]);
        seed = anarchy.lfsr(seed);
    }

    // Weighted random shuffle -> sort by expdist * weight
    array.sort(function (a, b) { return a[1] - b[1]; });

    var result = [];
    for (var i = 0; i < array.length; ++i) {
        result.push(array[i][0]);
    }
}

/**
 * Returns an ordered list of keys, shuffled with bias. The bias value
 * should be between -1 and 1 and controls how much bias there is towards
 * (or away from, for negative values) more-common glyph sequences.
 *
 * @param index An index object created by create_index from
 *     finalize_dict.js. It should have a _count_ key containing the
 *     total number of entries in the index, and each other key should be
 *     a glyph which maps to another index. The entry for '^D' maps to an
 *     integer indicating a word index within an entries array, if the
 *     sequence of glyphs leading to this index object forms a complete
 *     valid word.
 * @param seed An integer seed that determines the outcome.
 * @param bias A bias value between -1 and +1 which determines whether
 *     infrequent glyphs are more (positive) or less (negative) likely
 *     than their base abundances to appear early in the resulting list.
 *
 * @return An array of the keys in the given index, except for "_count_"
 *     and "^D". Keys (glyphs) whose sub-index values have more entries
 *     are more likely to appear earlier in this array.
 */
export function index_order(index, seed, bias) {
    var bc = index["_count_"];
    var probs = {};
    var n_keys = 0;
    for (var key of Object.keys(index)) {
        if (key != dict.EOS && key != "_count_") {
            n_keys += 1;
            if (Array.isArray(index[key])) {
                probs[key] = index[key].length / bc;
            } else {
                probs[key] = index[key]["_count_"] / bc;
            }
        }
    }
    if (index.hasOwnProperty(dict.EOS)) {
        probs[dict.EOS] = 1/bc;
    }
    probs = distort_probabilities(probs, bias);
    return weighted_shuffle(probs, seed);
}

/**
 * Sample a word from the given domain, weighted according to word
 * frequencies. Up to max_attempts (default 20) will be made to find a word
 * no longer than max_len before giving up, in which case a flat-weighted
 * word under that length will be returned, or undefined if there are no
 * such words in the given domain. Returns a [glyphs, word, frequency]
 * triple. If max_len is not given, max_attempts will be ignored, all words
 * will be considered and undefined will never result.
 *
 * @param domain A domain object to pick a word from, or a string naming
 *     a domain or combo.
 * @param seed An integer seed that determines the result. Don't expect
 *     nicely random results from sequential integer seeds; use
 *     anarchy.prng or similar to generate successive seed values for
 *     multiple sampling.
 * @param max_len The desired maximum length of the word to be chosen.
 *     May be supplied as undefined, in which case any word from the
 *     domain can be chosen.
 * @param max_attempts How many attempts to make at weighted sampling
 *     before giving up and using unweighted sampling to ensure a word
 *     that's not too long. Irrelevant when max_len is undefined.
 *
 * @return A domain entry (a 3-element array containing a glyphs array, a
 *     word string, and a frequency integer) chosen at random from the
 *     words in the domain no longer than the given maximum length, with
 *     probability roughly proportional to its frequency relative to
 *     other words that are short enough.
 */
export function sample_word(domain, seed, max_len, max_attempts) {
    var domain_objs = domain_objects(domain);
    let combined_total = domain_objs
        .map(d => d.total_count)
        .reduce((a, b) => a + b);

    if (max_len == undefined) {
        let n = anarchy.cohort_shuffle(712839, combined_total, seed);
        let i = 0;
        while (n >= domain_objs[i].total_count) {
            n -= domain_objs[i].total_count;
            i += 1;
        }
        return dict.unrolled_word(n, domain_objs[i]);
    }

    if (max_attempts == undefined) {
        max_attempts = 20;
    }

    for (let i = 0; i < max_attempts; ++i) {
        let ii = anarchy.cohort_shuffle(i, combined_total, seed);
        let di = 0;
        while (ii >= domain_objs[di].total_count) {
            ii -= domain_objs[di].total_count;
            di += 1;
        }
        let dom = domain_objs[di];
        let entry = dict.unrolled_word(ii, dom);
        if (entry[0].length <= max_len) {
            return entry;
        }
    }
    let short_total = domain_objs
        .map(d => dict.words_no_longer_than(d, max_len))
        .reduce((a, b) => a + b);
    if (short_total == 0) {
        return undefined; // no words short enough
    }
    let n = anarchy.cohort_shuffle(712839, short_total, seed);
    let di = 0;
    let short_words = dict.words_no_longer_than(domain_objs[di], max_len);
    while (n >= short_words) {
        n -= short_words;
        di += 1;
        short_words = dict.words_no_longer_than(domain_objs[di], max_len);
    }
    // undefined if none exists:
    return dict.nth_short_word(domain_objs[di], max_len, n);
}

/**
 * Computes the cost in sockets of a given number of overlength supertiles
 * within an ultragrid cell.
 *
 * @param ol_tiles How many tiles in an ultratile to dedicate to
 *     overlength words.
 *
 * @return The number of sockets that become unavailable as a result of
 *     dedicating the given number of supertiles to overlength words.
 */
export function overlength_socket_cost(ol_tiles) {
    return (
        ol_tiles * 2 * grid.ASSIGNMENT_SOCKETS
        - overlength_supertile_connections(ol_tiles)
    );
}

/**
 * Returns the number of adjacencies between overlength supertiles that
 * should be created within an ultragrid layout.
 *
 * @param ol_tiles How many supertiles to dedicate to overlength words
 *     within a single ultratile.
 *
 * @return An integer number of adjacencies between overlength supertiles
 *     within the ultratile that should be created to conserve ultratile
 *     sockets.
 */
export function overlength_supertile_connections(ol_tiles) {
    return Math.min(9, Math.floor(ol_tiles * 3/8));
}

/**
 * Computes the number of overlength supertiles per ultratile for the given
 * domain.
 *
 * @param domain_name A string naming a domain or combo.
 *
 * @return a 3-element array:
 *     1. Whether ultratiles in this domain are primarily overlength.
 *     2. The number of overlength superiles.
 *     3. The number of sockets used up by the overlength supertiles.
 */
export function overlength_allowance(domain_name) {
    // Density of overlength tiles in this assignment grid unit
    let olpar = overlength_per_assignment_region(domain_name);
    if (olpar == undefined) {
        return undefined;
    }
    let ol_tile_count = Math.ceil(
        olpar
        / grid.ASSIGNMENT_REGION_TOTAL_SUPERTILES
    );
    let ol_capacity = (grid.ULTRAGRID_SIZE - 2) * (grid.ULTRAGRID_SIZE - 2);
    let ol_socket_cost;
    let overlength_primary = false;
    if (ol_tile_count >= 0.25 * ol_capacity) {
        // Phase change: with so many overlength words, we move to an
        // overlength-primary model of word assignment.
        // Each supertile now gets only a single socket (except eight,
        // which get none) and the primary assignment basis for all words
        // is to supertiles instead of to sockets.
        ol_tile_count = grid.ULTRATILE_SUPERTILES;
        ol_socket_cost = grid.ULTRATILE_SOCKETS - OVERLENGTH_ULTRATILE_SOCKETS;
        overlength_primary = true;
    } else {
        // Overlength words can be reasonably accommodated by the normal
        // allowance mechanism.
        ol_socket_cost = overlength_socket_cost(ol_tile_count);
    }

    return [
        overlength_primary,
        ol_tile_count,
        ol_socket_cost
    ];
}

/**
 * Takes a domain name and an ultragrid position and returns parameters
 * used to decide the layout of that ultratile.
 *
 * @param domain_name A string naming a domain or combo.
 * @param ugp A 2-element ultragrid position array of x/y coordinates.
 *
 * @return An array:
 *     1. Whether or not this ultratile is an overlength-primary tile.
 *     2. The number of non-inclusion assignment positions within this tile's
 *        assignment grid tile prior to it.
 *     3. The number of inclusion assignment positions within this ultratile.
 *     4. The number of non-inclusion supertiles within this assignment grid
 *        tile prior to this ultratile.
 *     5. The number of inclusion supertiles within this ultratile.
 *
 *     Returns undefined if domain content isn't loaded yet.
 */
export function ultratile_punctuation_parameters(domain_name, ugp) {
    // assignment grid position
    var ag_x = ugp[0] / grid.ASSIGNMENT_REGION_SIDE;
    var ag_y = ugp[1] / grid.ASSIGNMENT_REGION_SIDE;

    // ultragrid position
    var ug_x = ugp[0] % grid.ASSIGNMENT_REGION_SIDE;
    var ug_y = ugp[1] % grid.ASSIGNMENT_REGION_SIDE;
    ug_x = (ug_x + grid.ASSIGNMENT_REGION_SIDE) % grid.ASSIGNMENT_REGION_SIDE;
    ug_y = (ug_y + grid.ASSIGNMENT_REGION_SIDE) % grid.ASSIGNMENT_REGION_SIDE;

    // density of overlength tiles in this assignment grid unit:
    let ol_allowance = overlength_allowance(domain_name);
    if (ol_allowance == undefined) {
        return undefined;
    }
    let ol_primary = ol_allowance[0];
    let ol_tiles = ol_allowance[1];
    let ol_socket_cost = ol_allowance[2];

    // Size of each segment in sockets:
    let segment_full_size = grid.ULTRATILE_SOCKETS - ol_socket_cost;

    // segment parameters:
    let segment = ug_x + grid.ASSIGNMENT_REGION_SIDE * ug_y;
    let n_segments = grid.ASSIGNMENT_REGION_SIDE * grid.ASSIGNMENT_REGION_SIDE;

    // defaults:
    let asg_incl_here = 0;
    let asg_nat_prior = segment_full_size * segment;
    let ol_incl_here = 0;
    let ol_nat_prior = ol_tiles * segment;

    // density of inclusions in this assignment grid unit:
    let d_seed = anarchy.lfsr(mix_seeds(ag_x, ag_y, 8190813480));
    let incl_density = (
        MIN_INCLUSION_DENSITY
      + anarchy.udist(d_seed) * (MAX_INCLUSION_DENSITY - MIN_INCLUSION_DENSITY)
    );
    d_seed = anarchy.lfsr(d_seed);

    if (ol_primary) {
        // Inclusions are among overlength supertiles, not sockets:
        let segment_capacity = Math.floor(
            MAX_LOCAL_INCLUSION_DENSITY
            * ol_tiles
        );

        // total number of supertiles reserved for inclusions:
        let incl_mass = Math.floor(
            incl_density
            * grid.ASSIGNMENT_REGION_SIDE
            * grid.ASSIGNMENT_REGION_SIDE
            * ol_tiles
        );

        // prior inclusions:
        let incl_prior = anarchy.distribution_prior_sum(
            segment,
            incl_mass,
            n_segments,
            segment_capacity,
            INCLUSION_ROUGHNESS,
            d_seed
        );

        // inclusions here:
        ol_incl_here = anarchy.distribution_portion(
            segment,
            incl_mass,
            n_segments,
            segment_capacity,
            INCLUSION_ROUGHNESS,
            d_seed // seed must be the same as in distribution_prior_sum above!
        );

        // prior natural (non-inclusion) assignments:
        ol_nat_prior = (grid.ULTRATILE_SUPERTILES * segment) - incl_prior;

        // asg_* retain defaults
    } else {
        // Inclusions are among sockets, not overlength supertiles:
        let segment_capacity = Math.floor(
            MAX_LOCAL_INCLUSION_DENSITY
            * (grid.ULTRATILE_INTERIOR_SOCKETS - ol_socket_cost)
        );
        // TODO: spillage of the ol_socket_cost outside the interior sockets!

        // total number of assignment slots reserved for inclusions:
        let incl_mass = Math.floor(
            incl_density
            * grid.ASSIGNMENT_REGION_SIDE
            * grid.ASSIGNMENT_REGION_SIDE
            * segment_capacity
        );

        // prior inclusions:
        let incl_prior = anarchy.distribution_prior_sum(
            segment,
            incl_mass,
            n_segments,
            segment_capacity,
            INCLUSION_ROUGHNESS,
            d_seed
        );

        // inclusions here:
        asg_incl_here = anarchy.distribution_portion(
            segment,
            incl_mass,
            n_segments,
            segment_capacity,
            INCLUSION_ROUGHNESS,
            d_seed // seed must be the same as in distribution_prior_sum above!
        );

        // prior natural (non-inclusion) assignments:
        asg_nat_prior = (segment_full_size * segment) - incl_prior;

        // ol_* retain defaults
    }

    return [
        ol_primary,
        asg_nat_prior,
        asg_incl_here,
        ol_nat_prior,
        ol_incl_here,
    ];
}

/**
 * The converse of ultratile_punctuation_parameters, this looks up the
 * ultratile where a given assignment position (assignment grid coordinates
 * plus linear assignment number in that tile) will end up. Returns the
 * discovered ultratile grid coordinates. For ol_primary domains, use
 * overlength_assignment_location for primary assignments instead.
 * Returns undefined if domain content isn't loaded yet.
 *
 * @param domain_name A string identifying a domain or combo.
 * @param arp A 3-element assignment region position array containing x/y
 *     assignment region coordinates plus a socket index within that
 *     assignment region.
 *
 * @return A 2-element array containing the global ultragrid x/y
 *     coordinates where the given assignment region position is found.
 */
export function assignment_location(domain_name, arp) {
    var ag_x = arp[0];
    var ag_y = arp[1];
    var ag_idx = arp[2];

    // density of overlength tiles in this assignment grid unit:
    let ol_allowance = overlength_allowance(domain_name);
    if (ol_allowance == undefined) {
        return undefined;
    }
    let ol_primary = ol_allowance[0];
    let ol_tiles = ol_allowance[1];
    let ol_socket_cost = ol_allowance[2];

    // density of inclusions in this assignment grid unit:
    let d_seed = anarchy.lfsr(mix_seeds(ag_x, ag_y, 8190813480));
    let incl_density = (
        MIN_INCLUSION_DENSITY
      + anarchy.udist(d_seed) * (MAX_INCLUSION_DENSITY - MIN_INCLUSION_DENSITY)
    );
    d_seed = anarchy.lfsr(d_seed);

    // Total number of segments:
    let n_segments = grid.ASSIGNMENT_REGION_SIDE * grid.ASSIGNMENT_REGION_SIDE;

    // Defaults:
    let segment = undefined;

    if (ol_primary) {
        // Assignments are primarily made to supertiles directly because there
        // are so many overlength words. The assignment sockets are only used
        // peripherally.
        segment = Math.floor(ag_idx / OVERLENGTH_ULTRATILE_SOCKETS);
    } else {
        // Assignments are primarily made to assignment sockets.
        // segment parameters:
        let segment_capacity = Math.floor(
            MAX_LOCAL_INCLUSION_DENSITY
            * (grid.ULTRATILE_INTERIOR_SOCKETS - ol_socket_cost)
        );

        // total number of assignment slots reserved for inclusions:
        let incl_mass = Math.floor(
            incl_density
            * grid.ASSIGNMENT_REGION_SIDE
            * grid.ASSIGNMENT_REGION_SIDE
            * segment_capacity
        );

        // compute segment:
        segment = anarchy.distribution_gap_segment(
            ag_idx,
            incl_mass,
            n_segments,
            segment_capacity,
            INCLUSION_ROUGHNESS,
            d_seed
        );
    }

    // Check for overflow:
    if (segment >= grid.ASSIGNMENT_REGION_ULTRATILES) {
        return undefined;
    }

    // back out (global) ultragrid position:
    return [
        (
            (segment % grid.ASSIGNMENT_REGION_SIDE)
            + (ag_x * grid.ASSIGNMENT_REGION_SIDE)
        ),
        (
            Math.floor(segment / grid.ASSIGNMENT_REGION_SIDE)
            + (ag_y * grid.ASSIGNMENT_REGION_SIDE)
        )
    ];
}

/**
 * The other converse of ultratile_punctuation_parameters, this looks up an
 * overlength supertile by alternate-assignment-region-position. It returns
 * the ultragrid position that the corresponding supertile is in.
 * Returns undefined if domain content isn't loaded yet.
 *
 * @param domain_name A string naming a domain or combo.
 * @param aarp A 3-element array containing x/y assignment region
 *     coordinates and a socket index within that assignment region. The
 *     socket index should be an alternate (overlength) assignment index,
 *     not a normal assignment index.
 */
export function overlength_assignment_location(domain_name, aarp) {
    var ag_x = aarp[0];
    var ag_y = aarp[1];
    var ag_idx = aarp[2];

    // density of overlength tiles in this assignment grid unit:
    let ol_allowance = overlength_allowance(domain_name);
    if (ol_allowance == undefined) {
        return undefined;
    }
    let ol_primary = ol_allowance[0];
    let ol_tiles = ol_allowance[1];
    let ol_socket_cost = ol_allowance[2];

    // density of inclusions in this assignment grid unit:
    let d_seed = anarchy.lfsr(mix_seeds(ag_x, ag_y, 8190813480));
    let incl_density = (
        MIN_INCLUSION_DENSITY
      + anarchy.udist(d_seed) * (MAX_INCLUSION_DENSITY - MIN_INCLUSION_DENSITY)
    );
    d_seed = anarchy.lfsr(d_seed);

    // Total number of segments:
    let n_segments = grid.ASSIGNMENT_REGION_SIDE * grid.ASSIGNMENT_REGION_SIDE;

    // Defaults:
    let segment = undefined;

    if (ol_primary) {
        // Assignments are primarily made to supertiles directly because there
        // are so many overlength words.

        let segment_capacity = Math.floor(
            MAX_LOCAL_INCLUSION_DENSITY
            * ol_tiles
        );

        // total number of supertiles reserved for inclusions:
        let incl_mass = Math.floor(
            incl_density
            * grid.ASSIGNMENT_REGION_SIDE
            * grid.ASSIGNMENT_REGION_SIDE
            * ol_tiles
        );

        // compute segment:
        segment = anarchy.distribution_gap_segment(
            ag_idx,
            incl_mass,
            n_segments,
            segment_capacity,
            INCLUSION_ROUGHNESS,
            d_seed
        );
    } else {
        // Assignments are primarily made to assignment sockets, so we
        // just care about the fixed ol_tiles value here.

        segment = Math.floor(ag_idx / ol_tiles);
    }

    // Check for overflow:
    if (segment >= grid.ASSIGNMENT_REGION_ULTRATILES) {
        return undefined;
    }

    // back out (global) ultragrid position:
    return [
        (
            (segment % grid.ASSIGNMENT_REGION_SIDE)
            + (ag_x * grid.ASSIGNMENT_REGION_SIDE)
        ),
        (
            Math.floor(segment / grid.ASSIGNMENT_REGION_SIDE)
            + (ag_y * grid.ASSIGNMENT_REGION_SIDE)
        )
    ];
}

/**
 * Takes a domain string and an ultragrid position and computes generation
 * info including mutiplanar offsets for each assignment position in that
 * ultratile, and object contents of the ultratile.
 *
 * @param domain_name A string naming a domain or combo.
 * @param ugp A 2-element array with ultragrid x/y coordinates.
 * @param seed An integer seed determining the generation results.
 *
 * @return Undefined if domain content isn't loaded yet, or an object
 *     with the following keys:
 *
 *     seed:
 *       The seed used to generate this ultratile information.
 *     pos:
 *       The ultragrid position used to generate this ultratile.
 *     ol_primary:
 *       Whether this ultratile is primarily defined by overlength supertiles
 *       (true) or asignment sockets (false).
 *     asg_nat_prior:
 *       The number of prior non-inclusion assignment positions in this
 *       assignment tile, as returned by ultratile_punctuation_parameters
 *       (see above).
 *     ol_nat_prior:
 *       The number of prior non-inclusion overlength supertiles in this
 *       assignment tile, as returned by ultratile_punctuation_parameters
 *       (see above).
 *     socket_offsets:
 *       A flat array containing the multiplanar offset for each assignment
 *       socket in the given ultragrid tile. Entries of 'undefined' denote
 *       unassigned sockets.
 *     supertile_offsets:
 *       A flat array containing the multiplanar offset for each entire
 *       supertile, for overlength supertile assignment purposes. Undefined
 *       entries indicate unassigned supertiles. At most one socket should be
 *       assigned within an assigned supertile.
 *     asg_nat_sums:
 *       A one-dimensional array containing the sum of the number of
 *       non-inclusion assignments on each row of the ultragrid.
 *     ol_nat_sums:
 *       A one-dimensional array containing the sum of the number of
 *       non-inclusion overlength supertiles on each row of the ultragrid.
 *     active_map:
 *       A one-dimensional array of active element types to be inserted
 *       into each supertile in this ultratile (ULTRAGRID_SIZE ×
 *       ULTRAGRID_SIZE). May have missing entries for supertiles that
 *       don't have active elements in them. Note that the active
 *       elements are assigned to supertiles, not sockets.
 */
export function ultratile_context(domain_name, ugp, seed) {
    let r = sghash(seed + 489813, ugp);

    // check domain setup
    let ol_allowance = overlength_allowance(domain_name);
    if (ol_allowance == undefined) {
        return undefined;
    }
    let ol_primary = ol_allowance[0];
    let ol_tiles = ol_allowance[1];
    let ol_socket_cost = ol_allowance[2];
    let sockets_here = grid.ULTRATILE_SOCKETS - ol_socket_cost;
    let ol_connections = overlength_supertile_connections(ol_tiles);

    // unpack parameters:
    let params = ultratile_punctuation_parameters(domain_name, ugp);
    if (params == undefined) {
        return undefined;
    }
    // params[0] is the same as ol_primary above
    let asg_nat_prior = params[1];
    let asg_incl_here = params[2];
    let ol_nat_prior = params[3];
    let ol_incl_here = params[4];

    // Multiplanar offsets indicate whether each socket (or supertile) is
    // filled by a native word (0), filled by an inclusion from a neighboring
    // dimension (>0), or unfilled because of a nearby overlength supertile or
    // because a supertile is socketed (undefined).
    let socket_offsets = [];
    let supertile_offsets = [];

    if (ol_primary) { // Primarily supertile-based assignment:
        // Initialize supertile_offsets to all-assigned:
        for (let i = 0; i < grid.ULTRATILE_SUPERTILES; ++i) {
            supertile_offsets[i] = 0;
        }

        // Initialize socket_offsets to all-unsocketed:
        for (let i = 0; i < grid.ULTRATILE_SOCKETS; ++i) {
            socket_offsets[i] = undefined;
        }

        // Figure out which sockets are active:
        let seen = {};
        let taken = {};
        let uo_seed = r;
        let count = 0;
        r = anarchy.lfsr(r);
        // Choose overlength supertiles only among non-edge tiles
        for (let i = 0; i < grid.ULTRATILE_INTERIOR_SUPERTILES; ++i) {
            let ii = anarchy.cohort_shuffle(
                i,
                grid.ULTRATILE_INTERIOR_SUPERTILES,
                uo_seed
            );
            let row = 1 + Math.floor(
                ii / grid.ULTRATILE_INTERIOR_SUPERTILES_ROW
            );
            let col = 1 + ii % grid.ULTRATILE_INTERIOR_SUPERTILES_ROW;
            let sgp = [row, col];
            let full_index = grid.sgp__index(sgp);
            seen[full_index] = true;
            let nb_seed = r;
            r = anarchy.cohort_shuffle(r);
            // Iterate through neighbors in random order:
            for (let d = 0; d < grid.N_DIRECTIONS; ++d) {
                let dd = anarchy.cohort_shuffle(d, grid.N_DIRECTIONS, nb_seed);
                let nb = grid.sg_neighbor(sgp, dd);
                if (grid.is_valid_utp(nb)) {
                    let ni = grid.sgp__index(nb);
                    let sgap = [sgp[0], sgp[1], dd];
                    let utai = grid.sgap__utai(sgap);
                    if (seen[ni] && !taken[ni] && utai != undefined) {
                        // Pair these two
                        taken[full_index] = true;
                        taken[ni] = true;
                        // Let this socket be occupied:
                        socket_offsets[utai] = 0;
                        count += 1;
                        break; // don't check further neighbors
                    }
                }
            }
            if (count >= sockets_here) {
                break;
            }
        }
        if (count < sockets_here) {
            console.error(
                "Failed to pair enough supertiles for socket quota!"
            );
        }

        let inclusions = {};
        let incl_count = 0;

        // Figure out inclusions among supertiles:
        // TODO: Group the inclusions like what happens with sockets?
        let incl_seed = r;
        r = anarchy.lfsr(r);
        for (let i = 0; i < grid.ULTRATILE_INTERIOR_SUPERTILES; ++i) {
            let ii = anarchy.cohort_shuffle(
                i,
                grid.ULTRATILE_INTERIOR_SUPERTILES,
                incl_seed
            );
            let row = 1 + Math.floor(
                ii / grid.ULTRATILE_INTERIOR_SUPERTILES_ROW
            );
            let col = 1 + ii % grid.ULTRATILE_INTERIOR_SUPERTILES_ROW;
            let sgp = [row, col];
            let full_index = grid.sgp__index(sgp);
            incl_count += 1;
            if (incl_count > ol_incl_here) {
                break;
            } else {
                // TODO: better here
                // random multiplanar index
                let mpi = anarchy.idist(
                    r,
                    1,
                    dimensions.MULTIPLANAR_CONNECTIONS + 1
                );
                r = anarchy.lfsr(r);
                supertile_offsets[full_index] = mpi;
            }
        }

    } else { // Normal socket-based assignment:
        // Initialize supertile_offsets to all-socketed:
        for (let i = 0; i < grid.ULTRATILE_SUPERTILES; ++i) {
            supertile_offsets[i] = undefined;
        }

        // Initialize socket_offsets to all-default:
        for (let i = 0; i < grid.ULTRATILE_SOCKETS; ++i) {
            socket_offsets[i] = 0;
        }

        // Figure out which supertiles are reserved for overlength words:
        let count = 0;
        let connections = 0;
        let uo_seed = r;
        r = anarchy.lfsr(r);
        // Pick from interior supertiles only!
        for (let i = 0; i < grid.ULTRATILE_INTERIOR_SUPERTILES; ++i) {
            let ii = anarchy.cohort_shuffle(
                i,
                grid.ULTRATILE_INTERIOR_SUPERTILES,
                uo_seed
            );
            let row = 1 + Math.floor(
                ii / grid.ULTRATILE_INTERIOR_SUPERTILES_ROW
            );
            let col = 1 + ii % grid.ULTRATILE_INTERIOR_SUPERTILES_ROW;
            let sgp = [row, col];
            let full_index = grid.sgp__index(sgp);
            let taken_neighbors = 0;
            // Iterate through neighbors in fixed order:
            for (let d = 0; d < grid.N_DIRECTIONS; ++d) {
                let nb = grid.sg_neighbor(sgp, d);
                if (grid.is_valid_utp(nb)) {
                    let ni = grid.sgp__index(nb);
                    if (supertile_offsets[ni] == 0) {
                        taken_neighbors += 1;
                        if (connections + taken_neighbors > ol_connections) {
                            // We can skip rest of neighbors; this tile
                            // would create too many connections.
                            break;
                        }
                    }
                }
            }
            if (connections + taken_neighbors <= ol_connections) {
                // Claim this supertile as an overlength supertile
                supertile_offsets[full_index] = 0;
                connections += taken_neighbors;
                count += 1;
                // Set relevant socket offsets to undefined:
                for (let d = 0; d < grid.N_DIRECTIONS; ++d) {
                    let sgap = [sgp[0], sgp[1], d];
                    let utai = grid.sgap__utai(sgap);
                    if (utai != undefined) {
                        socket_offsets[utai] = undefined;
                    } // else skip it
                }
            }
            if (count >= ol_tiles) {
                // Done finding overlength supertiles
                break;
            }
        }

        // Figure out inclusions among sockets:
        let min_ni = asg_incl_here / INCLUSION_MAX_SIZE;
        let max_ni = asg_incl_here / INCLUSION_MIN_SIZE;

        let n_inclusions = anarchy.idist(r, min_ni, max_ni + 1);
        r = anarchy.lfsr(r);

        // compute the seed location and index of each inclusion:
        let used = {};
        let iseeds = [];
        let isizes = [];
        let impi = [];
        let queues = [];
        for (let i = 0; i < n_inclusions; ++i) {
            // random (non-overlapping) seed from core sockets:
            let sseed = r;
            r = anarchy.lfsr(r);
            // iterate scrambled to find valid seed position:
            for (let j = 0; j < grid.ULTRATILE_CORE_SOCKETS; ++j) {
                let core_index = anarchy.cohort_shuffle(
                    j,
                    grid.ULTRATILE_CORE_SOCKETS,
                    sseed
                );
                let core_x = core_index % grid.ULTRATILE_CORE_SOCKETS_ROW;
                let core_y = Math.floor(
                    core_index / grid.ULTRATILE_CORE_SOCKETS_ROW
                );
                let full_index = (
                    (core_x + 2)
                    + (core_y + 2) * grid.ULTRATILE_ROW_SOCKETS
                );
                if (socket_offsets[full_index] == 0 && !used[full_index]) {
                    // Claim this socket as seed and end search for a seed:
                    used[full_index] = true;
                    iseeds[i] = full_index;
                    break;
                }
            }

            // zero size:
            isizes[i] = 0;

            // TODO: better here
            // random multiplanar index
            impi[i] = anarchy.idist(
                r,
                1,
                dimensions.MULTIPLANAR_CONNECTIONS + 1
            );
            if (isNaN(impi[i])) {
                throw (
                    "Internal Error: inclusion multiplanar index is NaN: "
                  + r + ", " + dimensions.MULTIPLANAR_CONNECTIONS + 1
                );
            }
            r = anarchy.lfsr(r);

            // seed is on the queue:
            queues[i] = [ iseeds[i] ];
        }

        if (WARNINGS && iseeds.length == 0 && n_inclusions > 0) {
            console.error("Zero-length iseeds!");
        }

        // now iteratively expand each inclusion:
        let left = asg_incl_here;
        let blocked = [];
        while (left > 0) {
            // each inclusion gets a turn...
            for (let i = 0; i < iseeds.length; ++i) {
                // detect blocked inclusions
                if (queues[i].length == 0) {
                    if (isizes[i] >= INCLUSION_MIN_SIZE) {
                        continue; // this inclusion will just be small
                    } else {
                        blocked.push(i); // must keep expanding!
                        continue;
                    }
                }
                let loc = queues[i].shift();
                if (isNaN(loc)) {
                    console.warn("Queus that produced NaN loc:", queues);
                    throw "Internal Error: loc is NaN from queue: " + i;
                }

                let here;
                if (blocked.length > 0) {
                    here = blocked.shift(); // steal the expansion point!
                    i -= 1; // redo this iteration next
                } else {
                    here = i;
                }

                // assign to this inclusion & decrement remaining:
                socket_offsets[loc] = impi[here];
                left -= 1;

                // add neighbors to queue if possible:
                let x = (
                    Math.floor(loc / grid.ASSIGNMENT_SOCKETS)
                    % grid.ULTRAGRID_SIZE
                );
                let y = Math.floor(
                    loc / (grid.ASSIGNMENT_SOCKETS * grid.ULTRAGRID_SIZE)
                );
                let a = loc % grid.ASSIGNMENT_SOCKETS;
                // canonical
                let neighbors = grid.supergrid_asg_neighbors([x, y, a]);
                for (let j = 0; j < neighbors.length; ++j) {
                    let nb = neighbors[j];
                    if (
                        nb[0] > 0
                        && nb[0] < grid.ULTRAGRID_SIZE - 1
                        && nb[1] > 0
                        && nb[1] < grid.ULTRAGRID_SIZE - 1
                    ) {
                        // not on the edge (slight asymmetry, but that's
                        // alright).
                        let nloc = grid.sgap__sidx(nb);
                        let taken = false;
                        // check for queue overlap
                        for (let k = 0; k < queues.length; ++k) {
                            if (queues[k].indexOf(nloc) >= 0) {
                                taken = true;
                                break;
                            }
                        }
                        if (socket_offsets[nloc] == 0 && !taken) {
                            // add to queue in random position:
                            // max of two rngs biases towards later
                            // indices, letting earlier things mostly
                            // stay early.
                            let idx = anarchy.idist(r, 0, queues[here].length);
                            r = anarchy.lfsr(r);
                            let alt_idx = anarchy.idist(
                                r,
                                0,
                                queues[here].length
                            );
                            r = anarchy.lfsr(r);
                            if (alt_idx > idx) {
                                idx = alt_idx;
                            }
                            queues[here].splice(idx, 0, nloc);
                        }
                    }
                }
            }
        }
    }

    // now that our results matrix is done, compute row pre-totals
    let asg_presums = [];
    let sum = 0;
    for (let y = 0; y < grid.ULTRAGRID_SIZE - 1; ++y) {
        asg_presums.push(sum);
        for (
            let x = 0;
            x < grid.ULTRAGRID_SIZE * grid.ASSIGNMENT_SOCKETS;
            ++x
        ) {
            let loc = x + y * grid.ULTRAGRID_SIZE * grid.ASSIGNMENT_SOCKETS;
            if (socket_offsets[loc] == 0) {
                sum += 1;
            }
        }
    }
    // final row:
    asg_presums.push(sum);

    // pre-totals for overlength supertiles
    let ol_presums = [];
    sum = 0;
    for (let y = 0; y < grid.ULTRAGRID_SIZE - 1; ++y) {
        ol_presums.push(sum);
        for (let x = 0; x < grid.ULTRAGRID_SIZE; ++x) {
            let loc = x + y * grid.ULTRAGRID_SIZE;
            if (supertile_offsets[loc] == 0) {
                sum += 1;
            }
        }
    }
    // final row:
    ol_presums.push(sum);

    // now that multiplanar info is computed, add active element info
    // decide how many elements we'll have:
    // TODO: continuously varying value here?
    let st = MIN_ACTIVE_PER_ULTRATILE;
    let ed = MAX_ACTIVE_PER_ULTRATILE;
    let r1 = anarchy.idist(r, st, ed);
    r = anarchy.lfsr(r);
    let r2 = anarchy.idist(r, st, ed);
    r = anarchy.lfsr(r);
    let r3 = anarchy.idist(r, st, ed);
    let richness = Math.max(r1, r2, r3);

    // Divide active elements among active categories:
    //
    //   links---Conditional gates that link to other dimensions.
    //   wormholes---Conditional gates that link elsewhere in this dimension.
    //   portals---Conditional gates that link to pocket dimensions.
    //   resources---Harvestable items that aid the player.
    //   TODO: Revisit this.

    let links = Math.floor(richness/10);
    let wormholes = Math.floor(richness/15);
    let remaining = richness - links - wormholes;
    let portals = Math.floor(remaining/5);
    // the rest are resources

    // Build a queue of active elements to insert
    // Note: Order doesn't matter here, as these will be assigned to random
    // supertiles within the ultratile.
    let elem_queue = [];
    for (let i = 0; i < richness; ++i) {
        if (i < links) {
            elem_queue.push("🔗");
        } else if (i < links + wormholes) {
            elem_queue.push("🌀");
        } else if (i < links + wormholes + portals) {
            elem_queue.push("🚪");
        } else {
            let res = active.random_element(r);
            if (res == undefined) {
                throw "Inernal Error: Undefined random element from seed " + r;
            }
            r = anarchy.lfsr(r);
            elem_queue.push(res);
        }
    }

    // Fill in 3/5 of all remaining supertiles with color sources:
    for (
        let i = 0;
        i < Math.floor((grid.ULTRATILE_SUPERTILES - richness)*0.6);
        ++i
    ) {
        let eng = active.random_energy(r);
        if (eng == undefined) {
            throw "Internal Error: Undefined random energy from seed " + r;
        }
        r = anarchy.lfsr(r);
        elem_queue.push(eng);
    }

    // index active elements into the supergrid:
    // TODO: DEBUG active element distribution + frequency?
    let active_map = [];
    let shuf_seed = r;
    r = anarchy.lfsr(r);
    let i = 0;
    while (elem_queue.length > 0) {
        let si = anarchy.cohort_shuffle(
            i,
            grid.ULTRATILE_SUPERTILES,
            shuf_seed
        );
        i += 1;
        let sgp = [
            si % grid.ULTRAGRID_SIZE,
            Math.floor(si / grid.ULTRAGRID_SIZE)
        ];
        // iterate over canonical sockets that touch this supertile to count
        // multiplanar offsets
        let mpo_table = { 0: 0 };
        for (let socket = 0; socket < grid.COMBINED_SOCKETS; ++socket) {
            let sgap = grid.canonical_sgapos(sgp[0], sgp[1], socket);
            let loc = grid.sgap__sidx(sgap);
            let mpo = socket_offsets[loc];
            if (mpo != undefined) {
                if (!mpo_table.hasOwnProperty(mpo)) {
                    mpo_table[mpo] = 0;
                }
                mpo_table[mpo] += 1;
            }
        }
        // Figure out the most-frequent multiplanar offset:
        let winner = 0;
        let win_count = -1;
        for (let k of Object.keys(mpo_table)) {
            if (mpo_table[k] > win_count) {
                win_count = mpo_table[k];
                winner = k;
            }
        }
        if (winner == 0) { // non-inclusions win
            active_map[si] = elem_queue.pop();
        } else {
            // TODO: Foreign active elements?
            active_map[si] = undefined;
        }
    }

    // double-check assignment overlaps:
    if (CHECK_ASSIGNMENT_OVERLAP) {
        for (let i = 0; i < grid.ULTRATILE_SUPERTILES; ++i) {
            let quota = 0;
            if (supertile_offsets[i] == undefined) {
                // Check that all of the underlying sockets are assigned:
                quota = 6;
            } else {
                // Check that at most one of the corresponding sockets is
                // assigned:
                quota = 1;
            }
            let sgp = grid.index__sgp(i);
            let asg_count = 0; // count of assigned sockets
            let border_count = 0; // count of border sockets
            // count of sockets to skip due to adjacent overlength supertiles:
            let skip_count = 0;
            let locs = [];
            for (let socket = 0; socket < grid.COMBINED_SOCKETS; ++socket) {
                let can = grid.canonical_sgapos([sgp[0], sgp[1], socket]);
                let alt = grid.supergrid_alternate([sgp[0], sgp[1], socket]);
                if (grid.is_valid_utp(can) && grid.is_valid_utp(alt)) {
                    let alt_idx = grid.sgp__index(alt);
                    let loc = grid.sgap__sidx(can);
                    locs.push(loc);
                    // If our alternate's supertile is an overlength
                    // supertile...
                    if (supertile_offsets[alt_idx] != undefined) {
                        skip_count += 1;
                        if (!ol_primary && socket_offsets[loc] != undefined) {
                            console.warn(
                                "Overlength-adjacent socket was assigned at: "
                              + sgp + " (" + i + ")\n"
                              + "  Overlength tile is at: "
                              + [alt[0], alt[1]] + " ("
                              + alt_idx + ")\n"
                              + "  Socket is: " + alt[2]
                            );
                        }
                    } else {
                        if (socket_offsets[loc] != undefined) {
                            asg_count += 1;
                        }
                    }
                } else {
                    // This socket belongs to or is shared with a
                    // neighboring ultratile
                    if (!ol_primary) {
                        // ol_primary domains assign no edge sockets;
                        // non-ol_primary domains assign all edge
                        // sockets.
                        border_count += 1;
                    }
                }
            }
            let count = asg_count + border_count + skip_count;
            if (
                (quota == 1 && count > 1)
                || (quota > 1 && count != quota)
            ) {
                // Our count doesn't match our quota!
                console.warn(
                    "Count doesn't match quota at: " + sgp + " ("
                  + i + ")\n"
                  + "  Count is: " + asg_count + "/" + border_count
                  + "/" + skip_count
                  + " but quota is: " + quota + "\n"
                  + "  Sockets here: " + locs
                );
                console.warn(socket_offsets);
                console.warn(supertile_offsets);
            }
        }
    }

    // return our results:
    return {
        "seed": seed,
        "pos": ugp,
        "ol_primary": ol_primary,
        "asg_nat_prior": asg_nat_prior,
        "ol_nat_prior": ol_nat_prior,
        "socket_offsets": socket_offsets,
        "supertile_offsets": supertile_offsets,
        "asg_nat_sums": asg_presums,
        "ol_nat_sums": ol_presums,
        "active_map": active_map,
    };
}
// register ultratile_context as a caching domain:
caching.register_domain(
    "ultratile_context",
    function (ds, ugp, seed) {
        return ds + ":" + ugp[0] + "," + ugp[1] + ":" + seed;
    },
    ultratile_context,
    MULTIPLANAR_INFO_CACHE_SIZE
);

/**
 * Takes an ultragrid assignment position (ultratile x/y, sub x/y, and
 * assignment index) and corresponding ultragrid context (the result of
 * ultratile_context above) and returns assignment grid info necessary to
 * identify the word that belongs in this socket.
 *
 * Note that the given ultragrid assignment position must be in canonical
 * form, so that the correspondence with the given utcontext won't be
 * broken.
 *
 * If the given socket is unassigned, this will return undefined.
 *
 * @param ugap A 5-element ultragrid assignment position (ultratile
 *     x/y, within-ultratile supertile x/y, and socket index).
 * @param utcontext The result of ultratile_context for the specified
 *     ultratile.
 * @param world_seed An integer world seed that helps determine the
 *     result.
 *
 * @return A 4-element array containing:
 *     x, y - assignment grid position
 *     n - assignment index
 *     m - multiplanar offset value
 */
export function punctuated_assignment_index(ugap, utcontext, world_seed) {
    // unpack:
    var nat_prior = utcontext.asg_nat_prior;
    var mptable = utcontext.socket_offsets;
    var mpsums = utcontext.asg_nat_sums;

    var ut_x = ugap[0];
    var ut_y = ugap[1];
    var sub_x = ugap[2];
    var sub_y = ugap[3];
    var ap = ugap[4];

    // compute assignment tile:
    var asg_x = Math.floor(ut_x / grid.ASSIGNMENT_REGION_SIDE);
    var asg_y = Math.floor(ut_y / grid.ASSIGNMENT_REGION_SIDE);

    // linear index within ultratile:
    var lin = grid.sgap__sidx([sub_x, sub_y, ap]);

    // get mutiplanar offset
    var mp_offset = mptable[lin];
    if (isNaN(mp_offset) && mp_offset != undefined) {
        throw "Internal Error: multiplanar offset is NaN!";
    }
    if (mp_offset == undefined) {
        // This socket is unassigned.
        return undefined;
    }
    var asg_index = 0;
    var r = sghash(world_seed + 379238109821, [ut_x, ut_y]);
    if (mp_offset == 0) { // natural: index determined by prior stuff
        var row = Math.floor(lin / grid.ULTRATILE_ROW_SOCKETS);
        asg_index = nat_prior + mpsums[row];
        // iterate from beginning of row to count local priors
        for (
            var here = sub_y * grid.ULTRATILE_ROW_SOCKETS;
            here < lin;
            ++here
        ) {
            if (mptable[here] == 0) {
                asg_index += 1;
            }
        }
    } else { // inclusion: index determined by RNG
        // TODO: Pull these together near a destination?
        // compute a suitable seed value for this inclusion:
        var ir = r + mp_offset;
        for (let i = 0; i < (mp_offset % 7) + 2; ++i) {
            ir = anarchy.lfsr(r);
        }
        asg_index = anarchy.cohort_shuffle(
            lin,
            grid.ASSIGNMENT_REGION_TOTAL_SOCKETS,
            ir
        );
    }

    // Return values:
    return [ asg_x, asg_y, asg_index, mp_offset ];
}

/**
 * The inverse of punctuated_assignment_index (see above); this takes a
 * dimension, and an assignment position (assignment grid x/y and linear
 * number) and returns a (canonical) supergrid assignment position that
 * contains the indicated assignment index. If suitable cached multiplanar
 * offset info isn't yet available, this will return null. Use
 * caching.with_cached_value to execute code as soon as the info becomes
 * available.
 *
 * If the linear assignment number is larger than the last assigned socket,
 * this will return undefined.
 *
 * @param dimension A dimension object.
 * @param arp A 3-element assignment region position array, including
 *     assignment region x/y coordinates plus a within-region index.
 * @param world_seed An integer world seed that affects the layout.
 *
 * @return A canonical supergrid assignment position containing the
 *     specified socket (a 3-element array with supergrid x/y coordinates
 *     and a socket index). Could return undefined if required info has
 *     not been loaded yet.
 */
export function punctuated_assignment_lookup(dimension, arp, world_seed) {
    let domain_name = dict.name_of(dimensions.natural_domain(dimension));

    var asg_x = arp[0];
    var asg_y = arp[1];
    var asg_idx = arp[2];

    var ugp = assignment_location(domain_name, arp);
    if (ugp == undefined) {
        return undefined;
    }

    // fetch utcontext or fail:
    let utseed = ultratile_seed(ugp, dimension, world_seed);
    var utcontext = caching.cached_value(
        "ultratile_context",
        [ domain_name, [ ugp[0], ugp[1] ], utseed ]
    );
    if (utcontext == null) {
        return null;
    }

    // unpack:
    var nat_prior = utcontext.asg_nat_prior;
    var mptable = utcontext.socket_offsets;
    var mpsums = utcontext.asg_nat_sums;

    var internal_idx = asg_idx - nat_prior;
    var prior_row = anarchy.max_smaller(internal_idx, mpsums);
    var before = 0;
    if (prior_row > -1) {
        before = mpsums[prior_row];
    }
    var in_row_idx = asg_idx - nat_prior - before;
    var col_idx = 0;
    for (
        var mp_idx = grid.ULTRATILE_ROW_SOCKETS * prior_row;
        mp_idx < grid.ULTRATILE_ROW_SOCKETS * (prior_row + 1);
        mp_idx += 1
    ) {
        if (mptable[mp_idx] == 0) {
            if (in_row_idx == 0) {
                break;
            }
            in_row_idx -= 1;
        }
        col_idx += 1;
    }

    // Escape the assignment grid tile and our ultragrid tile within that
    // assignment grid tile to get a global supergrid position along with an
    // assignment socket index.
    return [
        (
            (asg_x * grid.ASSIGNMENT_REGION_SIDE + ugp[0]) * grid.ULTRAGRID_SIZE
            + Math.floor(col_idx / grid.ASSIGNMENT_SOCKETS)
        ),
        (
            (asg_y * grid.ASSIGNMENT_REGION_SIDE + ugp[1]) * grid.ULTRAGRID_SIZE
            + prior_row + 1
        ),
        col_idx % grid.ASSIGNMENT_SOCKETS
    ];
}

/**
 * Takes an ultragrid supertile position (ultratile x/y and sub x/y) and
 * corresponding ultragrid context (the result of ultratile_context above)
 * and returns information necessary to identify the word assigned to an
 * overlength supertile.
 *
 * If the given supertile is not an overlength supertile, this will
 * return undefined.
 *
 * @param ugp A 4-element ultragrid position array containing ultragrid
 *     x/y coordinates and supergrid interior x/y coordinates within that
 *     ultratile.
 * @param utcontext The ultratile context object corresponding to the
 *     specified location (see ultratile_context).
 * @param world_seed The integer world seed.
 *
 * @return A 4-element array containing:
 *     x, y - assignment grid position
 *     n - overlength assignment index
 *     m - multiplanar offset value
 */
export function punctuated_overlength_index(ugp, utcontext, world_seed) {
    // Unpack:
    let nat_prior = utcontext.ol_nat_prior;
    let mptable = utcontext.supertile_offsets;
    let mpsums = utcontext.ol_nat_sums;

    let ut_x = ugp[0];
    let ut_y = ugp[1];
    let sub_x = ugp[2];
    let sub_y = ugp[3];

    // compute assignment tile:
    let asg_x = Math.floor(ut_x / grid.ASSIGNMENT_REGION_SIDE);
    let asg_y = Math.floor(ut_y / grid.ASSIGNMENT_REGION_SIDE);

    // linear index within ultratile:
    let lin = grid.sgp__index([sub_x, sub_y]);

    // get mutiplanar offset
    let mp_offset = mptable[lin];
    if (mp_offset == undefined) {
        // This supertile is socketed.
        return undefined;
    }
    let asg_index = 0;
    if (mp_offset == 0) { // natural: index determined by prior stuff
        let row = sub_y;
        asg_index = nat_prior + mpsums[row];
        // iterate from beginning of row to count local priors
        for (let here = sub_y * grid.ULTRAGRID_SIZE; here < lin; ++here) {
            if (mptable[here] == 0) {
                asg_index += 1;
            }
        }
    } else { // inclusion: index determined by RNG
        // TODO: Pull these together near a destination?
        // compute a suitable seed value for this inclusion:
        let r = sghash(world_seed + 379238109821, [ut_x, ut_y]);
        let ir = r + mp_offset;
        for (let i = 0; i < (mp_offset % 7) + 2; ++i) {
            ir = anarchy.lfsr(r);
        }
        asg_index = anarchy.cohort_shuffle(
            lin,
            grid.ASSIGNMENT_REGION_TOTAL_SUPERTILES,
            ir
        );
    }

    // Return values:
    return [ asg_x, asg_y, asg_index, mp_offset ];
}

/**
 * The inverse of punctuated_overlength_index (see above); this takes a
 * dimension and an assignment position (assignment grid x/y and linear
 * number) and returns the supergrid coordinates of an overlength supertile
 * that contains the indicated assignment index. If suitable cached
 * multiplanar offset info isn't yet available, this will return null. Use
 * caching.with_cached_value to execute code as soon as the info becomes
 * available.
 *
 * If the linear assignment number is larger than the last assigned
 * supertile, this will return undefined.
 *
 * @param dimension A dimension object.
 * @param arp A 3-element assignment region position: assignment region
 *     x/y coordinates plus a socket index within that region.
 * @param world_seed The integer world seed.
 *
 * @return null if there's unloaded info, or a 2-element supergrid x/y
 *     coordinate array of an overlength supertile that contains the
 *     specified overlength socket.
 */
export function punctuated_overlength_lookup(dimension, arp, world_seed) {
    let domain_name = dict.name_of(dimensions.natural_domain(dimension));

    var asg_x = arp[0];
    var asg_y = arp[1];
    var asg_idx = arp[2];

    var ugp = overlength_assignment_location(domain_name, arp);
    if (ugp == undefined) {
        return undefined;
    }

    // fetch utcontext or fail:
    let utseed = ultratile_seed(ugp, dimension, world_seed);
    var utcontext = caching.cached_value(
        "ultratile_context",
        [ domain_name, [ ugp[0], ugp[1] ], utseed ]
    );
    if (utcontext == null) {
        return null;
    }

    // unpack:
    var nat_prior = utcontext.ol_nat_prior;
    var mptable = utcontext.supertile_offsets;
    var mpsums = utcontext.ol_nat_sums;

    var internal_idx = asg_idx - nat_prior;
    var prior_row = anarchy.max_smaller(internal_idx, mpsums);
    var before = 0;
    if (prior_row > -1) {
        before = mpsums[prior_row];
    }
    var in_row_idx = asg_idx - nat_prior - before;
    var col_idx = 0;
    for (
        var mp_idx = grid.ULTRAGRID_SIZE * prior_row;
        mp_idx < grid.ULTRAGRID_SIZE * (prior_row + 1);
        mp_idx += 1
    ) {
        if (mptable[mp_idx] == 0) {
            if (in_row_idx == 0) {
                break;
            }
            in_row_idx -= 1;
        }
        col_idx += 1;
    }

    // Escape the assignment grid tile and our ultragrid tile within that
    // assignment grid tile to get a global supergrid position along with an
    // assignment socket index.
    return [
        (
            (asg_x * grid.ASSIGNMENT_REGION_SIDE + ugp[0]) * grid.ULTRAGRID_SIZE
            + col_idx
        ),
        (
            (asg_y * grid.ASSIGNMENT_REGION_SIDE + ugp[1]) * grid.ULTRAGRID_SIZE
            + prior_row + 1
        )
    ];
}

/**
 * Returns the nth word across all of the given domain(s) (which should be
 * a list of domain objects, not domain names). Returns a (glyphs,
 * canonical, frequency) triple. Displays a warning in the console and
 * returns undefined if the index is out-of-range.
 *
 * @param domains An array of domain objects (not names).
 * @param index An index within all words in any of the given domains.
 *
 * @return A domain entry from one of the domains according to the given
 *     index, which will be a 3-element glyph-list, string, frequency
 *     array.
 */
export function word_at(domains, index) {
    for (let i = 0; i < domains.length; ++i) {
        let d = domains[i];
        if (index < d.entries.length) {
            return d.entries[index];
        } else {
            index -= d.entries.length;
        }
    }
    throw "Internal Error: word_at index is out of range:\n" + [domains, index];
}

/**
 * Returns a (glyphs, canonical, frequency) triple obtained by looking up
 * the given glyphs string (or list) in each of the given domains. Returns
 * only the first match from the first domain that has a match.
 *
 * @param domains An array of domain objects (not names).
 * @param glyphs A string (or list of strings) specifying a glyph
 *     sequence.
 *
 * @return The first word in any of the given domains that matches the
 *     given glyph sequence. Returns the domain entry for the word (a
 *     3-element glyphs-list, string, frequency array).
 */
export function first_match_in(domains, glyphs) {
    for (let i = 0; i < domains.length; ++i) {
        let d = domains[i];
        let matches = dict.find_word_in_domain(glyphs, d);
        if (matches.length > 0) {
            return matches[0].slice(1);
        }
    }
    throw (
        "Internal Error: first_match_in failed to find match:"
      + [domains, glyphs]
    );
}

/**
 * Given an assignment position (assignment grid x/y and assignment index)
 * and a seed, returns the corresponding word from the given domain object
 * (not name) list. If only_socketable is given as true, only socketable
 * words will be used.
 *
 * @param domains An array of domain objects (not names).
 * @param arp A 3-element assignment region position containing
 *     assignment region x/y coordinates and a socket index within that
 *     region.
 * @param seed An integer seed that determines the outcome.
 * @param only_socketable (optional) If given as true, only words that
 *     fit in a standard socket will be eligible for selection.
 *
 * @return a domain entry, which is a [glyphs, word, frequency] triple.
 */
export function pick_word(domains, arp, seed, only_socketable) {
    let any_missing = false;
    let grand_total = 0;
    let lesser_total = 0;
    let greater_counttable = [];
    let lesser_counttable = [];
    domains.forEach(function (d) {
        if (only_socketable) {
            let socketable_count = d.short_count_sums[
                d.short_count_sums.length - 1
            ];
            greater_counttable.push(socketable_count);
            grand_total += socketable_count;
            let socketable_entries = d.normlength.length;
            lesser_counttable.push(socketable_entries);
            lesser_total += socketable_entries;
        } else {
            let total_count = d.total_count;
            greater_counttable.push(total_count);
            grand_total += total_count;
            let total_entries = d.entries.length;
            lesser_counttable.push(total_entries);
            lesser_total += total_entries;
        }
    });
    if (WARNINGS && lesser_total > grid.ASSIGNMENT_REGION_TOTAL_SOCKETS) {
        console.warn(
            "Warning: domain/combo? size exceeds number of assignable"
          + " sockets: "
          + grand_total + " > " + grid.ASSIGNMENT_REGION_TOTAL_SOCKETS
        );
    }

    let r = sghash(seed, arp);

    let idx = anarchy.cohort_shuffle(
        arp[2],
        grid.ASSIGNMENT_REGION_TOTAL_SOCKETS,
        r
    );
    r = anarchy.lfsr(r);

    if (idx < lesser_total) { // one of the per-entry assignments
        let ct_idx = 0;
        // Figure out which domain we're in using our counttable:
        for (ct_idx = 0; ct_idx < lesser_counttable.length; ++ct_idx) {
            let here = lesser_counttable[ct_idx];
            if (idx < here) {
                break;
            }
            idx -= here;
        }
        let dom;
        if (ct_idx == lesser_counttable.length) {
            if (WARNINGS) {
                console.warn(
                    "Warning: lesser counttable loop failed to break!"
                );
            }
            ct_idx = lesser_counttable.length - 1;
            dom = domains[ct_idx];
            if (only_socketable) {
                idx %= dom.normlength.length;
            } else {
                idx %= dom.entries.length;
            }
        } else {
            dom = domains[ct_idx];
        }
        // all words get equal representation
        if (only_socketable) {
            return dom.entries[dom.normlength[idx]];
        } else {
            return dom.entries[idx];
        }
    } else { // one of the per-count assignments
        idx -= lesser_total;
        idx %= grand_total;
        // Figure out which domain we're in using our counttable:
        let ct_idx = 0;
        for (ct_idx = 0; ct_idx < greater_counttable.length; ++ct_idx) {
            let here = greater_counttable[ct_idx];
            if (idx < here) {
                break;
            }
            idx -= here;
        }
        let dom;
        if (ct_idx == greater_counttable.length) {
            if (WARNINGS) {
                console.warn(
                    "Warning: greater counttable loop failed to break!"
                );
            }
            ct_idx = greater_counttable.length - 1;
            dom = domains[ct_idx];
        } else {
            dom = domains[ct_idx];
        }
        // representation according to frequency
        if (only_socketable) {
            return dict.unrolled_short_word(idx, dom);
        } else {
            return dict.unrolled_word(idx, dom);
        }
    }
}


/**
 * Alias for pick_word with only_socketable set to true.
 */


//  /**
//   * Given a word from the given domain object (not name) list and a seed
//   * returns its corresponding assignment position (assignment grid x/y and
//   * assignment index)
//   * If only_socketable is given as true, only socketable
//   * words will be used.
//   *
//   * @param domains An array of domain objects (not names).
//   * @param arp A 3-element assignment region position containing
//   *     assignment region x/y coordinates and a socket index within that
//   *     region.
//   * @param seed An integer seed that determines the outcome.
//   * @param only_socketable (optional) If given as true, only words that
//   *     fit in a standard socket will be eligible for selection.
//   *
//   * @return a domain entry, which is a [glyphs, word, frequency] triple.
//   */
// export function invert_pick_word(domains, arp, only_socketable,word, seed){
//     let any_missing = false;
//     let grand_total = 0;
//     let lesser_total = 0;
//     let greater_counttable = [];
//     let lesser_counttable = [];
//
//
//
//     let r = sghash(seed, arp);
//
//     let idx = anarchy.cohort_shuffle(
//         arp[2],
//         grid.ASSIGNMENT_REGION_TOTAL_SOCKETS,
//         r
//     );
//     r = anarchy.lfsr(r);
//
//
//     domains.foreach(function(d){
//
//         // find where the word is (what domain)
//
//     }
// );
//
//
//     for(i = 0; i<word.length-1;i++){
//         var firstGlyph = word[0];
//         var currentGlyph = word[i+1];
//
//
//
//         if (idx < lesser_total) { // one of the per-entry assignments
//             let ct_idx = 0;
//             // Figure out which domain we're in using our counttable:
//             for (ct_idx = 0; ct_idx < lesser_counttable.length; ++ct_idx) {
//                 let here = lesser_counttable[ct_idx];
//                 if (idx < here) {
//                     break;
//                 }
//                 idx -= here;
//             }
//             let dom;
//             if (ct_idx == lesser_counttable.length) {
//                 if (WARNINGS) {
//                     console.warn(
//                         "Warning: lesser counttable loop failed to break!"
//                     );
//                 }
//                 ct_idx = lesser_counttable.length - 1;
//                 dom = domains[ct_idx];
//                 if (only_socketable) {
//                     idx %= dom.normlength.length;
//                 } else {
//                     idx %= dom.entries.length;
//                 }
//             } else {
//                 dom = domains[ct_idx];
//             }
//             // all words get equal representation
//             if (only_socketable) {
//                 return dom.entries[dom.normlength[idx]];
//             } else {
//                 return dom.entries[idx];
//             }
//         } else { // one of the per-count assignments
//             idx -= lesser_total;
//             idx %= grand_total;
//             // Figure out which domain we're in using our counttable:
//             let ct_idx = 0;
//             for (ct_idx = 0; ct_idx < greater_counttable.length; ++ct_idx) {
//                 let here = greater_counttable[ct_idx];
//                 if (idx < here) {
//                     break;
//                 }
//                 idx -= here;
//             }
//             let dom;
//             if (ct_idx == greater_counttable.length) {
//                 if (WARNINGS) {
//                     console.warn(
//                         "Warning: greater counttable loop failed to break!"
//                     );
//                 }
//                 ct_idx = greater_counttable.length - 1;
//                 dom = domains[ct_idx];
//             } else {
//                 dom = domains[ct_idx];
//             }
//             // representation according to frequency
//             if (only_socketable) {
//                 return dict.unrolled_short_word(idx, dom);
//             } else {
//                 return dict.unrolled_word(idx, dom);
//             }
//         }
//
//     }
// }
export function pick_short_word(domains, arp, seed) {
    return pick_word(domains, arp, seed, true);
}

/**
 * Takes a permutation list containing permutations listed as site-index,
 * starting-coordinates, move-list triples, and filters for a list
 * containing only permutations that are at the given site and which are at
 * least the given minimum length (min_length shouldn't exceed the socket
 * size, or the result will be an empty list). If site is given as -1,
 * results for all sites are returned.
 *
 * TODO: Merge cut-equal paths to avoid biasing shape distribution of
 * shorter words?
 *
 * @param permutations in the same format as individual entries from
 *     SOCKET_PERMUTATIONS.
 * @param site Either -1 to avoid filtering by site, or a site index (0,
 *     1, or 2; see BASE_PERMUTATIONS) to filter for only permutations
 *     that start in that site.
 * @param min_length The minimum length requirement, to remove
 *     permutations that are too short. Use 0 to avoid removing any
 *     permutations.
 *
 * @return An array of permutations with the same format as the input
 *     permutations array, but with permutations that don't meet the site
 *     and/or min_length requirements filtered out. The resulting
 *     permutations are new arrays not linked to the originals.
 */
export function filter_permutations(permutations, site, min_length) {
    let result = [];
    for (let i = 0; i < permutations.length; ++i) {
        if (
            permutations[i][2].length >= min_length
            && (site < 0 || permutations[i][0] == site)
        ) {
            result.push( // deepish copy
                [
                permutations[i][0],
                permutations[i][1],
                permutations[i][2].slice()
                ]
            );
        }
    }
    return result;
}

/**
 * Fits a word (or part of it, for edge-adjacent sockets) into the given
 * socket of the given supertile, updating the glyphs array. Returns a list
 * of tile positions updated.
 *
 * @param supertile The supertile object to place a word into.
 * @param glyphs An array of strings specifying the glyphs in the word to
 *     be placed.
 * @param socket The socket index of the socket to place the word into.
 * @param seed An integer seed value that determines how the word is
 *     laid out.
 *
 * @return An array of 2-element within-supertile tile x/y coordinates
 *     specifying the path onto which the glyphs of the word were placed.
 */
export function inlay_word(supertile, glyphs, socket, seed) {
    let result = [];
    let r = anarchy.lfsr(seed + 1892831081);
    let chosen;

    // Choose a permutation:

    // First pick the crossover point:
    let xo = CROSSOVER_POINTS[anarchy.idist(r, 0, CROSSOVER_POINTS.length)];
    r = anarchy.lfsr(r);
    let site = 2;
    if (grid.is_canonical(socket)) {
        site = xo[0];
    } else {
        site = xo[1];
    }

    let filtered = filter_permutations(
        SOCKET_PERMUTATIONS[socket],
        site,
        glyphs.length - 1 // path connects glyphs
    );
    let cidx = anarchy.idist(r, 0, filtered.length);
    chosen = filtered[cidx];

    // Finally, punch in the glyphs:
    let pos = chosen[1];
    let path = chosen[2];
    for (let i = 0; i < glyphs.length; ++i) {
        supertile.glyphs[grid.igp__index(pos)] = glyphs[i];
        result.push(pos);
        if (i < glyphs.length - 1) {
            pos = grid.neighbor(pos, path[i]);
        }
    }

    return result;
}

/**
 * Calls the appropriate supertile generator for the dimension requested.
 *
 * @param dimension A dimension object.
 * @param sgp A 2-element global x/y supergrid position array.
 * @param world_seed The integer world seed value.
 *
 * @return A supertile object (see generate_full_supertile).
 */
export function generate_supertile(dimension, sgp, world_seed) {
    let k = dimensions.kind(dimension);
    if (k == "full") {
        return generate_full_supertile(dimension, sgp, world_seed);
    } else if (k == "pocket" || k == "custom") {
        return generate_pocket_supertile(
            dimension,
            sgp,
            world_seed
        );
    } else {
        throw (
            "Internal Error: unknown dimension type '"
            + dimensions.kind(dimension) + "'"
        );
    }
}

/**
 * Returns a list of domain objects for the given domain, which can be
 * either a string or a single domain object.
 *
 * @param dom_or_string A domain object or a string naming a domain or
 *     combo.
 * @return An array of domain objects for the given combo, or an array
 * containing the single domain object given (or the single domain object
 * corresponding to the given name).
 */
export function domain_objects(dom_or_string) {
    if ("" + dom_or_string === dom_or_string) {
        return dict.lookup_domains(domains_list(dom_or_string));
    } else {
        return [ dom_or_string ];
    }
}


/**
 * Given that the necessary domain(s) and multiplanar info are all
 * available, generates the glyph contents of the supertile at the given
 * position in a full dimension. Returns undefined if there's missing
 * information.
 *
 * @param dimension A dimension object.
 * @param sgp A 2-element supergrid position x/y coordinate array.
 * @param world_seed The integer world seed.
 *
 * @return Undefined if there's required information that's not loaded
 *     yet, or a supertile object with the following keys:
 *
 *     pos: A copy of the sgp parameter.
 *     world_seed: The world_seed parameter.
 *     dimension: The dimension parameter (not a copy).
 *     glyphs: A 49-element array storing one glyph string for each of
 *         the 37 tiles in this supertile (with some gaps; see
 *         grid.is_valid_subindex).
 *     colors: Another array in the same format, storing one color value
 *         per tile. These are the tile-inherent colors which are
 *         currently only used for debugging purposes (TODO), not the
 *         spreadable colors that come from active color elements.
 *     domains: A third 49-element per-tile array to hold domain strings
 *         indicating which domain each tile belongs to. The value will
 *         be "__active__" for interactable active elements.
 *     words: An array of glyphs arrays holding all of the words that are
 *         embedded in sockets that are part of this supertile (those
 *         words usually each stretch into neighboring supertiles). There
 *         are in some cases many other words that can be found involving
 *         this supertile which were not intentionally placed.
 */
export function generate_full_supertile(dimension, sgp, world_seed) {
    let result = {
        "pos": sgp.slice(),
        "world_seed": world_seed,
        "dimension": dimension,
        "glyphs": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
        "colors": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
        "domains": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
        "words": [],
    };

    let default_domain = dimensions.natural_domain(dimension);

    let seed = world_seed;
    let s = dimensions.seed(dimension);
    seed ^= s;
    for (let i = 0; i < (s % 5) + 3; ++i) {
        seed = anarchy.prng(seed);
    }
    result.seed = seed;

    // set glyphs, colors, and domains to undefined:
    for (let i = 0; i < grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE; ++i) {
        result.glyphs[i] = undefined;
        result.colors[i] = [];
        result.domains[i] = undefined;
    }

    // Is this supertile actually an overlength supertile?
    let ugp = grid.sgp__ugp(sgp);
    let utseed = ultratile_seed(ugp, dimension, world_seed);
    // Ultratile context:
    let utcontext = caching.cached_value(
        "ultratile_context",
        [ dict.name_of(default_domain), [ ugp[0], ugp[1] ], utseed ]
    );
    if (utcontext == null) {
        return undefined;
    }

    // First, embed any socketed words
    let socket_count = embed_socketed_words(result);
    if (socket_count == undefined) {
        return undefined;
    }

    // Next, for overlength supertiles, embed the assigned overlength word
    let asg = punctuated_overlength_index(ugp, utcontext, world_seed);
    if (asg != undefined) {
        let success = embed_overlength_word(result, asg);
        if (success == undefined) {
            return undefined;
        }
    }

    // Assignment region position of the canonical socket in this supertile:
    let arp = grid.sgap__arp([sgp[0], sgp[1], 0]);
    // Use that to seed our random values:
    let r = anarchy.lfsr(sghash(seed, arp));

    // Next, since our required words are out of the way, embed our
    // active element, if we have one, at a random unfilled spot (there
    // will be at least one). TODO: We could be much more efficient at
    // keeping track of unfilled spots!
    let sidx = grid.sgp__index(sgp);
    let act = utcontext.active_map[sidx];
    if (act != undefined) {
        let sseed = anarchy.lfsr(r + 9328749);
        let stsq = grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE;
        for (let i = 0; i < stsq; ++i) {
            let si = anarchy.cohort_shuffle(i, stsq, sseed);
            let xy = grid.index__igp(i);
            if (grid.is_valid_subindex(xy)) {
                let idx = grid.igp__index(xy);
                if (result.glyphs[idx] == undefined) {
                    result.glyphs[idx] = act;
                    result.domains[idx] = "__active__";
                    break; // done placing active element
                } // else keep looking for an empty spot
            }
        }
    }

    // First try to add more words, then fill any remaining voids:
    // TODO: Call augment multiple times with different domains when inclusions
    // are present?
    // TODO: Leave some empty spaces?
    // augment_words(result, default_domain, r, WORMS_LEAVE_EMPTY);
    augment_words(result, default_domain, r, 0);
    r = anarchy.lfsr(r);
    // Double augment may fill extra gaps
    augment_words(result, default_domain, r, 0);
    r = anarchy.lfsr(r);
    // TODO: fill voids?
    // Fill voids with glyphs according to unigram/bigram/trigram probabilities
    // nearby:
    //fill_voids(result, default_domain, r);
    // Fill voids with spaces, which are unusable:
    empty_voids(result);

    // all glyphs have been filled in; we're done here!
    return result;
}

/**
 * Picks a word for each socket in a supertile and embeds it (or the
 * relevant part of it). Returns undefined if required ultratile context is
 * still unavailable, or the number of socketed words embedded if it
 * succeeds.
 *
 * @param supertile The supertile object to modify.
 *
 * @return undefined when there's required context that isn't loaded yet,
 *     or an integer indicating how many words were embedded.
 */
export function embed_socketed_words(supertile) {
    let sgp = supertile.pos;
    let seed = supertile.seed;
    let world_seed = supertile.world_seed;
    let dimension = supertile.dimension;
    let default_domain = dimensions.natural_domain(dimension);
    let embed_count = 0;
    for (let socket = 0; socket < grid.COMBINED_SOCKETS; socket += 1) {
        let sgap = grid.canonical_sgapos([sgp[0], sgp[1], socket]);
        let ugp = grid.sgp__ugp(sgap); // socket index is ignored
        let utseed = ultratile_seed(ugp, dimension, world_seed);

        // Compute ultratile context (might come from neighbor):
        let utcontext = caching.cached_value(
            "ultratile_context",
            [ dict.name_of(default_domain), [ ugp[0], ugp[1] ], utseed ]
        );
        if (utcontext == null) {
            return undefined;
        }

        let asg = punctuated_assignment_index(
            [ ugp[0], ugp[1], ugp[2], ugp[3], sgap[2] ],
            utcontext,
            world_seed
        );
        // If this socket is unassigned (perhaps because of a neighboring
        // overlength supertile, for example), then we skip it and continue to
        // the next socket.
        if (asg == undefined) {
            continue;
        } else {
            embed_count += 1;
        }

        let asg_x = asg[0];
        let asg_y = asg[1];
        let asg_idx = asg[2];
        let mpo = asg[3];
        let l_seed = sghash(seed, asg);

        if (isNaN(mpo)) {
            console.warn("Asg result:", asg);
            throw "Internal Error: multiplanar offset is NaN.";
        }

        let mdim = dimensions.neighboring_dimension(dimension, mpo);
        let domain = dimensions.natural_domain(mdim);

        if (domain == undefined) {
            console.warn("Dimension with undefined natural domain:", mdim);
            throw "Internal Error: Dimension has no natural domain!";
        }

        // Ensure domain(s) are loaded:
        let dl = domains_list(domain);
        let doms = dict.lookup_domains(dl);
        if (doms == undefined) {
            return undefined;
        }

        // Pick a socketable word for this socket:
        let entry = pick_short_word(doms, asg, l_seed);
        if (entry == undefined) {
            return undefined;
        }

        // Pick an embedding seed:
        let r = anarchy.lfsr(sghash(l_seed, sgap));

        // Embed that word in this socket:
        let glyphs = entry[0].slice();
        let maxlen = grid.SOCKET_SIZE;
        if (glyphs.length > maxlen) {
            if (WARNINGS) {
                console.warn(
                    "Overlength word in socket despite pick_short_word!"
                );
            }
            // This word will be assigned to a long-word supertile; we
            // can skip it here in favor of a shorter word:
            entry = sample_word(domain, r, maxlen);
            r = anarchy.lfsr(r);
            if (entry == undefined) {
                // No words short enough? Skip all sockets (more food for
                // worms)! Note: This should only happen in very odd
                // domains!
                break;
            }
            glyphs = entry[0].slice();
        }
        supertile.words.push(glyphs);

        // pick embedding direction & portion to embed
        let flip = (r % 2) == 0;
        r = anarchy.lfsr(r);
        let half_max = Math.floor(maxlen / 2);
        let min_cut = glyphs.length - half_max;
        let max_cut = half_max;
        let cut;
        if (min_cut == max_cut) {
            cut = min_cut;
        } else if (min_cut > max_cut) {
            // This shouldn't be possible any more...
            console.error(
                "Slicing glyphs for overlength word: '" + glyphs + "'"
            );
            glyphs = glyphs.slice(0, maxlen);
            cut = half_max;
        } else {
            cut = anarchy.idist(r, min_cut, max_cut + 1);
        }
        r = anarchy.lfsr(r);
        if (flip ^ grid.is_canonical(socket)) { // take first half
            glyphs = glyphs.slice(0, cut);
            // and reverse ordering
            glyphs = glyphs.split("").reverse().join("");
        } else {
            glyphs = glyphs.slice(cut);
        }
        let touched = inlay_word(supertile, glyphs, socket, r);
        r = anarchy.lfsr(r);
        for (let i = 0; i < touched.length; ++i) {
            let idx = grid.igp__index(touched[i]);
            supertile.domains[idx] = domain;
            if (DEBUG_SHOW_SOCKETS) {
                supertile.colors[idx].push(
                    ["bl", "yl", "gn"][socket % 3]
                );
            }
        }
    }
    // Embedding successful
    return embed_count;
}

/**
 * Picks a word for this overlength supertile and embeds it. Returns
 * undefined if required ultratile context is still unavailable, or true if
 * it succeeds.
 *
 * @param supertile The supertile object to modify.
 * @param asg A 4-element assignment grid position array that includes
 *     assignment region x/y coordinates, a socket index within that
 *     assignment region, and a multiplanar offset integer.
 *
 * @return True if it succeeds, or undefined if required content is not
 *     yet loaded.
 */
export function embed_overlength_word(supertile, asg) {
    let seed = supertile.seed;
    let world_seed = supertile.world_seed;
    let dimension = supertile.dimension;

    let asg_x = asg[0];
    let asg_y = asg[1];
    let asg_idx = asg[2];
    let mpo = asg[3];
    let l_seed = sghash(seed, asg);
    let r = anarchy.lfsr(l_seed);

    let mdim = dimensions.neighboring_dimension(dimension, mpo);
    let domain = dimensions.natural_domain(mdim);

    // Ensure domain(s) are loaded:
    let dl = domains_list(domain);
    let doms = dict.lookup_domains(dl);
    if (doms == undefined) {
        return undefined;
    }

    // Pick a word
    // TODO: Long words only for normal domains, but all words for
    // overlength-primary domains.
    let entry = pick_word(doms, asg, l_seed);

    if (entry == undefined) {
        return undefined;
    }
    let glyphs = entry[0].slice();

    // Embed that word in this supertile:
    // First attempt: see if we can do it randomly by finding a worm that's
    // long enough.
    let fit = undefined;
    let attempts = OVERLENGTH_WORM_ATTEMPTS;
    while (fit == undefined && attempts > 0) {
        let worms = find_worms(supertile, r);
        attempts -= 1;
        r = anarchy.lfsr(r);
        for (let worm of worms) {
            if (worm.length >= glyphs.length) {
                fit = worm;
                break;
            }
        }
    }
    if (fit == undefined) {
        // We didn't find a fit using worms, so we'll use a pattern-based
        // embedding instead.
        // TODO: pattern-based embedding here
    } else {
        // We found a worm that fits our word, so embed it:
        supertile.words.push(glyphs);
        for (let i = 0; i < glyphs.length; ++i) {
            let idx = fit.pop();
            supertile.glyphs[idx] = glyphs[i];
            supertile.domains[idx] = domain;
            if (DEBUG_SHOW_SOCKETS) {
                let color = ["lb", "rd", "lg"][anarchy.posmod(r, 3)];
                supertile.colors[idx].push(color);
            }
        }
    }
    // Embedding was successful
    return true;
}

/**
 * Returns a list of words known to be on the given supertile without
 * generating the supertile. Not all words on the supertile (e.g.,
 * augmented words) are returned.
 * TODO: Add maybe-words when standby augmentation is implemented.
 * TODO: IMPLEMENT THIS!
 */
export function supertile_known_words(dimension, sgp, world_seed) {
}

/**
 * Computes and returns the size of small worms to skip over when
 * augmenting supertiles using the given domain.
 *
 * Essentially, in a language like English, we'd like to avoid filling
 * every 1- or 2-glyph gap with one of the relatively few 1- or 2-glyph
 * words, and fill them with random letters instead to make things more
 * interesting and to more often create rarer longer words
 * serendipitously. On the other hand, in a language like Chinese, the
 * majority of words might already be 1- or 2-glyph words, and there
 * might be many of them, so skipping short worms is neither necessary
 * nor desirable.
 *
 * @param domain A domain object or string naming a domain or combo.
 *
 * @return A modified WORM_FILL_SKIP integer that's less than or equal to
 *     the full value. It will be the highest number for which words of
 *     less than or equal to that length account for less than
 *     WORM_FILL_SKIP_BACKOFF_RATIO of the total words in the given
 *     domain.
 */
export function worm_fill_skip(domain) {
    let domain_objs = domain_objects(domain);
    let wfs = WORM_FILL_SKIP;
    while (wfs > 0) {
        let short_total = domain_objs
            .map(d => dict.words_no_longer_than(d, wfs)) // jshint ignore: line
            .reduce((a, b) => a + b);
        let grand_total = domain_objs
            .map(d => d.entries.length)
            .reduce((a, b) => a + b);
        let ratio = short_total / grand_total;
        if (ratio >= WORM_FILL_SKIP_BACKOFF_RATIO) {
            wfs -= 1; // and check again
        } else {
            break; // skipping is allowed
        }
    }
    return wfs;
}

/**
 * Using the given seed, finds a set of random paths that together fill up
 * all empty space in the given supertile. Because worms can kill
 * themselves through collisions with themselves, edges, or other worms,
 * even on a completely empty supertile there are no guarantees about the
 * number of worms or their length, but the algorithm does grow worms one
 * at a time until each worm gets stuck.
 *
 * @param supertile The supertile object to find paths in.
 * @param seed An integer that determines which random paths we find.
 *
 * @return An array of 'worms', each of which is an array of supertile
 *     glyph indices (see grid.igp__index) that traces out a connected
 *     path through the supertile. None of the paths overlap each other,
 *     and together they cover every unoccupied tile in the supertile.
 */
export function find_worms(supertile, seed) {
    let sseed = sghash(seed + 128301982, supertile.pos); // worm origins
    let dseed = sghash(seed + 9849283, supertile.pos); // worm growth directions
    let worms = [];
    let claimed = {};
    // First, find all worms of open space in the supertile
    function can_grow(i) {
        let xy = grid.index__igp(i);
        return (
            grid.is_valid_subindex(xy)
            && supertile.glyphs[i] == undefined
            && !claimed.hasOwnProperty(grid.coords__key(xy))
        );
    }
    function claim_space(i) {
        let xy = grid.index__igp(i);
        claimed[grid.coords__key(xy)] = true;
    }
    for (let i = 0; i < grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE; ++i) {
        let ii = anarchy.cohort_shuffle(
            i,
            grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE,
            sseed
        ); // iterate in shuffled order
        if (!can_grow(ii)) {
            continue;
        }
        // Build a worm here:
        let origin = ii;
        let worm = [origin];
        claim_space(origin);
        worms.push(worm);
        // grow twice for head & tail
        for (let j = 0; j < 2; ++j) {
            let here;
            if (j == 0) { // tail grows at end
                here = worm[worm.length - 1];
            } else { // head grows at front
                here = worm[0];
            }
            while (true) {
                dseed = anarchy.lfsr(dseed);
                let hxy = grid.index__igp(here);
                let did_grow = false;
                for (let d = 0; d < grid.N_DIRECTIONS; ++d) {
                    let dd = anarchy.cohort_shuffle(
                        d,
                        grid.N_DIRECTIONS,
                        dseed
                    );
                    let nb = grid.neighbor(hxy, dd);
                    if (!grid.is_valid_subindex(nb)) {
                        continue; // skip out-of-bounds
                    }
                    let ni = grid.igp__index(nb);
                    if (can_grow(ni)) {
                        claim_space(ni);
                        if (j == 0) { // tail grows at end
                            worm.push(ni);
                        } else { // head grows at front
                            worm.unshift(ni);
                        }
                        here = ni;
                        did_grow = true;
                        break;
                    }
                }
                if (!did_grow) {
                    break; // we've run out of room to grow this end
                }
            }
        } // done growing this worm; loop again to grow the next one
    } // done growing all possible worms

    return worms;
}

/**
 * Finds all open spaces in the supertile and organizes them into linear
 * paths, and then fills some or all of those paths with words from the
 * given domain, leaving at least the given number of spaces empty (or none
 * if leave_empty is not given). More spaces may be left empty if the
 * available space (or its partition into linear paths) doesn't leave
 * enough space in some places to fit a whole word from the domain. Fewer
 * empty spaces may remain if there weren't that many spaces open to begin
 * with.
 * TODO: Use standby words in order to create more reverse-searchability.
 *
 * @param supertile The supertile object to modify.
 * @param domain A domain object or string naming a domain or combo from
 *     which to sample words.
 * @param seed An integer seed that determines the outcome.
 * @param leave_empty (optional) A minimum number of spaces to leave
 *     empty during this process. If not given, defaults to 0. Will
 *     always be respected unless the supertile already does not have
 *     enough empty slots; more spaces than this may remain empty if the
 *     domain lacks words short enough to fill in small gaps.
 *
 * @return Nothing (undefined). The given supertile is modified.
 */
export function augment_words(supertile, domain, seed, leave_empty) {
    if (leave_empty == undefined) {
        leave_empty = 0;
    }

    let worms = find_worms(supertile, seed);
    let open_spaces = worms
        .map(w => w.length)
        .reduce((a, b) => a + b, 0);

    // limit for skipping small worms
    let wfs = worm_fill_skip(domain);
    // Now fill up worms with glyphs:
    let sseed = anarchy.lfsr(seed + 19211371);
    let wseed = sghash(seed + 619287712, supertile.pos); // word sampling
    // TODO: Fill worms using inclusion domains when nearby?
    for (let i = 0; i < worms.length; ++i) {
        let ii = anarchy.cohort_shuffle(i, worms.length, sseed);
        let worm = worms[ii];
        let wtw = 0; // which Word in This Worm?
        let remaining;
        let limit;
        // multiple words per worm
        while (worm.length > wfs) {
            remaining = open_spaces - leave_empty;
            limit = Math.min(worm.length, remaining);
            wseed = anarchy.lfsr(wseed + worm[worm.length-1] + wtw);
            wtw += 1;
            let fill = sample_word(domain, wseed, limit);
            if (fill == undefined) {
                break; // no more possible words for this worm; try next
            }
            seed = anarchy.lfsr(seed);
            let glyphs = fill[0].slice();
            supertile.words.push(glyphs);
            for (let j = 0; j < glyphs.length; ++j) {
                let idx = worm.pop();
                supertile.glyphs[idx] = glyphs[j];
                supertile.domains[idx] = domain;
                if (DEBUG_SHOW_SOCKETS) {
                    let color = ["lb", "rd", "lg"][anarchy.posmod(wseed, 3)];
                    supertile.colors[idx].push(color);
                }
                open_spaces -= 1;
            }
        }
        if (remaining <= worm.length) {
            break; // We're totally done: our remaining spaces aren't enough
        } // Otherwise try the next worm
    }

    // Done with agumentation
}

/**
 * Given a partially-filled supertile, fill remaining spots with letters
 * according to unigram, bigram, and trigram probabilities from the given
 * dimensions.
 *
 * @param supertile The supertile object to edit.
 * @param default_domain A default domain to pick a glyph from when no
 *     domain information is available from neighboring glyphs.
 * @param seed An integer seed that determines the outcome.
 *
 * @return Nothing (undefined). The given supertile is modified.
 */
export function fill_voids(supertile, default_domain, seed) {
    let sseed = seed;
    let r = seed;
    let baseline_counts = {}; // combined glyph counts caches
    let binary_counts = {};
    let trinary_counts = {};
    for (let i = 0; i < grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE; ++i) {
        let ii = anarchy.cohort_shuffle(
            i,
            grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE,
            sseed
        ); // iterate in shuffled order
        let xy = grid.index__igp(ii);
        if (!grid.is_valid_subindex(xy)) { // skip out-of-bounds indices
            continue;
        }
        if (supertile.glyphs[ii] == undefined) { // need to fill it in
            let neighbors = []; // list filled-in neighbors
            let nbdoms = []; // list their domains
            for (let j = 0; j < grid.N_DIRECTIONS; ++j) {
                let nb = grid.neighbor(xy, j);
                let ni = grid.igp__index(nb);
                let ng = supertile.glyphs[ni];
                let nd = supertile.domains[ni];
                if (ng != undefined && nd != "__active__") {
                    neighbors.push(ng);
                    nbdoms.push(supertile.domains[ni]);
                }
            }

            // Simplify mixed-domain neighbors list to single-domain +
            // glyphs list:
            let nbdom = undefined;
            let nbglyphs = undefined;
            if (neighbors.length == 0) { // should be rare
                nbdom = default_domain;
                nbglyphs = [];
            } else if (neighbors.length == 1) {
                nbdom = nbdoms[0];
                nbglyphs = neighbors[0];
            } else if (neighbors.length == 2) {
                if (nbdoms[0] == nbdoms[1]) {
                    nbdom = nbdoms[0];
                    nbglyphs = neighbors.slice();
                } else {
                    let ri = (r & 0x10) >>> 4; // check an arbitrary bit
                    r = anarchy.lfsr(r);
                    nbdom = nbdoms[ri];
                    nbglyphs = [ neighbors[ri] ];
                }
            } else { // more than 2 neighbors: pick some
                let maxdom = undefined;
                let maxcount = 0;
                let domcounts = {};
                let domglyphs = {};
                for (let j = 0; j < nbdoms.length; ++j) {
                    if (domcounts.hasOwnProperty(nbdoms[j])) {
                        domcounts[nbdoms[j]] += 1;
                        domglyphs[nbdoms[j]].push(neighbors[j]);
                    } else {
                        domcounts[nbdoms[j]] = 1;
                        domglyphs[nbdoms[j]] = [ neighbors[j] ];
                    }
                    if (domcounts[nbdoms[j]] > maxcount) {
                        maxcount = domcounts[nbdoms[j]];
                        maxdom = nbdoms[j];
                    }
                }
                nbdom = maxdom;
                nbglyphs = domglyphs[maxdom];
            }

            // Now that we have single-domain neighbors, pick a glyph:
            supertile.domains[ii] = nbdom;
            let unicounts = undefined;
            let bicounts = undefined;
            let tricounts = undefined;
            if (nbglyphs.length == 0) {
                if (baseline_counts.hasOwnProperty(nbdom)) {
                    unicounts = baseline_counts[nbdom];
                } else {
                    unicounts = combined_counts(domains_list(nbdom));
                    baseline_counts[nbdom] = unicounts;
                }
                supertile.glyphs[ii] = sample_glyph(r, undefined, unicounts);
                r = anarchy.lfsr(r);
            } else if (nbglyphs.length == 1) {
                if (baseline_counts.hasOwnProperty(nbdom)) {
                    unicounts = baseline_counts[nbdom];
                } else {
                    unicounts = combined_counts(domains_list(nbdom));
                    baseline_counts[nbdom] = unicounts;
                }
                if (binary_counts.hasOwnProperty(nbdom)) {
                    bicounts = binary_counts[nbdom];
                } else {
                    bicounts = combined_bicounts(domains_list(nbdom));
                    binary_counts[nbdom] = bicounts;
                }
                supertile.glyphs[ii] = sample_glyph(
                    r,
                    nbglyphs[0],
                    unicounts,
                    bicounts
                );
                r = anarchy.lfsr(r);
            } else if (nbglyphs.length >= 2) {
                // TODO: Shuffle first here?
                nbglyphs = nbglyphs.slice(0,2);
                if (baseline_counts.hasOwnProperty(nbdom)) {
                    unicounts = baseline_counts[nbdom];
                } else {
                    unicounts = combined_counts(domains_list(nbdom));
                    baseline_counts[nbdom] = unicounts;
                }
                if (binary_counts.hasOwnProperty(nbdom)) {
                    bicounts = binary_counts[nbdom];
                } else {
                    bicounts = combined_bicounts(domains_list(nbdom));
                    binary_counts[nbdom] = bicounts;
                }
                if (trinary_counts.hasOwnProperty(nbdom)) {
                    tricounts = trinary_counts[nbdom];
                } else {
                    tricounts = combined_tricounts(domains_list(nbdom));
                    trinary_counts[nbdom] = tricounts;
                }
                supertile.glyphs[ii] = sample_glyph(
                    r,
                    nbglyphs,
                    unicounts,
                    bicounts,
                    tricounts
                );
                r = anarchy.lfsr(r);
            }
        }
    }
}

/**
 * Given a partially-filled supertile, fill remaining spots with empty
 * glyphs. These have a space as their glyph value and "__empty__" as
 * their domain.
 *
 * @param supertile The supertile to edit.
 *
 * @return Nothing (undefined). The given supertile is modified.
 */
export function empty_voids(supertile) {
    for (let i = 0; i < grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE; ++i) {
        let xy = grid.index__igp(i);
        if (!grid.is_valid_subindex(xy)) { // skip out-of-bounds indices
            continue;
        }
        if (supertile.glyphs[i] == undefined) { // need to fill it in
            supertile.glyphs[i] = " ";
            supertile.domains[i] = "__empty__";
        }
    }
}

/**
 * Takes a list of glyph sequences and ensures that each is placed in the
 * given layout. Modifies the given layout.
 *
 * @param layout A layout object that holds a finite-area region of
 *     glyphs which is not constrained to a single supertile.
 * @param glyphs_lists An array of glyph arrays specifying the sequences
 *     of glyphs to be placed.
 * @param seed An integer seed that determines the outcome.
 *
 * @return Nothing (undefined). The given layout is updated.
 */
export function place_glyphs_in_layout(layout, glyphs_lists, seed) {
    let rng = seed;
    for (let i = 0; i < glyphs_lists.length; ++i) {
        let ii = anarchy.cohort_shuffle(i, glyphs_lists.length, seed);
        let gl = glyphs_lists[ii];
        add_glyphs_to_layout(layout, gl, rng);
        rng = anarchy.prng(rng, seed);
    }
}

/**
 * Adds a single glyphs list to the given layout, overlapping with existing
 * material where reasonably possible, otherwise on its own.
 *
 * TODO: Instead of picking a new random unused starting point for each
 * subsequent attempt, use shuffling logic to pick successive unused
 * points to give greater variety to our attempts.
 *
 * @param layout The layout object to modify.
 * @param glyphs A single array of glyphs to be added.
 * @param seed An integer seed that determines the outcome.
 *
 * @return Nothing (undefined). The given layout is modified.
 */
export function add_glyphs_to_layout(layout, glyphs, seed) {
    let set = layout[0];
    let find = layout[1];
    let shs = seed; // stable seed for shuffling
    let ishs = seed + 173; // inner shuffle seed
    seed = anarchy.lfsr(seed);
    let done = false;
    let additions = undefined;
    for (let attempt = 0; attempt < EMBEDDING_ATTEMPTS; ++attempt) {
        for (let i = 0; i < glyphs.length; ++i) {
            let ii = anarchy.cohort_shuffle(i, glyphs.length, shs);
            let g = glyphs[ii];
            let after = glyphs.slice(ii);
            let before = glyphs.slice(0,ii+1);
            before.reverse();
            ishs = anarchy.lfsr(ishs);
            if (find.hasOwnProperty(g)) {
                // try to start from an existing anchor
                let anchors = find[g];
                for (let j = 0; j < anchors.length; ++j) {
                    let jj = anarchy.cohort_shuffle(j, anchors.length, ishs);
                    let start = anchors[jj];
                    additions = attempt_to_add_glyph_sequence(
                        layout,
                        after,
                        start,
                        seed
                    );
                    seed = anarchy.lfsr(seed);
                    if (additions == undefined) {
                        continue;
                    }
                    additions = attempt_to_add_glyph_sequence(
                        layout,
                        before,
                        start,
                        seed,
                        additions
                    );
                    seed = anarchy.lfsr(seed);
                    if (additions != undefined) {
                        done = true;
                        break;
                    }
                }
            }
            if (done) {
                break;
            }
            // start in a random unused position near the origin
            let start = random_unused(layout, seed);
            seed = anarchy.lfsr(seed);
            additions = attempt_to_add_glyph_sequence(
                layout,
                glyphs,
                start,
                seed
            );
            if (additions != undefined) {
                done = true;
                break;
            }
        }
        if (done) {
            break;
        }
    }
    if (done) {
        // now actually modify the layout:
        for (let k of Object.keys(additions)) {
            let g = additions[k];
            let gp = grid.key__coords(k);
            if (set.hasOwnProperty(k) && set[k] != g) {
                let old = set[k];
                console.warn(
                    "Reassigning layout glyph at " + k + ": '" + old
                    + "' -> '" + g + "'"
                );
            }
            set[k] = g;
            if (find.hasOwnProperty(g)) {
                find[g].push(gp);
            } else {
                find[g] = [ gp ];
            }
        }
    } else {
        // fallback: add using regular pattern in unused space.
        // TODO: THIS!
    }
}

/**
 * Finds a random unused position within the given layout, prioritizing
 * positions closer to the origin, expanding gradually outwards. The
 * number of already-assigned positions in the given layout
 * influences the spread of unused position selection, and unused
 * positions returned will almost always be fairly close to the origin.
 *
 * @param layout The layout object to find an unused tile in.
 * @param seed An integer seed that determines which unused tile we'll
 *     find.
 *
 * @return A 2-element x/y tile coordinate array specifying a location
 *     that's currently unused in the given layout.
 */
export function random_unused(layout, seed) {
    let set = layout[0];
    let used = Object.keys(set).length;
    // How many positions we'll consider (must be > used)
    let cap = Math.floor(used * 1.5);
    // Each section will be 1/3 of the cap, and we'll draw randomly from
    // 3x section 1, 2x section 2 and 2x section 3.
    let section = Math.floor(Math.max(grid.SUPERTILE_TILES, cap)/3);

    // Iterate until we find an unused tile (since we might repeatedly
    // check filled positions, we need to exhaust our virtual tickets.
    for (let i = 0; i < 6*section; ++i) {
        // Draw a "ticket" from 0 to 6*section
        let draw = anarchy.cohort_shuffle(i, 6*section, seed);
        if (draw < 3*section) {
            // First 3 sections of tickets come from the innermost section
            draw = draw % section;
        } else if (draw < 5*section) {
            // Next 2 come from the middle section
            draw = section + draw % section;
        } else {
            // Final batch of tickets comes from the outermost section
            draw = 2*section + draw % section;
        }
        // convert our spiral index into a grid position and thence a key
        let gp = grid.si__igp(draw);
        let k = grid.coords__key(gp);
        // check if it's occupied, if not that's our result
        if (set.hasOwnProperty(k)) {
            continue;
        }
        return gp;
    }

    if (WARNINGS) {
        console.warn("Failed to find an unused position in a layout!");
    }
}

/**
 * Makes a random attempt to add the given glyph sequence to the given
 * layout, attempting overlaps half of the time when possible. The optional
 * 'prev' argument is a mapping from coordinate keys to glyphs indicating
 * glyphs not in the layout that have been provisionally placed (these
 * positions won't be reused even when overlap might be possible). Does not
 * modify the given layout, but instead modifies the previous partial
 * mapping, or returns a new mapping from coordinate keys to glyphs.
 *
 * @param layout The layout object to respect when picking glyph
 *     locations.
 * @param glyphs An array of glyphs to be placed.
 * @param start A 2-element x/y tile coordinate array indicating where
 *     the first glyph should be placed. The placement of the first glyph
 *     ignores the layout entirely, so only pass the coordinates of a
 *     tile that's in-use if the glyph in that tile in the layout is the
 *     same as the first glyph in the glyphs array to be placed.
 * @param seed An integer seed that determines the outcome.
 * @param prev (optional) An object mapping tile coordinate keys (see
 *     grid.coords_key) to glyphs indicating an already-placed part of
 *     the current glyph sequence. During placement these positions will
 *     not be used for overlaps, since that would cause the glyph
 *     sequence to overlap with itself.
 *
 * @return An object mapping tile coordinate keys (see grid.coords_key)
 *     to glyphs indicating where to place each glyph of the given
 *     sequence into the given layout while avoiding any previously-used
 *     region. If the algorithm fails to find such a result starting at
 *     the given starting point, it will return undefined. This can
 *     happen even with an empty layout if the algorithm circles back on
 *     itself in such a way that it cuts itself off, but this is quite
 *     unlikely and if the layout is empty, is only possible for glyph
 *     sequences of length 8 or more. With crowded layout, failure is
 *     much more likely.
 */
export function attempt_to_add_glyph_sequence(
    layout,
    glyphs,
    start,
    seed,
    prev
) {
    let result = prev || {};
    let set = layout[0];
    let pos = start;
    let failed = false;
    let shs = seed;
    seed = anarchy.lfsr(seed);
    let g = glyphs[0];
    for (let i = 1; i < glyphs.length; ++i) {
        // put glyph into place
        let k = grid.coords__key(pos);
        result[k] = g;
        g = glyphs[i];
        let overlaps = [];
        let fresh = [];
        let next = undefined;
        shs = anarchy.lfsr(shs);
        for (let nd = 0; nd < grid.N_DIRECTIONS; ++nd) {
            let sd = anarchy.cohort_shuffle(nd, grid.N_DIRECTIONS, shs);
            let np = grid.neighbor(pos, sd);
            let nk = grid.coords__key(np);
            if (result.hasOwnProperty(nk)) {
                // This position is already in use as part of the current
                // extended sequence.
                continue;
            } else if (set.hasOwnProperty(nk)) {
                // This position is used in the layout, but could be
                // overlapped upon
                if (set[nk] == g) {
                    // Overlap possible
                    overlaps.push(np);
                } else {
                    // No overlap possible/desired
                    continue;
                }
            } else {
                // An open spot
                fresh.push(np);
            }
        }
        if (overlaps.length > 0 && fresh.length > 0) {
            if (seed % 2 == 0) { // 50:50 use an overlap or a fresh option
                pos = overlaps[0];
            } else {
                pos = fresh[0];
            }
            seed = anarchy.lfsr(seed);
        } else if (overlaps.length > 0) {
            // only overlap available
            pos = overlaps[0];
        } else if (fresh.length > 0) {
            // only fresh available
            pos = fresh[0];
        } else {
            // nothing left
            failed = true;
            break;
        }
    }
    if (failed) {
        return undefined;
    } else {
        let k = grid.coords__key(pos);
        result[k] = g;
        return result;
    }
}

/**
 * Generates the layout for a pocket dimension by placing each of the
 * required words into a finite space. The layout object returned is a pair
 * of mappings: the first from positions to glyphs, and the second from
 * glyphs to position lists where those glyphs can be found.
 *
 * @param dimension A dimension object.
 *
 * @return A 2-element array containing two objects that are the inverse
 *     of each other. The first uses tile coordinate string keys (see
 *     grid.coords__key) as keys and glyphs as values, while the second
 *     uses glyphs as keys and arrays of one or more 2-element x/y tile
 *     coordinate arrays as values.
 */
export function generate_pocket_layout(dimension) {
    var words = dimensions.pocket_words(dimension);
    var seed = dimensions.seed(dimension);

    var layout = [{}, {}];

    // Ensure domain(s) are loaded:
    var nd = dimensions.natural_domain(dimension);
    var domains = dict.lookup_domains(domains_list(nd));
    if (domains == undefined) {
        return undefined;
    }

    place_glyphs_in_layout(layout, words, seed);

    return layout;
}

// Register generate_pocket_layout as a caching domain
caching.register_domain(
    "pocket_layout",
    dimension => "" + dimension,
    generate_pocket_layout,
    POCKET_LAYOUT_CACHE_SIZE
);

/**
 * Given that the necessary domain(s) and pocket layout are available,
 * generates the glyph contents of the supertile at the given position in a
 * pocket dimension. Returns undefined if there's missing information, or
 * null if the pocket dimension doesn't include a supertile at the given
 * position.
 *
 * @param dimension A dimension object.
 * @param sgp A 2-element supergrid x/y coordinate array specifying which
 *     supertile we're generating.
 * @param world_seed The integer world seed.
 *
 * @return A supertile object with the same properties as a result from
 *     generate_full_supertile.
 *
 * TODO: include words mappings in layouts so that we can have non-empty
 * words lists for pocket & custom dimension supertiles!
 */
export function generate_pocket_supertile(dimension, sgp, world_seed) {
    var result = {
        "pos": sgp.slice(),
        "world_seed": world_seed,
        "dimension": dimension,
        "glyphs": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
        "colors": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
        "domains": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
        "words": [],
    };

    // scramble the seed
    let seed = world_seed;
    let s = dimensions.seed(dimension);
    seed ^= s;
    for (var i = 0; i < (s % 5) + 3; ++i) {
        seed = anarchy.prng(seed);
    }

    let flavor = dimensions.flavor(dimension);

    // Get pocket dimension layout
    var pocket_layout = caching.cached_value(
        "pocket_layout",
        [ dimension ]
    );

    // Ensure domain(s) are loaded:
    let domain = dimensions.natural_domain(dimension);
    let dl = domains_list(domain);
    if (dict.lookup_domains(dl) == undefined) {
        return undefined;
    }

    // set glyphs, colors, and domains to undefined:
    for (let i = 0; i < grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE; ++i) {
        result.glyphs[i] = undefined;
        result.colors[i] = [];
        result.domains[i] = undefined;
    }
    if (pocket_layout == null) {
        return undefined;
    }

    // Fill in tiles specified by the layout:
    let touched = false;
    for (let sub_gp of grid.ALL_SUPERTILE_POSITIONS) {
        let gp = grid.sgp__gp([sgp[0], sgp[1], sub_gp[0], sub_gp[1]]);
        let k = grid.coords__key(gp);
        let g = pocket_layout[0][k];
        if (g != undefined) {
            touched = true;
            let idx = grid.igp__index(sub_gp);
            result.glyphs[idx] = g;
            result.domains[idx] = domain;
        }
    }
    if (!touched && flavor != "round") {
        return null;
    } else if (!touched) {
        // determine if we're inside the round area:
        let ring = 0;
        for (let k of Object.keys(pocket_layout[0])) {
            let gp = grid.key__coords(k);
            let sp = grid.gp__sgp(gp);
            let rh = grid.supergrid_distance([0, 0], sp);
            if (rh > ring) {
                ring = rh;
            }
        }
        if (grid.supergrid_distance([0, 0], sgp) > ring) {
            // outside of the ring
            return null;
        } // else inside
    }

    // TODO: use worms here

    // Finish filling empty tiles:
    fill_voids(result, domain, seed);

    // TODO: Check for supertile disjointedness?

    // all glyphs have been filled in, we're done here!
    return result;
}

/**
 * Merges two glyph counts, returning a new object. Normalizes both counts
 * first to avoid source-set-size bias.
 *
 * @param g1 An object whose keys are glyphs and whose values are
 *     numerical weights for each glyph indicating relative frequency
 *     (could be integer counts of each glyph in a corpus).
 * @param g2 A second such object.
 *
 * @return A new object of the same format which includes all glyphs from
 *     both count objects, with weights combined across the two objects.
 *     We treat each object as providing equal information about glyph
 *     probabilities, and thus the weight value of each glyph in the
 *     result is equal to the sum of the *normalized* weights it has in
 *     each object being merged (the result will be normalized to a total
 *     weight of 2 instead of 1).
 */
export function merge_glyph_counts(gs1, gs2) {
    var result = {};
    var gs1_total = 0;
    var gs2_total = 0;
    for (let g of Object.keys(gs1)) {
        gs1_total += gs1[g];
    }
    for (let g of Object.keys(gs2)) {
        gs2_total += gs2[g];
    }
    for (let g of Object.keys(gs1)) {
        result[g] = gs1[g] / gs1_total;
    }
    for (let g of Object.keys(gs2)) {
        if (result.hasOwnProperty(g)) {
            result[g] += gs2[g] / gs2_total;
        } else {
            result[g] = gs2[g] / gs2_total;
        }
    }
    return result;
}

/**
 * Merges two-layer nested frequency counts.
 *
 * @param gs1 An object which maps glyphs to sub-objects which map glyphs
 *     to numerical weight values. Each weight value indicates the
 *     relative probability/frequency of the pair of glyphs required to
 *     reach it in the nested object.
 * @param gs2 A second object of the same format as gs1.
 *
 * @return A combined 2-layer frequency count object with the same format
 *     as gs1 and gs2 which combines their information. As with
 *     merge_glyph_counts, normalization happens before merging.
 */
export function merge_glyph_bicounts(gs1, gs2) {
    let result = {};
    let gs1_total = 0;
    let gs2_total = 0;
    for (let g in gs1) {
        if (gs1.hasOwnProperty(g)) {
            for (let gg in gs1[g]) {
                if (gs1[g].hasOwnProperty(gg)) {
                    gs1_total += gs1[g][gg];
                }
            }
        }
    }
    for (let g in gs2) {
        if (gs2.hasOwnProperty(g)) {
            for (let gg in gs2[g]) {
                if (gs2[g].hasOwnProperty(gg)) {
                    gs2_total += gs2[g][gg];
                }
            }
        }
    }
    for (let g in gs1) {
        if (gs1.hasOwnProperty(g)) {
            result[g] = {};
            for (let gg in gs1[g]) {
                if (gs1[g].hasOwnProperty(gg)) {
                    result[g][gg] = gs1[g][gg] / gs1_total;
                }
            }
        }
    }
    for (let g in gs2) {
        if (gs2.hasOwnProperty(g)) {
            if (result.hasOwnProperty(g)) {
                for (let gg in gs2[g]) {
                    if (gs2[g].hasOwnProperty(gg)) {
                        if (result[g].hasOwnProperty(gg)) {
                            result[g][gg] += gs2[g][gg] / gs2_total;
                        } else {
                            result[g][gg] = gs2[g][gg] / gs2_total;
                        }
                    }
                }
            } else {
                result[g] = {};
                for (let gg in gs2[g]) {
                    if (gs2[g].hasOwnProperty(gg)) {
                        result[g][gg] = gs2[g][gg] / gs2_total;
                    }
                }
            }
        }
    }
    return result;
}

/**
 * Merges three-layer nested frequency counts.
 *
 * @param gs1 A three-layer glyph -> glyph -> glyph -> weight object,
 *     with a structure that's an extension of the bicounts objects that
 *     merge_glyph_bicounts deals with.
 * @param gs2 Another three-layer glyph frequency object with the same
 *     format.
 *
 * @return A merged three-layer glyph frequency object, constructed
 *     similarly to the results of merge_glyph_counts and
 *     merge_glyph_bicounts.
 */
export function merge_glyph_tricounts(gs1, gs2) {
    let result = {};
    let gs1_total = 0;
    let gs2_total = 0;
    for (let g of Object.keys(gs1)) {
        for (let gg of Object.keys(gs1[g])) {
            for (let ggg of Object.keys(gs1[g][gg])) {
                gs1_total += gs1[g][gg][ggg];
            }
        }
    }
    for (let g of Object.keys(gs2)) {
        for (let gg of Object.keys(gs2[g])) {
            for (let ggg of Object.keys(gs2[g][gg])) {
                gs2_total += gs2[g][gg][ggg];
            }
        }
    }
    for (let g of Object.keys(gs1)) {
        result[g] = {};
        for (let gg of Object.keys(gs1[g])) {
            result[g][gg] = {};
            for (let ggg of Object.keys(gs1[g][gg])) {
                result[g][gg][ggg] = gs1[g][gg][ggg] / gs1_total;
            }
        }
    }
    for (let g of Object.keys(gs2)) {
        if (result.hasOwnProperty(g)) {
            for (let gg of Object.keys(gs2[g])) {
                if (result[g].hasOwnProperty(gg)) {
                    for (let ggg of Object.keys(gs2[g][gg])) {
                        if (result[g][gg].hasOwnProperty(ggg)) {
                            result[g][gg][ggg] += gs2[g][gg][ggg] / gs2_total;
                        } else {
                            result[g][gg][ggg] = gs2[g][gg][ggg] / gs2_total;
                        }
                    }
                } else {
                    result[g][gg] = {};
                    for (let ggg of Object.keys(gs2[g][gg])) {
                        result[g][gg][ggg] = gs2[g][gg][ggg] / gs2_total;
                    }
                }
            }
        } else {
            result[g] = {};
            for (let gg of Object.keys(gs2[g])) {
                for (let ggg of Object.keys(gs2[g][gg])) {
                    result[g][gg][gg] = gs2[g][gg][ggg] / gs2_total;
                }
            }
        }
    }
    return result;
}

/**
 * Merges two-layer frequency counts into every layer-1 entry of
 * three-layer counts.
 *
 * TODO: Also incorporate the given bigrams as possible initial sequences
 * with trigram glyphs given unigram weights after each?
 *
 * TODO: Won't these results give 0 weight to glyph triples where each
 * glyph comes from the bigrams domain if the domains are distinct?
 *
 * @param trigrams A 3-layer glyph -> glyph -> glyph -> count object
 *     indicating how common various 3-glyph sequences are.
 * @param bigrams A 2-layer glyph -> glyph -> count object indicating the
 *     frequency of 2-glyph sequences.
 *
 * @return A new trigrams object where each entry in the original
 *     trigrams object at the top level (which was itself a bigrams
 *     object) has had the probabilities from the given bigrams object
 *     merged in. The counts are normalized into relative weights in the
 *     process. This result represents a world where after any of the
 *     glyphs that exist at the top layer of the trigrams object, a
 *     bigram sequence from the given bigrams object could occur with
 *     equal probability as a normal trigram completion from the original
 *     trigrams object.
 */
export function merge_bigrams_into_trigrams(trigrams, bigrams) {
    let result = {};
    let tri_total = 0;
    let bi_total = 0;
    for (let g in trigrams) {
        if (trigrams.hasOwnProperty(g)) {
            for (let gg in trigrams[g]) {
                if (trigrams[g].hasOwnProperty(gg)) {
                    for (let ggg in trigrams[g][gg]) {
                        if (trigrams[g][gg].hasOwnProperty(ggg)) {
                            tri_total += trigrams[g][gg][ggg];
                        }
                    }
                }
            }
        }
    }
    for (let g in bigrams) {
        if (bigrams.hasOwnProperty(g)) {
            for (let gg in bigrams[g]) {
                if (bigrams[g].hasOwnProperty(gg)) {
                    for (let ggg in bigrams[g][gg]) {
                        if (bigrams[g][gg].hasOwnProperty(ggg)) {
                            bi_total += bigrams[g][gg][ggg];
                        }
                    }
                }
            }
        }
    }
    for (let g in trigrams) {
        if (trigrams.hasOwnProperty(g)) {
            result[g] = {};
            for (let gg in trigrams[g]) {
                if (trigrams[g].hasOwnProperty(gg)) {
                    result[g][gg] = {};
                    for (let ggg in trigrams[g][gg]) {
                        result[g][gg][ggg] = trigrams[g][gg][ggg] / tri_total;
                    }
                }
            }
        }
    }
    for (let base in result) {
        if (result.hasOwnProperty(base)) {
            for (let g in bigrams) {
                if (bigrams.hasOwnProperty(g)) {
                    let entry;
                    if (result[base].hasOwnProperty(g)) {
                        entry = result[base][g];
                    } else {
                        entry = {};
                        result[base][g] = entry;
                    }
                    for (var gg in bigrams[g]) {
                        if (bigrams[g].hasOwnProperty(gg)) {
                            if (entry.hasOwnProperty(gg)) {
                                entry[gg] += bigrams[g][gg] / bi_total;
                            } else {
                                entry[gg] = bigrams[g][gg] / bi_total;
                            }
                        }
                    }
                }
            }
        }
    }
    return result;
}

/**
 * Combines the base glyph counts for the given domains into a single joint
 * distribution table.
 *
 * @param domains An array of domain name strings.
 *
 * @return A one-layer glyph weights object which merges information from
 *     the base glyph counts of each of the individual domains given.
 */
export function combined_counts(domains) {
    var result = {};
    domains.forEach(function (d) {
        var dom = dict.lookup_domain(d);
        result = merge_glyph_counts(result, dom.glyph_counts);
    });
    return result;
}

/**
 * As above, but works on bigram counts and/or pair counts (mixing the two
 * if ordered/unordered domains are grouped together).
 *
 * @param domains An array of domain name strings.
 *
 * @return A two-layer glyph weights object indicating relative weights
 *     of different glyph pairs across all of the given domains.
 */
export function combined_bicounts(domains) {
    var result = {};
    domains.forEach(function (d) {
        var dom = dict.lookup_domain(d);
        if (dom.hasOwnProperty("bigram_counts")) {
            result = merge_glyph_bicounts(result, dom.bigram_counts);
        } else if (dom.hasOwnProperty("pair_counts")) {
            result = merge_glyph_bicounts(result, dom.pair_counts);
        }
    });
    return result;
}

/**
 * As above, for trigram counts. If unordered domains are included, their
 * pair counts are grafted onto every possible unary prefix.
 *
 * @param domains An array of domain name strings.
 *
 * @return A three-layer glyph weights object indicating relative weights
 *     of different glyph triples across all of the given domains.
 *     Awkward and probably bad if one or more of the domains involved
 *     lacks trigram information (usually because it's unordered).
 *     TODO: better at that.
 */
export function combined_tricounts(domains) {
    var result = {};
    let last = [];
    domains.forEach(function (d) {
        var dom = dict.lookup_domain(d);
        if (dom.hasOwnProperty("trigram_counts")) {
            result = merge_glyph_tricounts(result, dom.trigram_counts);
        } else {
            last.push(dom);
        }
        result = merge_glyph_tricounts(result, dom.trigram_counts);
    });
    // Merge trigram-deficient domains last to ensure they are grafted onto
    // every possible unitary prefix.
    last.forEach(function (dom) {
        if (dom.hasOwnProperty("pair_counts")) {
            result = merge_bigrams_into_trigrams(result, dom.pair_counts);
        } else if (dom.hasOwnProperty("bigram_counts")) {
            result = merge_bigrams_into_trigrams(result, dom.bigram_counts);
        }
    });
    return result;
}

/**
 * Generates a test supertile, using the given position and seed.
 *
 * @param dimension The dimension object for the supertile to live in.
 * @param sgp A 2-element x/y supergrid coordinate array.
 * @param seed An integer seed that determines the result.
 *
 * @return A supertile object with the same properties as a result from
 *     generate_full_supertile. The domains array and the words array are
 *     empty, and the dimension is undefined.
 */
export function generate_test_supertile(dimension, sgp, seed) {
    var r = seed;
    var result = {
        "pos": sgp.slice(),
        "world_seeed": seed,
        "dimension": dimension,
        "glyphs": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
        "colors": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
        "domains": [],
        "words": []
    };

    for (var i = 0; i < grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE; ++i) {
        result.glyphs[i] = undefined;
        result.colors[i] = [];
        result.domains[i] = dimensions.natural_domain(dimension);
    }

    // Pick a word for each socket and embed it (or the relevant part of it).
    for (let socket = 0; socket < grid.COMBINED_SOCKETS; socket += 1) {
        let sgap = grid.canonical_sgapos([sgp[0], sgp[1], socket]);
        let canonical_socket = sgap[2];
        let ugp = grid.sgp__ugp(sgap); // socket index is ignored

        let l_seed = sghash(seed, sgap);
        let r = anarchy.prng(canonical_socket, l_seed);

        let glyphs = [
            ["A", "B", "C", "D", "E", "F", "G", "H"],
            ["I", "J", "K", "L", "M", "N", "O", "P"],
            ["Q", "R", "S", "T", "U", "V", "W", "X"],
            ["Y", "Z", "a", "b", "c", "d", "e", "f"],
            ["g", "h", "i", "j", "k", "l", "m", "n"],
            ["o", "p", "q", "r", "s", "t", "u", "v"],
            ["w", "x", "y", "z", "α", "β", "ξ", "δ"],
            ["ε", "φ", "γ", "θ", "ι", "ϊ", "κ", "λ"],
            ["μ", "ν", "ο", "π", "ψ", "ρ", "σ", "τ"],
            ["υ", "ϋ", "ω", "χ", "η", "ζ", "0", "1"],
        ][canonical_socket];
        var tile_colors = [
            ["bl"],
            ["yl"],
            ["rd"],
            ["gn"],
            ["lb"],
            ["lg"],
            ["gr"],
        ][canonical_socket];

        // Note: long words are chopped for test tiles
        var maxlen = grid.SOCKET_SIZE;

        // pick embedding direction & portion to embed
        var flip = (r % 2) == 0;
        r = anarchy.lfsr(r);
        var half_max = Math.floor(maxlen / 2);
        var min_cut = glyphs.length - half_max;
        var max_cut = half_max;
        let cut;
        if (min_cut == max_cut) {
            cut = min_cut;
        } else if (min_cut > max_cut) {
            glyphs = glyphs.slice(0, maxlen);
            cut = half_max;
        } else {
            cut = anarchy.idist(r, min_cut, max_cut + 1);
        }
        r = anarchy.lfsr(r);
        if (flip ^ grid.is_canonical(socket)) { // take first half
            glyphs = glyphs.slice(0, cut);
            // and reverse ordering
            glyphs = glyphs.reverse();
        } else {
            glyphs = glyphs.slice(cut);
        }
        let touched = inlay_word(result, glyphs, socket, r);
        for (let i = 0; i < touched.length; ++i) {
            let idx = grid.igp__index(touched[i]);
            result.colors[idx] = tile_colors;
        }
    }
    r = anarchy.lfsr(r);

    // TODO: Fill in remaining spots or not?

    // done with test supertile
    return result;
}

/**
 * Computes the number of overlength slots per assignment region required
 * to comfortably support all overlength words in a domain. Assumes as a
 * baseline that overlength words should be 1/2 as common as their overall
 * prevalence per entry (frequency gets ignored).
 * Returns undefined if a required domain is not yet loaded.
 * TODO: Account for the frequency of overlength words!
 *
 * @param dom_or_combo A string naming a domain or combo.
 *
 * @return An integer indicating how many overlength slots we need per
 *     assignment region for the given domain or combo.
 */
export function overlength_per_assignment_region(dom_or_combo) {
    let domains;
    if ("" + dom_or_combo === dom_or_combo) {
        domains = dict.lookup_domains(domains_list(dom_or_combo));
    } else {
        domains = [ dom_or_combo ];
    }
    if (domains == undefined) {
        return undefined;
    }
    let total_overlength = 0;
    let total_entries = 0;
    for (let dom of domains) {
        total_overlength += dom.overlength.length;
        total_entries += dom.entries.length;
    }
    let ratio = total_overlength / total_entries;

    /* Algebra for desired overlength sockets:
       ratio = (
           (grid.ULTRATILE_SOCKETS - x*2*grid.ASSIGNMENT_SOCKETS)
         / grid.ULTRATILE_SOCKETS
       );
       --------------------------------------------------------
       ratio = US / (US - x*2*AS/US)
       --------------------------------------------------------
       ratio - 1 = -2xAS/US
       --------------------------------------------------------
       US*(ratio-1)/(2AS) = -x
       --------------------------------------------------------
       x = US*(1-ratio)/(2AS)
       --------------------------------------------------------
       */
    let overlength_per_ar = Math.ceil(
        (
            grid.ULTRATILE_SOCKETS
          * (1 - ratio)
          / (2 * grid.ASSIGNMENT_SOCKETS)
        )
      * grid.ASSIGNMENT_REGION_SIDE * grid.ASSIGNMENT_REGION_SIDE
    );

    // Correct frequency:
    overlength_per_ar = Math.ceil(0.5 * overlength_per_ar);

    return Math.max(overlength_per_ar, total_overlength);
}

/**
 * Returns the ratio of superlong words to all entries in a domain. We
 * hope that it's 0.
 *
 * TODO: Something with/about superlong words (stuff into pocket
 * dimensions?)
 *
 * @param domain A domain object.
 */
export function superlong_ratio(domain) {
    return domain.superlong.length / domain.entries.length;
}
