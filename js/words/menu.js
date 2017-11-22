// menu.js
// Menu system for HTML5 canvas.

define(["./draw"], function(draw) {
  var MENUS = [];

  var MYCLICK = false;
  var DOWNPOS = null;
  var TARGET = null;
  var HIT = false;
  var PATH = null;

  var SWIPE_THRESHOLD = 30;

  var Dialog = {
  };

  var ButtonMenu = {
  };

  var UnfoldingMenu = {
  };

  // TODO: HERE
  var 

  function add_menu(menu) {
    // Adds the given menu to the top of the active menus list.
    MENUS.push(menu);
  }

  function remove_menu(menu) {
    // Removes the given menu from the active menus list.
    var t = null;
    for (i = 0; i < MENUS.length; i += 1) {
      if (MENUS[i] == menu) {
        t = i;
        break;
      }
    }
    if (t != null) {
      MENUS = MENUS.slice(0,t).concat(MENUS.slice(t+1))
    }
  }

  function call_if_available(obj, fname, args) {
    // Calls the given function of the given object with the given arguments,
    // if that object has such a function. Returns the function's return value,
    // or undefined if no such function exists.
    var fcn = obj[fname]
    if (fcn != undefined) {
      return fcn.apply(obj, args);
    } else {
      return undefined;
    }
  }

  function handle_press(menu, pos, hit) {
    // Handles initial presses.
    call_if_available(menu, "press", [pos, hit]);
  }

  function handle_hover(menu, path, hit) {
    // Handles motion during a press.
    call_if_available(menu, "hover", [path, hit]);
  }

  function handle_tap(menu, pos, hit) {
    // Handles press/release pairs with low intervening motion.
    call_if_available(menu, "tap", [pos, hit]);
  }

  function handle_swipe(menu, path, st_hit, ed_hit) {
    // Handles press/release pairs with high motion.
    call_if_available(menu, "swipe", [path, st_hit, ed_hit]);
  }

  function handle_bridge(smenu, tmenu, fpath, r_hit, to_hit) {
    // Handles press/release pairs where different menus are hit.
    call_if_available(smenu, "bridge_to", [tmenu, path, fr_hit, to_hit]);
    call_if_available(tmenu, "bridge_from", [smenu, path, fr_hit, to_hit]);
  }

  function clear_context() {
    // Clears all click-tracking context variables.
    MYCLICK = false;
    DOWNPOS = null;
    TARGET = null;
    HIT = false;
    PATH = null;
  }

  function mousedown(vpos) {
    // Call for every mouse down event on the canvas, and only trigger other
    // behavior if this function returns false.

    // Iterate in reverse order; top menu is last.
    for (var i = MENUS.length-1; i > -1; i -= 1) {
      var m = MENUS[i];
      if (hits_menu(vpos, m)) { // menu hit
        MYCLICK = true;
        DOWNPOS = vpos;
        TARGET = m;
        HIT = true;
        PATH = [vpos];
        handle_press(m, vpos, HIT);
        return true;
      } else if (m.modal) { // miss on a modal menu
        MYCLICK = true;
        DOWNPOS = vpos;
        TARGET = m;
        HIT = false;
        PATH = [vpos];
        handle_press(m, vpos, HIT);
        return true;
      }
      // else miss on a non-modal menu; continue checking other menus
    }
    // Reset these variables just in case...
    clear_context()
    // Doesn't hit any menu, and none are modal
    return false;
  }

  function mousemove(vpos) {
    // Call for every mouse motion event on the canvas, and only trigger other
    // behavior if this function returns false.
    if (MYCLICK) {
      PATH.push(vpos);
      handle_hover(TARGET, PATH, HIT);
      return true;
    } else {
      return false;
    }
  }

  function path_total_dist(path) {
    // Computes total distance from a path.
    var dist = 0;
    var prev = PATH[0];
    for (var i = 1; i < PATH.length; i += 1) {
      var dx = prev[0] - PATH[i][0];
      var dy = prev[1] - PATH[i][1];
      dist += Math.sqrt(dx*dx + dy*dy);
      prev = PATH[i];
    }
    return dist;
  }

  function path_straight_dist(path) {
    // Computes straight-line start-to-end distance from a path.
    var dx = PATH[PATH.length-1][0] - PATH[0][0];
    var dy = PATH[PATH.length-1][1] - PATH[0][1];
    return Math.sqrt(dx*dx + dy*dy);
  }

  function path_straight_vector(path) {
    // Computes straight-line start-to-end vector from a path.
    var dx = PATH[PATH.length-1][0] - PATH[0][0];
    var dy = PATH[PATH.length-1][1] - PATH[0][1];
    return [dx, dy];
  }

  function mouseup(vpos) {
    // Call for every mouse up event on the canvas, and only trigger other
    // behavior if this function returns false.
    if (!MYCLICK) { return false; }

    var is_swipe = path_total_dist(PATH) > SWIPE_THRESHOLD;

    // Iterate in reverse order because top menu is last in list.
    for (var i = MENUS.length-1; i > -1; i -= 1) {
      var m = MENUS[i];
      if (hits_menu(vpos, m)) { // menu hit
        if (m == TARGET) {
          if (is_swipe) {
            handle_swipe(m, PATH, HIT, true);
          } else {
            handle_tap(m, vpos, true);
          }
        } else {
          handle_bridge(TARGET, m, PATH, HIT, true);
        }
        clear_context();
        return true;
      } else if (m.modal) { // miss on a modal menu
        if (m == TARGET) {
          if (is_swipe) {
            handle_swipe(m, PATH, HIT, false);
          } else {
            handle_tap(m, vpos, false);
          }
        } else {
          handle_bridge(TARGET, m, PATH, HIT, false);
        }
        clear_context();
        return true;
      }
      // else miss on a non-modal menu; continue checking other menus
    }
    // to get here we must miss all menus, and none can be modal
    clear_context()
    return false;
  }

  return {
    "SWIPE_THRESHOLD": SWIPE_THRESHOLD,
    "add_menu": add_menu,
    "remove_menu": remove_menu,
    "mousedown": mousedown,
    "mousemove": mousemove,
    "mouseup": mouseup,
  };
});
