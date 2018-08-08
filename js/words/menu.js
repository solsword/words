// menu.js
// Menu system for HTML5 canvas.

define(["./draw", "./locale", "./colors"], function(draw, locale, colors) {
  var MENUS = [];

  var MYCLICK = false;
  var DOWNPOS = null;
  var TARGET = null;
  var HIT = false;
  var PATH = null;
  var DEFAULT_MARGIN = 70;

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

  function flow_text(ctx, text, max_width) {
    // Takes a context object, some text to flow, and a maximum width for that
    // text and returns a list of lines such that rendering each line after the
    // other will fit into the given width. Uses only awful brute-force
    // hyphenation when a single word is too long for a line.
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
          max_width
        );
        return [ test_line.slice(0, fit+1) + "-" ].concat(rest);
      } else {
        // Next word doesn't fit (and it's not the first on its line):
        rest = flow_text(
          ctx,
          words.slice(idx).join(" "),
          max_width
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
    var lh = line_height * ctx.viewport_scale;
    if (width != undefined) {
      var gw = width * CANVAS_SIZE[0];
      var given = flow_text(ctx, text, gw);
      var th = given.length * lh;
      return {
        "lines": given,
        "width": gw,
        "height": th,
        "line_height": lh
      };
    } else {
      var nw = NARROW_TEXT_WIDTH * CANVAS_SIZE[0];
      var narrow = flow_text(ctx, text, nw);
      var th = narrow.length * lh;
      if (th / nw <= NARROW_MAX_RATIO && th < CANVAS_SIZE[1]) {
        // fits
        if (narrow.length == 1) {
          var tw = ctx.measureText(narrow[0]).width;
          return {
            "lines": narrow,
            "width": tw,
            "height": th,
            "line_height": lh
          };
        } else {
          return {
            "lines": narrow,
            "width": nw,
            "height": th,
            "line_height": lh
          };
        }
      }

      mw = MEDIUM_TEXT_WIDTH * CANVAS_SIZE[0];
      var medium = flow_text(ctx, text, mw);
      th = medium.length * lh;
      if (th / mw <= MEDIUM_MAX_RATIO && th < CANVAS_SIZE[1]) {
        // fits
        if (medium.length == 1) {
          return {
            "lines": medium,
            "width": ctx.measureText(medium[0]).width,
            "height": th,
            "line_height": lh
          };
        } else {
          return {
            "lines": medium,
            "width": mw,
            "height": th,
            "line_height": lh
          };
        }
      }

      ww = WIDE_TEXT_WIDTH * CANVAS_SIZE[0];
      var wide = flow_text(ctx, text, mw);
      th = wide.length * lh;
      // No other alternatives even if this is too tall
      if (wide.length == 1) {
        return {
          "lines": wide,
          "width": ctx.measureText(wide[0]).width,
          "height": th,
          "line_height": lh
        };
      } else {
        return {
          "lines": wide,
          "width": ww,
          "height": th,
          "line_height": lh
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

  function style_color(style, name) {
    if (style.hasOwnProperty("colors")) {
      let c = style.colors;
      if (c.hasOwnProperty(name)) {
        let cobj = c[name];
        if (typeof(cobj) == "function") {
          return cobj(style);
        } else {
          return cobj;
        }
      }
    }
    return colors.menu_color(name);
  }

  function BaseMenu(ctx, pos, shape, style) {
    this.ctx = ctx;
    this.pos = pos || {};
    this.shape = shape || {};
    this.style = style || {};
    this.style.padding = this.style.padding || 12;
    this.style.border_width = this.style.border_width || 1;
    this.style.font_size = this.style.font_size || draw.FONT_SIZE;
    this.style.font_face = this.style.font_face || draw.FONT_FACE;
    this.style.line_height = this.style.line_height || draw.FONT_SIZE;
    this.style.button_border_width = this.style.button_border_width || 1;
    this.style.button_text_outline_width = (
      this.style.button_text_outline_width || 0
    );
    this.modal = false;
  }

  BaseMenu.prototype.color = function (name) {
    return style_color(this.style, name);
  }

  BaseMenu.prototype.set_font = function (ctx) {
    ctx.font = (
      (this.style.font_size * ctx.viewport_scale) + "px "
    + this.style.font_face
    );
    ctx.fillStyle = this.color("text");
  }

  BaseMenu.prototype.is_hit = function (pos) {
    var ap = this.abspos();
    var as = this.absshape();
    return (
      pos[0] > ap[0]
   && pos[1] > ap[1]
   && pos[0] < ap[0] + as[0]
   && pos[1] < ap[1] + as[1]
    );
  }

  BaseMenu.prototype.posval = function (x, max) {
    // Converts a position to a real value.
    if (!isNaN(+x)) {
      return +x;
    }
    if (typeof(x) == "function") {
      return x(this);
    }
    let unit = x.slice(x.length-2);
    let multiplier = 1;
    if (unit == "ex") {
      // TODO: Adjust this?
      multiplier = grid.FONT_SIZE * 0.5;
    } else if (unit == "em") {
      // TODO: Adjust this?
      multiplier = grid.FONT_SIZE;
    } else if (unit[1] == "%") {
      return (+x.slice(0, x.length-1))/100 * max;
    } // else leave multiplier at 1
    return multiplier * +(x.slice(0, x.length-2));
  }

  BaseMenu.prototype.abspos = function () {
    // Compute current absolute position in canvas coordinates
    var result = [ 0, 0 ];
    if (this.pos.hasOwnProperty("left") && this.pos.left != undefined) {
      result[0] = this.posval(this.pos.left, this.ctx.cwidth);
    } else if (this.pos.hasOwnProperty("right") && this.pos.right != undefined){
      if (this.shape.hasOwnProperty("width") && this.shape.width != undefined) {
        var w = (
          this.posval(this.shape.width, this.ctx.cwidth)
        * this.ctx.viewport_scale
        );
        result[0] = (
          this.ctx.cwidth
        - this.posval(this.pos.right, this.ctx.cwidth)
        - w
        );
      } else { // auto-width -> symmetrical
        result[0] = this.posval(this.pos.right, this.ctx.cwidth);
      }
    } else {
      if (this.shape.hasOwnProperty("width") && this.shape.width != undefined) {
        var w = (
          this.posval(this.shape.width, this.ctx.cwidth)
        * this.ctx.viewport_scale
        );
        result[0] = (this.ctx.cwidth - w)/2; // centered
      } else {
        result[0] = DEFAULT_MARGIN; // no info default
      }
    }
    if (this.pos.hasOwnProperty("top") && this.pos.top != undefined) {
      result[1] = this.posval(this.pos.top, this.ctx.cheight);
    } else if (
      this.pos.hasOwnProperty("bottom")
   && this.pos.bottom != undefined
    ) {
      if (
        this.shape.hasOwnProperty("height")
     && this.shape.height != undefined
      ) {
        var h = (
          this.posval(this.shape.height, this.ctx.cheight)
        * this.ctx.viewport_scale
        );
        result[1] = (
          this.ctx.cheight
        - this.posval(this.pos.bottom, this.ctx.cheight)
        - h
        );
      } else { // auto-height -> symmetrical
        result[1] = this.posval(this.pos.bottom, this.ctx.cheight);
      }
    } else {
      if (
        this.shape.hasOwnProperty("height")
     && this.shape.height != undefined
      ) {
        var h = (
          this.posval(this.shape.height, this.ctx.cheight)
        * this.ctx.viewport_scale
        );
        result[1] = (this.ctx.cwidth - h)/2; // centered
      } else {
        result[1] = DEFAULT_MARGIN; // no info default
      }
    }
    return result;
  }

  BaseMenu.prototype.absshape = function () {
    // Compute current absolute shape in canvas coordinates. Includes scaling
    // factor.
    var ap = this.abspos();
    var result = [ 0, 0 ];
    if (this.shape.hasOwnProperty("width") && this.shape.width != undefined) {
      result[0] = this.shape.width * this.ctx.viewport_scale;
    } else {
      if (this.pos.hasOwnProperty("right") && this.pos.right != undefined) {
        result[0] = (this.ctx.cwidth - this.pos.right) - ap[0];
      } else {
        result[0] = this.ctx.cwidth - 2*ap[0]; // symmetric
      }
    }
    if (this.shape.hasOwnProperty("height") && this.shape.height != undefined) {
      result[1] = this.shape.height * this.ctx.viewport_scale;
    } else {
      if (this.pos.hasOwnProperty("bottom") && this.pos.bottom != undefined) {
        result[1] = (this.ctx.cheight - this.pos.bottom) - ap[1];
      } else {
        result[1] = this.ctx.cheight - 2*ap[1]; // symmetric
      }
    }
    return result;
  }

  BaseMenu.prototype.rel_pos = function (pos) {
    var ap = this.abspos();
    return [ pos[0] - ap[0], pos[1] - ap[1] ];
  }

  BaseMenu.prototype.center = function () {
    var ap = this.abspos();
    var as = this.absshape();
    return [ ap[0] + as[0]/2, ap[1] + as[1]/2 ];
  }

  BaseMenu.prototype.draw = function (ctx) {
    var ap = this.abspos();
    var as = this.absshape();
    // Draws the menu background and edges
    ctx.beginPath(); // break any remnant path data
    ctx.fillStyle = this.color("background");
    ctx.fillRect(ap[0], ap[1], as[0], as[1]);
    ctx.strokeStyle = this.color("border");
    ctx.lineWidth = this.style.border_width;
    ctx.strokeRect(ap[0], ap[1], as[0], as[1]);
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
        ctx.fillStyle = style_color(style, "selected_button");
      } else {
        ctx.fillStyle = style_color(style, "button");
      }
      ctx.fillRect(x, y, iw, ih);
      ctx.lineWidth = style.button_border_width;
      ctx.strokeStyle = style_color(style, "button_border");
      ctx.strokeRect(x, y, iw, ih);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font_size = style.font_size;
      ctx.font_face = style.font_face;
      if (style.button_text_outline_width > 0) {
        ctx.lineWidth = style.button_text_outline_width*2;
        ctx.strokeStyle = style_color(style, "button_text_outline");
        ctx.strokeText(buttons[i].text, x + iw/2, y + ih/2);
      }
      ctx.fillStyle = style_color(style, "button_text");
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
    if (this.shape.hasOwnProperty("width") && this.shape.width != undefined) {
      twidth = this.shape.width - this.style.padding*2;
    }
    this.set_font(ctx);
    this.text = auto_text_layout(
      ctx,
      text,
      this.style.line_height,
      twidth
    );
    if (this.shape.width == undefined) {
      this.shape.width = (
        this.text.width
      + 2*this.style.padding
      );
    }
    if (this.shape.height == undefined) {
      this.shape.height = (
        this.text.height
      + 2 * this.style.padding
      + this.style.buttons_height * this.ctx.viewport_scale
      // TODO: Correct button scaling!
      );
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
    var as = this.absshape();
    var rpos = this.rel_pos(pos);
    var bpos = [
      rpos[0],
      rpos[1] - (as[1] - this.style.buttons_height * this.ctx.viewport_scale
      )
    ];
    var sel = trigger_horizontal_buttons(
      bpos,
      this.buttons,
      this.style.buttons_height * this.ctx.viewport_scale,
      as[0],
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
    var ap = this.abspos();
    var as = this.absshape();
    // draw a box (w/ border)
    BaseMenu.prototype.draw.apply(this, [ctx]);
    // draw the text
    this.set_font(ctx);
    draw_text(
      ctx,
      [ ap[0] + this.style.padding, ap[1] + this.style.padding ],
      this.text
    );
    // draw the buttons (w/ borders, highlight, and text)
    draw_horizontal_buttons(
      ctx,
      [ ap[0], ap[1] + as[1] - this.style.buttons_height ],
      this.style,
      this.buttons,
      this.style.buttons_height * this.ctx.viewport_scale,
      as[0],
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

  Dialog.prototype.removed = function () {
    this.fade = undefined;
  }

  function ToggleMenu(ctx, pos, shape, style, text, on_action, off_action) {
    // A ToggleMenu is a persistent button that can be tapped to toggle between
    // on and off states, calling the on_action or off_action function each
    // time it transitions.
    BaseMenu.call(this, ctx, pos, shape, style);
    this.style.orientation = this.style.orientation || "horizontal";
    if (!this.style.hasOwnProperty("colors")) {
      this.style.colors = {};
    }
    let c = this.style.colors;
    c["inactive_background"] = this.color("background");
    c["inactive_border"] = this.color("border");
    this.text = text;
    this.on_action = on_action;
    this.off_action = off_action;
    this.is_on = false;
  }

  ToggleMenu.prototype = Object.create(BaseMenu.prototype);
  ToggleMenu.prototype.constructor = ToggleMenu;

  ToggleMenu.prototype.on = function () {
    // Used to manually turn the toggle on.
    this.on_();
    this.on_action();
  }

  ToggleMenu.prototype.off = function () {
    // Used to manually turn the toggle off.
    this.off_();
    this.off_action();
  }

  ToggleMenu.prototype.on_ = function () {
    // Turn on without triggering the toggle action.
    this.style.colors = this.style.colors || {};
    this.style.colors.background = this.color("active_background");
    this.style.colors.border = this.color("active_border");
    this.is_on = true;
  }

  ToggleMenu.prototype.off_ = function () {
    // Turn off without triggering the toggle action.
    this.style.colors = this.style.colors || {};
    this.style.colors.background = this.color("inactive_background");
    this.style.colors.border = this.color("inactive_border");
    this.is_on = false;
  }

  ToggleMenu.prototype.toggle = function () {
    // Used to manually toggle the button (via e.g., a keyboard shortcut).
    if (this.is_on) {
      this.off();
    } else {
      this.on();
    }
  }

  ToggleMenu.prototype.tap = function (pos, hit) {
    if (hit) {
      this.toggle();
    }
  }

  ToggleMenu.prototype.draw = function (ctx) {
    // draw a box (w/ border)
    BaseMenu.prototype.draw.apply(this, [ctx]);
    // draw the text
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = this.color("text");
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
    return false;
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
    // TODO: Handle too-wide words using a hover popup?
    BaseMenu.call(this, ctx, pos, shape, style);
    this.style.prefix = this.style.prefix || "📖 ";
    this.style.scrollbar_width = this.style.scrollbar_width || 24;
    this.words = words;
    this.base_url = base_url;
    this.scroll_position = -this.style.padding;
    this.press_last = undefined;
    this.scroll_drag = false;
    this.press_time = 0;
  }

  WordList.prototype = Object.create(BaseMenu.prototype);
  WordList.prototype.constructor = WordList;

  WordList.prototype.tap = function (pos, hit) {
    var as = this.absshape();

    var rp = this.rel_pos(pos);
    if (!hit || this.press_time > 3) {
      // Don't count misses or the end of low-motion scrolling.
      return;
    }

    this.set_font(this.ctx);
    var m = this.ctx.measureText(this.style.prefix);
    var link_min = this.style.padding;
    var link_max = link_min + m.width;
    var sb_min = as[0] - this.style.scrollbar_width * this.ctx.viewport_scale;
    var sb_max = as[0];
    if (rp[0] >= link_min && rp[0] <= link_max) { // hit on a word arrow
      var lh = this.style.line_height * this.ctx.viewport_scale;
      // list-relative y position:
      var lry = rp[1] + this.scroll_position;
      // fractional y position:
      var fry = lry % lh;
      if (fry > (this.style.font_size * this.ctx.viewport_scale) + 3) {
        // between-lines hit (text alignment is top)
        return;
      }
      var line = Math.floor(lry / lh);
      if (line < 0 || line >= this.words.length) {
        // out-of-range selection
        return;
      }
      if (this.base_url) {
        // TODO: Contextual case preservation?
        var target = this.base_url.replace(
          "<word>",
          locale.lower(this.words[line])
        );
        window.open(target);
      }
    } else if (rp[0] >= sb_min && rp[0] <= sb_max) {
      // hit on the scrollbar
      var lh = this.style.line_height * this.ctx.viewport_scale;
      var sl = this.scroll_limits();
      this.scroll_position =  sl[0] + (sl[1] - sl[0]) * (rp[1] / as[1]);
    }
  }

  WordList.prototype.scroll_limits = function() {
    var as = this.absshape();
    var lh = this.style.line_height * this.ctx.viewport_scale;
    var min_scroll = -this.style.padding;
    var max_scroll = this.words.length * lh - (as[1] - 2 * this.style.padding);
    return [ min_scroll, max_scroll ];
  }

  WordList.prototype.hover = function (path, hit) {
    if (path.length < 1) {
      return;
    }
    var pos = path[path.length - 1];
    var rp = this.rel_pos(pos);
    var as = this.absshape();

    var sb_min = as[0] - this.style.scrollbar_width * this.ctx.viewport_scale;
    var sb_max = as[0];
    if (
      this.scroll_drag
   || (this.press_last == undefined && rp[0] >= sb_min && rp[0] <= sb_max)
    ) { // hit on the scrollbar
      this.scroll_drag = true;
      var lh = this.style.line_height * this.ctx.viewport_scale;
      var sl = this.scroll_limits();
      this.scroll_position =  sl[0] + (sl[1] - sl[0]) * (rp[1] / as[1]);
    } else { // hit elsewhere in the window
      if (this.press_last != undefined && hit) {
        this.scroll_position -= rp[1] - this.press_last[1];
      }
      if (this.press_last != undefined || hit) {
        this.press_time += 1;
        this.press_last = rp;
      }
    }
  }

  WordList.prototype.swipe = function (path, st_hit, ed_hit) {
    // Reset the scrolling context
    this.press_time = 0;
    this.press_last = undefined;
    this.scroll_drag = false;
  }

  WordList.prototype.draw = function(ctx) {
    var needs_update = false;
    // draw a box (w/ border)
    BaseMenu.prototype.draw.apply(this, [ctx]);

    // absolute position/size:
    var ap = this.abspos();
    var as = this.absshape();
    var lh = this.style.line_height * ctx.viewport_scale;

    // adjust scroll position
    var min_scroll = -this.style.padding;
    var max_scroll = this.words.length * lh - (as[1] - 2 * this.style.padding);
    if (max_scroll < 0) { max_scroll = 0; }
    if (this.scroll_position < min_scroll) {
      needs_update = true;
      var yd = min_scroll - this.scroll_position;
      if (yd < 3) {
        this.scroll_position = min_scroll;
      } else {
        this.scroll_position += yd/3;
      }
    } else if (this.scroll_position > max_scroll) {
      needs_update = true;
      var yd = this.scroll_position - max_scroll;
      if (yd < 3) {
        this.scroll_position = max_scroll;
      } else {
        this.scroll_position -= yd/3;
      }
    }

    // draw scrollbar:
    var sbw = this.style.scrollbar_width * ctx.viewport_scale;
    ctx.fillStyle = this.color("button");
    ctx.strokeStyle = this.color("border");
    ctx.rect(ap[0] + as[0] - sbw, ap[1], sbw, as[1]);
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = this.color("selected_button");
    if (this.words.length > 1) {
      var tsh = max_scroll - min_scroll;
      var twh = lh * this.words.length;
      var sb_st = (this.scroll_position - min_scroll) / twh;
      var sb_ed = ((this.scroll_position + as[1]) - min_scroll) / twh;
      if (sb_st < 0) { sb_st = 0; }
      if (sb_ed > 1) { sb_ed = 1; }
      sb_st *= as[1];
      sb_ed *= as[1];
      ctx.beginPath();
      ctx.rect(ap[0] + as[0] - sbw, ap[1] + sb_st, sbw, sb_ed - sb_st);
      ctx.fill();
    } else {
      // fill whole scrollbar rect
      ctx.fill();
    }

    // set clip region:
    ctx.rect(ap[0], ap[1], as[0], as[1]);
    ctx.save()
    ctx.clip();
    // style setup:
    this.set_font(ctx);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    // draw words:
    var words = this.words;
    var prefix = this.style.prefix;
    if (!words || words.length == 0) {
      words = [ "<no words found yet>" ];
      prefix = ""
    }
    var st_line = Math.floor(this.scroll_position / lh) - 1;
    if (st_line < 0) { st_line = 0; }
    var line = st_line;
    var ry = line * lh - this.scroll_position;
    var max_width = as[0] - 2 * this.style.padding;
    while (ry < as[1] + lh && line < words.length) {
      // draw word:
      var text = prefix + words[line];
      var m = ctx.measureText(text);
      while (m.width > max_width) {
        if (text.length <= 1) { break; }
        text = text.slice(0, text.length - 2);
        text += "…"
        m = ctx.measureText(text);
      }
      ctx.fillText(text, ap[0] + this.style.padding, ap[1] + ry);
      // increment and continue
      line += 1;
      ry = line * lh - this.scroll_position;
    }
    // undo clipping:
    ctx.restore();
    return needs_update;
  }

  function ButtonMenu(ctx, pos, shape, style, text, action) {
    // A ButtonMenu is both a menu and a clickable button. The action is
    // triggered whenever it is clicked.
    BaseMenu.call(this, ctx, pos, shape, style);
    this.text = text;
    this.action = action;
  };
  ButtonMenu.prototype = Object.create(BaseMenu.prototype);
  ButtonMenu.prototype.constructor = ButtonMenu;

  ButtonMenu.prototype.tap = function (pos, hit) {
    if (hit) {
      this.action();
    }
  }

  ButtonMenu.prototype.draw = function (ctx) {
    BaseMenu.prototype.draw.apply(this, [ctx]);
    this.set_font(ctx);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var ctr = this.center();
    ctx.fillText(this.text, ctr[0], ctr[1]);
  }

  function GlyphsMenu(ctx, pos, shape, style, text, action) {
    // A ButtonMenu which displays glyphs-so-far, and which can flash colors.
    ButtonMenu.call(this, ctx, pos, shape, style, text, action);
    this.style.colors = this.style.colors || {};
    this.style.colors.base_border = this.color("border");
    this.style.base_border_width = this.style.border_width;
    this.style.max_width = this.style.max_width || 0.8;
    this.style.border_growth = this.style.border_growth || 3.0;
    this.glyphs = this.text.split("");
    this.adjust_width();
    this.fade = undefined;
    this.fade_color = undefined;
  }
  GlyphsMenu.prototype = Object.create(ButtonMenu.prototype);
  GlyphsMenu.prototype.constructor = GlyphsMenu;

  GlyphsMenu.prototype.add_glyph = function (glyph) {
    // Add a glyph
    this.glyphs.push(glyph);
    this.adjust_width();
  }

  GlyphsMenu.prototype.remove_glyph = function () {
    // Remove the last glyph
    this.glyphs.pop();
    this.adjust_width();
  }

  GlyphsMenu.prototype.set_glyphs = function (glyphs) {
    this.glyphs = glyphs.slice();
    this.adjust_width();
  }

  GlyphsMenu.prototype.adjust_width = function () {
    // Sets display_text and shape.width based on text contents.
    this.set_font(this.ctx);
    this.display_text = this.glyphs.join("");
    var m = this.ctx.measureText(this.display_text);
    var dw = m.width + this.style.padding * 2;
    while (dw > this.style.max_width * this.ctx.cwidth) {
      this.display_text = this.display_text.slice(
        0,
        this.display_text.length - 2
      ) + "…";
      m = this.ctx.measureText(this.display_text);
      dw = m.width + this.style.padding * 2;
    }
    this.shape.width = dw;
  }

  GlyphsMenu.prototype.flash = function (color) {
    this.fade_color = color;
    this.fade = 1.0;
  }

  GlyphsMenu.prototype.draw = function (ctx) {
    // Compute border color for flashing:
    var animating = false;
    if (this.fade) {
      this.fade *= 0.9;
      if (this.fade < 0.05) {
        this.fade = undefined;
        this.fade_color = undefined;
        this.style.colors = this.style.colors || {};
        this.style.colors.border = this.color("base_border");
        this.style.border_width = this.style.base_border_width;
      } else {
        this.style.colors = this.style.colors || {};
        this.style.colors.border = draw.interp_color(
          this.color("base_border"),
          this.fade,
          this.fade_color
        );
        this.style.border_width = (
          this.style.base_border_width
        + this.style.border_growth * this.fade
        );
        animating = true;
      }
    }

    // Draw background:
    BaseMenu.prototype.draw.apply(this, [ctx]);

    // Draw glyphs:
    this.set_font(ctx);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var ctr = this.center();
    ctx.fillText(this.display_text, ctr[0], ctr[1]);

    return animating;
  }

  function SlotsMenu(ctx, pos, shape, style, contents, action) {
    // A SlotsMenu has an adjustable number of slots, and each slot can be
    // filled or emptied, and may trigger an action when clicked. The action
    // callback is called with the glyph value of the slot that was clicked on
    // when one is clicked on. The initial number of slots will be determined
    // by the length of the contents iterable, along with their initial values.
    // null, false, undefined or other false-values may be used to represent
    // initially-empty slots. The slot_width variable of the shape object is
    // used to determine the size of each slot; it will be compute from
    // shape.width and contents.length if not given, otherwise shape.width will
    // be computed from it and contents.length.
    if (shape.hasOwnProperty("slot_width") && shape.slot_width != undefined) {
      shape.width = shape.slot_width * contents.length;
    } else if (shape.hasOwnProperty("width") && shape.width != undefined) {
      shape.slot_width = shape.width / contents.length;
    } else {
      shape.slot_width = 48;
      shape.width = shape.slot_width * contents.length;
    }
    BaseMenu.call(this, ctx, pos, shape, style);
    this.style.colors = this.style.colors || {};
    this.style.colors.slot_background = this.color("background");
    this.style.colors.slot_border = this.color("border");
    this.style.slot_border_width = this.style.border_width;
    this.contents = [];
    for (glyph of contents) {
      if (glyph) {
        this.contents.push("" + glyph);
      } else {
        this.contents.push(undefined);
      }
    }
    this.adjust_width();
  }
  SlotsMenu.prototype = Object.create(BaseMenu.prototype);
  SlotsMenu.prototype.constructor = SlotsMenu;

  SlotsMenu.prototype.adjust_width = function () {
    this.shape.width = this.shape.slot_width * this.contents.legnth;
  }

  SlotsMenu.prototype.add_slot = function (glyph) {
    // Leave off glyph argument to add an empty slot
    this.contents.push(glyph);
    this.adjust_width();
  }

  SlotsMenu.prototype.remove_slot = function () {
    // Removes the last (rightmost) slot
    this.contents.pop();
    this.adjust_width();
  }

  SlotsMenu.prototype.tap = function (pos, hit) {
    if (!hit) {
      return;
    }
    var rp = this.rel_pos(pos);

    rp[0] / this.shape.width;
    // TODO: HERE
  }

  SlotsMenu.prototype.draw = function (ctx) {
    // Draw background:
    BaseMenu.prototype.draw.apply(this, [ctx]);

    // Get absolute position and shape:
    var ap = this.abspos();
    var as = this.absshape();

    // slot width
    var sw = as[0] / this.contents.length;

    // Set drawing properties outside loop:
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    this.set_font(ctx);
    ctx.fillStyle = this.color("background");
    ctx.strokeStyle = this.color("border");
    ctx.lineWidth = this.style.border_width;
    // draw each slot
    for (let i = 0; i < this.contents.length; ++i) {
      var g = this.contents[i];
      ctx.beginPath(); // break any remnant path data
      // background
      ctx.fillRect(ap[0] + sw*i, ap[1], sw, as[1]);
      // border
      ctx.strokeRect(ap[0] + sw*i, ap[1], sw, as[1]);
      // glyph
      if (g) {
        ctx.fillText(g, ap[0] + sw*(i+0.5), ap[1] + as[1]*0.5);
      }
    }

    return false;
  }


  function add_menu(menu) {
    // Adds the given menu to the top of the active menus list.
    MENUS.push(menu);
    call_if_available(menu, "added", []);
    return menu;
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
      call_if_available(menu, "removed", []);
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

  function handle_bridge(smenu, tmenu, path, fr_hit, to_hit) {
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
    "GlyphsMenu": GlyphsMenu,
    "ToggleMenu": ToggleMenu,
    "WordList": WordList,
    "add_menu": add_menu,
    "remove_menu": remove_menu,
    "mousedown": mousedown,
    "mousemove": mousemove,
    "mouseup": mouseup,
    "draw_active": draw_active,
  };
});
