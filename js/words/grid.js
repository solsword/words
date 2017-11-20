// grid.js
// Hex grid code.

define(["./generate"], function(generate) {

  var GRID_SIZE = 40;

  var SEED = 173;

  var GRID_TOP = GRID_SIZE/2;
  var GRID_BOTTOM = -GRID_SIZE/2;
  var GRID_EDGE = 2 * (Math.tan(Math.PI/6) * GRID_SIZE/2)
  // Note: distance from center to extreme point is also GRID_EDGE
  
  // An object to hold supertile info.
  var SUPERTILES = {};

  // Clockwise starting from upper left vertex:
  var VERTICES = [
    [-GRID_EDGE/2, GRID_TOP],
    [GRID_EDGE/2, GRID_TOP],
    [GRID_EDGE, 0],
    [GRID_EDGE/2, GRID_BOTTOM],
    [-GRID_EDGE/2, GRID_BOTTOM],
    [-GRID_EDGE, 0],
  ];

  function set_seed(seed) {
    // Sets the grid's generation seed
    SEED = seed;
  }

  function world_pos(gp) {
    // Returns the world position corresponding to the given grid position.
    var x = GRID_SIZE * Math.cos(Math.PI/6) * gp[0];
    var y = GRID_SIZE * (gp[1] - Math.sin(Math.PI/6) * gp[0]);
    return [x, y];
  }

  function grid_pos(wp) {
    // Returns the grid position which includes the given world position.
    //
    // Picture (dotted lines indicate initial rectangular boxes; proportions
    // are slightly distorted due to character aspect ratio):
    //
    //
    //
    //
    //
    //                      GRID_EDGE    This part is actually 1/2 GRID_EDGE,
    //                          =        Not 1/3 as it seems here.
    //                      _________   /
    //                     *         * v
    //                                ___
    //                               *   *
    //
    //              *      +----+----+....
    //             |      /:          \  :
    //             |     / :           \ :
    //             |    /  :            \:
    // GRID_SIZE = |   +   :   0,1       +----+----+....
    //             |    \  :            /:          \  :
    //             |     \ :           / :           \ :
    //             |      \:          /  :            \:
    //              *      +----+----+....   1,1       +
    //                    /:          \  :            /:
    //                   / :           \ :           / :
    //                  /  :            \:          /  :
    //                 +   :   0,0       +----+----+....
    //                  \  :            /:          \  :
    //                   \ :           / :           \ :
    //                    \:          /  :            \:
    //                     +----+----+...:   1,0       +
    //                    /           \  :            /:
    //                   /             \ :           / :
    //                  /               \:          /  :
    //                 +                 +----+----+....
    //
    // First, compute origin-shifted and jittered square position:

    // Find square grid integers using shifted/jittered grid:
    var cellx = (wp[0] + GRID_EDGE/2);
    var col = Math.floor(cellx / (GRID_EDGE*1.5));

    var celly = (wp[1] + GRID_SIZE/(2 - is_odd(col)));
    // Note fancy denominator shifts grid squares in odd rows (see picture)
    var row = Math.floor(celly / GRID_SIZE)

    // We only need fractional exact positions now:
    cellx -= col;
    celly -= row;

    // Here we adjust for the x-axis skew relative to the y-axis (they're at
    // 60/120 degrees, not 90)
    row += Math.floor(col / 2) // integer division

    // Now check if we fell into an edge case:
    if (cellx > GRID_EDGE) {
      // far enough left to be an edge case:
      var from_right = GRID_SIZE*1.5 - cellx;
      var above_center = celly - GRID_SIZE/2;
      slope_from_corner = above_center / from_right;
      if (slope_from_corner > Math.tan(Math.PI/3)) {
        // The upper-right exception: x+1 and y+1
        col += 1;
        row += 1;
      } else if (slope_from_corner < -Math.tan(Math.PI/3)) {
        // The lower-right exception: x+1
        col += 1;
      }
    }

    return [col, row];
  }

  function sgpos(gp) {
    // Fetches a supergrid-position from a grid-position. Supergrid hexes are
    // each composed of 37 hexes surrounding a single center hex, forming a
    // hexagonal shape at right angles to the underlying grid. These
    // super-hexagons have rough edges, so they can't stack perfectly with one
    // another, but instead interlock at a 1/2 hex offset, which makes tiling a
    // bit complicated.
    //
    // Note that this returns 4 numbers: the column and row in supergrid terms,
    // plus the within-cell relative x and y.
    //
    // Superhexes are encoded as an array of 47 values, 12 of which are nulls,
    // which allows quick 2-dimensional indexing (see picture below).
    //
    // Picture (dots indicate coordinate system extent for middle super-hex):
    //
    //                                                      #
    //                                                  #       #
    //                                              #       #       #
    //                                          #       #       #       #
    //                                              #       #        #
    //                                          #       #       #       #
    //                                              #       #        #
    //                 ^                        #       #       #       #
    //                /      0,6 -> .               #       #        #
    //             y /                  .       #       #       #       #
    //              /               .       .       #       #       #
    //     <-------+------->            .       @       #       #
    //            /   x             .       @       @       #
    //           /                      @       @       @
    //          /            0,3 -> @       @       @       @ <- 6,6
    //         v                        @       @       @    
    //                              @       @       @       @
    //                                  @      3,3      @    
    //                              @       @       @       @
    //                                  @       @       @    
    //                       0,0 -> @       @       @       @
    //                                  @       @       @
    //                              &       @       @       .
    //                          &       &       @       .
    //                      &       &       &       .       .
    //                  &       &       &       &       .
    //                      &       &       &               .
    //                  &       &       &       & 
    //                      &       &       &               ^
    //                  &       &       &       &           |
    //                      &       &       &              6,0
    //                  &       &       &       &
    //                      &       &       &
    //                          &       &
    //                              &
    //
    //
    // Algebra for our unskew transform:
    //
    // Basis vectors of the space:
    //
    //  v1 = (7, 4)
    //  v2 = (3, 7)
    // 
    // Coordinate equations:
    //
    //  7 c1 + 3 c2 = x
    //  4 c1 + 7 c2 = y
    // 
    // Solved for c2:
    //
    //  c2 = 1/3 x - 7/3 c1
    //  c2 = 1/7 y - 4/7 c1
    // 
    // Using c2 = c2 and solving for c1:
    //
    //  1/3 x - 7/3 c1 = 1/7 y - 4/7 c1
    //  (7/3 - 4/7) c1 = 1/3 x - 1/7 y
    //  c1 = (1/3 x - 1/7 y) / (7/3 - 4/7)
    //
    // So we use:

    var x = gp[0];
    var y = gp[1];

    var skew_x = (x / 3 - y / 7) / (7/3 - 4/7);
    var skew_y = (x / 3) - skew_x * (7/3);

    skew_x = Math.round(skew_x);
    skew_y = Math.round(skew_y);

    var r_x = gp[0] - 7 * skew_x - 3 * skew_y;
    var r_y = gp[1] - 4 * skew_x - 7 * skew_y;

    if (r_y < -2) {
      skew_x -= 1;
      r_x = gp[0] - 7 * skew_x - 3 * skew_y;
      r_y = gp[1] - 4 * skew_x - 7 * skew_y;
    }

    if (r_x > 0 && r_y < -2 + r_x) {
      skew_x += 1;
      skew_y -= 1;
      r_x = gp[0] - 7 * skew_x - 3 * skew_y;
      r_y = gp[1] - 4 * skew_x - 7 * skew_y;
    }

    if (r_x > 3) {
      skew_x += 1;
      r_x = gp[0] - 7 * skew_x - 3 * skew_y;
      r_y = gp[1] - 4 * skew_x - 7 * skew_y;
    }

    r_y += 2;
    r_x += 3;

    return [ skew_x, skew_y, r_x, r_y ];
  }

  function supertile_interior() {
    // Fix up edge cases:
    if (rel_x < 3 && rel_y > 3 + rel_x) {
      // top-left corner: y+1 x-1
      skew_col -= 1;
      skew_row += 1;
      rel_x += 4;
      rel_y -= 3;
    } else if (rel_x > 3 && rel_y < rel_x - 3) {
      // bottom-right corner: y-1 x+1
      skew_col += 1;
      skew_row -= 1;
      rel_x -= 4;
      rel_y += 3;
    }
  }

  function tile_at(gp) {
    // Returns a tile object for the given location. A tile object has the
    // following attributes:
    //
    //   pos: the grid-position of this tile.
    //   spos: the supergrid-position of this tile.
    //   color: the color code (see draw.PALETTE) for this tile.
    //   glyph: the glyph on this title.
    //
    // If the appropriate supergrid tile is not yet loaded, it will be
    // generated.

    var sgp = sgpos(gp);
    sgk = "" + sgp[0] + "," + sgp[1];
    if (SUPERTILES.hasOwnProperty(sgk)) {
      st = SUPERTILES[sgk];
    } else {
      st = generate.generate_supertile(SEED, [sgp[0], sgp[1]]);
      SUPERTILES[sgk] = st;
    }
    var result = extract_subtile(st, [sgp[2], sgp[3]]);
    result["pos"] = gp.slice();
    result["spos"] = [sgp[0], sgp[1]];
    return result;
  }

  function extract_subtile(supertile, rxy) {
    // Extracts a subtile from a supertile according to relative coordinates.
    // Returns an incomplete tile object without position information. Note
    // that the relative coordinates should be in-bounds, like those returned
    // from sgpos.
    var result = {};
    result["glyph"] = supertile["glyphs"][rxy[0] + rxy[1]*7];
    result["color"] = supertile["color"];
    return result;
  }

  function list_tiles(edges) {
    // Lists all tiles that overlap with a given world-coordinate box. Returns
    // an array of tile objects (see tile_at). The input edges array should be
    // ordered left, top, right, bottom and should be expressed in world
    // coordinates.

    // Compute grid coordinates:
    tl = grid_pos([ edges[0], edges[1] ])
    br = grid_pos([ edges[2], edges[3] ])

    // Compute centers of containing cells:
    tlc = world_pos(tl);
    brc = world_pos(br);

    // Test whether we need to expand the range:
    if (tlc[0] - edges[0] > GRID_EDGE/2) {
      // left edge is outside of hexagon central square...
      // expand left edge by one so we don't have missing triangles:
      tl[0] -= 1;
    }
    if (edges[2] - brc[0] > GRID_EDGE/2) {
      // right edge is outside of hexagon central square...
      // expand right edge by one so we don't have missing triangles:
      br[0] += 1;
    }
    if ((is_odd(tl[0]) == 0) && edges[1] > tlc[1]) {
      // top edge is above midpoint and column is even...
      // expand top edge by one so we don't have missing tetrahedra:
      tl[1] += 1;
    }
    if ((is_odd(br[0]) == 0) && edges[3] < brc[1]) {
      // bottom edge is below midpoint and column is even...
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
    "GRID_SIZE": GRID_SIZE,
    "GRID_EDGE": GRID_EDGE,
    "VERTICES": VERTICES,
    "world_pos": world_pos,
    "grid_pos": grid_pos,
    "sgpos": sgpos,
    "set_seed": set_seed,
    "tile_at": tile_at,
    "list_tiles": list_tiles,
  };
});
