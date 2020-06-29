// words.js
// Word game.
/* global console, window, document */

"use strict";

import * as ui from "./ui.js";
import * as dimensions from "./dimensions.js";
import * as generate from "./generate.js";
import * as player from "./player.js";
import * as dict from "./dict.js";

/**
* How long to wait if domain is unloaded when determining word list in ms
*/
let WORDLIST_BACKOFF = 80;
/**
* Main entry point for a normal game; sets up event handlers and kicks
* off the drawing code which enacts the main game loop.
*/
export function start_game() {
    // figure out context
    let hash = window.location.hash;
    let env = {};
    if (hash.length > 0) {
        let encodeditems = hash.slice(1);
        let decodeditems = decodeURIComponent(encodeditems);
        let hashitems = decodeditems.split(',');
        for (let hi of hashitems) {
            let parts = hi.split('=');
            if (parts.length == 2) {
                env[parts[0]] = parts[1];
            }
        }
    }

    let edom = env["domain"];
    if (!edom || !dimensions.MULTIPLANAR_DOMAINS.includes(edom)) {
        //edom = "成语";
        edom = "English";
    }

    let eseed = Number.parseInt(env["seed"]);
    if (Number.isNaN(eseed)) {
        eseed = 10983;
    }

    let ewords = env["words"];

    determine_wordlist(edom, ewords, function(w){ finish_setup(edom,eseed,w)});
}
A
/**
* In this function, we make the words and their definitions their own lists. The
* words are split from different characters the user will put in the text file
* they upload. We get domain, seed and wordlist to call starting_dimension to
* which starts up the dimension based on those parameters.
*
* @param domain used to know what domain the user wants to place words from the
* full dimension besides just their words uploaded
* @param seed Used to randomize the dimension
* @param wordlist list of string of words that the user uploaded
*/
function finish_setup (domain, seed, wordlist){
    /*/ *
    =======
    let starting_dimension = {
    "kind": "full",
    "layout": "reasonable",
    "domain": edom,
    "seed": eseed,
    };

    let starting_dimension = {
    "kind": "pocket",
    "layout": "dense",
    "flavor": "full",
    "domain": "English",
    "seed": 10985
    }
    let starting_dimension = {
    "kind": "custom",
    "layout": "dense",
    "flavor": "bare",
    "domain": edom,
    "seed": 10985,
    "words": [
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
    };
    */

    let words = [];
    let definitions = [];
    for (let i of wordlist) {
        i= i.split("`");
        if (i.length > 1) {
            words.push(i[0])
            definitions.push(i[1])
        }
    }
    for (let i = 0; i < words.length; i++) {
        let final_words = words[i].split(/\s+/);
        if(final_words[final_words.length-1] == ""){
            final_words.pop();
        }
        if(final_words[0] == ""){
            final_words.shift()
        }
        words[i] = final_words[0];
    }

    let starting_dimension = {
        "kind": "custom",
        "layout": "dense",
        "flavor": "bare",
        "domain": domain,
        "seed": 10985^seed,
        "words": words,
        "definitions": definitions
    };


    // TODO: persist players!
    player.set_input_player(player.new_player(1829812^seed));

    // Start the game
    ui.init(starting_dimension);
}

/**
* This function uppercases the words for the dimension. Returns the list of words
*
* @param dom_name gets the domain name by calling domains_list
* @param raw_wordlist the words the user uploads in a list which are unescaped
* to be readable
* @param continuation The function to call either immediately or
*     whenever the domain value becomes available. It will be given the
*     cache key that corresponds to the given arguments
*/
function determine_wordlist(dom_name, raw_wordlist, continuation) {
    let dom_names = generate.domains_list(dom_name);
    let is_case_sensitive = false;
    let only_locale = undefined;
    let resechedule = false;
    for (let name of dom_names) {
        //if any domain is case sensitive, we won't uppercase
        let dom = dict.lookup_domain(name)
        if (dom == undefined) {
            resechedule = true;
            continue
        }
        // unloaded domains
        if (only_locale == undefined) {
            only_locale = dom.locale;
        }
        if (dom.cased || only_locale != dom.locale) {
            is_case_sensitive = true;
            break;
        }
    }
    if (resechedule) {
        window.setTimeout(determine_wordlist,WORDLIST_BACKOFF,dom_name,
            raw_wordlist, continuation)
        return
    }

    let processed = unescape(raw_wordlist);

    if (! is_case_sensitive) {
        processed = lc_upper(processed,only_locale)
    }

    continuation(processed.split('~'))
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
