// draw.js
// Drawing code for words game.

define(["./grid", "./content"], function(grid, content) {

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
      "included-pad": "#444",
      "included-rim": "#666",
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

  function draw_pad_shape(ctx, shape, cx, cy, r) {
    ctx.beginPath();
    var olj = ctx.lineJoin;
    ctx.lineJoin = "round";
    switch (shape) {
      default:
      case 0: // circle
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        break;
      case 1: // rectangle
        ctx.moveTo(cx - 0.9 * r, cy - r);
        ctx.lineTo(cx + 0.9 * r, cy - r);
        ctx.lineTo(cx + 0.9 * r, cy + r);
        ctx.lineTo(cx - 0.9 * r, cy + r);
        ctx.closePath();
        break;
      case 2: // rectangle w/ rounded corners
        var cr = r * 0.5;
        var lt = cx - 0.9 * r;
        var rt = cx + 0.9 * r;
        var tp = cy - r;
        var bt = cy + r;
        ctx.moveTo(lt + cr, tp);
        ctx.lineTo(rt - cr, tp);
        ctx.arc(rt - cr, tp + cr, cr, 3 * Math.PI / 2, 2 * Math.PI);
        ctx.lineTo(rt, bt - cr);
        ctx.arc(rt - cr, bt - cr, cr, 0, Math.PI / 2);
        ctx.lineTo(lt + cr, bt);
        ctx.arc(lt + cr, bt - cr, cr, Math.PI / 2, Math.PI);
        ctx.lineTo(lt, tp + cr);
        ctx.arc(lt + cr, tp + cr, cr, Math.PI, 3 * Math.PI / 2);
        break;
      case 3: // rectangle w/ corners indented
        var cr = r * 0.4;
        var lt = cx - 0.9 * r;
        var rt = cx + 0.9 * r;
        var tp = cy - r;
        var bt = cy + r;
        ctx.moveTo(lt + cr, tp);
        ctx.lineTo(rt - cr, tp);
        ctx.arc(rt, tp, cr, Math.PI, Math.PI / 2, true);
        ctx.lineTo(rt, bt - cr);
        ctx.arc(rt, bt, cr, 3 * Math.PI / 2, Math.PI, true);
        ctx.lineTo(lt + cr, bt);
        ctx.arc(lt, bt, cr, 2 * Math.PI, 3 * Math.PI / 2, true);
        ctx.lineTo(lt, tp + cr);
        ctx.arc(lt, tp, cr, Math.PI / 2, 0, true);
        break;
      case 4: // rectangle w/ vertical sides indented
        var cr = r * 0.3;
        var lt = cx - 0.9 * r;
        var rt = cx + 0.9 * r;
        var tp = cy - r;
        var bt = cy + r;
        ctx.moveTo(lt, tp);
        ctx.lineTo(rt, tp);
        ctx.lineTo(rt, cy - cr);
        ctx.arc(rt, cy, cr, 3 * Math.PI / 2, Math.PI / 2, true);
        ctx.lineTo(rt, bt);
        ctx.lineTo(lt, bt);
        ctx.lineTo(lt, cy + cr);
        ctx.arc(lt, cy, cr, Math.PI / 2, 3 * Math.PI / 2, true);
        ctx.closePath();
        break;
      case 5: // octagon
        var cr = r * 0.55;
        var lt = cx - 0.9 * r;
        var rt = cx + 0.9 * r;
        var tp = cy - r;
        var bt = cy + r;
        ctx.moveTo(lt + cr, tp);
        ctx.lineTo(rt - cr, tp);
        ctx.lineTo(rt, tp + cr);
        ctx.lineTo(rt, bt - cr);
        ctx.lineTo(rt - cr, bt);
        ctx.lineTo(lt + cr, bt);
        ctx.lineTo(lt, bt - cr);
        ctx.lineTo(lt, tp + cr);
        ctx.closePath();
        break;
      case 6: // horizontal hexagon
        var cr = r * 0.4;
        var lt = cx - r;
        var rt = cx + r;
        var tp = cy - r;
        var bt = cy + r;
        ctx.moveTo(lt + cr, tp);
        ctx.lineTo(rt - cr, tp);
        ctx.lineTo(rt, cy);
        ctx.lineTo(rt - cr, bt);
        ctx.lineTo(lt + cr, bt);
        ctx.lineTo(lt, cy);
        ctx.closePath();
        break;
      case 7: // vertical hexagon
        var cr = r * 0.4;
        var lt = cx - r;
        var rt = cx + r;
        var tp = cy - r;
        var bt = cy + r;
        ctx.moveTo(cx, tp);
        ctx.lineTo(rt, tp + cr);
        ctx.lineTo(rt, bt - cr);
        ctx.lineTo(cx, bt);
        ctx.lineTo(lt, bt - cr);
        ctx.lineTo(lt, tp + cr);
        ctx.closePath();
        break;
      case 8: // upright pentagon
        var cr = r * 0.4;
        var lt = cx - r;
        var rt = cx + r;
        var tp = cy - r;
        var bt = cy + r;
        ctx.moveTo(cx, tp);
        ctx.lineTo(rt, tp + cr);
        ctx.lineTo(rt - cr, bt);
        ctx.lineTo(lt + cr, bt);
        ctx.lineTo(lt, tp + cr);
        ctx.closePath();
        break;
      case 9: // upside-down pentagon
        var cr = r * 0.4;
        var lt = cx - r;
        var rt = cx + r;
        var tp = cy - r;
        var bt = cy + r;
        ctx.moveTo(lt + cr, tp);
        ctx.lineTo(rt - cr, tp);
        ctx.lineTo(rt, bt - cr);
        ctx.lineTo(cx, bt);
        ctx.lineTo(lt, bt - cr);
        ctx.closePath();
        break;
      case 10: // rectangle with out-bent sides
        var cr = r * 0.4;
        var lt = cx - r;
        var rt = cx + r;
        var tp = cy - r;
        var bt = cy + r;
        var angle = Math.PI / 4;
        ctx.moveTo(lt + cr, tp);
        ctx.lineTo(rt - cr, tp);
        ctx.arc(
          cx - cr,
          cy,
          r + cr,
          -angle,
          angle
        );
        ctx.lineTo(lt + cr, bt);
        ctx.arc(
          cx + cr,
          cy,
          r + cr,
          Math.PI - angle,
          Math.PI + angle
        );
        ctx.closePath();
        break;
      case 11: // rectangle with out-bent top & bottom
        var cr = r * 0.4;
        var lt = cx - r;
        var rt = cx + r;
        var tp = cy - r;
        var bt = cy + r;
        var angle = Math.PI / 4;
        ctx.moveTo(lt, tp + cr);
        ctx.arc(
          cx,
          cy + cr,
          r + cr,
          (3 * Math.PI / 2) - angle,
          (3 * Math.PI / 2) + angle
        );
        ctx.lineTo(rt, bt - cr);
        ctx.arc(
          cx,
          cy - cr,
          r + cr,
          (Math.PI / 2) - angle,
          (Math.PI / 2) + angle
        );
        ctx.closePath();
        break;
    }
    ctx.fill();
    ctx.stroke();
    ctx.lineJoin = olj;
  }

  function draw_tile(ctx, tile) {
    var wpos = grid.world_pos(tile["pos"]);
    var colors = tile["colors"];
    var glyph = tile["glyph"];
    var unlocked = content.is_unlocked(tile["pos"]);

    var vpos = view_pos(ctx, wpos);

    if (glyph == undefined) { // an unloaded tile: just draw a dim '?'
      ctx.strokeStyle = TILE_COLORS["pad"];
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

      // The question mark:
      ctx.fillStyle = TILE_COLORS["pad"];
      ctx.fillText('?', vpos[0], vpos[1]);

    } else { // a loaded tile: the works
      // Outer hexagon
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

      // Hexagon highlight
      ctx.lineWidth=3;
      // DEBUG TODO
      if (colors.length > 0 && false) {
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
          console.log("Internal Error: invalid colors length: " +colors.length);
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
      } else if (colors.length > 0) {
        ctx.fillStyle = TILE_COLORS["included-pad"];
        ctx.strokeStyle = TILE_COLORS["included-rim"];
      } else {
        ctx.fillStyle = TILE_COLORS["pad"];
        ctx.strokeStyle = TILE_COLORS["rim"];
      }
      // */
      var shape = colors.length == 0;
      // DEBUG:
      var shape = 11;
      draw_pad_shape(ctx, shape, vpos[0], vpos[1], r);

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
