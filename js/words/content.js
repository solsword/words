// content.js
// Manages grid + generate code to create, store, and deliver content.

define(
    ["./utils", "./grid", "./generate", "./dimensions", "./objects"],
    function(utils, grid, generate, dimensions, objects) {
        // An object to hold generated supertile info.
        var SUPERTILES = {};
        var QUEUED = {};
 
        // How many supertiles to cache at once. Needs to be large
        // enough to fill the screen at least.
        var SUPERTILE_CACHE_SIZE = (
            grid.ULTRAGRID_SIZE * grid.ULTRAGRID_SIZE * 2
        );
 
        // The list of currently-unlocked words, and the limit for
        // that list:
        var UNLOCKED = [];
        // TODO: Pick one
        //var UNLOCK_LIMIT = 5;
        //var UNLOCK_LIMIT = 1;
        var UNLOCK_LIMIT = undefined;
 
        // A Map from dimension keys to maps from coords__key'd grid
        // positions to colors active at that position due to colored
        // swipes.
        var COLOR_MAP = {};
 
        // Same for single-tile pokes:
        var POKES = [];
        var POKE_LIMIT = 1;
 
        // He list of currently energized tiles and the limit for that
        // list:
        var ENERGIZED = [];
        var ENERGIZE_LIMIT = 1;
 
        // Current global seed
        var SEED = 173;
 
        // How long to wait before re-attempting supertile generation
        // (milliseconds):
        var GEN_BACKOFF = 50;
 
        // How long since the most-recent request for a tile before we
        // give up on generating it (maybe it's off-window by now?)
        var GEN_GIVEUP = 1000;
 
        function set_seed(seed) {
            // Sets the global generation seed
            SEED = seed;
        }
 
        function tile_at(dimension, gp) {
            // Returns a tile object for the given location. A tile
            // object has the following attributes:
            //
            //   dimension: the dimension this tile is found in.
            //   pos: the grid-position of this tile.
            //   spos: the supergrid-position of this tile.
            //   colors: a list of up to 6 draw.PALETTE codes for this tile.
            //   glyph: the glyph on this title.
            //   domain: the domain for this tile.
            //
            // If the appropriate supergrid tile is not yet loaded, it
            // will be generated. While generation is ongoing, this
            // function will return an "unknown tile" object with the
            // 'domain' property set to 'undefined' instead of a real
            // domain, an empty colors list, and an undefined 'glyph'
            // property.
 
            var sgp = grid.sgpos(gp);
            var st = fetch_supertile(dimension, gp);
            if (st == null) {
                return {
                    "dimension": dimension,
                    "pos": gp.slice(),
                    "spos": [sgp[0], sgp[1]],
                    "colors": [],
                    "is_inclusion": false,
                    "domain": undefined,
                    "glyph": undefined
                };
            }
            var result = grid.extract_subtile(st, [sgp[2], sgp[3]]);
            result["dimension"] = dimension;
            result["pos"] = gp.slice();
            result["spos"] = [sgp[0], sgp[1]];
            return result;
        }
 
        function cache_supertile(key, st) {
            var oldest = undefined;
            var old_age = undefined;
            var count = 0;
            for (var k in SUPERTILES) {
                if (SUPERTILES.hasOwnProperty(k)) {
                    var entry = SUPERTILES[k];
                    entry[1] += 1;
                    count += 1;
                    if (old_age == undefined || entry[1] >= old_age) {
                        old_age = entry[1];
                        oldest = k;
                    }
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
 
        function supertile_key(dimension, sgp) {
            return (
                dimensions.dim__key(dimension) + ":" + sgp[0] + "," + sgp[1]
            );
        }
 
        function eventually_generate_supertile(dimension, sgp, accumulated) {
            var sgk = supertile_key(dimension, sgp);
            if (accumulated > GEN_GIVEUP) {
                delete QUEUED[sgk]; // allow re-queue
                return;
            }
            var st = generate.generate_supertile(
                dimension,
                [sgp[0], sgp[1]],
                SEED
            );
            if (st != undefined) {
                cache_supertile(sgk, st);
            } else {
                setTimeout(
                    eventually_generate_supertile,
                    GEN_BACKOFF,
                    dimension,
                    sgp
                );
            }
        }
 
        function fetch_supertile(dimension, gp) {
            // Takes a dimension and a grid pos and returns the corresponding
            // supertile, or null if that supertile isn't generated yet.
            var sgp = grid.sgpos(gp);
            var sgk = supertile_key(dimension, sgp);
            if (SUPERTILES.hasOwnProperty(sgk)) {
                return SUPERTILES[sgk][0];
            } else {
                if (!QUEUED[sgk]) {
                    // async generate:
                    QUEUED[sgk] = true;
                    setTimeout(
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
 
        function unlocked_set(dimension) {
            // Returns a mapping from unlocked positions in the given
            // dimension to true. 'undefined' will be among the keys
            // returned when an unlocked path uses an extradimensional
            // glyph.
            let result = {};
            for (let i = 0; i < UNLOCKED.length; ++i) {
                let entry = UNLOCKED[i];
                if (dimensions.same(entry.dimension, dimension)) {
                    let path = entry.path;
                    for (let j = 0; j < path.length; ++j) {
                        result[grid.coords__key(path[j])] = true;
                    }
                }
            }
            for (let i = 0; i < POKES.length; ++i) {
                let entry = POKES[i];
                if (dimensions.same(entry.dimension, dimension)) {
                    result[grid.coords__key(entry.pos)] = true;
                }
            }
            return result;
        }
 
        function unlocked_entries(dimension) {
            // Returns an array of unlocked entries representing each
            // unlocked path in the given dimension (not counting
            // pokes). Note that some paths may contain 'undefined'
            // entries where extradimensional glyphs were used.
            let result = [];
            for (let entry of UNLOCKED) {
                if (dimensions.same(entry.dimension, dimension)) {
                    result.push(entry);
                }
            }
            return result;
        }
 
        function is_unlocked(dimension, gp) {
            // Checks whether the given grid position is unlocked or not.
            // TODO: This could be more efficient if multiple tiles were
            // given at once.
            for (let i = 0; i < UNLOCKED.length; ++i) {
                var entry = UNLOCKED[i];
                if (dimensions.same(entry.dimension, dimension)) {
                    var path = entry.path;
                    for (let j = 0; j < path.length; ++j) {
                        var pos = path[j];
                        if (pos[0] == gp[0] && pos[1] == gp[1]) {
                            return true;
                        }
                    }
                }
            }
            for (let i = 0; i < POKES.length; ++i) {
                var entry = POKES[i];
                if (dimensions.same(entry.dimension, dimension)) {
                    var pos = entry.pos;
                    if (pos[0] == gp[0] && pos[1] == gp[1]) {
                        return true;
                    }
                }
            }
            return false;
        }
 
        function unlocked_entries_that_overlap(dimension, gpmap) {
            // Returns a list of each unlocked entry that overlaps any
            // of the grid positions in the given grid position map.
            // The map should map coords__key'd grid positions to any
            // kind of value.
            result = [];
            for (let i = 0; i < UNLOCKED.length; ++i) {
                let entry = UNLOCKED[i];
                if (dimensions.same(entry.dimension, dimension)) {
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
 
        function unlock_path(dimension, path) {
            // Unlocks the given path of grid positions in the given
            // dimension. Depending on UNLOCK_LIMIT, may lock the
            // oldest unlocked path. Also update colors for all
            // unlocked paths and their adjacent objects.
            var entry = {
                "dimension": dimension,
                "path": path.slice(),
                "sources": {},
                "colors": {},
                "objects": {},
                "adjacent": [],
            };
            let duplicate = false;
            for (var i = 0; i < UNLOCKED.length; ++i) {
                if (
                    utils.is_equal(
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
                UNLOCKED.push(entry);
            } else {
                // Add our new entry and update everything:
                add_unlocked(entry);
            }
 
            if (UNLOCKED.length > UNLOCK_LIMIT) {
                remove_unlocked(UNLOCKED[0]);
            }
 
            // Finally, recompute unlocked colors:
            recalculate_unlocked_colors();
        }
 
        function add_unlocked(entry) {
            // Adds an entry to the unlocked list, updating adjacency
            // lists and computing color sources for the new entry.
            // Note: colors will need to be recalculated after the new
            // entry is added, and this function doesn't do that.
 
            // First, calculate the sources and create a gpmap for
            // this entry:
            let gpmap = {};
            for (let gp of entry.path) {
                let gpk = grid.coords__key(gp);
                gpmap[gpk] = true;
                let h_tile = tile_at(entry.dimension, gp);
                if (h_tile.domain == "__object__") {
                    if (objects.is_color(h_tile.glyph)) {
                        entry.sources[h_tile.glyph] = true;
                    }
                    entry.objects[gpk] = true;
                }
                for (let d = 0; d < grid.N_DIRECTIONS; ++d) {
                    let nb = grid.neighbor(gp, d);
                    let nbk = grid.coords__key(nb);
                    gpmap[nbk] = true;
                    let nb_tile = tile_at(entry.dimension, nb);
                    if (nb_tile.domain == "__object__") {
                        if (objects.is_color(nb_tile.glyph)) {
                            entry.sources[nb_tile.glyph] = true;
                        }
                        entry.objects[nbk] = true;
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
 
        function propagate_color(entry, color) {
            // Recursively propagates the given specific color within
            // the adjacency graph of the unlocked list. Updates both the
            // color maps of each entry encountered, and the COLOR_MAP
            // per-position information.
            if (entry.colors[color]) {
                // base case: this color has already been added here;
                // do no recurse.
                return;
            } else {
                // recursive case: add the color and recurse to all
                // adjacent entries.
                entry.colors[color] = true;

                // Get or create color map for this dimension:
                let dk = dimensions.dim__key(entry.dimension);
                if (!COLOR_MAP.hasOwnProperty(dk)) {
                    COLOR_MAP[dk] = {};
                }
                let dmap = COLOR_MAP[dk];

                // Iterate through path:
                for (let gpos of entry.path) {
                    let gpk = grid.coords__key(gpos);

                    // Fetch or create color map:
                    if (!dmap.hasOwnProperty(gpk)) {
                        dmap[gpk] = {};
                    }
                    let cmap = dmap[gpk];

                    // Add this color to the color map for this position:
                    cmap[color] = true;
                }

                // Recurse on adjacent swipes:
                for (let adj of entry.adjacent) {
                    propagate_color(adj, color);
                }
            }
        }
 
        function recalculate_unlocked_colors() {
            // Recomputes the unlocked colors of all entries;
            // necessary when entries are added or removed. Also
            // recomputes the color activations of all objects.
 
            // Remove old colors info for all dimensions:
            COLOR_MAP = {};
            // Remove old color info:
            for (let entry of UNLOCKED) {
                entry.colors = {};
            }
 
            // Propagate colors in unlocked regions:
            for (let entry of UNLOCKED) {
                for (let src of Object.keys(entry.sources)) {
                    propagate_color(entry, src);
                }
            }
 
            // Add colors to objects:
            for (let entry of UNLOCKED) {
                let dk = dimensions.dim__key(entry.dimension);
                if (!COLOR_MAP.hasOwnProperty(dk)) {
                    COLOR_MAP[dk] = {};
                }
                let dobjs = COLOR_MAP[dk];
                for (let gpk of Object.keys(entry.objects)) {
                    if (!dobjs.hasOwnProperty(gpk)) {
                        dobjs[gpk] = {}
                    }
                    for (let color of Object.keys(entry.colors)) {
                        dobjs[gpk][color] = true;
                    }
                }
            }
        }
 
        function remove_unlocked(entry) {
            // Removes the given entry from the unlocked list and from
            // all adjacency lists within other entries of the
            // unlocked list. Note: colors will need to be propagated
            // after removing the entry, and this function doesn't do
            // that.
            for (let entry of UNLOCKED) {
                let adj_idx = entry.adjacent.indexOf(entry);
                if (adj_idx >= 0) {
                    entry.adjacent.splice(adj_idx, 1);
                }
            }
            let unlk_idx = UNLOCKED.indexOf(entry);
            UNLOCKED.splice(unlk_idx, 1);
        }
 
        function unlock_poke(dimension, gp) {
            // Unlocks the given grid position in the given dimension.
            // Depending on POKE_LIMIT, may lock the oldest unlocked
            // poke.
            var entry = { "dimension": dimension, "pos": gp.slice() };
            for (var i = 0; i < POKES.length; ++i) {
                if (utils.is_equal(POKES[i], entry)) {
                    break;
                }
            }
            if (i < POKES.length) {
                POKES.splice(i, 1);
            }
 
            POKES.push(entry);
 
            if (POKES.length > POKE_LIMIT) {
                POKES.shift();
            }
        }
 
        function reset_energy() {
            // Removes all energized locations.
            ENERGIZED = [];
        }
 
        function is_energized(dimension, gp) {
            // Checks whether the given grid position is energized or
            // not. TODO: This could be more efficient if multiple
            // tiles were given at once.
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
 
        function energize_tile(dimension, gp) {
            // Energizes the given tile, and removes the oldest
            // previously energized tile if the limit has been
            // reached.
            var entry = { "dimension": dimension, "position": gp.slice() };
            for (var i = 0; i < ENERGIZED.length; ++i) {
                if (utils.is_equal(ENERGIZED[i], entry)) {
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
 
        function energized_positions() {
            // Returns a list of all energized positions.
            return ENERGIZED.slice();
        }
 
 
        function active_color(dimension, gpos) {
            // Returns a color glyph indicating the combined active color
            // of the tile at the given position.
            let dk = dimensions.dim__key(dimension);
            let gpk = grid.coords__key(gpos);

            // No color in this dimension
            if (!COLOR_MAP.hasOwnProperty(dk)) {
                return objects.combined_color([]);
            }

            let dmap = COLOR_MAP[dk];

            // No color here
            if (!dmap.hasOwnProperty(gpk)) {
                return objects.combined_color([]);
            }

            return objects.combined_color(Object.keys(dmap[gpk]));
        }

 
        function list_tiles(dimension, edges) {
            // Lists all tiles that overlap with a given
            // world-coordinate box. Returns an array of tile objects
            // (see content.tile_at). The input edges array should be
            // ordered left, top, right, bottom and should be
            // expressed in world coordinates. Missing tiles may be
            // included in the list.
 
            // Compute grid coordinates:
            tl = grid.grid_pos([ edges[0], edges[1] ]);
            br = grid.grid_pos([ edges[2], edges[3] ]);
 
            // Compute centers of containing cells:
            tlc = grid.world_pos(tl);
            brc = grid.world_pos(br);
 
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
 
        return {
            "POKE_LIMIT": POKE_LIMIT,
            "set_seed": set_seed,
            "tile_at": tile_at,
            "fetch_supertile": fetch_supertile,
            "unlocked_set": unlocked_set,
            "unlocked_entries": unlocked_entries,
            "is_unlocked": is_unlocked,
            "unlock_path": unlock_path,
            "unlock_poke": unlock_poke,
            "reset_energy": reset_energy,
            "is_energized": is_energized,
            "energize_tile": energize_tile,
            "active_color": active_color,
            "energized_positions": energized_positions,
            "list_tiles": list_tiles
        };
    }
);
