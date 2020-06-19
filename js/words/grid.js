// grid.js
// Hex grid code.

import * as anarchy from "../anarchy.mjs";
import * as dimensions from "./dimensions.js";

/**
 * Whether to log warnings:
 */
export var WARNINGS = true;

/**
 * Grid size in canvas units (before viewport_scale)
 * This is the distance between grid cell centers.
 */
export var GRID_SIZE = 30;

/**
 * Size constants based on GRID_SIZE
 */
export var GRID_TOP = GRID_SIZE/2;
export var GRID_BOTTOM = -GRID_SIZE/2;
export var GRID_EDGE = 2 * (Math.tan(Math.PI/6) * GRID_SIZE/2);
// Note: distance from center to extreme point is also GRID_EDGE

/**
 * Vertices of a grid cell, clockwise starting from the upper left
 * vertex, as x/y coordinate pairs relative to the center of the grid
 * cell.
 */
export var VERTICES = [
    [-GRID_EDGE/2, GRID_TOP],
    [GRID_EDGE/2, GRID_TOP],
    [GRID_EDGE, 0],
    [GRID_EDGE/2, GRID_BOTTOM],
    [-GRID_EDGE/2, GRID_BOTTOM],
    [-GRID_EDGE, 0],
];

/**
 * x/y offsets to each neighbor of a grid cell, clockwise starting from
 * the neighbor directly above.
 */
export var NEIGHBORS = [
    [0, 1],
    [1, 1],
    [1, 0],
    [0, -1],
    [-1, -1],
    [-1, 0]
]

/**
 * Directions as indices into the NEIGHBORS array:
 */
export var N_DIRECTIONS = 6;
export var N = 0;
export var NE = 1;
export var SE = 2;
export var S = 3;
export var SW = 4;
export var NW = 5;

/**
 * x/y offsets to each neighbor of a supergrid cell, clockwise starting
 * from the neighbor to the left.
 */
export var SG_NEIGHBORS = [
    [-1, 0],
    [-1, 1],
    [0, 1],
    [1, 0],
    [1, -1],
    [0, -1]
]

/**
 * Supergrid directions as indices into the SG_NEIGHBORS array.
 */
export var SG_W = 0;
export var SG_NW = 1;
export var SG_NE = 2;
export var SG_E = 3;
export var SG_SE = 4;
export var SG_SW = 5;

/**
 * The size of a supertile in grid cells (center->center distance).
 */
export var SUPERTILE_SIZE = 7;
/**
 * The number of grid tiles in a supertile.
 */
export var SUPERTILE_TILES = 37;

/**
 * Converts a supertile inner grid position into a supertile glyphs
 * index. Does not check whether the given inner position is valid (see
 * is_valid_subindex below).
 *
 * @param gp An x/y 2-element array specifying a grid position within a
 *     supertile. The x-axis starts at the southwest corner of the
 *     supertile and increases to the southeast. The y-axis starts at the
 *     southwest corner and increases to the north.
 *
 * @return An index into a supertile's glyphs array.
 */
export function igp__index(igp) {
    return igp[0] + igp[1] * SUPERTILE_SIZE;
}

/**
 * Inverse of above. Similarly does not always result in a valid grid
 * coordinate.
 *
 * @param idx An index within a supertile's glyphs array. The result will
 *     be valid if the index is a valid one (see is_valid_subindex).
 *
 * @return A 2-element x/y array specifying a grid position within a
 *     supertile relative to the southwest corner of the tile. See
 *     is_valid_subindex.
 */
export function index__igp(idx) {
    let y = Math.floor(idx / SUPERTILE_SIZE);
    let x = idx % SUPERTILE_SIZE;
    return [x, y];
}

/**
 * Returns true if the given position is a valid supergrid sub-index, or
 * false if it's outside of the 0,0-origin supergrid tile.
 *
 * ```txt
 *   0,6 -> .
 *              .
 *          .       .
 *              .       @
 *          .       @       @
 *              @       @       @
 *   0,3 -> @       @       @       @ <- 6,6
 *              @       @       @    
 *          @       @       @       @
 *              @      3,3      @    
 *          @       @       @       @
 *              @       @       @    
 *   0,0 -> @       @       @       @
 *              @       @       @
 *                  @       @       .
 *                      @       .
 *                          .       .
 *                              .
 *                                  .
 *                        
 *                                  ^
 *                                  |
 *                                 6,0
 *
 * ```
 *
 * @param igp A two-element x/y array specifying a position within a
 *     supertile.
 *
 * @return True if the given position is within the supertile that it's a
 *     part of. False if it's not. For example, [0, 0] and [3, 6] would
 *     both result in true, while [4, 0] and [1, 5] would both return
 *     false, in addition to things more clearly out-of-range like
 *     [-1, -1] or [12, 4].
 */
export function is_valid_subindex(igp) {
    var x = igp[0];
    var y = igp[1];
    if (x < 0 || x > 6) { return false; }
    if (y < 0 || y > 6) { return false; }
    if (x > 3 + y) { return false; }
    if (x < (y - 3)) { return false; }
    return true;
}

/**
 * Converts a supergrid position into an ultratile index. The position is
 * converted into a valid ultratile index for whichever ultratile it's
 * inside of.
 *
 * @param sgp A 2-element x/y array specifying the position of a
 *     supertile relative to the global origin. 
 *
 * @return An integer index for a supertile within an ultratile.
 */
export function sgp__index(sgp) {
    return (
        anarchy.posmod(sgp[0], ULTRAGRID_SIZE)
        + anarchy.posmod(sgp[1], ULTRAGRID_SIZE) * ULTRAGRID_SIZE
    );
}

/**
 * Converts an ultratile index to a local supergrid position relative to
 * the ultratile origin (not the global origin).
 *
 * @param idx The index of a supertile within an ultratile.
 *
 * @return A 2-element x/y supergrid position array specifying the
 *     location of the indexed supertile relative to the ultratile
 *     origin.
 */
export function index__sgp(idx) {
    let y = Math.floor(idx / ULTRAGRID_SIZE);
    let x = idx % ULTRAGRID_SIZE;
    return [x, y];
}

/**
 * Checks whether the given supergrid position is a valid position within
 * an ultratile. Since ultratiles are square, this is fairly
 * straightforward.
 *
 * @param sgp The supergrid position to check, as a 2-element x/y array.
 *
 * @return True if the given position is a valid ultratile-relative
 *     supergrid position, i.e., if it lies within a box starting at
 *     (0, 0) and ending at (ULTRAGRID_SIZE, ULTRAGRID_SIZE).
 */
export function is_valid_utp(sgp) {
    return (
        sgp[0] >= 0
        && sgp[0] < ULTRAGRID_SIZE
        && sgp[1] >= 0
        && sgp[1] < ULTRAGRID_SIZE
    );
}

/**
 * Converts a socket index within an ultratile into a (canonical) local
 * supergrid assignment position (supergrid x, supergrid y, and socket).
 * Note that there is a second, non-canonical x/y/socket combination
 * which also identifies the same socket.
 *
 * @param sidx An ultratile socket index.
 *
 * @return A supergrid assignment position array with three elements:
 *     supergrid x, supergrid y, and socket index. The x and y values are
 *     local to a single ultratile.
 */
export function sidx__sgap(sidx) {
    let y = Math.floor(sidx / ULTRAGRID_SIZE * ASSIGNMENT_SOCKETS);
    let col = sidx % (ULTRAGRID_SIZE * ASSIGNMENT_SOCKETS);
    let x = Math.floor(col / ASSIGNMENT_SOCKETS);
    let socket = col % ASSIGNMENT_SOCKETS;
    return [x, y, socket];
}

/**
 * Converts a local supergrid assignment position into an ultratile
 * socket index.
 *
 * @param sgap A supergrid assignment position (3-element x/y/socket
 *     array) with either local or global x/y coordinates.
 *
 * @return The ultratile socket index of the given assignment position
 *     within whatever ultratile it's a part of.
 */
export function sgap__sidx(sgap) {
    return sgp__index(sgap) * ASSIGNMENT_SOCKETS + sgap[2];
}

/**
 * Hex index & linear index of the center of a supergrid tile:
 */
export var SG_CENTER = [3, 3]; 
export var SG_CENTER_IDX = igp__index(SG_CENTER);

/**
 * Number of canonical sockets per supergrid tile, and number of total
 * sockets including non-canonical shared sockets.
 */
export var ASSIGNMENT_SOCKETS = 3;
export var COMBINED_SOCKETS = 6;

/**
 * Size in glyphs of an assignment socket:
 */
export var SOCKET_SIZE = 12;

/**
 * How big are ultragrid units? Each ultratile is a square region of
 * supertiles with sides this long.
 */
export var ULTRAGRID_SIZE = 12;

/**
 * Ultragrid size constants.
 */
export var ULTRATILE_ROW_SOCKETS = ULTRAGRID_SIZE * ASSIGNMENT_SOCKETS;

/**
 * Number of supertiles in an ultragrid tile.
 */
export var ULTRATILE_SUPERTILES = ULTRAGRID_SIZE * ULTRAGRID_SIZE;

/**
 * Number of those that are in the interior.
 */
export var ULTRATILE_INTERIOR_SUPERTILES = (
    (ULTRAGRID_SIZE - 2)
    * (ULTRAGRID_SIZE - 2)
);

/**
 * One row of supertiles in an ultratile minus the ends.
 */
export var ULTRATILE_INTERIOR_SUPERTILES_ROW = ULTRAGRID_SIZE - 2;

/**
 * Number of supertiles before the first interior supertile:
 */
export var ULTRATILE_SUPERTILES_PRE_INTERIOR = ULTRAGRID_SIZE + 2;

/**
 * Number of assignment sockets in an ultratile:
 */
export var ULTRATILE_SOCKETS = ULTRATILE_SUPERTILES * ASSIGNMENT_SOCKETS;

/**
 * Same, minus the top and left edge supertiles (which share canonical
 * sockets with other ultratiles).
 */
export var ULTRATILE_INTERIOR_SOCKETS = (
    (ULTRAGRID_SIZE - 1)
    * (ULTRAGRID_SIZE - 1)
    * ASSIGNMENT_SOCKETS
);

/**
 * One row of sockets in the interior.
 */
export var ULTRATILE_INTERIOR_SOCKETS_ROW = (
    (ULTRAGRID_SIZE - 1) * ASSIGNMENT_SOCKETS
);

/**
 * Number of positions before the first non-edge position
 */
export var ULTRATILE_SOCKETS_PRE_INTERIOR = (
    (ULTRAGRID_SIZE + 1) * ASSIGNMENT_SOCKETS
);

/**
 * Same as above but excluding a two-supertile border
 */
export var ULTRATILE_CORE_SOCKETS = (
    (ULTRAGRID_SIZE - 4)
    * (ULTRAGRID_SIZE - 4)
    * ASSIGNMENT_SOCKETS
);

/**
 * One row of sockets in the core
 */
export var ULTRATILE_CORE_SOCKETS_ROW = (
    (ULTRAGRID_SIZE - 4) * ASSIGNMENT_SOCKETS
);

/**
 * As ULTRATILE_SOCKETS_PRE_INTERIOR but for core tiles (two-away from edges)
 */
export var ULTRATILE_SOCKETS_PRE_CORE = (
    ((ULTRAGRID_SIZE * 2) + 2)
    * ASSIGNMENT_SOCKETS
);

/**
 * Size of assignment region is this squared; should be large enough to
 * accommodate even a relatively large corpus (vocabulary, not count).
 * The units are ultragrid tiles.
 */
export var ASSIGNMENT_REGION_SIDE = 1024;

/**
 * Number of ultratiles in an assignment region.
 */
export var ASSIGNMENT_REGION_ULTRATILES = (
    ASSIGNMENT_REGION_SIDE
    * ASSIGNMENT_REGION_SIDE
);

/**
 * Total number of supertiles in an assignment region.
 */
export var ASSIGNMENT_REGION_TOTAL_SUPERTILES = (
    ASSIGNMENT_REGION_ULTRATILES
    * ULTRATILE_SUPERTILES
);

/**
 * Total sockets in an assignment region.
 *   1024 * 1024 * 12 * 12 * 4 ~= 600,000,000
 */
export var ASSIGNMENT_REGION_TOTAL_SOCKETS = (
    ASSIGNMENT_REGION_SIDE
    * ASSIGNMENT_REGION_SIDE
    * ULTRATILE_SOCKETS
);

/**
 * Rotates one of the direction constants (e.g., N; NE) by the given number
 * of steps clockwise (use a negative number for counter-clockwise).
 *
 * @param direction One of the direction constants (see above).
 * @param amount How many steps clockwise to rotate.
 *
 * @return Another direction constant indicating the new direction after
 *     rotation.
 */
export function rotate(direction, amount) {
    return anarchy.posmod(direction + amount, 6);
}

/**
 * Rotates an array of directions. Returns a new array without modifying the
 * original.
 *
 * @param directions An array containing direction constants. 
 * @param amount The number of steps clockwise to rotate each entry in
 *     the directions list.
 *
 * @return A new array containing directions constants where each has
 *     been rotated by the given amount. Following these new directions
 *     will take you on a path that represents a rotated version of the
 *     original path.
 */
export function rotate_directions(directions, amount) {
    var result = [];
    for (var i = 0; i < directions.length; ++i) {
        result.push(rotate(directions[i], amount));
    }
    return result;
}

/**
 * Returns the world x/y Cartesian position corresponding to the given
 * grid position.
 *
 * @param gp A 2-element x/y hex grid coordinate array, with absolute
 *     coordinates.
 *
 * @return A 2-element x/y cartesian world-coordinate array.
 */
export function world_pos(gp) {
    var x = GRID_SIZE * Math.cos(Math.PI/6) * gp[0];
    var y = GRID_SIZE * (gp[1] - Math.sin(Math.PI/6) * gp[0]);
    return [x, y];
}

/**
 * Returns the grid position which includes the given world position.
 *
 * Picture (dotted lines indicate initial rectangular boxes; proportions
 * are slightly distorted due to character aspect ratio):
 *
 * ```
 *
 *                      GRID_EDGE    This part is actually 1/2 GRID_EDGE,
 *                          =        Not 1/3 as it seems here.
 *                      _________   /
 *                     *         * v
 *                                ___
 *                               *   *
 *
 *              *      +----+----+....
 *             |      /:          \  :
 *             |     / :           \ :
 *             |    /  :            \:
 * GRID_SIZE = |   +   :   0,1       +----+----+....
 *             |    \  :            /:          \  :
 *             |     \ :           / :           \ :
 *             |      \:          /  :            \:
 *              *      +----+----+....   1,1       +
 *                    /:          \  :            /:
 *                   / :           \ :           / :
 *                  /  :            \:          /  :
 *                 +   :   0,0       +----+----+....
 *                  \  :            /:          \  :
 *                   \ :           / :           \ :
 *                    \:          /  :            \:
 *                     +----+----+...:   1,0       +
 *                    /           \  :            /:
 *                   /             \ :           / :
 *                  /               \:          /  :
 *                 +                 +----+----+....
 *
 * ```
 *
 * @param wp A 2-element x/y Cartesian world coordinate array.
 *
 * @return A 2-element x/y hex grid position array indicating which hex
 *     tile contains the given world position.
 */
export function grid_pos(wp) {
    // First, compute origin-shifted and jittered square position

    // Find square grid integers using shifted/jittered grid
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
            let slope_from_corner = above_center / from_right;
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

/**
 * Converts a pair of grid coordinates into a string key.
 *
 * @param gp A 2-element x/y hex grid coordinate array.
 *
 * @return A string key that uniquely identifies the given grid position.
 */
export function coords__key(gp) {
    return "" + gp;
}

/**
 * Converts a string key into a pair of grid coordinates.
 *
 * @param gk A string identifying a grid point (see coords__key).
 * @return A 2-element hex grid coordinate pair.
 */
export function key__coords(gk) {
    if (gk == "undefined") { return undefined; }
    bits = gk.split(',');
    return bits.map(b => parseInt(b));
}

/**
 * Z coordinate on the regular grid. For hexagonal grids, since they're
 * 2-D, two coordinates is enough to uniquely identify any point, but a
 * third coordinate is useful for computing distance to help account for
 * the fact that the distance from (0, 0) to (1, 1) is only 1, while the
 * distance from (0, 0) to (1, -1) is 2.
 *
 * Here are three diagrams showing the x, y, and z coordinates of hex
 * cells surrounding the origin.
 *
 * ```
 *
 * X coordinate values (+1 means move southeast)
 *
 *            \       /
 *             \     /
 *        -1    -----    1
 *     \       /     \       /
 *      \     /       \     /
 * -2    -----    0    -----    2
 *      /     \       /     \
 *     /       \     /       \
 *  ---   -1    -----    1    -----
 *     \       /     \       /
 *      \     /       \     /
 * -2    -----    0    -----    2
 *      /     \       /     \
 *     /       \     /       \
 *  ---   -1    -----    1    -----
 *     \       /     \       /
 *      \     /       \     /
 * -2    -----    0    -----    2
 *      /     \       /     \
 *     /       \     /       \
 *    /   -1    -----    1    \
 *             /     \
 *            /       \
 *
 * Y coordinate values (+1 means move north)
 *
 *            \       /
 *             \     /
 *         1    -----    2
 *     \       /     \       /
 *      \     /       \     /
 *  0    -----    1    -----    2
 *      /     \       /     \
 *     /       \     /       \
 *  ---    0    -----    1    -----
 *     \       /     \       /
 *      \     /       \     /
 * -1    -----    0    -----    1
 *      /     \       /     \
 *     /       \     /       \
 *  ---   -1    -----    0    -----
 *     \       /     \       /
 *      \     /       \     /
 * -2    -----   -1    -----    0
 *      /     \       /     \
 *     /       \     /       \
 *    /   -2    -----   -1    \
 *             /     \
 *            /       \
 *
 * Z coordinate values (+1 when moving south or southeast):
 *
 *            \       /
 *             \     /
 *        -2    -----   -1
 *     \       /     \       /
 *      \     /       \     /
 * -2    -----   -1    -----    0
 *      /     \       /     \
 *     /       \     /       \
 *  ---   -1    -----    0    -----
 *     \       /     \       /
 *      \     /       \     /
 * -1    -----    0    -----    1
 *      /     \       /     \
 *     /       \     /       \
 *  ---    0    -----    1    -----
 *     \       /     \       /
 *      \     /       \     /
 *  0    -----    1    -----    2
 *      /     \       /     \
 *     /       \     /       \
 *    /    1    -----    2    \
 *             /     \
 *            /       \
 *
 * ```
 *
 * @param pos A 2-element x/y array of hex grid coordinates on the tile
 *     grid.
 *
 * @return An integer z-coordinate value for that position.
 */
export function z_coord(pos) {
    return pos[0] - pos[1];
}

/**
 * Z coordinate on the super grid. The super grid has a different
 * alignment than the regular grid (the Cartesian-axis-aligned sides of
 * hexagons are vertical rather than horizontal) so it has a different Z
 * axis (see z_coord above).
 *
 * Diagrams showing the super grid axes:
 *
 * ```
 *
 * X coordinates:
 *
 *               -- --         -- --
 *             --     --     --     --
 *           --         -- --         --
 *          |             |             |
 *  -2      |     -1      |      0      |      1
 *          |             |             |
 *        -- --         -- --         -- --    
 *      --     --     --     --     --     --  
 *    --         -- --         -- --         --
 *   |             |             |             |
 *   |     -1      |      0      |      1      |
 *   |             |             |             |
 *    --         -- --         -- --         --
 *      --     --     --     --     --     --
 *        -- --         -- --         -- --
 *          |             |             |
 *  -1      |      0      |      1      |      2
 *          |             |             |
 *           --         -- --         --
 *             --     --     --     --
 *               -- --         -- --
 *
 * Y coordinates:
 *
 *              -- --         -- --
 *            --     --     --     --
 *          --         -- --         --
 *         |             |             |
 *  1      |      1      |      1      |      1
 *         |             |             |
 *       -- --         -- --         -- --    
 *     --     --     --     --     --     --  
 *   --         -- --         -- --         --
 *  |             |             |             |
 *  |      0      |      0      |      0      |
 *  |             |             |             |
 *   --         -- --         -- --         --
 *     --     --     --     --     --     --
 *       -- --         -- --         -- --
 *         |             |             |
 *         |     -1      |     -1      |     -1
 * -1      |             |             |
 *          --         -- --         --
 *            --     --     --     --
 *              -- --         -- --
 *
 * Z coordinates:
 *
 *              -- --         -- --
 *            --     --     --     --
 *          --         -- --         --
 *         |             |             |
 * -1      |      0      |      1      |      2
 *         |             |             |
 *       -- --         -- --         -- --    
 *     --     --     --     --     --     --  
 *   --         -- --         -- --         --
 *  |             |             |             |
 *  |     -1      |      0      |      1      |
 *  |             |             |             |
 *   --         -- --         -- --         --
 *     --     --     --     --     --     --
 *       -- --         -- --         -- --
 *         |             |             |
 * -2      |     -1      |      0      |      1
 *         |             |             |
 *          --         -- --         --
 *            --     --     --     --
 *              -- --         -- --
 *
 * ```
 *
 * @param pos A 2-element x/y array of hex grid coordinates on the
 *     supertile grid.
 *
 * @return An integer z-coordinate value for that position.
 */
export function super_z(pos) {
    return pos[0] + pos[1];
}

/**
 * Computes the distance between two grid positions. See:
 * http://keekerdc.com/2011/03/hexagon-grids-coordinate-systems-and-distance-calculations/
 * Note our formula for z is (-x + y + z = 0  ->  z = x - y) because our
 * axes are arranged differently.
 *
 * @param from A 2-element x/y tile grid coordinate pair.
 * @param to Another grid position array in the same format as from.
 *
 * @return The number of hops on the grid required to move from one of
 *     the two tiles to the other.
 */
export function grid_distance(from, to) {
    let dx = Math.abs(from[0] - to[0]);
    let dy = Math.abs(from[1] - to[1]);
    let dz = Math.abs(z_coord(from) - z_coord(to));
    return Math.max(dx, dy, dz);
}

/**
 * As grid_distance, but for the supergrid, which has different axes. The
 * formula for z is (-x - y + z = 0 -> z = x + y).
 *
 * @param from A 2-element x/y supertile grid coordinate pair.
 * @param to Another supergrid position array in the same format as from.
 *
 * @return The number of hops on the supergrid required to move from one
 *     of the two supertiles to the other.
 */
export function supergrid_distance(from, to) {
    let dx = Math.abs(from[0] - to[0]);
    let dy = Math.abs(from[1] - to[1]);
    let dz = Math.abs(super_z(from) - super_z(to));
    return Math.max(dx, dy, dz);
}

/**
 * Returns true if the two positions given are neighbors, and false
 * otherwise (including if they are the same position).
 *
 * @param from A 2-element x/y tile grid coordinate array.
 * @param to Another tile grid position, as from.
 *
 * @return True if the two positions are exactly distance 1 from each
 *     other. False otherwise, including if they are distance 0 or if
 *     either is undefined.
 */
export function is_neighbor(from, to) {
    if (from == undefined || to == undefined) {
        return false;
    }
    return grid_distance(from, to) == 1;
}

/**
 * Fetches a supergrid-position from a grid-position. Supergrid hexes are
 * each composed of 37 hexes centered on a single center hex, forming a
 * hexagonal shape at right angles to the underlying grid. These
 * super-hexagons have rough edges, so they can't stack perfectly with
 * one another, but instead interlock at a 1/2 hex offset, which makes
 * tiling a bit complicated.
 *
 * Note that this returns 4 numbers: the column and row in supergrid terms,
 * plus the within-supertile relative x and y.
 *
 * Superhexes are encoded as an array of 49 values, 12 of which are nulls,
 * which allows quick 2-dimensional indexing (see picture below).
 *
 * Interior indexing is anchored at the southeast corner of each supergrid
 * tile, as shown below.
 *
 * Picture (dots indicate coordinate system extent for middle super-hex):
 *
 * ```
 *
 *                                                      #
 *                                                  #       #
 *                                              #       #       #
 *                                          #       #       #       #
 *                                              #       #        #
 *       Supergrid axes:                    #       #       #       #
 *                                              #       #        #
 *                 ^                        #       #       #       #
 *                / y    0,6 -> .               #       #        #
 *               /                  .       #       #       #       #
 *              /               .       .       #       #       #
 *     <-------+------->            .       @       #       #
 *            /      x          .       @       @       #
 *           /                      @       @       @
 *          /            0,3 -> @       @       @       @ <- 6,6
 *         v                        @       @       @    
 *                              @       @       @       @
 *                                  @      3,3      @    
 *                              @       @       @       @
 *                                  @       @       @    
 *                       0,0 -> @       @       @       @
 *                                  @       @       @
 *                              &       @       @       .
 *                          &       &       @       .
 *                      &       &       &       .       .
 *                  &       &       &       &       .
 *                      &       &       &               .
 *                  &       &       &       & 
 *                      &       &       &               ^
 *                  &       &       &       &           |
 *                      &       &       &              6,0
 *                  &       &       &       &
 *                      &       &       &
 *                          &       &
 *                              &
 *
 * ```
 *
 * Algebra for our unskew transform:
 *
 * Basis vectors of the space:
 *
 *  v1 = (7, 4)
 *  v2 = (3, 7)
 * 
 * Coordinate equations:
 *
 *  7 c1 + 3 c2 = x
 *  4 c1 + 7 c2 = y
 * 
 * Solved for c2:
 *
 *  c2 = 1/3 x - 7/3 c1
 *  c2 = 1/7 y - 4/7 c1
 * 
 * Substituting those into c2 = c2 and solving for c1:
 *
 *  1/3 x - 7/3 c1 = 1/7 y - 4/7 c1
 *  (7/3 - 4/7) c1 = 1/3 x - 1/7 y
 *  c1 = (1/3 x - 1/7 y) / (7/3 - 4/7)
 *
 *
 * @param gp A 2-element x/y tile grid coordinate array.
 *
 * @return A 4-element array including supergrid x/y coordinates of the
 *     supertile containing the given grid position, followed by interior
 *     x/y coordinates of the given tile within its supertile. For
 *     example, (4, 3) is simply tile (4, 3) within supertile (0, 0), so
 *     the result would be [0, 0, 4, 3]. Meanwhile, grid tile (4, 8) is 
 *     in supertile (0, 1) at position (1, 1), so the return value would
 *     be [0, 1, 1, 1].
 */
export function gp__sgp(gp) {
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

/**
 * The inverse of gp__sgp, takes a supergrid position including relative
 * interior position and returns the corresponding global position. If
 * the supergrid position does not have interior components, they will be
 * treated as zeroes and the precise grid location of the origin tile
 * within the supertile (the south-west corner) will be returned.
 *
 * @param sgp A 4-element supergrid x/y + within-supertile x/y array (see
 *     gp__sgp). Could also be just a 2-element supergrid x/y array in
 *     which case the within supertile coordinates (0, 0) will be used.
 *
 * @return A 2-element x/y hex grid position array.
 */
export function sgp__gp(sgp) {
    // supertile offset vectors:
    var vx = [7, 4];
    var vy = [3, 7];

    let ox = sgp[0];
    let oy = sgp[1];
    let ix = sgp[2];
    let iy = sgp[3];
    if (ix == undefined) { ix = 0; }
    if (iy == undefined) { iy = 0; }

    var gx = ox * vx[0] + oy * vy[0] + ix;
    var gy = ox * vx[1] + oy * vy[1] + iy;

    return [gx, gy]; 
}

/**
 * Extracts an ultra-grid position from a super-grid position. Just uses
 * modulus math, since ultratiles are square.
 *
 * @param sgp A 2-element x/y array specifying a supergrid position.
 *     Extra elements will be safely ignored.
 *
 * @return A 4-element coordinate array with ultragrid x/y coordinates
 *     followed by interior x/y coordinates for the given supertile
 *     within that ultratile.
 */
export function sgp__ugp(sgp) {
    return [
        Math.floor(sgp[0]/ULTRAGRID_SIZE),
        Math.floor(sgp[1]/ULTRAGRID_SIZE),
        ((sgp[0] % ULTRAGRID_SIZE) + ULTRAGRID_SIZE) % ULTRAGRID_SIZE,
        ((sgp[1] % ULTRAGRID_SIZE) + ULTRAGRID_SIZE) % ULTRAGRID_SIZE,
    ];
}

/**
 * Takes an ultragrid position that contains a relative supergrid
 * interior position and returns an absolute supergrid position. This is
 * the inverse of sgp__ugp.
 *
 * @param ugp A 4-element coordinate array with ultragrid x/y followed by
 *     interior supergrid x/y coordinates.
 *
 * @return A 2-element absolute supergrid x/y coordinate array.
 */
export function ugp__sgp(ugp) {
    return [
        ugp[0] * ULTRAGRID_SIZE + ugp[2],
        ugp[1] * ULTRAGRID_SIZE + ugp[3]
    ];
}

/**
 * Extracts a subtile from a supertile according to inner coordinates.
 * Returns an incomplete tile object without position information. Note
 * that the relative coordinates should be in-bounds, like those returned
 * from gp__sgp (see also is_valid_subindex).
 *
 * @param supertile A supertile data object.
 * @param igp A 2-element x/y coordinate array containing
 *     supertile-relative inner grid coordinates, e.g., entries 3 and 4 of
 *     a gp__sgp result, or a result from index__igp. The inner
 *     coordinates must be valid.
 *
 * @return An incomplete tile object that lacks position information
 *     (because we don't know its global position). The tile object will
 *     have the following keys:
 *
 *     'glyph': The glyph that's in that tile.
 *     'colors': A fresh array of color strings indicating tile colors.
 *     'domain': The domain that this tile belongs to.
 *     'shape': The four shape constants for this tile, based on its
 *         domain.
 *     'is_inclusion': True if this tile is part of an inclusion in the
 *         dimension that the supertile belongs to, i.e., when the domain
 *         of this tile is not the same as the natural domain of the
 *         supertile.
 */
export function extract_subtile(supertile, igp) {
    var result = {};
    var idx = igp__index(rgp);
    result["glyph"] = supertile.glyphs[idx];
    result["colors"] = supertile.colors[idx].slice();
    result["domain"] = supertile.domains[idx];
    result["shape"] = dimensions.shape_for(supertile.domains[idx]);
    result["is_inclusion"] = (
        result["domain"] != dimensions.natural_domain(supertile.dimension)
    );
    return result;
}

/**
 * Returns the number of tiles (or supertiles) in the rth ring around the
 * single tile at r = 0.
 *
 * @param r Which ring to measure; also the distance from the central
 *     tile to each tile in that ring.
 *
 * @return An integer specifying the number of tiles at exactly the given
 *     distance from a central tile.
 */
export function tiles_at_ring(r) {
    if (r == 0) {
        return 1;
    } else {
        return 6 * r;
    }
}

/**
 * Same as tiles_at_ring, but includes all tiles inside of that ring.
 *
 * @param r Which ring to measure; also the maximum distance from a
 *     central tile to any included tile.
 *
 * @return The total number of tiles that are distance <= r from a
 *     central tile.
 */
export function tiles_within_ring(r) {
    return 1 + (r * (r+1))/2 * 6
}

/**
 * Returns the relative coordinates from a tile at [0, 0] to the ith tile
 * in the rth ring around it. 'i' should not exceed the number of tiles in
 * ring r (see tiles_at_ring). The index-0 tile in each ring is the tile
 * that's directly north of the center tile, and indices count up
 * clockwise around the ring. Here's a diagram showing the indices in
 * rings 0, 1, 2, and 3 (r values are not shown):
 *
 * ```
 *                 0
 *            17       1
 *        16       0       2
 *    15      11       1       3
 *        10       0       2
 *    14       5       1       4
 *         9       0       3
 *    13       4       2       5
 *         8       3       4
 *    12       7       5       6
 *        11       6       7
 *            10       8
 *                 9
 * ```
 *
 * @param rp A 2-element ring-position array that includes a ring radius
 *     and an index within the ring at that radius (both integers).
 *
 * @return A 2-element x/y hex grid coordinate array, specifying
 *     coordinates relative to the center of the ring.
 */
export function rp__gp(rp) {
    let r = rp[0]; // ring radius
    let i = rp[1]; // ring index
    let result = [0, 0];
    if (r != 0) { // otherwise result is [0, 0]
        // outwards to edge of ring
        let dir = Math.floor(i / r); // This will be 0-5
        let ndiff = NEIGHBORS[dir]; // x/y coordinate change for that direction
        result[0] += ndiff[0] * r; // move out to correct edge of ring
        result[1] += ndiff[1] * r;
        // along edge to position on edge
        // dir+2 means two turns clockwise so we can move along the edge
        // we just reached
        let wdiff = NEIGHBORS[(dir+2) % NEIGHBORS.length];
        let which = i % r; // The part of the index that was left over
        result[0] += wdiff[0] * which; // move along edge
        result[1] += wdiff[1] * which;
    }
    return result;
}

/**
 * Same as rp__gp, but for supertile grid and ring coordinates. Here's a
 * diagram of the supergrid ring indices for rings 0, 1, 2, and 3:
 *
 * ```
 *
 *           3   4   5   6
 *
 *         2   2   3   4   7
 *
 *       1   1   1   2   5   8
 *
 *     0   0   0   0   3   6   9
 *
 *      17  11   5   4   7  10
 *
 *        16  10   9   8  11
 *
 *          15  14  13  12
 *
 * ```
 *
 * @param srp A 2-element superring-position array that includes a ring
 *     radius and an index within the ring at that radius (both
 *     integers).
 *
 * @return A 2-element x/y supergrid coordinate array, specifying
 *     supertile coordinates relative to the center of the ring.
 */
export function srp__sgp(r, i) {
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

/**
 * Returns the ring position of the given grid tile relative to [0, 0] as a
 * [ring, index] pair.
 *
 * @param gp A 2-element x/y tile grid coordinate array.
 *
 * @return A 2-element ring/index ring-coordinate array.
 */
export function gp__rp(gp) {
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
        let guess_pos = rp__gp(ring, guess);
        if (guess_pos[0] == gp[0] && guess_pos[1] == gp[1]) {
            return [ring, guess];
        }
    }
    if (WARNINGS) {
        console.warn(
            "gp__rp failed to find correct index for: " + gp + "!"
        );
    }
    return undefined;
}

/**
 * Returns the superring position of the given supergrid tile relative to
 * [0, 0] as a [ring, index] pair.
 *
 * @param sgp A 2-element x/y supertile coordinate array.
 *
 * @return A 2-element ring/index superring coordinate array.
 */
export function sgp__srp(sgp) {
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
        let guess_pos = srp__sgp(ring, guess);
        if (guess_pos[0] == sgp[0] && guess_pos[1] == sgp[1]) {
            return [ring, guess];
        }
    }
    if (WARNINGS) {
        console.warn(
            "srp__sgp failed to find correct index for: " + sgp + "!"
        );
    }
    return undefined;
}

/**
 * Converts a spiral index into a ring position. Here is a diagram
 * showing the layout of spiral indices in the tile grid (the layout in
 * the supertile grid is rotated but otherwise similar).
 *
 * ```
 *                21
 *            20      22
 *        19       8      23
 *    36       7       9      24
 *        18       1      10
 *    35       6       2      25
 *        17       0      11
 *    34       5       3      26
 *        16       4      12
 *    33      15      13      27
 *        32      14      28
 *            31      29
 *                30
 * ```
 *
 * @param i An integer indicating a single spiral coordinate value.
 *
 * @return A 2-element ring/index ring position array.
 */
export function si__rp(i) {
    let ring = 0;
    let tar = tiles_at_ring(ring);
    while (i >= tar) {
        i -= tar;
        ring += 1;
        tar = tiles_at_ring(ring);
    }
    let slip = Math.max(ring - 1, 0);
    let corrected = anarchy.posmod(i - slip, tar);
    return [ring, i];
}

/**
 * Returns a grid position within a supertile starting at the center and
 * spiralling outwards (including beyond the edge if i is >= 37). See
 * si__rp for a diagram of the spiral index positions.
 *
 * @param i An integer spiral index, where 0 will return the center of
 *     the supertile, and indices greater than 36 will be beyond the edge
 *     of the supertile.
 *
 * @return A 2-element x/y within-supertile tile coordinate array.
 */
export function si__igp(i) {
    let rp = si__rp(i);
    let spc = rp__gp(rp);
    return [ spc[0] + SG_CENTER[0], spc[1] + SG_CENTER[1] ];
}

/**
 * Takes a global position and a direction (0--5; can use constants like N
 * or SE) and returns a global position for the tile grid neighbor in
 * that direction. The directions are:
 *
 *        0
 *     5     1
 *        *
 *     4     2
 *        3
 *
 * @param gp A 2-element x/y tile grid coordinate array.
 * @param dir A direction index according to the diagram above; these are
 *     also stored in six direction constants like N and SE.
 *
 * @return A 2-element x/y tile grid coordinate array corresponding to
 *     the neighbor of the input position in the given direction.
 */
export function neighbor(gp, dir) {
    let n = NEIGHBORS[dir];
    return [gp[0] + n[0], gp[1] + n[1]];
}

/**
 * Takes a supergrid position and a direction (0--5) and returns the
 * supergrid coordinates for the neighbor in that direction.
 * The directions are:
 *
 *      1   2
 *
 *     0  *  3
 *
 *      5   4
 *
 * @param sgp A 2-element x/y supergrid coordinate array.
 * @param dir A direction index according to the diagram above; these are
 *     also stored in the SG_ direction constants like SG_W and SG_NE.
 *
 * @return A 2-element x/y supergrid coordinate array holding the
 *     position of the supertile adjacent to the given supertile that's
 *     in the specified direction.
 */
export function sg_neighbor(sgp, dir) {
    let n = SG_NEIGHBORS[dir];
    return [sgp[0] + n[0], sgp[1] + n[1]];
}


/**
 * Takes just a socket index and returns whether or not it's a canonical
 * index or a non-canonical index (see canonical_sgapos below).
 *
 * @param socket A socket index from 0 to 6.
 *
 * @return True if the socket is a canonical socket (0-2) and false
 *     otherwise. Each socket is shared by two supertiles, so there are
 *     two ways of naming it according to the supergrid coordinates of
 *     each supertile it's a part of and the opposite-side socket indices
 *     in those supertiles that identify the shared socket. Three of
 *     those (west=0, northwest=1, and northeast=2) are canonical, and
 *     the other three should generally be identified using their
 *     canonical duals. 
 */
export function is_canonical(socket) {
    return (socket >= 0 && socket <= 2);
}

/**
 * An array that stores 37 2-element x/y inner grid position coordinate
 * pairs: one pair for each valid inner grid position within a supertile.
 */
export var ALL_SUPERTILE_POSITIONS = [];
for (let x = 0; x < 7; ++x) {
    for (let y = 0; y < 7; ++y) {
        if (is_valid_subindex([x, y])) {
            ALL_SUPERTILE_POSITIONS.push([x, y]);
        }
    }
}

/**
 * Converts an arbitrary supergrid+assignment position combination to the
 * corresponding canonical combination. Assignment positions 3, 4, and 5
 * are mirrored to positions 0, 1, an 2, while those three are unchanged.
 * The return value is an array with supergrid x,y followed by canonical
 * assignment position. The assignment positions are as follows, with
 * positions 0--2 being canonical:
 *
 *
 *                     1     ###     2
 *                        ###   ###
 *                     ###         ###
 *                   ##               ##
 *                  #                   #
 *                  #                   #
 *                0 #         6         # 3
 *                  #                   #
 *                  #                   #
 *                   ##               ## 
 *                     ###         ###
 *                        ###   ###
 *                      5    ###     4
 *
 * @param sgap A 3-element supergrid assignment position array,
 *     containing x/y supergrid coordinates followed by a socket index.
 *
 * @return Another 3-element supergrid assignment position array,
 *     which may be the same as the original if it's already canonical,
 *     or which may be a new position that identifies an adjacent
 *     supertile and the complimentary socket in that supertile which is
 *     canonical.
 */
export function canonical_sgapos(sgap) {
    var x = sgap[0];
    var y = sgap[1];
    var asg_idx = sgap[2];
    if (asg_idx == 3) { // take from a neighbor
        x += 1;
        asg_idx -= 3;
    } else if (asg_idx == 4) { // take from a neighbor
        x += 1;
        y -= 1;
        asg_idx -= 3;
    } else if (asg_idx == 5) { // take from a neighbor
        y -= 1;
        asg_idx -= 3;
    }
    return [ x, y, asg_idx ];
}

/**
 * Returns an array containing the supergrid position and assignment
 * position which overlap with the given position. Returns the inputs if
 * the given assignment index is 6 (center).
 *
 * @param sgap A 3-element supergrid assignment position array: x/y
 *     supergrid coordinates plus an assignment index.
 *
 * @return The other supergrid assignment position that overlaps the
 *     given assignment index, as a 3-element array.
 */
export function supergrid_alternate(sgap) {
    var asg_idx = sgap[2];
    if (asg_idx == 0) {
        return [ sgap[0] - 1, sgap[1], 3 ];
    } else if (asg_idx == 1) {
        return [ sgap[0] - 1, sgap[1] + 1, 4 ];
    } else if (asg_idx == 2) {
        return [ sgap[0], sgap[1] + 1, 5 ];
    } else if (asg_idx == 3) {
        return [ sgap[0] + 1, sgap[1], 0 ];
    } else if (asg_idx == 4) {
        return [ sgap[0] + 1, sgap[1] - 1, 1 ];
    } else if (asg_idx == 5) {
        return [ sgap[0], sgap[1] - 1, 2 ];
    } else {
        // neighbor via asg_idx 6 (center) is just yourself
        if (WARNINGS) {
            console.log("Warning: invalid assignment position " + asg_idx);
        }
        return [ sgap[0], sgap[1], asg_idx ];
    }
}

/**
 * Computes the next edge index for an assignment position. The natural
 * assignment indices are 0-5, but 6 is sometimes used to describe the
 * central region of a supertile. This function ignores 6, and returns
 * the next index around the edge of a supertile.
 *
 * @param asg_idx An integer assignment index between 0 and 5 inclusive.
 *
 * @return The assignment index corresponding to the next assignment slot
 *     clockwise around the edge of the supertile.
 */
export function next_edge(asg_idx) {
    return (asg_idx + 1) % COMBINED_SOCKETS;
}

/**
 * Computes the previous edge index for an assignment position. Inverse
 * of next_edge.
 *
 * @param asg_idx An integer assignment index between 0 and 5 inclusive.
 *
 * @return The assignment index of the assignment slot counterclockwise
 *     from the given slot around the edge of the supertile.
 */
export function prev_edge(asg_idx) {
    return (asg_idx + (COMBINED_SOCKETS - 1)) % COMBINED_SOCKETS;
}

/**
 * Returns a list of supergrid/assignment positions which are adjacent to
 * the given position. Each entry has three values: supergrid x/y and
 * assignment index. There are always four possible neighbors, and they
 * are returned in canonical form.
 *
 * @param sgap A 3-element supergrid assignment position array.
 *
 * @return An array of all four supergrid assignment positions (3-element
 *     x/y/index arrays) which are adjacent to the given assignment
 *     position, each in canonical form.
 */
export function supergrid_asg_neighbors(sgap) {
    if (WARNINGS && isNaN(sgap[2])) {
        console.log(
            "Warning: Assignment position is NaN in supergrid_asg_neighbors."
        );
    }
    let alt = supergrid_alternate(sgap);
    return [
        // adjacent edges on original supergrid tile:
        canonical_sgapos([ sgap[0], sgap[1], prev_edge(sgap[2]) ]),
        canonical_sgapos([ sgap[0], sgap[1], next_edge(sgap[2]) ]),
        // adjacent edges on alternate supergrid tile:
        canonical_sgapos([ alt[0], alt[1], prev_edge(alt[2]) ]),
        canonical_sgapos([ alt[0], alt[1], next_edge(alt[2]) ])
    ];
}

/**
 * Converts a supergrid assignment position into an assignment region
 * position, which consists of x/y coordinates indicating which
 * assignment region the supertile belongs to, followed by a single index
 * value identifying that socket within that assignment region.
 *
 * Note that each socket belongs to two supergrid tiles. For example, the
 * index-3 socket for the tile at (0, 0) is also the index-0 socket
 * for the tile at (1, 0) because those tiles share that edge, so both of
 * those supergrid assignment positions would result in the same
 * assignment region position.
 *
 * @param sgap A 3-element supergrid assignment position array: x/y
 *     supertile coordinates plus socket index.
 *
 * @return A 3-element assignment region position array. The first two
 *     elements are the x/y coordinates of an assignment region, and the
 *     third element is a socket index among all of the (many, many)
 *     sockets in that region.
 */
export function sgap__arp(sgap) {
    let cp = canonical_sgapos(sgap);
    let asg_x = cp[0] / (ASSIGNMENT_REGION_SIDE * ULTRAGRID_SIZE);
    let asg_y = cp[1] / (ASSIGNMENT_REGION_SIDE * ULTRAGRID_SIZE);
    let x = cp[0] % (ASSIGNMENT_REGION_SIDE * ULTRAGRID_SIZE);
    let y = cp[1] % (ASSIGNMENT_REGION_SIDE * ULTRAGRID_SIZE);
    asg_idx = cp[2];
    return [
        asg_x,
        asg_y,
        (x * ASSIGNMENT_REGION_SIDE + y) * ASSIGNMENT_SOCKETS + asg_idx
    ];
}

/**
 * The inverse of sgap__arp, takes an assignment region position (region
 * coordinates and index) and returns the supergrid position of a
 * supertile which includes the given assignment number, along with the
 * socket index within that supertile. The tile returned will be the
 * leftmost/bottommost of the two tiles which are assigned the given
 * assignment index.
 *
 * @param arp A 3-element assignment region position array containing x/y
 *     assignment region coordinates plus an index within that assignment
 *     region.
 *
 * @return A 3-element supergrid assignment position array, containing
 *     x/y supertile coordinates plus a socket index within that
 *     supertile.
 */
export function arp__sgap(arp) {
    let asg_x = arp[0];
    let asg_y = arp[1];
    let asg_number = arp[2];

    let asg_idx = asg_number % ASSIGNMENT_SOCKETS;
    let apg_xy = Math.floor(asg_number / ASSIGNMENT_SOCKETS);
    let y = asg_xy % (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE);
    let x = Math.floor(asg_xy / (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE));

    return [
        asg_x * (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE) + x,
        asg_y * (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE) + y,
        asg_idx
    ];
}

/**
 * Takes an ultratile-local supergrid assignment position (supergrid x/y
 * and socket index) and returns an assignment index within that ultratile.
 * The given assignment position must be within the default ultratile,
 * otherwise this function will return undefined. Non-canonical assignment
 * positions will be converted automatically before the index is computed.
 *
 * @param sgap A 3-element ultratile-local supergrid assignment position
 *    array containing local supertile x/y coordinates plus a socket
 *    index within that supertile.
 *
 * @return An integer assignment (i.e., socket) index within the ultratile.
 */
export function sgap__utai(sgap) {
    // Ensure our position is canonical:
    let socket = sgap[2];
    if (!is_canonical(socket)) {
        sgap = canonical_sgapos(sgap);
    }
    let sg_x = sgap[0];
    let sg_y = sgap[1];
    socket = sgap[2];

    // Check positioning:
    if (!is_valid_utp(sgap)) {
        return undefined;
    }

    return ULTRATILE_ROW_SOCKETS * sg_y + sg_x * ASSIGNMENT_SOCKETS + socket;
}

/**
 * Takes a within-ultratile assignment index and returns the
 * ultratile-relative supergrid coordinates for that socket, along with the
 * socket index in that supertile.
 *
 * @param utai An integer ultratile assignment index.
 *
 * @return A 3-element supergrid assignment position array.
 */
export function utai__sgap(utai) {
    let row = Math.floor(utai / ULTRATILE_ROW_SOCKETS);
    let col = utai % ULTRATILE_ROW_SOCKETS;
    let x = Math.floor(col / ASSIGNMENT_SOCKETS);
    let socket = col % ASSIGNMENT_SOCKETS;

    return [x, row, socket];
}
