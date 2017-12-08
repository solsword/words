// content.js
// Manages grid + generate code to create, store, and deliver content.

define(["./grid", "./generate"], function(grid, generate) {
  // An object to hold generated supertile info.
  var SUPERTILES = {};

  // Current global seed
  var SEED = 173;
  
  function set_seed(seed) {
    // Sets the global generation seed
    SEED = seed;
  }

  function tile_at(gp) {
    // Returns a tile object for the given location. A tile object has the
    // following attributes:
    //
    //   pos: the grid-position of this tile.
    //   spos: the supergrid-position of this tile.
    //   colors: a list of up to 6 draw.PALETTE codes for this tile.
    //   glyph: the glyph on this title.
    //   unlocked: true or false whether this tile is unlocked.
    //
    // If the appropriate supergrid tile is not yet loaded, it will be
    // generated.

    var sgp = grid.sgpos(gp);
    var st = fetch_supertile(gp);
    var result = grid.extract_subtile(st, [sgp[2], sgp[3]]);
    result["pos"] = gp.slice();
    result["spos"] = [sgp[0], sgp[1]];
    return result;
  }

  function fetch_supertile(gp) {
    // Takes a grid pos and returns the corresponding supertile.
    var sgp = grid.sgpos(gp);
    sgk = "" + sgp[0] + "," + sgp[1];
    if (SUPERTILES.hasOwnProperty(sgk)) {
      st = SUPERTILES[sgk];
    } else {
      st = generate.generate_supertile(SEED, [sgp[0], sgp[1]]);
      SUPERTILES[sgk] = st;
      // TODO: Permanent storage?
    }
    return st;
  }

  function is_unlocked(gp) {
    // Checks whether the given grid position is unlocked or not
    var st = fetch_supertile(gp);
    var sgp = grid.sgpos(gp);
    var ord = sgp[2] + sgp[3]*7;
    if (ord >= 32) {
      ord -= 32;
      return (1 << ord) & st["unlocked"][1];
    } else {
      return (1 << ord) & st["unlocked"][0];
    }
  }

  function unlock_tile(gp) {
    // Unlocks the given grid position
    var st = fetch_supertile(gp);
    var sgp = grid.sgpos(gp);
    var ord = sgp[2] + sgp[3]*7;
    if (ord >= 32) {
      ord -= 32;
      st["unlocked"][1] |= (1 << ord);
    } else {
      st["unlocked"][0] |= (1 << ord);
    }
  }

  function list_tiles(edges) {
    // Lists all tiles that overlap with a given world-coordinate box. Returns
    // an array of tile objects (see content.tile_at). The input edges array
    // should be ordered left, top, right, bottom and should be expressed in
    // world coordinates.

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
        result.push(tile_at([x, y]));
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
