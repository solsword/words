// menu.js
// Menu system for HTML5 canvas.
/* global console, window, document */

"use strict";

import * as grid from "./grid.js";
import * as draw from "./draw.js";
import * as colors from "./colors.js";
import * as dict from "./dict.js";
import * as player from "./player.js";

// TODO: Import this when that becomes possible (see locale.js).
// import * as locale from "./locale.js";
/* global locale */

// An array containing all menu objects.
export var ALL_MENUS = [];

/**
 * The five menu regions at the edges of and in the middle of the screen.
 */
export var CENTER_MENU_REGION;
export var TOP_MENU_REGION;
export var BOTTOM_MENU_REGION;
export var LEFT_MENU_REGION;
export var RIGHT_MENU_REGION;

/**
 * Stores the current canvas size, as provided to notify_resize.
 */
export var CANVAS_SIZE;

/**
 * Notifies the menu system of a resize, calling the resize function for
 * each existing menu object.
 *
 * @param width The new width of the game canvas in pixels.
 * @param height The new height of the game canvas in pixels.
 */
export function notify_resize(width, height) {
    CANVAS_SIZE = [width, height];
    for (let menu of ALL_MENUS) {
        menu.resize(width, height);
    }
}

/**
 * Initializes the menu system, creating the base HTML elements necessary
 * to hold menu elements.
 */
export function init_menus() {
    TOP_MENU_REGION = document.createElement("div");
    TOP_MENU_REGION.classList.add("menu_area");
    TOP_MENU_REGION.classList.add("top");
    BOTTOM_MENU_REGION = document.createElement("div");
    BOTTOM_MENU_REGION.classList.add("menu_area");
    BOTTOM_MENU_REGION.classList.add("bottom");
    LEFT_MENU_REGION = document.createElement("div");
    LEFT_MENU_REGION.classList.add("menu_area");
    LEFT_MENU_REGION.classList.add("left");
    RIGHT_MENU_REGION = document.createElement("div");
    RIGHT_MENU_REGION.classList.add("menu_area");
    RIGHT_MENU_REGION.classList.add("right");
    CENTER_MENU_REGION = document.createElement("div");
    CENTER_MENU_REGION.classList.add("menu_area");
    CENTER_MENU_REGION.classList.add("center");

    let menus_div = document.getElementById("menus");
    menus_div.appendChild(TOP_MENU_REGION);
    menus_div.appendChild(BOTTOM_MENU_REGION);
    menus_div.appendChild(LEFT_MENU_REGION);
    menus_div.appendChild(RIGHT_MENU_REGION);
    // Center is created last so that its children appear on top of the
    // children of other menus.
    menus_div.appendChild(CENTER_MENU_REGION);
}

/**
 * The BaseMenu prototype contains basic functionality common to all
 * menus. The following functions may be overridden to specify menu
 * appearance/behavior:
 *
 *   create_element: Should create and return the outermost HTML element
 *       for the menu.
 *   resize: This function will be called whenever the screen is resized,
 *       as well as once when the menu is created. It will be given two
 *       arguments: the new current width and height of the game canvas
 *       (in screen pixels, not canvas units).
 *
 * @param pos A position for the menu: either one of the strings "top",
 *     "bottom", "left", "right", or "center", or an HTML element that
 *     can serve as the parent element for the menu's HTML element.
 * @param classes (optional) A string or an array of strings representing
 *     CSS classes that should be added to this menu.
 * @param style (optional) A string specifying additional CSS code to be
 *     applied (as a style attribute) to the menu. In most cases, the
 *     default CSS rules for menus should take care of things, but this
 *     can be used for any extra customizations necessary.
 */
export function BaseMenu(pos, classes, style) {
    // Set up attributes
    this.pos = pos || "center";
    this.style = style || "";
    this.modal = false;
    this.element = this.create_element();
    this.element.classList.add("menu");

    // Register
    ALL_MENUS.push(this);

    // Set classes
    if (classes != undefined) {
        if (typeof classes == "string" || classes instanceof String) {
            this.element.classList.add(classes);
        } else { // assume it's an array of strings
            for (let cls of classes) {
                this.element.classList.add(cls);
            }
        }
    }

    // Set style attribute
    if (this.style) {
        this.element.setAttribute("style", style);
    }

    // Add to appropriate menu region
    if (this.pos == "top") {
        TOP_MENU_REGION.appendChild(this.element);
    } else if (this.pos == "bottom") {
        BOTTOM_MENU_REGION.appendChild(this.element);
    } else if (this.pos == "left") {
        LEFT_MENU_REGION.appendChild(this.element);
    } else if (this.pos == "right") {
        RIGHT_MENU_REGION.appendChild(this.element);
    } else if (this.pos == "center") {
        CENTER_MENU_REGION.appendChild(this.element);
    } else { // anything else is assumed to be an HTML element
        this.pos.appendChild(this.element);
    }

    // Add a position class if our position is a string
    if (typeof this.pos == "string" || this.pos instanceof String) {
        this.element.classList.add("pos_" + this.pos);
    }

    // Save our normal display style
    this.normal_display = window.getComputedStyle(this.element).display;

    // Call resize to initialize any canvas-size-dependent behavior
    this.resize(CANVAS_SIZE[0], CANVAS_SIZE[1]);
}

/**
 * Creates an HTML element to represent the menu. By default, simply
 * creates a DIV, but this can be overridden to create a different kind
 * of element instead. The element will be given the 'menu' class and a
 * style attribute from the style argument to BaseMenu's constructor.
 *
 * @return The element to use.
 */
BaseMenu.prototype.create_element = function() {
    return document.createElement("div");
};

/**
 * Called automatically when the window is resized. Allows a menu to
 * automatically change its shape or style based on the available
 * screen space. This default implementation does nothing.
 *
 * @param width The new width of the canvas element on the screen, in
 *     pixels. Not the canvas-units size of the canvas, nor a new desired
 *     width for this element.
 * @param height The new height of the canvas element on the screen, in
 *     pixels. Not the canvas-units size of the canvas, nor a new desired
 *     height for this element.
 */
BaseMenu.prototype.resize = function(width, height) {
    // This base-class implementation doesn't do anything.
};

/**
 * Hides this menu, temporarily removing it from the UI.
 */
BaseMenu.prototype.hide = function() {
    this.normal_display = window.getComputedStyle(this.element).display;
    this.element.style.display = "none";
};

/**
 * After using hide, use this function to re-enable a menu.
 */
BaseMenu.prototype.show = function () {
    this.element.style.display = this.normal_display;
};

/**
 * Removes the menu from the game permanently. Use hide instead to
 * temporarily hide a menu.
 */
BaseMenu.prototype.remove = function () {
    this.element.parentElement.removeChild(this.element);
};

/**
 * Determines the center of the menu in HTML coordinates.
 *
 * @return A 2-element array containing HTML x/y coordinates for the
 *     center of the menu.
 */
BaseMenu.prototype.view_center = function () {
    // TODO: HERE
    return [0, 0];
};


/**
 * An ExpandMenu is a menu which collapses to a square button that can
 * be clicked to show the full menu.
 *
 * @param icon A string of HTML code and/or an HTML DOM node that will be
 *     used to represent the menu while it's closed.
 * @param pos The position of this menu (see BaseMenu).
 * @param classes CSS classes for this menu (see BaseMenu).
 * @param style Extra style code for this menu (see BaseMenu).
 */
export function ExpandMenu(icon, pos, classes, style) {
    this.icon = icon; // must come first
    BaseMenu.call(this, pos, classes, style);
}
ExpandMenu.prototype = Object.create(BaseMenu.prototype);
ExpandMenu.prototype.constructor = ExpandMenu;

/**
 * Creates the base element for an expand menu, which is a <details>
 * node.
 */
ExpandMenu.prototype.create_element = function () {
    let elem = document.createElement("details");
    let sum = document.createElement("summary");
    if (typeof this.icon == "string" || this.icon instanceof String) {
        sum.innerHTML = this.icon;
    } else { // we assume it's a DOM element
        sum.appendChild(this.icon);
    }
    elem.appendChild(sum);
    return elem;
};


/**
 * Minimum height/width required for autoexpand menus to take up their
 * full size.
 * TODO: Adjust these. Should they be separate?
 */
export const AE_MIN_HEIGHT = 400;
export const AE_MIN_WIDTH = 400;

/**
 * An AutoExpandMenu is a menu which normally takes up space according to
 * its internal components, but which, when the screen size is too small,
 * turns into an ExpandMenu. The AutoExpandMenu's icon is not displayed
 * at all when the screen size is large enough.
 */
export function AutoExpandMenu(icon, pos, classes, style) {
    this.expansion_state = "unknown";
    ExpandMenu.call(this, icon, pos, classes, style);
    this.element.classList.add("autoexpand");
}
AutoExpandMenu.prototype = Object.create(ExpandMenu.prototype);
AutoExpandMenu.prototype.constructor = AutoExpandMenu;


/**
 * Called to handle screen resizes. See BaseMenu.resize.
 */
AutoExpandMenu.prototype.resize = function(width, height) {
    if (width < AE_MIN_WIDTH || height < AE_MIN_HEIGHT) {
        this.contract();
    } else {
        this.extend();
    }
};

/**
 * Causes the menu to become expandable (as opposed to fixed-size) and
 * collapses it. Does nothing if the menu is already in the contracted
 * state (even if it's been expanded to show the details  once in that
 * state).
 */
AutoExpandMenu.prototype.contract = function () {
    if (this.expansion_state != "contracted") {
        // Reveal the summary element
        this.element.firstChild.style.display = this.summary_display;
        // Close the menu if it was open
        this.element.removeAttribute("open");
        // Set state to contracted
        this.expansion_state = "contracted";
        // Update CSS classes
        this.element.classList.add("contracted");
        this.element.classList.remove("extended");
    }
};

/**
 * Causes the menu to become fixed-size, and hides the summary element
 * that toggles collapse/expand behavior. Does nothing if the menu is
 * already in the "extended" state.
 */
AutoExpandMenu.prototype.extend = function () {
    if (this.expansion_state != "extended") {
        // Hide the summary element
        this.summary_display = window.getComputedStyle(
            this.element.firstChild
        ).display;
        this.element.firstChild.style.display = "none";
        // Open the menu
        this.element.setAttribute("open", "true");
        // Set state
        this.expansion_state = "extended";
        // Update CSS classes
        this.element.classList.remove("contracted");
        this.element.classList.add("extended");
    }
};


/**
 * A Dialog pops up and shows the given text, along with one or more
 * buttons that the user can click on. The entire dialog is also
 * clickable, and results in a default cancel action.
 * The 'buttons' argument should be a list of objects that have 'text'
 * and 'action' properties. Only one of the actions will be triggered.
 *
 * TODO: Does tap-to-cancel interfere with the buttons too much on
 * mobile?
 *
 * @param text A string containing the text to be displayed in the dialog
 *     box. May contain HTML code (so be careful about user-generated
 *     strings which appear in the text).
 * @param cancel (optional) A function to be called (without arguments)
 *     when the user cancels the dialog without selecting any of the
 *     buttons. If left undefined, nothing extra happens when the user
 *     cancels the menu.
 * @param buttons An array of button objects, each of which must have
 *     'text' and 'action' properties. The button text (may be HTML) will
 *     be put in the button, and when a button is clicked, its action
 *     function will be called (without arguments), and then the menu
 *     will be removed. The action may be the string "cancel" instead of
 *     a function which will end up calling the cancel function for the
 *     menu. The action may also be undefined, in which case the menu is
 *     simply closed when the button is pressed without any further
 *     action.
 * @param pos The position of this menu (see BaseMenu).
 * @param classes CSS classes for this menu (see BaseMenu).
 * @param style Extra style code for this menu (see BaseMenu).
 */
export function Dialog(text, cancel, buttons, pos, classes, style) {
    BaseMenu.call(this, pos, classes, style);
    this.element.classList.add("dialog");
    this.element.classList.add("passive");

    // Save args as attributes
    this.text = text;
    this.cancel_action = cancel || function () {};
    this.buttons = buttons;

    // Create HTML elements + event handlers

    // The paragraph of text
    let text_block = document.createElement("div");
    text_block.innerHTML = text;
    this.element.appendChild(text_block);

    // The buttons div
    let buttons_area = document.createElement("div");
    this.element.appendChild(buttons_area);

    // Save "this" for use in handler functions
    let the_menu = this;

    // Create handler for all taps on the menu
    let canceller = function (e) {
        the_menu.cancel_action();
        the_menu.remove();
        e.stopPropagation();
    };
    // Note: these must happen during bubbling, not capturing, or else
    // the buttons will never receive events.
    this.element.addEventListener("touchend", canceller);
    this.element.addEventListener("click", canceller);

    // The buttons themselves
    for (let button of this.buttons) {
        let b = document.createElement("a");
        b.classList.add("button");
        b.innerHTML = button.text;
        let handler;
        if (button.action == "cancel") {
            handler = canceller;
        } else if (button.action) {
            // jshint -W083
            handler = function (e) {
                button.action();
                the_menu.remove();
                e.stopPropagation();
            };
        } else {
            handler = function (e) {
                the_menu.remove();
                e.stopPropagation();
            };
            // jshint +W083
        }
        // Note: these must happen during capturing and must stop event
        // propagation, or the cancel handler will also trigger.
        b.addEventListener("touchend", handler, { "capture": true });
        b.addEventListener("click", handler, { "capture": true });
        buttons_area.appendChild(b);
    }
}
Dialog.prototype = Object.create(BaseMenu.prototype);
Dialog.prototype.constructor = Dialog;

/**
 * Cancels the dialog as if the cancel action had been taken by the user.
 * Triggers the cancel function if there is one.
 */
Dialog.prototype.cancel = function () {
    this.cancel_action();
    this.remove();
};


/**
 * A ToggleMenu is a persistent button that can be tapped to toggle
 * between on and off states, calling the on_action or off_action
 * function each time it transitions. The button starts in the "off"
 * state.
 *
 * @param contents A string containing the HTML code for the appearance
 *     of the button.
 * @param on_action A function to be called (with no parameters) when the
 *     toggle is flipped into the 'on' state.
 * @param off_action A function to be called (with no parameters) when the
 *     toggle is flipped into the 'off' state.
 * @param pos The position of this menu (see BaseMenu).
 * @param classes CSS classes for this menu (see BaseMenu).
 * @param style Extra style code for this menu (see BaseMenu).
 */
export function ToggleMenu(
    contents,
    on_action,
    off_action,
    pos,
    classes,
    style
) {
    BaseMenu.call(this, pos, classes, style);

    // attributes
    this.is_on = false;
    this.on_action = on_action;
    this.off_action = off_action;

    // element setup
    this.element.innerHTML = contents;
    this.element.classList.add("toggle");
    this.element.classList.add("off");

    // Capture menu object for use in event handler
    let the_menu = this;
    // Handler for clicks
    let handler = function () {
        the_menu.toggle();
    };

    this.element.addEventListener("touchend", handler);
    this.element.addEventListener("click", handler);
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
    this.element.classList.remove("off");
    this.element.classList.add("on");
    this.is_on = true;
};

/**
 * Use this to turn the toggle off without triggering the toggle action.
 * Use with caution.
 */
ToggleMenu.prototype.off_ = function () {
    this.element.classList.add("off");
    this.element.classList.remove("on");
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
 * An ItemList is an ExpandMenu that when expanded displays a vertical
 * list of items, allowing the user to scroll vertically and/or
 * horizontally to view them if they're too big/numerous for the box.
 * Each item should have a 'construct' property which can be called with
 * no arguments to produce a DOM element that represents that item.
 * Alternatively, a "constructor" function may be supplied which takes an
 * item as an argument and produces a DOM element to represent it (cf.
 * construct_html_list_item and create_link_list_constructor).
 *
 * @param items An array of items, each of which should have a .construct
 *     method that will be called with no arguments to create a DOM
 *     object that represents the item. The constructor will be called
 *     once each time the item is added to the list, but it will be
 *     ignored if a custom constructor is supplied to ItemList.
 * @param constructor (optional) An alternate function for creating DOM
 *     elements to represent list items. Will be given an item from the
 *     items array as its sole argument, and must return a DOM element
 *     that represents that item.
 * @param pos The position of this menu (see BaseMenu).
 * @param classes CSS classes for this menu (see BaseMenu).
 * @param style Extra style code for this menu (see BaseMenu).
 */
export function ItemList(icon, items, constructor, pos, classes, style) {
    ExpandMenu.call(this, icon, pos, classes, style);
    this.scrollbox = document.createElement("div");
    this.scrollbox.classList.add("scroll");
    this.scrollbox.classList.add("passive");
    this.element.appendChild(this.scrollbox);

    this.items = items;
    this.constructor = constructor;

    this.setup_items();
}

ItemList.prototype = Object.create(ExpandMenu.prototype);
ItemList.prototype.constructor = ItemList;

/**
 * Sets up the item elements for this list. Throws away any existing
 * items in the process.
 */
ItemList.prototype.setup_items = function() {
    this.scrollbox.innerHTML = "";

    if (this.constructor) {
        for (let it of this.items) {
            this.scrollbox.appendChild(this.constructor(it));
        }
    } else {
        for (let it of this.items) {
            this.scrollbox.appendChild(it.construct());
        }
    }
};

/**
 * Replaces the scroll box items with a new set of items. Note that it's
 * not safe to modify the items array directly.
 *
 * @param new_items The new items to use.
 */
ItemList.prototype.replace_items = function(new_items) {
    this.items = new_items;
    this.setup_items();
};

/**
 * Adds an item to the end of the list. For more complicated updates,
 * simply construct a new array and use replace_items.
 *
 * @param new_item The new item to add to the list.
 */
ItemList.prototype.add_item = function(new_item) {
    this.items.push(new_item);
    if (this.constructor) {
        this.scrollbox.appendChild(this.constructor(new_item));
    } else {
        this.scrollbox.appendChild(new_item.construct());
    }
};

/**
 * Removes the last item from the list.
 *
 * @return The item removed.
 */
ItemList.prototype.remove_last = function() {
    let result = this.items.pop();
    this.scrollbox.removeChild(this.scrollbox.lastChild);
    return result;
};

/**
 * Removes the first reference to any particular item from the list. If
 * that item is not in the list, a warning will be logged to the console.
 * The time required is linear in the number of items in the list.
 *
 * @param target The item to be removed. Must be === to (i.e., the exact
 *     same object as) the copy in the list, not simply structurally
 *     equivalent.
 */
ItemList.prototype.remove_item = function(target) {
    // Find the target
    let i;
    for (i = 0; i < this.items.length; ++i) {
        if (this.items[i] === target) {
            break;
        }
    }

    // Check for a miss
    if (i >= this.items.length) {
        console.warn(
            "Attempted to remove item not in list:",
            target,
            this.items
        );
        return;
    }

    // Remove the item from the array and the DOM
    this.items.splice(i, 1);
    this.scrollbox.removeChild(this.scrollbox.children[i]);
};

/**
 * A function that can be used as the constructor argument to ItemList
 * which simply treats each item as a string of HTML code and constructs
 * a div to hold it. Non-string items are converted to strings.
 *
 * @param item The item to construct a DOM element for.
 *
 * @return A DOM element for that item.
 */
export function construct_html_list_item(item) {
    let result = document.createElement("div");
    result.innerHTML = "" + item;
    return result;
}

/**
 * A function which builds and returns a function suitable for use as an
 * ItemList constructor. The returned function will create a div for each
 * item containing a link that uses the item as a string and substitutes
 * it for the substring <item> in the given url_template. If an icon is
 * supplied, the icon will be included in the link in addition to the
 * item itself (as a string).
 *
 * @param url_template A string that contains "<item>" somewhere within
 *     it. That part will be substituted with the item (as a string after
 *     calling encodeURIComponent) in a list to build a link. If this is
 *     instead given as a function, that function will be called on the
 *     raw item to generate a URL (and that function is responsible for
 *     calling encodeURIComponent if necessary).
 * @param icon (optional) A string of HTML code that will be added at the
 *     beginning of each link generated, before the item string itself.
 * @param item_stringer (optional) A function that will be used to
 *     convert an item to a string. By default, default string conversion
 *     is used. The string will be used both in template substitution if
 *     url_template is a string (but if url_template is a function, the
 *     raw item is given to it) and in creating the text of the link for
 *     each item.
 *
 * @return A function which uses the given url_template and icon to
 *     construct list items from strings, suitable for use as the
 *     constructor argument to ItemList.
 */
export function create_link_list_constructor(
    url_template,
    icon,
    item_stringer
) {
    let builder = function (item) {
        let result = document.createElement("div");
        let link = document.createElement("a");
        result.appendChild(link);

        let str;
        if (item_stringer) {
            str = item_stringer(item);
        } else {
            str = "" + item;
        }

        let url;
        if (typeof url_template == "function") {
            url = url_template(item);
        } else {
            url = url_template.replace("<item>", encodeURIComponent(str));
        }

        link.setAttribute("href", url);
        link.setAttribute("target", "definitions");
        link.innerHTML = icon + str;

        return result;
    };
    return builder;
}


/**
 * A QuestList is a scrollable list of quests, which displays summary
 * information about each one.
 *
 * @param agent A player object to retrieve quests from.
 * @param pos The position of this menu (see BaseMenu).
 * @param classes CSS classes for this menu (see BaseMenu).
 * @param style Extra style code for this menu (see BaseMenu).
 */
export function QuestList(agent, pos, classes, style) {
    this.player = agent;
    ItemList.call(
        this,
        'Quests', // TODO: make this translatable
        this.player.quests.active,
        quest => quest.element,
        pos,
        classes,
        style
    );
}

QuestList.prototype = Object.create(ItemList.prototype);
QuestList.prototype.constructor = QuestList;

/**
 * Swaps out the player whose quests are to be displayed.
 *
 * @param agent The new player to associate with this menu.
 */
QuestList.prototype.set_player = function (agent) {
    this.player = agent;
};

/**
 * Updates the quests displayed based on the current quests of the menu's
 * associated player.
 */
QuestList.prototype.update = function () {
    this.replace_items(this.player.quests.active);
};


/**
 * A WordList is a scrollable list of words which each link to a
 * definition.
 *
 * TODO: Make it sortable!
 * TODO: Include domain info somehow?
 * TODO: Include glyph strings too!
 *
 * @param agent A player object to associate with this menu. Words from
 *     that player's recent-words list will be displayed.
 * @param base_url A URL template that includes the text "<item>".
 * @param pos The position of this menu (see BaseMenu).
 * @param classes CSS classes for this menu (see BaseMenu).
 * @param style Extra style code for this menu (see BaseMenu).
 */
export function WordList(agent, url_template, pos, classes, style) {
    this.player = agent;
    ItemList.call(
        this,
        'Words',
        player.recent_words(this.player),
        create_link_list_constructor(
            function (entry) {
                let [dom, glyphs, word, when] = entry;
                let dobj = dict.lookup_domain(dom);
                let loc = locale.DEFAULT_LOCALE;
                if (dobj) { loc = dobj.locale; }
                let lower = locale.lc_lower(word, loc);
                return url_template.replace(
                    "<item>",
                    encodeURIComponent(lower)
                ).replace(
                    "<lang>",
                    loc.split('-')[0]
                );
            },
            "📖",
            function (entry) {
                let [dom, glyphs, word, when] = entry;
                let dobj;
                let loc = " (???)";
                if (dom != "_custom_" && dom != "_personal_") {
                    dobj = dict.lookup_domain(dom);
                    if (dobj) {
                        loc = " (" + dobj.locale + ")";
                    }
                } else {
                    loc = "";
                }
                if (glyphs == word) {
                    return `${glyphs}${loc}`;
                } else {
                    return `${glyphs} → ${word}${loc}`;
                }
            }
        ),
        pos,
        classes,
        style
    );
}

WordList.prototype = Object.create(ItemList.prototype);
WordList.prototype.constructor = WordList;

/**
 * Swaps out the player whose words list is to be displayed.
 *
 * @param agent The new player to associate with this menu.
 */
WordList.prototype.set_player = function (agent) {
    this.player = agent;
};

/**
 * Updates the words displayed based on the recently-found words of the
 * menu's associated player.
 */
WordList.prototype.update = function () {
    this.replace_items(player.recent_words(this.player));
};


/**
 * A ButtonMenu is both a menu and a clickable button. The action is
 * triggered whenever it is tapped/clicked. It also has a press method
 * for programmatically triggering the button.
 *
 * @param text The text that appears on the face of the button (may be
 *     HTML code).
 * @param action A function to be called (without arguments) when the
 *     button is clicked.
 * @param pos The position of this menu (see BaseMenu).
 * @param classes CSS classes for this menu (see BaseMenu).
 * @param style Extra style code for this menu (see BaseMenu).
 */
export function ButtonMenu(text, action, pos, classes, style) {
    BaseMenu.call(this, pos, classes, style);
    this.text = text;
    this.action = action;

    this.element.innerHTML = this.text;

    let the_menu = this;
    let handler = function(e) {
        // TODO: Check button types?
        the_menu.action();
        e.stopPropagation();
    };
    this.element.addEventListener("touchend", handler, {"capture": true});
    this.element.addEventListener("click", handler, {"capture": true});
}
ButtonMenu.prototype = Object.create(BaseMenu.prototype);
ButtonMenu.prototype.constructor = ButtonMenu;

/**
 * Triggers the same action that would have happened if the user had
 * pressed the button.
 */
ButtonMenu.prototype.press = function () {
    this.action();
};


/**
 * A ButtonMenu which displays glyphs-so-far, and which can flash colors.
 *
 * @param text The string of glyphs to display.
 * @param action The action to trigger when the button is activated.
 * @param pos The position of this menu (see BaseMenu).
 * @param classes CSS classes for this menu (see BaseMenu).
 * @param style Extra style code for this menu (see BaseMenu).
 */
export function GlyphsMenu(text, action, pos, classes, style) {
    ButtonMenu.call(this, text, action, pos, classes, style);
    this.glyphs = this.text.split("");
    this.fade = undefined;
    this.fade_color = undefined;
    this.flash_in_progress = null;
    this.orig_border_color = window.getComputedStyle(
        this.element
    ).borderTopColor;
    this.orig_border_width = parseFloat(
        window.getComputedStyle(this.element).borderWidth
    );
    this.update_state();
    // TODO: Make the element into an anchor? ARIA stuff!
}
GlyphsMenu.prototype = Object.create(ButtonMenu.prototype);
GlyphsMenu.prototype.constructor = GlyphsMenu;

/**
 * Updates the state of the glyphs menu based on its current contents.
 */
GlyphsMenu.prototype.update_state = function () {
    if (this.element.innerHTML == "") {
        this.element.classList.add("passive");
    } else {
        this.element.classList.remove("passive");
    }
};

/**
 * Adds a single glyph to the button text.
 *
 * @param glyph A one-character string containing an additional glyph to
 *     display.
 */
GlyphsMenu.prototype.add_glyph = function (glyph) {
    this.glyphs.push(glyph);
    this.element.innerHTML = this.glyphs.join("");
    this.update_state();
};

/**
 * Removes the last glyph from the button text.
 */
GlyphsMenu.prototype.remove_glyph = function () {
    this.glyphs.pop();
    this.element.innerHTML = this.glyphs.join("");
    this.update_state();
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
    this.element.innerHTML = this.glyphs.join("");
    this.update_state();
};

/**
 * Initiates a flash of color using the border of the menu. The actual
 * flash will happen over the course of many animation frames. If there
 * is another flash in progress, that flash will be cancelled.
 *
 * @param color The color to use (must be an RGB hex string).
 */
GlyphsMenu.prototype.flash = function (color) {
    this.orig_border_color = window.getComputedStyle(
        this.element
    ).borderTopColor;
    this.orig_border_width = parseFloat(
        window.getComputedStyle(this.element).borderWidth
    );
    this.fade_color = color;
    this.fade = 1.0;
    let the_menu = this;
    this.animate = function () { the_menu.animate_flash.call(the_menu); };

    // Cancel any in-progress flash
    if (this.flash_in_progress != null) {
        window.cancelAnimationFrame(this.flash_in_progress);
    }
    this.flash_in_progress = window.requestAnimationFrame(this.animate);
};

/**
 * Handles animation for a border color flash.
 */
GlyphsMenu.prototype.animate_flash = function() {
    if (this.fade == undefined) {
        this.element.style.borderColor = "";
        this.element.style.borderWidth = "";
        this.update_state();
        this.flash_in_progress = null;
        return; // flash is over, do not request another call
    }

    this.fade *= 0.92;
    if (this.fade < 0.05) { // end of animation
        this.fade = undefined;
        this.fade_color = undefined;
        // put back the original border color & width
        this.element.style.borderColor = this.orig_border_color;
        this.element.style.borderWidth = this.orig_border_width;
    } else {
        // interpolate back towards original color
        let interp = draw.interp_color(
            draw.color_from_hex_or_rgb(this.orig_border_color),
            this.fade,
            draw.color_from_hex_or_rgb(this.fade_color)
        );
        this.element.style.borderColor = draw.hex_from_color(interp);

        // interpolate width from 4x to 1x.
        this.element.style.borderWidth = (
            this.orig_border_width
          + (3 * this.orig_border_width * this.fade)
        ) + "pt";
    }
    // Continue animating
    this.flash_in_progress = window.requestAnimationFrame(this.animate);
};


/**
 * A SlotsMenu has an adjustable number of slots which can hold glyphs,
 * and each slot can be filled or emptied, and can be selected to toggle
 * it on or off. Slots may trigger an action when toggled on or off: The
 * selected callback is called with the menu and the index of the slot
 * that was clicked on when one is toggled on, and the deselected
 * callback is called with the same arguments when one is toggled off.
 * The initial number of slots will be determined by the length of the
 * contents iterable, along with their initial values. null, false,
 * undefined or other false-values may be used to represent
 * initially-empty slots.
 *
 * Currently the SlotsMenu is used to let players add custom letters from
 * outside the grid to the words that they're making (see ui.js).
 *
 * @param contents A string or an array of length-one glyph strings.
 *     Undefined entries in this array represent empty slots.
 * @param select The function to call when a slot is toggled on. It will
 *     be given the menu object and the index of the selected slot as
 *     arguments.
 * @param deselect The function to call when a slot is toggled off. It
 *     will be given the menu object and the index of the selected slot
 *     as arguments.
 * @param icon The icon to use when the menu is collapsed (see
 *     AutoExpandMenu)
 * @param pos The position of this menu (see BaseMenu).
 * @param classes CSS classes for this menu (see BaseMenu).
 * @param style Extra style code for this menu (see BaseMenu).
 *
 * TODO: This menu type has not yet been fully implemented.
 *
 * TODO:
 *
 * - Connect it with a rewards system.
 * - Ensure that it automatically expands/contracts as the screen size
 *   changes.
 * - Make sure that backspace works to deselect slots.
 * - Clear selection after a word is completed.
 */
export function SlotsMenu(
    contents,
    select,
    deselect,
    icon,
    pos,
    classes,
    style
) {
    AutoExpandMenu.call(this, icon, pos, classes, style);
    this.select = select;
    this.deselect = deselect;
    this.contents = []; // will be filled in later
    this.selected = [];

    // Create an HTML element to hold the slots
    this.slots = document.createElement("div");
    this.slots.classList.add("slots");
    this.element.appendChild(this.slots);

    // add slots
    for (let glyph of contents) {
        this.add_slot(glyph);
    }
}
SlotsMenu.prototype = Object.create(AutoExpandMenu.prototype);
SlotsMenu.prototype.constructor = SlotsMenu;

/**
 * Adds a slot to this menu. Omit the glyph argument to add an empty
 * slot.
 *
 * @param glyph The glyph to put in the new slot. Use undefined or omit
 *     this argument to add an empty slot.
 *
 */
SlotsMenu.prototype.add_slot = function(glyph) {
    let index = this.contents.length;
    this.contents.push(glyph);
    this.selected.push(false);

    // Create an HTML element for the slot
    let slot = document.createElement("a");
    slot.classList.add("slot");

    // Adds glyph into slot
    if (glyph != undefined) {
        slot.innerHTML = glyph;
    }

    let the_menu = this;
    function click_handler(e) {
        the_menu.toggle_slot(index);
        e.stopPropagation();
    }
    //adding click function
    slot.addEventListener("click", click_handler, {"capture": true});
    the_menu.slots.appendChild(slot);
};

/**
 * Removes the last slot from the SlotsMenu.
 */
SlotsMenu.prototype.remove_last_slot = function() {
    this.contents.pop();
    this.selected.pop();
    this.slots.removeChild(this.slots.lastChild);
};

/**
 * Toggles the slot from selected to deselected or vice versa, depending
 * on its current state. Calls the appropriate callback function with the
 * menu and the index as arguments.
 *
 * @param index The index of the slot to be toggled.
*/
SlotsMenu.prototype.toggle_slot = function (index) {
    if (this.selected[index]){
        this._deselect(index);
    } else {
        this._select(index);
    }
};

/**
 * Sets a slot to the selected state, and calls the selection callback
 * function if the slot was not already selected.
 *
 * @param index The index of the slot to select.
 * @param skip_callback (optional) If true, the callback will be skipped
 *     whether or not the slot changes state.
 */
SlotsMenu.prototype._select = function (index, skip_callback) {
    if (this.selected[index]) {
        return;
    }

    this.selected[index] = true;
    this.slots.children[index].classList.add("selected");
    if (!skip_callback) {
        this.select(this, index);
    }
};

/**
 * Sets a slot to the deselected state, and calls the deselection
 * callback function if the slot was not already selected.
 *
 * @param index The index of the slot to deselect.
 * @param skip_callback (optional) If true, the callback will be skipped
 *     whether or not the slot changes state.
 */
SlotsMenu.prototype._deselect = function (index, skip_callback) {
    if (!this.selected[index]) {
        return;
    }

    this.selected[index] = false;
    this.slots.children[index].classList.remove("selected");
    if (!skip_callback) {
        this.deselect(this, index);
    }
};

/**
 * Deselects all slots, without triggering the deselect callback.
 */
SlotsMenu.prototype.clear_selection = function () {
    let slot_elements = this.slots.children;
    for (let index = 0; index < this.contents.length; ++index) {
        this.selected[index] = false;
        slot_elements[index].classList.remove("selected");
    }
};

/**
 * Retrieves a glyph from the menu.
 *
 * @param index The index of the glyph to retrieve.
 * @return A glyph from the menu. Undefined if the chosen slot is empty.
 */
SlotsMenu.prototype.get_glyph = function (index) {
    return this.contents[index];
};
