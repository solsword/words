// words.js
// Word game.

define(["./draw", "./grid", "./dict"], function(draw, grid, dict) {

  var VIEWPORT_SIZE = 800.0;
  var VIEWPORT_SCALE = 1.0;

  var CURRENT_SWIPE = null;
  var CURRENT_GLYPHS = null;
  var LAST_POSITION = [0, 0];

  // Mouse scroll correction factors:
  var PIXELS_PER_LINE = 18;
  var LINES_PER_PAGE = 40;

  var LAST_MOUSE_POSITION = [0, 0];

  var RESIZE_TIMEOUT = 20; // milliseconds

  function home_view() {
    var wpos = grid.world_pos([0, 0]);
    CTX.viewport_center[0] = wpos[0];
    CTX.viewport_center[1] = wpos[1];
  }

  var COMMANDS = {
    // spacebar checks current word
    " ": function (e) {
      // TODO: HERE
    },
    // tab recenters view on current/last swipe head
    "Tab": function (e) {
      if (e.preventDefault) { e.preventDefault(); }
      var wpos = grid.world_pos(LAST_POSITION);
      CTX.viewport_center[0] = wpos[0];
      CTX.viewport_center[1] = wpos[1];
    },
    // home and 0 reset the view to center 0, 0
    "0": home_view,
    "Home": home_view,
  }

  function mouse_position(e) {
    var client_x = e.clientX - CTX.bounds.left;
    var client_y = e.clientY - CTX.bounds.top;
    return [
      client_x * CTX.cwidth / CTX.bounds.width,
      client_y * CTX.cheight / CTX.bounds.height
    ];
  }

  function update_canvas_size() {
    // Updates the canvas size. Called on resize after a timeout.
    var bounds = CANVAS.getBoundingClientRect();
    var car = bounds.width / bounds.height;
    CANVAS.width = 800 * car;
    CANVAS.height = 800;
    CTX.cwidth = CANVAS.width;
    CTX.cheight = CANVAS.height;
    CTX.middle = [CTX.cwidth / 2, CTX.cheight / 2];
    CTX.bounds = bounds;
  }

  function start_game() {
    // set up canvas context
    CANVAS = document.getElementById("canvas");
    CTX = CANVAS.getContext("2d");
    update_canvas_size();
    CTX.viewport_size = VIEWPORT_SIZE;
    CTX.viewport_center = [0, 0];
    CTX.viewport_scale = VIEWPORT_SCALE;

    // kick off animation
    window.requestAnimationFrame(animate);

    // Listen for window resizes but wait until RESIZE_TIMEOUT after the last
    // consecutive one to do anything.
    var timer_id = undefined;
    window.addEventListener("resize", function() {
      if (timer_id != undefined) {
        clearTimeout(timer_id);
        timer_id = undefined;
      }
      timer_id = setTimeout(
        function () {
          timer_id = undefined;
          update_canvas_size();
        },
        RESIZE_TIMEOUT
      );
    });

    // set up event handlers
    document.onmousedown = function (e) {
      if (e.preventDefault) { e.preventDefault(); }
      // TODO: Something if CURRENT_SWIPE is not null?
      CURRENT_SWIPE = [];
      var vpos = mouse_position(e);
      var wpos = draw.world_pos(CTX, vpos);
      var gpos = grid.grid_pos(wpos);
      CURRENT_SWIPE.push(gpos);
      LAST_POSITION = CURRENT_SWIPE[CURRENT_SWIPE.length - 1];
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
      LAST_MOUSE_POSITION = mouse_position(e);
      if (e.preventDefault) { e.preventDefault(); }
      if (CURRENT_SWIPE != null) {
        var vpos = mouse_position(e);
        var wpos = draw.world_pos(CTX, vpos);
        var gpos = grid.grid_pos(wpos);
        var head = null;
        if (CURRENT_SWIPE.length > 0) {
          head = CURRENT_SWIPE[CURRENT_SWIPE.length - 1];
        }
        var is_used = false;
        var is_prev = false;
        var is_head = false;
        CURRENT_SWIPE.forEach(function (prpos, idx) {
          if ("" + prpos == "" + gpos) {
            is_used = true;
            if (idx == CURRENT_SWIPE.length - 1) {
              is_head = true;
            } else if (idx == CURRENT_SWIPE.length - 2) {
              is_prev = true;
            }
          }
        });
        if (is_used) {
          if (is_prev) {
            CURRENT_SWIPE.pop();
            if (CURRENT_SWIPE.length > 0) {
              LAST_POSITION = CURRENT_SWIPE[CURRENT_SWIPE.length - 1];
            }
          }
          // else do nothing, we're on a tile that's already part of the
          // current swipe.
        } else {
          // for tiles that aren't part of the swipe already:
          if (head == null || grid.is_neighbor(head, gpos)) {
            // add them if they're a neighbor of the head
            CURRENT_SWIPE.push(gpos);
            LAST_POSITION = CURRENT_SWIPE[CURRENT_SWIPE.length - 1];
          }
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

    document.onkeydown = function (e) {
      if (COMMANDS.hasOwnProperty(e.key)) {
        COMMANDS[e.key](e);
      }
    }
  }

  function animate(now) {
    // draw the world
    CTX.clearRect(0, 0, CTX.cwidth, CTX.cheight);
    draw.draw_tiles(CTX);
    if (CURRENT_SWIPE != null && CURRENT_SWIPE.length > 0) {
      draw.draw_swipe(CTX, CURRENT_SWIPE, LAST_MOUSE_POSITION);
    }
    if (CURRENT_GLYPHS != null) {
      draw.draw_sofar(CTX, CURRENT_GLYPHS);
    }

    // DEBUG: Uncomment this to draw a cursor.
    //*
    CTX.strokeStyle = "#fff";
    CTX.beginPath();
    CTX.moveTo(LAST_MOUSE_POSITION[0]-3, LAST_MOUSE_POSITION[1]-3);
    CTX.lineTo(LAST_MOUSE_POSITION[0]+3, LAST_MOUSE_POSITION[1]+3);
    CTX.moveTo(LAST_MOUSE_POSITION[0]+3, LAST_MOUSE_POSITION[1]-3);
    CTX.lineTo(LAST_MOUSE_POSITION[0]-3, LAST_MOUSE_POSITION[1]+3);
    CTX.stroke();
    // */

    // reschedule ourselves
    window.requestAnimationFrame(animate);
  }

  return {
    "start_game": start_game
  }
});
