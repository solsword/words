// grid.js
// Hex grid code.

define(["./dimensions", "anarchy"], function(dimensions, anarchy) {
  // Whether to log warnings:
  var WARNINGS = true;

  // Grid size in pixels
  // TODO: Dynamic zoom!
  // var GRID_SIZE = 45;
  var GRID_SIZE = 65;

  // Size constants based on GRID_SIZE
  var GRID_TOP = GRID_SIZE/2;
  var GRID_BOTTOM = -GRID_SIZE/2;
  var GRID_EDGE = 2 * (Math.tan(Math.PI/6) * GRID_SIZE/2)
  // Note: distance from center to extreme point is also GRID_EDGE

  // Clockwise starting from upper left vertex:
  var VERTICES = [
    [-GRID_EDGE/2, GRID_TOP],
    [GRID_EDGE/2, GRID_TOP],
    [GRID_EDGE, 0],
    [GRID_EDGE/2, GRID_BOTTOM],
    [-GRID_EDGE/2, GRID_BOTTOM],
    [-GRID_EDGE, 0],
  ];

  // Clockwise starting from the neighbor directly above:
  var NEIGHBORS = [
    [0, 1],
    [1, 1],
    [1, 0],
    [0, -1],
    [-1, -1],
    [-1, 0]
  ]

  // Directions as indices into the NEIGHBORS array:
  var N_DIRECTIONS = 6;
  var N = 0;
  var NE = 1;
  var SE = 2;
  var S = 3;
  var SW = 4;
  var NW = 5;

  // Clockwise starting from the neighbor to the left:
  var SG_NEIGHBORS = [
    [-1, 0],
    [-1, 1],
    [0, 1],
    [1, 0],
    [1, -1],
    [0, -1]
  ]

  // Directions as indices into the SG_NEIGHBORS array:
  var SG_W = 0;
  var SG_NW = 1;
  var SG_NE = 2;
  var SG_E = 3;
  var SG_SE = 4;
  var SG_SW = 5;

  // Supertile size
  var SUPERTILE_SIZE = 7;
  var SUPERTILE_TILES = 37;

  function gp__index(gp) {
    // Converts a grid position to a supertile glyphs index. Does not check
    // whether the given position is valid (see is_valid_subindex below).
    return gp[0] + gp[1] * SUPERTILE_SIZE;
  }

  function index__gp(idx) {
    // Inverse of above.
    let y = Math.floor(idx / SUPERTILE_SIZE);
    let x = idx % SUPERTILE_SIZE;
    return [x, y];
  }

  // Hex index & linear index of the center of a supergrid tile:
  var SG_CENTER = [3, 3]; 
  var SG_CENTER_IDX = gp__index(SG_CENTER);

  // Number of canonical sockets per supergrid tile, and number of total
  // sockets including non-canonical shared sockets.
  var ASSIGNMENT_SOCKETS = 3;
  var COMBINED_SOCKETS = 6;

  // How big are ultragrid units?
  var ULTRAGRID_SIZE = 12;

  // Ultragrid size constants:
  var ULTRATILE_ROW_SOCKETS = ULTRAGRID_SIZE * ASSIGNMENT_SOCKETS;

  // Number of assignment sockets in an ultragrid tile:
  var ULTRATILE_SOCKETS = (
    ULTRAGRID_SIZE
  * ULTRAGRID_SIZE
  * ASSIGNMENT_SOCKETS
  );

  // Same, minus the edge supertiles
  var ULTRATILE_INTERIOR_SOCKETS = (
    (ULTRAGRID_SIZE - 2)
  * (ULTRAGRID_SIZE - 2)
  * ASSIGNMENT_SOCKETS
  );

  // Number of positions before the first non-edge position
  var ULTRATILE_PRE_INTERIOR = (ULTRAGRID_SIZE + 1) * ASSIGNMENT_SOCKETS;

  // Same as above but excluding a two-supertile border:
  var ULTRATILE_CORE_SOCKETS = (
    (ULTRAGRID_SIZE - 4)
  * (ULTRAGRID_SIZE - 4)
  * ASSIGNMENT_SOCKETS
  );

  // As ULTRATILE_PRE_INTERIOR but for core tiles (two-away from edges):
  var ULTRATILE_PRE_CORE = ((ULTRAGRID_SIZE * 2) + 2) * ASSIGNMENT_SOCKETS;

  // Size of assignment region is this squared; should be large enough to
  // accommodate even a relatively large corpus (vocabulary, not count).
  // The units are ultragrid tiles.
  var ASSIGNMENT_REGION_SIDE = 1024;

  // Total sockets in an assignment region.
  //   1024 * 1024 * 12 * 12 * 4 ~= 600,000,000
  var ASSIGNMENT_REGION_TOTAL_SOCKETS = (
    ASSIGNMENT_REGION_SIDE
  * ASSIGNMENT_REGION_SIDE
  * ULTRATILE_SOCKETS
  );

  function rotate(direction, amount) {
    // Rotates one of the direction constants (e.g., N; NE) by the given number
    // of steps clockwise.
    return (((direction + amount) % 6) + 6) % 6;
  }

  function rotate_path(path, amount) {
    // Rotates an entire path. Returns a new array without modifying the
    // original.
    var result = [];
    for (var i = 0; i < path.length; ++i) {
      result.push(rotate(path[i], amount));
    }
    return result;
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

    var celly = (wp[1] + GRID_SIZE/(2 - (col % 2 != 0)));
    // Note fancy denominator shifts grid squares in odd rows (see picture)
    var row = Math.floor(celly / GRID_SIZE)

    // We only need fractional exact positions now:
    cellx -= col * GRID_EDGE * 1.5;
    celly -= row * GRID_SIZE;

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

  function coords__key(gp) {
    // Converts a pair of grid coordinates into a string key.
    return "" + gp;
  }

  function key__coords(gk) {
    // Converts a string key into a pair of grid coordinates.
    if (gk == "undefined") { return undefined; }
    bits = gk.split(',');
    return bits.map(b => parseInt(b));
  }

  function z_coord(pos) {
    // Z coordinate on the regular grid.
    return pos[0] - pos[1];
  }

  function super_z(pos) {
    // Z coordinate on the super grid.
    return -pos[0] - pos[1];
  }

  function grid_distance(from, to) {
    // Returns distance between two grid positions. See:
    // http://keekerdc.com/2011/03/hexagon-grids-coordinate-systems-and-distance-calculations/
    // Note our formula for z is (-x + y + z = 0  ->  z = x - y) because our
    // axes are arranged differently.
    let dx = Math.abs(from[0] - to[0]);
    let dy = Math.abs(from[1] - to[1]);
    let dz = Math.abs(z_coord(from) - z_coord(to));
    return Math.max(dx, dy, dz);
  }

  function supergrid_distance(from, to) {
    // As above, but for the supergrid, which has different axes.
    let dx = Math.abs(from[0] - to[0]);
    let dy = Math.abs(from[1] - to[1]);
    let dz = Math.abs(super_z(from) - super_z(to));
    return Math.max(dx, dy, dz);
  }

  function is_neighbor(from, to) {
    // Returns true if the two positions given are neighbors, and false
    // otherwise (including if they are the same position).
    if (from == undefined || to == undefined) {
      return false;
    }
    return grid_distance(from, to) == 1;
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
    // Superhexes are encoded as an array of 49 values, 12 of which are nulls,
    // which allows quick 2-dimensional indexing (see picture below).
    //
    // Interior indexing is anchored at the southeast corner of each supergrid
    // tile, as shown below.
    //
    // Picture (dots indicate coordinate system extent for middle super-hex):
    //
    //                                                      #
    //                                                  #       #
    //                                              #       #       #
    //                                          #       #       #       #
    //                                              #       #        #
    //       Supergrid axes:                    #       #       #       #
    //                                              #       #        #
    //                 ^                        #       #       #       #
    //                / y    0,6 -> .               #       #        #
    //               /                  .       #       #       #       #
    //              /               .       .       #       #       #
    //     <-------+------->            .       @       #       #
    //            /      x          .       @       @       #
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

    // TODO: Replace magic numbers here!
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

  function gpos(sgp) {
    // The inverse of sgpos, takes a supergrid position including relative
    // interior position and returns the corresponding global position.

    // supertile offset vectors:
    var vx = [7, 4];
    var vy = [3, 7];

    var gx = sgp[0] * vx[0] + sgp[1] * vy[0] + sgp[2];
    var gy = sgp[0] * vx[1] + sgp[1] * vy[1] + sgp[3];

    return [gx, gy]; 
  }

  function ugpos(sgp) {
    // Extracts an ultra-grid position from a super-grid position. Just uses
    // modulus math. Returns x, y, sub_x, sub_y.
    return [
      Math.floor(sgp[0]/ULTRAGRID_SIZE),
      Math.floor(sgp[1]/ULTRAGRID_SIZE),
      ((sgp[0] % ULTRAGRID_SIZE) + ULTRAGRID_SIZE) % ULTRAGRID_SIZE,
      ((sgp[1] % ULTRAGRID_SIZE) + ULTRAGRID_SIZE) % ULTRAGRID_SIZE,
    ];
  }

  function sub_ultra(ugp, rsgp) {
    // Takes an ultragrid position along with a supergrid relative position and
    // returns an absolute supergrid position.
    return [
      ugp[0] * ULTRAGRID_SIZE + rsgp[0],
      ugp[1] * ULTRAGRID_SIZE + rsgp[1]
    ];
  }

  function extract_subtile(supertile, rxy) {
    // Extracts a subtile from a supertile according to relative coordinates.
    // Returns an incomplete tile object without position information. Note
    // that the relative coordinates should be in-bounds, like those returned
    // from sgpos.
    var result = {};
    var idx = gp__index(rxy);
    result["glyph"] = supertile.glyphs[idx];
    result["colors"] = supertile.colors[idx].slice();
    result["domain"] = supertile.domains[idx];
    result["shape"] = dimensions.shape_for(supertile.dimension);
    result["is_inclusion"] = (
      result["domain"] != dimensions.natural_domain(supertile.dimension)
    );
    return result;
  }

  function tiles_at_ring(r) {
    // Returns the number of tiles (or supertiles) in the rth ring around the
    // single tile at r = 0.
    if (r == 0) {
      return 1;
    } else {
      return 6 * r;
    }
  }

  function tiles_inside_ring(r) {
    // Same as tiles_at_ring, but includes all tiles inside of that ring.
    if (r == 0) {
      return 1;
    } else {
      return 1 + (r * (r+1))/2 * 6
    }
  }

  function rpos__gpos(r, i) {
    // Returns the relative coordinates from a tile at [0, 0] to the ith tile
    // in the rth ring around it. i should not exceed the number of tiles in
    // ring r (see tiles_at_ring).
    let result = [0, 0];
    if (r != 0) { // otherwise result is [0, 0]
      // outwards to edge of ring
      let dir = Math.floor(i / r);
      let ndiff = NEIGHBORS[dir];
      result[0] += ndiff[0] * r;
      result[1] += ndiff[1] * r;
      // along edge to position on edge
      let wdiff = NEIGHBORS[(dir+2) % NEIGHBORS.length];
      let which = i % r;
      result[0] += wdiff[0] * which;
      result[1] += wdiff[1] * which;
    }
    return result;
  }

  function rpos__sgpos(r, i) {
    // Same as rpos__gpos, but for supertile coordinates.
    let result = [0, 0];
    if (r != 0) { // otherwise result is [0, 0]
      // outwards to edge of ring
      let dir = Math.floor(i / r);
      let ndiff = SG_NEIGHBORS[dir];
      result[0] += ndiff[0] * r;
      result[1] += ndiff[1] * r;
      // along edge to position on edge
      let wdiff = SG_NEIGHBORS[(dir+2) % SG_NEIGHBORS.length];
      let which = i % r;
      result[0] += wdiff[0] * which;
      result[1] += wdiff[1] * which;
    }
    return result;
  }

  function gpos__rpos(gp) {
    // Returns the ring position of the given grid tile relative to [0, 0] as a
    // [ring, index] pair.
    let ring = grid_distance([0, 0], gp);
    if (ring == 0) {
      return [0, 0];
    }
    let rsize = tiles_at_ring(ring);
    // TODO: Better method here?!?
    let cart_x = gp[0] + gp[1] * Math.cos(Math.PI/3);
    let cart_y = gp[1] * Math.sin(Math.PI/3);
    let θ = Math.atan2(cart_y, cart_x);
    let adjθ = (Math.PI*2 - θ) - 1.5 * Math.PI;
    if (adjθ < 0) {
      adjθ = adjθ + Math.PI*2;
    }
    let tri = Math.floor(rsize * (adjθ / Math.PI*2))
    let leeway = Math.floor(rsize/16);
    for (let guess = tri - leeway; guess < tri + leeway + 1; ++tri) {
      let guess_pos = rpos__sgpos(ring, guess);
      if (guess_pos[0] == gp[0] && guess_pos[1] == gp[1]) {
        return [ring, guess];
      }
    }
    if (WARNINGS) {
      console.warn(
        "gpos__rpos failed to find correct index for: " + gp + "!"
      );
    }
    return undefined;
  }

  function sgpos__rpos(sgp) {
    // Returns the ring position of the given supergrid tile relative to
    // [0, 0] as a [ring, index] pair.
    let ring = supergrid_distance([0, 0], sgp);
    if (ring == 0) {
      return [0, 0];
    }
    let rsize = tiles_at_ring(ring);
    // TODO: Better method here?!?
    let cart_x = sgp[0] + sgp[1] * Math.cos(Math.PI/3);
    let cart_y = sgp[1] * Math.sin(Math.PI/3);
    let θ = Math.atan2(cart_y, cart_x);
    let adjθ = (Math.PI*2 - θ) - Math.PI;
    if (adjθ < 0) {
      adjθ = adjθ + Math.PI*2;
    }
    let tri = Math.floor(rsize * (adjθ / Math.PI*2))
    let leeway = Math.floor(rsize/16);
    for (let guess = tri - leeway; guess < tri + leeway + 1; ++tri) {
      let guess_pos = rpos__sgpos(ring, guess);
      if (guess_pos[0] == sgp[0] && guess_pos[1] == sgp[1]) {
        return [ring, guess];
      }
    }
    if (WARNINGS) {
      console.warn(
        "sgpos__rpos failed to find correct index for: " + sgp + "!"
      );
    }
    return undefined;
  }

  function sc__rpos(i) {
    // Returns a [ring, ring_index] pair that spirals outwards.
    let ring = 0;
    let tar = tiles_at_ring(ring);
    while (i >= tar) {
      i -= tar;
      ring += 1;
      tar = tiles_at_ring(ring);
    }
    return [ring, i];
  }

  function spiral_grid_pos(i) {
    // Returns a grid position within a supertile starting at the center and
    // spiralling outwards (including beyond the edge if i is >= 37).
    let ri = sc__rpos(i);
    let spc = rpos__gpos(ri[0], ri[1]);
    return [ spc[0] + SG_CENTER[0], spc[1] + SG_CENTER[1] ];
  }

  function neighbor(gp, dir) {
    // Takes a global position and a direction (0--6; can use constants like N
    // or SE) and returns a global position for the neighbor in that direction.
    // The directions are:
    //
    //        0
    //     5     1
    //        *
    //     4     2
    //        3

    var n = NEIGHBORS[dir];
    return [gp[0] + n[0], gp[1] + n[1]];
  }


  function is_canonical(socket) {
    // Takes just a socket index and returns whether or not it's a canonical
    // index or a non-canonical index (see canonical_sgapos below).
    return (socket >= 0 && socket <= 2);
  }

  function is_valid_subindex(gp) {
    // Returns true if the given position is a valid supergrid sub-index, or
    // false if it's outside of the 0,0-origin supergrid tile.
    //
    //   0,6 -> .
    //              .
    //          .       .
    //              .       @
    //          .       @       @
    //              @       @       @
    //   0,3 -> @       @       @       @ <- 6,6
    //              @       @       @    
    //          @       @       @       @
    //              @      3,3      @    
    //          @       @       @       @
    //              @       @       @    
    //   0,0 -> @       @       @       @
    //              @       @       @
    //                  @       @       .
    //                      @       .
    //                          .       .
    //                              .
    //                                  .
    //                        
    //                                  ^
    //                                  |
    //                                 6,0
    //
    var x = gp[0];
    var y = gp[1];
    if (x < 0 || x > 6) { return false; }
    if (y < 0 || y > 6) { return false; }
    if (x > 3 + y) { return false; }
    if (x < (y - 3)) { return false; }
    return true;
  }

  var ALL_SUPERTILE_POSITIONS = [];
  for (let x = 0; x < 7; ++x) {
    for (let y = 0; y < 7; ++y) {
      if (is_valid_subindex([x, y])) {
        ALL_SUPERTILE_POSITIONS.push([x, y]);
      }
    }
  }

  function canonical_sgapos(sgap) {
    // Converts an arbitrary supergrid+assignment position combination to the
    // corresponding canonical combination. Assignment positions 3, 4, and 5
    // are mirrored to positions 0, 1, an 2, while those three are unchanged.
    // The return value is an array with supergrid x,y followed by canonical
    // assignment position. The assignment positions are as follows, with
    // positions 0--2 being canonical:
    //
    //
    //                     1     ###     2
    //                        ###   ###
    //                     ###         ###
    //                  ###               ###
    //                  #                   #
    //                  #                   #
    //                0 #                   # 3
    //                  #                   #
    //                  #                   #
    //                  ###               ###
    //                     ###         ###
    //                        ###   ###
    //                      5    ###     4
    //
    var x = sgap[0];
    var y = sgap[1];
    var asg_pos = sgap[2];
    if (asg_pos == 3) { // take from a neighbor
      x += 1;
      asg_pos -= 3;
    } else if (asg_pos == 4) { // take from a neighbor
      x += 1;
      y -= 1;
      asg_pos -= 3;
    } else if (asg_pos == 5) { // take from a neighbor
      y -= 1;
      asg_pos -= 3;
    }
    return [ x, y, asg_pos ];
  }

  function supergrid_alternate(sgap) {
    // Returns an array containing the supergrid position and assignment
    // position which overlap with the given position. Returns the inputs if
    // the given asg_position is 6 (center).
    var asg_pos = sgap[2];
    if (asg_pos == 0) {
      return [ sgap[0] - 1, sgap[1], 3 ];
    } else if (asg_pos == 1) {
      return [ sgap[0] - 1, sgap[1] + 1, 4 ];
    } else if (asg_pos == 2) {
      return [ sgap[0], sgap[1] + 1, 5 ];
    } else if (asg_pos == 3) {
      return [ sgap[0] + 1, sgap[1], 0 ];
    } else if (asg_pos == 4) {
      return [ sgap[0] + 1, sgap[1] - 1, 1 ];
    } else if (asg_pos == 5) {
      return [ sgap[0], sgap[1] - 1, 2 ];

    } else {
      // neighbor via asg_pos 3 (center) it just yourself
      if (WARNINGS) {
        console.log("Warning: invalid assignment position " + asg_pos);
      }
      return [ sgap[0], sgap[1], asg_pos ];
    }
  }

  function next_edge(asg_pos) {
    // Computes the next edge index for an assignment position.
    return (asg_pos + 1) % COMBINED_SOCKETS;
  }

  function prev_edge(asg_pos) {
    // Computes the previous edge index for an assignment position.
    return (asg_pos + (COMBINED_SOCKETS - 1)) % COMBINED_SOCKETS;
  }

  function supergrid_asg_neighbors(sgap) {
    // Returns a list of supergrid/assignment positions which are adjacent to
    // the given position. Each entry has three values: supergrid x,y and
    // assignment position. There are always four possible neighbors, and they
    // are returned in canonical form.
    if (WARNINGS && isNaN(sgap[2])) {
      console.log(
        "Warning: Assignment position is NaN in supergrid_asg_neighbors."
      );
    }
    var alt = supergrid_alternate(sgap);
    return [
      // adjacent edges on original supergrid tile:
      canonical_sgapos([ sgap[0], sgap[1], prev_edge(sgap[2]) ]),
      canonical_sgapos([ sgap[0], sgap[1], next_edge(sgap[2]) ]),
      // adjacent edges on alternate supergrid tile:
      canonical_sgapos([ alt[0], alt[1], prev_edge(alt[2]) ]),
      canonical_sgapos([ alt[0], alt[1], next_edge(alt[2]) ])
    ];
  }

  function agpos(sgap) {
    // Takes a supergrid position and an assignment position and returns the
    // assignment grid position plus assignment grid number of that position on
    // that supergrid tile. Note that each assignment grid number is assigned
    // to two supergrid tiles. For example, the position-3 grid number for the
    // tile at (0, 0) is also the position-0 grid number for the tile at (1, 0)
    // because those tiles share that edge.
    var cp = canonical_sgapos(sgap);
    var asg_x = cp[0] / (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE);
    var asg_y = cp[1] / (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE);
    var x = cp[0] % (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE);
    var y = cp[1] % (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE);
    asg_pos = cp[2];
    return [
      asg_x,
      asg_y,
      (x * ASSIGNMENT_REGION_SIDE + y) * ASSIGNMENT_SOCKETS + asg_pos
    ];
  }

  function supergrid_home(agp) {
    // The inverse of agpos, takes an assignment grid position
    // (grid indices and number) and returns the supergrid position of a
    // supergrid tile which includes the given assignment number, along with
    // the assignment position within that supergrid tile. The tile returned
    // will be the leftmost/bottommost of the two tiles which are assigned
    // given assignment number.
    var asg_x = agp[0];
    var asg_y = agp[1];
    var asg_number = agp[2];

    var asg_pos = asg_number % ASSIGNMENT_SOCKETS;
    var apg_xy = Math.floor(asg_number / ASSIGNMENT_SOCKETS);
    var y = asg_xy % (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE);
    var x = Math.floor(asg_xy / (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE));

    return [
      asg_x * (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE) + x,
      asg_y * (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE) + y,
      asg_pos
    ];
  }

  return {
    "GRID_SIZE": GRID_SIZE,
    "GRID_EDGE": GRID_EDGE,
    "VERTICES": VERTICES,
    "NEIGHBORS": NEIGHBORS,
    "N": N,
    "NE": NE,
    "SE": SE,
    "S": S,
    "NW": NW,
    "SW": SW,
    "SG_CENTER": SG_CENTER,
    "SG_CENTER_IDX": SG_CENTER_IDX,
    "SUPERTILE_SIZE": SUPERTILE_SIZE,
    "SUPERTILE_TILES": SUPERTILE_TILES,
    "gp__index": gp__index,
    "index__gp": index__gp,
    "ASSIGNMENT_SOCKETS": ASSIGNMENT_SOCKETS,
    "COMBINED_SOCKETS": COMBINED_SOCKETS,
    "ULTRAGRID_SIZE": ULTRAGRID_SIZE,
    "ULTRATILE_SOCKETS": ULTRATILE_SOCKETS,
    "ULTRATILE_ROW_SOCKETS": ULTRATILE_ROW_SOCKETS,
    "ULTRATILE_INTERIOR_SOCKETS": ULTRATILE_INTERIOR_SOCKETS,
    "ULTRATILE_PRE_INTERIOR": ULTRATILE_PRE_INTERIOR,
    "ULTRATILE_CORE_SOCKETS": ULTRATILE_CORE_SOCKETS,
    "ULTRATILE_PRE_CORE": ULTRATILE_PRE_CORE,
    "ASSIGNMENT_REGION_SIDE": ASSIGNMENT_REGION_SIDE,
    "ASSIGNMENT_REGION_TOTAL_SOCKETS": ASSIGNMENT_REGION_TOTAL_SOCKETS,
    "rotate": rotate,
    "rotate_path": rotate_path,
    "world_pos": world_pos,
    "grid_pos": grid_pos,
    "coords__key": coords__key,
    "key__coords": key__coords,
    "grid_distance": grid_distance,
    "supergrid_distance": supergrid_distance,
    "sgpos": sgpos,
    "gpos": gpos,
    "is_neighbor": is_neighbor,
    "ugpos": ugpos,
    "sub_ultra": sub_ultra,
    "extract_subtile": extract_subtile,
    "tiles_at_ring": tiles_at_ring,
    "tiles_inside_ring": tiles_inside_ring,
    "rpos__gpos": rpos__gpos,
    "rpos__sgpos": rpos__sgpos,
    "gpos__rpos": gpos__rpos,
    "sgpos__rpos": sgpos__rpos,
    "sc__rpos": sc__rpos,
    "spiral_grid_pos": spiral_grid_pos,
    "neighbor": neighbor,
    "is_canonical": is_canonical,
    "is_valid_subindex": is_valid_subindex,
    "ALL_SUPERTILE_POSITIONS": ALL_SUPERTILE_POSITIONS,
    "canonical_sgapos": canonical_sgapos,
    "supergrid_alternate": supergrid_alternate,
    "next_edge": next_edge,
    "prev_edge": prev_edge,
    "supergrid_asg_neighbors": supergrid_asg_neighbors,
    "agpos": agpos,
    "supergrid_home": supergrid_home,
  };
});
