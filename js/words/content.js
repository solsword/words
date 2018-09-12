// content.js
// Manages grid + generate code to create, store, and deliver content.

define(
  ["./utils", "./grid", "./generate", "./dimensions"],
  function(utils, grid, generate, dimensions) {
  // An object to hold generated supertile info.
  var SUPERTILES = {};
  var QUEUED = {};

  // How many supertiles to cache at once. Needs to be large enough to fill the
  // screen at least.
  var SUPERTILE_CACHE_SIZE = grid.ULTRAGRID_SIZE * grid.ULTRAGRID_SIZE * 2;

  // The list of currently-unlocked words, and the limit for that list:
  var UNLOCKED = [];
  // TODO: DEBUG
  //var UNLOCK_LIMIT = 5;
  //var UNLOCK_LIMIT = 1;
  var UNLOCK_LIMIT = undefined;

  // Same for single-tile pokes:
  var POKES = [];
  var POKE_LIMIT = 1;

  // He list of currently energized tiles and the limit for that list:
  var ENERGIZED = [];
  var ENERGIZE_LIMIT = 1;

  // Current global seed
  var SEED = 173;

  // How long to wait before re-attempting supertile generation (milliseconds):
  var GEN_BACKOFF = 50;

  // How long since the most-recent request for a tile before we give up on
  // generating it (maybe it's off-window by now?)
  var GEN_GIVEUP = 1000;
  
  function set_seed(seed) {
    // Sets the global generation seed
    SEED = seed;
  }

  function tile_at(dimension, gp) {
    // Returns a tile object for the given location. A tile object has the
    // following attributes:
    //
    //   dimension: the dimension this tile is found in.
    //   pos: the grid-position of this tile.
    //   spos: the supergrid-position of this tile.
    //   colors: a list of up to 6 draw.PALETTE codes for this tile.
    //   glyph: the glyph on this title.
    //   domain: the domain for this tile.
    //
    // If the appropriate supergrid tile is not yet loaded, it will be
    // generated. While generation is ongoing, this function will return an
    // "unknown tile" object with the 'domain' property set to 'undefined'
    // instead of a real domain, an empty colors list, and an undefined 'glyph'
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
    return dimensions.dim__key(dimension) + ":" + sgp[0] + "," + sgp[1];
  }

  function eventually_generate_supertile(dimension, sgp, accumulated) {
    var sgk = supertile_key(dimension, sgp);
    if (accumulated > GEN_GIVEUP) {
      delete QUEUED[sgk]; // allow re-queue
      return;
    }
    // TODO: DEBUG
    var st = generate.generate_supertile(dimension, [sgp[0], sgp[1]], SEED);
    if (st != undefined) {
      cache_supertile(sgk, st);
    } else {
      setTimeout(eventually_generate_supertile, GEN_BACKOFF, dimension, sgp);
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
        setTimeout(eventually_generate_supertile, 0, dimension, sgp, 0);
      }
      return null; 
    }
  }

  function unlocked_set(dimension) {
    // Returns a mapping from unlocked positions in the given dimension to
    // true. 'undefined' will be among the keys returned when an unlocked path
    // uses an extradimensional glyph.
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

  function unlocked_paths(dimension) {
    // Returns an array of position paths representing each unlocked path in
    // the given dimension (not counting pokes). Note that some paths may
    // contain 'undefined' entries where extradimensional glyphs were used.
    let result = [];
    for (let i = 0; i < UNLOCKED.length; ++i) {
      let entry = UNLOCKED[i];
      if (dimensions.same(entry.dimension, dimension)) {
        result.push(entry.path.slice());
      }
    }
    return result;
  }

  function is_unlocked(dimension, gp) {
    // Checks whether the given grid position is unlocked or not.
    // TODO: This could be more efficient if multiple tiles were given at once.
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

  function unlock_path(dimension, path) {
    // Unlocks the given path of grid positions in the given dimension.
    // Depending on UNLOCK_LIMIT, may lock the oldest unlocked path.
    var entry = { "dimension": dimension, "path": path.slice() };
    for (var i = 0; i < UNLOCKED.length; ++i) {
      if (utils.is_equal(UNLOCKED[i], entry)) {
        break;
      }
    }
    if (i < UNLOCKED.length) {
      UNLOCKED.splice(i, 1);
    }

    UNLOCKED.push(entry);

    if (UNLOCKED.length > UNLOCK_LIMIT) {
      UNLOCKED.shift();
    }
  }

  function unlock_poke(dimension, gp) {
    // Unlocks the given grid position in the given dimension. Depending on
    // POKE_LIMIT, may lock the oldest unlocked poke.
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
    // Checks whether the given grid position is energized or not.
    // TODO: This could be more efficient if multiple tiles were given at once.
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
    // Energizes the given tile, and removes the oldest previously energized
    // tile if the limit has been reached.
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


  function list_tiles(dimension, edges) {
    // Lists all tiles that overlap with a given world-coordinate box. Returns
    // an array of tile objects (see content.tile_at). The input edges array
    // should be ordered left, top, right, bottom and should be expressed in
    // world coordinates. Missing tiles may be included in the list.

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
      // expand right edge by one so we don't have missing triangles:
      br[0] += 1;
    }
    if (edges[1] >= tlc[1]) {
      // top edge is above midpoint...
      // expand top edge by one so we don't have missing tetrahedra:
      tl[1] += 1;
    }
    if (edges[3] <= brc[1]) {
      // bottom edge is below midpoint...
      // expand top edge by one so we don't have missing tetrahedra:
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
    "unlocked_paths": unlocked_paths,
    "is_unlocked": is_unlocked,
    "unlock_path": unlock_path,
    "unlock_poke": unlock_poke,
    "reset_energy": reset_energy,
    "is_energized": is_energized,
    "energize_tile": energize_tile,
    "energized_positions": energized_positions,
    "list_tiles": list_tiles
  };
});
