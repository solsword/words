// draw.js
// Drawing code for words game.

define(["./grid"], function(grid) {

  var HIGHLIGHT_COLOR = "#fff";

  var PALETTE = {
    "gr": {
      "outline": "#555",
        "inner": "#333",
          "pad": "#444",
        "glyph": "#aaa"
    },
    "bl": {
      "outline": "#125",
        "inner": "#113",
          "pad": "#014",
        "glyph": "#34a"
    },
    "rd": {
      "outline": "#500",
        "inner": "#311",
          "pad": "#400",
        "glyph": "#a00"
    },
    "yl": {
      "outline": "#cc0",
        "inner": "#aa2",
          "pad": "#bb4",
        "glyph": "#ff8"
    },
    "gn": {
      "outline": "#050",
        "inner": "#131",
          "pad": "#040",
        "glyph": "#0a0"
    },
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
    var color = tile["color"];
    var glyph = tile["glyph"];

    ctx.lineWidth=2;

    var vpos = view_pos(ctx, wpos);

    // Outer hexagon
    ctx.strokeStyle = PALETTE[color]["outline"];
    ctx.fillStyle = PALETTE[color]["inner"];

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
    var r = grid.GRID_EDGE * 0.6 / ctx.viewport_scale;
    ctx.fillStyle = PALETTE[color]["pad"];
    ctx.beginPath();
    ctx.arc(vpos[0], vpos[1], r, 0, 2 * Math.PI);
    ctx.fill();

    // Letter
    ctx.fillStyle = PALETTE[color]["glyph"];
    ctx.fillText(glyph, vpos[0], vpos[1]);
  }

  function draw_swipe(ctx, gplist) {
    gplist.forEach(function (gp) {
      draw_highlight(ctx, gp);
    });
  }

  function draw_highlight(ctx, gpos) {
    var wpos = grid.world_pos(gpos);
    var vpos = view_pos(ctx, wpos);

    ctx.lineWidth=2;

    // Outer hexagon
    ctx.strokeStyle = HIGHLIGHT_COLOR;

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
    ctx.fillStyle = "#fff";
    ctx.fillText(
      str,
      CONTEXT_BOX["left"] + CONTEXT_BOX["padding"],
      ctx.cheight - CONTEXT_BOX["bottom"] - CONTEXT_BOX["height"]/2
    );
  }

  return {
    "PALETTE": PALETTE,
    "draw_tiles": draw_tiles,
    "view_pos": view_pos,
    "world_pos": world_pos,
    "draw_swipe": draw_swipe,
    "draw_sofar": draw_sofar,
  };
});
