// draw.js
// Drawing code for words game.

define(
  ["./grid", "./content"],
  function(grid, content) {

  var HIGHLIGHT_COLOR = "#fff";
  var TRAIL_COLOR = "#ddd";

  var LOADING_BAR_HEIGHT = 20;
  var LOADING_BAR_WIDTH = 120;
  var LOADING_BAR_SPACING = 6;

  var FONT_SIZE = 24;
  var FONT_FACE = "asap";
  //var FONT_FACE = "serif";

  var TILE_COLORS = {
           "outline": "#555",
             "inner": "#333",
               "rim": "#555",
               "pad": "#444",
             "glyph": "#bbb",
      "unlocked-pad": "#777",
      "unlocked-rim": "#eee",
    "unlocked-glyph": "#fff",
      "included-pad": "#555",
      "included-rim": "#777",
  };

  var LOADING_COLORS = {
   "deactive": "#999",
    "outline": "#999",
      "inner": "#333",
     "counts": "#777",
      "index": "#999",
       "text": "#fff"
  };

  var PALETTE = {
    "gr": "#888",
    "bl": "#8bf",
    "lb": "#bef",
    "rd": "#f66",
    "yl": "#ff2",
    "gn": "#6f6",
    "lg": "#af7",
  };

  var BG_PALETTE = {
    "gr": "#444",
    "bl": "#224",
    "lb": "#335",
    "rd": "#422",
    "yl": "#442",
    "gn": "#242",
    "lg": "#353",
  }

  var CONTEXT_BOX = {
    "left": 20,
    "right": 20,
    "bottom": 20,
    "height": 40,
    "padding": 8,
  }

  function interp_color(original, proportion, target) {
    // Interpolates two colors according to the given proportion. Accepts and
    // returns RGB hex strings.
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
    // Returns viewport edges (left/top/right/bottom) in world coordinates.
    var tl = world_pos(ctx, [0, 0]);
    var br = world_pos(ctx, [ctx.cwidth, ctx.cheight]);
    return [tl[0], tl[1], br[0], br[1]];
  }

  function draw_tiles(dimension, ctx) {
    // Draws tiles for the given context. Returns true if all tiles were drawn,
    // or false if there was at least one undefined tile.
    // TODO: Chunk rendering...
    edges = viewport_edges(ctx);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = Math.floor(FONT_SIZE * ctx.viewport_scale) + "px " + FONT_FACE;

    tiles = content.list_tiles(dimension, edges);
    var any_undefined = false;
    tiles.forEach(function(tile) {
      draw_tile(ctx, tile);
      if (tile["glyph"] == undefined) {
        any_undefined = true;
      }
    });
    return !any_undefined;
  }

  function draw_supertile(ctx, sgp, supertile) {
    var base_pos = grid.gpos(sgp);
    for (var x = 0; x < grid.SUPERTILE_SIZE; ++x) {
      for (var y = 0; y < grid.SUPERTILE_SIZE; ++y) {
        if (grid.is_valid_subindex([x, y])) {
          var idx = x + y * grid.SUPERTILE_SIZE;
          var gp = [ base_pos[0] + x, base_pos[1] + y ];
          var tile = {
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

  // Draws an edge of the given shape with the given center point, radius, and
  // corner radius.
  function draw_edge(ctx, e_shape, side, cx, cy, r, cr) {
    ctx.save()
    ctx.translate(cx, cy);
    ctx.rotate((Math.PI / 2) * side);
    var fx = -r + cr;
    var fy = -r;
    var tx = r - cr;
    var ty = -r;
    cx = 0;
    cy = 0;
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

        var px = mx - (cx - mx) * 0.2;
        var py = my - (cy - my) * 0.2;

        ctx.lineTo(px, py);
        ctx.lineTo(tx, ty);
        break;

      case 2: // two-segment inner line
        var mx = fx + (tx - fx) / 2;
        var my = fy + (ty - fy) / 2;

        var px = mx + (cx - mx) * 0.2;
        var py = my + (cy - my) * 0.2;

        ctx.lineTo(px, py);
        ctx.lineTo(tx, ty);
        break;

      case 3: // four-segment outer zig-zag
        var mx = fx + (tx - fx) / 2;
        var my = fy + (ty - fy) / 2;

        var m1x = fx + (mx - fx) / 2;
        var m1y = fy + (my - fy) / 2;

        var p1x = m1x - (cx - mx) * 0.1;
        var p1y = m1y - (cy - my) * 0.1;

        var p2x = mx + (cx - mx) * 0.1;
        var p2y = my + (cy - my) * 0.1;

        var m2x = mx + (tx - mx) / 2;
        var m2y = my + (ty - my) / 2;

        var p3x = m2x - (cx - mx) * 0.1;
        var p3y = m2y - (cy - my) * 0.1;

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

        var p1x = m1x + (cx - mx) * 0.1;
        var p1y = m1y + (cy - my) * 0.1;

        var p2x = mx - (cx - mx) * 0.1;
        var p2y = my - (cy - my) * 0.1;

        var m2x = mx + (tx - mx) / 2;
        var m2y = my + (ty - my) / 2;

        var p3x = m2x + (cx - mx) * 0.1;
        var p3y = m2y + (cy - my) * 0.1;

        ctx.lineTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.lineTo(p3x, p3y);
        ctx.lineTo(tx, ty);
        break;

      case 5: // curved line
        var angle = (Math.PI / 2) - Math.atan2(r + cr, r - cr);
        var radius = Math.sqrt(Math.pow(r + cr, 2) + Math.pow(r - cr, 2));

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
        var dist = Math.sqrt(Math.pow(tx - fx, 2) + Math.pow(ty - fy, 2));
        var ir = 0.14 * dist;
        ctx.lineTo(fx + (tx - fx) * 0.43, fy + (ty - fy) * 0.43);
        ctx.arc(mx, my, ir, Math.PI, 0, true); // ccw
        ctx.lineTo(tx, ty);
        break;

      case 7: // circular-outdented line
        var mx = (fx + tx) / 2;
        var my = (fy + ty) / 2;
        var dist = Math.sqrt(Math.pow(tx - fx, 2) + Math.pow(ty - fy, 2));
        var ir = 0.2 * dist;
        ctx.lineTo(fx + (tx - fx) * 0.4, fy + (ty - fy) * 0.4);
        ctx.arc(mx, my, ir, Math.PI, 2 * Math.PI); // ccw
        ctx.lineTo(tx, ty);
        break;

      case 8: // line with triangle indent
        var mx = (fx + tx) / 2;
        var my = (fy + ty) / 2;
        var px = mx + (cx - mx) * 0.15;
        var py = my + (cy - my) * 0.15;
        var dist = Math.sqrt(Math.pow(tx - fx, 2) + Math.pow(ty - fy, 2));
        ctx.lineTo(fx + (tx - fx) * 0.3, fy + (ty - fy) * 0.3);
        ctx.lineTo(px, py);
        ctx.lineTo(fx + (tx - fx) * 0.7, fy + (ty - fy) * 0.7);
        ctx.lineTo(tx, ty);
        break;

      case 9: // line with triangle outdent
        var mx = (fx + tx) / 2;
        var my = (fy + ty) / 2;
        var px = mx - (cx - mx) * 0.15;
        var py = my - (cy - my) * 0.15;
        var dist = Math.sqrt(Math.pow(tx - fx, 2) + Math.pow(ty - fy, 2));
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
        var px1 = isx + (cx - mx) * 0.2;
        var py1 = isy + (cy - my) * 0.2;
        var px2 = iex + (cx - mx) * 0.2;
        var py2 = iey + (cy - my) * 0.2;
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
        var px1 = isx - (cx - mx) * 0.2;
        var py1 = isy - (cy - my) * 0.2;
        var px2 = iex - (cx - mx) * 0.2;
        var py2 = iey - (cy - my) * 0.2;
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

        var radius = Math.sqrt(Math.pow(fx - p1x, 2) + Math.pow(fy - p1y, 2));

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

        var radius = Math.sqrt(Math.pow(fx - p1x, 2) + Math.pow(fy - p1y, 2));

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

        var radius = Math.sqrt(Math.pow(sixth, 2) + Math.pow(idist, 2));

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

        var radius = Math.sqrt(Math.pow(sixth, 2) + Math.pow(idist, 2));

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
        var arc_r = Math.sqrt(Math.pow(r, 2) + Math.pow(r - cr, 2));
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

  function draw_hex_rim(ctx, wpos) {
    ctx.strokeStyle = TILE_COLORS["outline"];
    ctx.fillStyle = TILE_COLORS["inner"];

    ctx.lineWidth=2;

    ctx.beginPath();
    once = true;
    grid.VERTICES.forEach(function (vertex) {
      vertex = vertex.slice();
      vertex[0] += wpos[0];
      vertex[1] += wpos[1];

      var vv = view_pos(ctx, vertex);
      if (once) {
        ctx.moveTo(vv[0], vv[1]);
        once = false;
      } else {
        ctx.lineTo(vv[0], vv[1]);
      }
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Takes a context, an array of four shape integers, a center position, and a
  // radius and draws a pad shape to put a glyph on. Stroking and/or filling
  // this shape is up to the caller.
  function draw_pad_shape(ctx, shape, cx, cy, r) {
    ctx.beginPath();
    var olj = ctx.lineJoin;
    // ctx.lineJoin = "round";
    // ctx.lineJoin = "mitre";
    var cr = r * 0.4;
    var lt = cx - r;
    var rt = cx + r;
    var tp = cy - r;
    var bt = cy + r;
    ctx.moveTo(lt + cr, tp);
    draw_edge(ctx, shape[0], 0, cx, cy, r, cr);
    draw_corner(ctx, shape[3], 0, rt, tp, r, cr);
    draw_edge(ctx, shape[2], 1, cx, cy, r, cr);
    draw_corner(ctx, shape[3], 1, rt, bt, r, cr);
    draw_edge(ctx, shape[1], 2, cx, cy, r, cr);
    draw_corner(ctx, shape[3], 2, lt, bt, r, cr);
    draw_edge(ctx, shape[2], 3, cx, cy, r, cr);
    draw_corner(ctx, shape[3], 3, lt, tp, r, cr);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.lineJoin = olj;
  }

  function draw_tile(ctx, tile) {
    var gpos = tile["pos"];
    var wpos = grid.world_pos(gpos);
    var colors = tile["colors"];
    var glyph = tile["glyph"];
    var domain = tile["domain"];

    var vpos = view_pos(ctx, wpos);

    // No matter what goes inside, draw the rim + background:
    draw_hex_rim(ctx, wpos);

    if (glyph == undefined) { // an unloaded tile: just draw a dim '?'
      // The question mark:
      ctx.fillStyle = TILE_COLORS["pad"];
      ctx.fillText('?', vpos[0], vpos[1]);

    } else if (domain == "__object__") { // an active object
      var energized = content.is_energized(tile["dimension"], gpos);

      // The glyph:
      if (energized) {
        ctx.fillStyle = TILE_COLORS["unlocked-glyph"];
      } else {
        ctx.fillStyle = TILE_COLORS["pad"];
      }
      ctx.fillText(glyph, vpos[0], vpos[1]);

      // TODO: More special here!

    } else { // a loaded normal tile: the works
      var unlocked = content.is_unlocked(tile["dimension"], gpos);

      // Hexagon highlight
      ctx.lineWidth=3;
      // TODO DEBUG
      if (colors.length > 0) {
        var side_colors = [];
        if (colors.length <= 3 || colors.length >= 6) {
          colors.forEach(function (c) {
            side_colors.push(PALETTE[c]);
          });
        } else if (colors.length == 4) {
          side_colors = [
            TILE_COLORS["inner"], // invisible
            PALETTE[colors[0]],
            PALETTE[colors[1]],
            TILE_COLORS["inner"], // invisible
            PALETTE[colors[2]],
            PALETTE[colors[3]],
          ];
        } else if (colors.length == 5) {
          side_colors = [
            TILE_COLORS["inner"], // invisible
            PALETTE[colors[0]],
            PALETTE[colors[1]],
            PALETTE[colors[2]],
            PALETTE[colors[3]],
            PALETTE[colors[4]],
          ];
        } else {
          // Should be impossible
          console.log("Internal Error: invalid colors length: "+ colors.length);
        }

        for (var i = 0; i < grid.VERTICES.length; ++i) {
          tv = grid.VERTICES[i].slice();
          tv[0] *= 0.9;
          tv[1] *= 0.9;
          tv[0] += wpos[0];
          tv[1] += wpos[1];

          var ni = (i + 1) % grid.VERTICES.length;
          nv = grid.VERTICES[ni].slice();
          nv[0] *= 0.9;
          nv[1] *= 0.9;
          nv[0] += wpos[0];
          nv[1] += wpos[1];

          var tvv = view_pos(ctx, tv);
          var nvv = view_pos(ctx, nv);

          ctx.strokeStyle = side_colors[i % side_colors.length];

          ctx.beginPath();
          ctx.moveTo(tvv[0], tvv[1]);
          ctx.lineTo(nvv[0], nvv[1]);
          ctx.stroke();
        }
      }

      // Inner circle
      //var r = grid.GRID_EDGE * 0.63 * ctx.viewport_scale;
      var r = grid.GRID_EDGE * 0.58 * ctx.viewport_scale;
      /* DEBUG TODO
      if (colors.length > 0) {
        ctx.fillStyle = BG_PALETTE[colors[0]];
      } else {
        ctx.fillStyle = TILE_COLORS["pad"];
      }
      // */
      //* DEBUG
      if (unlocked) {
        ctx.fillStyle = TILE_COLORS["unlocked-pad"];
        ctx.strokeStyle = TILE_COLORS["unlocked-rim"];
      } else if (tile.is_inclusion) {
        ctx.fillStyle = TILE_COLORS["included-pad"];
        ctx.strokeStyle = TILE_COLORS["included-rim"];
      } else {
        ctx.fillStyle = TILE_COLORS["pad"];
        ctx.strokeStyle = TILE_COLORS["rim"];
      }
      // */
      var shape = colors.length == 0;
      draw_pad_shape(
        ctx,
        tile.shape,
        vpos[0],
        vpos[1],
        r
      );

      // Letter
      if (unlocked) {
        ctx.fillStyle = TILE_COLORS["unlocked-glyph"];
      } else {
        ctx.fillStyle = TILE_COLORS["glyph"];
      }
      ctx.fillText(glyph, vpos[0], vpos[1]);
    }
  }

  function draw_swipe(ctx, gplist, do_highlight) {
    // Takes a context, a list of grid positions defining the current swipe,
    // and whether or not to highlight this swipe, and draws the swipe.
    if (gplist.length == 0) {
      return;
    }

    // Highlight hexes:
    for (var i = 0; i < gplist.length - 1; ++i) {
      draw_highlight(ctx, gplist[i], TRAIL_COLOR);
    }
    if (do_highlight) {
      draw_highlight(ctx, gplist[gplist.length-1], HIGHLIGHT_COLOR);
    } else {
      draw_highlight(ctx, gplist[gplist.length-1], TRAIL_COLOR);
    }

    // Draw line:
    if (do_highlight && gplist.length > 1) {
      var wpos = grid.world_pos(gplist[0]);
      var vpos = view_pos(ctx, wpos);

      ctx.strokeStyle = TRAIL_COLOR;
      ctx.beginPath();
      ctx.moveTo(vpos[0], vpos[1]);
      // curves along the path:
      for (var i = 1; i < gplist.length - 1; ++i) {
        var vcp = view_pos(ctx, grid.world_pos(gplist[i]));
        var vncp = view_pos(ctx, grid.world_pos(gplist[i+1]));
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
    // Takes a context, a grid position, and a color, and highlights that grid
    // cell using that color.
    var wpos = grid.world_pos(gpos);
    var vpos = view_pos(ctx, wpos);

    ctx.lineWidth=2;

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

      // offset to our current world position
      vertex[0] += wpos[0];
      vertex[1] += wpos[1];

      // compute view position and draw a line
      var vv = view_pos(ctx, vertex);
      if (once) {
        ctx.moveTo(vv[0], vv[1]);
        once = false;
      } else {
        ctx.lineTo(vv[0], vv[1]);
      }
    });
    ctx.closePath();
    ctx.stroke();
  }

  function draw_loading(ctx, keys, loading) {
    var n_bars = keys.length;
    var bars_top = (
      ctx.cheight/2
    - (n_bars * (LOADING_BAR_HEIGHT + LOADING_BAR_SPACING))
    + LOADING_BAR_SPACING
    );
    keys.forEach(function (key, ii) {
      // Unpack progress:
      var progress = loading[key];
      var fetched = progress[0];
      var count_progress = progress[1];
      var index_progress = progress[2];

      // Decide position:
      var x = 10;
      var y = bars_top + ii * (LOADING_BAR_HEIGHT + LOADING_BAR_SPACING);

      ctx.fillStyle = LOADING_COLORS["inner"];
      ctx.fillRect(x, y, LOADING_BAR_WIDTH, LOADING_BAR_HEIGHT);
      if (fetched) {
        ctx.strokeStyle = LOADING_COLORS["outline"];
      } else {
        ctx.strokeStyle = LOADING_COLORS["deactive"];
      }
      ctx.strokeRect(x, y, LOADING_BAR_WIDTH, LOADING_BAR_HEIGHT);
      ctx.fillStyle = LOADING_COLORS["index"];
      ctx.fillRect(
        x + 2,
        y + 2,
        (LOADING_BAR_WIDTH - 4) * index_progress,
        (LOADING_BAR_HEIGHT - 5) / 2
      );
      ctx.fillStyle = LOADING_COLORS["counts"];
      ctx.fillRect(
        x + 2,
        y + 2 + (LOADING_BAR_HEIGHT - 5) / 2 + 1,
        (LOADING_BAR_WIDTH - 4) * count_progress,
        (LOADING_BAR_HEIGHT - 5) / 2
      );
      txt = key
      var m = ctx.measureText(txt);
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
      ctx.fillStyle = LOADING_COLORS["text"];
      ctx.fillText(txt, x+2, y+2);
    });
  }

  return {
    "TILE_COLORS": TILE_COLORS,
    "PALETTE": PALETTE,
    "FONT_FACE": FONT_FACE,
    "FONT_SIZE": FONT_SIZE,
    "interp_color": interp_color,
    "draw_tiles": draw_tiles,
    "draw_supertile": draw_supertile,
    "view_pos": view_pos,
    "world_pos": world_pos,
    "draw_swipe": draw_swipe,
    "draw_loading": draw_loading,
  };
});
