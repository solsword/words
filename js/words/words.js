// words.js
// Word game.

define(
[
  "./draw",
  "./content",
  "./grid",
  "./dimensions",
  "./dict",
  "./generate",
  "./menu",
  "./animate",
],
function(draw, content, grid, dimensions, dict, generate, menu, animate) {

  var VIEWPORT_SIZE = 800.0;

  var SWIPING = false;
  var SCROLL_REFERENT = undefined;
  var CURRENT_SWIPES = [];
  var SEL_CLEAR_ANIM = undefined;
  var EN_CLEAR_ANIM = undefined;
  var LAST_POSITION = [0, 0];

  var CURRENT_DIMENSION = 0;

  // Mouse scroll correction factors:
  var PIXELS_PER_LINE = 18;
  var LINES_PER_PAGE = 40;

  // TODO: Remove this DEBUG
  // var LAST_MOUSE_POSITION = [0, 0];

  var RESIZE_TIMEOUT = 20; // milliseconds

  // How many frames before we need to redraw?
  var DO_REDRAW = undefined;

  // Which animation frame we're on.
  var ANIMATION_FRAME = 0;

  var SOFAR_BORDER = "#555";
  var SOFAR_HIGHLIGHT = "#ccc";
  var SOFAR_FADE = 0.0;

  // Word tracking:
  var WORDS_FOUND = {};
  var WORDS_LIST = [];

  // Menus:
  var WORDS_LIST_MENU = null;
  var WORDS_SIDEBAR = null;
  var ABOUT_TOGGLE = null;
  var ABOUT_DIALOG = null;
  var HOME_BUTTON = null;
  var CLEAR_SELECTION_BUTTON = null;
  var RESET_ENERGY_BUTTON = null;
  var CURRENT_GLYPHS_BUTTON = null;

  // Timing:
  var MISSING_TILE_RETRY = 10;
  var LOADING_RETRY = 10;

  // Grid test:
  var GRID_TEST_DATA = undefined;

  function find_word(word, gp) {
    DO_REDRAW = 0;
    if (WORDS_FOUND.hasOwnProperty(word)) {
      WORDS_FOUND[word].push(gp);
    } else {
      WORDS_FOUND[word] = [ gp ];
      WORDS_LIST.push(word);
    }
  }

  function home_view() {
    var wpos = grid.world_pos([0, 0]);
    CTX.viewport_center[0] = wpos[0];
    CTX.viewport_center[1] = wpos[1];
    DO_REDRAW = 0;
  }

  var COMMANDS = {
    // DEBUG:
    "d": function (e) {
      CURRENT_DIMENSION += 1;
      CURRENT_DIMENSION %= dimensions.MULTIPLANAR_DOMAINS.length;
      DO_REDRAW = 0;
    },
    // DEBUG
    "s": function (e) { generate.toggle_socket_colors(); },
    " ": test_selection, // spacebar checks current word
    // escape removes all current selections
    "Escape": function () {
      clear_selection(
        CLEAR_SELECTION_BUTTON.center(),
        { "color": CLEAR_SELECTION_BUTTON.style.text_color }
      );
    },
    // z removes energized objects
    "z": function () {
      clear_energy(
        RESET_ENERGY_BUTTON.center(),
        { "color": RESET_ENERGY_BUTTON.style.text_color }
      );
    },
    // tab recenters view on current/last swipe head
    "Tab": function (e) {
      if (e.preventDefault) { e.preventDefault(); }
      var wpos = grid.world_pos(LAST_POSITION);
      CTX.viewport_center[0] = wpos[0];
      CTX.viewport_center[1] = wpos[1];
      DO_REDRAW = 0;
    },
    // shows 'about' dialog
    "a": function (e) {
      ABOUT_TOGGLE.toggle();
      DO_REDRAW = 0;
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
        CURRENT_GLYPHS_BUTTON.remove_glyph();
      }
      DO_REDRAW = 0;
    }
  }

  var GRID_TEST_COMMANDS = {
  }

  function clear_selection(destination, style) {
    // Clears the selection, animating lines from each selected tile to the
    // given destination. Just clears it instantly without animation if no
    // destination is given.
    if (destination == undefined) {
      CURRENT_SWIPES = [];
      CURRENT_GLYPHS_BUTTON.set_glyphs([]);
      if (SEL_CLEAR_ANIM != undefined) {
        animate.stop_animation(SEL_CLEAR_ANIM);
        SEL_CLEAR_ANIM = undefined;
      }
      DO_REDRAW = 0;
    } else {
      if (SEL_CLEAR_ANIM != undefined) {
        if (!animate.is_active(SEL_CLEAR_ANIM)) {
          SEL_CLEAR_ANIM = undefined;
        } else {
          return; // there's a clear animation already in-flight
        }
      }
      var combined_swipe = combine_arrays(CURRENT_SWIPES);
      var lines = [];
      combined_swipe.forEach(
        function (gp) {
          var wp = grid.world_pos(gp);
          var vp = draw.view_pos(CTX, wp);
          lines.push(
            new animate.MotionLine(
              CTX,
              animate.INSTANT,
              undefined,
              vp,
              destination,
              style
            )
          );
        }
      );
      SEL_CLEAR_ANIM = new animate.AnimGroup(
        CTX,
        animate.INSTANT, 
        function () {
          CURRENT_SWIPES = [];
          CURRENT_GLYPHS_BUTTON.set_glyphs([]);
        },
        lines
      );
      animate.activate_animation(SEL_CLEAR_ANIM);
      DO_REDRAW = 0;
    }
  }

  function clear_energy(destination, style) {
    // Clears energized positions, animating lines to the given destination in
    // the given style. If destination is undefined, just clears things
    // immediately.
    if (destination == undefined) {
      content.reset_energy();
      if (EN_CLEAR_ANIM != undefined) {
        animate.stop_animation(EN_CLEAR_ANIM);
        EN_CLEAR_ANIM = undefined;
      }
      DO_REDRAW = 0;
    } else {
      if (EN_CLEAR_ANIM != undefined) {
        if (!animate.is_active(EN_CLEAR_ANIM)) {
          EN_CLEAR_ANIM = undefined;
        } else {
          return; // there's a clear animation already in-flight
        }
      }
      var lines = [];
      content.energized_positions().forEach(
        function (entry) {
          var gp = entry["position"];
          var wp = grid.world_pos(gp);
          var vp = draw.view_pos(CTX, wp);
          lines.push(
            new animate.MotionLine(
              CTX,
              animate.INSTANT,
              undefined,
              vp,
              destination,
              style
            )
          );
        }
      );
      EN_CLEAR_ANIM = new animate.AnimGroup(
        CTX,
        animate.INSTANT, 
        function () {
          content.reset_energy();
        },
        lines
      );
      animate.activate_animation(EN_CLEAR_ANIM);
      DO_REDRAW = 0;
    }
    DO_REDRAW = 0;
  }

  function test_selection() {
    var combined_swipe = combine_arrays(CURRENT_SWIPES);
    var domains = new Set();
    combined_swipe.forEach(function (gp) {
      var tile = content.tile_at(CURRENT_DIMENSION, gp);
      if (tile != null) {
        generate.domains_list(tile.domain).forEach(function (d) {
          domains.add(d);
        });
      }
    });
    var entries = dict.check_word(CURRENT_GLYPHS_BUTTON.glyphs, domains);
    if (entries.length > 0) {
      // Found a match:
      var connected = false;
      combined_swipe.forEach(function (gp) {
        if (content.is_unlocked(CURRENT_DIMENSION, gp)) {
          connected = true;
        }
      });
      if (connected) {
        // Match is connected:
        // clear our swipes and glyphs and add to our words found
        content.unlock_path(CURRENT_DIMENSION, combined_swipe);
        entries.forEach(function (e) {
          find_word(e[1], combined_swipe[0]);
        });
        clear_selection(
          CURRENT_GLYPHS_BUTTON.center(),
          { "color": "#fff" }
        );
        // Highlight in white:
        CURRENT_GLYPHS_BUTTON.flash("#fff");
      } else {
        // Highlight in yellow:
        CURRENT_GLYPHS_BUTTON.flash("#ff2");
      }
    } else {
      // No match found: just highlight in red
      CURRENT_GLYPHS_BUTTON.flash("#f22");
    }
    DO_REDRAW = 0;
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

  function which_click(e) {
    if (e.touches) {
      if (e.touches.length > 1) {
        return "auxiliary";
      } else {
        return "primary";
      }
    } else {
      if (e.button == 0) {
        return "primary";
      } else if (e.button == 1) {
        return "auxiliary";
      } else if (e.button == 2) {
        return "secondary";
      } else {
        return "tertiary";
      }
    }
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
    DO_REDRAW = 0;
    menu.set_canvas_size([CANVAS.width, CANVAS.height]);
  }

  function update_current_glyphs() {
    var glyphs = []
    CURRENT_SWIPES.forEach(function (sw) {
      sw.forEach(function (gp) {
        var g = content.tile_at(CURRENT_DIMENSION, gp)["glyph"];
        if (g == undefined) { // should never happen in theory:
          console.log(
            "InternalError: update_current_glyphs found undefined glyph at: "
          + gp
          );
          g = "?";
        }
        glyphs.push(g);
      });
    });
    CURRENT_GLYPHS_BUTTON.set_glyphs(glyphs);
  }

  function handle_primary_down(ctx, e) {
    // dispatch to menu system first:
    var vpos = canvas_position_of_event(e);
    if (menu.mousedown(vpos, "primary")) { return; }
    var wpos = draw.world_pos(ctx, vpos);
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
    var tile = content.tile_at(CURRENT_DIMENSION, gpos);
    if (tile.domain == "__object__") {
      // an object: just energize it
      // TODO: Energize preconditions
      content.energize_tile(CURRENT_DIMENSION, gpos);
    } else {
      // a normal tile: select it
      if (
        !is_selected(gpos)
        && (head == null || grid.is_neighbor(head, gpos))
        && tile.glyph != undefined
      ) {
        CURRENT_SWIPES.push([gpos]);
        update_current_glyphs();
        LAST_POSITION = gpos;
      } else {
        CURRENT_SWIPES.push([]);
      }
      SWIPING = true;
    }
    DO_REDRAW = 0;
  }

  function handle_auxiliary_down(ctx, e) {
    var vpos = canvas_position_of_event(e);
    if (menu.mousedown(vpos, "auxiliary")) { return; }
    SCROLL_REFERENT = vpos.slice();
  }

  function handle_primary_up(ctx, e) {
    // dispatch to menu system first:
    var vpos = canvas_position_of_event(e);
    if (menu.mouseup(vpos)) {
      DO_REDRAW = 0;
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
    DO_REDRAW = 0;
  }

  function handle_auxiliary_up(ctx, e) {
    var vpos = canvas_position_of_event(e);
    if (menu.mouseup(vpos, "auxiliary")) { return; }
    SCROLL_REFERENT = undefined;
  }

  function handle_movement(ctx, e) {
    // dispatch to menu system first:
    var vpos = canvas_position_of_event(e);
    if (menu.mousemove(vpos)) { DO_REDRAW = 0; return; }
    if (SCROLL_REFERENT != undefined) {
      // scrolling w/ aux button or two fingers
      var dx = vpos[0] - SCROLL_REFERENT[0];
      var dy = vpos[1] - SCROLL_REFERENT[1];

      SCROLL_REFERENT = vpos.slice();

      CTX.viewport_center[0] -= dx;
      CTX.viewport_center[1] += dy;
      DO_REDRAW = 0;
    } else if (SWIPING && CURRENT_SWIPES.length > 0) {
      // swiping w/ primary button or one finger
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
            DO_REDRAW = 0;
          }
        }
        // else do nothing, we're on a tile that's already part of the
        // current swipe.
      } else {
        // for tiles that aren't part of the swipe already, and which *are*
        // loaded:
        var tile = content.tile_at(CURRENT_DIMENSION, gpos);
        if (
          (head == null || grid.is_neighbor(head, gpos))
       && (tile["glyph"] != undefined && tile["domain"] != "__object__")
        ) {
          // add them if they're a neighbor of the head
          // (and not unloaded, and not an object)
          latest_swipe.push(gpos);
          update_current_glyphs();
          LAST_POSITION = gpos;
          DO_REDRAW = 0;
        }
      }
    } // else ignore this event
  }

  function handle_wheel(ctx, e) {
    var unit = e.deltaMode;
    var dx = e.deltaX;
    var dy = e.deltaY;

    // normalize units to pixels:
    if (unit == 1) {
      dx *= PIXELS_PER_LINE;
      dy *= PIXELS_PER_LINE;
    } else if (unit == 2) {
      dx *= PIXELS_PER_LINE * LINES_PER_PAGE;
      dy *= PIXELS_PER_LINE * LINES_PER_PAGE;
    }

    CTX.viewport_center[0] += dx;
    CTX.viewport_center[1] -= dy;
    DO_REDRAW = 0;
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
    DO_REDRAW = 0;

    // Unlock initial tiles
    content.unlock_path(
      CURRENT_DIMENSION,
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [-1, -1],
      ]
    );

    // kick off animation
    window.requestAnimationFrame(draw_frame);

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
    WORDS_LIST_MENU = new menu.WordList(
      CTX,
      { "right": 40, "top": 30, "bottom": 90 },
      { "width": undefined, "height": undefined },
      undefined,
      WORDS_LIST,
      "https://en.wiktionary.org/wiki/<word>"
    );

    WORDS_SIDEBAR = new menu.ToggleMenu(
      CTX,
      { "right": 0, "top": 20, "bottom": 80 },
      { "width": 40, "height": undefined },
      { "orientation": -Math.PI/2 }, 
      "WORDS",
      function () { menu.add_menu(WORDS_LIST_MENU); },
      function () { menu.remove_menu(WORDS_LIST_MENU); }
    );
    menu.add_menu(WORDS_SIDEBAR);

    ABOUT_DIALOG = new menu.Dialog(
      CTX,
      undefined,
      undefined,
      {}, 
      "This is Words, version 0.0.1.",
      [ { "text": "OK", "action": function () { ABOUT_TOGGLE.off_(); } } ]
    );

    ABOUT_TOGGLE = new menu.ToggleMenu(
      CTX,
      { "right": 10, "bottom": 10 },
      { "width": 40, "height": 40 },
      {},
      "?",
      function () { menu.add_menu(ABOUT_DIALOG); },
      function () { menu.remove_menu(ABOUT_DIALOG); },
    );
    menu.add_menu(ABOUT_TOGGLE);

    HOME_BUTTON = new menu.ButtonMenu(
      CTX,
      { "left": 10, "top": 10 },
      { "width": 40, "height": 40 },
      {},
      "🏠",
      home_view
    );
    menu.add_menu(HOME_BUTTON);

    CLEAR_SELECTION_BUTTON = new menu.ButtonMenu(
      CTX,
      { "left": 10, "bottom": 10 },
      { "width": 40, "height": 40 },
      {
        "background_color": "#310",
        "border_color": "#732",
        "text_color": "#d43"
      },
      "⊗",
      function () {
        clear_selection(
          CLEAR_SELECTION_BUTTON.center(),
          { "color": CLEAR_SELECTION_BUTTON.style.text_color }
        );
      }
    );
    menu.add_menu(CLEAR_SELECTION_BUTTON);

    RESET_ENERGY_BUTTON = new menu.ButtonMenu(
      CTX,
      { "left": 10, "bottom": 60 },
      { "width": 40, "height": 40 },
      {
        "background_color": "#330",
        "border_color": "#661",
        "text_color": "#dd2",
      },
      "⮏",
      function () {
        clear_energy(
          RESET_ENERGY_BUTTON.center(),
          { "color": RESET_ENERGY_BUTTON.style.text_color }
        );
      }
    );
    menu.add_menu(RESET_ENERGY_BUTTON);

    CURRENT_GLYPHS_BUTTON = new menu.GlyphsMenu(
      CTX,
      { "bottom": 10 },
      { "width": undefined, "height": 40 },
      {
        "background_color": "#000",
        "border_color": "#888",
        "text_color": "#fff"
      },
      "",
      test_selection
    );
    menu.add_menu(CURRENT_GLYPHS_BUTTON);

    // set up event handlers
    document.onmousedown = function (e) {
      if (e.preventDefault) { e.preventDefault(); }
      var which = which_click(e);
      if (which == "primary") {
        handle_primary_down(CTX, e);
      } else if (which == "auxiliary") {
        handle_auxiliary_down(CTX, e);
      } // otherwise ignore this click
    }
    document.ontouchstart = document.onmousedown;

    document.onmouseup = function(e) {
      // TODO: Menus
      if (e.preventDefault) { e.preventDefault(); }
      var which = which_click(e);
      if (which == "primary") {
        handle_primary_up(CTX, e);
      } else if (which == "auxiliary") {
        handle_auxiliary_up(CTX, e);
      } // otherwise ignore this click
      // Reset scroll referent anyways just to be sure:
      SCROLL_REFERENT = undefined;
    }
    document.ontouchcancel = document.onmouseup

    document.onmousemove = function (e) {
      // TODO: Remove this debug
      // LAST_MOUSE_POSITION = canvas_position_of_event(e);
      if (e.preventDefault) { e.preventDefault(); }
      handle_movement(CTX, e);
    }
    document.ontouchmove = document.onmousemove;

    // TODO: Make this passive? (see chromium verbose warning)
    document.onwheel = function (e) {
      if (e.preventDefault) { e.preventDefault(); }
      handle_wheel(CTX, e);
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

  function draw_frame(now) {
    ANIMATION_FRAME += 1; // count frames
    ANIMATION_FRAME %= animate.ANIMATION_FRAME_MAX;
    // TODO: Normalize frame count to passage of time!
    if (DO_REDRAW == undefined) {
      window.requestAnimationFrame(draw_frame);
      return;
    } else if (DO_REDRAW > 0) {
      DO_REDRAW -= 1;
      window.requestAnimationFrame(draw_frame);
      return;
    }
    DO_REDRAW = undefined;
    // draw the world
    CTX.clearRect(0, 0, CTX.cwidth, CTX.cheight);
    if (!draw.draw_tiles(CURRENT_DIMENSION, CTX)) {
      DO_REDRAW = MISSING_TILE_RETRY;
    };
    if (CURRENT_SWIPES.length > 0) {
      CURRENT_SWIPES.forEach(function (swipe, index) {
        if (index == CURRENT_SWIPES.length - 1) {
          draw.draw_swipe(CTX, swipe, true);
        } else {
          draw.draw_swipe(CTX, swipe, false);
        }
      });
    }

    // Draw loading bars for domains:
    var loading = dict.LOADING;
    var lks = [];
    for (var l in loading) {
      if (loading.hasOwnProperty(l)) {
        lks.push(l);
      }
    }
    if (lks.length > 0) {
      lks.sort();
      if (draw.draw_loading(CTX, lks, loading)) {
        DO_REDRAW = LOADING_RETRY;
      }
    }

    // Draw menus:
    if (menu.draw_active(CTX)) {
      DO_REDRAW = 0;
    }

    // Draw animations:
    var next_horizon = animate.draw_active(CTX, ANIMATION_FRAME);
    if (
      next_horizon != undefined
   && (
       DO_REDRAW == undefined
    || DO_REDRAW > next_horizon
      )
    ) {
      DO_REDRAW = next_horizon;
    }

    // DEBUG: Uncomment this to draw a cursor; causes animation every frame
    // while the mouse is moving.
    /*
    DO_REDRAW = 0;
    CTX.strokeStyle = "#fff";
    CTX.beginPath();
    CTX.moveTo(LAST_MOUSE_POSITION[0]-3, LAST_MOUSE_POSITION[1]-3);
    CTX.lineTo(LAST_MOUSE_POSITION[0]+3, LAST_MOUSE_POSITION[1]+3);
    CTX.moveTo(LAST_MOUSE_POSITION[0]+3, LAST_MOUSE_POSITION[1]-3);
    CTX.lineTo(LAST_MOUSE_POSITION[0]-3, LAST_MOUSE_POSITION[1]+3);
    CTX.stroke();
    // */

    // reschedule ourselves
    window.requestAnimationFrame(draw_frame);
  }

  function test_grid() {
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
    DO_REDRAW = 0;

    // set up test data:
    // TODO: Keybinding to swap seeds?
    GRID_TEST_DATA = [
      [ [0, 0], generate.generate_test_supertile([0, 0], 28012) ],
      [ [1, 0], generate.generate_test_supertile([1, 0], 28012) ],
      [ [-1, 0], generate.generate_test_supertile([-1, 0], 28012) ],
      [ [0, 1], generate.generate_test_supertile([0, 1], 28012) ],
      [ [-1, 1], generate.generate_test_supertile([-1, 1], 28012) ],
      [ [0, -1], generate.generate_test_supertile([0, -1], 28012) ],
      [ [1, -1], generate.generate_test_supertile([1, -1], 28012) ],
    ];

    // kick off animation
    window.requestAnimationFrame(animate_grid_test);

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

    document.onkeydown = function (e) {
      if (GRID_TEST_COMMANDS.hasOwnProperty(e.key)) {
        GRID_TEST_COMMANDS[e.key](e);
      }
    }
  }

  function animate_grid_test(now) {
    if (DO_REDRAW == undefined) {
      window.requestAnimationFrame(animate_grid_test);
      return;
    } else if (DO_REDRAW > 0) {
      DO_REDRAW -= 1;
      window.requestAnimationFrame(animate_grid_test);
      return;
    }
    DO_REDRAW = undefined;

    // draw the test supertile
    CTX.clearRect(0, 0, CTX.cwidth, CTX.cheight);
    for (var i = 0; i < GRID_TEST_DATA.length; ++i) {
      var item = GRID_TEST_DATA[i];
      var sgp = [ item[0][0], item[0][1], 0, 0 ];
      var st = item[1];
      draw.draw_supertile(CTX, sgp, st);
    }

    // Draw loading bars for domains:
    var loading = dict.LOADING;
    var lks = [];
    for (var l in loading) {
      if (loading.hasOwnProperty(l)) {
        lks.push(l);
      }
    }
    if (lks.length > 0) {
      lks.sort();
      if (draw.draw_loading(CTX, lks, loading)) {
        DO_REDRAW = LOADING_RETRY;
      }
    }

    // reschedule ourselves
    window.requestAnimationFrame(animate_grid_test);
  }

  return {
    "start_game": start_game,
    "test_grid": test_grid
  };
});
