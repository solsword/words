// content.js
// Manages grid + generate code to create, store, and deliver content.

define(["./grid", "./generate"], function(grid, generate) {
  // An object to hold generated supertile info.
  var SUPERTILES = {};
  var QUEUED = {};

  // How many supertiles to cache at once. Needs to be large enough to fill the
  // screen at least.
  var SUPERTILE_CACHE_SIZE = grid.ULTRAGRID_SIZE * grid.ULTRAGRID_SIZE * 2;

  // The map and list of currently-unlocked tiles:
  var UNLOCKED = [];

  // How many tiles can be unlocked at once.
  var UNLOCK_LIMIT = 30;

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
    //   pos: the grid-position of this tile.
    //   spos: the supergrid-position of this tile.
    //   colors: a list of up to 6 draw.PALETTE codes for this tile.
    //   glyph: the glyph on this title.
    //   domain: the domain for this tile.
    //
    // If the appropriate supergrid tile is not yet loaded, it will be
    // generated. While generation is ongoing, this function will return an
    // "unknown tile" object with the 'unlocked' property set to 'undefined'
    // instead of 'true' or 'false', and empty colors list, and an undefined
    // 'glyph' property.

    var sgp = grid.sgpos(gp);
    var st = fetch_supertile(dimension, gp);
    if (st == null) {
      return {
        "pos": gp.slice(),
        "spos": [sgp[0], sgp[1]],
        "colors": [],
        "is_inclusion": false,
        "domain": undefined,
        "glyph": undefined
      };
    }
    var result = grid.extract_subtile(st, [sgp[2], sgp[3]]);
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
    return "" + dimension + ":" + sgp[0] + "," + sgp[1];
  }

  function eventually_generate_supertile(dimension, sgp, accumulated) {
    var sgk = supertile_key(dimension, sgp);
    if (accumulated > GEN_GIVEUP) {
      delete QUEUED[sgk]; // allow re-queue
      return;
    }
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

  function is_unlocked(gp) {
    // Checks whether the given grid position is unlocked or not.
    for (var i = 0; i < UNLOCKED.length; ++i) {
      if (UNLOCKED[i][0] == gp[0] && UNLOCKED[i][1] == gp[1]) {
        return true;
      }
    }
    return false;
  }

  function unlock_tile(gp) {
    // Unlocks the given grid position. Depending on UNLOCK_LIMIT, may lock the
    // oldest unlocked position.
    for (var i = 0; i < UNLOCKED.length; ++i) {
      if (UNLOCKED[i][0] == gp[0] && UNLOCKED[i][1] == gp[1]) {
        break;
      }
    }
    if (i < UNLOCKED.length) {
      UNLOCKED.splice(i, 1);
    }
    UNLOCKED.push([gp[0], gp[1]]);
    if (UNLOCKED.length > UNLOCK_LIMIT) {
      UNLOCKED.shift();
    }
  }

  function list_tiles(dimension, edges) {
    // Lists all tiles that overlap with a given world-coordinate box. Returns
    // an array of tile objects (see content.tile_at). The input edges array
    // should be ordered left, top, right, bottom and should be expressed in
    // world coordinates. Missing tiles may be included in the list.

    // Compute grid coordinates:
    tl = grid.grid_pos([ edges[0], edges[1] ])
    br = grid.grid_pos([ edges[2], edges[3] ])

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
    "set_seed": set_seed,
    "tile_at": tile_at,
    "fetch_supertile": fetch_supertile,
    "is_unlocked": is_unlocked,
    "unlock_tile": unlock_tile,
    "list_tiles": list_tiles
  };
});
