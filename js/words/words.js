// words.js
// Word game.
/* global console, window, document */

"use strict";

import * as ui from "./ui.js";
import * as dimensions from "./dimensions.js";
import * as generate from "./generate.js";
import * as player from "./player.js";

/**
 * Main entry point for a normal game; sets up event handlers and kicks
 * off the drawing code which enacts the main game loop.
 */
export function start_game() {
    // figure out context
    let hash = window.location.hash;
    let env = {};
    if (hash.length > 0) {
        let hashitems = hash.slice(1).split(',');
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
    let starting_dimension = {
        "kind": "full",
        "layout": "reasonable",
        "domain": edom,
        "seed": eseed,
    };

    /*/ *
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
      "domain": "English",
      "seed": 10985
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
    // */

    // TODO: persist players!
    player.set_input_player(player.new_player(1829812));

    // Start the game
    ui.init(starting_dimension);
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
