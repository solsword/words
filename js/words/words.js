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
  "./utils",
  "./quests",
],
function(
  draw,
  content,
  grid,
  dimensions,
  dict,
  generate,
  menu,
  animate,
  utils,
  quests,
) {

  var VIEWPORT_SIZE = 800.0;

  var SWIPING = false;
  var PRESS_RECORDS = [undefined, undefined];
  var LAST_RELEASE = undefined;
  var DBL_TIMEOUT = 500;
  var DBL_DIST = 10;
  var SCROLL_REFERENT = undefined;
  var CURRENT_SWIPES = [];
  var ACTIVE_POKES = [];
  // TODO: ADJUST THIS
  var POKE_DELAY = 24; // delay before a poke happens in seconds
  var SEL_CLEAR_ANIM = undefined;
  var EN_CLEAR_ANIM = undefined;
  var LAST_POSITION = [0, 0];
  var MS_PER_FRAME = 1000/60;
  // TODO: Measure this!

  // TODO: DEBUG
  var CURRENT_DIMENSION = ["F/R", "base", 10983];
  /*/ *
  var CURRENT_DIMENSION = [
    "P/D/F",
    "base",
    10985
  ]
  var CURRENT_DIMENSION = [
    "C/C/B",
    "base",
    10985,
    // ["THIS", "IS", "A", "POCKET", "TEST"]
    [
      "ABACUS",
      "BENEVOLENCE",
      "CONCEPTUALIZATION",
      "DECADENT",
      "ENDOMETRIUM",
      "FUNCTION",
      "GABBRO",
      "HYPHENATION",
      "INFLORESCENCE",
      "JUBILEE",
      "KIDNEY",
      "LEAVENING",
      "MONGOOSE",
      "NIQAB",
      "OATH",
      "PHALANX",
      "QUADRILATERAL",
      "RADIUM",
      "SEVERANCE",
      "TRANSCENDENCE",
      "ULNA",
      "VACCINE",
      "WIZARDRY",
      "XENOPHOBIA",
      "YUCCA",
      "ZYGOTE",
    ]
    // TODO: how to make sure words are in the domain?!?
  ];
  // */

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
  var FOUND_LISTS = {}; // per dimension

  // quests
  var QUESTS = [];

  // Menus:
  var QUEST_MENU = null;
  var QUEST_SIDEBAR = null;
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

  function found_list(dimension) {
    // Returns (possibly after creating) the found list for the given dimension
    let dk = dimensions.dim__key(dimension);
    if (!FOUND_LISTS.hasOwnProperty(dk)) {
      FOUND_LISTS[dk] = [];
    }
    return FOUND_LISTS[dk];
  }

  function find_word(dimension, word, path) {
    DO_REDRAW = 0;
    // Insert into global found map:
    if (WORDS_FOUND.hasOwnProperty(word)) {
      WORDS_FOUND[word].push([dimension, path[0]]);
    } else {
      WORDS_FOUND[word] = [ [dimension, path[0]] ];
    }

    // Insert into per-dimension alphabetized found list:
    let fl = found_list(dimension);
    let st = 0;
    let ed = fl.length;
    let idx = st + Math.floor((ed - st)/2);
    while (ed - st > 0) {
      if (word < fl[idx]) {
        ed = idx;
      } else if (word > fl[idx]) {
        st = idx + 1;
      } else {
        // found it!
        break;
      }
      idx = st + Math.floor((ed - st)/2);
    }

    if (fl[idx] == undefined) { // empty list
      fl[idx] = word;
    } else if (fl[idx] > word) {
      fl.splice(idx, 0, word);
    } else if (fl[idx] < word) {
      fl.splice(idx + 1, 0, word);
    } // else it's already there!

    // Update active quests:
    for (var q of QUESTS) {
      q.find_word(dimension, word, path)
    }
  }


  function add_quest(q) {
    q.initialize(WORDS_FOUND);
    QUESTS.push(q);
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
      CURRENT_DIMENSION = dimensions.neighboring_dimension(CURRENT_DIMENSION,1);
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
    },
    // TODO: DEBUG
    "q": function (e) { // "find' a bunch of words for testing purposes
      for (let w of "abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()") {
        find_word(CURRENT_DIMENSION, w, []);
      }
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
          find_word(CURRENT_DIMENSION, e[2], combined_swipe);
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
          console.warn(
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

    // No matter what, we're not swiping any more
    SWIPING = false;

    // Check for double-click/tap:
    let isdbl = false;
    if (LAST_RELEASE != undefined) {
      let dx = vpos[0] - LAST_RELEASE[0];
      let dy = vpos[1] - LAST_RELEASE[1];
      let dt = window.performance.now() - PRESS_RECORDS[0];
      let rdist = Math.sqrt(dx*dx + dy*dy);
      isdbl = dt <= DBL_TIMEOUT && rdist <= DBL_DIST;
    }

    if (isdbl) {
      // this is a double-click or double-tap
      // Get rid of last two swipes & update glyphs
      CURRENT_SWIPES.pop();
      CURRENT_SWIPES.pop();
      update_current_glyphs();
      // Find grid position and check adjacency
      let wp = draw.world_pos(ctx, vpos);
      let gp = grid.grid_pos(wp);
      let valid = false;
      for (let d = 0; d < 6; ++d) {
        let np = grid.neighbor(gp, d);
        if (content.is_unlocked(CURRENT_DIMENSION, np)) {
          valid = true;
          break;
        }
      }
      if (valid) {
        let entry = [ CURRENT_DIMENSION, gp, window.performance.now() ];
        let found = undefined;
        var found_time;
        for (let i = 0; i < ACTIVE_POKES.length; ++i) {
          if (
            utils.is_equal(ACTIVE_POKES[i][0], entry[0])
         && utils.is_equal(ACTIVE_POKES[i][1], entry[1])
          ) {
            found = i;
            break;
          }
        }
        if (found != undefined) {
          // TODO: Cancel the poke instead?
          entry[2] = ACTIVE_POKES[found][2];
          ACTIVE_POKES.splice(found, 1);
        }
        ACTIVE_POKES.push(entry);
        if (ACTIVE_POKES.length > content.POKE_LIMIT) {
          ACTIVE_POKES.shift();
        }
      }
      DO_REDRAW = 0;
    } else {
      // this is just a normal mouseup
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
    // TODO: Better/different here?
    content.unlock_path(
      CURRENT_DIMENSION,
      [
        [0, 0],
        [1, 0],
        [0, 1],
        [-1, -1],
      ]
    );

    // Grant starting quest
    // TODO: Better/different here?
    add_quest(
      new quests.HuntQuest(
        ["FIND", "SIN", "S*R"],
        ["DIS___ER"],
        undefined, // params
        undefined // reward
      )
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
    QUEST_MENU = new menu.QuestList(
      CTX,
      { "left": "50%", "right": 40, "top": 30, "bottom": 90 },
      { "width": undefined, "height": undefined },
      undefined,
      QUESTS
    );

    QUEST_SIDEBAR = new menu.ToggleMenu(
      CTX,
      { "right": 0, "top": 80 },
      { "width": 40, "height": 40 },
      undefined, 
      "!",
      function () {
        WORDS_SIDEBAR.off();
        menu.add_menu(QUEST_MENU);
      },
      function () {
        menu.remove_menu(QUEST_MENU);
      }
    );
    menu.add_menu(QUEST_SIDEBAR);

    WORDS_LIST_MENU = new menu.WordList(
      CTX,
      { "left": "50%", "right": 40, "top": 30, "bottom": 90 },
      { "width": undefined, "height": undefined },
      undefined,
      found_list(CURRENT_DIMENSION),
      "https://en.wiktionary.org/wiki/<item>"
    );
    // TODO: Swap items list when dimension changes
    // TODO: Some way to do so manually?

    WORDS_SIDEBAR = new menu.ToggleMenu(
      CTX,
      { "right": 0, "top": 120 },
      { "width": 40, "height": 40 },
      undefined, 
      "🗍",
      function () {
        QUEST_SIDEBAR.off();
        menu.add_menu(WORDS_LIST_MENU);
      },
      function () {
        menu.remove_menu(WORDS_LIST_MENU);
      }
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
        PRESS_RECORDS[0] = PRESS_RECORDS[1];
        PRESS_RECORDS[1] = window.performance.now();
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
        LAST_RELEASE = canvas_position_of_event(e);
      } else if (which == "auxiliary") {
        handle_auxiliary_up(CTX, e);
      } // otherwise ignore this click
      // Reset scroll referent anyways just to be sure:
      SCROLL_REFERENT = undefined;
    }
    document.ontouchend = document.onmouseup
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
    var ms_time = window.performance.now();
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
    CURRENT_SWIPES.forEach(function (swipe, index) {
      if (index == CURRENT_SWIPES.length - 1) {
        draw.draw_swipe(CTX, swipe, true);
      } else {
        draw.draw_swipe(CTX, swipe, false);
      }
    });
    var poke_redraw_after = undefined;
    var finished_pokes = [];
    ACTIVE_POKES.forEach(function (poke, index) {
      if (utils.is_equal(CURRENT_DIMENSION, poke[0])) {
        let initiated_at = poke[2];
        let age = now - initiated_at;
        let ticks = Math.floor(age/1000);
        let until_tick = 1000 - age % 1000;

        draw.draw_poke(CTX, poke, ticks, POKE_DELAY);

        let frames_left = Math.ceil(until_tick / MS_PER_FRAME);
        if (poke_redraw_after == undefined || poke_redraw_after > frames_left) {
          poke_redraw_after = frames_left;
        }
        if (ticks >= POKE_DELAY) {
          finished_pokes.push(index);
        }
      }
    });
    if (finished_pokes.length > 0) {
      // remove & process finished pokes
      DO_REDRAW = 0;
      let adj = 0;
      for (let i = 0; i < finished_pokes.length; ++i) {
        let active = ACTIVE_POKES[i - adj];
        content.unlock_poke(active[0], active[1]);
        ACTIVE_POKES.splice(i - adj, 1);
        adj += 1;
      }
    } else if (poke_redraw_after != undefined) {
      // set up redraw for remaining active pokes
      DO_REDRAW = Math.max(poke_redraw_after, 0);
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

  function clear_input_value() {
    this.setAttribute("value", "");
  }

  function select_this() {
    this.select();
  }

  function eventually_process_upload(element) {
    var files = element.files;
    if (files === null || files === undefined || files.length < 1) {
      setTimeout(eventually_process_upload, 50, element);
    } else {
      var first = files[0];
      var firstname = first.name;
      var fr = new FileReader();
      fr.onload = function (e) {
        var file_text = e.target.result;
        handle_uploaded_domain(firstname.split(".")[0], file_text);
      }
      fr.readAsText(first);
    }
  }

  function pct(n) {
    // Helper to convert a fraction to a percentage string.
    return (n * 100).toFixed(1);
  }

  function handle_uploaded_domain(name, text) {
    // Called in the domain builder once a domain file has been uploaded and we
    // have the text.
    var loading = document.getElementById("loading");
    dict.load_json_or_list_from_data(
      name,
      text,
      function (progress) {
        loading.innerText = "Counting words... " + pct(progress) + "%";
      },
      function (progress) {
        if (progress == 1) {
          loading.innerText = (
            "Done counting; done building index; transferring result... "
          );
        } else {
          loading.innerText = (
            "Done counting; building index... " + pct(progress) + "%"
          );
        }
      },
      function (name, polished) {
        loading.innerText = (
          "Recieved result..."
        );
        done_processing(name, polished);
      }
    );
  }

  function done_processing(name, output) {
    // Called when the web worker is done polishing a domain in the domain
    // builder.
    var loading = document.getElementById("loading");
    loading.innerText = (
      "Done counting; done building index; building JSON string..."
    );
    var jstring = JSON.stringify(output);
    loading.innerText = (
      "Done loading. Receive output below."
    );

    var file_input = document.getElementById("words_list");

    var output_bin = document.getElementById("output_bin");
    output_bin.removeAttribute("disabled");
    output_bin.innerText = jstring;
    output_bin.onclick = function () { this.select(); };
    output_bin.ontouchend = output_bin.onclick;

    var download_button = document.getElementById("download_button");
    download_button.removeAttribute("disabled");
    download_button.onmousedown = function () {
      var blob = new Blob([jstring], {type: "text/json;charset=utf-8"});
      var ourl = URL.createObjectURL(blob);
      var link = document.getElementById("download_link");
      link.setAttribute("href", ourl);
      link.setAttribute("download", name + ".json");
    }
  }

  function build_domains() {
    // Setup function for the domain builder.
    var file_input = document.getElementById("words_list");

    file_input.onmousedown = function () { this.setAttribute("value", ""); };
    file_input.ontouchstart = file_input.onmousedown;
    file_input.onchange = function () {
      eventually_process_upload(this);
    }
  }

  return {
    "start_game": start_game,
    "test_grid": test_grid,
    "build_domains": build_domains,
  };
});
