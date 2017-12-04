// menu.js
// Menu system for HTML5 canvas.

define(["./draw"], function(draw) {
  var MENUS = [];

  var MYCLICK = false;
  var DOWNPOS = null;
  var TARGET = null;
  var HIT = false;
  var PATH = null;

  var CANVAS_SIZE = [800, 800]; // in pixels; use set_canvas_size

  var SWIPE_THRESHOLD = 0.02; // in canvas-scales

  var NARROW_TEXT_WIDTH = 0.4; // in canvas-widths
  var MEDIUM_TEXT_WIDTH = 0.65;
  var WIDE_TEXT_WIDTH = 0.92;

  var NARROW_MAX_RATIO = 1.2;
  var MEDIUM_MAX_RATIO = 2.5;

  var TEXT_OUTLINE_WIDTH = 3;

  function set_canvas_size(sz) {
    CANVAS_SIZE = sz;
  }

  function canvas_scale() {
    // Returns the average between the canvas width and height. Useful as a
    // general metric.
    return (CANVAS_SIZE[0] + CANVAS_SIZE[1])/2;
  }

  function flow_text(ctx, text, max_width, line_height) {
    // Takes a context object, some text to flow, and a maximum width for that
    // text and returns a list of lines such that rendering each line after the
    // other with baselines separated by line_height will fit into the given
    // width. Uses only awful brute-force hyphenation when a single word is too
    // long for a line.
    var words = text.split(' ');
    var line = '';
    words.forEach(function (word, idx) {
      var test_line = null;
      if (line.length > 0) {
        test_line = line + ' ' + word;
      } else {
        test_line = word;
      }
      var m = ctx.measureText(test_line);
      if (m.width <= max_width) {
        // Next word fits:
        line = test_line;
      } else if (line == '') {
        // First word is too long: need a hyphen
        // TODO: Better hyphenation; even line-local justification, etc.
        // TODO: Don't hyphenate things like numbers?!?
        var fit = 0;
        for (i = test_line.length-2; i > -1; i -= 1) {
          if (ctx.measureText(test_line.slice(0,i) + "-").width <= max_width) {
            fit = i;
            break;
          }
        }
        if (fit == 0) {
          // Not even a single character will fit!!
          return undefined;
        }
        rest = flow_text(
          ctx,
          test_line.slice(fit+1) + words.slice(idx).join(" "),
          max_width,
          line_height
        );
        return [ test_line.slice(0, fit+1) + "-" ].concat(rest);
      } else {
        // Next word doesn't fit (and it's not the first on its line):
        rest = flow_text(
          ctx,
          words.slice(idx).join(" "),
          max_width,
          line_height
        );
        return [ line ].concat(rest);
      }
    });
    // If we fall out here, everything fit onto a single line:
    return [ line ];
  }

  function auto_text_layout(ctx, text, line_height, width) {
    // Computes the size needed for a text element to display the given text,
    // and returns an object with 'width', 'height', 'lines', and 'line_height'
    // properties, where 'lines' is a list of strings that can be rendered
    // within the given bounds.
    //
    // Conforms to the given width if one is supplied; otherwise tries
    // NARROW_TEXT_WIDTH first, followed by MEDIUM_TEXT_WIDTH and then
    // WIDE_TEXT_WIDTH if an attempt results in too many lines.
    if (width != undefined) {
      var gw = width * CANVAS_SIZE[0];
      var given = flow_text(ctx, text, gw, line_height);
      var th = given.length * line_height;
      return {
        "lines": given,
        "width": gw,
        "height": th,
        "line_height": line_height
      };
    } else {
      var nw = NARROW_TEXT_WIDTH * CANVAS_SIZE[0];
      var narrow = flow_text(ctx, text, nw, line_height);
      var th = narrow.length * line_height;
      if (th / nw <= NARROW_MAX_RATIO && th < CANVAS_SIZE[1]) {
        // fits
        if (narrow.length == 1) {
          var tw = ctx.measureText(narrow[0]).width;
          return {
            "lines": narrow,
            "width": tw,
            "height": th,
            "line_height": line_height
          };
        } else {
          return {
            "lines": narrow,
            "width": nw,
            "height": th,
            "line_height": line_height
          };
        }
      }

      mw = MEDIUM_TEXT_WIDTH * CANVAS_SIZE[0];
      var medium = flow_text(ctx, text, mw, line_height);
      th = medium.length * line_height;
      if (th / mw <= MEDIUM_MAX_RATIO && th < CANVAS_SIZE[1]) {
        // fits
        if (medium.length == 1) {
          return {
            "lines": medium,
            "width": ctx.measureText(medium[0]).width,
            "height": th,
            "line_height": line_height
          };
        } else {
          return {
            "lines": medium,
            "width": mw,
            "height": th,
            "line_height": line_height
          };
        }
      }

      ww = WIDE_TEXT_WIDTH * CANVAS_SIZE[0];
      var wide = flow_text(ctx, text, mw, line_height);
      th = wide.length * line_height;
      // No other alternatives even if this is too tall
      if (wide.length == 1) {
        return {
          "lines": wide,
          "width": ctx.measureText(wide[0]).width,
          "height": th,
          "line_height": line_height
        };
      } else {
        return {
          "lines": wide,
          "width": ww,
          "height": th,
          "line_height": line_height
        };
      }
    }
  }

  function draw_text(ctx, pos, text_layout) {
    var x = pos[0];
    var y = pos[1] + text_layout.line_height;
    for (var i = 0; i < text_layout.lines.length; ++i) {
      line = text_layout.lines[i];
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(line, x, y);
      y += text_layout.line_height;
    }
  }

  function BaseMenu(ctx, pos, shape, style) {
    this.ctx = ctx;
    this.pos = pos || [ -1, -1 ];
    this.shape = shape || [ 0, 0 ];
    this.style = style;
    this.style.padding = this.style.padding || 12;
    this.style.background_color = this.style.background_color || "#333";
    this.style.border_color = this.style.border_color || "#777";
    this.style.border_width = this.style.border_width || 1;
    this.style.text_color = this.style.text_color || "#ddd";
    this.style.font_size = this.style.font_size || 18;
    this.style.font_face = this.style.font_face || "asap";
    this.style.line_height = this.style.line_height || 24;
    this.style.button_color = this.style.button_color || "#555";
    this.style.selected_button_color = (
      this.style.selected_button_color || "#444"
    );
    this.style.button_border_color = this.style.button_border_color || "#ddd";
    this.style.button_border_width = this.style.button_border_width || 1;
    this.style.button_text_color = this.style.button__text_color || "#aaa";
    this.style.button_text_outline_color = (
      this.style.button_text_outline_color || "#ddd"
    );
    this.style.button_text_outline_width = (
      this.style.button_text_outline_width || 0
    );
    this.modal = false;
  }

  BaseMenu.prototype.is_hit = function (pos) {
    return (
      pos[0] > this.pos[0]
   && pos[1] > this.pos[1]
   && pos[0] < this.pos[0] + this.shape[0]
   && pos[1] < this.pos[1] + this.shape[1]
    );
  }

  BaseMenu.prototype.rel_pos = function (pos) {
    return [ pos[0] - this.pos[0], pos[1] - this.pos[1] ];
  }

  BaseMenu.prototype.center = function () {
    return [ this.pos[0] + this.shape[0]/2, this.pos[1] + this.shape[1]/2 ];
  }

  BaseMenu.prototype.draw = function (ctx) {
    // Draws the menu background and edges
    ctx.fillStyle = this.style.background_color;
    ctx.fillRect(this.pos[0], this.pos[1], this.shape[0], this.shape[1]);
    ctx.strokeStyle = this.style.border_color;
    ctx.lineWidth = this.style.border_width;
    ctx.strokeRect(this.pos[0], this.pos[1], this.shape[0], this.shape[1]);
    return false;
  }

  function ModalMenu(ctx, pos, shape, style) {
    BaseMenu.call(this, ctx, pos, shape, style);
    this.modal = true;
  }
  ModalMenu.prototype = Object.create(BaseMenu.prototype);
  ModalMenu.prototype.constructor = ModalMenu;

  function draw_horizontal_buttons(
    ctx,
    pos,
    style,
    buttons,
    sheight,
    swidth,
    padding,
    bwidth,
    selected
  ) {
    // Draws horizontal buttons; use with trigger_horizontal_buttons to match
    // visuals and trigger areas. 'Selected' may be given as undefined.
    var x = pos[0];
    var y = pos[1];
    var sw = swidth / buttons.length; // slot width
    var iw = sw * bwidth; // inner width
    var ih = sheight - padding*2; // inner height
    for (var i = 0; i < buttons.length; ++i) {
      x = pos[0] + sw*i + (sw - iw)/2;
      y = pos[1] + padding;
      if (selected == i) {
        ctx.fillStyle = style.selected_button_color;
      } else {
        ctx.fillStyle = style.button_color;
      }
      ctx.fillRect(x, y, iw, ih);
      ctx.lineWidth = style.button_border_width;
      ctx.strokeStyle = style.button_border_color;
      ctx.strokeRect(x, y, iw, ih);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font_size = style.font_size;
      ctx.font_face = style.font_face;
      if (style.button_text_outline_width > 0) {
        ctx.lineWidth = style.button_text_outline_width*2;
        ctx.strokeStyle = style.button_text_outline_color;
        ctx.strokeText(buttons[i].text, x + iw/2, y + ih/2);
      }
      ctx.fillStyle = style.button_text_color;
      ctx.fillText(buttons[i].text, x + iw/2, y + ih/2);
    }
  }

  function trigger_horizontal_buttons(
    rpos,
    buttons,
    sheight,
    swidth,
    padding,
    bwidth
  ) {
    // Takes a relative position within a horizontal stripe of buttons and a
    // list of buttons and calls the action() method of the button that was
    // hit. Also needs to know: the total height of the button stripe, the
    // total width of the button stripe, the vertical padding amount, and the
    // fraction of each horizontal cell that each button takes up.
    //
    // Returns the index of the button triggered, or undefined if no button was
    // hit.
    if (
      rpos[1] < padding
   || rpos[1] > sheight - padding
    ) { // vertical miss
      return undefined;
    }
    var bfrac = rpos[0] / swidth
    var bwhich = 0;
    var nb = buttons.length;
    var freach = swidth / nb;
    for (var i = 0; i < nb; ++i) {
      bfrac -= freach;
      if (bfrac <= 0) {
        bfrac += freach;
        bwhich = i;
        break;
      }
    }
    bfrac *= nb;
    if (
      bfrac < 0.5 - (bwidth / 2)
   || bfrac > 0.5 + (bwidth / 2)
    ) { // horizontal miss within button compartment
      return undefined;
    }
    // If we get here, it's a hit!
    if (buttons[bwhich].action) {
      buttons[bwhich].action();
    }
    return bwhich;
  }

  // By default missing a modal menu closes it.
  ModalMenu.prototype.tap = function (pos, hit) {
    if (this.modal && !hit) {
      remove_menu(this);
    }
  }

  function Dialog(ctx, pos, shape, style, text, buttons) {
    // A Dialog pops up and shows the given text, disabling all other
    // interaction until one of its buttons is tapped. The 'buttons' argument
    // should be a list of objects that have 'text' and 'action' properties.
    // Only one of the actions will be triggered.
    ModalMenu.call(this, ctx, pos, shape, style);
    this.style = style;
    this.style.buttons_height = this.style.buttons_height || 58;
    this.style.buttons_padding = this.style.buttons_padding || 12;
    this.style.button_width = this.style.button_width || 0.7;
    var twidth = undefined;
    if (this.shape[0] != 0) {
      twidth = this.shape[0] - this.style.padding*2;
    }
    ctx.font = (
      (this.style.font_size * ctx.viewport_scale) + "px "
    + this.style.font_face
    );
    this.text = auto_text_layout(
      ctx,
      text,
      this.style.line_height,
      twidth
    );
    if (this.shape[0] == 0) {
      this.shape[0] = this.text.width + 2*this.style.padding;
    }
    if (this.shape[1] == 0) {
      this.shape[1] = (
        this.text.height
      + 2*this.style.padding
      + this.style.buttons_height
      );
    }
    if (this.pos[0] == -1) {
      this.pos[0] = (this.ctx.cwidth / 2) - (this.shape[0] / 2);
    }
    if (this.pos[1] == -1) {
      this.pos[1] = (this.ctx.cheight / 2) - (this.shape[1] / 2);
    }
    this.buttons = buttons;
    this.selected = undefined;
    this.fade = undefined;
  }
  Dialog.prototype = Object.create(ModalMenu.prototype);
  Dialog.prototype.constructor = Dialog;

  Dialog.prototype.tap = function (pos, hit) {
    if (!hit) {
      return;
    }
    var rpos = this.rel_pos(pos);
    var bpos = [
      rpos[0],
      rpos[1] - (this.shape[1] - this.style.buttons_height)
    ];
    var sel = trigger_horizontal_buttons(
      bpos,
      this.buttons,
      this.style.buttons_height,
      this.shape[0],
      this.style.buttons_padding,
      this.style.button_width
    );
    if (sel != undefined) {
      // Set up menu death:
      this.selected = sel;
      this.fade = 1.0;
    }
  }

  Dialog.prototype.draw = function (ctx) {
    // draw a box (w/ border)
    BaseMenu.prototype.draw.apply(this, [ctx]);
    // draw the text
    ctx.font = (
      (this.style.font_size * ctx.viewport_scale) + "px "
    + this.style.font_face
    );
    ctx.fillStyle = this.style.text_color;
    draw_text(
      ctx,
      [ this.pos[0] + this.style.padding, this.pos[1] + this.style.padding ],
      this.text
    );
    // draw the buttons (w/ borders, highlight, and text)
    draw_horizontal_buttons(
      ctx,
      [ this.pos[0], this.pos[1] + this.shape[1] - this.style.buttons_height ],
      this.style,
      this.buttons,
      this.style.buttons_height,
      this.shape[0],
      this.style.buttons_padding,
      this.style.button_width,
      this.selected
    );
    if (this.fade != undefined) {
      this.fade -= 0.5;
      if (this.fade < 0.1) {
        remove_menu(this)
      }
      return true;
    }
    return false;
  }

  function ToggleMenu(ctx, pos, shape, style, text, on_action, off_action) {
    // A ToggleMenu is a persistent button that can be tapped to toggle between
    // on and off states, calling the on_action or off_action function each
    // time it transitions.
    style.orientation = style.orientation || "horizontal";
    style.active_background = style.active_background || "#555";
    style.active_border = style.active_border || "#bbb";
    BaseMenu.call(this, ctx, pos, shape, style);
    this.style.inactive_background = this.style.background_color;
    this.style.inactive_border = this.style.border_color;
    this.text = text;
    this.on_action = on_action;
    this.off_action = off_action;
    this.is_on = false;
  }

  ToggleMenu.prototype = Object.create(BaseMenu.prototype);
  ToggleMenu.prototype.constructor = ToggleMenu;

  ToggleMenu.prototype.tap = function (pos, hit) {
    if (hit) {
      if (this.is_on) {
        this.style.background_color = this.style.inactive_background;
        this.style.border_color = this.style.inactive_border;
        this.off_action();
        this.is_on = false;
      } else {
        this.style.background_color = this.style.active_background;
        this.style.border_color = this.style.active_border;
        this.on_action();
        this.is_on = true;
      }
    }
  }

  ToggleMenu.prototype.draw = function (ctx) {
    // draw a box (w/ border)
    BaseMenu.prototype.draw.apply(this, [ctx]);
    // draw the text
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = this.style.text_color;
    ctx.font = (
      (this.style.font_size * ctx.viewport_scale) + "px "
    + this.style.font_face
    );
    var center = this.center();
    ctx.save();
    ctx.translate(center[0], center[1]);
    if (this.style.orientation != "horizontal") {
      ctx.rotate(this.style.orientation);
    }
    ctx.fillText(this.text, 0, 0);
    if (this.style.orientation != "horizontal") {
      ctx.rotate(-this.style.orientation);
    }
    ctx.restore();
  }

  function WordList(ctx, pos, shape, style, words, base_url) {
    // A WordList is a scrollable list of words. Tapping on a word opens a
    // definition link for that word, while swiping scrolls the menu. If
    // base_url is left undefined or given some false value, tapping won't open
    // links. base_url should have the string "<word>" in it, which will be
    // replaced by the selected word. Example:
    //
    // "https://en.wiktionary.org/wiki/<word>"
    //
    // TODO: Handle too-wide words using an on-press popup?
    BaseMenu.call(this, ctx, pos, shape, style);
    this.words = words;
    this.base_url = base_url;
    this.scroll_position = -this.style.padding;
    this.press_last = undefined;
    this.press_time = 0;
  }

  WordList.prototype = Object.create(BaseMenu.prototype);
  WordList.prototype.constructor = WordList;

  WordList.prototype.tap = function (pos, hit) {
    if (!hit || this.press_time > 3) {
      // Don't count misses or the end of low-motion scrolling.
      return;
    }
    var rp = this.rel_pos(pos);
    // list-relative y position:
    var lry = rp[1] - this.scroll_position;
    // fractional y position:
    var fry = lry % this.style.line_height;
    if (fry > this.style.font_size + 3) {
      // between-lines hit (text alignment is top)
      return;
    }
    var line = lry / this.style.line_height;
    if (line < 0 || line >= this.words.length) {
      // out-of-range selection
      return;
    }
    if (this.base_url) {
      var target = this.base_url.replace("<word>", this.words[line]);
      window.open(target);
    }
  }

  WordList.prototype.press = function (pos, hit) {
    if (this.press_last != undefined && hit) {
      this.scroll_position -= pos[1] - this.press_last[1];
    }
    if (this.press_last != undefined || hit) {
      this.press_time += 1;
      this.press_last = pos;
    }
  }

  WordList.prototype.swipe = function (path, st_hit, ed_hit) {
    // Reset the scrolling context
    this.press_time = 0;
    this.press_last = undefined;
  }

  WordList.prototype.draw = function(ctx) {
    // draw a box (w/ border)
    BaseMenu.prototype.draw.apply(this, [ctx]);
    // adjust scroll position
    var min_scroll = -this.style.padding;
    var max_scroll = (
      this.words.length * this.line_height
    - (this.shape[1] - 2 * this.padding)
    );
    if (this.scroll_position < min_scroll) {
      var yd = min_scroll - this.scroll_position;
      if (yd < 3) {
        this.scroll_position = min_scroll;
      } else {
        this.scroll_position += yd/3;
      }
    } else if (this.scroll_position > max_scroll) {
      var yd = this.scroll_position - max_scroll;
      if (yd < 3) {
        this.scroll_position = max_scroll;
      } else {
        this.scroll_position -= yd/3;
      }
    }
    // set clip region:
    ctx.rect(
      this.pos[0],
      this.pos[1],
      this.pos[0] + this.shape[0],
      this.pos[1] + this.shape[1]
    );
    ctx.save()
    ctx.clip();
    // style setup:
    ctx.font = (
      (this.style.font_size * ctx.viewport_scale) + "px "
    + this.style.font_face
    );
    ctx.fillStyle = this.style.text_color;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    // draw words:
    var st_line = Math.floor(this.scroll_position / this.style.line_height) - 1;
    if (st_line < 0) { st_line = 0; }
    var line = st_line;
    var ry = line * this.style.line_height - this.scroll_position;
    var max_width = this.shape[0] - 2 * this.style.padding;
    while (ry < this.shape[1] + this.style.line_height) {
      // draw word:
      var text = this.words[line];
      var m = ctx.measureText(text);
      while (m.width > max_width) {
        if (text.length <= 1) { break; }
        text = text.slice(0, text.length - 2);
        text += "…"
        m = ctx.measureText(text);
      }
      ctx.fillText(text, this.pos[0] + this.style.padding, ry);
      // increment and continue
      line += 1;
      ry = line * this.style.line_height - this.scroll_position;
    }
    // undo clipping:
    ctx.restore();
  }


  function ButtonMenu(ctx, pos, shape, style, buttons) {
    BaseMenu.call(this, ctx, pos, shape, style);
    this.buttons = buttons;
  };
  ButtonMenu.prototype = Object.create(BaseMenu.prototype);
  ButtonMenu.prototype.constructor = ButtonMenu;

  // TODO: Implement ButtonMenu

  function CollapsingMenu(
    ctx,
    pos,
    shape,
    style,
    buttons,
    direction,
    hidden_extent
  ) {
    ButtonMenu.call(this, ctx, pos, shape, style, buttons);
    this.direction = direction;
    this.hidden_extent = hidden_extent;
  };
  CollapsingMenu.prototype = Object.create(ButtonMenu.prototype);
  CollapsingMenu.prototype.constructor = CollapsingMenu;

  // TODO: Implement CollapsingMenu


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

  function hits_menu(vpos, menu) {
    if (menu && menu.is_hit) {
      return menu.is_hit(vpos);
    } else {
      return false;
    }
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

    var is_swipe = path_total_dist(PATH) > canvas_scale()*SWIPE_THRESHOLD;

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

  function draw_active(ctx) {
    // Draws all active menus. Returns true if any menu is animating and needs
    // continued screen updates, and false if menus are stable.
    var result = false;
    MENUS.forEach( function (m) {
      result = result || m.draw(ctx);
    });
    return result;
  }

  return {
    "SWIPE_THRESHOLD": SWIPE_THRESHOLD,
    "set_canvas_size": set_canvas_size,
    "Dialog": Dialog,
    "ButtonMenu": ButtonMenu,
    "ToggleMenu": ToggleMenu,
    "CollapsingMenu": CollapsingMenu,
    "add_menu": add_menu,
    "remove_menu": remove_menu,
    "mousedown": mousedown,
    "mousemove": mousemove,
    "mouseup": mouseup,
    "draw_active": draw_active,
  };
});
