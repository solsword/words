// active.js
// Code for keeping track of active elements, their types, their effects,
// etc.

import * as anarchy from "../anarchy.mjs";
import * as colors from "./colors.js";

export var ELEMENT_TYPES = [
    "🔑",
    "📄",
    "♻",
    "🖌",
    "🌱",
    "🌼",
    "💬",
    "🔍",
    "🔆",
    "🔧",
    "🔔",
    "🌈",
    "🌍",
    "🌎",
    "🌏"
];

export var LINK_TYPES = ["🔗", "🌀", "🚪" ];

/**
 * The basic types of energy.
 */
export var BASIC_ENERGIES = "红黄蓝";

/**
 * The hybrid energy types.
 */
export var HYBRID_ENERGIES = "橙紫绿白";

/**
 * Which basic energies is each combined energy type made of?
 */
var ENERGY_COMPOSITIONS = {
    "空": "",
    "红": "红",
    "黄": "黄",
    "蓝": "蓝",
    "橙": "红黄",
    "紫": "红蓝",
    "绿": "黄蓝",
    "白": "红黄蓝",
};

/**
 * The results of adding two different energies together.
 */
var ENERGY_ADD = {
    // combinations -> 2x energies
    "红黄": "橙",
    "黄红": "橙",

    "红蓝": "紫",
    "蓝红": "紫",

    "黄蓝": "绿",
    "蓝黄": "绿",

    // redundant energies -> no effect
    "红橙": "橙",
    "橙红": "橙",
    "橙黄": "橙",
    "黄橙": "橙",

    "红紫": "紫",
    "紫红": "紫",
    "紫蓝": "紫",
    "蓝紫": "紫",

    "黄绿": "绿",
    "绿黄": "绿",
    "绿蓝": "绿",
    "蓝绿": "绿",

    // triples -> white
    "红黄蓝": "白",
    "黄红蓝": "白",
    "红蓝黄": "白",
    "黄蓝红": "白",
    "蓝红黄": "白",
    "蓝黄红": "白",

    // adding to white
    "红白": "白",
    "白红": "白",
    "白黄": "白",
    "黄白": "白",
    "蓝白": "白",
    "白蓝": "白",

    "白绿": "白",
    "绿白": "白",
    "白紫": "白",
    "紫白": "白",
    "白橙": "白",
    "橙白": "白",

    // completing 2x energies
    "红绿": "白",
    "绿红": "白",

    "黄紫": "白",
    "紫黄": "白",

    "蓝橙": "白",
    "橙蓝": "白",

    // adding empty
    "空红": "红",
    "红空": "红",
    "空黄": "黄",
    "黄空": "黄",
    "空蓝": "蓝",
    "蓝空": "蓝",

    "空绿": "绿",
    "绿空": "绿",
    "空紫": "紫",
    "紫空": "紫",
    "空橙": "橙",
    "橙空": "橙",

    "空白": "白",
    "白空": "白",
};

/**
 * The results of subtracting one energy from another.
 */
var ENERGY_SUBTRACT = {
    // subtractions from white
    "白红": "绿",
    "白黄": "紫",
    "白蓝": "橙",

    "白绿": "红",
    "白紫": "黄",
    "白橙": "蓝",

    // subtractions from 2x energies
    "紫红": "蓝",
    "紫蓝": "红",

    "橙黄": "红",
    "橙红": "黄",

    "绿蓝": "黄",
    "绿黄": "蓝",

    // subtractions to empty
    "白白": "空",

    "红红": "空",
    "黄黄": "空",
    "蓝蓝": "空",

    "绿绿": "空",
    "紫紫": "空",
    "橙橙": "空",

    "空空": "空",
};

/**
 * Takes just a seed value and returns a random resource
 * character.
 *
 * @param seed An integer seed that determines the outcome.
 *
 * @return A one-character string chosen randomly from the ELEMENT_TYPES
 *     list.
 */
export function random_element(seed) {
    seed = anarchy.lfsr(seed + 7492374);
    return ELEMENT_TYPES[anarchy.idist(seed, 0, ELEMENT_TYPES.length)];
}

/**
 * Takes just a seed value and returns a random energy type.
 *
 * @param seed An integer seed that determines the outcome.
 *
 * @return A one-character string denoting a random energy type. 90% of
 * the time this will be a basic energy type, and 10% of the time it will
 * be a compound energy type composed from two basic energies.
 */
export function random_energy(seed) {
    let r = anarchy.lfsr(seed + 5986912731);
    if (anarchy.flip(0.9, seed)) { // a basic energy 90% of the time
        return BASIC_ENERGIES[anarchy.posmod(r, BASIC_ENERGIES.length)];
    } else {
        let idx1 = anarchy.idist(r, 0, BASIC_ENERGIES.length);
        let e1 = BASIC_ENERGIES[idx1];
        r = anarchy.prng(r, seed);
        let idx2 = anarchy.posmod(
            idx1 + 1 + anarchy.idist(r, 0, BASIC_ENERGIES.length - 1),
            BASIC_ENERGIES.length
        );
        let e2 = BASIC_ENERGIES[idx2]; 
        if (ENERGY_ADD[e1 + e2] == undefined) {
            console.warn(
                "Undefined energy addition: '" + (e1 + e2) + "'"
            );
        }
        return ENERGY_ADD[e1 + e2];
    }
}

/**
 * Whether the given element glyph is an energy element or not.
 *
 * @param elem_glyph An active element glyph string.
 *
 * @return True if the given glyph is one of the energy types, false
 *     otherwise.
 */
export function is_energy(elem_glyph) {
    return (
        BASIC_ENERGIES.indexOf(elem_glyph) >= 0
     || HYBRID_ENERGIES.indexOf(elem_glyph) >= 0
    );
}

/**
 * Takes a list of energy glyphs and returns a single energy
 * glyph describing their combined energy.
 *
 * @param energies An array of energy glyphs.
 * 
 * @return A single energy glyph (a one-character string) describing the
 *     result of combining those component energies.
 */
export function combined_energy(energies) {
    let result = "空";
    for (let energy of energies) {
        let cmb = result + energy;
        if (ENERGY_ADD.hasOwnProperty(cmb)) {
            result = ENERGY_ADD[cmb];
        }
    }
    return result;
}

/**
 * Returns True if the given combined energy contains the
 * given energy aspect. So for example. White contains all
 * aspects, including itself, whereas orange contains orange,
 * red, and yellow, but not blue, green, or purple.
 *
 * Empty (空) contains no aspects, except itself, and every
 * aspect contains empty.
 *
 * @param combined_energy A one-character energy glyph string.
 * @param energy_aspect Another one-character energy glyph string.
 *
 * @return True if the given combined energy type contains the given
 *     aspect as a component.
 */
export function energy_contains(combined_energy, energy_aspect) {
    if (energy_aspect == "空") {
        return true;
    }

    comb_comp = ENERGY_COMPOSITIONS[combined_energy];
    asp_comp = ENERGY_COMPOSITIONS[energy_aspect];
    for (let e of asp_comp) {
        if (comb_comp.indexOf(e) < 0) {
            return false;
        }
    }
    return true;
}

/**
 * Returns True if the given energy glyph (e.g., a combined
 * energy) is not 空 (empty).
 *
 * @param energy_glyph A one-character energy glyph string.
 *
 * @return True if that glyph is not '空'.
 */
export function has_energy(energy_glyph) {
    return energy_glyph != "空";
} 

/**
 * Takes an energy glyph and returns the corresponding palette
 * color (an RGB hex color string).
 */
export function energy_color(energy_glyph, energized) {
    if (energized) {
        fetch = subcat => colors.scheme_color("bright", subcat);
    } else {
        fetch = subcat => colors.scheme_color("dark", subcat);
    }
    if (energy_glyph == "红") {
        return fetch("rd");
    } else if (energy_glyph == "黄") {
        return fetch("yl");
    } else if (energy_glyph == "蓝") {
        return fetch("bl");
    } else if (energy_glyph == "橙") {
        return fetch("or");
    } else if (energy_glyph == "绿") {
        return fetch("gn");
    } else if (energy_glyph == "紫") {
        return fetch("pl");
    } else if (energy_glyph == "白") {
        return fetch("wt");
    } else { // 空 etc.
        return fetch("bk");
    }
}

/**
 * Returns the color for any kind of object, depending on
 * whether it's energized or not.
 *
 * @param elem_glyph The element glyph string.
 * @param energized Whether it's energized or not (a boolean).
 *
 * @return The color to be used for a tile containing the given active
 *     element.
 */
export function element_color(elem_glyph, energized) {
    if (is_energy(elem_glyph)) {
        // TODO: Energy states for colors!
        return energy_color(elem_glyph, true);
    } else if (energized) {
        return colors.scheme_color("tile", "unlocked-glyph");
    } else {
        // TODO: is this too inconspicuous?
        return colors.scheme_color("tile", "pad");
    }
}

/**
 * Whether the element is a connector or not.
 *
 * @param elem_glyph A glyph string identifying an active element.
 *
 * @return True if the active element is some kind of link.
 */
export function is_connector(elem_glyph) {
    return LINK_TYPES.indexOf(elem_glyph) >= 0;
}
