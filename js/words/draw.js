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

  function draw_swipe(ctx, gplist, mvp) {
    // Takes a context, a list of grid positions defining the current swipe,
    // and the current mouse view position, and draws the swipe.
    if (gplist.length == 0) {
      return;
    }

    // Highlight hexes:
    for (var i = 0; i < gplist.length - 1; ++i) {
      draw_highlight(ctx, gplist[i], TRAIL_COLOR);
    }
    draw_highlight(ctx, gplist[gplist.length-1], HIGHLIGHT_COLOR);

    // Draw line:
    var wpos = grid.world_pos(gplist[0]);
    var vpos = view_pos(ctx, wpos);

    ctx.strokeStyle = TRAIL_COLOR;
    ctx.beginPath();
    ctx.moveTo(vpos[0], vpos[1]);
    if (gplist.length == 1) {
      // just a straight line to the mouse:
      ctx.lineTo(mvp[0], mvp[1]);
    } else if (gplist.length == 2) {
      // curve to the mouse:
      wpos = grid.world_pos(gplist[1]);
      vpos = view_pos(ctx, wpos);
      ctx.quadraticCurveTo(vpos[0], vpos[1], mvp[0], mvp[1]);
    } else { // length 3+
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
      // curve to the mouse:
      wpos = grid.world_pos(gplist[gplist.length - 1]);
      vpos = view_pos(ctx, wpos);
      ctx.quadraticCurveTo(vpos[0], vpos[1], mvp[0], mvp[1]);
    }
    ctx.stroke();
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

  function draw_sofar(ctx, glyphs) {
    // Box for the context to go in:
    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#444";
    ctx.beginPath();
    ctx.moveTo(
      CONTEXT_BOX["left"],
      ctx.cheight - CONTEXT_BOX["bottom"] - CONTEXT_BOX["height"]
    );
    ctx.lineTo(
      ctx.cwidth - CONTEXT_BOX["right"],
      ctx.cheight - CONTEXT_BOX["bottom"] - CONTEXT_BOX["height"]
    );
    ctx.lineTo(
      ctx.cwidth - CONTEXT_BOX["right"],
      ctx.cheight - CONTEXT_BOX["bottom"]
    );
    ctx.lineTo(
      CONTEXT_BOX["left"],
      ctx.cheight - CONTEXT_BOX["bottom"]
    );
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    // Draw the context:
    // TODO: Measure glyphs and use ellipsis when required.
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "22px asap";
    var str = glyphs.join("");
    var twidth = ctx.measureText(str).width;
    var maxwidth = (
      ctx.cwidth
    - CONTEXT_BOX["left"]
    - CONTEXT_BOX["right"]
    - CONTEXT_BOX["padding"]*2
    - 2
    );
    if (twidth > maxwidth) {
      str = str.slice(4);
      twidth = ctx.measureText("…" + str).width;
      while (twidth > maxwidth) {
        str = str.slice(1);
        twidth = ctx.measureText("…" + str).width;
      }
      str = "…" + str;
    }
    ctx.fillStyle = "#fff";
    ctx.fillText(
      str,
      CONTEXT_BOX["left"] + CONTEXT_BOX["padding"],
      ctx.cheight - CONTEXT_BOX["bottom"] - CONTEXT_BOX["height"]/2
    );
  }

  return {
    "TILE_COLORS": TILE_COLORS,
    "PALETTE": PALETTE,
    "draw_tiles": draw_tiles,
    "view_pos": view_pos,
    "world_pos": world_pos,
    "draw_swipe": draw_swipe,
    "draw_sofar": draw_sofar,
  };
});
