// ui.js
// Word game UI code.
/* global console, window, document */

"use strict";

import * as draw from "./draw.js";
import * as content from "./content.js";
import * as grid from "./grid.js";
import * as dimensions from "./dimensions.js";
import * as dict from "./dict.js";
import * as generate from "./generate.js";
import * as menu from "./menu.js";
import * as animate from "./animate.js";
import * as utils from "./utils.js";
import * as quests from "./quests.js";
import * as player from "./player.js";

/**
 * Different game modes.
 *
 * Free mode removes most constraints and lets you find words wherever
 * you'd like.
 *
 * Normal mode imposes constraints based on your player progress.
 *
 * Quiz mode lifts some but not all constraints, and also triggers some
 * extra interaction when certain quests are completed.
 */
export var MODES = [
    "free",
    "normal",
    "quiz"
];

/**
 * The current game mode.
 * TODO: Toggle this!
 */
export var MODE = "normal";

/**
 * Is the user currently in the middle of dragging out a swipe path?
 */
var SWIPING = false;

/**
 * The time at which the most recent two mouse-down (or touch-start)
 * events occurred.
 */
var PRESS_RECORDS = [undefined, undefined];

/**
 * The time at which the most recent mouse-release (or touch-end)
 * occurred.
 */
var LAST_RELEASE = null;

/**
 * The number of milliseconds within which a second click or tap will
 * count as a double-click/tap.
 */
export var DBL_TIMEOUT = 500;

/**
 * The maximum distance (in canvas units) between two clicks/taps for
 * them to allowed to be counted as a single double click/tap.
 */
export var DBL_DIST = 10;

/**
 * During scrolling, the view position at which the scroll was started.
 */
var SCROLL_REFERENT = null;

/**
 * An array holding zero or more arrays which each hold 2-element tile
 * grid x/y coordinate pairs to indicate a path. These are the
 * currently-active path(s) that the user has selected.
 */
var CURRENT_SWIPES = [];

/**
 * An array holding 3-element [dimension, position, time] arrays that
 * include a dimension object, a 2-element tile grid x/y coordinate
 * position array, and a numerical time value in milliseconds. Each of
 * those arrays represent a single poke-in-progress which allows for
 * temporarily unlocking any single tile with an associated delay.
 */
export var ACTIVE_POKES = [];

/**
 * The delay (in seconds) from when a poke is initiated to when the tile
 * becomes unlocked.
 * TODO: adjust this
 * TODO: Add a cooldown as well?
 */
export var POKE_DELAY = 1;

/**
 * The currently-happening selection-clear animation.
 */
var SEL_CLEAR_ANIM = null;

/**
 * The currently-happening energy-clear animation.
 * TODO: remove this.
 */
var EN_CLEAR_ANIM = null;

/**
 * A 2-element array holding tile grid x/y coordinates specifying where
 * the player's most recent interaction happened on the grid.
 */
export var LAST_POSITION = [0, 0];

/**
 * The number of milliseconds per frame (ideally).
 * TODO: Measure this?
 */
export const MS_PER_FRAME = 1000/60;

/**
 * The millisecond timestamp at the time of the previous animation
 * frame.
 */
export var PREV_FRAME_TIME = undefined;

/**
 * Whether or not to trace unlocked swipes.
 */
export var TRACE_UNLOCKED = true;

/**
 * The current dimension object.
 */
export var CURRENT_DIMENSION;

/**
 * Mouse scroll correction factors:
 */
var PIXELS_PER_LINE = 18;
var LINES_PER_PAGE = 40;

// TODO: Remove this DEBUG
// This is used for animating a cursor for debugging purposes
// var LAST_MOUSE_POSITION = [0, 0];

/**
 * How long to wait in case another resize occurs before actually
 * handling a resize of the screen (in milliseconds).
 */
var RESIZE_TIMEOUT = 20;

/**
 * Keeps track of how many frames are left before we need to redraw
 * everything. When undefined, no redrawing will occur until some
 * interaction sets this to a number, and after drawing if the drawing
 * function doesn't specify a further waiting period, this will be set
 * back to undefined.
 */
var DO_REDRAW = null;

/**
 * The current global canvas drawing context.
 */
export var CTX;

/**
 * Which animation frame we're on. Note that this cycles back to 0 at
 * some point.
 */
export var ANIMATION_FRAME = 0;

/**
 * Word tracking...
 *
 * An object where the keys are words (in their canonical form, not their
 * glyphs-list form) and the values are arrays of 2-element [dimension,
 * position] arrays containing a dimension object where that word was
 * found, and a global tile grid 2-element x/y position array in that
 * dimension where the first glyph of that word was discovered (to save
 * memory we assume that when you find one copy of a word starting at a
 * particular location, you might as well have found any additional
 * copies that also start at that location, which is rare enough in any
 * case).
 */
export var WORDS_FOUND = {};

/**
 * An object with domain names as keys, where each value is an array of
 * word strings (in canonical form) from that domain which have been
 * discovered by the player. These lists are maintained in sorted order
 * alphabetically (or at least, according to the Javascript default
 * string < operator).
 */
export var FOUND_LISTS = {};

/**
 * An array of the player's currently active quests.
 */
export var QUESTS = [];

/**
 * All of the different menu objects that make up the core UI.
 */
export var QUEST_MENU = null;
export var QUEST_SIDEBAR = null;
export var WORDS_LIST_MENU = null;
export var WORDS_SIDEBAR = null;
export var ABOUT_TOGGLE = null;
export var ABOUT_DIALOG = null;
export var HOME_BUTTON = null;
export var ZOOM_IN_BUTTON = null;
export var ZOOM_OUT_BUTTON = null;
export var CLEAR_SELECTION_BUTTON = null;
export var RESET_ENERGY_BUTTON = null;
export var CURRENT_GLYPHS_BUTTON = null;
//New menu object SLOTS_MENU
export var SLOTS_MENU = null;

/**
 * How many frames to wait before requesting a redraw when an ititial
 * redraw attempt includes missing tile information. As long as tiles are
 * missing, a redraw will be requested at least every this many frames.
 */
var MISSING_TILE_RETRY = 10;

/**
 * How many frames to wait before requesting a redraw when there's
 * loading bars to update.
 */
var LOADING_RETRY = 10;

/**
 * A fixed array of supertiles for grid testing.
 */
var GRID_TEST_DATA;

/**
 * Returns (possibly after creating) the found list for the given domain
 * (should be given by name).
 *
 * TODO: What if we used arrays of entry indices instead?
 *
 * @param domain_name A string naming a domain.
 *
 * @return A sorted array of canonical word strings from the given domain
 *     which correspond to words that the player has found in that domain.
 */
export function found_list(domain_name) {
    if (!FOUND_LISTS.hasOwnProperty(domain_name)) {
        FOUND_LISTS[domain_name] = [];
    }
    return FOUND_LISTS[domain_name];
}

/**
 * Updates the game state when a word has been found.
 *
 * @param dimension The dimension object within which the match occurred.
 * @param match A 5-element array containing:
 *     0: The string name of the domain that the matched word belongs to.
 *     1: The index of the entry for that word in its domain.
 *     2: A string containing the glyph sequence that makes up that word.
 *     3: A string containing the canonical form of the word.
 *     4: An integer indicating the frequency of that word within its
 *        domain.
 *     (see dict.find_word_in_domain, which returns items 1-4)
 * @param path An array of 2-element tile grid x/y coordinate arrays that
 *     specifies a path of positions along which the word was found. Some
 *     of those positions may be undefined if extra-planar glyphs are
 *     involved in the match.
 */
export function find_word(dimension, match, path) {
    DO_REDRAW = 0;
    let word = match[3];
    // Insert into global found map:
    if (WORDS_FOUND.hasOwnProperty(word)) {
        WORDS_FOUND[word].push([dimension, path[0]]);
    } else {
        WORDS_FOUND[word] = [ [dimension, path[0]] ];
    }

    // Have the current player remember this word.
    player.remember_match(
        player.current_input_player(),
        dimension,
        path[0],
        match[0],
        match[1]
    );

    // TODO: Use player info instead!
    // Insert into per-domain alphabetized found list(s):
    let this_dom = match[0];
    let all_doms = [this_dom].concat(generate.ancestor_domains(this_dom));
    for (let dom of all_doms) {
        let fl = found_list(dom);
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
    }

    // Update active quests:
    for (var q of QUESTS) {
        q.find_word(dimension, match, path);
    }
}

/**
 * Adds the given quest to the list of active quests.
 *
 * @param q A Quest object (see quests.js).
 */
export function add_quest(q) {
    q.initialize(CURRENT_DIMENSION, WORDS_FOUND);
    QUESTS.push(q);
}

/**
 * Zooms in a bit.
 */
export function zoom_in() {
    CTX.viewport_scale *= 1.25;
    DO_REDRAW = 0;
}

/**
 * Zooms out a bit (exact inverse of zoom_in up to rounding error).
 */
export function zoom_out() {
    CTX.viewport_scale *= 1/1.25;
    DO_REDRAW = 0;
}

/**
 * Resets the viewport to center the tile grid origin.
 *
 * TODO: Allow the player to set their home?
 */
export function home_view() {
    let wpos = grid.world_pos([0, 0]);
    CTX.viewport_center[0] = wpos[0];
    CTX.viewport_center[1] = wpos[1];
    DO_REDRAW = 0;
}

/**
 * Swaps dimensions and moves the viewport to center the given
 * coordinates. Except in "free" mode, also unlocks a few tiles around
 * the given destination.
 *
 * @param coordinates The coordinates to move to.
 * @param dimension (optional) A dimension object to swap to.
 */
export function warp_to(coordinates, dimension) {
    if (dimension) {
        CURRENT_DIMENSION = dimension;
    }
    if (WORDS_LIST_MENU) {
        WORDS_LIST_MENU.replace_items(
            found_list(dimensions.natural_domain(CURRENT_DIMENSION))
        );
    }
    // TODO: Update base URL?
    let wpos = grid.world_pos(coordinates);
    CTX.viewport_center[0] = wpos[0];
    CTX.viewport_center[1] = wpos[1];
    if (MODE != "free") {
        let x = coordinates[0];
        let y = coordinates[1];
        let nearby = [
            [x, y],
            [x+1, y],
            [x+1, y+1],
            [x, y+1],
            [x-1, y],
            [x-1, y-1],
            [x, y-1],
        ];
        content.unlock_path(
            player.current_input_player(),
            CURRENT_DIMENSION,
            nearby
        );
    }
    DO_REDRAW = 0;
}

/**
 * Keyboard commands.
 * TODO: Document these!
 */
export var COMMANDS = {
    // DEBUG:
    "D": function (e) {
        MODE = MODES[(MODES.index(MODE) + 1) % MODES.length];
    },
    "d": function (e) {
        let nbd = dimensions.neighboring_dimension(CURRENT_DIMENSION,1);
        warp_to([0, 0], nbd);
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
    // z removes energized elements
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
            let last_swipe = CURRENT_SWIPES[CURRENT_SWIPES.length - 1];
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
            find_word(
                CURRENT_DIMENSION,
                [
                    dimensions.natural_domain(CURRENT_DIMENSION),
                    undefined,
                    [w],
                    w,
                    1
                ],
                []
            );
        }
    },
    "a": function () {
        add_glyph(
            glyph,vpos) }
};

/**
 * Keyboard commands for the grid test.
 */
var GRID_TEST_COMMANDS = {
};

/**
 * Clears the selection, animating lines from each selected tile to the
 * given destination. Just clears it instantly without animation if no
 * destination is given.
 *
 * @param destination (optional) A 2-element view-coordinate x/y array
 *     specifying where to animate lines to (from each glyph that becomes
 *     unselected). If omitted no lines will be drawn.
 * @param style (optional) A style object to be applied to the lines
 *     drawn when a destination is given. Ignored if there is no
 *     destination.
 */
export function clear_selection(destination, style) {
    if (destination == undefined) {
        CURRENT_SWIPES = [];
        CURRENT_GLYPHS_BUTTON.set_glyphs([]);
        if (SEL_CLEAR_ANIM != null) {
            animate.stop_animation(SEL_CLEAR_ANIM);
            SEL_CLEAR_ANIM = null;
        }
        DO_REDRAW = 0;
    } else {
        if (SEL_CLEAR_ANIM != null) {
            if (!animate.is_active(SEL_CLEAR_ANIM)) {
                SEL_CLEAR_ANIM = null;
            } else {
                return; // there's a clear animation already in-flight
            }
        }
        var combined_swipe = utils.combine_arrays(CURRENT_SWIPES);
        var lines = [];
        for (let gp of combined_swipe) {
            var wp = grid.world_pos(gp);
            var vp = draw.view_pos(CTX, wp);
            lines.push(
                new animate.MotionLine(
                    animate.INSTANT,
                    undefined,
                    vp,
                    destination,
                    style
                )
            );
        }
        SEL_CLEAR_ANIM = new animate.AnimGroup(
            lines,
            function () {
                CURRENT_SWIPES = [];
                CURRENT_GLYPHS_BUTTON.set_glyphs([]);
            }
        );
        animate.activate_animation(SEL_CLEAR_ANIM);
        DO_REDRAW = 0;
    }
}

/**
 * Clears energized positions, animating lines to the given destination
 * in the given style. If destination is undefined, just clears things
 * immediately.
 *
 * @param destination (optional) A 2-element view-coordinate x/y array
 *     specifying where to animate lines to (from each energized element
 *     that becomes de-energized). If omitted no lines will be drawn.
 * @param style (optional) A style object to be applied to the lines
 *     drawn when a destination is given. Ignored if there is no
 *     destination.
 */
export function clear_energy(destination, style) {
    if (destination == undefined) {
        content.reset_energy();
        if (EN_CLEAR_ANIM != null) {
            animate.stop_animation(EN_CLEAR_ANIM);
            EN_CLEAR_ANIM = null;
        }
        DO_REDRAW = 0;
    } else {
        if (EN_CLEAR_ANIM != null) {
            if (!animate.is_active(EN_CLEAR_ANIM)) {
                EN_CLEAR_ANIM = null;
            } else {
                return; // there's a clear animation already in-flight
            }
        }
        var lines = [];
        content.energized_positions().forEach(
            function (entry) {
                var gp = entry.position;
                var wp = grid.world_pos(gp);
                var vp = draw.view_pos(CTX, wp);
                lines.push(
                    new animate.MotionLine(
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
            lines,
            function () { content.reset_energy(); }
        );
        animate.activate_animation(EN_CLEAR_ANIM);
        DO_REDRAW = 0;
    }
    DO_REDRAW = 0;
}

/**
 * Tests whether the current selection is a valid word, and if it is,
 * triggers find_word. In any case it will provide UI feedback by
 * flashing the edge of the glyphs button with a certain color: red for a
 * non-word, yellow for a valid word that's not reachable, and white for
 * a valid word (the menu will also be emptied in that case as the match
 * is recorded).
 */
export function test_selection() {
    let combined_swipe = utils.combine_arrays(CURRENT_SWIPES);
    let domains = new Set();
    combined_swipe.forEach(function (gp) {
        let tile = content.tile_at(CURRENT_DIMENSION, gp);
        if (tile != null) {
            generate.domains_list(tile.domain).forEach(function (d) {
                domains.add(d);
            });
        }
    });
    let matches = dict.check_word(CURRENT_GLYPHS_BUTTON.glyphs, domains);
    if (matches.length > 0) {
        // Found a match:
        let connected = false;
        if (MODE == "free") {
            connected = true;
        } else {
            combined_swipe.forEach(function (gp) {
                if (content.is_unlocked(CURRENT_DIMENSION, gp)) {
                    connected = true;
                }
            });
        }
        if (connected) {
            // Match is connected:
            // clear our swipes and glyphs and add to our words found
            content.unlock_path(
                player.current_input_player(),
                CURRENT_DIMENSION,
                combined_swipe
            );
            for (let m of matches) {
                find_word(CURRENT_DIMENSION, m, combined_swipe);
            }
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

/**
 * Determines the primary canvas coordinates for a mouse click/move or
 * touch event.
 *
 * @param e A mouse or touch event object.
 * @return A 2-element array containing x/y canvas coordinates for the
 *     primary location of the given event. For multi-touch events, the
 *     location of the first touch is used.
 */
export function canvas_position_of_event(e) {
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

/**
 * Function for determining which kind of "click" an event is, including
 * touch events.
 *
 * @param e A touch or click event.
 *
 * @return A string; one of "primary", "secondary", "tertiary", or
 *     "auxiliary", based on the type of click. With a mouse, left-click
 *     (for a right-handed setup) is primary, right-click is secondary,
 *     middle-click is tertiary, and anything else is auxiliary.
 *     For a touch event, a single touch is primary and any kind of
 *     multi-touch is tertiary.
 */
export function which_click(e) {
    if (e.touches) {
        if (e.touches.length > 1) {
            return "tertiary";
        } else {
            return "primary";
        }
    } else {
        if (e.button == 0) {
            return "primary";
        } else if (e.button == 1) {
            return "tertiary";
        } else if (e.button == 2) {
            return "secondary";
        } else {
            return "auxiliary";
        }
    }
}

/**
 * Updates the canvas size. Called on resize after a timeout.
 */
export function update_canvas_size() {
    let canvas = document.getElementById("canvas");
    var bounds = canvas.getBoundingClientRect();
    var car = bounds.width / bounds.height;
    canvas.width = 800 * car;
    canvas.height = 800;
    CTX.cwidth = canvas.width;
    CTX.cheight = canvas.height;
    CTX.middle = [CTX.cwidth / 2, CTX.cheight / 2];
    CTX.bounds = bounds;
    DO_REDRAW = 0;
    menu.set_canvas_size([canvas.width, canvas.height]);
}

/**
 * Call this function to update the glyphs shown on the
 * CURRENT_GLYPHS_BUTTON based on the contents of the CURRENT_SWIPES.
 */


 let mastered_glyph = "";
export function update_current_glyphs() {
    var glyphs = [];
    for (let sw of CURRENT_SWIPES) {
        for (let gp of sw) {
            // TODO: Add code here for handling extra-planar glyphs!
            let g = content.tile_at(CURRENT_DIMENSION, gp).glyph;
            if (g == mastered_glyph) { // should never happen in theory:
                ////
            }

            if (g == undefined) { // should never happen in theory:
                console.warn(
                    "Internal Error: update_current_glyphs found"
                  + " undefined glyph at: " + gp
                );
                g = "?";
            }
            glyphs.push(g);
        }
    }
    CURRENT_GLYPHS_BUTTON.set_glyphs(glyphs);
}

/**
 * Event handler for the start of a primary-button click or single-point
 * touch.
 *
 * @param ctx The canvas context to use.
 * @param e The event being handled.
 */
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
    if (tile.domain == "__active__") {
        // an active element: just energize it
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



/**
 * Event handler for the start of a middle-button click or multi-point
 * touch.
 *
 * @param ctx The canvas context to use.
 * @param e The event being handled.
 */
function handle_tertiary_down(ctx, e) {
    var vpos = canvas_position_of_event(e);
    if (menu.mousedown(vpos, "tertiary")) { return; }
    SCROLL_REFERENT = vpos.slice();
}

/**
 * Event handler for the end of a primary-button click or single-point
 * touch.
 *
 * @param ctx The canvas context to use.
 * @param e The event being handled.
 */
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
    if (LAST_RELEASE != null) {
        let dx = vpos[0] - LAST_RELEASE[0];
        let dy = vpos[1] - LAST_RELEASE[1];
        let dt = window.performance.now() - PRESS_RECORDS[0];
        let rdist = Math.sqrt(dx*dx + dy*dy);
        isdbl = dt <= DBL_TIMEOUT && rdist <= DBL_DIST;
    }

    if (isdbl) {
        // This is a double-click or double-tap

        // TODO: The first click of the double-click always selects the
        // current letter, so the double-click is always treated as a
        // cancel, and never as a poke! Fix that!

        // Find grid position
        let wp = draw.world_pos(ctx, vpos);
        let gp = grid.grid_pos(wp);

        // Figure out if we're on part of a swipe:
        let cancel_from = undefined;
        let cancel_index = undefined;
        for (let i = 0; i < CURRENT_SWIPES.length; ++i) {
            let sw = CURRENT_SWIPES[i];
            for (let j = 0; j < sw.length; ++j) {
                let sgp = sw[j];
                if (utils.equivalent(gp, sgp)) {
                    cancel_from = i;
                    cancel_index = j;
                    break;
                }
            }
            if (cancel_from != undefined) {
                break;
            }
        }

        if (cancel_from != undefined) {
            // We double-tapped a swiped glyph to cancel it

            // Find adjacent grid positions from swipe
            let csw = CURRENT_SWIPES[cancel_from];
            let csl = csw.length;
            let prior = undefined;
            let next = undefined;
            if (cancel_index == 0) {
                if (cancel_from > 0) {
                    let psw = CURRENT_SWIPES[cancel_from-1];
                    prior = psw[psw.length-1];
                }
            } else {
                prior = csw[cancel_index-1];
            }
            if (cancel_index == csw.length - 1) {
                let nsw = CURRENT_SWIPES[cancel_from+1];
                if (nsw != undefined) {
                    next = nsw[0];
                }
            } else {
                next = csw[cancel_index+1];
            }

            // Check continuity
            if (prior != undefined && next != undefined) {
                if (grid.is_neighbor(prior, next)) {
                    // Cut out just the one glyph and stitch the rest together:
                    if (csw.length == 1) {
                        CURRENT_SWIPES.splice(cancel_from, 1);
                    } else {
                        csw.splice(cancel_index, 1);
                    }
                } else {
                    // Cut off everything after the target:
                    if (csw.length == 1) {
                        CURRENT_SWIPES = CURRENT_SWIPES.slice(0, cancel_from);
                    } else {
                        CURRENT_SWIPES = CURRENT_SWIPES.slice(
                            0,
                            cancel_from + 1
                        );
                        CURRENT_SWIPES[cancel_from] = csw.slice(
                            0,
                            cancel_index
                        );
                    }
                }
            } else {
                if (csw.length == 1) {
                    CURRENT_SWIPES.splice(cancel_from, 1);
                } else {
                    csw.splice(cancel_index, 1);
                }
            }
            update_current_glyphs();
        } else {
            // We double-tapped an open spot to poke it

            // Check adjacency
            let wp = draw.world_pos(ctx, vpos);
            let gp = grid.grid_pos(wp);
            let valid = false;
            if (MODE == "free") {
                valid = false;
            } else {
                // TODO: Use reach here
                for (let d = 0; d < 6; ++d) {
                    let np = grid.neighbor(gp, d);
                    if (content.is_unlocked(CURRENT_DIMENSION, np)) {
                        valid = true;
                        break;
                    }
                }
            }
            if (valid) {
                // Get rid of last two swipes & update glyphs
                CURRENT_SWIPES.pop();
                CURRENT_SWIPES.pop();
                update_current_glyphs();
                // Check for already-active poke here
                let entry = [ CURRENT_DIMENSION, gp, window.performance.now() ];
                let found = undefined;
                for (let i = 0; i < ACTIVE_POKES.length; ++i) {
                    if (
                        dimensions.same(ACTIVE_POKES[i][0], entry[0])
                        && utils.equivalent(ACTIVE_POKES[i][1], entry[1])
                    ) {
                        found = i;
                        break;
                    }
                }
                if (found != undefined) {
                    // Cancel the poke
                    ACTIVE_POKES.splice(found, 1);
                } else {
                    // Add entry to active pokes list:
                    ACTIVE_POKES.push(entry);
                    if (ACTIVE_POKES.length > content.POKE_LIMIT) {
                        ACTIVE_POKES.shift();
                    }
                }
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


/**
 * Event handler for the end of a middle-button click or multi-point
 * touch.
 *
 * @param ctx The canvas context to use.
 * @param e The event being handled.
 */
function handle_tertiary_up(ctx, e) {
    var vpos = canvas_position_of_event(e);
    if (menu.mouseup(vpos, "tertiary")) { return; }
    SCROLL_REFERENT = null;
}

/**
 * Event handler for movement of the mouse and/or movement of the primary
 * touch point during a touch-and-drag.
 *
 * @param ctx The canvas context to use.
 * @param e The event being handled.
 */
function handle_movement(ctx, e) {
    // dispatch to menu system first:
    var vpos = canvas_position_of_event(e);
    if (menu.mousemove(vpos)) { DO_REDRAW = 0; return; }
    if (SCROLL_REFERENT != null) {
        // scrolling w/ aux button or two fingers
        var dx = vpos[0] - SCROLL_REFERENT[0];
        var dy = vpos[1] - SCROLL_REFERENT[1];

        SCROLL_REFERENT = vpos.slice();

        CTX.viewport_center[0] -= dx;
        CTX.viewport_center[1] += dy;
        DO_REDRAW = 0;
    } else if (SWIPING && CURRENT_SWIPES.length > 0) {
        // swiping w/ primary button or one finger
        var combined_swipe = utils.combine_arrays(CURRENT_SWIPES);
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
                        LAST_POSITION = combined_swipe[
                            combined_swipe.length - 2
                        ];
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
                && tile.glyph != undefined
                && tile.domain != "__active__"
                && tile.domain != "__empty__"
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


/**
 * Event handler for scroll wheel motion.
 *
 * @param ctx The canvas context to use.
 * @param e The event being handled.
 */
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

/**
 * Sets up the canvas object and initializes the CTX and DO_REDRAW
 * variables.
 * @return: The canvas object that was configured.
 */
export function setup_canvas() {
    // set up canvas context
    let canvas = document.getElementById("canvas");
    CTX = canvas.getContext("2d");
    update_canvas_size();
    CTX.viewport_size = canvas.width;
    CTX.viewport_center = [0, 0];
    var screensize = Math.min(window.innerWidth, window.innerHeight);
    if (screensize < 500) {
        // Smaller devices
        CTX.viewport_scale = draw.LARGE_SCALE;
    } else {
        CTX.viewport_scale = draw.DEFAULT_SCALE;
    }
    DO_REDRAW = 0;
    return canvas;
}

/**
 * Sets up the UI components, including attaching the various event
 * handlers and initiating the first call to draw_frame.
 *
 * @param starting_dimension A dimension object that the game should
 *     start out in.
 *
 * TODO: use a player to define starting location instead?
 */
export function init(starting_dimension) {
    // Set up the canvas
    setup_canvas();

    // Unlock initial tiles
    // TODO: Better/different here?
    // TODO: Add starting place?
    warp_to([0, 0], starting_dimension);

    // Grant starting quest
    // TODO: Better/different here?
    add_quest(
        new quests.HuntQuest(
            ["F__D", "S_N", "S*R"],
            ["D__*__R"],
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
            window.clearTimeout(timer_id);
            timer_id = undefined;
        }
        timer_id = window.setTimeout(
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
        { "left": "50%", "right": 100, "top": 30, "bottom": 100 },
        { "width": undefined, "height": undefined },
        undefined,
        QUESTS
    );

    QUEST_SIDEBAR = new menu.ToggleMenu(
        CTX,
        { "right": 10, "top": 240 },
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
        { "left": "50%", "right": 100, "top": 30, "bottom": 100 },
        { "width": undefined, "height": undefined },
        undefined,
        found_list(dimensions.natural_domain(CURRENT_DIMENSION)),
        "https://en.wiktionary.org/wiki/<item>"
    );
    // TODO: Swap words list when dimension changes
    // TODO: Some way to see lists from non-current dimensions?

    WORDS_SIDEBAR = new menu.ToggleMenu(
        CTX,
        { "right": 10, "top": 330 },
        { "width": 40, "height": 40 },
        undefined,
        //"找到",
        "🗎",
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
        (
            "This is Words 成语, version 0.1. Select 成语 and press"
          + " SPACE. Find as many as you can! You can scroll to see more."
          + " Use the ⊗ at the bottom-left or ESCAPE to clear the"
          + " selection, or double-tap to remove a glyph. Review 成语"
          + " with the 找到 button on the right-hand side. The 🏠 button"
          + " takes you back to the start."
        ),
        [ { "text": "OK", "action": function () { ABOUT_TOGGLE.off_(); } } ]
    );

    //adding slots menu
    SLOTS_MENU = new menu.SlotsMenu(
        "left",
        undefined,
        "top: 15vh; left: 3.5vw; text-align: center",
        ["A", undefined, "C", "E", "T"],
        undefined,
    )

    ABOUT_TOGGLE = new menu.ToggleMenu(
        CTX,
        { "right": 10, "bottom": 10 },
        { "width": 40, "height": 40 },
        {},
        "?",
        function () { menu.add_menu(ABOUT_DIALOG); },
        function () { menu.remove_menu(ABOUT_DIALOG); }
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

    ZOOM_IN_BUTTON = new menu.ButtonMenu(
        CTX,
        { "right": 10, "top": 10 },
        { "width": 40, "height": 40 },
        {},
        "+",
        zoom_in
    );
    menu.add_menu(ZOOM_IN_BUTTON);

    ZOOM_OUT_BUTTON = new menu.ButtonMenu(
        CTX,
        { "right": 10, "top": 100 },
        { "width": 40, "height": 40 },
        {},
        "–",
        zoom_out
    );
    menu.add_menu(ZOOM_OUT_BUTTON);

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

    /*
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
    // TODO: remove this
    // menu.add_menu(RESET_ENERGY_BUTTON);
    */

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
    let downHandler = function (e) {
        if (e.preventDefault) { e.preventDefault(); }
        var which = which_click(e);
        if (which == "primary") {
            handle_primary_down(CTX, e);
            PRESS_RECORDS[0] = PRESS_RECORDS[1];
            PRESS_RECORDS[1] = window.performance.now();
        } else if (which == "tertiary") {
            handle_tertiary_down(CTX, e);
        } // otherwise ignore this click
    };

    document.addEventListener("mousedown", downHandler);
    document.addEventListener("touchstart", downHandler);

    let upHandler = function(e) {
        // TODO: Menus
        if (e.preventDefault) { e.preventDefault(); }
        var which = which_click(e);
        if (which == "primary") {
            handle_primary_up(CTX, e);
            LAST_RELEASE = canvas_position_of_event(e);
        } else if (which == "tertiary") {
            handle_tertiary_up(CTX, e);
        } // otherwise ignore this click
        // Reset scroll referent anyways just to be sure:
        SCROLL_REFERENT = null;
    };

    document.addEventListener("mouseup", upHandler);
    document.addEventListener("touchand", upHandler);
    document.addEventListener("touchcancel", upHandler);

    let moveHandler = function (e) {
        // TODO: Remove this debug
        // LAST_MOUSE_POSITION = canvas_position_of_event(e);
        if (e.preventDefault) { e.preventDefault(); }
        handle_movement(CTX, e);
    };
    document.addEventListener("touchmove", moveHandler);
    document.addEventListener("mousemove", moveHandler);

    // TODO: Make this passive? (see chromium verbose warning)
    document.addEventListener("wheel", function (e) {
        if (e.preventDefault) { e.preventDefault(); }
        handle_wheel(CTX, e);
    });

    document.addEventListener("keydown", function (e) {
        if (COMMANDS.hasOwnProperty(e.key)) {
            COMMANDS[e.key](e);
        }
    });
}

/**
 * Sets things up for the grid test.
 *
 * @param starting_dimension A dimension object that the game should
 *     start out in.
 * @param supertiles An array of supertiles objects to render as part of
 *     the test.
 */
export function init_test(starting_dimension, supertiles) {
    // Set up the canvas
    setup_canvas();

    // put ourselves in the test dimension
    warp_to([0, 0], starting_dimension);

    // kick off animation
    window.requestAnimationFrame(make_test_animator(supertiles));

    // Listen for window resizes but wait until RESIZE_TIMEOUT after the last
    // consecutive one to do anything.
    var timer_id = undefined;
    window.addEventListener("resize", function() {
        if (timer_id != undefined) {
            window.clearTimeout(timer_id);
            timer_id = undefined;
        }
        timer_id = window.setTimeout(
            function () {
                timer_id = undefined;
                update_canvas_size();
            },
            RESIZE_TIMEOUT
        );
    });

    document.addEventListener("keydown",function (e) {
        if (GRID_TEST_COMMANDS.hasOwnProperty(e.key)) {
            GRID_TEST_COMMANDS[e.key](e);
        }
    });
}


/**
 * Tests whether the given position is selected by a current swipe.
 *
 * @param gpos A 2-element tile grid x/y coordinate array.
 *
 * @return True if the given position is selected by an existing swipe,
 *     and false otherwise.
 */
export function is_selected(gpos) {
    var combined_swipe = utils.combine_arrays(CURRENT_SWIPES);
    var result = false;
    combined_swipe.forEach(function (prpos) {
        if ("" + prpos == "" + gpos) {
            result = true;
        }
    });
    return result;
}

/**
 * Core drawing function for drawing all game elements every frame. This
 * function actually uses the DO_REDRAW variable to when possible skip
 * drawing entirely and wait for a future frame to actually draw
 * anything, so that when no animations are playing and nothing is being
 * interacted with, the canvas doesn't get updated.
 *
 * This function uses window.requestAnimationFrame to reschedule itself,
 * so calling it once is enough to ensure it will happen on every frame
 * from that point on.
 *
 * @param now A window.performance.now() result which is a number of
 *     milliseconds since the time origin which will be roughly when the
 *     user started navigating to the game page.
 */
export function draw_frame(now) {
    // Count frames
    ANIMATION_FRAME += 1;
    ANIMATION_FRAME %= animate.ANIMATION_FRAME_MAX;
    // TODO: Normalize frame count to passage of time!

    // Compute elapsed time
    let elapsed;
    if (PREV_FRAME_TIME == undefined ) {
        elapsed = 0; // on first frame we count 0 elapsed
    } else {
        elapsed = now - PREV_FRAME_TIME; // otherwise compute it
    }
    elapsed = Math.max(0, elapsed); // ensure its not negative
    PREV_FRAME_TIME = now; // update previous value

    // Tick players and check whether they want a redraw...
    if (player.tick_players(elapsed)) {
        DO_REDRAW = 0;
    }

    // Check whether we need to redraw or not
    if (DO_REDRAW == null) {
        window.requestAnimationFrame(draw_frame);
        return;
    } else if (DO_REDRAW > 0) {
        DO_REDRAW -= 1;
        window.requestAnimationFrame(draw_frame);
        return;
    }
    DO_REDRAW = null;

    // draw the world
    CTX.clearRect(0, 0, CTX.cwidth, CTX.cheight);

    // Tiles
    let visible_tiles = draw.visible_tile_list(CURRENT_DIMENSION, CTX);
    if (!draw.draw_tiles(CURRENT_DIMENSION, CTX, visible_tiles)) {
        if (DO_REDRAW != null) {
            DO_REDRAW = Math.min(DO_REDRAW, MISSING_TILE_RETRY);
        } else {
            DO_REDRAW = MISSING_TILE_RETRY;
        }
    }

    // Highlight unlocked:
    if (TRACE_UNLOCKED) {
        draw.trace_unlocked(CURRENT_DIMENSION, CTX);
    }

    // Add energy highlights:
    draw.draw_energies(CURRENT_DIMENSION, CTX, visible_tiles);

    // Swipes
    let combined = utils.combine_arrays(CURRENT_SWIPES);
    draw.draw_swipe(CTX, combined, "highlight");

    // Pokes
    var poke_redraw_after = undefined;
    var finished_pokes = [];
    for (let index = 0; index < ACTIVE_POKES.length; ++index) {
        let poke = ACTIVE_POKES[index];
        if (dimensions.same(CURRENT_DIMENSION, poke[0])) {
            let initiated_at = poke[2];
            let age = now - initiated_at;
            let ticks = Math.floor(age/1000);
            let until_tick = 1000 - age % 1000;

            draw.draw_poke(CTX, poke, ticks, POKE_DELAY);

            let frames_left = Math.ceil(until_tick / MS_PER_FRAME);
            if (
                poke_redraw_after == undefined
             || poke_redraw_after > frames_left
            ) {
                poke_redraw_after = frames_left;
            }
            if (ticks >= POKE_DELAY) {
                finished_pokes.push(index);
            }
        }
    }
    if (finished_pokes.length > 0) {
        // remove & process finished pokes
        DO_REDRAW = 0;
        let adj = 0;
        for (let i = 0; i < finished_pokes.length; ++i) {
            let poke = ACTIVE_POKES[i - adj];
            content.unlock_poke(poke[0], poke[1]);
            player.remember_poke(
                player.current_input_player(),
                poke[0],
                poke[1]
            );
            ACTIVE_POKES.splice(i - adj, 1);
            adj += 1;
        }
    } else if (poke_redraw_after != undefined) {
        // set up redraw for remaining active pokes
        DO_REDRAW = Math.max(poke_redraw_after, 0);
    }

    // Loading bars for domains:
    var loading = dict.LOADING;
    var lks = Object.keys(loading);
    if (lks.length > 0) {
        lks.sort();
        if (draw.draw_loading(CTX, lks, loading)) {
            if (DO_REDRAW != null) {
                DO_REDRAW = Math.min(DO_REDRAW, LOADING_RETRY);
            } else {
                DO_REDRAW = LOADING_RETRY;
            }
        }
    }

    // Menus:
    if (menu.draw_active(CTX)) {
        DO_REDRAW = 0;
    }

    // Animations:
    var next_horizon = animate.draw_active(CTX, ANIMATION_FRAME);
    if (
        next_horizon != undefined
        && (
            DO_REDRAW == null
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

/**
* Creates a test animation function which will draw the given
* supertiles.
*
* @param supertiles An array of supertile objects to be drawn. Their pos
*     attributes determine where, and scrolling is not enabled, so they
*     should be positioned somewhere near [0, 0].
*/
export function make_test_animator(supertiles) {
    /**
    * The per-frame animation function for the grid test, which just draws
    * the test grid data. Uses the same DO_REDRAW mechanism as draw_frame.
    *
    * @param now The number of milliseconds since the time origin.
    */
    let animate_grid_test = function(now) {
        if (DO_REDRAW == null) {
            window.requestAnimationFrame(animate_grid_test);
            return;
        } else if (DO_REDRAW > 0) {
            DO_REDRAW -= 1;
            window.requestAnimationFrame(animate_grid_test);
            return;
        }
        DO_REDRAW = null;

        // draw the test supertile
        CTX.clearRect(0, 0, CTX.cwidth, CTX.cheight);
        for (let supertile of supertiles) {
            draw.draw_supertile(CTX, supertile);
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
    };
    return animate_grid_test;
}





/**
*/
export function add_glyph(mastered_glyph, e, ctx){

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
    if (LAST_RELEASE != null) {
        let dx = vpos[0] - LAST_RELEASE[0];
        let dy = vpos[1] - LAST_RELEASE[1];
        let dt = window.performance.now() - PRESS_RECORDS[0];
        let rdist = Math.sqrt(dx*dx + dy*dy);
        isdbl = dt <= DBL_TIMEOUT && rdist <= DBL_DIST;
    }

    if (isdbl) {
        // This is a double-click or double-tap

        // Find grid position
        let wp = draw.world_pos(ctx, vpos);
        let gp = grid.grid_pos(wp);

        // Figure out if we're on part of a swipe:
        let cancel_from = undefined;
        let cancel_index = undefined;
        for (let i = 0; i < CURRENT_SWIPES.length; ++i) {
            let sw = CURRENT_SWIPES[i];
            for (let j = 0; j < sw.length; ++j) {
                let sgp = sw[j];
                if (utils.equivalent(gp, sgp)) {
                    cancel_from = i;
                    cancel_index = j;
                    break;
                }
            }
            if (cancel_from != undefined) {
                break;
            }
        }

        if (cancel_from != undefined) {
            // We double-tapped a swiped glyph to cancel it

            // Find adjacent grid positions from swipe
            let csw = CURRENT_SWIPES[cancel_from];
            let csl = csw.length;
            let prior = undefined;
            let next = undefined;
            if (cancel_index == 0) {
                if (cancel_from > 0) {
                    let psw = CURRENT_SWIPES[cancel_from-1];
                    prior = psw[psw.length-1];
                }
            } else {
                prior = csw[cancel_index-1];
            }
            if (cancel_index == csw.length - 1) {
                let nsw = CURRENT_SWIPES[cancel_from+1];
                if (nsw != undefined) {
                    next = nsw[0];
                }
            } else {
                next = csw[cancel_index+1];
            }

            // Check continuity
            if (prior != undefined && next != undefined) {
                if (grid.is_neighbor(prior, next)) {
                    // Cut out just the one glyph and stitch the rest together:
                    if (csw.length == 1) {
                        CURRENT_SWIPES.splice(cancel_from, 1);
                    } else {
                        csw.splice(cancel_index, 1);
                    }
                } else {
                    // Cut off everything after the target:
                    if (csw.length == 1) {
                        CURRENT_SWIPES = CURRENT_SWIPES.slice(0, cancel_from);
                    } else {
                        CURRENT_SWIPES = CURRENT_SWIPES.slice(
                            0,
                            cancel_from + 1
                        );
                        CURRENT_SWIPES[cancel_from] = csw.slice(
                            0,
                            cancel_index
                        );
                    }
                }
            } else {
                if (csw.length == 1) {
                    CURRENT_SWIPES.splice(cancel_from, 1);
                } else {
                    csw.splice(cancel_index, 1);
                }
            }
            update_current_glyphs();
        } else {
            // We double-tapped an open spot to poke it

            // Check adjacency
            let wp = draw.world_pos(ctx, vpos);
            let gp = grid.grid_pos(wp);
            let valid = false;
            if (MODE == "free") {
                valid = false;
            } else {
                for (let d = 0; d < 6; ++d) {
                    let np = grid.neighbor(gp, d);
                    if (content.is_unlocked(CURRENT_DIMENSION, np)) {
                        valid = true;
                        break;
                    }
                }
            }
            if (valid) {
                // Get rid of last two swipes & update glyphs
                CURRENT_SWIPES.pop();
                CURRENT_SWIPES.pop();
                update_current_glyphs();
                // Check for already-active poke here
                let entry = [ CURRENT_DIMENSION, gp, window.performance.now() ];
                let found = undefined;
                for (let i = 0; i < ACTIVE_POKES.length; ++i) {
                    if (
                        dimensions.same(ACTIVE_POKES[i][0], entry[0])
                        && utils.equivalent(ACTIVE_POKES[i][1], entry[1])
                    ) {
                        found = i;
                        break;
                    }
                }
                if (found != undefined) {
                    // Cancel the poke
                    ACTIVE_POKES.splice(found, 1);
                } else {
                    // Add entry to active pokes list:
                    ACTIVE_POKES.push(entry);
                    if (ACTIVE_POKES.length > content.POKE_LIMIT) {
                        ACTIVE_POKES.shift();
                    }
                }
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
