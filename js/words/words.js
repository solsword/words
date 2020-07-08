// words.js
// Word game.
/* global console, window, document, locale */

"use strict";

import * as ui from "./ui.js";
import * as dimensions from "./dimensions.js";
import * as generate from "./generate.js";
import * as dict from "./dict.js";
import * as env from "./env.js";

/**
 * How long to wait if domain is unloaded when determining word list (in
 * milliseconds)
 */
let WORDLIST_BACKOFF = 80;

/**
* Main entry point for a normal game; sets up event handlers and kicks
* off the drawing code which enacts the main game loop.
*/
export function start_game() {
    // figure out context
    let env_vars = env.get_environment();

    let emode = env_vars.mode;
    if (!emode) {
        emode = "normal";
    }

    let edom = env_vars.domain;
    if (!edom || !dimensions.MULTIPLANAR_DOMAINS.includes(edom)) {
        //edom = "成语";
        edom = "English";
    }

    let eseed = Number.parseInt(env_vars.seed);
    if (Number.isNaN(eseed)) {
        eseed = 10983;
    }

    let ewords = env_vars.words;

    if (emode == "quiz") {
        // In quiz mode, we need to process the wordlist
        determine_wordlist(
            edom,
            ewords,
            function (wl) { finish_setup(emode, edom, eseed, wl); }
        );
    } else {
        // In other modes, we can ignore the words list and just get
        // things started immediately
        finish_setup(emode, edom, eseed, []);
    }
}

/**
 * Given a mode string (one of the ui.MODES), a domain name, a seed, and
 * a list of words (or undefined if there is no user-specified word
 * list), this function finishes the setup process by creating an
 * appropriate starting domain and calling ui.init.
 *
 * @param mode A string specifying the mode (must be one of ui.MODES).
 * @param domname Used to know what full domain the user wants to match
 *     words from besides just their words uploaded. A string naming a
 *     domain or domain combo.
 * @param seed Used to randomize the starting dimension
 * @param wordlist List of string of words that the user uploaded. This
 *     should be a list of strings which contain
 */
function finish_setup(mode, domname, seed, wordlist) {
    if (!ui.MODES.includes(mode)) {
        console.warn("Unknown mode '" + mode + "' defaults to 'normal'");
        mode = "normal";
    }

    // Set the global MODE variable in ui.js
    ui.set_mode(mode);

    // Sort out words vs. definitions
    let words = [];
    let definitions = [];
    for (let word of wordlist) {
        if (word.includes('`')) {
            let [just_word, definition] = word.split('`');
            words.push(just_word);
            definitions.push(definition);
        } else {
            words.push(word);
            definitions.push(undefined);
        }
    }

    // Construct a starting dimension based on the mode
    let starting_dimension;
    if (mode == "quiz") {
        starting_dimension = {
            "kind": "custom",
            "layout": "dense",
            "flavor": "bare",
            "domain": domname,
            "seed": 10985^seed,
            "words": words,
            "definitions": definitions
                // TODO: Some other mechanism for definitions since
                // bandwidth in the URL is limited...
        };
    } else { // normal, free, and example modes
        starting_dimension = {
            "kind": "full",
            "layout": "reasonable",
            "domain": domname,
            "seed": seed,
        };
    }

    // Start the game
    ui.init(starting_dimension);
}

/**
* This function takes a raw wordlist as a single string, separates it
* into words, and uppercases the words according to the locale of the
* given dimension. We need to wait for the relevant domain to be loaded
* so that we can figure out the locale for uppercasing, so this function
* reschedules itself until loading is complete and then calls the given
* continuation function.
*
* @param dom_name The name of the domain (or combo) to use for
*     uppercasing.
* @param raw_wordlist A single string containing words separated by
*     semicolons, escaped using window.escape.
* @param continuation The function to call either immediately or
*     whenever the domain value becomes available. It will be given an
*     array containing word strings.
*/
function determine_wordlist(dom_name, raw_wordlist, continuation) {
    let dom_names = generate.domains_list(dom_name);
    let is_case_sensitive = false;
    let only_locale = undefined;
    let resechedule = false;
    for (let name of dom_names) {
        //if any domain is case sensitive, we won't uppercase
        let dom = dict.lookup_domain(name);
        if (dom == undefined) {
            resechedule = true;
            continue;
        }
        // unloaded domains
        if (only_locale == undefined) {
            only_locale = dom.locale;
        }
        if (dom.cased || dom.locale != only_locale) {
            is_case_sensitive = true;
            break;
        }
    }
    if (resechedule) {
        window.setTimeout(
            determine_wordlist,
            WORDLIST_BACKOFF,
            dom_name,
            raw_wordlist,
            continuation
        );
        return;
    }

    let processed = window.unescape(raw_wordlist);

    if (!is_case_sensitive) {
        processed = locale.lc_upper(processed, only_locale);
    }

    continuation(processed.split(';'));
    //TODO are any languages that use semicolons in spelling?
}


/**
* Main entry point for the grid test functionality, which generates and
* displays some fake data but doesn't support most of the usual game
* interactions.
*/
export function test_grid() {
    // Set up the canvas
    ui.setup_canvas();

    let test_dimension = {
        "kind": "custom",
        "layout": "dense",
        "flavor": "bare",
        "domain": "English",
        "seed": 10985,
        "words": [ "THIS", "IS", "NOT", "GOING", "TO", "BE", "USED" ]
    };

    // set up test data:
    let test_supertiles = [
        generate.generate_test_supertile(test_dimension, [0, 0], 28012),
        generate.generate_test_supertile(test_dimension, [1, 0], 28012),
        generate.generate_test_supertile(test_dimension, [-1, 0], 28012),
        generate.generate_test_supertile(test_dimension, [0, 1], 28012),
        generate.generate_test_supertile(test_dimension, [-1, 1], 28012),
        generate.generate_test_supertile(test_dimension, [0, -1], 28012),
        generate.generate_test_supertile(test_dimension, [1, -1], 28012),
    ];

    ui.init_test(test_dimension, test_supertiles);
}
