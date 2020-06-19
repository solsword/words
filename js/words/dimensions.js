// dimensions.js
// Dimension handling code.

import * as anarchy from "../anarchy.js";
import * as util from "./util.js";

/**
 * Number of possible connections from each plane:
 */
var MULTIPLANAR_CONNECTIONS = 64;

/**
 * A list of all available domains.
 * TODO: Better here (we'd like this to be more dynamic maybe?)!
 */
var MULTIPLANAR_DOMAINS = [
    "English",
    "成语",
    "عربى",
    //"かんたんなひらがな", // DEBUG TODO
    "ひらがな",
    "türk",
    //"اللغة_العربية_الفصحى", //Too large for demo
];

/**
 * The different kinds of dimensions. Includes full IDs and one-letter
 * abbreviations for use in cache-key-building.
 */
var DIMENSION_KINDS = {
    "F": "full",
    "full": "F",
    "P": "pocket",
    "pocket": "P",
    "C": "custom",
    "custom": "C",
}

/**
 * The different possible layout values for each kind of dimension,
 * along with their one-letter abbreviations.
 */
var DIMENSION_LAYOUTS = {
    "full": {
        "S": "simple",
        "simple": "S",
        "E": "easy",
        "easy": "E",
        "R": "reasonable",
        "reasonable": "R",
        "H": "hard",
        "hard": "H",
    },
    "pocket": {
        "C": "compact",
        "compact": "C",
        "D": "dense",
        "dense": "D",
        "L": "loose",
        "loose": "L",
        "S": "scattered",
        "scattered": "S",
    },
    "custom": {
        "C": "compact",
        "compact": "C",
        "D": "dense",
        "dense": "D",
        "L": "loose",
        "loose": "L",
        "scattered": "S",
        "S": "scattered",
    },
};

/**
 * The different possible flavor values for each kind of dimension.
 * Includes full terms and abbreviations.
 */
var DIMENSION_FLAVORS = {
    "pocket": {
        "B": "bare",
        "bare": "B",
        "F": "full",
        "full": "F",
        "R": "round",
        "round": "R",
    },
    "custom": {
        "B": "bare",
        "bare": "B",
        "F": "full",
        "full": "F",
        "R": "round",
        "round": "R",
    },
};

/**
 * Creates a string key that uniquely identifies a given dimension.
 *
 * @param d The dimension object to create a key for.
 *
 * @return A string key unique to the given dimension.
 */
export function dim__key(d) {
    let k = DIMENSION_KINDS[d.kind];
    let l = DIMENSION_LAYOUTS[d.kind][d.layout];
    let result = k + "/" + l;
    if (d.kind != "full") {
        let f = DIMENSION_FLAVORS[d.kind][d.flavor];
        result += "/" + f;
    }
    result += "#" + d.seed + ":" + d.domain
        if (d.kind == "custom") {
            for (let w of d.words) {
                result += "," + w;
            }
        }
    return result;
}

/**
 * Takes a string key that identifies a dimension and reconstructs a
 * new dimension object that matches that key.
 *
 * @param k A dimension key string (see dim__key).
 *
 * @return A new dimension object that matches the given key. The
 *     result will have the following properties:
 *         'kind': What kind of dimension this is (a full string).
 *         'layout': The layout of this dimension (a full string).
 *         'flavor': The flavor of this dimension (only present in
 *             non-full dimensions; a full string).
 *         'domain': A string identifying the domain of this dimension.
 *         'seed': The seed for this dimension (a number).
 *         'words': For 'custom' dimensions, an array of strings
 *             specifying the particular words that will be used in
 *             this dimension.
 *
 */
export function key__dim(k) {
    let kind = DIMENSION_KINDS[k[0]];
    let layout = DIMENSION_KINDS[kind][k[2]];
    let result = {
        "kind": kind,
        "layout": layout,
    }
    if (kind != "full") {
        result["flavor"] = DIMENSION_FLAVORS[kind][k[4]];
    }
    let seed = "";
    let domain = "";
    let thisword = "";
    let words = [];
    let mode = "preseed";
    for (let i = 0; i < k.length; ++i) {
        if (mode == "preseed") {
            if (k[i] == "#") {
                mode = "seed";
            }
        } else if (mode == "seed") {
            if (k[i] == ":") {
                mode = "domain"
            } else {
                seed += k[i];
            }
        } else if (mode == "domain") {
            if (k[i] == ",") {
                mode = "words"
            } else {
                domain += k[i];
            }
        } else if (mode == "words") {
            if (k[i] == ",") {
                words.push(thisword);
                thisword = "";
            } else {
                thisword += k[i];
            }
        }
    }
    words.push(thisword);
    result["domain"] = domain;
    result["seed"] = Number.parseInt(seed);
    if (this.kind == "custom") {
        result["words"] = words;
    }
    return result;
}

/**
 * Since dimension objects may be turned into keys and then back into
 * objects, this function tests whether two dimension objects refer to
 * the same dimension or not.
 *
 * @param d1 The first dimension object.
 * @param d2 The second dimension object.
 *
 * @return True if both objects denote the same dimension; false if not.
 */
export function same(d1, d2) {
    // Whether two dimensions are the same or not.
    return utils.equivalent(d1, d2);
}

/**
 * @param dimension A dimension object.
 * @return The full string for the kind of a dimension.
 */
export function kind(dimension) {
    return dimension.kind;
}

/**
 * @param dimension A dimension object.
 * @return The full string for the layout of a dimension.
 */
export function layout(dimension) {
    return dimension.layout;
}

/**
 * @param dimension A dimension object.
 * @return The full string for the flavor of a dimension, or undefined if
 *     it's a full dimension (full dimensions don't have flavors).
 */
export function flavor(dimension) {
    return dimension.flavor;
}

/**
 * @param dimension A dimension object.
 * @return A string identifying the natural domain of the dimension.
 */
export function natural_domain(dimension) {
    return dimension.domain;
}

/**
 * @param dimension A dimension object.
 * @return An integer seed for that dimension.
 */
export function seed(dimension) {
    return dimension.seed;
}

/**
 * Counts the number of words that were used as the basis of a pocket
 * dimension.
 *
 * @param dimension A dimension object.
 * @return An integer number of words, or NaN for a full dimension.
 */
export function pocket_word_count(dimension) {
    if (dimension.kind == "pocket") {
        // TODO: HERE
        return 0;
    } else if (dimension.kind == "custom") {
        return dimension.words.length;
    } else {
        return NaN;
    }
}

/**
 * Retrieves basis words for pocket dimensions.
 *
 * @param dimension A dimension object.
 * @param n An integer specifying which word to retrieve. Should be
 *     in-range according to the result of pocket_word_count.
 *
 * @return The specified basis word of the given dimension (a string) or
 *     undefined if the dimension is a full dimension (and thus does not
 *     have basis words).
 */
export function pocket_nth_word(dimension, n) {
    if (dimension.kind == "pocket") {
        // TODO: HERE
        console.log("pocket_nth_word needs implementation!");
        return "huh";
    } else if (dimension.kind == "custom") {
        return dimension.words[n];
    } else {
        return undefined;
    }
}

/**
 * Returns an array containing glyph arrays for each of the basis words
 * for the given dimension. Will return an empty array for full
 * dimensions, which do not have basis word arrays.
 *
 * @param dimension The dimension object to extract words from.
 *
 * @return An array of glyph arrays specifying the glyph components of
 *     each basis word for the given pocket or custom dimension, or an
 *     empty array if given a full dimension.
 */
export function pocket_words(dimension) {
    let result = [];
    for (let i = 0; i < pocket_word_count(dimension); ++i) {
        let str = pocket_nth_word(dimension, i);
        result.push(utils.string__array(str));
    }
    return result;
}

/**
 * Returns a fresh dimension object representing the dimension that
 * neighbors the given dimension at the given offset. Neighboring
 * dimensions mostly use different domains than each other.
 *
 * @param dimension The dimension object to find a neighbor of.
 * @param offset An integer that's less than MULTIPLANAR_CONNECTIONS
 *     selecting which neighbor we're interested in.
 *
 * @return A new dimension object (see key__dim) representing a
 *     neighboring dimension.
 */
export function neighboring_dimension(dimension, offset) {
    let nd = natural_domain(dimension);
    let i = MULTIPLANAR_DOMAINS.indexOf(nd);
    return {
        "kind": kind(dimension),
        "layout": layout(dimension),
        "domain": MULTIPLANAR_DOMAINS[
            anarchy.posmod((i + offset), MULTIPLANAR_DOMAINS.length)
        ],
        // TODO: Seed pairing
        "seed": seed(dimension),
    }
}

/**
 * Determines the shape associated with a given domain.
 *
 * @param domain The domain ID (a string; see MULTIPLANAR_DOMAINS).
 *
 * @return An array of four integers specifying the seeds for the top,
 *     bottom, side, and corner shapes for the given domain.
 */
export function shape_for(domain) {
    let seed = 19803129;
    let x = MULTIPLANAR_DOMAINS.indexOf(domain);
    x ^= 1092830198;
    for (var i = 0; i < 4; ++i) {
        x = anarchy.lfsr(x);
    }
    var t_shape = x >>> 0;
    x = anarchy.prng(x, seed);
    var b_shape = x >>> 0;
    x = anarchy.prng(x, seed);
    var v_shape = x >>> 0;
    x = anarchy.prng(x, seed);
    var c_shape = x >>> 0;
    return [
        t_shape,
        b_shape,
        v_shape,
        c_shape
    ];
}
