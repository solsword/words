// draw.js
// Drawing code for words game.

define(
    ["anarchy", "./grid", "./content", "./colors", "./objects"],
    function(anarchy, grid, content, colors, objects) {

        // Loading bar sizes
        var LOADING_BAR_HEIGHT = 20;
        var LOADING_BAR_WIDTH = 120;
        var LOADING_BAR_SPACING = 6;

        // Scaling constants
        var DEFAULT_SCALE = 2.0; 
        var LARGE_SCALE = 3.0;

        // Line widths
        var ULTRA_THIN_LINE = 0.5;
        var VERY_THIN_LINE = 0.8;
        var THINNER_LINE = 1;
        var THIN_LINE = 2;
        var THICK_LINE = 3;
        var VERY_THICK_LINE = 4;

        // Font parameters
        var FONT_OFFSET = 6;
        var FONT_SIZE = 15;
        var FONT_FACE = "asap";
        //var FONT_FACE = "serif";

        var CONTEXT_BOX = {
            "left": 20,
            "right": 20,
            "bottom": 20,
            "height": 40,
            "padding": 8,
        }

        function measure_text(ctx, text) {
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

        function interp_color(original, proportion, target) {
            // Interpolates two colors according to the given proportion.
            // Accepts and returns RGB hex strings.
            var c1 = color_from_hex(original);
            var c2 = color_from_hex(target);
            var r = [
                c1[0] * (1 - proportion) + c2[0] * proportion,
                c1[1] * (1 - proportion) + c2[1] * proportion,
                c1[2] * (1 - proportion) + c2[2] * proportion
            ];
            return hex_from_color(r);
        }

        function color_from_hex(h) {
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

        function hex_from_color(c) {
            var r = ("0" + Math.floor(c[0]).toString(16)).slice(-2);
            var g = ("0" + Math.floor(c[1]).toString(16)).slice(-2);
            var b = ("0" + Math.floor(c[2]).toString(16)).slice(-2);
            return "#" + r + g + b;
        }

        function world_pos(ctx, vpos) {
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

        function view_pos(ctx, wpos) {
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

        function viewport_edges(ctx) {
            // Returns viewport edges (left/top/right/bottom) in world
            // coordinates.
            var tl = world_pos(ctx, [0, 0]);
            var br = world_pos(ctx, [ctx.cwidth, ctx.cheight]);
            return [tl[0], tl[1], br[0], br[1]];
        }

        function transform_to_tile(ctx, gpos) {
            // Takes a grid position and transforms the drawing matrix to
            // prepare for drawing stuff on that tile. In the resulting
            // transformed matrix, the sides of each equilateral triangle
            // that make up the hexagon for the tile are each 1 unit
            // long, so the tile is 2 units wide and sqrt(3) units tall.
            // ctx.save() should be used beforehand and ctx.restore()
            // afterwards.
            let wpos = grid.world_pos(gpos);
            let vpos = view_pos(ctx, wpos);
            ctx.translate(vpos[0], vpos[1]);
            scale_to_viewport(ctx);
        }

        function scale_to_viewport(ctx) {
            // Scales the context according to the current
            // viewport_scale.
            ctx.scale(ctx.viewport_scale, ctx.viewport_scale);
            // TODO: The inverse?
        }

        function visible_tile_list(dimension, ctx) {
            // Returns the list of tiles visible in the given dimension.
            let edges = viewport_edges(ctx);
            return content.list_tiles(dimension, edges);
        }

        function draw_tiles(dimension, ctx, tiles) {
            // Draws tiles from a list for the given context. Returns
            // true if all tiles were drawn, or false if there was at
            // least one undefined tile.
            // TODO: Chunk rendering...
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
            /* TODO: Decorations?
               tiles.forEach(function (tile) {
               draw_decorations(ctx, tile);
               });
               */
            return !any_undefined;
        }

        function draw_supertile(ctx, sgp, supertile) {
            let base_pos = grid.gpos(sgp);
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

        // Draws an edge of the given shape with the given center point,
        // radius, and corner radius.
        function draw_edge(ctx, e_shape, side, r, cr) {
            ctx.save()
                ctx.rotate((Math.PI / 2) * side);
            var fx = -r + cr;
            var fy = -r;
            var tx = r - cr;
            var ty = -r;
            e_shape = ((e_shape % 17) + 17) % 17;
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

        // Draws a corner of the given shape at the given points with the given
        // orientation, corner point, radius, and corner radius.
        function draw_corner(ctx, shape, ori, x, y, r, cr) {
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

        function draw_hex_rim(ctx) {
            ctx.strokeStyle = colors.tile_color("outline");
            ctx.fillStyle = colors.tile_color("inner");

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

        // Takes a context, an array of four shape integers, and a radius
        // and draws a pad shape to put a glyph on (assumes that
        // transform_to_tile has been called). Stroking and/or filling
        // this shape is up to the caller.
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
            draw_edge(ctx, shape[0], 0, r, cr);
            draw_corner(ctx, shape[3], 0, rt, tp, r, cr);
            draw_edge(ctx, shape[2], 1, r, cr);
            draw_corner(ctx, shape[3], 1, rt, bt, r, cr);
            draw_edge(ctx, shape[1], 2, r, cr);
            draw_corner(ctx, shape[3], 2, lt, bt, r, cr);
            draw_edge(ctx, shape[2], 3, r, cr);
            draw_corner(ctx, shape[3], 3, lt, tp, r, cr);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.lineJoin = olj;
        }

        function draw_tile(ctx, tile) {
            let gpos = tile["pos"];
            let tcolors = tile["colors"];
            let glyph = tile["glyph"];
            let domain = tile["domain"];

            ctx.save();
            transform_to_tile(ctx, gpos);

            // No matter what goes inside, draw the rim + background:
            draw_hex_rim(ctx);

            // A color glyph indicating the color attached to this object
            let color_glyph = content.active_color(tile["dimension"], gpos);

            if (glyph == undefined) { // an unloaded tile: just draw a dim '?'
                // The question mark:
                ctx.fillStyle = colors.tile_color("pad");
                ctx.fillText('?', 0, -FONT_OFFSET);

            } else if (domain == "__empty__") { // an empty slot
                // Don't draw anything
            } else if (domain == "__object__") { // an active object
                // TODO: Resolve this
                //let energized = content.is_energized(tile["dimension"], gpos);
                let energized = objects.has_hue(color_glyph);

                // Draw the object:
                draw_object(ctx, glyph, color_glyph, energized);
            } else { // a loaded normal tile: the works
                let unlocked = content.is_unlocked(tile["dimension"], gpos);

                // Hexagon highlight
                ctx.lineWidth = THICK_LINE;
                if (tcolors.length > 0) {
                    let side_colors = [];
                    if (tcolors.length <= 3 || tcolors.length >= 6) {
                        tcolors.forEach(function (c) {
                            side_colors.push(colors.bright_color(c));
                        });
                    } else if (tcolors.length == 4) {
                        side_colors = [
                            colors.tile_color("inner"), // invisible
                            colors.bright_color(tcolors[0]),
                            colors.bright_color(tcolors[1]),
                            colors.tile_color("inner"), // invisible
                            colors.bright_color(tcolors[2]),
                            colors.bright_color(tcolors[3]),
                        ];
                    } else if (tcolors.length == 5) {
                        side_colors = [
                            colors.tile_color("inner"), // invisible
                            colors.bright_color(tcolors[0]),
                            colors.bright_color(tcolors[1]),
                            colors.bright_color(tcolors[2]),
                            colors.bright_color(tcolors[3]),
                            colors.bright_color(tcolors[4]),
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
                    ctx.fillStyle = colors.tile_color("unlocked-pad");
                    ctx.strokeStyle = colors.tile_color("unlocked-rim");
                } else if (tile.is_inclusion) {
                    ctx.fillStyle = colors.tile_color("included-pad");
                    ctx.strokeStyle = colors.tile_color("included-rim");
                } else {
                    ctx.fillStyle = colors.tile_color("pad");
                    ctx.strokeStyle = colors.tile_color("rim");
                }

                draw_pad_shape(ctx, tile.shape, r);

                // Letter
                if (unlocked) {
                    ctx.fillStyle = colors.tile_color("unlocked-glyph");
                } else {
                    ctx.fillStyle = colors.tile_color("glyph");
                }
                ctx.fillText(glyph, 0, -FONT_OFFSET);
            }

            ctx.restore();
        }

        function draw_decorations(ctx, tile) {
            // Draws decorations on two corners of the tile; other four will be
            // handled by decorations drawn from neighboring tiles.
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
                    // TODO: Remove this? It's too expensive!
                    //draw_decoration(ctx, tile, seed);
                    seed = anarchy.lfsr(seed);
                    ctx.restore();
                }

                ctx.restore();
        }

        function draw_decoration(ctx, tile, seed) {
            // Draws a random decoration object.
            let gpos = tile["pos"];

            let rng = anarchy.prng(17, seed);

            // TODO: Varieties; regional variation

            // randomly rotated leaves:
            ctx.rotate(2*Math.PI*anarchy.udist(rng))
                rng = anarchy.prng(rng, seed);

            draw_leaf(ctx, rng);
        }

        function draw_leaf(ctx, seed) {
            // Draws a little leaf.

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

        function draw_object(ctx, glyph, cglyph, energized) {
            // Given a drawing context, an object (type specified by the
            // given glyph), a glyph specifying a combined color, and
            // whether it's energized or not, and the viewport position
            // of the object, draws a special symbol for that object,
            // perhaps using a specific color.

            ctx.fillStyle = objects.object_color(glyph, energized);
            ctx.strokeStyle = objects.object_color(glyph, energized);

            if (objects.is_color(glyph)) {
                draw_color_symbol(ctx, glyph);
            } else if (objects.is_connector(glyph)) {
                draw_connector_symbol(ctx, glyph, cglyph, energized);
            } else {
                ctx.fillText(glyph, 0, -FONT_OFFSET);
            }

            // TODO: More special here?
        }

        function draw_color_symbol(ctx, glyph) {
            // Draws a custom symbol for each color type
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

        function draw_arcs(ctx, size) {
            // Draws three 1/6 circle arcs at 120 degrees from each other.
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

        function draw_triangle_corners(ctx, size, color1, color2, color3) {
            // Draws the corners of an equilateral triangle of the given
            // size. The points of the triangle are at 90, 210, and 330
            // degrees. Colors are optional, and if supplied the stroke
            // color will be changed between each corner. The colors are
            // applied starting with the north-facing corner
            // counterclockwise around the triangle.
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

        function draw_square_corners(ctx, size) {
            // Draws the corners of a square of the given size.
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

        function draw_connector_symbol(ctx, glyph, cglyph, energized) {
            // Draws a symbol for a connector glyph.
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
                let obj_color = objects.object_color(glyph, energized);

                // Corner colors:
                let c1 = c2 = c3 = obj_color;
                if (objects.color_contains(cglyph, "红")) {
                    c1 = objects.color_color("红", energized);
                }
                if (objects.color_contains(cglyph, "黄")) {
                    c2 = objects.color_color("黄", energized);
                }
                if (objects.color_contains(cglyph, "蓝")) {
                    c3 = objects.color_color("蓝", energized);
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
                c1 = c2 = c3 = obj_color;
                if (objects.color_contains(cglyph, "紫")) {
                    c1 = objects.color_color("紫", energized);
                }
                if (objects.color_contains(cglyph, "橙")) {
                    c2 = objects.color_color("橙", energized);
                }
                if (objects.color_contains(cglyph, "绿")) {
                    c3 = objects.color_color("绿", energized);
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
                draw_triangle_corners(ctx, fs*0.3, obj_color);

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
                console.log(objects.is_connector(glyph));
                console.log(glyph.charCodeAt(0));
            }
            ctx.stroke();
        }

        function trace_unlocked(dimension, ctx) {
            // Highlights the player's unlocked words by drawing trace lines
            // through them.
            let entries = content.unlocked_entries(dimension);
            for (let entry of entries) {
                // Highlight each swipe using a neutral color:
                draw_swipe(ctx, entry.path, "line", colors.ui_color("trail"));
            }
        }

        function draw_colors(dimension, ctx, tile_list) {
            // Draws color borders for places where colors appear.
            for (let tile of tile_list) {
                let gpos = tile["pos"];
                let color_glyph = content.active_color(dimension, gpos);
                if (
                    tile["domain"] == "__object__"
                    && objects.is_color(tile["glyph"])
                ) {
                    color_glyph = tile["glyph"];
                }
                if (objects.has_hue(color_glyph)) {
                    draw_color_highlight(ctx, gpos, color_glyph);
                }
            }
        }

        function draw_poke(ctx, poke, ticks, max_ticks) {
            // Takes a context and a grid position and highlights that
            // hex as a poke. Also needs to know the current and max # of
            // ticks of the poke.
            let gp = poke[1];
            draw_ticks(ctx, gp, ticks, max_ticks, colors.ui_color("poke"));
            draw_highlight(ctx, gp, colors.ui_color("poke"));
        }

        function draw_swipe(ctx, gplist, method, color) {
            // Takes a context, a list of grid positions defining the
            // current swipe, and a drawing method ("trail", "highlight",
            // or "line"), and draws the swipe. A color may be specified
            // which will override the UI default color for swipes.
            if (gplist.length == 0) {
                return;
            }
            if (method == undefined) {
                method = "trail";
            }

            // Highlight hexes:
            let hc = color || colors.ui_color("trail");
            for (let i = 0; i < gplist.length - 1; ++i) {
                draw_highlight(ctx, gplist[i], hc);
            }
            if (method == "highlight") {
                let lhc = color || colors.ui_color("highlight");
                draw_highlight(ctx, gplist[gplist.length-1], lhc);
            } else {
                let lhc = color || colors.ui_color("trail");
                draw_highlight(ctx, gplist[gplist.length-1], lhc);
            }

            // Draw line:
            if (
                (method == "highlight" || method == "line")
                && gplist.length > 1
            ) {

                ctx.strokeStyle = color || colors.ui_color("trail");
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

        function draw_highlight(ctx, gpos, color) {
            // Takes a context, a grid position, and a color, and
            // highlights that grid cell using that color.
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

        function draw_color_highlight(ctx, gpos, cglyph) {
            // Takes a context, a position, and a color glyph, and highlights
            // that grid cell using the appropriate shape and color.
            ctx.save();
            transform_to_tile(ctx, gpos);

            ctx.lineWidth = THIN_LINE;

            // Outer hexagon
            ctx.strokeStyle = objects.color_color(cglyph, true);

            ctx.beginPath();
            once = true;
            grid.VERTICES.forEach(function (vertex) {
                // copy the vertex
                vertex = vertex.slice();

                // bring things in just a touch
                vertex[0] *= 0.95;
                vertex[1] *= 0.95;

                /*
                // offset to our current world position
                vertex[0] += wpos[0];
                vertex[1] += wpos[1];

                // compute view position and draw a line
                let vv = view_pos(ctx, vertex);
                */
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

        function draw_ticks(ctx, gpos, ticks, max_ticks, color) {
            // Takes a context, a grid position, counts of current & max
            // ticks, and a color, and draws a countdown in that grid
            // cell using that color.
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

        function draw_loading(ctx, keys, loading) {
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

                ctx.fillStyle = colors.loading_color("inner");
                ctx.fillRect(x, y, LOADING_BAR_WIDTH, LOADING_BAR_HEIGHT);
                if (fetched) {
                    ctx.strokeStyle = colors.loading_color("outline");
                } else {
                    ctx.strokeStyle = colors.loading_color("pre_outline");
                }
                ctx.strokeRect(x, y, LOADING_BAR_WIDTH, LOADING_BAR_HEIGHT);
                ctx.fillStyle = colors.loading_color("index");
                ctx.fillRect(
                    x + 2,
                    y + 2,
                    (LOADING_BAR_WIDTH - 4) * index_progress,
                    (LOADING_BAR_HEIGHT - 5) / 2
                );
                ctx.fillStyle = colors.loading_color("counts");
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
                ctx.fillStyle = colors.loading_color("text");
                ctx.fillText(txt, x+2, y+2);
            });
        }

        return {
            "FONT_FACE": FONT_FACE,
            "FONT_SIZE": FONT_SIZE,
            "DEFAULT_SCALE": DEFAULT_SCALE,
            "LARGE_SCALE": LARGE_SCALE,
            "measure_text": measure_text,
            "interp_color": interp_color,
            "visible_tile_list": visible_tile_list,
            "draw_tiles": draw_tiles,
            "draw_supertile": draw_supertile,
            "view_pos": view_pos,
            "world_pos": world_pos,
            "trace_unlocked": trace_unlocked,
            "draw_colors": draw_colors,
            "draw_poke": draw_poke,
            "draw_swipe": draw_swipe,
            "draw_loading": draw_loading,
        };
    }
);
