// draw.js
// Drawing code for words game.

import * as anarchy from "../anarchy.js";
import * as grid from "./grid.js";
import * as content from "./content.js";
import * as colors from "./colors.js";
import * as active from "./active.js";

/**
 * Loading bar sizes
 */
export var LOADING_BAR_HEIGHT = 20;
export var LOADING_BAR_WIDTH = 120;
export var LOADING_BAR_SPACING = 6;

/**
 * Scaling constants
 */
export var DEFAULT_SCALE = 2.0; 
export var LARGE_SCALE = 3.0;

/**
 * Line widths
 */
export var ULTRA_THIN_LINE = 0.5;
export var VERY_THIN_LINE = 0.8;
export var THINNER_LINE = 1;
export var THIN_LINE = 2;
export var THICK_LINE = 3;
export var VERY_THICK_LINE = 4;

/**
 * Font parameters
 */
export var FONT_OFFSET = 6;
export var FONT_SIZE = 15;
export var FONT_FACE = "asap";
//export var FONT_FACE = "serif";

/**
 * A function for measuring the space taken up by some text (when drawn
 * as a single line).
 *
 * @param ctx A drawing context.
 * @param text The text to measure (a string).
 *
 * @return A TextMetrics object with an additional height attribute.
 *     See: https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics
 *     Relevant attributes include width (in pixels) and our custom
 *     addition of height (in very approximate pixels).
 */
export function measure_text(ctx, text) {
    let m = ctx.measureText(text);
    // This seems to be as good as any of the relevant hacks
    // since we always set fonts in px units. It doesn't include
    // descenders of course.
    m.height = Number.parseFloat(ctx.font);
    // An estimate to accommodate descenders; will generally
    // leave extra space overall...
    // TODO: Better than this!
    m.height *= 1.4;
    return m;
}

/**
 * Interpolates two colors according to the given proportion.
 * Accepts and returns RGB hex strings.
 *
 * @param original The original color as an RGB hex string, used as-is
 *     when the proportion is 0.
 * @param proportion A number between 0 and 1 that controls how the
 *     colors are mixed.
 * @param target The target color as an RGB hex string, used as-is when
 *     the proportion is 1.
 *
 * @return An RGB hex color string that represents a mixture between the
 *     two colors. The interpolation is linear in RGB space, which is not
 *     ideal but which is simple.
 */
export function interp_color(original, proportion, target) {
    var c1 = color_from_hex(original);
    var c2 = color_from_hex(target);
    var r = [
        c1[0] * (1 - proportion) + c2[0] * proportion,
        c1[1] * (1 - proportion) + c2[1] * proportion,
        c1[2] * (1 - proportion) + c2[2] * proportion
    ];
    return hex_from_color(r);
}

/**
 * Converts an RGB hex string to a 3-element RGB integer array color.
 *
 * @param h An RGB hex string that may start with '#' or not, with either
 *     exactly 3 or exactly 6 hex digits.
 *
 * @return A 3-element array containing three integers between 0 and 255
 *     inclusive, representing the red, green, and blue color components
 *     respectively.
 */
export function color_from_hex(h) {
    if (h[0] == "#") {
        h = h.slice(1);
    }
    if (h.length == 3) {
        var r = h.substr(0, 1);
        var g = h.substr(1, 1);
        var b = h.substr(2, 1);
        h = r+r+g+g+b+b;
    }
    return [
        parseInt(h.substr(0, 2), 16),
        parseInt(h.substr(2, 2), 16),
        parseInt(h.substr(4, 2), 16)
    ];
}

/**
 * The inverse of color_from_hex, converts a 3-element RGB integer color
 * array into a 6-digit RGB hex string prefixed with '#'.
 *
 * @param c A 3-element array of RGB integer values each between 0 and
 *     255 inclusive.
 *
 * @return An RGB hex string that starts with '#' and is followed by 6
 *     hexadecimal digits which as pairs indicate the red, green, and
 *     blue values for the given color.
 */
export function hex_from_color(c) {
    var r = ("0" + Math.floor(c[0]).toString(16)).slice(-2);
    var g = ("0" + Math.floor(c[1]).toString(16)).slice(-2);
    var b = ("0" + Math.floor(c[2]).toString(16)).slice(-2);
    return "#" + r + g + b;
}

/**
 * Converts from a view position (in canvas coordinates) to a world
 * position (in world coordinates).
 *
 * @param ctx The canvas context that the view position belongs to.
 * @param vpos A 2-element view position array containing x/y canvas
 *     pixel values measured from the upper-left corner of the canvas.
 *     The y axis increased down the screen, while the x axis increases
 *     to the right.
 *
 * @return A 2-element world position x/y coordinate array.
 */
export function world_pos(ctx, vpos) {
    var result = [vpos[0], vpos[1]];
    result[0] -= ctx.middle[0];
    result[1] -= ctx.middle[1];
    result[1] = -result[1];
    result[0] /= ctx.viewport_scale;
    result[1] /= ctx.viewport_scale;
    result[0] += ctx.viewport_center[0];
    result[1] += ctx.viewport_center[1];
    return result;
}

/**
 * The inverse of world_pos, converts a position in world coordinates to
 * a position in canvas coordinates.
 *
 * @param ctx A canvas context (to determines the viewport).
 * @param wpos A 2-element world coordinate x/y array.
 *
 * @return A 2-element view coordinate x/y array measured from the
 *     upper-left corner of the canvas.
 */
export function view_pos(ctx, wpos) {
    var result = [wpos[0], wpos[1]];
    result[0] -= ctx.viewport_center[0];
    result[1] -= ctx.viewport_center[1];
    result[1] = -result[1];
    result[0] *= ctx.viewport_scale;
    result[1] *= ctx.viewport_scale;
    result[0] += ctx.middle[0];
    result[1] += ctx.middle[1];
    return result;
}

/**
 * Returns viewport edges (left/top/right/bottom) in world
 * coordinates.
 *
 * @param ctx The canvas context (includes the viewport).
 *
 * @return A 4-element array of world-coordinates that specifies the
 *     left, top, right, and bottom edge positions of the current
 *     viewport in that order.
 */
export function viewport_edges(ctx) {
    var tl = world_pos(ctx, [0, 0]);
    var br = world_pos(ctx, [ctx.cwidth, ctx.cheight]);
    return [tl[0], tl[1], br[0], br[1]];
}

/**
 * Takes a grid position and transforms the drawing matrix to
 * prepare for drawing stuff on that tile. In the resulting
 * transformed matrix, the origin is in the center of the target grid
 * tile, and the sides of each equilateral triangle that make up the
 * hexagon for the tile are each 1 unit long, so the tile is 2 units wide
 * and sqrt(3) units tall. ctx.save() should be used beforehand and
 * ctx.restore() afterwards.
 *
 * @param ctx The canvas context to perform transformations in.
 * @param gpos A 2-element hex grid x/y position array.
 *
 * @return Nothing (undefined). The given context's drawing
 * transformation matrix is altered by this function.
 */
export function transform_to_tile(ctx, gpos) {
    let wpos = grid.world_pos(gpos);
    let vpos = view_pos(ctx, wpos);
    ctx.translate(vpos[0], vpos[1]);
    scale_to_viewport(ctx);
}

/**
 * Scales the context according to the current viewport_scale.
 *
 * @param ctx The canvas context to affect.
 *
 * @return Nothing (undefined). The drawing transformation matrix of the
 *     given canvas context is altered by this function.
 */
export function scale_to_viewport(ctx) {
    ctx.scale(ctx.viewport_scale, ctx.viewport_scale);
    // TODO: The inverse?
}

/**
 * Returns the list of tiles visible in the given dimension.
 *
 * @param dimension A dimension object to retrieve tiles from.
 * @param ctx A canvas context (determines the viewport).
 *
 * @return An array of tile objects that overlap the given context's
 *     viewport (see content.list_tiles).
 */
export function visible_tile_list(dimension, ctx) {
    let edges = viewport_edges(ctx);
    return content.list_tiles(dimension, edges);
}

/**
 * Draws tiles from a list for the given context. Returns
 * true if all tiles were drawn, or false if there was at
 * least one undefined tile.
 * TODO: Chunk rendering...
 *
 * @param dimension The dimension to retrieve tiles from.
 * @param ctx The canvas context to use for drawing.
 * @param tiles An array of tile objects to draw.
 *
 * @return True if all tiles were drawn without incident, or false if any
 *     of the tiles had an undefined glyph (normally due to an unloaded
 *     domain or the like).
 */
export function draw_tiles(dimension, ctx, tiles) {
    ctx.textAlign = "center";
    ctx.textBaseline = "top"; // middle leaves room for descenders?
    ctx.font = Math.floor(FONT_SIZE) + "px " + FONT_FACE;

    var any_undefined = false;
    tiles.forEach(function(tile) {
        draw_tile(ctx, tile);
        if (tile["glyph"] == undefined) {
            any_undefined = true;
        }
    });
    /* TODO: Decorations? They're kinda expensive...
    tiles.forEach(function (tile) {
        draw_decorations(ctx, tile);
    });
    */
    return !any_undefined;
}

/**
 * Draws each tile in the given supertile onto the given canvas. Note
 * that the location in which the supertile appears is dependent on the
 * current viewport's world coordinates, and it's entirely possible that
 * some or all of it will fall outside of the canvas and thus not be
 * visible.
 *
 * TODO: Use this for chunk rendering?
 *
 * @param ctx The canvas context to use for drawing.
 * @param supertile A supertile object (see
 *     generate.generate_full_supertile).
 */
export function draw_supertile(ctx, supertile) {
    let base_pos = grid.sgp__gp(supertile.pos);
    for (let x = 0; x < grid.SUPERTILE_SIZE; ++x) {
        for (let y = 0; y < grid.SUPERTILE_SIZE; ++y) {
            if (grid.is_valid_subindex([x, y])) {
                let idx = x + y * grid.SUPERTILE_SIZE;
                let gp = [ base_pos[0] + x, base_pos[1] + y ];
                let tile = {
                    "pos": gp,
                    "colors": supertile.colors[idx],
                    "glyph": supertile.glyphs[idx],
                    "domain": supertile.domains[idx],
                }

                draw_tile(ctx, tile);
            }
        }
    }
}

/**
 * Draws an edge of the given shape with the given center point,
 * radius, and corner radius. Call transform_to_tile first so that things
 * will be drawn in the right place.
 *
 * Note: This function issues path commands on the assumption that the
 * corner is part of a larger path; it does not actually draw anything.
 *
 * @param ctx The drawing context to use for drawing.
 * @param e_shape An integer identifying which edge shape to use.
 * @param side An integer (0-3) specifying which side of the tile to draw
 *     the given edge shape on.
 * @param r A numerical radius value that determines the size of the edge
 *     drawn.
 * @param cr A numerical corner radius value that determines how big edge
 *     corners are.
 */
function define_edge(ctx, e_shape, side, r, cr) {
    ctx.save();
    ctx.rotate((Math.PI / 2) * side);
    var fx = -r + cr;
    var fy = -r;
    var tx = r - cr;
    var ty = -r;
    e_shape = anarchy.posmod(e_shape, 17);
    // Draw the edge
    switch (e_shape) {
        default:
        case 0: // straight line
            ctx.lineTo(tx, ty);
            break;

        case 1: // two-segment outer line
            var mx = fx + (tx - fx) / 2;
            var my = fy + (ty - fy) / 2;

            var px = mx + mx * 0.2;
            var py = my + my * 0.2;

            ctx.lineTo(px, py);
            ctx.lineTo(tx, ty);
            break;

        case 2: // two-segment inner line
            var mx = fx + (tx - fx) / 2;
            var my = fy + (ty - fy) / 2;

            var px = mx - mx * 0.2;
            var py = my - my * 0.2;

            ctx.lineTo(px, py);
            ctx.lineTo(tx, ty);
            break;

        case 3: // four-segment outer zig-zag
            var mx = fx + (tx - fx) / 2;
            var my = fy + (ty - fy) / 2;

            var m1x = fx + (mx - fx) / 2;
            var m1y = fy + (my - fy) / 2;

            var p1x = m1x + mx * 0.1;
            var p1y = m1y + my * 0.1;

            var p2x = mx - mx * 0.1;
            var p2y = my - my * 0.1;

            var m2x = mx + (tx - mx) / 2;
            var m2y = my + (ty - my) / 2;

            var p3x = m2x + mx * 0.1;
            var p3y = m2y + my * 0.1;

            ctx.lineTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.lineTo(p3x, p3y);
            ctx.lineTo(tx, ty);
            break;

        case 4: // four-segment inner zig-zag
            var mx = fx + (tx - fx) / 2;
            var my = fy + (ty - fy) / 2;

            var m1x = fx + (mx - fx) / 2;
            var m1y = fy + (my - fy) / 2;

            var p1x = m1x - mx * 0.1;
            var p1y = m1y - my * 0.1;

            var p2x = mx + mx * 0.1;
            var p2y = my + my * 0.1;

            var m2x = mx + (tx - mx) / 2;
            var m2y = my + (ty - my) / 2;

            var p3x = m2x - mx * 0.1;
            var p3y = m2y - my * 0.1;

            ctx.lineTo(p1x, p1y);
            ctx.lineTo(p2x, p2y);
            ctx.lineTo(p3x, p3y);
            ctx.lineTo(tx, ty);
            break;

        case 5: // curved line
            var angle = (Math.PI / 2) - Math.atan2(r + cr, r - cr);
            var radius = Math.sqrt(
                Math.pow(r + cr, 2)
                + Math.pow(r - cr, 2)
            );

            ctx.arc(
                0,
                cr,
                radius,
                (3 * Math.PI / 2) - angle,
                (3 * Math.PI / 2) + angle
            );
            break;

        case 6: // circular-indented line
            var mx = (fx + tx) / 2;
            var my = (fy + ty) / 2;
            var dist = Math.sqrt(
                Math.pow(tx - fx, 2)
                + Math.pow(ty - fy, 2)
            );
            var ir = 0.14 * dist;
            ctx.lineTo(fx + (tx - fx) * 0.43, fy + (ty - fy) * 0.43);
            ctx.arc(mx, my, ir, Math.PI, 0, true); // ccw
            ctx.lineTo(tx, ty);
            break;

        case 7: // circular-outdented line
            var mx = (fx + tx) / 2;
            var my = (fy + ty) / 2;
            var dist = Math.sqrt(
                Math.pow(tx - fx, 2)
                + Math.pow(ty - fy, 2)
            );
            var ir = 0.2 * dist;
            ctx.lineTo(fx + (tx - fx) * 0.4, fy + (ty - fy) * 0.4);
            ctx.arc(mx, my, ir, Math.PI, 2 * Math.PI); // ccw
            ctx.lineTo(tx, ty);
            break;

        case 8: // line with triangle indent
            var mx = (fx + tx) / 2;
            var my = (fy + ty) / 2;
            var px = mx - mx * 0.15;
            var py = my - my * 0.15;
            var dist = Math.sqrt(
                Math.pow(tx - fx, 2)
                + Math.pow(ty - fy, 2)
            );
            ctx.lineTo(fx + (tx - fx) * 0.3, fy + (ty - fy) * 0.3);
            ctx.lineTo(px, py);
            ctx.lineTo(fx + (tx - fx) * 0.7, fy + (ty - fy) * 0.7);
            ctx.lineTo(tx, ty);
            break;

        case 9: // line with triangle outdent
            var mx = (fx + tx) / 2;
            var my = (fy + ty) / 2;
            var px = mx + mx * 0.15;
            var py = my + my * 0.15;
            var dist = Math.sqrt(
                Math.pow(tx - fx, 2)
                + Math.pow(ty - fy, 2)
            );
            ctx.lineTo(fx + (tx - fx) * 0.3, fy + (ty - fy) * 0.3);
            ctx.lineTo(px, py);
            ctx.lineTo(fx + (tx - fx) * 0.7, fy + (ty - fy) * 0.7);
            ctx.lineTo(tx, ty);
            break;

        case 10: // line with square indent
            // midpoint
            var mx = (fx + tx) / 2;
            var my = (fy + ty) / 2;
            // indent start
            var isx = fx + (tx - fx) * 0.3;
            var isy = fy + (ty - fy) * 0.3;
            // indent end
            var iex = fx + (tx - fx) * 0.7;
            var iey = fy + (ty - fy) * 0.7;

            // points 1 and 2 of indent
            var px1 = isx - mx * 0.2;
            var py1 = isy - my * 0.2;
            var px2 = iex - mx * 0.2;
            var py2 = iey - my * 0.2;
            ctx.lineTo(isx, isy);
            ctx.lineTo(px1, py1);
            ctx.lineTo(px2, py2);
            ctx.lineTo(iex, iey);
            ctx.lineTo(tx, ty);
            break;

        case 11: // line with square outdent
            // midpoint
            var mx = (fx + tx) / 2;
            var my = (fy + ty) / 2;
            // indent start
            var isx = fx + (tx - fx) * 0.3;
            var isy = fy + (ty - fy) * 0.3;
            // indent end
            var iex = fx + (tx - fx) * 0.7;
            var iey = fy + (ty - fy) * 0.7;

            // points 1 and 2 of indent
            var px1 = isx + mx * 0.2;
            var py1 = isy + my * 0.2;
            var px2 = iex + mx * 0.2;
            var py2 = iey + my * 0.2;
            ctx.lineTo(isx, isy);
            ctx.lineTo(px1, py1);
            ctx.lineTo(px2, py2);
            ctx.lineTo(iex, iey);
            ctx.lineTo(tx, ty);
            break;

        case 12: // two bumps
            var idist = r * 0.15;

            var p1x = fx / 2;
            var p1y = -r + idist;

            var p2x = tx / 2;
            var p2y = -r + idist;

            var angle = Math.atan2(idist, fx - p1x) - (Math.PI / 2);

            var radius = Math.sqrt(
                Math.pow(fx - p1x, 2)
                + Math.pow(fy - p1y, 2)
            );

            ctx.arc(
                p1x,
                p1y,
                radius,
                (3 * Math.PI / 2) - angle,
                (3 * Math.PI / 2) + angle
            );
            ctx.arc(
                p2x,
                p2y,
                radius,
                (3 * Math.PI / 2) - angle,
                (3 * Math.PI / 2) + angle
            );
            break;

        case 13: // two round indents
            var idist = r * 0.15;

            var p1x = fx / 2;
            var p1y = -r - idist;

            var p2x = tx / 2;
            var p2y = -r - idist;

            var angle = Math.atan2(idist, fx - p1x) - (Math.PI / 2);

            var radius = Math.sqrt(
                Math.pow(fx - p1x, 2)
                + Math.pow(fy - p1y, 2)
            );

            ctx.arc(
                p1x,
                p1y,
                radius,
                (Math.PI / 2) + angle,
                (Math.PI / 2) - angle,
                true
            );
            ctx.arc(
                p2x,
                p2y,
                radius,
                (Math.PI / 2) + angle,
                (Math.PI / 2) - angle,
                true
            );
            break;

        case 14: // three-curve wave
            var idist = r * 0.15;

            var sixth = (tx - fx) / 6;

            var p1x = fx + sixth;
            var p1y = -r + idist;

            var p2x = 0;
            var p2y = -r - idist;

            var p3x = tx - sixth;
            var p3y = -r + idist;

            var angle = (Math.PI / 2) - Math.atan2(idist, sixth);

            var radius = Math.sqrt(
                Math.pow(sixth, 2)
                + Math.pow(idist, 2)
            );

            ctx.arc(
                p1x,
                p1y,
                radius,
                (3 * Math.PI / 2) - angle,
                (3 * Math.PI / 2) + angle
            );
            ctx.arc(
                p2x,
                p2y,
                radius,
                (Math.PI / 2) + angle,
                (Math.PI / 2) - angle,
                true
            );
            ctx.arc(
                p3x,
                p3y,
                radius,
                (3 * Math.PI / 2) - angle,
                (3 * Math.PI / 2) + angle
            );
            break;

        case 15: // inverted wave
            var idist = r * 0.15;

            var sixth = (tx - fx) / 6;

            var p1x = fx + sixth;
            var p1y = -r - idist;

            var p2x = 0;
            var p2y = -r + idist;

            var p3x = tx - sixth;
            var p3y = -r - idist;

            var angle = (Math.PI / 2) - Math.atan2(idist, sixth);

            var radius = Math.sqrt(
                Math.pow(sixth, 2)
                + Math.pow(idist, 2)
            );

            ctx.arc(
                p1x,
                p1y,
                radius,
                (Math.PI / 2) + angle,
                (Math.PI / 2) - angle,
                true
            );
            ctx.arc(
                p2x,
                p2y,
                radius,
                (3 * Math.PI / 2) - angle,
                (3 * Math.PI / 2) + angle
            );
            ctx.arc(
                p3x,
                p3y,
                radius,
                (Math.PI / 2) + angle,
                (Math.PI / 2) - angle,
                true
            );
            break;

        case 16: // inner trapezoid
            var rad = cr/3;
            ctx.lineTo(fx + rad, -r + rad);
            ctx.lineTo(tx - rad, -r + rad);
            ctx.lineTo(tx, ty);
            break;
    }
    ctx.restore()
}

/**
 * Draws a corner of the given shape at the given points with the given
 * orientation, corner point, radius, and corner radius.
 *
 * Note: This function issues path commands on the assumption that the
 * corner is part of a larger path; it does not actually draw anything.
 *
 * @param ctx The drawing context to use for drawing.
 * @param shape An integer identifying which corner shape to use.
 * @param ori An integer (0-3) specifying which corner of the tile to draw
 *     the given corner shape on (i.e., the orientation of the corner).
 * @param x A numerical x-offset from the current origin to the exact
 *     corner of the shape being drawn.
 * @param y A numerical y-offset from the current origin to the exact
 *     corner of the shape being drawn.
 * @param r A numerical radius value that determines the size of the
 *     corner drawn.
 * @param cr A numerical corner radius value that determines how big
 *     corners are.
 */
function define_corner(ctx, shape, ori, x, y, r, cr) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Math.PI / 2) * ori);
    shape = ((shape % 6) + 6) % 6;
    // Draw the corner
    switch (shape) {
        default:
        case 0: // square corner
            ctx.lineTo(0, 0);
            ctx.lineTo(0, cr);
            break;
        case 1: // arc corner (chopped is too similar)
            var a1 = Math.atan2(r - cr, r) + 3 * Math.PI / 2;
            var a2 = Math.atan2(r, r - cr) + 3 * Math.PI / 2;
            var arc_r = Math.sqrt(
                Math.pow(r, 2)
                + Math.pow(r - cr, 2)
            );
            ctx.arc(-r, r, arc_r, a1, a2);
            break;
        case 2: // rounded corner
            ctx.arc(-cr, cr, cr, 3 * Math.PI / 2, 2 * Math.PI);
            break;
        case 3: // rounded inner corner
            ctx.arc(0, 0, cr, Math.PI, Math.PI / 2, true);
            break;
        case 4: // triangular inner corner
            ctx.lineTo(-cr * 0.8, cr * 0.8);
            ctx.lineTo(0, cr);
            break;
        case 5: // trapezoid outer corner
            ctx.lineTo(-cr/2, -cr/6);
            ctx.lineTo(cr/6, cr/2);
            ctx.lineTo(0, cr);
            break;
    }
    ctx.restore();
}

/**
 * Draws the rim of a hexagonal tile, assuming that transform_to_tile has
 * been called to set up appropriate canvas coordinates.
 *
 * @param ctx The drawing context to use.
 */
function draw_hex_rim(ctx) {
    ctx.strokeStyle = colors.scheme_color("tile", "outline");
    ctx.fillStyle = colors.scheme_color("tile", "inner");

    ctx.lineWidth = THIN_LINE;

    ctx.beginPath();
    once = true;
    grid.VERTICES.forEach(function (vertex) {
        if (once) {
            ctx.moveTo(vertex[0], vertex[1]);
            once = false;
        } else {
            ctx.lineTo(vertex[0], vertex[1]);
        }
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

/**
 * Takes a context, an array of four shape integers, and a radius and
 * draws a pad shape to put a glyph on (assumes that transform_to_tile
 * has been called).
 *
 * @param ctx The drawing context to use.
 * @param shape A 4-element array containing shape integers for the top,
 *     bottom, sides, and corners of the shape to be drawn. These are
 *     passed into the define_edge and define_corner function as the
 *     shape parameters.
 * @param r The radius of the shape, which is 1/2 of the side length of
 *     the square defined by the corner positions.
 */
function draw_pad_shape(ctx, shape, r) {
    ctx.lineWidth = THIN_LINE;
    ctx.beginPath();
    var olj = ctx.lineJoin;
    // ctx.lineJoin = "round";
    // ctx.lineJoin = "mitre";
    var cr = r * 0.4;
    var lt = -r;
    var rt =  r;
    var tp = -r;
    var bt =  r;
    ctx.moveTo(lt + cr, tp);
    define_edge(ctx, shape[0], 0, r, cr);
    define_corner(ctx, shape[3], 0, rt, tp, r, cr);
    define_edge(ctx, shape[2], 1, r, cr);
    define_corner(ctx, shape[3], 1, rt, bt, r, cr);
    define_edge(ctx, shape[1], 2, r, cr);
    define_corner(ctx, shape[3], 2, lt, bt, r, cr);
    define_edge(ctx, shape[2], 3, r, cr);
    define_corner(ctx, shape[3], 3, lt, tp, r, cr);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.lineJoin = olj;
}

/**
 * Draws the given tile on the specified canvas, using the tile's
 * internal position and the canvas viewport to determine where to draw
 * (might not hit the canvas in which case nothing will show up). Note
 * that this function takes care of calling transform_to_tile.
 *
 * @param ctx The drawing context to use; determines the viewport.
 * @param tile The tile object to draw (see content.tile_at).
 */
export function draw_tile(ctx, tile) {
    let gpos = tile["pos"];
    let tcolors = tile["colors"];
    let glyph = tile["glyph"];
    let domain = tile["domain"];

    ctx.save();
    transform_to_tile(ctx, gpos);

    // No matter what goes inside, draw the rim + background:
    draw_hex_rim(ctx);

    // An energy glyph indicating the energy present at this tile
    let energy_glyph = content.active_energy(tile["dimension"], gpos);

    if (glyph == undefined) { // an unloaded tile: just draw a dim '?'
        // The question mark:
        ctx.fillStyle = colors.scheme_color("tile", "pad");
        ctx.fillText('?', 0, -FONT_OFFSET);

    } else if (domain == "__empty__") { // an empty slot
        // Don't draw anything
    } else if (domain == "__active__") { // an active element
        // TODO: Resolve this
        //let energized = content.is_energized(tile["dimension"], gpos);
        let energized = active.has_energy(energy_glyph);

        // Draw the active element:
        draw_active_element(ctx, glyph, energy_glyph, energized);
    } else { // a loaded normal tile: the works
        let unlocked = content.is_unlocked(tile["dimension"], gpos);

        // Hexagon highlight
        ctx.lineWidth = THICK_LINE;
        if (tcolors.length > 0) {
            let side_colors = [];
            if (tcolors.length <= 3 || tcolors.length >= 6) {
                tcolors.forEach(function (c) {
                    side_colors.push(colors.scheme_color("bright", c));
                });
            } else if (tcolors.length == 4) {
                side_colors = [
                    colors.scheme_color("tile", "inner"), // invisible
                    colors.scheme_color("bright", tcolors[0]),
                    colors.scheme_color("bright", tcolors[1]),
                    colors.scheme_color("tile", "inner"), // invisible
                    colors.scheme_color("bright", tcolors[2]),
                    colors.scheme_color("bright", tcolors[3]),
                ];
            } else if (tcolors.length == 5) {
                side_colors = [
                    colors.scheme_color("tile", "inner"), // invisible
                    colors.scheme_color("bright", tcolors[0]),
                    colors.scheme_color("bright", tcolors[1]),
                    colors.scheme_color("bright", tcolors[2]),
                    colors.scheme_color("bright", tcolors[3]),
                    colors.scheme_color("bright", tcolors[4]),
                ];
            } else {
                // Should be impossible
                console.log(
                    "Internal Error: invalid colors length: "
                    + tcolors.length
                );
            }

            for (let i = 0; i < grid.VERTICES.length; ++i) {
                tv = grid.VERTICES[i].slice();
                tv[0] *= 0.9;
                tv[1] *= 0.9;

                let ni = (i + 1) % grid.VERTICES.length;
                nv = grid.VERTICES[ni].slice();
                nv[0] *= 0.9;
                nv[1] *= 0.9;

                ctx.strokeStyle = side_colors[i % side_colors.length];

                ctx.beginPath();
                ctx.moveTo(tv[0], tv[1]);
                ctx.lineTo(nv[0], nv[1]);
                ctx.stroke();
            }
        }

        // Inner circle
        let r = grid.GRID_EDGE * 0.58;
        if (unlocked) {
            ctx.fillStyle = colors.scheme_color("tile", "unlocked-pad");
            ctx.strokeStyle = colors.scheme_color("tile", "unlocked-rim");
        } else if (tile.is_inclusion) {
            ctx.fillStyle = colors.scheme_color("tile", "included-pad");
            ctx.strokeStyle = colors.scheme_color("tile", "included-rim");
        } else {
            ctx.fillStyle = colors.scheme_color("tile", "pad");
            ctx.strokeStyle = colors.scheme_color("tile", "rim");
        }

        draw_pad_shape(ctx, tile.shape, r);

        // Letter
        if (unlocked) {
            ctx.fillStyle = colors.scheme_color("tile", "unlocked-glyph");
        } else {
            ctx.fillStyle = colors.scheme_color("tile", "glyph");
        }
        ctx.fillText(glyph, 0, -FONT_OFFSET);
    }

    ctx.restore();
}

/**
 * Draws decorations on two corners of the tile; the other four will be
 * handled by decorations drawn from neighboring tiles if every tile is
 * decorated.
 *
 * Note: calling this function for every tile drawn can be prohibitively
 * expensive if the decorations are fancy.
 *
 * @param ctx The drawing context to use.
 * @param tile A tile object (see content.tile_at) to decorate.
 */
export function draw_decorations(ctx, tile) {
    let gpos = tile["pos"];
    let glyph = tile["glyph"];
    let domain = tile["domain"];

    let seed = anarchy.prng(anarchy.lfsr(gpos[0]), gpos[1]);
    if (glyph != undefined) {
        seed = anarchy.prng(
            anarchy.hash_string(glyph),
            seed
        );
    }

    let th = grid.GRID_SIZE;
    let tw = grid.GRID_EDGE*2;

    ctx.save();
    transform_to_tile(ctx, gpos);

    /*
     * This is cool but way too expensive:
     let positions = [
    // top edge * 5:
    [-tw/4, -th/2],
    [-tw/8, -th/2],
    [0, -th/2],
    [tw/8, -th/2],
    [tw/4, -th/2],
    // top-right edge * 3:
    [tw/4 + tw/16, -3*th/8],
    [tw/4 + tw/8, -th/4],
    [tw/4 + 3*tw/16, -th/8],

    // bottom-right edge * 3:
    [tw/4 + 3*tw/16, th/8],
    [tw/4 + tw/8, th/4],
    [tw/4 + tw/16, 3*th/8],
    ];
    */
    let positions = [
        // top left and right corners:
        [-tw/4, -th/2],
        [tw/4, -th/2],
    ];

    for (let pos of positions) {
        ctx.save();
        ctx.translate(pos[0], pos[1]);
        draw_decoration(ctx, tile, seed);
        seed = anarchy.lfsr(seed);
        ctx.restore();
    }

     ctx.restore();
}

/**
 * Draws a random decoration object centered at the current position.
 *
 * @param ctx The canvas context.
 * @param tile The tile object to draw a decoration on.
 * @param seed
 */
function draw_decoration(ctx, tile, seed) {
    let gpos = tile["pos"];

    let rng = anarchy.prng(17, seed);

    // TODO: Varieties; regional variation

    // randomly rotated leaves:
    ctx.rotate(2*Math.PI*anarchy.udist(rng));
    rng = anarchy.prng(rng, seed);

    draw_leaf(ctx, rng);
}

/**
 * Draws a little leaf centered at the current position.
 *
 * @param ctx The drawing context to use.
 * @param seed An integer seed that determines exactly what the leaf
 *     looks like.
 */
export function draw_leaf(ctx, seed) {
    // Set up RNG:
    let rng = anarchy.lfsr(seed);

    // Random colors:
    let hvar = Math.PI/4;
    let hmid = 2*Math.PI/3 - hvar/2;
    let h = hmid - hvar + (2*hvar * anarchy.pgdist(rng)); 
    rng = anarchy.prng(rng, seed);
    let s = 0.4 + 0.6 * anarchy.pgdist(rng);
    rng = anarchy.prng(rng, seed);
    let v = 0.7 + 0.3 * anarchy.pgdist(rng);
    rng = anarchy.prng(rng, seed);
    let h2 = h - (hvar/2) + hvar*anarchy.pgdist(rng);
    rng = anarchy.prng(rng, seed);
    let v2 = v * (0.5 + anarchy.udist(0.2));
    rng = anarchy.prng(rng, seed);
    let s2 = s * (0.8 + anarchy.udist(0.2));

    // set stroke & fill colors
    ctx.strokeStyle = colors.RGB__HEX(colors.HSV__RGB([h, s, v]));
    ctx.fillStyle = colors.RGB__HEX(colors.HSV__RGB([h2, s2, v2]));

    // Figure out size:
    let size = grid.GRID_EDGE * (1/3 + (1/6 * anarchy.udist(rng)));
    rng = anarchy.prng(rng, seed);

    // Random arc angle:
    let arc_angle = Math.PI/4 + Math.PI/16 * anarchy.udist(rng);
    rng = anarchy.prng(rng, seed);

    // arc_radius * Math.sin(arc_angle) = size/2
    let arc_radius = (size/2) / Math.sin(arc_angle);
    let arc_offset = arc_radius * Math.cos(arc_angle);

    ctx.lineWidth = ULTRA_THIN_LINE;

    // Edges of the leaf are two symmetric arcs:
    ctx.beginPath();
    ctx.arc(
        0,
        arc_offset,
        arc_radius,
        3*Math.PI/2 - arc_angle,
        3*Math.PI/2 + arc_angle
    );
    ctx.arc(
        0,
        -arc_offset,
        arc_radius,
        Math.PI/2 - arc_angle,
        Math.PI/2 + arc_angle
    );
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    // Stem is a line:
    ctx.beginPath();
    ctx.moveTo(-(size*0.6), 0);
    ctx.lineTo(size*0.5, 0);
    ctx.stroke();

    // Veins are lines:
    let num_veins = anarchy.idist(rng, 3, 6);
    rng = anarchy.prng(rng, seed);
    for (let i = 0; i < num_veins; ++i) {
        // position of base of vein
        let x = -size/2 + size*((i+1)/(num_veins+1));
        // position of end of vein (final x)
        let xf = x + size/(2.2*num_veins);

        // limit to vein final y-pos based on final x pos:

        // x^2 + y^2 = arc_radius^2
        //   where
        // x = xf
        // y = arc_offset + chord-circle distance
        //   so
        // chord-circle distance = sqrt(arc_radius^2 - xf^2) -arc_offset
        let ylim = (
            Math.sqrt(arc_radius*arc_radius - xf*xf)
            - arc_offset
        );

        // y-pos of end of vein (final y)
        let yf = ylim * 0.8;
        ctx.beginPath();
        ctx.moveTo(xf, yf);
        ctx.lineTo(x, 0);
        ctx.lineTo(xf, -yf);
        ctx.stroke();
    }
}

/**
 * Given a drawing context, an active element (type specified
 * by the given glyph), a glyph specifying a combined color,
 * whether it's energized or not, and the viewport position of the
 * element, draws a special symbol for that element, perhaps using a
 * specific color.
 *
 * @param ctx The drawing context to use.
 * @param glyph The active element glyph.
 * @param eglyph
 */
export function draw_active_element(ctx, glyph, eglyph, energized) {
    ctx.fillStyle = active.active_color(glyph, energized);
    ctx.strokeStyle = active.active_color(glyph, energized);

    if (active.is_color(glyph)) {
        draw_energy_symbol(ctx, glyph);
    } else if (active.is_connector(glyph)) {
        draw_connector_symbol(ctx, glyph, eglyph, energized);
    } else {
        ctx.fillText(glyph, 0, -FONT_OFFSET);
    }

    // TODO: More special here?
}

/**
 * Draws a custom symbol for each energy type. Should be called after
 * transform_to_tile has been invoked.
 *
 * @param ctx The canvas context to use.
 * @param glyph The energy glyph that determines the type of energy
 *     symbol to draw.
 */
export function draw_energy_symbol(ctx, glyph) {
    ctx.beginPath();
    let fs = grid.GRID_EDGE * 0.9;
    if (glyph == "红") { // red -> equilateral triangle
        // eqh**2 + (fs/2)**2 = fs**2
        // eqh**2 = fs**2 - (fs/2)**2
        // eqh = sqrt(fs**2 - (fs/2)**2
        let fsq = fs*fs;
        let eqh = Math.sqrt(fsq - fsq/4) // equilateral height
            // crd + egd = eqh
            // egd = eqh - crd
            // crd**2 + (fs/2)**2 = crd**2
            // eqh**2 - 2*eqh*crd + crd**2 + (fs/2)**2 = crd**2
            // eqh**2 + (fs/2)**2 = 2*eqh*crd
            // crd = (eqh + fsq/(4*eqh))/2
            let crd = (eqh + fsq/(4*eqh))/2 // corner distance
            let egd = eqh - crd; // edge distance
        ctx.moveTo(-fs/2, -egd);
        ctx.lineTo(fs/2, -egd);
        ctx.lineTo(0, crd);
        ctx.closePath();
        ctx.stroke();
    } else if (glyph == "黄") { // yellow -> square
        ctx.moveTo(-fs/2, -fs/2);
        ctx.lineTo(-fs/2,  fs/2);
        ctx.lineTo( fs/2,  fs/2);
        ctx.lineTo( fs/2, -fs/2);
        ctx.closePath();
        ctx.stroke();
    } else if (glyph == "蓝") { // blue -> circle
        ctx.arc(0, 0, fs/2, 0, 2*Math.PI);
        ctx.stroke();
    } else if (glyph == "橙") { // orange -> pointed square
        let trheight = Math.sin(Math.PI/3)*fs/4;
        ctx.moveTo(-fs/2           , -fs/2           );
        // top
        ctx.lineTo(-fs/6           , -fs/2           );
        ctx.lineTo( 0              , -fs/2 - trheight);
        ctx.lineTo( fs/6           , -fs/2           );
        ctx.lineTo( fs/2           , -fs/2           );
        // right
        ctx.lineTo( fs/2           , -fs/6           );
        ctx.lineTo( fs/2 + trheight,  0              );
        ctx.lineTo( fs/2           ,  fs/6           );
        ctx.lineTo( fs/2           ,  fs/2           );
        // bottom
        ctx.lineTo( fs/6           ,  fs/2           );
        ctx.lineTo( 0              ,  fs/2 + trheight);
        ctx.lineTo(-fs/6           ,  fs/2           );
        ctx.lineTo(-fs/2           ,  fs/2           );
        // left
        ctx.lineTo(-fs/2           ,  fs/6           );
        ctx.lineTo(-fs/2 - trheight,  0              );
        ctx.lineTo(-fs/2           , -fs/6           );
        ctx.lineTo(-fs/2           , -fs/2           );
        ctx.closePath();
        ctx.stroke();

    } else if (glyph == "绿") { // green -> half-round-cornered square
        ctx.arc(0, 0, fs/2, Math.PI, 3*Math.PI/2);
        ctx.lineTo(fs/2, -fs/2);
        ctx.lineTo(fs/2, 0);
        ctx.arc(0, 0, fs/2, 0, Math.PI/2);
        ctx.lineTo(-fs/2, fs/2);
        ctx.lineTo(-fs/2, 0);
        ctx.closePath();
        ctx.stroke();
    } else if (glyph == "紫") { // purple -> trifang
        // see "红"
        let fsq = fs*fs;
        let eqh = Math.sqrt(fsq - fsq/4) // equilateral height
            let crd = (eqh + fsq/(4*eqh))/2 // corner distance
            let egd = eqh - crd; // edge distance
        ctx.arc(-fs, crd, fs, -Math.PI/3, 0);
        ctx.arc(fs, crd, fs, Math.PI, 4*Math.PI/3);
        ctx.arc(0, -egd - eqh, fs, Math.PI/3, 2*Math.PI/3);
        ctx.closePath();
        ctx.stroke();
    } else if (glyph == "白") { // white -> 90/60/curve
        let θ = Math.PI/3;
        let adj = fs;
        let opp = adj * Math.tan(θ);
        let hyp = adj / Math.cos(θ);
        let cr = fs/3.5;
        let blh = cr*Math.cos(Math.PI/2 - θ);
        let hyp_int_gap = cr + blh;
        let opp_extra = Math.tan(θ) * hyp_int_gap;
        let opp_cutoff = opp_extra + cr*Math.sin(θ/2);

        // Total width/height:
        let w = opp - opp_cutoff + cr;
        let h = adj;

        // rotation of entire figure:
        let rot = -Math.PI/4;
        let offx = fs/8;

        ctx.translate(offx, 0);
        ctx.rotate(rot);
        ctx.moveTo(-w/2, -h/2);
        ctx.lineTo(-w/2 + opp - opp_cutoff, -h/2);
        ctx.arc(
            -w/2 + opp - opp_cutoff,
            -h/2 + cr,
            cr,
            -Math.PI/2,
            θ
        );
        ctx.lineTo(-w/2, h/2);
        ctx.closePath();
        ctx.stroke();
        ctx.rotate(-rot);
        ctx.translate(-offx, 0);
    } else {
        console.log("Unknown color glyph: '" + glyph + "'.");
    }
}

/**
 * Draws three 1/6 circle arcs at 120 degrees from each other.
 *
 * @param ctx The canvas context to use.
 * @param size The diameter of the circle that the arcs are parts of.
 */
function draw_arcs(ctx, size) {
    let pi = Math.PI;
    let between = 2*pi/3;
    let from = pi/2 - pi/6;
    let to = pi/2 + pi/6;
    for (let i = 0; i < 3; ++i) {
        ctx.beginPath();
        ctx.arc(0, 0, size/2, from + i*between, to + i*between);
        ctx.stroke();
    }
}

/**
 * Draws the corners of an equilateral triangle of the given
 * size. The points of the triangle are at 90, 210, and 330
 * degrees. Colors are optional, and if supplied the stroke
 * color will be changed between each corner. The colors are
 * applied starting with the north-facing corner
 * counterclockwise around the triangle.
 *
 * @param ctx The canvas context to use.
 * @param size The side length of the triangle that each corner is a
 *     part of.
 * @param color1 The color to use for the top corner.
 * @param color2 The color to use for the lower-left corner.
 * @param color3 The color to use for the lower-right corner.
 */
function draw_triangle_corners(ctx, size, color1, color2, color3) {
    let ssq = size*size;
    let eqh = Math.sqrt(ssq - ssq/4) // equilateral height
        let crd = (eqh + ssq/(4*eqh))/2 // corner distance
        let egd = eqh - crd; // edge distance
    let broff = size * 0.25; // offset from corner to edge of brace
    let brx = broff * Math.cos(Math.PI/3); // brace line width
    let bry = broff * Math.sin(Math.PI/3); // brace line height

    // top corner
    if (color1) { ctx.strokeStyle = color1; }
    ctx.beginPath();
    ctx.moveTo(-brx, -crd + bry);
    ctx.lineTo(0, -crd);
    ctx.lineTo(brx, -crd + bry);
    ctx.stroke();

    // lower-left corner
    if (color2) { ctx.strokeStyle = color2; }
    ctx.beginPath();
    ctx.moveTo(-size/2 + brx, egd - bry);
    ctx.lineTo(-size/2, egd);
    ctx.lineTo(-size/2 + broff, egd);
    ctx.stroke();

    // lower-right corner
    if (color3) { ctx.strokeStyle = color3; }
    ctx.beginPath();
    ctx.moveTo(size/2 - brx, egd - bry);
    ctx.lineTo(size/2, egd);
    ctx.lineTo(size/2 - broff, egd);
    ctx.stroke();
}

/**
 * Draws the corners of a square of the given size.
 *
 * @param ctx The canvas context to use.
 * @param size The side length of the square.
 */
function draw_square_corners(ctx, size) {
    let broff = size * 0.25; // offset from corner to edge of brace
    // lower-left corner
    ctx.beginPath();
    ctx.moveTo(-size/2, size/2 - broff);
    ctx.lineTo(-size/2, size/2);
    ctx.lineTo(-size/2 + broff, size/2);
    ctx.stroke();

    // lower-right corner
    ctx.beginPath();
    ctx.moveTo(size/2 - broff, size/2);
    ctx.lineTo(size/2, size/2);
    ctx.lineTo(size/2, size/2 - broff);
    ctx.stroke();

    // top right corner
    ctx.beginPath();
    ctx.moveTo(size/2, -size/2 + broff);
    ctx.lineTo(size/2, -size/2);
    ctx.lineTo(size/2 - broff, -size/2);
    ctx.stroke();

    // top left corner
    ctx.beginPath();
    ctx.moveTo(-size/2 + broff, -size/2);
    ctx.lineTo(-size/2, -size/2);
    ctx.lineTo(-size/2, -size/2 + broff);
    ctx.stroke();
}

/**
 * Draws a symbol for a connector glyph.
 *
 * TODO: Use energy colors for connectors other than pocket dimension
 * portals?
 *
 * @param ctx The canvas context to use.
 * @param glyph The glyph specifying the type of connector.
 * @param eglyph An energy glyph representing the energies present.
 * @param energized A boolean specifying whether the connector is
 *     currently energized or not.
 */
export function draw_connector_symbol(ctx, glyph, eglyph, energized) {
    let fs = grid.GRID_EDGE * 0.9;
    ctx.lineWidth = THINNER_LINE;
    if (glyph == "🔗") {
        // a link to another point in this dimension
        // Draw three nested arc pairs.
        draw_arcs(ctx, fs);
        if (energized) {
            ctx.rotate(Math.PI/3);
        } else {
            ctx.rotate(Math.PI/4);
        }
        draw_arcs(ctx, fs*0.6);
        if (energized) {
            ctx.rotate(Math.PI/3);
        } else {
            ctx.rotate(Math.PI/4);
        }
        draw_arcs(ctx, fs*0.3);
    } else if (glyph == "🌀") {
        // Portal to a pocket dimension
        // Draw three triangle corners for three nested rotated
        // (or aligned) triangles
        let elem_color = active.active_color(glyph, energized);

        // Corner colors:
        let c1 = c2 = c3 = elem_color;
        if (active.energy_contains(eglyph, "红")) {
            c1 = active.energy_color("红", energized);
        }
        if (active.energy_contains(eglyph, "黄")) {
            c2 = active.energy_color("黄", energized);
        }
        if (active.energy_contains(eglyph, "蓝")) {
            c3 = active.energy_color("蓝", energized);
        }

        // Outer triangle:
        draw_triangle_corners(ctx, fs, c1, c2, c3);

        // Rotate...
        if (energized) {
            ctx.rotate(Math.PI/3);
        } else {
            ctx.rotate(Math.PI/4);
        }

        //Secondary colors:
        c1 = c2 = c3 = elem_color;
        if (active.energy_contains(eglyph, "紫")) {
            c1 = active.energy_color("紫", energized);
        }
        if (active.energy_contains(eglyph, "橙")) {
            c2 = active.energy_color("橙", energized);
        }
        if (active.energy_contains(eglyph, "绿")) {
            c3 = active.energy_color("绿", energized);
        }

        // Inner triangle
        draw_triangle_corners(ctx, fs*0.6, c1, c2, c3);

        // Rotate...
        if (energized) {
            ctx.rotate(Math.PI/3);
        } else {
            ctx.rotate(Math.PI/4);
        }

        // Innermost triangle
        draw_triangle_corners(ctx, fs*0.3, elem_color);

    } else if (glyph == "🚪") {
        // Portal to another dimension
        // Draw four corners for three nested rotated (or
        // aligned) squares.
        draw_square_corners(ctx, fs);
        if (energized) {
            ctx.rotate(Math.PI/4);
        } else {
            ctx.rotate(Math.PI/6);
        }
        draw_square_corners(ctx, fs*0.6);
        if (energized) {
            ctx.rotate(Math.PI/4);
        } else {
            ctx.rotate(Math.PI/6);
        }
        draw_square_corners(ctx, fs*0.3);
    } else {
        console.log("Unknown connector glyph: '" + glyph + "'.");
        console.log(active.is_connector(glyph));
        console.log(glyph.charCodeAt(0));
    }
    ctx.stroke();
}

/**
 * Highlights the player's unlocked words by drawing trace lines
 * through them.
 *
 * @param dimension The dimension to draw unlocked words from.
 * @param ctx The canvas context to use.
 */
export function trace_unlocked(dimension, ctx) {
    let entries = content.unlocked_entries(dimension);
    for (let entry of entries) {
        // Highlight each swipe using a neutral color:
        draw_swipe(
            ctx,
            entry.path,
            "line",
            colors.scheme_color("ui", "trail")
        );
    }
}

/**
 * Draws energy borders for energized tiles.
 *
 * @param dimension The dimension to draw energized tiles from.
 * @param ctx The canvas context to use.
 * @param tile_list An array of tile objects limiting locations at which
 *     energy borders will be drawn.
 */
export function draw_energies(dimension, ctx, tile_list) {
    for (let tile of tile_list) {
        let gpos = tile["pos"];
        let energy_glyph = content.active_energy(dimension, gpos);

        // Override content result with energy of the tile itself if it's
        // an energy source:
        if (
            tile["domain"] == "__active__"
            && active.is_energy(tile["glyph"])
        ) {
            energy_glyph = tile["glyph"];
        }

        // Actually draw the highlight only if it's really energized
        if (active.has_energy(energy_glyph)) {
            draw_energy_highlight(ctx, gpos, energy_glyph);
        }
    }
}

/**
 * Takes a context and a grid position and highlights that
 * hex as a poke. Also needs to know the current and max # of
 * ticks of the poke.
 *
 * @param ctx The canvas context to use.
 * @param poke A 3-element poke entry containing a dimension object, a
 *     2-element tile grid x/y coordinate array indicating the position
 *     of the poke, and a time number indicating when the poke was
 *     initiated.
 * @param ticks The number of ticks elapsed since the poke was initiated.
 * @param max_ticks The number of ticks required for the poke to be
 *     completed.
 */
export function draw_poke(ctx, poke, ticks, max_ticks) {
    let gp = poke[1];
    draw_ticks(
        ctx,
        gp,
        ticks,
        max_ticks,
        colors.scheme_color("ui", "poke")
    );
    draw_highlight(ctx, gp, colors.scheme_color("ui", "poke"));
}

/**
 * Highlights the path of a swipe using one of several different methods.
 *
 * @param ctx The canvas context to use.
 * @param gplist An array of 2-element tile coordinate x/y arrays which
 *     defines the path of a swipe.
 * @param method A drawing method (one of "trail", "highlight", or
 *     "line").
 * @param color (optional) A color to use for the swipe highlight instead
 *     of the default UI color.
 */
export function draw_swipe(ctx, gplist, method, color) {
    if (gplist.length == 0) {
        return;
    }
    if (method == undefined) {
        method = "trail";
    }

    // Highlight hexes:
    let hc = color || colors.scheme_color("ui", "trail");
    for (let i = 0; i < gplist.length - 1; ++i) {
        draw_highlight(ctx, gplist[i], hc);
    }
    if (method == "highlight") {
        let lhc = color || colors.scheme_color("ui", "highlight");
        draw_highlight(ctx, gplist[gplist.length-1], lhc);
    } else {
        let lhc = color || colors.scheme_color("ui", "trail");
        draw_highlight(ctx, gplist[gplist.length-1], lhc);
    }

    // Draw line:
    if (
        (method == "highlight" || method == "line")
        && gplist.length > 1
    ) {

        ctx.strokeStyle = color || colors.scheme_color("ui", "trail");
        ctx.fillStyle = ctx.strokeStyle;
        if (method == "line") {
            ctx.lineWidth = THICK_LINE * ctx.viewport_scale;
        } else {
            ctx.lineWidth = THIN_LINE * ctx.viewport_scale;
        }
        // dots at ends:
        ctx.save();
        transform_to_tile(ctx, gplist[0]);
        ctx.beginPath();
        ctx.arc(0, 0, VERY_THICK_LINE, 0, 2*Math.PI);
        ctx.fill();
        ctx.restore();

        ctx.save();
        transform_to_tile(ctx, gplist[gplist.length - 1]);
        ctx.beginPath();
        ctx.arc(0, 0, VERY_THICK_LINE, 0, 2*Math.PI);
        ctx.fill();
        ctx.restore();

        // curves along the path (without using transform_to_tile):
        ctx.beginPath();
        let vpos = view_pos(ctx, grid.world_pos(gplist[0]));
        ctx.moveTo(vpos[0], vpos[1]);
        let nvpos = view_pos(ctx, grid.world_pos(gplist[1]));
        ctx.lineTo((vpos[0] + nvpos[0])/2, (vpos[1] + nvpos[1])/2);
        for (let i = 1; i < gplist.length - 1; ++i) {
            let vcp = view_pos(ctx, grid.world_pos(gplist[i]));
            let vncp = view_pos(ctx, grid.world_pos(gplist[i+1]));
            ctx.quadraticCurveTo(
                vcp[0],
                vcp[1],
                (vcp[0] + vncp[0])/2,
                (vcp[1] + vncp[1])/2
            );
        }
        // line to the last point:
        wpos = grid.world_pos(gplist[gplist.length - 1]);
        vpos = view_pos(ctx, wpos);
        ctx.lineTo(vpos[0], vpos[1]);
        ctx.stroke();
    }
}

/**
 * Highlights a single grid cell.
 *
 * @param ctx The canvas context to use.
 * @param gpos A 2-element tile grid x/y coordinate array.
 * @param color A valid canvas color, such as an RGB hex string.
 */
export function draw_highlight(ctx, gpos, color) {
    ctx.save();
    transform_to_tile(ctx, gpos);

    ctx.lineWidth = THIN_LINE;

    // Outer hexagon
    ctx.strokeStyle = color;

    ctx.beginPath();
    once = true;
    grid.VERTICES.forEach(function (vertex) {
        // copy the vertex
        vertex = vertex.slice();

        // bring things in just a touch
        vertex[0] *= 0.95;
        vertex[1] *= 0.95;

        // compute view position and draw a line
        if (once) {
            ctx.moveTo(vertex[0], vertex[1]);
            once = false;
        } else {
            ctx.lineTo(vertex[0], vertex[1]);
        }
    });
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
}

/**
 * Highlights a grid cell using the shape and color appropriate to the
 * energies that are active at that cell (as specified by the eglyph
 * argument).
 *
 * @param ctx The canvas context to use.
 * @param gpos A 2-element x/y global tile coordinate array.
 * @param eglyph The energy glyph that determines the appearance of the
 *     highlight.
 */
export function draw_energy_highlight(ctx, gpos, eglyph) {
    ctx.save();
    transform_to_tile(ctx, gpos);

    ctx.lineWidth = THIN_LINE;

    // Outer hexagon
    ctx.strokeStyle = active.energy_color(eglyph, true);

    ctx.beginPath();
    once = true;
    for (let vertex of grid.VERTICES) {
        // copy the vertex
        vertex = vertex.slice();

        // bring things in just a touch
        vertex[0] *= 0.95;
        vertex[1] *= 0.95;

        if (once) {
            ctx.moveTo(vertex[0], vertex[1]);
            once = false;
        } else {
            ctx.lineTo(vertex[0], vertex[1]);
        }
    }
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
}

/**
 * Draws a countdown graphic in a grid cell.
 *
 * @param ctx The canvas context to use.
 * @param gpos A 2-element tile grid x/y coordinate array.
 * @param ticks How many ticks have already elapsed (may be fractional).
 * @param max_ticks How many ticks are required for completion.
 * @param color The color to use for the graphic.
 */
export function draw_ticks(ctx, gpos, ticks, max_ticks, color) {
    ctx.save();
    transform_to_tile(ctx, gpos);

    ctx.lineWidth = VERY_THICK_LINE;

    // Outer hexagon
    ctx.strokeStyle = color;

    let angle = 2 * Math.PI * (1 - (ticks / max_ticks));

    ctx.beginPath();
    ctx.arc(
        0,
        0,
        grid.GRID_EDGE * 0.7,
        -Math.PI/2,
        -Math.PI/2 + angle
    );
    ctx.stroke();
    ctx.restore();
}

/**
 * Draws loading bars at the center-left of the canvas.
 *
 * @param ctx The canvas context to use.
 * @param keys An array holding the string keys of the loading object;
 *     used to control the order in which things are drawn.
 * @param loading A loading object where the keys are strings indicating
 *     what is being loaded and the values are 3-element arrays
 *     containing a boolean indicating whether the HTTP request has been
 *     completed, and two progress numbers between 0 and 1 indicating
 *     the progress of the glyph-counting and index-building processes.
 *     (see dict.LOADING).
 */
export function draw_loading(ctx, keys, loading) {
    let n_bars = keys.length;
    let bars_top = (
        ctx.cheight/2
        - (n_bars * (LOADING_BAR_HEIGHT + LOADING_BAR_SPACING))
        + LOADING_BAR_SPACING
    );
    keys.forEach(function (key, ii) {
        // Unpack progress:
        let progress = loading[key];
        let fetched = progress[0];
        let count_progress = progress[1];
        let index_progress = progress[2];

        // Decide position:
        let x = 10;
        let y = (
            bars_top
            + ii * (LOADING_BAR_HEIGHT + LOADING_BAR_SPACING)
        );

        ctx.fillStyle = colors.scheme_color("loading", "inner");
        ctx.fillRect(x, y, LOADING_BAR_WIDTH, LOADING_BAR_HEIGHT);
        if (fetched) {
            ctx.strokeStyle = colors.scheme_color("loading", "outline");
        } else {
            ctx.strokeStyle = colors.scheme_color("loading", "pre_outline");
        }
        ctx.strokeRect(x, y, LOADING_BAR_WIDTH, LOADING_BAR_HEIGHT);
        ctx.fillStyle = colors.scheme_color("loading", "index");
        ctx.fillRect(
            x + 2,
            y + 2,
            (LOADING_BAR_WIDTH - 4) * index_progress,
            (LOADING_BAR_HEIGHT - 5) / 2
        );
        ctx.fillStyle = colors.scheme_color("loading", "counts");
        ctx.fillRect(
            x + 2,
            y + 2 + (LOADING_BAR_HEIGHT - 5) / 2 + 1,
            (LOADING_BAR_WIDTH - 4) * count_progress,
            (LOADING_BAR_HEIGHT - 5) / 2
        );
        txt = key
            let m = ctx.measureText(txt);
        while (m.width >= LOADING_BAR_WIDTH - 4) {
            txt = txt.slice(0, txt.length-2) + "…";
            m = ctx.measureText(txt);
        }
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.font = (
            ((LOADING_BAR_HEIGHT - 4) * ctx.viewport_scale) + "px "
            + "asap"
        );
        ctx.fillStyle = colors.scheme_color("loading", "text");
        ctx.fillText(txt, x+2, y+2);
    });
}
