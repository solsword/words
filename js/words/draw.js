// draw.js
// Drawing code for words game.

define(["./grid"], function(grid) {

  var HIGHLIGHT_COLOR = "#fff";
  var TRAIL_COLOR = "#bbb";

  var TILE_COLORS = {
    "outline": "#555",
      "inner": "#333",
        "pad": "#444",
      "glyph": "#bbb"
  };

  var PALETTE = {
    "gr": "#888",
    "bl": "#8bf",
    "rd": "#f66",
    "yl": "#ff2",
    "gn": "#6f6",
  };

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

  function draw_tiles(ctx) {
    // TODO: Chunk rendering...
    edges = viewport_edges(ctx);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "22px asap";

    tiles = grid.list_tiles(edges);
    tiles.forEach(function(tile) {
      draw_tile(ctx, tile);
    });
  }

  function draw_tile(ctx, tile) {
    // TODO: Highlight status (or draw highlight separately?)!
    var wpos = grid.world_pos(tile["pos"]);
    var colors = tile["colors"];
    var glyph = tile["glyph"];

    ctx.lineWidth=2;

    var vpos = view_pos(ctx, wpos);

    // Outer hexagon
    ctx.strokeStyle = TILE_COLORS["outline"];
    ctx.fillStyle = TILE_COLORS["inner"];

    vertices = grid.VERTICES.slice();

    ctx.beginPath();
    once = true;
    vertices.forEach(function (vertex) {
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

    // Inner circle
    var r = grid.GRID_EDGE * 0.63 / ctx.viewport_scale;
    ctx.fillStyle = TILE_COLORS["pad"];
    ctx.beginPath();
    ctx.arc(vpos[0], vpos[1], r, 0, 2 * Math.PI);
    ctx.fill();

    // Domain colors
    if (colors.length > 0) {
      var sweep = (2*Math.PI)/colors.length;
      var start = 0;
      colors.forEach(function (c) {
        ctx.strokeStyle = PALETTE[c];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(vpos[0], vpos[1], r*0.95, start, start + sweep);
        ctx.stroke();
        start += sweep;
      });
    }

    // Letter
    ctx.fillStyle = TILE_COLORS["glyph"];
    ctx.fillText(glyph, vpos[0], vpos[1]);
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

    vertices = grid.VERTICES.slice();

    ctx.beginPath();
    once = true;
    vertices.forEach(function (vertex) {
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

  function draw_sofar(ctx, glyphs, edge_color) {
    // Draw the context:
    // TODO: Measure glyphs and use ellipsis when required.
    ctx.textAlign = "middle";
    ctx.textBaseline = "middle";
    ctx.font = "22px asap";
    var str = glyphs.join("");
    var boxwidth = ctx.measureText(str).width + CONTEXT_BOX["padding"]*2;
    var maxwidth = (
      ctx.cwidth
    - CONTEXT_BOX["left"]
    - CONTEXT_BOX["right"]
    );
    if (boxwidth > maxwidth) {
      str = str.slice(4);
      boxwidth = ctx.measureText("…" + str).width + CONTEXT_BOX["padding"]*2;
      while (boxwidth > maxwidth) {
        str = str.slice(1);
        boxwidth = ctx.measureText("…" + str).width + CONTEXT_BOX["padding"]*2;
      }
      str = "…" + str;
    }

    // Box for the context to go in:
    ctx.fillStyle = "#000";
    ctx.strokeStyle = edge_color;
    ctx.beginPath();
    ctx.moveTo(
      ctx.cwidth/2 - boxwidth/2,
      ctx.cheight - CONTEXT_BOX["bottom"] - CONTEXT_BOX["height"]
    );
    ctx.lineTo(
      ctx.cwidth/2 + boxwidth/2,
      ctx.cheight - CONTEXT_BOX["bottom"] - CONTEXT_BOX["height"]
    );
    ctx.lineTo(
      ctx.cwidth/2 + boxwidth/2,
      ctx.cheight - CONTEXT_BOX["bottom"]
    );
    ctx.lineTo(
      ctx.cwidth/2 - boxwidth/2,
      ctx.cheight - CONTEXT_BOX["bottom"]
    );
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    // The text itself:
    ctx.fillStyle = "#fff";
    ctx.fillText(
      str,
      ctx.cwidth/2,
      ctx.cheight - CONTEXT_BOX["bottom"] - CONTEXT_BOX["height"]/2
    );
  }

  return {
    "TILE_COLORS": TILE_COLORS,
    "PALETTE": PALETTE,
    "interp_color": interp_color,
    "draw_tiles": draw_tiles,
    "view_pos": view_pos,
    "world_pos": world_pos,
    "draw_swipe": draw_swipe,
    "draw_sofar": draw_sofar,
  };
});
