// words.js
// Word game.

define(
["./draw", "./grid", "./dict", "./menu"],
function(draw, grid, dict, menu) {

  var VIEWPORT_SIZE = 800.0;

  var SWIPING = false;
  var CURRENT_SWIPES = [];
  var CURRENT_GLYPHS = null;
  var LAST_POSITION = [0, 0];

  // Mouse scroll correction factors:
  var PIXELS_PER_LINE = 18;
  var LINES_PER_PAGE = 40;

  var LAST_MOUSE_POSITION = [0, 0];

  var RESIZE_TIMEOUT = 20; // milliseconds

  // Do we need to redraw the screen?
  var DO_REDRAW = false;

  var SOFAR_BORDER = "#555";
  var SOFAR_HIGHLIGHT = "#ccc";
  var SOFAR_FADE = 0.0;

  var WORDS_FOUND = [];

  function home_view() {
    var wpos = grid.world_pos([0, 0]);
    CTX.viewport_center[0] = wpos[0];
    CTX.viewport_center[1] = wpos[1];
    DO_REDRAW = true;
  }

  var COMMANDS = {
    // spacebar checks current word
    " ": function (e) {
      var combined_swipe = combine_arrays(CURRENT_SWIPES);
      var domains = new Set();
      combined_swipe.forEach(function (gp) {
        var st = grid.grid_supertile(gp);
        st.domains.forEach(function (d) {
          domains.add(d);
        });
      });
      var entries = dict.check_word(CURRENT_GLYPHS, domains);
      if (entries.length > 0) {
        // Found a match:
        var connected = false;
        combined_swipe.forEach(function (gp) {
          if (grid.is_unlocked(gp)) {
            connected = true;
          }
        });
        if (connected) {
          // Match is connected:
          // clear our swipes and glyphs and add to our words found
          combined_swipe.forEach(function (gp) {
            grid.unlock_tile(gp);
          });
          CURRENT_SWIPES = [];
          CURRENT_GLYPHS = null;
          entries.forEach(function (e) {
            WORDS_FOUND.push(e);
          });
          // Highlight in white:
          SOFAR_HIGHLIGHT = "#fff";
        } else {
          // Highlight in yellow:
          SOFAR_HIGHLIGHT = "#ff2";
        }
      } else {
        // No match found: just highlight in red
        SOFAR_HIGHLIGHT = "#f22";
      }
      SOFAR_FADE = 1.0;
      DO_REDRAW = true;
    },
    // escape removes all current selections
    "Escape": function (e) {
      CURRENT_SWIPES = [];
      CURRENT_GLYPHS = null;
      SOFAR_HIGHLIGHT = "#f22";
      SOFAR_FADE = 1.0;
      DO_REDRAW = true;
    },
    // tab recenters view on current/last swipe head
    "Tab": function (e) {
      if (e.preventDefault) { e.preventDefault(); }
      var wpos = grid.world_pos(LAST_POSITION);
      CTX.viewport_center[0] = wpos[0];
      CTX.viewport_center[1] = wpos[1];
      DO_REDRAW = true;
    },
    // shows 'about' dialog
    "a": function (e) {
      // TODO: prevent multiple pop-ups at once?
      menu.add_menu(
        new menu.Dialog(
          CTX,
          undefined,
          undefined,
          {}, 
          "This is Words, version 0.0.1.",
          [ { "text": "OK" } ]
        )
      );
      DO_REDRAW = true;
    },
    // home and 0 reset the view to center 0, 0
    "0": home_view,
    "Home": home_view,
    // Pops a letter from the current swipe set
    "Backspace": function (e) {
      if (e.preventDefault) { e.preventDefault(); }
      if (CURRENT_SWIPES.length > 0) {
        last_swipe = CURRENT_SWIPES[CURRENT_SWIPES.length - 1];
        last_swipe.pop();
        if (last_swipe.length == 0) {
          CURRENT_SWIPES.pop();
        }
        CURRENT_GLYPHS.pop();
      }
      DO_REDRAW = true;
    }
  }

  function combine_arrays(deep) {
    // Flattens an array of arrays (just once).
    var result = [];
    var n = deep.length;
    for (var i = 0; i < n; ++i) {
      result.push.apply(result, deep[i]);
    }
    return result;
  }

  function canvas_position_of_event(e) {
    if (e.touches) {
      e = e.touches[0];
    }
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
    DO_REDRAW = true;
    menu.set_canvas_size([CANVAS.width, CANVAS.height]);
  }

  function update_current_glyphs() {
    CURRENT_GLYPHS = []
    CURRENT_SWIPES.forEach(function (sw) {
      sw.forEach(function (gp) {
        CURRENT_GLYPHS.push(grid.tile_at(gp)["glyph"]);
      });
    });
  }

  function start_game() {
    // set up canvas context
    CANVAS = document.getElementById("canvas");
    CTX = CANVAS.getContext("2d");
    update_canvas_size();
    CTX.viewport_size = VIEWPORT_SIZE;
    CTX.viewport_center = [0, 0];
    var screensize = Math.min(window.innerWidth, window.innerHeight);
    if (screensize < 500) {
      // Smaller devices
      CTX.viewport_scale = 2.0;
    } else {
      CTX.viewport_scale = 1.0;
    }
    DO_REDRAW = true;

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

    // set up menus:
    menu.add_menu(
      new menu.ToggleMenu(
        CTX,
        [ CTX.cwidth - 60*CTX.viewport_scale, 60*CTX.viewport_scale ],
        [ 40*CTX.viewport_scale, CTX.cheight - (60 + 120)*CTX.viewport_scale ],
        { "orientation": -Math.PI/2 }, 
        "WORDS",
        function () { console.log("ON"); },
        function () { console.log("OFF"); }
      )
    );

    // set up event handlers
    document.onmousedown = function (e) {
      if (e.preventDefault) { e.preventDefault(); }
      var vpos = canvas_position_of_event(e);
      // dispatch to menu system first:
      if (menu.mousedown(vpos)) { return; }
      var wpos = draw.world_pos(CTX, vpos);
      var gpos = grid.grid_pos(wpos);
      var head = null;
      if (CURRENT_SWIPES.length > 0) {
        for (var i = CURRENT_SWIPES.length - 1; i > -1; --i) {
          var latest_swipe = CURRENT_SWIPES[i];
          if (latest_swipe.length > 0) {
            head = latest_swipe[latest_swipe.length - 1];
            break;
          }
        }
      }
      if (!is_selected(gpos) && (head == null || grid.is_neighbor(head, gpos))){
        CURRENT_SWIPES.push([gpos]);
        update_current_glyphs();
        LAST_POSITION = gpos;
      } else {
        CURRENT_SWIPES.push([]);
      }
      SWIPING = true;
      DO_REDRAW = true;
    }
    document.ontouchstart = document.onmousedown;

    document.onmouseup = function(e) {
      // TODO: Menus
      if (e.preventDefault) { e.preventDefault(); }
      // dispatch to menu system first:
      var vpos = canvas_position_of_event(e);
      if (menu.mouseup(vpos)) {
        DO_REDRAW = true;
        return;
      }
      SWIPING = false;
      if (CURRENT_SWIPES.length == 0) {
        return;
      }
      var latest_swipe = CURRENT_SWIPES.pop();
      if (latest_swipe.length > 0) {
        // A non-empty swipe motion; push it back on:
        CURRENT_SWIPES.push(latest_swipe);
      }
      update_current_glyphs();
      DO_REDRAW = true;
    }
    document.ontouchcancel = document.onmouseup

    document.onmousemove = function (e) {
      LAST_MOUSE_POSITION = canvas_position_of_event(e);
      if (e.preventDefault) { e.preventDefault(); }
      // dispatch to menu system first:
      var vpos = canvas_position_of_event(e);
      if (menu.mousemove(vpos)) { return; }
      if (CURRENT_SWIPES.length == 0 || SWIPING == false) {
        return;
      }
      var combined_swipe = combine_arrays(CURRENT_SWIPES);
      var wpos = draw.world_pos(CTX, vpos);
      var gpos = grid.grid_pos(wpos);
      var head = null;
      if (combined_swipe.length > 0) {
        head = combined_swipe[combined_swipe.length - 1];
      }
      var is_used = false;
      var is_prev = false;
      var is_head = false;
      combined_swipe.forEach(function (prpos, idx) {
        if ("" + prpos == "" + gpos) {
          is_used = true;
          if (idx == combined_swipe.length - 1) {
            is_head = true;
          } else if (idx == combined_swipe.length - 2) {
            is_prev = true;
          }
        }
      });
      var latest_swipe = CURRENT_SWIPES[CURRENT_SWIPES.length -1];
      if (is_used) {
        if (is_prev) {
          if (latest_swipe.length > 0) {
            // only pop from an active swipe
            latest_swipe.pop();
            update_current_glyphs();
            if (latest_swipe.length > 0) {
              LAST_POSITION = latest_swipe[latest_swipe.length - 1];
            } else if (combined_swipe.length > 1) {
              LAST_POSITION = combined_swipe[combined_swipe.length - 2];
            }
            DO_REDRAW = true;
          }
        }
        // else do nothing, we're on a tile that's already part of the
        // current swipe.
      } else {
        // for tiles that aren't part of the swipe already:
        if (head == null || grid.is_neighbor(head, gpos)) {
          // add them if they're a neighbor of the head
          latest_swipe.push(gpos);
          update_current_glyphs();
          LAST_POSITION = gpos;
          DO_REDRAW = true;
        }
      }
    }
    document.ontouchmove = document.onmousemove;

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
      DO_REDRAW = true;
    }

    document.onkeydown = function (e) {
      if (COMMANDS.hasOwnProperty(e.key)) {
        COMMANDS[e.key](e);
      }
    }
  }

  function is_selected(gpos) {
    // Tests whether the given position is selected by a current swipe.
    var combined_swipe = combine_arrays(CURRENT_SWIPES);
    var result = false;
    combined_swipe.forEach(function (prpos) {
      if ("" + prpos == "" + gpos) {
        result = true;
      }
    });
    return result;
  }

  function animate(now) {
    if (!DO_REDRAW) {
      window.requestAnimationFrame(animate);
      return;
    }
    DO_REDRAW = false;
    // draw the world
    CTX.clearRect(0, 0, CTX.cwidth, CTX.cheight);
    draw.draw_tiles(CTX);
    if (CURRENT_SWIPES.length > 0) {
      CURRENT_SWIPES.forEach(function (swipe, index) {
        if (index == CURRENT_SWIPES.length - 1) {
          draw.draw_swipe(CTX, swipe, true);
        } else {
          draw.draw_swipe(CTX, swipe, false);
        }
      });
    }
    // Draw current glyphs (TODO: Change this into a menu?)
    if (CURRENT_GLYPHS != null) {
      if (SOFAR_FADE > 0) {
        DO_REDRAW = true;
        SOFAR_FADE *= 0.75;
        if (SOFAR_FADE < 0.1) {
          SOFAR_FADE = 0;
        }
      }
      var c = draw.interp_color(SOFAR_BORDER, SOFAR_FADE, SOFAR_HIGHLIGHT);
      draw.draw_sofar(CTX, CURRENT_GLYPHS, c);
    }

    // Draw menus:
    if (menu.draw_active(CTX)) {
      DO_REDRAW = true;
    }

    // DEBUG: Uncomment this to draw a cursor; causes animation every frame
    // while the mouse is moving.
    /*
    DO_REDRAW = true;
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
  };
});
