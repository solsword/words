// menu.js
// Menu system for HTML5 canvas.
/* jshint esversion: 6, maxerr: 10000 */
/* global console, window */

"use strict";

import * as grid from "./grid.js";
import * as draw from "./draw.js";
import * as colors from "./colors.js";

// TODO: Import this when that becomes possible (see locale.js).
// import * as locale from "./locale.js";
/* global locale */

var MENUS = [];

var MYCLICK = false;
var DOWNPOS = null;
var TARGET = null;
var HIT = false;
var PATH = null;
export var DEFAULT_MARGIN = 0.05;
export var SMALL_MARGIN = 0.03;
export var MENU_FONT_SIZE = 28;
export var ARROW_SIZE_FRACTION = 4;

var CANVAS_SIZE = [800, 800]; // in pixels; use set_canvas_size

export var SWIPE_THRESHOLD = 0.02; // in canvas-scales

export var NARROW_TEXT_WIDTH = 0.4; // in canvas-widths
export var MEDIUM_TEXT_WIDTH = 0.65;
export var WIDE_TEXT_WIDTH = 0.92;

export var NARROW_MAX_RATIO = 1.2;
export var MEDIUM_MAX_RATIO = 2.5;

export var TEXT_OUTLINE_WIDTH = 3;

/**
 * Informs the menu system what the canvas size is. Does not actually
 * change the size of the canvas.
 *
 * @param sz An array of two numbers indicating the width and then height
 *     of the canvas in pixels.
 */
export function set_canvas_size(sz) {
    CANVAS_SIZE = sz;
}

/**
 * Returns the average between the canvas width and height. Useful as a
 * general metric.
 *
 * @return The average of the canvas width and height.
 */
export function canvas_scale() {
    return (CANVAS_SIZE[0] + CANVAS_SIZE[1])/2;
}

/**
 * Takes a context object, some text to flow, and a maximum width for
 * that text and returns a list of lines such that rendering each line
 * after the other will fit into the given width. Uses only awful
 * brute-force hyphenation when a single word is too long for a line.
 *
 * @param ctx The canvas context object to use for measuring text.
 * @param text A string containing text to be drawn.
 * @param max_width The maximum width that the text should be allowed to
 *     take up, in canvas units (pixels).
 *
 * @return An array of strings, none of which will be longer than the
 *     given max_width if drawn using the currently-active text style.
 */
export function flow_text(ctx, text, max_width) {
    var words = text.split(' ');
    var line = '';
    for (let idx = 0; idx < words.length; ++idx) {
        let word = words[idx];
        var test_line = null;
        if (line.length > 0) {
            test_line = line + ' ' + word;
        } else {
            test_line = word;
        }
        var m = draw.measure_text(ctx, test_line);
        if (m.width <= max_width) {
            // Next word fits:
            line = test_line;
        } else if (line == '') {
            // First word is too long: need a hyphen
            // TODO: Better hyphenation; even line-local justification, etc.
            // TODO: Don't hyphenate things like numbers?!?
            var fit = 0;
            for (let i = test_line.length-2; i > -1; i -= 1) {
                let sw = draw.measure_text(
                    ctx,
                    test_line.slice(0,i) + "-"
                ).width;
                if (sw <= max_width) {
                    fit = i;
                    break;
                }
            }
            if (fit == 0) {
                // Not even a single character will fit!!
                console.warn(
                    "Warning: Attempted to flow text but failed to fit a "
                  + "single character on a line."
                );
                // Put each character on its own line:
                return text.split('');
            }
            let rest = flow_text(
                ctx,
                test_line.slice(fit+1) + words.slice(idx).join(" "),
                max_width
            );
            return [ test_line.slice(0, fit+1) + "-" ].concat(rest);
        } else {
            // Next word doesn't fit (and it's not the first on its line):
            let rest = flow_text(
                ctx,
                words.slice(idx).join(" "),
                max_width
            );
            return [ line ].concat(rest);
        }
    }
    // If we fall out here, everything fit onto a single line:
    return [ line ];
}

/**
 * Computes the size needed for a text element to display the given text,
 * and returns both the computed width and height and an array of strings
 * to be drawn.
 *
 * Conforms to the given width if one is supplied; otherwise tries
 * NARROW_TEXT_WIDTH first, followed by MEDIUM_TEXT_WIDTH and then
 * WIDE_TEXT_WIDTH if an attempt results in too many lines.
 *
 * @param ctx The context to use for text measurements.
 * @param text A string containing the text to compute a layout for.
 * @param line_height The height of each line of text, from baseline to
 *     baseline.
 * @param width The width to fit the text into. If not given, several
 *     default widths are attempted.
 *
 * @return An object with 'width', 'height', 'lines', and 'line_height'
 *     properties, where 'lines' is a list of strings that can be
 *     rendered within the given bounds.
 */
export function auto_text_layout(ctx, text, line_height, width) {
    let lh = line_height * ctx.viewport_scale;
    if (width != undefined) {
        let gw = width * CANVAS_SIZE[0];
        let given = flow_text(ctx, text, gw);
        let th = given.length * lh;
        return {
            "lines": given,
            "width": gw,
            "height": th,
            "line_height": lh
        };
    } else {
        let nw = NARROW_TEXT_WIDTH * CANVAS_SIZE[0];
        let narrow = flow_text(ctx, text, nw);
        let th = narrow.length * lh;
        if (th / nw <= NARROW_MAX_RATIO && th < CANVAS_SIZE[1]) {
            // fits
            if (narrow.length == 1) {
                let tw = draw.measure_text(ctx, narrow[0]).width;
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

        let mw = MEDIUM_TEXT_WIDTH * CANVAS_SIZE[0];
        let medium = flow_text(ctx, text, mw);
        th = medium.length * lh;
        if (th / mw <= MEDIUM_MAX_RATIO && th < CANVAS_SIZE[1]) {
            // fits
            if (medium.length == 1) {
                return {
                    "lines": medium,
                    "width": draw.measure_text(ctx, medium[0]).width,
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

        let ww = WIDE_TEXT_WIDTH * CANVAS_SIZE[0];
        let wide = flow_text(ctx, text, mw);
        th = wide.length * lh;
        // No other alternatives even if this is too tall
        if (wide.length == 1) {
            return {
                "lines": wide,
                "width": draw.measure_text(ctx, wide[0]).width,
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

/**
 * Draws text onto the canvas at the given position.
 *
 * @param ctx The canvas context to use for drawing.
 * @param pos The position at which to draw the text. This specifies the
 *     upper-left corner of the text.
 * @param text_layout A text layout object as returned by
 *     auto_text_layout. It must have keys 'width', 'height', 'lines',
 *     and 'line_height', where 'lines' is an array of strings containing
 *     the text to be drawn broken into individual lines, and the other
 *     three values are pixel-based measurements for the text.
 */
export function draw_text(ctx, pos, text_layout) {
    let x = pos[0];
    let y = pos[1] + text_layout.line_height;
    for (let i = 0; i < text_layout.lines.length; ++i) {
        let line = text_layout.lines[i];
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(line, x, y);
        y += text_layout.line_height;
    }
}

/**
 * Determines a concrete color for the given style object and color name
 * (e.g., 'background', although valid names vary by style). If the style
 * does not have any colors property or its colors field does not have a
 * subfield with the given name, the current color scheme's menu category
 * will be consulted to retrieve a color for the given name.
 *
 * @param style A style object, in which a 'colors' value will be
 *     accessed.
 * @param name The name of the sub-field of the 'colors' field of the
 *     given style to access. If that sub-field is a function, it will be
 *     called with the entire style object as an argument to determine
 *     the color to use, otherwise it will be used as-is.
 *
 * @return A color, either the result of a color function, a color
 *     stored in the style.colors field, or a color retrieved as a backup
 *     from the current color scheme's menu category.
 */
export function style_color(style, name) {
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
    return colors.scheme_color("menu", name);
}

/**
 * Draws horizontal buttons; use with trigger_horizontal_buttons to match
 * visuals and trigger areas. 'Selected' may be given as undefined.
 *
 * @param ctx The drawing context to use.
 * @param pos An array containing x/y coordinates for the upper-left
 *     corner of the region to draw buttons in.
 * @param style A menu style object that determines things like colors
 *     and border widths. See BaseMenu.
 * @param buttons An array of button objects. The text property of each
 *     will be used to determine the button labels.
 * @param sheight The total height of the stripe of buttons in pixels.
 * @param swidth The total width of the stripe of buttons in pixels.
 * @param padding The padding (in pixels) around the buttons.
 * @param bwidth The width of each button, as a fraction of the slot
 *     allotted to it.
 * @param selected The index of the currently-selected button, or
 *     undefined if no button is currently selected.
 */
export function draw_horizontal_buttons(
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

/**
 * Takes a relative position within a horizontal stripe of buttons and a
 * list of buttons and calls the action() method of the button that was
 * hit. Also needs to know: the total height of the button stripe, the
 * total width of the button stripe, the vertical padding amount, and the
 * fraction of each horizontal cell that each button takes up.
 *
 * @param rpos An array containing x/y pixel coordinates of a click/tap
 *     relative to the upper-left corner of a stripe of horizontal
 *     buttons.
 * @param buttons An array of objects that have zero-parameter 'action'
 *     functions.
 * @param sheight The height (in pixels) of the stripe of buttons,
 *     including padding.
 * @param swidth The width (in pixels) of the stripe of buttons.
 * @param padding The number of pixels of padding around the edges of the
 *     stripe of buttons.
 * @param bwidth The width of each button, in fractions of a button slot
 *     (however wide that ends up being based on the number of
 *     buttons).
 *
 * @return The index of the button triggered, or undefined if no button
 *     was hit.
 */
export function trigger_horizontal_buttons(
    rpos,
    buttons,
    sheight,
    swidth,
    padding,
    bwidth
) {
    if (
        rpos[1] < padding
        || rpos[1] > sheight - padding
    ) { // vertical miss
        return undefined;
    }
    var bfrac = rpos[0] / swidth;
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

/**
 * The BaseMenu prototype contains basic functionality common to all
 * menus. The following functions may be overridden to specify menu
 * appearance/behavior:
 *
 *   'draw' - Called whenever the menu needs to be drawn.
 *   'press' - Called when a click/swipe begins.
 *   'tap' - Called when a click/tap ends.
 *   'drag' - Called continuously during drag/swipe motion.
 *   'swipe' - Called when a swipe ends.
 *   'bridge_to' - Called when a swipe starts on this menu but ends on
 *       another.
 *   'bridge_from' - Called when a swipe starts on another menu but ends
 *       on this one.
 *
 * See the handle_* functions below on the details of what arguments each
 * of those methods accept.
 *
 * @param ctx The canvas context that the menu will be drawn on.
 * @param pos An object specifying the position of the menu on the
 *     canvas. It may have 'top', 'bottom', 'left', and/or 'right'
 *     properties, and each property may hold any value that the concrete
 *     function can process.
 * @param shape An object specifying the shape of the menu, which may
 *     include 'width' and/or 'height' keys. Either or both may be
 *     absent, in which case the width/height of the menu will be
 *     determined automatically based on the position parameters. The
 *     values for 'width' and 'height' will be processed by the concrete
 *     function.
 * @param style An object specifying the menu style. It may use the
 *     following keys:
 *       paddding: Pixels of padding around the menu contents.
 *       border_width: Pixel width of the menu border.
 *       font_size: Font size for the menu, in pixels.
 *       font_face: Font to use for the menu (single font name string).
 *       line_height: Line height of menu text, in pixels.
 *       button_border_width: Pixel width of menu button borders.
 *       button_text_outline_width: Pixel width of the outline of text on
 *           menu buttons.
 *
 */
export function BaseMenu(ctx, pos, shape, style) {
    this.ctx = ctx;
    this.pos = pos || {};
    this.shape = shape || {};
    this.style = style || {};
    this.style.padding = this.style.padding || 12;
    this.style.border_width = this.style.border_width || 1;
    this.style.font_size = this.style.font_size || MENU_FONT_SIZE;
    this.style.font_face = this.style.font_face || draw.FONT_FACE;
    this.style.line_height = this.style.line_height || draw.FONT_SIZE;
    this.style.button_border_width = this.style.button_border_width || 1;
    this.style.button_text_outline_width = (
        this.style.button_text_outline_width || 0
    );
    this.modal = false;
}

/**
 * Function to retrieve a color using this menu's style.
 *
 * @param name The name of the color sub-category to retrieve.
 * @return A color for the given sub-category.
 */
BaseMenu.prototype.color = function (name) {
    return style_color(this.style, name);
};

/**
 * Sets the current font to the font specified by this menu's style.
 *
 * @param ctx The canvas context to set the font for.
 */
BaseMenu.prototype.set_font = function (ctx) {
    ctx.font = (
        (this.style.font_size * ctx.viewport_scale) + "px "
        + this.style.font_face
    );
    ctx.fillStyle = this.color("text");
};

/**
 * Determines whether this menu is hit by a click at the given canvas
 * position.
 *
 * @param pos An array containing canvas x/y values in pixels.
 */
BaseMenu.prototype.is_hit = function (pos) {
    var ap = this.abspos();
    var as = this.absshape();
    return (
        pos[0] > ap[0]
        && pos[1] > ap[1]
        && pos[0] < ap[0] + as[0]
        && pos[1] < ap[1] + as[1]
    );
};

/**
 * A function for converting a complicated position and/or size value
 * into a concrete value in pixels to be used with canvas drawing.
 *
 * @param x The complex value to convert.
 * @param max The maximum allowed value for the conversion.
 *
 * @return A numerical value specifying a number of pixels.
 *
 * The max argument is used when the unit is '%'. Acceptable units are
 * 'ex', 'em', '%', and 'px'; the value may also be a number or a
 * function instead of a string: a number will be used as-is, while a
 * function will be called with the menu object as an argument and its
 * return value will be used.
 */
BaseMenu.prototype.concrete = function (x, max) {
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
};

/**
 * Computes the absolute position of this menu.
 *
 * @return An array containing x and y pixel values for the top-left
 * corner of the menu.
 */
BaseMenu.prototype.abspos = function () {
    // Compute current absolute position in canvas coordinates
    let result = [ 0, 0 ];
    if (this.pos.hasOwnProperty("left") && this.pos.left != undefined) {
        result[0] = this.concrete(this.pos.left, this.ctx.cwidth);
    } else if (
        this.pos.hasOwnProperty("right")
     && this.pos.right != undefined
    ) {
        if (
            this.shape.hasOwnProperty("width")
         && this.shape.width != undefined
        ) {
            let w = (
                this.concrete(this.shape.width, this.ctx.cwidth)
                * this.ctx.viewport_scale
            );
            result[0] = (
                this.ctx.cwidth
                - this.concrete(this.pos.right, this.ctx.cwidth)
                - w
            );
        } else { // auto-width -> symmetrical
            result[0] = this.concrete(this.pos.right, this.ctx.cwidth);
        }
    } else {
        if (
            this.shape.hasOwnProperty("width")
         && this.shape.width != undefined
        ) {
            let w = (
                this.concrete(this.shape.width, this.ctx.cwidth)
                * this.ctx.viewport_scale
            );
            result[0] = (this.ctx.cwidth - w)/2; // centered
        } else {
            result[0] = DEFAULT_MARGIN * this.ctx.cwidth; // no info default
        }
    }
    if (this.pos.hasOwnProperty("top") && this.pos.top != undefined) {
        result[1] = this.concrete(this.pos.top, this.ctx.cheight);
    } else if (
        this.pos.hasOwnProperty("bottom")
        && this.pos.bottom != undefined
    ) {
        if (
            this.shape.hasOwnProperty("height")
            && this.shape.height != undefined
        ) {
            let h = (
                this.concrete(this.shape.height, this.ctx.cheight)
                * this.ctx.viewport_scale
            );
            result[1] = (
                this.ctx.cheight
                - this.concrete(this.pos.bottom, this.ctx.cheight)
                - h
            );
        } else { // auto-height -> symmetrical
            result[1] = this.concrete(this.pos.bottom, this.ctx.cheight);
        }
    } else {
        if (
            this.shape.hasOwnProperty("height")
            && this.shape.height != undefined
        ) {
            let h = (
                this.concrete(this.shape.height, this.ctx.cheight)
                * this.ctx.viewport_scale
            );
            result[1] = (this.ctx.cheight - h)/2; // centered
        } else {
            result[1] = DEFAULT_MARGIN * this.ctx.cheight; // no info default
        }
    }
    return result;
};

/**
 * Computes the absolute shape of this menu.
 *
 * @return An array containing pixel values for the width and height of
 *     this menu.
 */
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
    if (
        this.shape.hasOwnProperty("height")
     && this.shape.height != undefined
    ) {
        result[1] = this.shape.height * this.ctx.viewport_scale;
    } else {
        if (this.pos.hasOwnProperty("bottom") && this.pos.bottom != undefined) {
            result[1] = (this.ctx.cheight - this.pos.bottom) - ap[1];
        } else {
            result[1] = this.ctx.cheight - 2*ap[1]; // symmetric
        }
    }
    return result;
};

/**
 * Returns the position of a given point relative to the top-left corner
 * of this menu.
 *
 * @param pos An array containing x/y pixel values for a point.
 * @return An array containing x/y pixel values for the vector from the
 *     top-left corner of this menu to the given point.
 */
BaseMenu.prototype.rel_pos = function (pos) {
    var ap = this.abspos();
    return [ pos[0] - ap[0], pos[1] - ap[1] ];
};

/**
 * Returns the center point of this menu.
 *
 * @return An array containing x/y pixel values for the center of this
 *     menu.
 */
BaseMenu.prototype.center = function () {
    var ap = this.abspos();
    var as = this.absshape();
    return [ ap[0] + as[0]/2, ap[1] + as[1]/2 ];
};

/**
 * Draws the menu background and edges, which are the same for all types
 * of menus. Specific menus should override this method but also call it.
 *
 * @param ctx The canvas context object to use for drawing.
 *
 * @return Whether or not a refresh will be needed after this frame. This
 *     method always returns false, but an overridden version might want
 *     to return true sometimes.
 */
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
};


/**
 * A ModalMenu is any menu which sits on top of everything else and takes
 * focus while it's active. By default, clicking/tapping anywhere outside
 * of a modal menu will close it. Instead of using ModalMenu directly,
 * use of of the other menus based on it.
 *
 * Parameters are the same as those for BaseMenu.
 */
export function ModalMenu(ctx, pos, shape, style) {
    BaseMenu.call(this, ctx, pos, shape, style);
    this.modal = true;
}
ModalMenu.prototype = Object.create(BaseMenu.prototype);
ModalMenu.prototype.constructor = ModalMenu;

/**
 * By default missing a modal menu closes it. See BaseMenu.tap.
 */
ModalMenu.prototype.tap = function (pos, hit) {
    if (this.modal && !hit) {
        remove_menu(this);
    }
};

/**
 * A Dialog pops up and shows the given text, disabling all other
 * interaction until one of its buttons is tapped. The 'buttons' argument
 * should be a list of objects that have 'text' and 'action' properties.
 * Only one of the actions will be triggered.
 *
 * @param ctx The canvas context to use for drawing.
 * @param pos The menu position (see BaseMenu).
 * @param shape The menu shape (see BaseMenu).
 * @param style The menu style (see BaseMenu).
 * @param text A string containing the text to be displayed in the dialog
 *     box.
 * @param buttons An array of button objects, each of which must have
 *     'text' and 'action' properties. The button text will be drawn on
 *     the button, and when a button is clicked, its action function will
 *     be called (without arguments).
 */
export function Dialog(ctx, pos, shape, style, text, buttons) {
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

/**
 * Handles clicks/taps on a dialog.
 */
Dialog.prototype.tap = function (pos, hit) {
    if (!hit) {
        return; // dialog remains open until a button is clicked...
        // TODO: provide an escape mechanism? (e.g., what if there's a UI
        // glitch?)
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
};

/**
 * Drawing function for dialogs. Draws the text in a box with the buttons
 * arranged horizontally below it.
 *
 * @param ctx The canvas context to use for drawing.
 */
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
            remove_menu(this);
        }
        return true;
    }
    return false;
};

/**
 * Called when the menu is cleaned up. We end up resetting the fade
 * parameter so that if the menu is re-activated, it won't immediately
 * start fading out again.
 */
Dialog.prototype.removed = function () {
    this.fade = undefined;
};

/*
 * A ToggleMenu is a persistent button that can be tapped to toggle
 * between on and off states, calling the on_action or off_action
 * function each time it transitions.
 *
 * @param ctx The canvas context to draw on.
 * @param pos The menu position (see BaseMenu).
 * @param shape The menu shape (see BaseMenu).
 * @param style The menu style (see BaseMenu).
 * @param text The text that appears on the button.
 * @param on_action A function to be called (with no parameters) when the
 *     toggle is flipped into the 'on' state.
 * @param off_action A function to be called (with no parameters) when the
 *     toggle is flipped into the 'off' state.
 */
export function ToggleMenu(ctx, pos, shape, style, text, on_action, off_action){
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

/**
 * Call this function to turn the toggle on.
 */
ToggleMenu.prototype.on = function () {
    this.on_();
    this.on_action();
};

/**
 * Call this function to turn the toggle off.
 */
ToggleMenu.prototype.off = function () {
    this.off_();
    this.off_action();
};

/**
 * Use this to turn the toggle on without triggering the toggle action.
 * Use with caution.
 */
ToggleMenu.prototype.on_ = function () {
    this.style.colors = this.style.colors || {};
    this.style.colors.background = this.color("active_background");
    this.style.colors.border = this.color("active_border");
    this.is_on = true;
};

/**
 * Use this to turn the toggle off without triggering the toggle action.
 * Use with caution.
 */
ToggleMenu.prototype.off_ = function () {
    // Turn off without triggering the toggle action.
    this.style.colors = this.style.colors || {};
    this.style.colors.background = this.color("inactive_background");
    this.style.colors.border = this.color("inactive_border");
    this.is_on = false;
};

/**
 * Use to flip the toggle into the opposite state from its current state.
 */
ToggleMenu.prototype.toggle = function () {
    if (this.is_on) {
        this.off();
    } else {
        this.on();
    }
};

/**
 * Flips the toggle when the menu is hit. See BaseMenu.tap.
 */
ToggleMenu.prototype.tap = function (pos, hit) {
    if (hit) {
        this.toggle();
    }
};

/**
 * Draws a box with the button text inside it. See BaseMenu.draw.
 */
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
};

/**
 * A ScrollBox displays a vertical list of items, allowing the user to
 * scroll vertically and/or horizontally to view them if they're too
 * big/numerous for the box. If a delegate is supplied, it should provide
 * .height(item, ctx), .width(item, ctx), .draw(item, ctx, width), and
 * .tap(item, rxy) functions, otherwise the items themselves should
 * supply those functions (sans the item argument).
 *
 * @param ctx The canvas to draw on.
 * @param pos The menu position (see BaseMenu).
 * @param shape The menu shape (see BaseMenu).
 * @param style The menu style (see BaseMenu).
 * @param items An array of items, each of which should have .height,
 *     .width, .draw, and .tap functions unless a delegate is supplied
 *     (see above).
 * @param delegate (optional) An alternate function for determining the
 *     size, appearance, and behavior of list items. Allows the items to
 *     be something like a list of strings (or other objects) while
 *     scroll-box-specific functionality is implemented in a separate
 *     place. Should have .height, .width, .draw, and .tap functions (see
 *     above).
 */
export function ScrollBox(ctx, pos, shape, style, items, delegate) {
    BaseMenu.call(this, ctx, pos, shape, style);
    this.style.scrollbar_width = this.style.scrollbar_width || 24;
    this.scroll_position = [-this.style.padding, -this.style.padding];
    this.press_last = undefined;
    this.scroll_drag = false;
    this.press_time = 0;
    this.items = items;
    this.delegate = delegate;
}

ScrollBox.prototype = Object.create(BaseMenu.prototype);
ScrollBox.prototype.constructor = ScrollBox;

/**
 * Replaces the scroll box items with a new set of items. If you maintain
 * an reference to the original items array, it's also safe to directly
 * modify that by adding/removing items.
 *
 * @param new_items The new items to use.
 */
ScrollBox.prototype.replace_items = function(new_items) {
    this.items = new_items;
};

/**
 * A function for retrieving the height of an individual item in this
 * scroll box, either using the delegate object or the item itself.
 *
 * @param it The item to determine the height of.
 *
 * @return The height of the item.
 */
ScrollBox.prototype.get_item_height = function(it) {
    if (this.delegate) {
        return this.delegate.height(it, this.ctx);
    } else {
        return it.height(this.ctx);
    }
};

/**
 * Like get_item_height, but for item widths.
 *
 * @param it The item to determine the width of.
 *
 * @return the natural width of the item.
 */
ScrollBox.prototype.get_item_width = function(it) {
    if (this.delegate) {
        return this.delegate.width(it, this.ctx);
    } else {
        return it.width(this.ctx);
    }
};

/**
 * A function for drawing an individual item. Notice that the width
 * parameter requests that the item occupy a specified width, which will
 * be may be smaller or larger than the item's natural width.
 *
 * @param it The item to draw.
 * @param ctx The drawing context to draw it on.
 * @param width The desired width.
 *
 * @return Returns the result of whatever draw function was invoked.
 */
ScrollBox.prototype.draw_item = function(it, ctx, width) {
    if (this.delegate) {
        return this.delegate.draw(it, ctx, width);
    } else {
        return it.draw(ctx, width);
    }
};

/**
 * Determines the response when an item is clicked/tapped on.
 *
 * @param it The item that was clicked on.
 * @param rxy A two-item array of relative x/y coordinates indicating the
 *     position of the click/tap within the item that was hit.
 *
 * @return Returns the return value of whatever handler function was
 *     invoked.
 */
ScrollBox.prototype.tap_item = function(it, rxy) {
    if (this.delegate) {
        return this.delegate.tap(it, rxy);
    } else {
        return it.tap(rxy);
    }
};

/**
 * Determines the maximum width of all items in the scrollbox. Simply
 * uses the value of style.fixed_item_width if there is one.
 *
 * @return The maximum width of all items in the scroll box, or the
 *     scroll box's fixed width if one is specified.
 */
ScrollBox.prototype.item_max_width = function() {
    if (this.style.fixed_item_width) {
        return this.style.fixed_item_width;
    } else {
        let result = 0;
        for (let it of this.items) {
            let w = this.get_item_width(it);
            if (w > result) {
                result = w;
            }
        }
        return result;
    }
};

/**
 * @return The combined height of all items in the scroll box.
 */
ScrollBox.prototype.item_total_height = function() {
    if (this.style.fixed_item_height) {
        return this.style.fixed_item_height * this.items.length;
    } else {
        let result = 0;
        for (let it of this.items) {
            result += this.get_item_height(it);
        }
        return result;
    }
};

/**
 * Determines the geometry of the scroll box's scroll bar.
 *
 * @return An array of four values: the vertical min and max pixel
 *     coordinates, followed by the horizontal min and max pixel
 *     coordinates.
 */
ScrollBox.prototype.sb_geom = function () {
    // Computes scrollbar geometry: vert min/max and horiz min/max.
    let as = this.absshape();
    let w = as[0];
    let h = as[1];
    let asw = this.style.scrollbar_width * this.ctx.viewport_scale;
    let sb_vmin = w - asw;
    let sb_vmax = w;
    let ixw = this.item_max_width(this.ctx);
    let sb_hmin = undefined;
    let sb_hmax = undefined;
    if (ixw > w) {
        sb_hmin = h - asw;
        sb_hmax = h;
    }
    return [
        sb_vmin,
        sb_vmax,
        sb_hmin,
        sb_hmax
    ];
};

/**
 * Determines the scroll limits for the scroll box.
 *
 * @return An array of four (pixel-unit) values: the minimum and maximum
 *     vertical scroll positions, and the minimum and maximum horizontal
 *     scroll positions.
 */
ScrollBox.prototype.scroll_limits = function() {
    let as = this.absshape();
    let w = as[0];
    let h = as[1];

    let ixw = this.item_max_width();
    let min_horiz = -this.style.padding;
    let max_horiz = ixw - (w - 2 * this.style.padding);

    let ith = this.item_total_height();
    let min_vert = -this.style.padding;
    let max_vert = ith - (h - 2 * this.style.padding);

    return [
        min_vert,
        Math.max(min_vert, max_vert),
        min_horiz,
        Math.max(min_horiz, max_horiz)
    ];
};

/**
 * Handles taps on the scroll box. Taps on scrollbar arrows scroll the
 * menu, taps on scroll bars jump up or down to that % of the scroll
 * area, and taps on visible items trigger item actions.
 *
 * @param pos The absolute pixel position of the tap.
 * @param hit A boolean determining whether or not the tap hit this menu.
 */
ScrollBox.prototype.tap = function (pos, hit) {
    let as = this.absshape();
    let w = as[0];
    let h = as[1];

    let rp = this.rel_pos(pos);
    let x = rp[0];
    let y = rp[1];
    if (!hit || this.press_time > 3) {
        // Don't count misses or the end of low-motion scrolling.
        return;
    }

    let sbg = this.sb_geom();
    let sb_vmin = sbg[0];
    let sb_vmax = sbg[1];
    let sb_hmin = sbg[2];
    let sb_hmax = sbg[3];

    let asw = this.style.scrollbar_width * this.ctx.viewport_scale;

    if (x >= sb_vmin && x <= sb_vmax) { // hit on the vertical scrollbar
        let sl = this.scroll_limits();
        let vn = sl[0];
        let vx = sl[1];
        this.scroll_position = [
            this.scroll_position[0],
            vn + (vx - vn) * (y / h)
        ];
    } else if (y >= sb_hmin && y <= sb_hmax) { // hit on the horizontal bar
        let sl = this.scroll_limits();
        let hn = sl[2];
        let hx = sl[3];
        this.scroll_position = [
            hn + (hx - hn) * (x / (w - asw)),
            this.scroll_position[1]
        ];
    } else { // hit on an item
        let lrx = x + this.scroll_position[0];
        let lry = y + this.scroll_position[1];
        let idx = undefined;
        let iry = 0;
        if (this.style.fixed_item_height) {
            idx = Math.floor(lry / this.style.fixed_item_height);
            iry = lry % this.style.fixed_item_height;
        } else {
            idx = 0;
            let remaining = lry;
            for (let it of this.items) {
                let ih = this.get_item_height(it);
                remaining -= ih;
                if (remaining < 0) {
                    iry = ih + remaining;
                    break;
                } else {
                    idx += 1;
                }
            }
        }
        if (idx < 0 || idx >= this.items.length) {
            // out-of-range selection
            return;
        }
        this.tap_item(this.items[idx], [lrx, iry]);
    }
};

/**
 * Called continuously during a drag/swipe. Updates the ScrollBox scroll
 * values.
 *
 * @param path The path of positions in the current drag so far (an array
 *     of 2-element x/y coordinate arrays).
 * @param hit A boolean indicating if the current drag event started on
 *     this menu or not. Based on the initial position of the drag, not
 *     on the current mouse position.
 */
ScrollBox.prototype.drag = function (path, hit) {
    if (path.length < 1) {
        return;
    }

    let pos = path[path.length - 1];

    let rp = this.rel_pos(pos);
    let x = rp[0];
    let y = rp[1];

    let as = this.absshape();
    let w = as[0];
    let h = as[1];

    let sbg = this.sb_geom();
    let sb_vmin = sbg[0];
    let sb_vmax = sbg[1];
    let sb_hmin = sbg[2];
    let sb_hmax = sbg[3];

    let sl = this.scroll_limits();
    let vn = sl[0];
    let vx = sl[1];
    let hn = sl[2];
    let hx = sl[3];

    if (
        this.scroll_drag == "vert"
     || (this.press_last == undefined && x >= sb_vmin && x <= sb_vmax)
    ) { // hit on the vertical scrollbar
        this.scroll_drag = "vert";
        this.scroll_position = [
            this.scroll_position[0],
            vn + (vx - vn) * (y / h)
        ];
    } else if (
        this.scroll_drag == "horiz"
     || (this.press_last == undefined && y >= sb_hmin & y <= sb_hmax)
    ) { // hit on the horizontal scrollbar
        this.scroll_drag = "horiz";
        let asw = this.style.scrollbar_width * this.ctx.viewport_scale;
        this.scroll_position = [
            hn + (hx - hn) * (x / (w - asw)),
            this.scroll_position[1]
        ];
    } else { // hit elsewhere in the window
        if (this.press_last != undefined && hit) {
            this.scroll_position[0] -= x - this.press_last[0];
            this.scroll_position[1] -= y - this.press_last[1];
        }
        if (this.press_last != undefined || hit) {
            this.press_time += 1;
            this.press_last = rp;
        }
    }
    if (this.scroll_position[0] < hn) { this.scroll_position[0] = hn; }
    if (this.scroll_position[0] > hx) { this.scroll_position[0] = hx; }
    if (this.scroll_position[1] < vn) { this.scroll_position[1] = vn; }
    if (this.scroll_position[1] > vx) { this.scroll_position[1] = vx; }
};

/**
 * Called at the end of a swipe.
 *
 * @param path The path of the swipe (an array of 2-element x/y
 *     coordinate arrays).
 * @param st_hit A boolean specifying whether the beginning of the swipe
 *     was inside this menu.
 * @param ed_hit A boolean specifying whether the end of the swipe was
 *     inside this menu.
 */
ScrollBox.prototype.swipe = function (path, st_hit, ed_hit) {
    // Reset the scrolling context when a swipe finishes
    this.press_time = 0;
    this.press_last = undefined;
    this.scroll_drag = false;
};

/**
 * Called to draw the scroll box.
 *
 * @param ctx The canvas context to draw on.
 *
 * @return Whether or not further screen updates are needed due to
 *     animation of this menu. Always returns false.
 */
ScrollBox.prototype.draw = function(ctx) {
    // draw a box (w/ border)
    BaseMenu.prototype.draw.apply(this, [ctx]);

    // absolute position/shape:
    let ap = this.abspos();
    let ox = ap[0];
    let oy = ap[1];

    let as = this.absshape();
    let w = as[0];
    let h = as[1];
    let lh = this.style.line_height * ctx.viewport_scale;

    // scroll limits:
    let sl = this.scroll_limits();
    let vn = sl[0];
    let vx = sl[1];
    let hn = sl[2];
    let hx = sl[3];

    // draw vertical scrollbar:
    let asw = this.style.scrollbar_width * ctx.viewport_scale;
    ctx.beginPath();
    ctx.fillStyle = this.color("button");
    ctx.strokeStyle = this.color("border");
    ctx.rect(ox + w - asw, oy, asw, h);
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = this.color("selected_button");
    if (this.items.length > 0) {
        let tsh = vx - vn;
        let ith = this.item_total_height();
        let sb_st = (this.scroll_position[1] - vn) / ith;
        let sb_ed = ((this.scroll_position[1] + h) - vn) / ith;
        if (sb_st < 0) { sb_st = 0; }
        if (sb_ed > 1) { sb_ed = 1; }
        sb_st *= h;
        sb_ed *= h;
        ctx.beginPath();
        ctx.rect(ox + w - asw, oy + sb_st, asw, sb_ed - sb_st);
        ctx.fill();

        // Draw little arrows if there's room
        let sb_h = sb_ed - sb_st;
        if (sb_h >= asw) {
            let ao = asw/ARROW_SIZE_FRACTION;
            let left = ox + w - asw + ao;
            let middle = ox + w - asw/2;
            let right = ox + w - ao;
            let tt = oy + sb_st + ao;
            let tb = oy + sb_st + asw - ao;
            let bt = oy + sb_ed - asw + ao;
            let bb = oy + sb_ed - ao;
            if (sb_h < 2*asw) {
                // adjust for smaller area:
                let each = sb_h / 2;
                let diff = asw - each;
                let scale_diff = diff * (asw - 2*ao) / asw;
                left += scale_diff;
                right -= scale_diff;
                tb -= scale_diff;
                bt += scale_diff;
            }
            ctx.strokeStyle = this.color("button_text");
            // top arrow
            ctx.beginPath();
            ctx.moveTo(left, tb);
            ctx.lineTo(middle, tt);
            ctx.lineTo(right, tb);
            ctx.stroke();
            // bottom arrow
            ctx.beginPath();
            ctx.moveTo(left, bt);
            ctx.lineTo(middle, bb);
            ctx.lineTo(right, bt);
            ctx.stroke();
        }
    } else {
        // fill whole scrollbar rect
        ctx.fill();
    }

    // draw horizontal scrollbar if necessary:
    let clip_bot = 0;
    if (this.item_max_width() > w) {
        clip_bot = asw;
        ctx.fillStyle = this.color("button");
        ctx.strokeStyle = this.color("border");
        ctx.rect(ox, oy + h - asw, w, asw);
        ctx.stroke();
        ctx.fill();
        ctx.fillStyle = this.color("selected_button");

        let tsh = hx - hn;
        let ixw = this.item_max_width();
        let sb_st = (this.scroll_position[0] - hn) / ixw;
        let sb_ed = ((this.scroll_position[0] + w) - hn) / ixw;
        if (sb_st < 0) { sb_st = 0; }
        if (sb_ed > 1) { sb_ed = 1; }
        sb_st *= w;
        sb_ed *= w;
        ctx.beginPath();
        ctx.rect(ox + sb_st, oy + h - asw, sb_ed - sb_st, asw);
        ctx.fill();

        // Draw little arrows if there's room
        let sb_w = sb_ed - sb_st;
        if (sb_w >= asw) {
            let ao = asw/ARROW_SIZE_FRACTION;
            let top = oy + h - asw + ao;
            let middle = oy + h - asw/2;
            let bot = oy + h - ao;
            let ll = ox + sb_st + ao;
            let lr = ox + sb_st + asw - ao;
            let rl = ox + sb_ed - asw + ao;
            let rr = ox + sb_ed - ao;
            if (sb_w < 2*asw) {
                // adjust for smaller area:
                let each = sb_w / 2;
                let diff = asw - each;
                let scale_diff = diff * (asw - 2*ao) / asw;
                top += scale_diff;
                bot -= scale_diff;
                lr -= scale_diff;
                rl += scale_diff;
            }
            ctx.strokeStyle = this.color("button_text");
            // left arrow
            ctx.beginPath();
            ctx.moveTo(lr, top);
            ctx.lineTo(ll, middle);
            ctx.lineTo(lr, bot);
            ctx.stroke();
            // right arrow
            ctx.beginPath();
            ctx.moveTo(rl, top);
            ctx.lineTo(rr, middle);
            ctx.lineTo(rl, bot);
            ctx.stroke();
        }
    }

    // set clip region:
    ctx.rect(ox, oy, w - asw, h - clip_bot);
    ctx.save();
    ctx.clip();


    // draw items:
    let off_x = -this.scroll_position[0];
    let st_idx = undefined;
    let ed_idx = undefined;
    let toff = 0; // pixels to push first item up above box
    if (this.style.fixed_item_height) {
        // TODO: DEBUG THIS!
        toff = this.scroll_position[1] % this.style.fixed_item_height;
        st_idx = Math.floor(
            this.scroll_position[1]
            / this.style.fixed_item_height
        ) - 1;
        ed_idx = Math.floor(
            (this.scroll_position[1] + h - clip_bot)
            / this.style.fixed_item_height
        ) + 1;
    } else {
        st_idx = 0;
        ed_idx = 0;
        let rtop = this.scroll_position[1];
        let rbot = rtop + h - clip_bot;
        let found_top = false;
        for (let it of this.items) {
            let h = this.get_item_height(it);
            if (!found_top && rtop < h) {
                toff = rtop;
                found_top = true;
            } else if (!found_top) {
                st_idx += 1;
            }
            if (rbot < h) {
                ed_idx += 1;
                break;
            } else {
                ed_idx += 1;
            }
            rtop -= h;
            rbot -= h;
        }
    }
    if (st_idx >= this.items.length) { st_idx = this.items.length - 1; }
    if (ed_idx > this.items.length) { ed_idx = this.items.length; }
    if (st_idx < 0) { st_idx = 0; }
    if (ed_idx < 0) { ed_idx = 0; }

    let off_y = -toff;
    for (let idx = st_idx; idx < ed_idx; ++idx) {
        let it = this.items[idx];
        let h = this.get_item_height(it);
        ctx.save();
        ctx.translate(ox + off_x, oy + off_y);
        this.draw_item(it, ctx, w - asw - this.style.padding*2);
        ctx.restore();
        off_y += h;
    }

    // undo clipping:
    ctx.restore();

    return false; // no further updates needed
};

// A LinksMenu displays a scrollable list of items with optional clickable
// prefixes for each item. If base_url is left undefined or given some
// false value, tapping won't open links. base_url should have the string
// "<item>" in it, which will be replaced by the selected item. Example:
//
// "https://en.wiktionary.org/wiki/<item>"
//
// @param ctx The canvas context to draw on.
// @param pos The menu position (see BaseMenu).
// @param shape The menu shape (see BaseMenu).
// @param style The menu style (see BaseMenu).
// @param items An array of strings that determines what's in the menu.
// @param base_url The URL template for links to open when clicking on
//     items. Should include the text "<item>" (see above). If set to
//     undefined, clicking on items won't open links.
// @param prefix A string prefix to draw to the left of each piece of
//     item text (TODO: respect alternate text flow directions?). Set to
//     an empty string to omit prefixes; if left undefined a list bullet
//     will be used.
export function LinksMenu(ctx, pos, shape, style, items, base_url, prefix) {
    let the_list = this;
    ScrollBox.call(
        this,
        ctx,
        pos,
        shape,
        style,
        items,
        {
            "width": function (it, ctx) {
                let result = 0;
                the_list.set_font(ctx);
                let m = draw.measure_text(ctx, the_list.prefix);
                result += m.width * (1 + 2 * SMALL_MARGIN);
                m = draw.measure_text(ctx, it);
                result += m.width * (1 + 2 * SMALL_MARGIN);
                return result;
            },
            "height": function (it, ctx) {
                let result = 0;
                the_list.set_font(ctx);
                let m = draw.measure_text(ctx, the_list.prefix);
                result = m.height * (1 + 2 * SMALL_MARGIN);
                m = draw.measure_text(ctx, it);
                let h = m.height * (1 + 2 * SMALL_MARGIN);
                if (h > result) {
                    result = h;
                }
                return result;
            },
            "tap": function (it, rxy) {
                the_list.set_font(ctx);
                let m = draw.measure_text(ctx, the_list.prefix);
                let w = m.width * (1 + 2 * SMALL_MARGIN);
                if (rxy[0] <= w && the_list.base_url) { // trigger the link
                    let target = the_list.base_url.replace(
                        "<item>",
                        locale.lc_lower(it)
                    );
                    window.open(target);
                }
            },
            "draw": function (it, ctx) {
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                // TODO: Box up the text!

                let pm = draw.measure_text(ctx, the_list.prefix);
                let phm = pm.width * SMALL_MARGIN;
                let pvm = pm.height * SMALL_MARGIN;
                let pw = pm.width * (1 + 2*SMALL_MARGIN);
                let ph = pm.height * (1 + 2*SMALL_MARGIN);
                ctx.fillText(the_list.prefix, phm, ph/2);
                ctx.strokeStyle = the_list.color("border");
                ctx.rect(0, 0, pw, ph);

                let im = draw.measure_text(ctx, it);
                let ihm = im.width * SMALL_MARGIN;
                let ivm = im.height * SMALL_MARGIN;
                let iw = im.width * (1 + 2*SMALL_MARGIN);
                let ih = im.height * (1 + 2*SMALL_MARGIN);
                ctx.fillText(it, pw + ihm, ih/2);
                ctx.strokeStyle = the_list.color("border");
                ctx.rect(0, 0, iw, ih);
            },
        }
    );
    this.base_url = base_url;
    if (prefix == undefined) {
        this.prefix = "·";
    } else {
        this.prefix = prefix;
    }
}

LinksMenu.prototype = Object.create(ScrollBox.prototype);
LinksMenu.prototype.constructor = LinksMenu;

/**
 * Sets a new base URL for the menu. The base URL should always include
 * the text "<item>".
 *
 * @param new_base_url The new base URL to use.
 */
LinksMenu.prototype.set_base_url = function(new_base_url) {
    this.base_url = new_base_url;
};


/**
 * A QuestList is a scrollable list of quests, which displays summary
 * information about each one.
 *
 * @param ctx The canvas context to use for drawing.
 * @param pos The menu position (see BaseMenu).
 * @param shape The menu shape (see BaseMenu).
 * @param style The menu style (see BaseMenu).
 * @param quests An array of quests.Quest objects to display in the menu.
 */
export function QuestList(ctx, pos, shape, style, quests) {
    ScrollBox.call(
        this,
        ctx,
        pos,
        shape,
        style,
        quests
    );
}

QuestList.prototype = Object.create(ScrollBox.prototype);
QuestList.prototype.constructor = QuestList;


/**
 * A WordList is a scrollable list of words. Tapping on a word opens a
 * definition link for that word, while swiping scrolls the menu.
 *
 * @param ctx The canvas context to use for drawing.
 * @param pos The menu position (see BaseMenu).
 * @param shape The menu shape (see BaseMenu).
 * @param style The menu style (see BaseMenu).
 * @param words An array of strings listing the words to be included.
 * @param base_url A URL template that includes the text "<item>".
 */
export function WordList(ctx, pos, shape, style, words, base_url) {
    LinksMenu.call(this, ctx, pos, shape, style, words, base_url, "📖");
}

WordList.prototype = Object.create(LinksMenu.prototype);
WordList.prototype.constructor = WordList;


/**
 * A ButtonMenu is both a menu and a clickable button. The action is
 * triggered whenever it is clicked.
 *
 * @param ctx The canvas context to use for drawing.
 * @param pos The menu position (see BaseMenu).
 * @param shape The menu shape (see BaseMenu).
 * @param style The menu style (see BaseMenu).
 * @param text The text that appears on the face of the button.
 * @param action A function to be called (without arguments) when the
 *     button is clicked.
 */
export function ButtonMenu(ctx, pos, shape, style, text, action) {
    BaseMenu.call(this, ctx, pos, shape, style);
    this.text = text;
    this.action = action;
}
ButtonMenu.prototype = Object.create(BaseMenu.prototype);
ButtonMenu.prototype.constructor = ButtonMenu;

/**
 * Triggers the button action when the button is tapped.
 *
 * @param pos The absolute canvas position of the tap.
 * @param hit A boolean specifying whether or not the button was hit.
 */
ButtonMenu.prototype.tap = function (pos, hit) {
    if (hit) {
        this.action();
    }
};

/**
 * Draws the button.
 *
 * @param ctx The canvas context to use for drawing.
 */
ButtonMenu.prototype.draw = function (ctx) {
    BaseMenu.prototype.draw.apply(this, [ctx]);
    this.set_font(ctx);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var ctr = this.center();
    ctx.fillText(this.text, ctr[0], ctr[1]);
    return false; // no further updates needed
};

/**
 * A ButtonMenu which displays glyphs-so-far, and which can flash colors.
 *
 * @param ctx The canvas context to use for drawing.
 * @param pos The menu position (see BaseMenu).
 * @param shape The menu shape (see BaseMenu).
 * @param style The menu style (see BaseMenu).
 * @param text The string of glyphs to display.
 * @param action The action to trigger when the button is activated.
 */
export function GlyphsMenu(ctx, pos, shape, style, text, action) {
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

/**
 * Adds a single glyph to the button text.
 *
 * @param glyph A one-character string containing an additional glyph to
 *     display.
 */
GlyphsMenu.prototype.add_glyph = function (glyph) {
    // Add a glyph
    this.glyphs.push(glyph);
    this.adjust_width();
};

/**
 * Removes the last glyph from the button text.
 */
GlyphsMenu.prototype.remove_glyph = function () {
    // Remove the last glyph
    this.glyphs.pop();
    this.adjust_width();
};

/**
 * Replaces the current glyphs with a new array of glyphs.
 *
 * @param glyphs An array of one-character strings. NOT a string. This
 *     array will be copied and not used directly, so updates
 *     after-the-fact won't change anything.
 */
GlyphsMenu.prototype.set_glyphs = function (glyphs) {
    this.glyphs = glyphs.slice();
    this.adjust_width();
};

/**
 * Adjusts the width of the menu to account for the current glyphs being
 * displayed.
 */
GlyphsMenu.prototype.adjust_width = function () {
    // Sets display_text and shape.width based on text contents.
    this.set_font(this.ctx);
    this.display_text = this.glyphs.join("");
    var m = draw.measure_text(this.ctx, this.display_text);
    var dw = m.width + this.style.padding * 2;
    while (dw > this.style.max_width * this.ctx.cwidth) {
        this.display_text = this.display_text.slice(
            0,
            this.display_text.length - 2
        ) + "…";
        m = draw.measure_text(this.ctx, this.display_text);
        dw = m.width + this.style.padding * 2;
    }
    this.shape.width = dw;
};

/**
 * Initiates a flash of color using the border of the menu. The actual
 * flash will happen over the course of many animation frames.
 *
 * @param color The color to use (must be an RGB hex string).
 */
GlyphsMenu.prototype.flash = function (color) {
    this.fade_color = color;
    this.fade = 1.0;
};

/**
 * Draws the glyphs menu.
 *
 * @param ctx The canvas context to use for drawing.
 */
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
};

/**
 * A SlotsMenu has an adjustable number of slots, and each slot can be
 * filled or emptied, and may trigger an action when clicked. The action
 * callback is called with the glyph value of the slot that was clicked
 * on when one is clicked on. The initial number of slots will be
 * determined by the length of the contents iterable, along with their
 * initial values. null, false, undefined or other false-values may be
 * used to represent initially-empty slots. The slot_width variable of
 * the shape object is used to determine the size of each slot; it will
 * be compute from shape.width and contents.length if not given,
 * otherwise shape.width will be computed from it and contents.length.
 *
 * @param ctx The canvas context to use for drawing.
 * @param pos The menu position (see BaseMenu).
 * @param shape The menu shape (see BaseMenu).
 * @param style The menu style (see BaseMenu).
 * @param contents A string or an array of length-one glyph strings.
 * @param action The action function to call when a slot is clicked on.
 *     It will be given the menu object and the glyph in the selected
 *     slot as arguments. TODO: that.
 *
 * TODO: This menu type has not yet been fully implemented.
 */
export function SlotsMenu(ctx, pos, shape, style, contents, action) {
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
    for (let glyph of contents) {
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

/**
 * Adjusts the width of the menu according to the number of slots and the
 * slot_width specified as part of the menu shape.
 */
SlotsMenu.prototype.adjust_width = function () {
    this.shape.width = this.shape.slot_width * this.contents.legnth;
};

/**
 * Adds a slot to this menu. Omit the glyph argument to add an empty
 * slot.
 *
 * @param glyph The glyph to put in the new slot. Use undefined or omit
 *     this argument to add an empty slot.
 */
SlotsMenu.prototype.add_slot = function (glyph) {
    this.contents.push(glyph);
    this.adjust_width();
};

/**
 * Removes the last (rightmost) slot from the menu.
 *
 * @return The glyph that was in the slot which was removed, or undefined
 *     if it was empty.
 */
SlotsMenu.prototype.remove_slot = function () {
    // Removes the last (rightmost) slot
    let result = this.contents.pop();
    this.adjust_width();
    return result;
};

/**
 * Handles a tap/click on the menu.
 * TODO: Finish this function?
 *
 * @param pos The global canvas position of the tap/click.
 * @param hit A boolean indicating whether the click/tap happened within
 *     the menu or not.
 */
SlotsMenu.prototype.tap = function (pos, hit) {
    if (!hit) {
        return;
    }
    var rp = this.rel_pos(pos);

    rp[0] / this.shape.width;
    // TODO: HERE
};

/**
 * Draws the slots menu.
 *
 * @param ctx The canvas context object to use for drawing.
 */
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
};


/**
 * Adds the given menu to the top of the active menus list.
 *
 * @param menu The menu to add.
 */
export function add_menu(menu) {
    MENUS.push(menu);
    call_if_available(menu, "added", []);
    return menu;
}

/**
 * Removes the given menu from the active menus list.
 *
 * @param menu The menu to remove.
 */
export function remove_menu(menu) {
    var t = null;
    for (let i = 0; i < MENUS.length; i += 1) {
        if (MENUS[i] == menu) {
            t = i;
            break;
        }
    }
    if (t != null) {
        call_if_available(menu, "removed", []);
        MENUS = MENUS.slice(0,t).concat(MENUS.slice(t+1));
    }
}

/**
 * Calls the given function of the given object with the given arguments,
 * if that object has such a function. Returns the function's return value,
 * or undefined if no such function exists.
 *
 * @param obj The object on which to look up the function to call.
 * @param fname The name of the function to call (if available).
 * @param args An array containing the arguments to pass to the function.
 *
 * @return The function result if it exists, or undefined if there is no
 *     function with the requested name.
 */
export function call_if_available(obj, fname, args) {
    var fcn = obj[fname];
    if (fcn != undefined) {
        return fcn.apply(obj, args);
    } else {
        return undefined;
    }
}

/**
 * Handles initial presses. Calls the "press" function of the menu if it
 * exists.
 *
 * @param menu The menu to send the event to.
 * @param pos The position of the press (a 2-element x/y array).
 * @param hit A boolean specifying whether or not the given position is a
 *     hit on the given menu.
 */
export function handle_press(menu, pos, hit) {
    call_if_available(menu, "press", [pos, hit]);
}

/**
 * Handles motion during a press. Calls the "drag" function of the menu
 * if it exists.
 *
 * @param menu The menu to send the event to.
 * @param path The current path of positions that have been occupied
 *     during this drag event. The current mouse position will be the
 *     last element in this array; each element is a 2-element array of
 *     x/y positions.
 * @param hit A boolean indicating whether the drag started within the
 *     target menu. Does not indicate anything about the current position
 *     of the mouse.
 */
export function handle_drag(menu, path, hit) {
    call_if_available(menu, "drag", [path, hit]);
}

/**
 * Handles press/release pairs with low intervening motion. Calls the
 * 'tap' function of the menu if it exists.
 *
 * @param menu The menu to send the event to.
 * @param pos The position of the tap (a 2-element x/y array). This will
 *     be the position at which the mouse/finger goes up/leaves the
 *     screen.
 * @param hit Whether or not the position hits the menu (a boolean).
 */
export function handle_tap(menu, pos, hit) {
    call_if_available(menu, "tap", [pos, hit]);
}

/**
 * Handles press/release pairs with high motion. Calls the "swipe"
 * function of the menu if it exists.
 *
 * @param menu The menu to send the event to.
 * @param path An array of 2-element x/y coordinate pairs that indicate
 *     the path of the mouse/finger during the swipe that just ended.
 * @param st_hit A boolean indicating whether the start of the swipe hit
 *     the current menu.
 * @param ed_hit A boolean indicating whether the end of the swipe hit
 *     the current menu.
 */
export function handle_swipe(menu, path, st_hit, ed_hit) {
    call_if_available(menu, "swipe", [path, st_hit, ed_hit]);
}

/**
 * Handles press/release pairs where different menus are hit. Calls the
 * "bridge_from" function of the menu the swipe started on first, then
 * the "bridge_to" function of the menu the swipe ended on.
 *
 * @param smenu The menu the swipe started on.
 * @param tmenu The menu the swipe ended on.
 * @param path The path of the swipe, as an array of 2-element x/y
 *     coordinate arrays.
 * @param fr_hit A boolean indicating whether the initial position hit
 *     the start menu.
 * @param to_hit A boolean indicating whether the final position hit
 *     the destination menu.
 */
export function handle_bridge(smenu, tmenu, path, fr_hit, to_hit) {
    call_if_available(tmenu, "bridge_from", [smenu, path, fr_hit, to_hit]);
    call_if_available(smenu, "bridge_to", [tmenu, path, fr_hit, to_hit]);
}

/**
 * Returns true if the given canvas position is a hit on the given menu.
 * Uses the menu's "is_hit" function to do so, and returns false if the
 * menu doesn't have a "is_hit" menu.
 *
 * @param vpos The canvas position to test (an array of two x/y elements).
 * @param menu The menu to test.
 *
 * @return True if the position is a hit, and false otherwise.
 */
export function hits_menu(vpos, menu) {
    if (menu && menu.is_hit) {
        return menu.is_hit(vpos);
    } else {
        return false;
    }
}

/**
 * Clears all click-tracking context variables.
 */
export function clear_context() {
    MYCLICK = false;
    DOWNPOS = null;
    TARGET = null;
    HIT = false;
    PATH = null;
}

/**
 * Call for every mouse down event on the canvas, and only trigger other
 * behavior if this function returns false.
 *
 * @param vpos The canvas position of the mouse, as a 2-element x/y array.
 *
 * @return True if the click was handled by a menu, and false otherwise
 * (in which case the event may be handled by other mechanisms).
 */
export function mousedown(vpos) {
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
    clear_context();
    // Doesn't hit any menu, and none are modal
    return false;
}

/**
 * Call for every mouse motion event on the canvas, and only trigger other
 * behavior if this function returns false.
 *
 * @param vpos The canvas position of the mouse, as a 2-element x/y array.
 *
 * @return True if the event was handled by a menu, and false otherwise
 * (in which case the event may be handled by other mechanisms).
 */
export function mousemove(vpos) {
    if (MYCLICK) {
        PATH.push(vpos);
        handle_drag(TARGET, PATH, HIT);
        return true;
    } else {
        return false;
    }
}

/*
 * Computes total distance from a path.
 *
 * @param path An array of 2-element x/y canvas-coordinate arrays
 *     indicating a path across the canvas.
 *
 * @return The sum of the distances between each pair of successive
 *     points in the path.
 */
export function path_total_dist(path) {
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

/**
 * Computes straight-line start-to-end distance from a path.
 *
 * @param path An array as in path_total_dist.
 *
 * @return The euclidean distance directly between the first and last
 *     points in the path.
 */
export function path_straight_dist(path) {
    var dx = PATH[PATH.length-1][0] - PATH[0][0];
    var dy = PATH[PATH.length-1][1] - PATH[0][1];
    return Math.sqrt(dx*dx + dy*dy);
}

/**
 * Computes straight-line start-to-end vector from a path.
 *
 * @param path An array as in path_total_dist.
 *
 * @return A 2-element x/y canvas coordinate array containing the vector
 *     from the first entry in the path to the last one.
 */
export function path_straight_vector(path) {
    var dx = PATH[PATH.length-1][0] - PATH[0][0];
    var dy = PATH[PATH.length-1][1] - PATH[0][1];
    return [dx, dy];
}

/**
 * Call for every mouse up event on the canvas, and only trigger other
 * behavior if this function returns false.
 *
 * @param vpos The canvas position of the mouse, as a 2-element x/y array.
 *
 * @return True if the event is handled by the menu system, false if it
 *     should be handled by other systems.
 */
export function mouseup(vpos) {
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
    clear_context();
    return false;
}

/**
 * Draws all active menus.
 *
 * @param ctx The drawing context to use.
 *
 * @return True if any menu is animating and needs continued screen
 *     updates, and false if all menus are stable.
 */
export function draw_active(ctx) {
    var result = false;
    MENUS.forEach( function (m) {
        result = result || m.draw(ctx);
    });
    return result;
}
