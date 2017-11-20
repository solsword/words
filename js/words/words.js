// words.js
// Word game.

define(["./draw", "./grid"], function(draw, grid) {

  var VIEWPORT_SIZE = 800.0;
  var VIEWPORT_SCALE = 1.0;

  var CURRENT_SWIPE = null;
  var CURRENT_GLYPHS = null;

  // Mouse scroll correction factors:
  var PIXELS_PER_LINE = 18;
  var LINES_PER_PAGE = 40;

  function mouse_position(e) {
    return [
      e.pageX - CTX.bounds.left,
      e.pageY - CTX.bounds.top
    ];
  }

  function start_game() {
    // set up canvas context
    CANVAS = document.getElementById("canvas");
    var bounds = CANVAS.getBoundingClientRect();
    var car = bounds.width / bounds.height;
    CANVAS.width = 800 * car;
    CANVAS.height = 800;
    CTX = CANVAS.getContext("2d");
    CTX.cwidth = CANVAS.width;
    CTX.cheight = CANVAS.height; // TODO: Update these dynamically
    CTX.middle = [CTX.cwidth / 2, CTX.cheight / 2];
    CTX.bounds = bounds;
    CTX.viewport_size = VIEWPORT_SIZE;
    CTX.viewport_center = [0, 0];
    CTX.viewport_scale = VIEWPORT_SCALE;

    // kick off animation
    window.requestAnimationFrame(animate);

    // set up event handlers
    document.onmousedown = function (e) {
      if (e.preventDefault) { e.preventDefault(); }
      // TODO: Something if CURRENT_SWIPE is not null?
      CURRENT_SWIPE = [];
      var vpos = mouse_position(e);
      var wpos = draw.world_pos(CTX, vpos);
      var gpos = grid.grid_pos(wpos);
      CURRENT_SWIPE.push(gpos);
    }

    document.onmouseup = function(e) {
      // TODO: Menus
      if (e.preventDefault) { e.preventDefault(); }
      if (CURRENT_SWIPE != null && CURRENT_SWIPE.length > 0) {
        // A non-empty swipe motion.
        glyphs = []
        CURRENT_SWIPE.forEach(function (gp) {
          glyphs.push(grid.tile_at(gp)["glyph"])
        });
        if (CURRENT_GLYPHS == null) {
          CURRENT_GLYPHS = [];
        }
        glyphs.forEach(function (g) { CURRENT_GLYPHS.push(g); });
      }
      // either way reset CURRENT_SWIPE
      CURRENT_SWIPE = null;
    }

    document.onmousemove = function (e) {
      if (e.preventDefault) { e.preventDefault(); }
      if (CURRENT_SWIPE != null) {
        var vpos = mouse_position(e);
        var wpos = draw.world_pos(CTX, vpos);
        var gpos = grid.grid_pos(wpos);
        if (CURRENT_SWIPE.length >= 1) {
          var prev = CURRENT_SWIPE[CURRENT_SWIPE.length - 1];
          if ("" + gpos != "" + prev) {
            if (CURRENT_SWIPE.length >= 2) {
              var pprev = CURRENT_SWIPE[CURRENT_SWIPE.length - 2];
              if ("" + gpos == "" + pprev) {
                // Going backwards undoes selection:
                CURRENT_SWIPE.pop();
              } else {
                // Going onwards:
                CURRENT_SWIPE.push(gpos);
              }
            } else {
              // Only one location so far: push next
              CURRENT_SWIPE.push(gpos);
            }
          } // if it's the same as the current head, no change required.
        } else {
          CURRENT_SWIPE.push(gpos);
        }
      }
    }

    document.onwheel = function (e) {
      if (e.preventDefault) { e.preventDefault(); }
      var unit = e.deltaMode;
      var x = e.deltaX;
      var y = e.deltaY;

      // normalize units to pixels:
      if (unit == 1) {
        x *= PIXELS_PER_LINE;
        y *= PIXELS_PER_LINE;
      } else if (unit == 2) {
        x *= PIXELS_PER_LINE * LINES_PER_PAGE;
        y *= PIXELS_PER_LINE * LINES_PER_PAGE;
      }

      CTX.viewport_center[0] += x;
      CTX.viewport_center[1] -= y;
    }
  }

  function animate(now) {
    // draw the world
    CTX.clearRect(0, 0, CTX.cwidth, CTX.cheight);
    draw.draw_tiles(CTX);
    if (CURRENT_SWIPE != null && CURRENT_SWIPE.length > 0) {
      draw.draw_swipe(CTX, CURRENT_SWIPE);
    }
    if (CURRENT_GLYPHS != null) {
      draw.draw_sofar(CTX, CURRENT_GLYPHS);
    }

    // reschedule ourselves
    window.requestAnimationFrame(animate);
  }

  return {
    "start_game": start_game
  }
});
