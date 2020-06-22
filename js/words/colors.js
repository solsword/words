// colors.js
// Color schemes for words game.
/* global document */

"use strict";

/**
 * The various color schemes.
 */
export var SCHEMES = {
    "underground": {
        "outer": {
            "background": "#444",
            "edge": "#000",
        },
        "ui": {
            "highlight": "#fff",
            "poke": "#ddd",
            "trail": "#ccc",
        },
        "tile": {
            "outline": "#555",
            "inner": "#333",
            "rim": "#555",
            "pad": "#444",
            "glyph": "#bbb",
            "unlocked-pad": "#777",
            "unlocked-rim": "#eee",
            "unlocked-glyph": "#fff",
            "included-pad": "#555",
            "included-rim": "#777",
        },
        "loading": {
            "pre_outline": "#999",
            "outline": "#999",
            "inner": "#333",
            "counts": "#777",
            "index": "#999",
            "text": "#fff"
        },
        "menu": {
            "background": "#057",
            "border": "#0af",
            "active_background": "#079",
            "active_border": "#0cf",
            "text": "#fff",
            "text_outline": "#fff",
            "button": "#079",
            "selected_button": "#035",
            "button_border": "#0cf",
            "button_text": "#fff",
            "button_text_outline": "#fff",
        },
        "bright": {
            "rd": "#f44",
            "yl": "#ff2",
            "bl": "#46f",
            "pk": "#f4c",
            "aq": "#4cf",
            "or": "#f92",
            "gn": "#6f6",
            "cr": "#efa",
            "lb": "#bef",
            "lg": "#af4",
            "pl": "#84f",
            "wt": "#fff",
            "bk": "#666",
        },
        "dark": {
            "rd": "#411",
            "yl": "#431",
            "bl": "#114",
            "pk": "#403",
            "aq": "#034",
            "or": "#420",
            "gn": "#141",
            "cr": "#342",
            "lb": "#335",
            "lg": "#453",
            "pl": "#214",
            "wt": "#777",
            "bk": "#111",
        },
    },
    "graph_paper": {
        "outer": {
            "background": "#fff",
            "edge": "#000",
        },
        "ui": {
            "highlight": "#000",
            "poke": "#bbf",
            "trail": "#222",
        },
        "tile": {
            "outline": "#eef",
            "inner": "#fff",
            "rim": "#ddf",
            "pad": "#fff",
            "glyph": "#000",
            "unlocked-pad": "#fff",
            "unlocked-rim": "#88f",
            "unlocked-glyph": "#000",
            "included-pad": "#fff",
            "included-rim": "#dfe",
        },
        "loading": {
            "pre_outline": "#ccf",
            "outline": "#eef",
            "inner": "#fff",
            "counts": "#555",
            "index": "#777",
            "text": "#000"
        },
        "menu": {
            "background": "#ddf",
            "border": "#99f",
            "active_background": "#aaf",
            "active_border": "#66f",
            "text": "#000",
            "text_outline": "#224",
            "button": "#ccf",
            "selected_button": "#aaf",
            "button_border": "#eef",
            "button_text": "#333",
            "button_text_outline": "#555",
        },
        "bright": {
            "rd": "#f44",
            "yl": "#ff2",
            "bl": "#46f",
            "pk": "#f4c",
            "aq": "#4cf",
            "or": "#f92",
            "gn": "#6f6",
            "cr": "#efa",
            "lb": "#bef",
            "lg": "#af4",
            "pl": "#84f",
            "wt": "#fff",
            "bk": "#666",
        },
        "dark": {
            "rd": "#411",
            "yl": "#431",
            "bl": "#114",
            "pk": "#403",
            "aq": "#034",
            "or": "#420",
            "gn": "#141",
            "cr": "#342",
            "lb": "#335",
            "lg": "#453",
            "pl": "#214",
            "wt": "#777",
            "bk": "#111",
        },
    },
    "dusk": {
        // TODO
    },
    "noon": {
        // TODO
    }
};

/**
 * The current color scheme.
 */
var CURRENT_SCHEME = undefined;

/**
 * @return The name of each available color scheme.
 */
export function scheme_names() { return Object.keys(SCHEMES); }

/**
 * Returns a color from the current color scheme. Colors are organized
 * into categories, like "outer" or "ui", and subcategories, like
 * "background" or "trail." See the SCHEMES value for valid category
 * values.
 *
 * @param category The color category (see SCHEMES).
 * @param subcategory The color sub-category (see SCHEMES).
 *
 * @return The specified color from the current color scheme.
 */
export function scheme_color(category, subcategory) {
    return CURRENT_SCHEME[category][subcategory];
}

/**
 * Sets the current color scheme.
 *
 * @param cs The name of the color scheme to swap to.
 */
export function set_color_scheme(cs) {
    CURRENT_SCHEME = SCHEMES[cs];
    document.body.style.background_color = scheme_color("outer", "background");
    let canvas = document.getElementById("canvas");
    if (canvas) {
        canvas.style.border_color = scheme_color("outer", "edge");
    }
}

// Initialize default color scheme:
// set_color_scheme("graph_paper");
set_color_scheme("underground");

/**
 * @return An array containing the string names of each color in the
 *     palette. These strings are valid subcategories for the "bright"
 *     and "dark" color scheme categories.
 */
export function palette() {
    return [
        "rd", // red
        "yl", // yellow
        "bl", // blue
        "pk", // pink
        "aq", // aqua
        "or", // orange
        "gn", // green
        "cr", // cream
        "lb", // light blue
        "lg", // lime green
        "pl", // purple
        "wt", // white
        "bk", // black
    ];
}

/**
 * Converts an RGB array of three numbers on [0, 1] into an array of
 * three HSV numbers. S and V will be on [0, 1], and H will be in
 * radians.
 *
 * @param rgb An array of three RGB values, each between 0 and 1.
 * @return An array of three HSV values, with S and V between 0 and 1 and
 *     H between 0 and 2π.
 */
export function RGB__HSV(rgb) {
    let r = rgb[0];
    let g = rgb[1];
    let b = rgb[2];

    let min = Math.min(r, g, b);
    let max = Math.max(r, g, b);

    let result = [null, null, null];

    let v = max; // value from brightest single component

    let delta = max - min;

    if (max == 0) {
        return [0, 0, 0]; // default hue is 0
    }

    let s = delta / max; // saturation from max/min gap

    // Figure out hue in terms of 60-degree units:
    let h;
    if (r >= max) { // red-dominant
        h = (g - b) / delta;
    } else if (g >= max) { // green-dominant
        h = 2 + (b - r) / delta;
    } else { // blue dominant
        h = 4 + (r - g) / delta;
    }

    // convert to radians:
    h *= Math.PI/3;

    if (h < 0) {
        h += 2*Math.PI;
    }

    return [h, s, v];
}

/**
 * Returns an RGB array on [0, 1] for the color with the given hue,
 * saturation, and value (given as an array of three numbers). Hue should
 * be in radians, and both s and v should be in [0, 1].
 *
 * @param hsv An array of three HSV values, with H between 0 and 2π and S
 *     and V each between 0 and 1.
 * @return An array of three RGB values, each between 0 and 1.
 */
export function HSV__RGB(hsv) {
    let h = hsv[0];
    let s = hsv[1];
    let v = hsv[2];

    // bin and fractional part of hue:
    let units = h / (Math.PI/3);
    let bin = Math.floor(units);
    let frac = units - bin;

    // brightnesses
    let baseline = v * (1 - s); // goes to 0 as sat -> 1
    let near = v * (1 - (s * frac)); // higher when frac is lower
    let far = v * (1 - (s * (1 - frac))); // higher when frac is higher

    // check hue region:
    bin = bin % 6;
    let r, g, b;
    if (bin == 0) {
        // red -> yellow
        return [v, far, baseline];
    } else if (bin == 1) {
        // yellow -> green
        return [near, v, baseline];
    } else if (bin == 2) {
        // green -> cyan
        return [baseline, v, far];
    } else if (bin == 3) {
        // cyan -> blue
        return [baseline, near, v];
    } else if (bin == 4) {
        // blue -> magenta
        return [far, baseline, v];
    } else { // bin == 5
        // magenta -> red
        return [v, baseline, near];
    }
}

/*
 * TODO: Real tests!
 console.log("red: " + RGB__HEX(HSV__RGB([0, 1, 1])));
 console.log("white: " + RGB__HEX(HSV__RGB([0, 0, 1])));
 console.log("gray: " + RGB__HEX(HSV__RGB([0, 0, 0.5])));
 console.log("orange: " + RGB__HEX(HSV__RGB([Math.PI/6, 1, 0.5])));
 console.log("yellow: " + RGB__HEX(HSV__RGB([Math.PI/3, 1, 0.5])));
 console.log("lime: " + RGB__HEX(HSV__RGB([Math.PI/2, 1, 0.5])));
 console.log("green: " + RGB__HEX(HSV__RGB([2*Math.PI/3, 1, 0.5])));
 console.log("green: " + RGB__HEX(HSV__RGB([2*Math.PI/3, 1, 0.75])));
 console.log("green: " + RGB__HEX(HSV__RGB([2*Math.PI/3, 1, 1.0])));
 console.log("gray-green: " + RGB__HEX(HSV__RGB([2*Math.PI/3, 0.5, 1.0])));
 */

/**
 * Converts an RGB color array on [0, 1] into a hex color string.
 *
 * @param rgb An array of three R/G/B values each between 0 and 1.
 * @return A hex color string, starting with '#' followed by six hex
 *     digits which specify three two-digit R/G/B values between 0 and
 *     255.
 */
export function RGB__HEX(rgb) {
    let r = Math.floor(255 * rgb[0]);
    let g = Math.floor(255 * rgb[1]);
    let b = Math.floor(255 * rgb[2]);

    let rs = r.toString(16);
    if (rs.length < 2) { rs = '0' + rs; }
    let gs = g.toString(16);
    if (gs.length < 2) { gs = '0' + gs; }
    let bs = b.toString(16);
    if (bs.length < 2) { bs = '0' + bs; }

    return '#' + rs + gs + bs;
}

/**
 * Converts a HEX string to an RGB triple. RGB values are on [0, 1].
 *
 * @param hex A hex color string optionally starting with a '#' and
 *     containing six hex digits specifying red, green, and blue values
 *     using two digits each.
 *
 * @return An array containing three numerical RGB values each between 0
 *     and 1.
 */
export function HEX__RGB(hex) {
    if (hex[0] == '#') {
        hex = hex.slice(1);
    }

    let rs = hex.slice(0, 2);
    let gs = hex.slice(2, 4);
    let bs = hex.slice(4, 6);

    return [
        parseInt(rs, 16) / 255,
        parseInt(gs, 16) / 255,
        parseInt(bs, 16) / 255
    ];
}
