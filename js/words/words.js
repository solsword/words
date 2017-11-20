// words.js
// Word game.

define(["./draw", "./grid"], function(draw, grid) {

  var VIEWPORT_SIZE = 800.0;
  var VIEWPORT_SCALE = 1.0;

  var CURRENT_SWIPE = null;

  // Mouse scroll correction factors:
  var PIXELS_PER_LINE = 18;
  var LINES_PER_PAGE = 40;

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
      CURRENT_SWIPE = [];
      var vpos = [
        e.pageX - CTX.bounds.left,
        e.pageY - CTX.bounds.top
      ];
      var wpos = draw.world_pos(CTX, vpos);
      var gpos = grid.grid_pos(wpos);
      CURRENT_SWIPE.push(gpos);
    }

    document.onmouseup = function(e) {
      if (e.preventDefault) { e.preventDefault(); }
      if (CURRENT_SWIPE != null && CURRENT_SWIPE.length > 0) {
        // A non-empty swipe motion.
        glyphs = []
        CURRENT_SWIPE.foreach(function(gp) {
          glyphs.push(grid.tile_at(gp)["glyph"])
        });
      }
      // either way reset CURRENT_SWIPE
      CURRENT_SWIPE = null;
    }

    document.onmousemove = function (e) {
      if (e.preventDefault) { e.preventDefault(); }
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
    draw.draw(CTX);

    // reschedule ourselves
    window.requestAnimationFrame(animate);
  }

  return {
    "start_game": start_game
  }
});
