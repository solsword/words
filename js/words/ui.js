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
import * as avatar from "./avatar.js";
import * as env from "./env.js";
import * as anarchy from "../anarchy.mjs";

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
    "example",
    "normal",
    "quiz"
];

/**
 * The current game mode.
 * TODO: Toggle this!
 */
export var MODE = "normal";
// export var MODE = "quiz";

/**
 * Sets the mode value.
 *
 * @param mode The new mode. Must be one of the MODES.
 */
export function set_mode(mode) {
    if (!MODES.includes(mode)) {
        throw ("Invalid mode '" + mode + "'!");
    }
    MODE = mode;
}

/**
 * Words used in the example finite domain.
 */
export const EXAMPLE_WORDS = [
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
];

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
 * The position at which the most recent mouse-release (or touch-end)
 * occurred (a 2-element x/y canvas coordinate array).
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
 * An array holding 2-element tile grid x/y coordinate pairs to indicate
 * the path of the current selection. Entries could also be two element
 * arrays containing a string and an index which corresponds to the
 * glyphs that don't come from the grid.
 */
var SELECTION_PATH = [];

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
 * The number of milliseconds per frame (ideally).
 * TODO: Measure this?
 */
export const MS_PER_FRAME = 1000 / 60;

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
 * Mouse scroll correction factors:
 */
var PIXELS_PER_LINE = 18;
var LINES_PER_PAGE = 40;

/**
 * How long to wait in case another resize occurs before actually
 * handling a resize of the screen (in milliseconds).
 * Note: If this is too short, can cause screen updates to flash in
 * Firefox.
 */
var RESIZE_TIMEOUT = 50;

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
 * The node that ultimately holds all menu elements.
 */
export var MENUS_NODE = null;

/**
 * All of the different menu objects that make up the core UI.
 */
export var QUEST_MENU = null;
export var WORDS_LIST_MENU = null;
export var WORDS_SIDEBAR = null;
export var ABOUT_BUTTON = null;
export var HOME_BUTTON = null;
export var ZOOM_IN_BUTTON = null;
export var ZOOM_OUT_BUTTON = null;
export var CLEAR_SELECTION_BUTTON = null;
export var RESET_ENERGY_BUTTON = null;
export var CURRENT_GLYPHS_BUTTON = null;
export var SLOTS_MENU = null;
export var BACK_BUTTON = null;
export var HINT_BUTTON = null;
export var START_MENU = null;

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
 * Last recorded grid position of the avatar
 */
var LAST_AVATAR_POSITION = [0, 0];

/**
 * Tests whether a certain DOM node has another node as an ancestor or
 * not.
 *
 * @param descendant The node whose status we're interested in.
 * @param query The node we think might be an ancestor of the descendant.
 *
 * @return True if the query node is an ancestor of the descendant node,
 *     or if the two nodes are the same node. False otherwise.
 */
export function has_ancestor(descendant, query) {
    if (!descendant.parentNode) {
        return false;
    } else if (descendant.parentNode === query) {
        return true;
    } else {
        return has_ancestor(descendant.parentNode, query);
    }
}

/**
 * Retrieves the current input player's current dimension.
 *
 * @return A dimension key string indicating what dimension the current
 *     input player is in. Will return undefined before the player has
 *     been placed somewhere, or when there is no current input player.
 */
export function get_current_dimkey() {
    let pl = player.current_input_player();
    if (!pl) { return undefined; }
    return pl.position.dimension;
}

/**
 * Updates the game state when a word has been found.
 *
 * @param dimkey The dimension key string within which the match
 *     occurred.
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
export function find_word(dimkey, match, path) {
    DO_REDRAW = 0;
    let [domname, widx, glyphs, word, freq] = match;

    // Have the current player remember this word.
    let who = player.current_input_player();
    player.remember_match(
        who,
        dimkey,
        path,
        domname,
        widx,
        glyphs
    );
    // play the avatar's jump animation when the player completes a word
    if(who.avatar.animation_srcs["jump"]) {
        avatar.play_animation(who, "jump");
    }

    // Update the quests list.
    if (QUEST_MENU) {
        QUEST_MENU.update();
    }

    // Update the words found list.
    if (WORDS_LIST_MENU) {
        WORDS_LIST_MENU.update();
    }
}

/**
 * Zooms in a bit.
 */
export function zoom_in() {
    CTX.viewport_scale *= 1.25;
    DO_REDRAW = 0;
    rescale_avatar();
    replace_avatar();
}

/**
 * Zooms out a bit (exact inverse of zoom_in up to rounding error).
 */
export function zoom_out() {
    CTX.viewport_scale *= 1 / 1.25;
    DO_REDRAW = 0;
    rescale_avatar();
    replace_avatar();
}

/**
 * Resets the viewport to center the tile grid origin.
 *
 * TODO: Allow the player to set their home?
 */
export function home_view() {
    let wpos = grid.world_pos([0, 0]);
    place_viewport(wpos);
    DO_REDRAW = 0;
}

/**
 * Swaps dimensions and moves the viewport to center the given
 * coordinates. Except in "free" mode, also unlocks a few tiles around
 * the given destination.
 *
 * @param coordinates The coordinates to move to.
 * @param dimkey (optional) The string key for the dimension to swap to.
 * @param try_unlock (optional) Whether or not to unlock tiles at the
 *     destination. Both explicit true and false control behavior, where
 *     omitting the parameter or passing undefined will give the default
 *     behavior according to the current MODE.
 */
export function warp_to(coordinates, dimkey, unlock_tiles) {
    if (unlock_tiles == undefined) {
        unlock_tiles = MODE != "free" && MODE != "quiz";
    }
    player.teleport(
        player.current_input_player(),
        coordinates,
        dimkey,
        unlock_tiles
    );
    let wpos = grid.world_pos(coordinates);
    place_viewport(wpos);
    DO_REDRAW = 0;
    place_avatar(coordinates);
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
        let cdk = get_current_dimkey();
        let fd = dimensions.key__dim(cdk);
        let nbd = dimensions.neighboring_dimension(fd, 1);
        warp_to([0, 0], dimensions.dim__key(nbd));
    },
    // DEBUG
    "s": function (e) { generate.toggle_socket_colors(); },
    " ": test_selection, // spacebar checks current word
    // escape removes all current selections
    "Escape": function () {
        clear_selection(
            // TODO: Better here?
            [0, CTX.cheight],
            {
                "color":
                    window.getComputedStyle(
                        CLEAR_SELECTION_BUTTON.element
                    ).color
            }
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
        let lp = player.current_input_player().position.pos;
        if (lp) {
            var wpos = grid.world_pos(lp);
            place_viewport(wpos);
            DO_REDRAW = 0;
        }
    },
    // shows 'about' dialog
    "?": function (e) {
        ABOUT_BUTTON.press();
        DO_REDRAW = 0;
    },
    // resets the player's activity & stats
    "R": function (e) {
        player.reset_player(player.current_input_player());
        if (QUEST_MENU) {
            QUEST_MENU.update();
        }
        if (WORDS_LIST_MENU) {
            WORDS_LIST_MENU.update();
        }
        DO_REDRAW = 0;
    },
    // home and 0 reset the view to center 0, 0
    "0": home_view,
    "Home": home_view,
    // Pops a letter from the current swipe set
    //TODO handle external entries
    "Backspace": function (e) {
        if (e.preventDefault) { e.preventDefault(); }
        if (SELECTION_PATH.length > 0) {
            CURRENT_GLYPHS_BUTTON.remove_glyph();
            let removed = SELECTION_PATH.pop();
            if (removed[0] == "slots") {
                // deselect that letter from the slots menu
                SLOTS_MENU._deselect(removed[1], true);
            }
            if (SELECTION_PATH.length > 0) {
                place_avatar(SELECTION_PATH[SELECTION_PATH.length - 1]);
            }
        }
        DO_REDRAW = 0;
    },
    // TODO: DEBUG
    "q": function (e) { // "find' a bunch of words for testing purposes
        for (let w of "abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()") {
            let cdk = get_current_dimkey();
            let cd = dimensions.key__dim(cdk);
            find_word(
                cdk,
                [
                    dimensions.natural_domain(cd),
                    undefined,
                    [w],
                    w,
                    1
                ],
                []
            );
        }
    },
    "H": function(){

        let paths = find_paths("PEA");
        let first_letters = paths.map(path => path[0].pos);
        animate_lines(first_letters,
            [ CTX.cwidth/2, 0 ],
            { "color": "#0f6" }, animate.SECOND);

    }
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
        SELECTION_PATH = [];
        CURRENT_GLYPHS_BUTTON.set_glyphs([]);
        SLOTS_MENU.clear_selection();
        if (SEL_CLEAR_ANIM != null) {
            animate.stop_animation(SEL_CLEAR_ANIM);
            SEL_CLEAR_ANIM = null;
        }
    } else {
        if (SEL_CLEAR_ANIM != null) {
            if (!animate.is_active(SEL_CLEAR_ANIM)) {
                SEL_CLEAR_ANIM = null;
            } else {
                return; // there's a clear animation already in-flight
            }
        }
        let lines = [];
        for (let gp of SELECTION_PATH) {
            if (typeof gp[0] != "string") {
                var wp = grid.world_pos(gp);
                var vp = draw.view_pos(CTX, wp);
                lines.push(
                    new animate.MotionLine(
                        animate.MOMENT,
                        undefined,
                        vp,
                        destination,
                        style
                    )
                );
            }
        }
        SEL_CLEAR_ANIM = new animate.AnimGroup(
            lines,
            function () {
                SELECTION_PATH = [];
                CURRENT_GLYPHS_BUTTON.set_glyphs([]);
                SLOTS_MENU.clear_selection();
            }
        );
        animate.activate_animation(SEL_CLEAR_ANIM);
    }
    DO_REDRAW = 0;
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
 * triggers find_word, perhaps multiple times (once for each match). In
 * any case it will provide UI feedback by flashing the edge of the
 * glyphs button with a certain color: red for a non-word, yellow for a
 * valid word that's not reachable, and white for a valid word (the menu
 * will also be emptied in that case as the match is recorded).
 */
export function test_selection() {
    let domains = new Set();
    let cdk = get_current_dimkey();
    let cd = dimensions.key__dim(cdk);

    // determine all domains involved
    for (let gp of SELECTION_PATH) {
        if (typeof gp[0] == "string") {
            continue; // skip non-grid entries
        }
        let tile = content.tile_at(cd, gp);
        if (tile != null) {
            for (let domain of generate.domains_list(tile.domain)) {
                domains.add(domain);
            }
        }
    }
    // backup in case there are no domains from tiles
    if (domains.size == 0) {
        let natural_domain = (dimensions.natural_domain(cd));
        for (let component of generate.domains_list(natural_domain)) {
            domains.add(component);
        }
    }

    let matches = dict.check_word(CURRENT_GLYPHS_BUTTON.glyphs, domains);

    // If we didn't find any matches, consider custom words from the
    // current domain
    if (matches.length == 0 && dimensions.kind(cd) == "custom") {
        matches = dimensions.pocket_matches(
            cd,
            CURRENT_GLYPHS_BUTTON.glyphs.join("")
        );
    }

    // If we didn't find any custom matches, consider personal matches
    if (matches.length == 0) {
        matches = player.personal_matches(
            player.current_input_player(),
            CURRENT_GLYPHS_BUTTON.glyphs.join("")
        );
    }

    if (matches.length > 0) { // Found a match
        let in_reach = false; // is this match within reach?
        // TODO: Implement reach > 0
        if (MODE == "free" || MODE == "quiz") {
            in_reach = true;
        } else {
            for (let gp of SELECTION_PATH) {
                if (content.is_unlocked(cdk, gp)) {
                    in_reach = true;
                    break;
                }
            }
        }
        if (in_reach) { // Match is in-reach
            // clear our swipes and glyphs and add to our words found
            player.add_unlocked(
                player.current_input_player(),
                cdk,
                SELECTION_PATH.filter(e => typeof e[0] != "string")
            );
            for (let m of matches) {
                find_word(cdk, m, SELECTION_PATH.slice());
            }
            clear_selection(
                [ CTX.cwidth/2, CTX.cheight ],
                { "color": "#fff" }
            );
            // Highlight in white
            CURRENT_GLYPHS_BUTTON.flash("#fff");
        } else { // Valid word but it's not in-reach
            // Highlight in yellow
            CURRENT_GLYPHS_BUTTON.flash("#ff2");
        }
    } else { // No match found: highlight in red
        CURRENT_GLYPHS_BUTTON.flash("#f22");
    }
    DO_REDRAW = 0;
}


/**
 * determines the primary canvas coordinates for a mouse click/move or
 * touch event.
 *
 * @param e a mouse or touch event object.
 * @return a 2-element array containing x/y canvas coordinates for the
 *     primary location of the given event. for multi-touch events, the
 *     location of the first touch is used.
 */
export function canvas_position_of_event(e) {
    if (e.touches) {
        e = e.touches[0];
    }
    if (e.clientX == undefined || e.clientY == undefined) {
        throw "Bad event position";
    }
    var client_x = e.clientX - CTX.bounds.left;
    var client_y = e.clientY - CTX.bounds.top;
    return [
        client_x * CTX.cwidth / CTX.bounds.width,
        client_y * CTX.cheight / CTX.bounds.height
    ];
}

/**
 * Converts from viewport coordinates to html coordinates
 *
 * @param vpos_coord A 2-element array with viewport x/y coordinates
 *
 * @return A 2-element array with html x/y coordinates
 */
export function vpos__hpos(vpos_coord) {
    var client_x = vpos_coord[0] * CTX.bounds.width / CTX.cwidth;
    var client_y = vpos_coord[1] * CTX.bounds.height / CTX.cheight;
    return [client_x, client_y];
}

/**
 * Function for determining which kind of "click" an event is, including
 * touch events.
 *
 * @param e a touch or click event.
 *
 * @return a string; one of "primary", "secondary", "tertiary", or
 *     "auxiliary", based on the type of click. with a mouse, left-click
 *     (for a right-handed setup) is primary, right-click is secondary,
 *     middle-click is tertiary, and anything else is auxiliary.
 *     for a touch event, a single touch is primary and any kind of
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
 * TODO: Fix screen flashing in Firefox when resizing width larger...
 */
export function update_canvas_size() {
    let canvas = document.getElementById("canvas");
    let bounds = canvas.getBoundingClientRect();
    let car = bounds.width / bounds.height;
    let target_height = Math.max(200, Math.min(600, 1.2 * bounds.height));
    canvas.width = target_height * car;
    canvas.height = target_height;
    CTX.cwidth = canvas.width;
    CTX.cheight = canvas.height;
    CTX.middle = [CTX.cwidth / 2, CTX.cheight / 2];
    CTX.bounds = bounds;
    DO_REDRAW = 0;
    menu.notify_resize(bounds.width, bounds.height);
}

/**
 * Call this function to update the glyphs shown on the
 * CURRENT_GLYPHS_BUTTON based on the contents of the CURRENT_SWIPES.
 */
export function update_current_glyphs() {
    var glyphs = [];
    let cdk = get_current_dimkey();
    let cd = dimensions.key__dim(cdk);
    let last_pos;
    for (let gp_or_index of SELECTION_PATH) {
        let g;
        if (typeof gp_or_index[0] == "string") {
            if (gp_or_index[0] == "slots") {
                g = SLOTS_MENU.get_glyph(gp_or_index[1]); //TO DO
                if (g == undefined) {
                    //TODO maybe clean up the entry?
                    continue;
                }
            }
        } else {
            g = content.tile_at(cd, gp_or_index).glyph;
            if (g == undefined) { // should never happen in theory:
                console.warn(
                    "Internal Error: update_current_glyphs found"
                    + " undefined glyph at: " + gp_or_index
                );
                g = "?";
            }
            last_pos = gp_or_index;
        }
        glyphs.push(g);
    }
    if(last_pos){
        place_avatar(last_pos);
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
    var wpos = draw.world_pos(ctx, vpos);
    var gpos = grid.grid_pos(wpos);
    var head = find_swipe_head();
    let cdk = get_current_dimkey();
    let cd = dimensions.key__dim(cdk);
    var tile = content.tile_at(cd, gpos);
    if (tile.domain == "__active__") {
        // an active element: just energize it
        // TODO: Energize preconditions
        content.energize_tile(cd, gpos);
    } else {
        // a normal tile: select it
        if (
            !is_selected(gpos)
            && (head == null || grid.is_neighbor(head, gpos))
            && tile.glyph != undefined
        ) {
            SELECTION_PATH.push(gpos);
            update_current_glyphs();
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

    // No matter what, we're not swiping any more
    SWIPING = false;

    // Get current dimension
    let cdk = get_current_dimkey();
    let cd = dimensions.key__dim(cdk);

    // Check for double-click/tap:
    let isdbl = false;
    if (LAST_RELEASE != null) {
        let dx = vpos[0] - LAST_RELEASE[0];
        let dy = vpos[1] - LAST_RELEASE[1];
        let dt = window.performance.now() - PRESS_RECORDS[0];
        let rdist = Math.sqrt(dx * dx + dy * dy);
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
        for (let i = 0; i < SELECTION_PATH.length; ++i) {
            let sel_gp = SELECTION_PATH[i];
            if ("" + gp == "" + sel_gp) {
                cancel_from = i;
                break;
            }
        }

        if (cancel_from != undefined) {
            // We double-tapped a swiped glyph to cancel it

            // Find adjacent grid positions from swipe
            let prior = undefined;
            let next = undefined;
            if (cancel_from > 0) {
                prior = SELECTION_PATH[cancel_from - 1];
            }
            if (cancel_from < SELECTION_PATH.length) {
                next = SELECTION_PATH[cancel_from + 1];
            }

            // Check continuity
            if (prior != undefined && next != undefined) {
                if (grid.is_neighbor(prior, next)) {
                    // Cut out just the one glyph and stitch the rest
                    // together:
                    SELECTION_PATH.splice(cancel_from, 1);
                } else {
                    // First deselect any affected non-grid letters
                    for (let entry of SELECTION_PATH.slice(cancel_from)) {
                        if (entry[0] == "slots") {
                            SLOTS_MENU._deselect(entry[1], true);
                        }
                    }
                    // Cut off everything after the target:
                    SELECTION_PATH = SELECTION_PATH.slice(0, cancel_from);
                }
            } else {
                // First or last entry: splice it out
                SELECTION_PATH.splice(cancel_from, 1);
            }
            update_current_glyphs();
        } else {
            // We double-tapped an open spot to poke it

            // Check adjacency
            let wp = draw.world_pos(ctx, vpos);
            let gp = grid.grid_pos(wp);
            let valid = false;
            if (MODE == "free" || MODE == "quiz") {
                valid = false;
            } else {
                // TODO: Use reach here
                for (let d = 0; d < 6; ++d) {
                    let np = grid.neighbor(gp, d);
                    if (content.is_unlocked(cdk, np)) {
                        valid = true;
                        break;
                    }
                }
            }
            if (valid) {
                // Get rid of last selection entry & update glyphs
                SELECTION_PATH.pop();
                update_current_glyphs();
                // Check for already-active poke here
                let entry = [ cd, gp, window.performance.now() ];
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
                    // TODO: limit based on player...
                    if (ACTIVE_POKES.length > content.POKE_LIMIT) {
                        ACTIVE_POKES.shift();
                    }
                }
            }
        }
        DO_REDRAW = 0;
    } else {
        // this is just a normal mouseup
        if (SELECTION_PATH.length == 0) {
            return;
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
    // position of the event
    var vpos = canvas_position_of_event(e);

    // Get current dimension
    let cdk = get_current_dimkey();
    if (cdk == undefined) {
        console.log("BAD");
    }
    let cd = dimensions.key__dim(cdk);

    if (SCROLL_REFERENT != null) {
        // scrolling w/ aux button or two fingers
        var dx = vpos[0] - SCROLL_REFERENT[0];
        var dy = vpos[1] - SCROLL_REFERENT[1];

        SCROLL_REFERENT = vpos.slice();

        place_viewport([CTX.viewport_center[0] - dx, CTX.viewport_center[1] + dy]);
        place_avatar();

        DO_REDRAW = 0;
    } else if (SWIPING && SELECTION_PATH.length > 0) {
        // swiping w/ primary button or one finger
        var wpos = draw.world_pos(CTX, vpos);
        var gpos = grid.grid_pos(wpos);
        var prev = find_swipe_head(1);
        var head = find_swipe_head();
        var is_used = false;
        var is_prev = false;
        var is_head = false;
        for (let idx = 0; idx < SELECTION_PATH.length; ++idx) {
            let prpos = SELECTION_PATH[idx];
            if ("" + prpos == "" + gpos) {
                is_used = true;
                if (idx == SELECTION_PATH.length - 1) {
                    is_head = true;
                } else if (idx == SELECTION_PATH.length - 2) {
                    is_prev = true;
                }
            }
        }
        if (is_used) {
            if (
                is_prev
             && typeof SELECTION_PATH[SELECTION_PATH.length-1][0] != "string"
            ) {
                SELECTION_PATH.pop();
                update_current_glyphs();
                DO_REDRAW = 0;
            }
            // else do nothing, we're on a tile that's already part of the
            // current swipe.
        } else {
            // for tiles that aren't part of the swipe already, and
            // which *are* loaded:
            var tile = content.tile_at(cd, gpos);
            if (
                (head == null || grid.is_neighbor(head, gpos))
             && tile.glyph != undefined
             && tile.domain != "__active__"
             && tile.domain != "__empty__"
            ) {
                // add them if they're a neighbor of the head
                // (and not unloaded, and not an object)
                SELECTION_PATH.push(gpos);
                update_current_glyphs();
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

    place_viewport([CTX.viewport_center[0] + dx, CTX.viewport_center[1] - dy]);

    DO_REDRAW = 0;
}

/**
 * Sets up the canvas object and initializes the CTX and DO_REDRAW
 * variables.
 *
 * @return The canvas element of the document for which setup was
 *     performed.
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
 * Figures out whether this event targets a menu or not. If the click's
 * target is a descendant of the MENUS_NODE rather than some other part
 * of the page, as long as we didn't hit a menu_area element, we must
 * have hit a real menu.
 *
 * @param e The event object to inquire about.
 *
 * @return True if that event hit a menu.
 */
export function event_targets_a_menu(e) {
    return (
        has_ancestor(e.target, MENUS_NODE)
     && (
             !e.target.classList
          || !e.target.classList.contains("menu_area")
        )
    );
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
    // Grab handle for the menus node
    MENUS_NODE = document.getElementById("menus");

    // Set up the canvas
    let canvas = setup_canvas();

    // Initialize the menu system
    menu.init_menus([canvas.width, canvas.height]);

    // Set up the player
    setup_player(starting_dimension.seed); // TODO: Different seed?

    // Display the current player's avatar
    avatar.init_avatar(player.current_input_player()); 
    rescale_avatar();
    place_avatar([0, 0]);

    // Unlock initial tiles
    // TODO: Better/different here?
    // TODO: Add starting place?
    let agent = player.current_input_player();
    let sdk = dimensions.dim__key(starting_dimension);
    let unlocks = player.unlocks_in_dimension(agent, sdk);
    if (unlocks.length == 0) {
        warp_to([0, 0], sdk);
    } else { // player already has tiles unlocked in this dimension
        // TODO: Warp to the player's current dimension if we load a
        // player?
        let last = unlocks[unlocks.length - 1];
        warp_to(last[0], sdk, false);
    }

    if (MODE == "example") {
        // Demo quests
        let bonus_dimension = {
            "kind": "custom",
            "layout": "dense",
            "flavor": "bare",
            "domain": "English",
            "seed": 10985,
            "words": EXAMPLE_WORDS
        };
        let bdk = dimensions.dim__key(bonus_dimension);

        // Quest chain:
        let inner_quest = quests.new_quest(
            "hunt",
            // bonus_words.slice(0, 3),
            [ "ZYGOTE" ],
            EXAMPLE_WORDS.slice(3, 8),
            [ // rewards
                [ "exp", ["acuity", 60] ],
                [ "exp", ["dexterity", 60] ],
                [ "return" ],
                [
                    "quest",
                    quests.new_quest(
                        "big",
                        [5, 3], // length, #
                        [7, 4],
                        [ // rewards
                            [ "exp", ["concentration", 30] ],
                            [ "exp", ["intuition", 30] ],
                            [ "exp", ["compassion", 30] ],
                            [ "refresh", 3 ],
                        ]
                    )
                ],
            ]
        );
        quests.bind_dimension(inner_quest, bdk);

        // Default quest
        // Grant starting quest
        // TODO: Better/different here?
        let starting_quest = quests.new_quest(
            "stretch",
            3,
            15,
            [ // rewards
                [ "exp", ["creativity", 100] ],
                [ "exp", ["leadership", 100] ],
                [
                    "quest",
                    quests.new_quest(
                        "encircle",
                        8,
                        16,
                        [ // rewards
                            [ "exp", ["memory", 120] ],
                            [ "portal", [ bdk, [0, 0] ] ],
                            [ "quest", inner_quest ],
                        ]
                    )
                ],
            ]
        );
        grant_quest(starting_quest);
    } else if (MODE == "quiz") {
        // Adds a hunt quest for quiz mode with the given word list
        // TODO: Stop duplicating this quest!!!
        let quiz_quest = quests.new_quest(
            "hunt",
            starting_dimension.words.slice(),
            [],
            [ [ "finish_quiz" ] ]
        );
        // TODO: build an grant_quest function for this boilerplate?
        grant_quest(quiz_quest);
    }

    // kick off animation
    window.requestAnimationFrame(draw_frame);

    // Listen for window resizes but wait until RESIZE_TIMEOUT after the last
    // consecutive one to do anything.
    var timer_id = undefined;
    window.addEventListener("resize", function () {
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
        player.current_input_player(),
        "right",
        "quests"
    );
    // TODO: How to make sure items are updated when a reward is
    // claimed?!?

    WORDS_LIST_MENU = new menu.WordList(
        player.current_input_player(),
        "https://<lang>.wiktionary.org/wiki/<item>",
        "right",
        "words"
    );
    // TODO: Swap words list when dimension changes
    // TODO: Some way to see lists from non-current dimensions?

    // Adding slots menu, the contents are currently predetermined.
    // TODO: How to add/remove glyphs based on player progression
    SLOTS_MENU = new menu.SlotsMenu(
        ["A", "E", "I", "O", "U"],
        function (menu, index) { // select function
            splice_glyph("slots", index);
        },
        function (menu, index) {
            unsplice_glyph("slots", index);
        },
        "🎒",
        "left"
    );

    // In quiz mode, add a button to return to the quiz builder
    if (MODE == "quiz") {
        // Back dialog and toggle button for quiz mode
        let back_dialog = null;
        let cleanup_back = function () { back_dialog = null; };
        BACK_BUTTON = new menu.ButtonMenu(
            "↶",
            function () {
                if (back_dialog == null) {
                    // Create a dialog
                    back_dialog = new menu.Dialog(
                        (
                            "If you go back, your progress will be lost."
                          + " Are you sure you want to return to the puzzle"
                          + " builder page?"
                        ),
                        cleanup_back,
                        [
                            {
                                "text": "Yes",
                                "action": function () {
                                    cleanup_back();
                                    // go back to the quiz builder page
                                    window.location.assign("/start_quiz.html");
                                }
                            },
                            { "text": "Cancel", "action": cleanup_back }
                        ]
                    );
                } else {
                    // Remove the existing dialog
                    back_dialog.cancel();
                }
            },
            "left"
        );
    } else { // in non-quiz modes, add a home button
        HOME_BUTTON = new menu.ButtonMenu(
            "🏠",
            home_view,
            "left"
        );
    }

    ZOOM_IN_BUTTON = new menu.ButtonMenu(
        "+",
        zoom_in,
        "top"
    );

    ZOOM_OUT_BUTTON = new menu.ButtonMenu(
        "–",
        zoom_out,
        "top"
    );

    CLEAR_SELECTION_BUTTON = new menu.ButtonMenu(
        "⊗",
        function () {
            clear_selection(
                // TODO: Better here?
                [0, CTX.cheight],
                {
                    "color":
                        window.getComputedStyle(
                            CLEAR_SELECTION_BUTTON.element
                        ).color
                }
            );
        },
        "bottom",
        "clear_selection"
    );

    CURRENT_GLYPHS_BUTTON = new menu.GlyphsMenu(
        "",
        test_selection,
        "bottom",
        "current_glyphs"
    );

    let about_text;
    if (MODE == "quiz") {
        about_text = (
            "This is Words, version 0.2 in quiz mode. Use the Quests menu"
          + " on the right to list target words, and click the check that"
          + " appears there once you have found them all to move on. To"
          + " find a word, select it by dragging your mouse or finger"
          + " acros the letters, and then press SPACE or click on the"
          + " word that appears at the bottom of the screen. Double-tap"
          + " or use backspace to delete part of a selection, or use"
          + " ESCAPE to clear your selection."
        );
    } else {
        about_text = (
            "This is Words, version 0.2. Select words and tap the"
          + " word that appears below, or press SPACE. You can scroll to"
          + " see more of the grid. Use the ⊗ at the bottom-left or"
          + " ESCAPE to clear the selection, or double-tap to remove a"
          + " glyph. Review words with the 'Words' button on the"
          + " right-hand side. The 🏠 button takes you back to the"
          + " start."
        );
    }

    let about_dialog = null;
    let cleanup_about = function () { about_dialog = null; };
    ABOUT_BUTTON = new menu.ButtonMenu(
        "?",
        function () {
            if (about_dialog == null) {
                // Create a dialog
                about_dialog = new menu.Dialog(
                    about_text,
                    cleanup_about,
                    [ { "text": "Got it.", "action": cleanup_about } ]
                );
            } else {
                // Remove the existing dialog
                about_dialog.cancel();
            }
        },
        "bottom"
    );

    let hint_dialog = null;
    let cleanup_hint = function () { hint_dialog = null; };
    HINT_BUTTON = new menu.ButtonMenu(
        "Hint",
        function () {
            if (hint_dialog == null) {
                // Create a dialog
                hint_dialog = new menu.TextInputDialog(
                    (
                        "Search for a word:"
                    ),
                    cleanup_hint,
                    [
                        {
                            "text": "OK",
                            "action": function (menu, value) {
                                console.log(menu, value);
                                let paths = find_paths(value);
                                let first_letters = paths.map(
                                    path => path[0].pos
                                );
                                animate_lines(first_letters,
                                    [ CTX.cwidth/2, 0 ],
                                    { "color": "#0f6" }, animate.SECOND);


                                cleanup_hint();
                            }
                        },
                        {
                            "text": "Cancel",
                            "action": "cancel"
                        }
                    ]
                );
            } else {
                // Remove the existing dialog
                hint_dialog.cancel();
            }
        },
        "right"
    );

    // set up event handlers
    let down_handler = function (e) {
        // If this event targets a menu, skip it
        if (event_targets_a_menu(e)) { return; }

        // Stop propagation & prevent default action
        if (e.preventDefault) { e.preventDefault(); }

        // Figure out click/tap type and dispatch event
        var which = which_click(e);
        if (which == "primary") {
            handle_primary_down(CTX, e);
            PRESS_RECORDS[0] = PRESS_RECORDS[1];
            PRESS_RECORDS[1] = window.performance.now();
        } else if (which == "tertiary") {
            handle_tertiary_down(CTX, e);
        } // otherwise ignore this click/tap
    };
    document.addEventListener("mousedown", down_handler);
    document.addEventListener("touchstart", down_handler);

    let up_handler = function (e) {
        // If this event targets a menu, skip it
        if (event_targets_a_menu(e)) {
            // Reset scroll referent even if the event hit a menu
            SCROLL_REFERENT = null;
            // End swiping even if the event hit a menu
            SWIPING = false;
            return;
        }

        // Stop propagation & prevent default action
        if (e.preventDefault) { e.preventDefault(); }

        // Figure out click/tap type and dispatch event
        var which = which_click(e);
        if (which == "primary") {
            handle_primary_up(CTX, e);
            LAST_RELEASE = canvas_position_of_event(e);
        } else if (which == "tertiary") {
            handle_tertiary_up(CTX, e);
        } // otherwise ignore this click/tap

        // Reset scroll referent anyways just to be sure:
        SCROLL_REFERENT = null;
    };
    document.addEventListener("mouseup", up_handler);
    document.addEventListener("touchend", up_handler);
    document.addEventListener("touchcancel", up_handler);

    let move_handler = function (e) {
        // If this event targets a menu, skip it
        if (event_targets_a_menu(e)) { return; }

        if (e.preventDefault) { e.preventDefault(); }
        handle_movement(CTX, e);
    };
    document.addEventListener("mousemove", move_handler);
    document.addEventListener("touchmove", move_handler);

    let wheel_handler = function (e) {
        // If this event targets a menu, skip it
        if (event_targets_a_menu(e)) { return; }
        if (e.preventDefault) { e.preventDefault(); }
        handle_wheel(CTX, e);
    };
    document.addEventListener(
        "wheel",
        wheel_handler,
        { "capture": true, "passive": false }
    );

    let key_handler = function (e) {
        // If this event targets a menu, skip it
        if (event_targets_a_menu(e)) { return; }

        if (COMMANDS.hasOwnProperty(e.key)) {
            COMMANDS[e.key](e);
        }
    };
    document.addEventListener("keydown", key_handler);
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
    warp_to([0, 0], dimensions.dim__key(starting_dimension));

    // kick off animation
    window.requestAnimationFrame(make_test_animator(supertiles));

    // Listen for window resizes but wait until RESIZE_TIMEOUT after the last
    // consecutive one to do anything.
    var timer_id = undefined;
    window.addEventListener("resize", function () {
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

    document.addEventListener("keydown", function (e) {
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
    for(let prpos of SELECTION_PATH) {
        if ("" + prpos == "" + gpos) {
            return true;
        }
    }
    return false;
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

    // Compute elapsed time (in milliseconds)
    let elapsed;
    if (PREV_FRAME_TIME == undefined) {
        elapsed = 0; // on first frame we count 0 elapsed
    } else {
        elapsed = now - PREV_FRAME_TIME; // otherwise compute it
    }
    elapsed = Math.max(0, elapsed); // ensure its not negative
    PREV_FRAME_TIME = now; // update previous value

    let elapsed_seconds = elapsed / 1000;

    // Tick players and check whether they want a redraw...
    if (player.tick_players(elapsed_seconds)) {
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

    // get current dimension
    let cdk = get_current_dimkey();
    // tiles etc. only if available
    if (cdk != undefined) {
        let cd = dimensions.key__dim(cdk);
    //    console.log(cd, "cd");
        // Tiles
        let visible_tiles = draw.visible_tile_list(cd, CTX);
    //    console.log(visible_tiles,"tiles");
        if (!draw.draw_tiles(cd, CTX, visible_tiles)) {
            if (DO_REDRAW != null) {
                DO_REDRAW = Math.min(DO_REDRAW, MISSING_TILE_RETRY);
            } else {
                DO_REDRAW = MISSING_TILE_RETRY;
            }
        }

        // Highlight unlocked:
        if (TRACE_UNLOCKED) {
            draw.trace_unlocked(dimensions.dim__key(cd), CTX);
        }

        // Add energy highlights:
        draw.draw_energies(cd, CTX, visible_tiles);

        // Swipes
        draw.draw_swipe(CTX, SELECTION_PATH, "highlight");

        // Pokes
        var poke_redraw_after = undefined;
        var finished_pokes = [];
        for (let index = 0; index < ACTIVE_POKES.length; ++index) {
            let poke = ACTIVE_POKES[index];
            if (dimensions.same(cd, poke[0])) {
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
                let dk = dimensions.dim__key(poke[0]);
                player.add_poke(player.current_input_player(), dk, poke[1]);
                ACTIVE_POKES.splice(i - adj, 1);
                adj += 1;
            }
        } else if (poke_redraw_after != undefined) {
            // set up redraw for remaining active pokes
            DO_REDRAW = Math.max(poke_redraw_after, 0);
        }
    }

    // Loading bars for domains (regardless of dimension availability)
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

    // Animations (regardless of dimension availability)
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
    let animate_grid_test = function (now) {
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
 * Places avatar into world using html coordinates. Updates the
 * LAST_AVATAR_POSITION with this new position.
 *
 * @param gpos A 2-element array with tile grid x/y coordinates
 */
function place_avatar(gpos) {
    // convert from grid coordinates to html coordinates
    let wp = grid.world_pos(gpos);
    let vp = draw.view_pos(CTX, wp);
    let hp = vpos__hpos(vp);

    // save the position in the LAST_AVATAR_POSITION and update avatar position
    LAST_AVATAR_POSITION = gpos;
    avatar.set_avatar_position(hp[0], hp[1]);
}

/**
 * Rescales the avatar to a position that fits the canvas
 */
function rescale_avatar(){
    avatar.set_avatar_size(CTX.viewport_scale * grid.GRID_SIZE, CTX.viewport_scale * grid.GRID_SIZE);
}

/**
 * Puts the avatar at the last position it remembers (used when the page
 * is zoomed in or out so that the avatar scales with it).
 */
function replace_avatar(){
    place_avatar(LAST_AVATAR_POSITION);
}

/**
 * Resets the viewport and re-intializes the avatar's position.
 * 
 * @param wpos A 2-element array with world x/y coordinates
 */
function place_viewport(wpos) {
    CTX.viewport_center[0] = wpos[0];
    CTX.viewport_center[1] = wpos[1];
    replace_avatar();
}

/**
* Adds a glyph from a source other than the main board to the current
* word being built. Current sources include:
*
* "slots" - The slots menu. Index indicates which slot is being used.
*
* @param source Where the glyph is coming from (a string).
* @param index The index of the glyph within that source.
*/
export function splice_glyph(source, index) {
    let entry = [source, index];
    SELECTION_PATH.push(entry);
    update_current_glyphs();
    DO_REDRAW = 0;
}

/**
 * Removes a currently-spliced glyph from a specific source from the
 * current swipes. See splice_glyph for details about valid sources.
 *
 * Removes only the first instance of the given index/source pair from
 * the swipes list.
 *
 * @param source The source of the glyph (a string).
 * @param index The index of the glyph within that source.
 */
export function unsplice_glyph(source, index) {
    let remove = undefined;
    let sidx;
    let drop = false;
    let eidx;
    for (eidx = 0; eidx < SELECTION_PATH.length; ++eidx) {
        let entry = SELECTION_PATH[eidx];
        if (entry[0] == source && entry[1] == index) {
            drop = true;
            break;
        }
    }

    if (drop) { // found a match to get rid of
        SELECTION_PATH.splice(eidx, 1); // remove entry
    }

    update_current_glyphs();
    DO_REDRAW = 0;
}


/**
* Finds the head of the swipe (the last position selected within the
* grid). If an index is given, finds the position that many entries back
* from the head. Entries from outside the grid are skipped.
*
* @param index (optional) How far back to go in the swipe. Default is 0.
*
* @return A 2-element x/y grid coordinate array indicating the last valid
*     grid position in the current swipe, or null if there is no such
*     position.
*/
export function find_swipe_head(index) {
    if (index == undefined) {
        index = 0;
    }
    for (var idx = SELECTION_PATH.length - 1; idx > -1; --idx) {
        let gp = SELECTION_PATH[idx];
        if (typeof gp[0] != "string") {
            index -= 1;
            if (index < 0) {
                return gp;
            }
        }
    }
    return null;
}


// the function returns all the glyphs visible

export function get_glyph(){

        // get current dimension
        let cdk = get_current_dimkey();
        // tiles etc. only if available
        console.log(cdk);
        if (cdk != undefined) {
            let cd = dimensions.key__dim(cdk);

            // Tiles
            let visible_tiles = draw.visible_tile_list(cd, CTX);
            console.log(visible_tiles,"visible tile");
            return visible_tiles;
        }


    }

export function map_tiles(tile_array){
    let result = {};
    for(let tile of tile_array){
        let key = grid.coords__key(tile.pos);
        result[key] = tile;
    }
    return result;
}


export function revise_posibilities(next_letter,tile_map,collected_posibilities){

    let result = [];
    for (let path of collected_posibilities){
        let last_tile = path[path.length-1];
        for(let d = 0; d<grid.N_DIRECTIONS; d++){
            let nb = grid.neighbor(last_tile.pos, d);
            let nb_tile = tile_map[grid.coords__key(nb)];
            if(
                nb_tile
             && next_letter == nb_tile.glyph
             && !path.includes(nb_tile)
            ){
                result.push(path.concat([nb_tile]));
            }
        }

    }
    return result;
}


export function find_paths(word){
    let visible_tiles = get_glyph();
    let tile_map = map_tiles(visible_tiles);
    let foundWord = [];
    let possiblities = [];
    console.log(visible_tiles.length);
    for (let tile of visible_tiles){

        console.log(tile.glyph, "visible_tiles[i].glyph");
        console.log(word[0]);
        if (word[0] == tile.glyph){
            possiblities.push([tile]);
        }

    }
    for (let letter of word.slice(1)){
        possiblities = revise_posibilities(letter, tile_map, possiblities);
    }
    console.log(possiblities);
    return possiblities;
}



export function animate_lines(path, destination, style, duration){
    let lines = [];
    for (let gp of path) {
        if (typeof gp[0] != "string") {
            var wp = grid.world_pos(gp);
            var vp = draw.view_pos(CTX, wp);
            lines.push(
                new animate.MotionLine(
                    duration,
                    undefined,
                    vp,
                    destination,
                    style
                )
            );
        }
    }
    let result = new animate.AnimGroup(lines, function(){});
    animate.activate_animation(result);

DO_REDRAW = 0;
return result;
}
/**
 * A quest claim function which updates the QUEST_MENU, and if we're in
 * quiz mode, checks for a "finish_quiz" reward and presents the
 * associated dialog.
 */
export function quest_claimed(quest) {
    if (MODE == "quiz") {
        // In quiz mode, check for a finish_quiz reward and implement it
        let quiz_over = false;
        for (let reward of quest.rewards) {
            if (reward[0] == "finish_quiz") {
                quiz_over = true;
            }
        }
        if (quiz_over) {
            // Create a dialog to let the player choose what should
            // happen next
            let continue_dialog = new menu.Dialog(
                (
                    "Congratulations, you finished the challenge! Do"
                    + " you want to build a new quiz or start a new"
                    + " board with the same words?"
                ),
                undefined, // do nothing on cancel
                [
                    {
                        "text": "Build a new quiz",
                        "action": function () {
                            // go back to the quiz builder page
                            window.location.assign("/start_quiz.html");
                        }
                    },
                    {
                        "text": "Scrambe the board",
                        "action": function() {
                            let seed = anarchy.scramble_seed(
                                env.get_environment().seed
                            );
                            env.update_environment({"seed": "" + seed});
                            window.location.reload();
                        }
                    },
                    { "text": "Cancel", "action": "cancel" }
                ]
            );
        }
    }
    // In any case, update the QUEST_MENU and make sure we redraw
    QUEST_MENU.update();
    DO_REDRAW = 0;
}


/**
 * Gives a quest to the current input player, setting up the required
 * quest claim function.
 */
export function grant_quest(quest) {
    let agent = player.current_input_player();
    player.activate_quest(
        agent,
        quest,
        quest_claimed
    );
}

/**
 * Creates the initial player object, either by creating a new player,
 * or by loading a player from local storage. This function calls
 * player.set_input_player with the player that it loads or creates.
 *
 * @param seed A seed value used if a new player needs to be created.
 */
export function setup_player(seed) {
    // Check for stored players:

    // TODO: Debugging and temporarily set stored to []
    // let stored = player.stored_players();
    let stored = [];

    let the_player;
    if (stored.length > 0 && MODE == "normal") {
        // TODO: Give the user a menu to select which player to load...
        the_player = player.load_player(stored[0], quest_claimed);
    } else {
        // make a new player and set its avatar
        the_player = player.new_player(1829812^seed);

        // TODO: add a way to put avatars into the start menu
        // rather than hard-coding them here
        pick_avatar(["yellow_avatar", "avatar", "purple_avatar"], the_player);
    }

    player.set_input_player(the_player);
}

/**
 * Open a menu for the user to choose their avatar
 *
 * @param base_name_list An array of string containing the base names for
 *    each available avatar. For example, an avatar with the base name
 *    "avatar" might have filenames "avatar.svg" and "avatar_jump.svg"
 * @param the_player The player object who is currently playing the game
 */
function pick_avatar(base_name_list, the_player){
    START_MENU = new menu.StartMenu(
        "Pick an avatar!", // text of start menu
        [], // buttons of start menu
        base_name_list, // the list of base names
        the_player, // the player
        "center", // the location of this menu on the screen
    );   
}
