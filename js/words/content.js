// content.js
// Manages grid + generate code to create, store, and deliver content.
/* global window, console */

"use strict";

import * as utils from "./utils.js";
import * as grid from "./grid.js";
import * as generate from "./generate.js";
import * as dimensions from "./dimensions.js";
import * as active from "./active.js";

/**
 * An object to hold generated supertile info.
 */
var SUPERTILES = {};
var QUEUED = {};

/**
 * How many supertiles to cache at once. Needs to be large enough to fill
 * the screen at least.
 */
export var SUPERTILE_CACHE_SIZE = (
    grid.ULTRAGRID_SIZE * grid.ULTRAGRID_SIZE * 2
);

/**
 * The list of currently-unlocked words:
 */
export var UNLOCKED = [];

/**
 * A Map from dimension keys to maps from coords__key'd grid positions to
 * energies active at that position due to energized swipes.
 */
export var ENERGY_MAP = {};

/**
 * Array containing all of the current single-tile pokes:
 */
export var POKES = [];

/**
 * The list of currently energized tiles and the limit for that list:
 */
export var ENERGIZED = [];
export var ENERGIZE_LIMIT = 1;

/**
 * Current global seed
 */
var SEED = 173;

/**
 * How long to wait before re-attempting supertile generation
 * (milliseconds):
 */
export var GEN_BACKOFF = 200;

/**
 * How long since the most-recent request for a tile before we
 * give up on generating it (maybe it's off-window by now?)
 */
export var GEN_GIVEUP = 1000;

/**
 * Sets the global generation seed
 *
 * @param seed An integer seed value.
 */
export function set_seed(seed) {
    SEED = seed;
}

/**
 * Returns a tile object for the given location. A tile object has
 * the following attributes:
 *
 *   dimension: the dimension this tile is found in.
 *   pos: the grid-position of this tile.
 *   spos: the supergrid-position of this tile.
 *   colors: a list of up to 6 draw.PALETTE codes for this tile.
 *   glyph: the glyph on this title.
 *   domain: the domain for this tile.
 *
 * If the appropriate supergrid tile is not yet loaded, it will be
 * generated. While generation is ongoing, this function will return
 * an "unknown tile" object with the 'domain' property set to
 * 'undefined' instead of a real domain, an empty colors list, and an
 * undefined 'glyph' property.
 *
 * @param dimension The dimension object corresponding to the dimension
 *     to retrieve a tile from.
 * @param gp The grid position (see grid.js) at which to retrieve a tile.
 *
 * @return The tile object (see above) at the requested grid position in
 *     the target dimension, or a blank tile object if that tile isn't
 *     available yet.
 */
export function tile_at(dimension, gp) {
    var sgp = grid.gp__sgp(gp);
    var st = fetch_supertile(dimension, gp);
    if (st == null) {
        return {
            "dimension": dimension,
            "pos": gp.slice(),
            "spos": [sgp[0], sgp[1]],
            "colors": [],
            "is_inclusion": false,
            "domain": undefined,
            "shape": [0, 0, 0, 0],
            "glyph": undefined
        };
    }
    var result = grid.extract_subtile(st, [sgp[2], sgp[3]]);
    result["dimension"] = dimension;
    result["pos"] = gp.slice();
    result["spos"] = [sgp[0], sgp[1]];
    return result;
}

/**
 * Stores a generated supertile st into the supertile cache under the
 * given supertile key.
 *
 * @param key A supertile key (see supertile_key).
 * @param st A supertile object.
 */
export function cache_supertile(key, st) {
    var oldest = undefined;
    var old_age = undefined;
    var count = 0;
    for (var k of Object.keys(SUPERTILES)) {
        var entry = SUPERTILES[k];
        entry[1] += 1;
        count += 1;
        if (old_age == undefined || entry[1] >= old_age) {
            old_age = entry[1];
            oldest = k;
        }
    }
    if (count > SUPERTILE_CACHE_SIZE && oldest != undefined) {
        delete SUPERTILES[oldest];
    }
    if (QUEUED.hasOwnProperty(key)) {
        delete QUEUED[key];
    }
    SUPERTILES[key] = [st, 0];
}


/**
 * Computes the string key for a particular supertile.
 *
 * @param dimension The dimension that the supertile belongs to.
 * @param sgp The super-grid position (see grid.js) of the supertile.
 *
 * @return A string key uniquely identifying the specified supertile.
 */
export function supertile_key(dimension, sgp) {
    return (
        dimensions.dim__key(dimension) + ":" + sgp[0] + "," + sgp[1]
    );
}

/**
 * Kicks off the process of supertile generation, and immediately returns
 * nothing. The requested supertile will eventually be generated, unless
 * generation takes longer than GEN_GIVEUP, in which case the request
 * will automatically be cancelled.
 *
 * @param dimension The dimension in which to generate a supertile.
 * @param sgp The super-grid position (see grid.js) of the supertile to
 *     generate.
 * @param accumulated (optional) Leave this blank; it will be used during
 *     setTimeout reentry to measure time elapsed during the request.
 */
export function eventually_generate_supertile(dimension, sgp, accumulated) {
    let sgk = supertile_key(dimension, sgp);
    if (accumulated > GEN_GIVEUP) {
        delete QUEUED[sgk]; // allow re-queue
        return;
    }
    let st;
    try {
        st = generate.generate_supertile(
            dimension,
            [sgp[0], sgp[1]],
            SEED
        );
    } catch (e) {
        console.warn(
            "Failed to generate supertile in dimension '"
          + dimensions.natural_domain(dimension).name
          + "#" + dimensions.seed(dimension)
          + "(" + dimensions.kind(dimension) + ")'"
          + " at [" + sgp[0] + ", " + sgp[1] + "]"
        );
        console.error(e);
        console.warn(sgk, QUEUED);
        return;
        // In this case the request is not tried again, but we don't
        // clear the queue...
    }
    if (st != undefined) {
        if (st.dimension == undefined) {
            console.warn("Bad supertile:", st);
            throw "Internal Error: Supertile dimension is undefined.";
        }
        // This will clear the queue entry...
        cache_supertile(sgk, st);
    } else {
        QUEUED[sgk] = window.setTimeout(
            eventually_generate_supertile,
            GEN_BACKOFF,
            dimension,
            sgp,
            accumulated + GEN_BACKOFF
        );
    }
}

/**
 * Looks up a supertile, returning null and requesting generation of that
 * supertile if it isn't available.
 *
 * @param dimension The dimension to look in.
 * @param gp A grid position (see grid.js).
 *
 * @return Whichever supertile contains the given grid position, or null
 *     if that supertile has not yet been generated.
 */
export function fetch_supertile(dimension, gp) {
    var sgp = grid.gp__sgp(gp);
    var sgk = supertile_key(dimension, sgp);
    if (SUPERTILES.hasOwnProperty(sgk)) {
        return SUPERTILES[sgk][0];
    } else {
        if (!QUEUED.hasOwnProperty(sgk)) {
            // async generate:
            QUEUED[sgk] = window.setTimeout(
                eventually_generate_supertile,
                0,
                dimension,
                sgp,
                0
            );
        }
        return null; 
    }
}

/**
 * Retrieves the set (as an object mapping keys to true) of unlocked
 * positions in a given dimension.
 *
 * @param dimkey The string key for the dimension to inspect.
 *
 * @return A mapping from coordinate keys for unlocked positions in the
 *     given dimension to true. Will contain 'undefined' as a key when
 *     there is an unlocked path which uses an extradimensional glyph.
 */
export function unlocked_set(dimkey) {
    let result = {};
    for (let i = 0; i < UNLOCKED.length; ++i) {
        let entry = UNLOCKED[i];
        if (entry.dimension == dimkey) {
            let path = entry.path;
            for (let j = 0; j < path.length; ++j) {
                result[grid.coords__key(path[j])] = true;
            }
        }
    }
    for (let i = 0; i < POKES.length; ++i) {
        let entry = POKES[i];
        if (entry.dimension == dimkey) {
            result[grid.coords__key(entry.pos)] = true;
        }
    }
    return result;
}

/**
 * Returns an array representing each unlocked path in the given
 * dimension (not counting pokes). Note that some paths may contain
 * 'undefined' entries where extradimensional glyphs were used.
 *
 * @param dimkey The string key for the dimension to look for paths in.
 *
 * @return An array of unlocked entries (see add_unlocked).
 */
export function unlocked_entries(dimkey) {
    let result = [];
    for (let entry of UNLOCKED) {
        if (entry.dimension == dimkey) {
            result.push(entry);
        }
    }
    return result;
}

/**
 * Checks whether the given grid position is unlocked or not.
 * TODO: This could be more efficient if multiple tiles were
 * given at once.
 *
 * @param dimkey The string key of the dimension to check in.
 * @param gp The grid position (see grid.js) to inspect.
 *
 * @return True if the given position is unlocked in the given dimension;
 *     false otherwise.
 */
export function is_unlocked(dimkey, gp) {
    for (let i = 0; i < UNLOCKED.length; ++i) {
        let entry = UNLOCKED[i];
        if (entry.dimension == dimkey) {
            var path = entry.path;
            for (let j = 0; j < path.length; ++j) {
                let pos = path[j];
                if (pos[0] == gp[0] && pos[1] == gp[1]) {
                    return true;
                }
            }
        }
    }
    for (let i = 0; i < POKES.length; ++i) {
        let entry = POKES[i];
        if (entry.dimension == dimkey) {
            let pos = entry.pos;
            if (pos[0] == gp[0] && pos[1] == gp[1]) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Finds all unlocked list entries which overlap any of a set of grid
 * positions in the given dimension.
 *
 * @param dimkey The string key for the dimension to look in.
 * @param gpmap An object that maps coords__key'd grid positions to any
 *     kind of value.
 *
 * @return A list of each unlocked entry (see add_unlocked) that overlaps
 *     any of the grid positions in the given grid position map.
 */
export function unlocked_entries_that_overlap(dimkey, gpmap) {
    let result = [];
    for (let i = 0; i < UNLOCKED.length; ++i) {
        let entry = UNLOCKED[i];
        if (entry.dimension == dimkey) {
            let path = entry.path;
            for (let j = 0; j < path.length; ++j) {
                let pos = path[j];
                let key = grid.coords__key(pos);
                if (gpmap.hasOwnProperty(key)) {
                    result.push(entry);
                    break;
                }
            }
        }
    }
    return result;
}

/**
 * Finds the full unlocked entry which corresponds to the given path in
 * the given dimension, if it exists.
 *
 * @param dimkey The dimension of the entry to search for, as a string
 *     key (see dimensions.dim__key).
 * @param path The path of grid positions (an array of 2-element x/y
 *     grid coordinate arrays) to look for.
 *
 * @return The unique unlocked-list entry that covers exactly the given
 *     path in the given dimension, or undefined if there is no such
 *     entry.
 */
export function find_unlocked(dimkey, path) {
    for (var i = 0; i < UNLOCKED.length; ++i) {
        if (
            utils.equivalent(
                [UNLOCKED[i].dimension, UNLOCKED[i].path],
                [dimkey, path]
            )
        ) {
            return UNLOCKED[i];
        }
    }
    return undefined;
}

/**
 * Unlocks the given path of grid positions in the given dimension.
 * Depending on the player's unlock limit, may lock the oldest unlocked
 * path. This does not updates energies for unlocked paths or their
 * adjacent active elements, although that will usually be necessary
 * afterwards.
 *
 * TODO: respect free mode and don't expire unlocks in that mode?
 *
 * @param agent The player doing the unlocking.
 * @param dimkey The dimension to work in, as a string key (see
 *     dimensions.dim__key).
 * @param path An array of grid positions (see grid.js) corresponding to
 *     the path that should be unlocked.
 */
export function unlock_path(agent, dimkey, path) {
    var entry = {
        "dimension": dimkey,
        "path": path.slice(),
        "players": [ agent.id ],
        "sources": {},
        "energies": {},
        "active_elements": {},
        "adjacent": [],
    };
    let duplicate = false;
    for (var i = 0; i < UNLOCKED.length; ++i) {
        if (
            utils.equivalent(
                [UNLOCKED[i].dimension, UNLOCKED[i].path],
                [entry.dimension, entry.path]
            )
        ) {
            duplicate = true;
            break;
        }
    }
    if (duplicate) {
        // recover same object and append it, without
        // bothering to do normal new-entry updates as they're
        // not needed:
        entry = UNLOCKED.splice(i, 1)[0];
        // If *this* player wasn't a supporter of that entry yet, add
        // them, and have them remember that:
        if (entry.players.indexOf(agent.id) < 0) {
            entry.players.push(agent.id);
        }
        UNLOCKED.push(entry);
    } else {
        // Add our new entry and update everything:
        add_unlocked(entry);
    }
}

/**
 * Adds an entry to the unlocked list, updating adjacency lists and
 * computing energy sources for the new entry. Note: energies will need
 * to be recalculated after the new entry is added, and this function
 * doesn't do that.
 *
 * @param entry An unlocked-list entry. It must have the following keys:
 *      "dimension": The dimension this entry belongs to, as a string
 *          key (see dimensions.dim__key).
 *      "path": An array of grid positions (see grid.js).
 *      "sources": An object whose keys are energy glyphs and whose
 *          values are 'true'. Should be empty (this function fills it in
 *          with the set of all energy elements which are part of or
 *          adjacent to the path being added).
 *      "energies": An object whose keys are energy glyphs and whose values
 *          are 'true'. May be empty; this function does not update it
 *          (see recalculate_unlocked_energies).
 *      "active_elements": An object whose keys are grid position keys
 *          (see grid.coords_key) and whose values are 'true'. Records
 *          the location of each active element tile that's within or
 *          adjacent to this unlocked entry. Should be empty; will be
 *          filled in.
 *      "adjacent": An array that holds references to each unlocked entry
 *          which either overlaps or touches this one. Should be empty;
 *          will be filled in.
 */
function add_unlocked(entry) {
    // First, calculate the sources and create a gpmap for this entry:
    let gpmap = {};
    let full_dim = dimensions.key__dim(entry.dimension);
    for (let gp of entry.path) {
        let gpk = grid.coords__key(gp);
        gpmap[gpk] = true;
        let h_tile = tile_at(full_dim, gp);
        if (h_tile.domain == "__active__") {
            if (active.is_energy(h_tile.glyph)) {
                entry.sources[h_tile.glyph] = true;
            }
            entry.active_elements[gpk] = true;
        }
        for (let d = 0; d < grid.N_DIRECTIONS; ++d) {
            let nb = grid.neighbor(gp, d);
            let nbk = grid.coords__key(nb);
            gpmap[nbk] = true;
            let nb_tile = tile_at(full_dim, nb);
            if (nb_tile.domain == "__active__") {
                if (active.is_energy(nb_tile.glyph)) {
                    entry.sources[nb_tile.glyph] = true;
                }
                entry.active_elements[nbk] = true;
            }
        }
    }

    // Set up our adjacent list (contains actual object references):
    entry.adjacent = unlocked_entries_that_overlap(
        entry.dimension,
        gpmap
    );
    for (let adj of entry.adjacent) {
        adj.adjacent.push(entry);
    }

    // Add this entry after computing adjacent neighbors:
    UNLOCKED.push(entry);
}

/**
 * Recursively propagates the given specific energy within
 * the adjacency graph of the unlocked list. Updates both the
 * energy maps of each entry encountered, and the ENERGY_MAP
 * per-position information.
 *
 * @param entry An unlocked list entry to start from. See add_unlocked.
 * @param energy An energy glyph to propagate (see active.js).
 */
function propagate_energy(entry, energy) {
    if (entry.energies[energy]) {
        // base case: this energy has already been added here;
        // do no recurse.
        return;
    } else {
        // recursive case: add the energy and recurse to all
        // adjacent entries.
        entry.energies[energy] = true;

        // Get or create energy map for this dimension:
        if (!ENERGY_MAP.hasOwnProperty(entry.dimension)) {
            ENERGY_MAP[entry.dimension] = {};
        }
        let dmap = ENERGY_MAP[entry.dimension];

        // Iterate through path:
        for (let gpos of entry.path) {
            let gpk = grid.coords__key(gpos);

            // Fetch or create energy map:
            if (!dmap.hasOwnProperty(gpk)) {
                dmap[gpk] = {};
            }
            let emap = dmap[gpk];

            // Add this energy to the energy map for this position:
            emap[energy] = true;
        }

        // Recurse on adjacent swipes:
        for (let adj of entry.adjacent) {
            propagate_energy(adj, energy);
        }
    }
}

/**
 * Recomputes the unlocked energies of all entries; necessary when
 * entries are added or removed. Also recomputes the energy activations
 * of all active elements.
 */
export function recalculate_unlocked_energies() {
    // Remove old energy info for all dimensions:
    ENERGY_MAP = {};
    // Remove old energy info:
    for (let entry of UNLOCKED) {
        entry.energies = {};
    }

    // Propagate energy in unlocked regions:
    for (let entry of UNLOCKED) {
        for (let src of Object.keys(entry.sources)) {
            propagate_energy(entry, src);
        }
    }

    // Add energies to active elements:
    for (let entry of UNLOCKED) {
        if (!ENERGY_MAP.hasOwnProperty(entry.dimension)) {
            ENERGY_MAP[entry.dimension] = {};
        }
        let delems = ENERGY_MAP[entry.dimension];
        for (let gpk of Object.keys(entry.active_elements)) {
            if (!delems.hasOwnProperty(gpk)) {
                delems[gpk] = {};
            }
            for (let energy of Object.keys(entry.energies)) {
                delems[gpk][energy] = true;
            }
        }
    }
}

/**
 * When a particular agent can no longer maintain a certain unlock entry,
 * we can remove that entry from our unlocked list. But what if multiple
 * agents are using that entry? In that case, the entry remains unlocked.
 * This function handles that decision, and calls remove_unlocked only if
 * necessary.
 *
 * Note: This function does not call recalculate_unlocked_energies, which
 * is necessary in cases where it returns true.
 *
 * @param agent The player who can no longer maintain an entry.
 * @param entry The full entry object which is not longer supported by
 *     that player.
 *
 * @return True if the entry was removed, or false if it persists.
 */
export function expire_unlocked(agent, entry) {
    let index = entry.players.indexOf(agent.id);
    if (index < 0) {
        console.warn(
            (
                "Attempted to expire support for an unlocked entry which"
              + " wasn't supported by the given agent!"
            ),
            agent,
            entry
        );
        return;
    }
    entry.players.splice(index);
    if (entry.players.length == 0) {
        remove_unlocked(entry);
        return true;
    } else {
        return false;
    }
}

/**
 * Removes the given entry from the unlocked list and from all adjacency
 * lists within other entries of the unlocked list. Note: energies will
 * need to be propagated after removing the entry, and this function
 * doesn't do that. This function also doesn't reset the adjacent list of
 * the entry being removed.
 *
 * @param entry An unlocked list entry (see add_unlocked).
 */
export function remove_unlocked(entry) {
    for (let other of UNLOCKED) {
        let adj_idx = other.adjacent.indexOf(entry);
        if (adj_idx >= 0) {
            other.adjacent.splice(adj_idx, 1);
        }
    }
    let unlk_idx = UNLOCKED.indexOf(entry);
    UNLOCKED.splice(unlk_idx, 1);
}

/**
 * Returns an entry from the POKES list which has the given dimension
 * and position, if there is one, or undefined if there isn't one.
 *
 * @param dimkey The string key of the dimension of the poke to find.
 * @param gp A 2-element grid position x/y array specifying the position
 *     of the poke we're interested in.
 *
 * @return An entry from the POKES array, with "dimension", "pos", and
 *     "players" properties.
 */
function find_poke(dimkey, gp) {
    for (let poke of POKES) {
        if (
            utils.equivalent(
                [poke.dimension, poke.pos],
                [dimkey, gp]
            )
        ) {
            return poke;
        }
    }
    return undefined;
}

/**
 * Unlocks the given grid position in the given dimension. Depending on
 * the player's poke limit, may lock the oldest unlocked poke. This does
 * not recalculate unlocked energies, although that will usually be
 * necessary afterwards.
 *
 * @param agent The player unlocking the poke.
 * @param dimension The string key of the dimension to work in.
 * @param gp The grid position (see grid.js) to unlock.
 */
export function unlock_poke(agent, dimkey, gp) {
    var entry = {
        "dimension": dimkey,
        "pos": gp.slice(),
        "players": [ agent.id ]
    };
    let i; // we check this after the loop
    for (i = 0; i < POKES.length; ++i) {
        if (
            utils.equivalent(
                [POKES[i].dimension, POKES[i].pos],
                [entry.dimension, entry.pos]
            )
        ) {
            break;
        }
    }
    if (i < POKES.length) {
        entry = POKES.splice(i, 1);
    }

    POKES.push(entry);
}

/**
 * Expires the given player's support for the given entry in the POKES
 * array. If that was the last player supporting that poke, then we
 * remove the poke entirely.
 *
 * @param agent The player whose support we're withdrawing.
 * @param entry The entry in the POKES list to withdraw support from.
 *
 * @return True if the given entry was removed from the POKES list, or
 *     false if it remains (due to support from at least one other
 *     player).
 */
export function expire_poke(agent, entry) {
    let aidx = entry.players.indexOf(agent.id);
    if (aidx < 0) {
        console.warn(
            (
                "Attempted to expire support for a poke from a player who"
              + " wasn't supporting that poke."
            ),
            agent,
            entry
        );
        return;
    }
    entry.players.splice(aidx, 1);
    if (entry.players.length == 0) {
        let idx = POKES.indexOf(entry);
        POKES.splice(idx, 1);
        return true;
    } else {
        return false;
    }
}

/**
 * Removes all energized locations.
 */
export function reset_energy() {
    ENERGIZED = [];
}

/**
 * Checks whether the given grid position is energized or not. TODO: This
 * could be more efficient if multiple tiles were given at once.
 *
 * @param dimension The dimension to inspect.
 * @param gp The grid position (see grid.js) to check.
 *
 * @return True if the given position in the given dimension is currently
 *     energized, false otherwise.
 */
export function is_energized(dimension, gp) {
    for (let i = 0; i < ENERGIZED.length; ++i) {
        var entry = ENERGIZED[i];
        if (
            entry.dimension == dimension
            && entry.position[0] == gp[0]
            && entry.position[1] == gp[1]
        ) {
            return true;
        }
    }
    return false;
}

/**
 * Energizes the given tile, and removes the oldest previously energized
 * tile if the limit has been reached.
 *
 * @param dimension The dimension to work in.
 * @param gp The grid position (see grid.js) to energize.
 */
export function energize_tile(dimension, gp) {
    var entry = { "dimension": dimension, "position": gp.slice() };
    for (var i = 0; i < ENERGIZED.length; ++i) {
        if (utils.equivalent(ENERGIZED[i], entry)) {
            break;
        }
    }
    if (i < ENERGIZED.length) {
        ENERGIZED.splice(i, 1);
    }

    ENERGIZED.push(entry);

    if (ENERGIZED.length > ENERGIZE_LIMIT) {
        ENERGIZED.shift();
    }
}

/**
 * @return An array of all energized positions. Each entry is an object
 *     with 'dimension' and 'position' keys, where the dimension value is
 *     a dimension object and the position value is a grid position (see
 *     grid.js).
 */
export function energized_positions() {
    return ENERGIZED.slice();
}


/**
 * Returns an energy glyph indicating the combined active energy of the
 * tile at the given position.
 *
 * @param dimension The dimension to inspect.
 * @param gp The grid position (see grid.js) to check.
 *
 * @return An energy glyph (see active.js).
 */
export function active_energy(dimension, gpos) {
    let dk = dimensions.dim__key(dimension);
    let gpk = grid.coords__key(gpos);

    // No energy in this dimension
    if (!ENERGY_MAP.hasOwnProperty(dk)) {
        return active.combined_energy([]);
    }

    let dmap = ENERGY_MAP[dk];

    // No energy here
    if (!dmap.hasOwnProperty(gpk)) {
        return active.combined_energy([]);
    }

    return active.combined_energy(Object.keys(dmap[gpk]));
}


/**
 * Lists all tiles that overlap with a given world-coordinate box. Some
 * missing tiles may be included in the result.
 *
 * @param dimension The dimension to retrieve tiles from.
 * @param edges An array containing four grid-position coordinates for
 *     the left, top, right, and bottom edges of the box to list tiles
 *     within.
 *
 * @return An array of tile objects (see content.tile_at).
 */
export function list_tiles(dimension, edges) {
    // Compute grid coordinates:
    let tl = grid.grid_pos([ edges[0], edges[1] ]);
    let br = grid.grid_pos([ edges[2], edges[3] ]);

    // Compute centers of containing cells:
    let tlc = grid.world_pos(tl);
    let brc = grid.world_pos(br);

    // Test whether we need to expand the range:
    if (tlc[0] - edges[0] >= grid.GRID_EDGE/2) {
        // left edge is outside of hexagon central square...
        // expand left edge by one so we don't have missing triangles:
        tl[0] -= 1;
    }
    if (edges[2] - brc[0] >= grid.GRID_EDGE/2) {
        // right edge is outside of hexagon central square...
        // expand right edge by one so we don't have missing
        // triangles:
        br[0] += 1;
    }
    if (edges[1] >= tlc[1]) {
        // top edge is above midpoint...
        // expand top edge by one so we don't have missing
        // tetrahedra:
        tl[1] += 1;
    }
    if (edges[3] <= brc[1]) {
        // bottom edge is below midpoint...
        // expand top edge by one so we don't have missing
        // tetrahedra:
        br[1] -= 1;
    }

    var result = Array();

    // Now iterate squarely within br/tl:
    for (var x = tl[0]; x <= br[0]; ++x) {
        for (
            var y = br[1] - Math.floor((br[0] - x) / 2);
            y <= tl[1] + Math.floor((x - tl[0]) / 2);
            ++y
        ) {
            result.push(tile_at(dimension, [x, y]));
        }
    }

    return result;
}
