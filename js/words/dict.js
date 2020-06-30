// dict.js
// Manages domains and their associated dictionaries. For now, the
// 'dictionaries' do not include definitions.
/* global console, window */

"use strict";

import * as utils from "./utils.js";
import * as grid from "./grid.js";
import * as anarchy from "../anarchy.mjs";

// TODO: Import this when that becomes possible (see locale.js).
// import * as locale from "./locale.js";
/* global locale */

/**
 * Whether or not to issue console warnings.
 */
var WARNINGS = true;

/**
 * String used to mark the end of a string in an index.
 */
var EOS = ""; // jshint ignore:line

/**
 * Loaded domains, in-flight domains, and failed domains.
 */
export var DOMAINS = {};
export var LOADING = {};
export var FAILED = {};

/**
 * The number of bins in the domain frequency sumtable. Each bin corresponds
 * to the count of words with the given frequency (i.e., the first bin
 * contains the sum of the counts of words with frequency 1), except the last
 * bin, which contains all of the rest of the words. Accordingly, any word
 * with frequency greater than N-1 will be accumulated in the Nth bin.
 */
var DOMAIN_FREQUENCY_BINS = 256;
// TODO: Use a sparse table for better memory and time efficiency!

/**
 * The number of bins in the domain length sumtable. Each bin corresponds to
 * the count of words with the given length, except the last bin, which
 * contains all of the words at least as long as the number of bins.
 */
var DOMAIN_LENGTH_BINS = 36;

// URLS for the workers we're going to use to do stuff in the background.
var FINALIZE_URL = "js/words/workers/finalize_dict.js";
var STRINGIFY_URL = "js/words/workers/stringify.js";

/**
 * Looks up a domain by name.
 *
 * @param name A string: the name of the domain to look up.
 *
 * @return Undefined if the given domain has not been fully loaded yet,
 *     or the domain object with the given name. If there is no such
 *     domain, a warning will be printed in the console and undefined
 *     will be returned.
 */
export function lookup_domain(name) {
    if (name == undefined) {
        throw "Internal Error: Undefined name in lookup_domain.";
    }
    if (DOMAINS.hasOwnProperty(name)) {
        return DOMAINS[name];
    } else if (FAILED.hasOwnProperty(name)) {
        let emsg = "Internal Error: Unknown domain '" + name + "'";
        emsg += "\nKnown domains are:";
        for (let d of Object.keys(DOMAINS)) {
            emsg += "\n  " + d;
        }
        emsg += "\n...still-loading domains:";
        for (let d of Object.keys(LOADING)) {
            emsg += "\n  " + d;
        }
        emsg += "\n---";
        throw emsg;
    } else if (!LOADING.hasOwnProperty(name)) {
        load_dictionary(name);
        return undefined;
    }
}

/**
 * @param names An array of strings naming domains.
 * @return An array containing objects for each named domain, or
 *     undefined if any of the given domains is not yet loaded.
 */
export function lookup_domains(names) {
    var result = [];
    for (var i = 0; i < names.length; ++i) {
        var def = lookup_domain(names[i]);
        if (def == undefined) {
            return undefined;
        } else {
            result.push(def);
        }
    }
    return result;
}

/**
 * Takes a domain in name or full form and returns the name.
 *
 * @param domain A string naming a domain or a domain object.
 *
 * @return The same string if a string was given, or the name of the
 *     domain if a domain object was given.
 */
export function name_of(domain) {
    if ("" + domain === domain) {
        return domain;
    } else {
        return domain.name;
    }
}

/**
 * Takes a JSON object from a domain file and augments it before adding it
 * to DOMAINS.
 *
 * @param name The name of the domain (a string).
 * @param rough An object parsed from a JSON string that defines a
 *     domain. It should have the following keys:
 *
 *     name: A string naming the domain. Should match the given name.
 *     entries: An array of domain entries, which are 3-element arrays
 *         that include (by index):
 *         0: Either a string or a list of strings specifying the glyphs
 *             for a word,
 *         1: A string specifying the canonical appearance of that word.
 *         2: An integer indicating the frequency of that entry within
 *            the corpus used to construct the domain.
 *     length_ordering: An array containing all of the indices of the
 *         entries array, sorted by the number of glyphs in that entry.
 *     total_count: The sum of the frequencies of each entry in the
 *         domain (an integer).
 *     high_frequency_entries: The number of entries in the domain whose
 *         frequencies are >= DOMAIN_FREQUENCY_BINS.
 *     count_sums: A sum-table of the entry counts, in reverse order from
 *         highest to lowest frequency, where the first entry includes
 *         the sum of counts of all entries with frequency greater than
 *         or equal to DOMAIN_FREQUENCY_BINS. If constructed from a list
 *         of unique words, each entry except the last will be 0, and the
 *         last entry will be the number of entires in the domain. The
 *         first entry will be the sum of the frequencies of all of the
 *         high frequency entries.
 *     short_high_frequency_entries: The number of entries with
 *         frequencies >= DOMAIN_FREQUENCY_BINS which also are short
 *         enough to fit in a socket.
 *     short_count_sums: A sum-table of the entry counts of words that
 *         fit in sockets, in reverse order (as count_sums).
 *     length_sums: A sum-table of the entry lengths, starting with the
 *         shortest entries, so the index-0 element holds the sum of the
 *         frequencies of all length-1 entries (there are no length-0
 *         entries). The last entry in this table holds the sum of the
 *         frequencies of words whose lengths are >= DOMAIN_LENGTH_BINS.
 *     normlength: An array holding the index of every entry that can fit
 *         in a socket.
 *     overlength: An array holding the index of every entry which is too
 *         long to fit in a socket, but which can fit in a dedicated
 *         supertile.
 *     superlong: An array holding the index of every entry which is too
 *         long to fit even in an entire supertile. Hopefully this array
 *         is empty.
 *     locale: (optional) A string like "en-US" specifying a locale.
 *         Default is locale.DEFAULT_LOCALE.
 *     ordered: (optional) A boolean specifying whether glyph lists in
 *         the domain care about ordering or not. Default true.
 *     cased: (optional) A boolean specifying whether or not case matters
 *         for the domain. Default false.
 *     colors: (optional) An array of palette color identifiers (see
 *         colors.js) that apply to this domain. Default is [].
 *         TODO: Get rid of this?
 *
 * @return Nothing (undefined). This function sets in motion the final
 *     steps of the loading process, which will eventually add a new
 *     entry to the DOMAINS global variable, but that process will
 *     complete asynchronously (see polish_and_callback).
 */
export function finish_loading(name, rough) {
    if (DOMAINS.hasOwnProperty(name)) {
        console.warn("Not finalizing already-loaded domain: '" + name + "'.");
        return;
    }

    polish_and_callback(
        name,
        rough,
        function (progress) { LOADING[name][1] = progress; },
        function (progress) { LOADING[name][2] = progress; },
        function (name, processed) { add_domain(name, processed); }
    );
}

/**
 * Sets up a worker to polish the given JSON object, calling back on
 * counting progress, index progress, and when done. The progress callbacks
 * get a single number between 0 and 1 representing the progress in
 * counting or indexing. The finished callback gets two arguments, the
 * domain name and the finished JSON.
 *
 * @param name The name of the rough domain to be polished (a string).
 * @param rough A rough domain object (see finish_loading for details).
 * @param count_progress_callback A callback function which will be
 *     called repeatedly with a single numerical argument between 0 and 1
 *     indicating progress during the glyph-counting process.
 * @param index_progress_callback A callback function which will be
 *     called like the count_progress_callback to indicate progress
 *     during the index-building process.
 * @param finished_callback A callback function which will be called once
 *     with the domain name string and the finished domain object as
 *     arguments.
 *
 * @return Nothing (undefined). This function creates and starts a
 *     web-worker that will finalize the given rough domain in the
 *     background and call the specified callbacks as it does so. It will
 *     return immediately once the worker is launched. Use the
 *     finished_callback parameter if you need to do something once the
 *     domain is finalized.
 */
export function polish_and_callback(
    name,
    rough,
    count_progress_callback,
    index_progress_callback,
    finished_callback
) {

    //TODO: Use this version when worker module import support is
    // available.
    // var worker = new window.Worker(FINALIZE_URL, {'type': 'module'});
    var worker = new window.Worker(FINALIZE_URL);
    worker.onmessage = function (msg) {
        // Gets a name + finalized domain from the worker and adds the domain.
        if (msg.data == "worker_ready") { // initial ready message
            worker.postMessage([name, rough]); // hand over stuff to work on
        } else if (msg.data[0] == "count-progress") { // counting progress
            if (count_progress_callback) {
                count_progress_callback(msg.data[1]);
            }
        } else if (msg.data[0] == "index-progress") { // indexing progress
            if (index_progress_callback) {
                index_progress_callback(msg.data[1]);
            }
        } else { // finished message w/ product
            if (finished_callback) {
                finished_callback(msg.data[0], msg.data[1]);
            }
        }
    };
}

/**
 * Uses a web worker to turn the given object into a JSON string, and calls
 * the callback with the string result when ready.
 *
 * @param object An object to be turned into a JSON string. Must only
 *     contain values that can be turned into JSON (e.g., no functions
 *     allowed).
 *
 * @param callback A callback function which will be called when the
 *     JSON construction process is complete. It will get the resulting
 *     JSON string as its only argument.
 *
 * @return Nothing (undefined). This function creates a web worker to do
 *     the work in the background and returns immediately. Use the
 *     callback parameter to access the resulting JSON string.
 */
export function stringify_and_callback(object, callback) {
    // TODO: Use this version when worker module import support is
    // available.
    // let worker = new window.Worker(STRINGIFY_URL, {'type': 'module'});
    let worker = new window.Worker(STRINGIFY_URL);
    worker.onmessage = function (msg) {
        if (msg.data == "worker_ready") { // initial ready message
            worker.postMessage(object); // hand over object to stringify
        } else {
            callback(msg.data); // must be the final result
        }
    };
}

/**
 * Adds a domain, taking care of the necessary status checks/updates.
 *
 * @param name A string naming the domain. Should match the object's
 *     .name field.
 * @param polished_obj A polished domain object that includes glyph
 *     counts and an index. See polish_and_callback.
 *
 * @return Nothing (undefined). This function adds the given domain to
 *     the DOMAINS global variable and removes it from the LOADING and/or
 *     FAILED variables if it was in those.
 */
export function add_domain(name, polished_obj) {
    if (DOMAINS.hasOwnProperty(name)) {
        console.warn("Not adding already-loaded domain: '" + name + "'.");
        return;
    }

    DOMAINS[name] = polished_obj;
    if (LOADING.hasOwnProperty(name)) {
        delete LOADING[name];
    }
    if (FAILED.hasOwnProperty(name)) {
        delete FAILED[name];
    }
}

/**
 * Loads the dictionary for the given domain. Does nothing if that domain
 * is already loaded (or is currently being loaded). Puts the data into the
 * DOMAINS object. Counts glyph occurrences and builds an index if the
 * loaded domain doesn't have one, which may take some time.
 *
 * @param domain A string naming the domain to be loaded. Must be a
 *     domain name, not a combo name.
 * @param is_simple (optional) Whether to load the domain as a JSON
 *     pre-processed file or as a word-list simple file. If not given,
 *     the loading will be attempted assuming the data is available in
 *     JSON format, and will fall back to loading in simplified format if
 *     that doesn't work.
 */
export function load_dictionary(domain, is_simple) {
    if (domain == undefined) {
        throw "Internal Error: Undefined domain in load_dictionary.";
    }
    if (DOMAINS.hasOwnProperty(domain) || LOADING.hasOwnProperty(domain)) {
        return;
    }
    LOADING[domain] = [false, 0, 0]; // http-done, count-prog, index prog
    if (is_simple == undefined || !is_simple) {
        load_json_or_list(domain);
    } else {
        load_simple_word_list(domain);
    }
}

/**
 * Attempts to load a file "js/words/domains/<name>.json" and if it
 * can't or if there's some other error during that process, falls back
 * to load_simple_word_list.
 *
 * From:
 * https://codepen.io/KryptoniteDove/post/load-json-file-locally-using-pure-javascript
 * Use with Chrome and --allow-file-access-from-files to run locally.
 *
 * @param name The name of the domain to load, which also determines the
 *     filename that we look for.
 *
 * @return Nothing (undefined). This function calls finish_loading
 *     asynchronously when the HTTP request it makes is complete.
 */
export function load_json_or_list(name) {
    var xobj = new window.XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    var url = window.location.href;
    var path = url.substr(0, url.lastIndexOf('/'));
    var dpath = path + "/js/words/domains/" + name + ".json";

    // Load asynchronously
    xobj.open("GET", dpath);
    xobj.onload = function () {
        var successful = (
            xobj.status == 200
            || (xobj.status == 0 && dpath.startsWith("file://"))
        );
        if (!successful) {
            load_simple_word_list(name);
            return;
        }
        try {
            LOADING[name][0] = true;
            let rough = JSON.parse(xobj.responseText);
            finish_loading(name, rough);
        } catch (e) {
            load_simple_word_list(name);
            return;
        }
    };
    xobj.onerror = function () {
        load_simple_word_list(name);
    };
    try {
        xobj.send(null);
    } catch (e) {
        load_simple_word_list(name);
    }
}

/**
 * Loads JSON or string data as a domain with the given name, calling the
 * finisehd_callback with the name and processed data when done. The
 * progress and finished callbacks are passed to polish_and_callback as-is.
 *
 * @param name A string naming the domain that we're loading.
 * @param data A string of data, either in JSON format specifying a
 *     processed domain, or as a word list with one word per line.
 * @param count_progress_callback A function to be called during the
 *     polishing process (see polish_and_callback).
 * @param index_progress_callback A function to be called during the
 *     polishing process (see polish_and_callback).
 * @param finished_callback A function to be called once the polishing
 *     process is done (see polish_and_callback).
 *
 * @return Nothing (undefined). The loading process is asynchronous and
 *     the finished_callback function should be used to run code that
 *     uses the loaded domain.
 */
export function load_json_or_list_from_data(
    name,
    data,
    count_progress_callback,
    index_progress_callback,
    finished_callback
) {
    let rough;
    try {
        rough = JSON.parse(data);
    } catch (error) {
        rough = create_rough_domain_from_word_list(name, data);
    }
    polish_and_callback(
        name,
        rough,
        count_progress_callback,
        index_progress_callback,
        finished_callback
    );
}

/**
 * Hashes a name.
 *
 * @param name A string.
 * @return An integer hash value that's relatively unique to the string
 *     that was hashed.
 */
export function name_hash(name) {
    return anarchy.hash_string(name);
}

/**
 * Takes a word list and creates a JSON object to represent that word
 * list along with some pre-computed metrics and tables.
 *
 * @param name A string naming the domain.
 * @param list_text A multi-line string containing exactly one word per
 *     line, which may have lines at the top starting with '#' that
 *     contain directives. Lines with whitespace in them are ignored. A
 *     directive line has a key, then a ':', then a value, and alters
 *     properties of the resulting domain JSON. The 'colors' directive
 *     may supply a comma-separated list of palette color strings (like
 *     'yl') that apply to the domain; the 'ordered' and 'cased'
 *     directives may supply 'true' (or several variants) as a value to
 *     set those properties to true or any other value to set them to
 *     false, and all other directives simply add themselves as key/value
 *     pairs to the resulting JSON object.
 *
 *     In addition to a word, each line may include a comma followed by
 *     an integer that indicates the frequency of that word in a corpus,
 *     and before the comma, there may be an arrow ('→') followed by a
 *     display version of the word (what comes before the comma will be
 *     treated as individual glyphs that can be embedded in the grid, so
 *     for example for one flavor of Japanese you could use Hiragana
 *     before the arrow and Kanji + Hiragana after it. Note that multiple
 *     glyphs sequences might map to different words under this scheme.
 *
 * @return A rough domain object with the following keys:
 *      "name": The domain name.
 *      "locale": The domain locale string, e.g., "en-US"
 *      "ordered": Does order matter when building words? Default true.
 *      "cased": Does case matter? Default false.
 *      "colors": An array of color strings naming palette colors.
 *      "entries": An array of entries, each of which is a 3-element
 *          array containing a glyph-sequence string (the glyph sequence
 *          for a word), a result string (the display version of the
 *          word), and an integer (the word frequency).
 *      "length_ordering": An array containing each index from the
 *          entries list, sorted by the number of glyphs in that entry.
 *      "total_count": The sum of the frequencies of each word in the
 *          words list.
 *      "high_frequency_entries": The number of entries whose frequency
 *          is >= DOMAIN_FREQUENCY_BINS.
 *      "count_sums": A sumtable of the word frequencies, in reverse
 *          order (so the first bin is the number of words with frequency
 *          >= DOMAIN_FREQUENCY_BINS, while the last bin is the number of
 *          words with frequency >= 1).
 *      "short_high_frequency_entries": the number of short entries
 *          (entries which will fit into a single normal socket) whose
 *          frequency is >= DOMAIN_FREQUENCY_BINS.
 *      "short_count_sums": A second sumtable of word frequencies, this
 *          time only including words that can fit in a normal socket.
 *      "length_sums": A sumtable of word lengths, in forward order (so
 *          the first bin is the number of words of length <= 1, the
 *          second is the number of words of length <= 2, etc., and the
 *          last bin contains the total number of words.
 *      "normlength": An array containing the index of every entry which
 *          is short enough to fit into a normal socket.
 *      "overlength": An array containing the index of every entry which
 *          is too long to fit into a normal socket, but which is short
 *          enough to fit into a dedicated supertile.
 *      "superlong": An array containing the index of every entry which
 *          is too long to fit even in a dedicated supertile. Hopefully
 *          empty.
 */
export function create_rough_domain_from_word_list(name, list_text) {
    var words = list_text.split(/\n\r?/);
    var i = 0;
    while (words[i][0] == '#') {
        i += 1;
    }
    let directives;
    if (i > 0) {
        directives = words.slice(0,i);
        words = words.slice(i);
    } else {
        directives = [];
    }

    var entries = [];
    var total_count = 0;
    for (let w of words) {
        let bits = w.split(",");
        let word = bits[0];
        // Filter out 'words' that contain whitespace
        if (/\s+/.test(word)) { continue; }
        let freq = bits[1]; // might be 'undefined'
        bits = word.split("→");
        let glyphs = bits[0];
        word = bits[1]; // might be undefined
        if (word == undefined) { word = glyphs; }
        if (freq == undefined) {
            freq = 1;
        } else {
            freq = parseInt(freq);
        }
        if (glyphs == "") { continue; }
        entries.push([glyphs, word, freq]);
        total_count += freq;
    }
    // Sort by frequency
    entries.sort(function (a, b) {
        return b[2] - a[2]; // put most-frequent words first
    });
    // Argsort by length
    let by_length = utils.range(entries.length);
    by_length.sort(function (a, b) {
        return entries[a][0].length - entries[b][0].length;
        // indices of longest words first
    });
    // Create sumtables for frequency and length counts, as well as length
    // cumulative frequencies, ending with grouped bins for frequencies/lengths
    // over the cutoffs:
    var fq_counttable = [];
    var short_fq_counttable = [];
    var lt_counttable = [];
    for (let i = 0; i < DOMAIN_FREQUENCY_BINS; ++i) {
        fq_counttable[i] = 0;
        short_fq_counttable[i] = 0;
    }
    for (let i = 0; i < DOMAIN_LENGTH_BINS; ++i) {
        lt_counttable[i] = 0;
    }
    let hf_entries = 0;
    let short_hf_entries = 0;
    let freq = undefined;
    let len = undefined;
    let normlength = [];
    let overlength = [];
    let superlong = [];
    for (let i = 0; i < entries.length; ++i) {
        // count words by frequency and length
        freq = entries[i][2];
        len = entries[i][0].length;

        // populate our counttables for frequency
        if (freq >= DOMAIN_FREQUENCY_BINS) {
            if (len <= grid.SOCKET_SIZE) {
                short_fq_counttable[DOMAIN_FREQUENCY_BINS-1] += freq;
                short_hf_entries += 1;
            }
            fq_counttable[DOMAIN_FREQUENCY_BINS-1] += freq;
            hf_entries += 1;
        } else {
            if (len <= grid.SOCKET_SIZE) {
                short_fq_counttable[freq - 1] += freq;
            }
            fq_counttable[freq - 1] += freq;
        }

        // Categorize word as superlong, overlength, or normlength.
        // Because this loop is iterating over entries sorted by
        // frequency, each of these lists will also be sorted by
        // frequency.
        if (len >= grid.SUPERTILE_TILES - grid.SOCKET_SIZE/2 - 1) {
            // To fit into an overlength supertile, we must allow space
            // for one half-socket to be assigned another word, and for a
            // single tile to be reserved for an object.
            superlong.push(i);
        } else if (len > grid.SOCKET_SIZE) {
            overlength.push(i);
        } else {
            normlength.push(i);
        }

        // Add an entry to our length counttable for this word
        if (len >= DOMAIN_LENGTH_BINS) {
            lt_counttable[DOMAIN_LENGTH_BINS-1] += 1;
        } else {
            lt_counttable[len - 1] += 1;
        }
    }

    // Create frequency sumtables:
    var fq_sumtable = [];
    var short_fq_sumtable = [];
    var sum = 0;
    var short_sum = 0;
    for (let i = 0; i < DOMAIN_FREQUENCY_BINS; ++i) {
        // frequency sumtables are reversed (things
        // at-least-this-frequent starting with the most-frequent group
        // and proceeding to less-frequent groups)
        var j = DOMAIN_FREQUENCY_BINS - i - 1;
        // all-length words
        sum += fq_counttable[j];
        fq_sumtable[i] = sum;
        // short words
        short_sum += short_fq_counttable[j];
        short_fq_sumtable[i] = short_sum;
    }

    // Create length sumtable:
    var lt_sumtable = [];
    sum = 0;
    for (let i = 0; i < DOMAIN_LENGTH_BINS; ++i) {
        // length sumtable is normal (entries no-longer-than-this-plus-1)
        sum += lt_counttable[i];
        lt_sumtable[i] = sum;
    }

    var rough = {
        "name": name,
        "locale": "en-US",
        "ordered": true,
        "cased": false,
        "colors": [],
        "entries": entries,
        "length_ordering": by_length,
        "total_count": total_count,
        "high_frequency_entries": hf_entries,
        "count_sums": fq_sumtable,
        "short_high_frequency_entries": short_hf_entries,
        "short_count_sums": short_fq_sumtable,
        "length_sums": lt_sumtable,
        "normlength": normlength,
        "overlength": overlength,
        "superlong": superlong,
    };

    for (let d of directives) {
        let dbits = d.slice(1).split(":");
        let key = dbits[0].trim();
        let val = dbits[1].trim();
        if (key == "colors") {
            let colors = val.split(",");
            rough["colors"] = [];
            for (let c of colors) {
                rough["colors"].push(c.trim());
            }
        } else if (key == "ordered" || key == "cased") {
            rough[key] = [
                "true", "True", "TRUE",
                "yes", "Yes", "YES",
                "y", "Y"
            ].indexOf(val) >= 0;
        } else {
            rough[key] = dbits[1].trim();
        }
    }

    return rough;
}

/**
 * Asynchronously loads a simple words list from a URL.
 * Use with Chrome and --allow-file-access-from-files to run locally.
 *
 * @param name The name of the domain to load; determines the URL to
 *     access (/js/words/domains/<name>.lst).
 */
export function load_simple_word_list(name) {
    if (name == undefined) {
        throw "Internal Error: Undefined name in load_simple_word_list!";
    }

    var xobj = new window.XMLHttpRequest();
    xobj.overrideMimeType("text/plain");
    var url = window.location.href;
    var path = url.substr(0, url.lastIndexOf('/'));
    var dpath = path + "/js/words/domains/" + name + ".lst";

    // Load asynchronously
    xobj.open("GET", dpath);
    xobj.onload = function () {
        var successful = (
            xobj.status == 200
            || (xobj.status == 0 && dpath.startsWith("file://"))
        );
        if (!successful) {
            if (LOADING.hasOwnProperty(name)) { delete LOADING[name]; }
            FAILED[name] = true;
            throw (
                "Internal Error: Failed to fetch domain '" + name + "'"
              + "\n  Response code: " + xobj.status
              + "\n  Response content:\n" + xobj.responseText.slice(0,80)
            );
        }
        LOADING[name][0] = true;
        var rough = create_rough_domain_from_word_list(name, xobj.responseText);
        finish_loading(name, rough);
    };
    try {
        xobj.send(null);
    } catch (e) {
        if (LOADING.hasOwnProperty(name)) { delete LOADING[name]; }
        FAILED[name] = true;
        console.error(e);
        throw "Internal Error: XMLHttpRequest failed for domain '" + name + "'";
    }
}

/**
 * Returns a list of (domain_name, index, glyphs, word, frequency)
 * quadruples that match the given glyphs in one of the given domains.
 * The list will be empty if there are no matches.
 *
 * @param glyphs Either a string or an array of single-glyph strings
 *     specifying the glyph sequence to look for.
 * @param domains An array of domain objects to look for matches in.
 */
export function check_word(glyphs, domains) {
    var matches = [];
    for (let domain of domains) {
        let indom = find_word_in_domain(glyphs, domain);
        for (let match of indom) {
            matches.push([name_of(domain), ...match]);
        }
    }
    return matches;
}

/**
 * Finds the given glyph sequence in the given domain. Returns an array of
 * matches, each of which consists of a domain index, a glyphs string, a
 * canonical word, and a frequency count for that word. Returns an empty
 * array if there are no matches.
 *
 * @param glyphs An array of single-glyph strings or a string where each
 *     character is a glyph.
 * @param domain A domain name or domain object (but not a combo).
 *
 * @return A (possibly empty) array of 4-element arrays which each
 *    contain an index in the domain entries array, followed by the
 *    contents of that entry (a glyphs string, a word string, and a
 *    frequency integer). Each result in this array corresponds to an
 *    entry that matches the given glyphs sequence. The array will be
 *    empty when there are no matches.
 */
export function find_word_in_domain(glyphs, domain) {
    // Lookup domain by name if we were given a string.
    var dom = domain;
    if ("" + dom === dom) {
        dom = lookup_domain(dom);
        if (dom == undefined) {
            throw "Internal Error: unknown domain '" + domain + "'";
        }
    }

    // For unordered domains, sort glyphs so that indexing will work
    if (!dom.ordered) {
        if (!Array.isArray(glyphs)) {
            glyphs = glyphs.split("");
        }
        glyphs = glyphs.slice();
        glyphs.sort();
    }
    // Turn the array into a string:
    if (Array.isArray(glyphs)) {
        glyphs = glyphs.join("");
    }

    // For uncased domains, convert the glyph sequence to upper case:
    if (!dom.cased) {
        glyphs = locale.lc_upper(glyphs, dom.locale);
    }

    var original = glyphs;

    // Now search the domain's index:
    var index = dom.index;
    var g = glyphs[0];
    var i = 0;
    while (index.hasOwnProperty(g)) {
        index = index[g];
        i += 1;
        g = glyphs[i];

        if (g == undefined) {
            // no more glyphs to use
            g = null;
            break;
        }
        if (Array.isArray(index)) {
            // no more indices to search
            break;
        }
    }

    var result = [];
    // multiple words in this index bucket
    if (Array.isArray(index)) {
        for (let i = 0; i < index.length; ++i) {
            var idx = index[i]; // index in entries list
            var test_entry = dom.entries[idx];
            var against = test_entry[0];
            // TODO: Permit any ordering in domain files for unordered domains?
            if (!dom.cased) {
                against = locale.lc_upper(against, dom.locale);
            }
            if (against == original) {
                result.push([idx, ...test_entry]);
            }
        }
    } else if (g == null) {
        if (index.hasOwnProperty(EOS)) {
            for (let i = 0; i < index[EOS].length; ++i) {
                let idx = index[EOS][i];
                let test_entry = dom.entries[idx];
                let against = test_entry[0];
                if (!dom.cased) {
                    against = locale.lc_upper(against, dom.locale);
                }
                if (against == original) {
                    result.push([idx, ...test_entry]);
                }
            }
        } else {
            // word prefix
            return [];
        }
    } else {
        // word + suffix or just a non-word
        return [];
    }

    return result;
}

/**
 * Finds the nth word in the given domain, where each word is repeated
 * according to its frequency. The words are sorted by frequency, so lower
 * values of n will tend to return more-common words. Time taken is at
 * worst proportional to the number of high-frequency words in the domain,
 * or the number of explicit bins (DOMAIN_FREQUENCY_BINS, which is fixed).
 *
 * Note that n will be wrapped to fit into the total word count of the
 * domain.
 *
 * @param n An integer index identifying which word to select.
 * @param domain A domain object (not just a domain name).
 *
 * @return A 3-element [glyphs, word, frequency] array.
 */
export function unrolled_word(n, domain) {
    n %= domain.total_count;
    if (n < domain.count_sums[0]) {
        // We're within the high-frequency realm, and must iterate over entries
        // to find our index:
        for (let i = 0; i < domain.high_frequency_entries; ++i) {
            let e = domain.entries[i];
            n -= e[2];
            if (n < 0) {
                return e;
            }
        }
    } else {
        // We're in an indexed realm, and must iterate over bins to find our
        // index:
        let offset = domain.high_frequency_entries;
        for (var i = 1; i < DOMAIN_FREQUENCY_BINS; ++i) {
            // The i-th bin represents words that appear
            // DOMAIN_FREQUENCY_BINS - i times in our domain:
            let count = DOMAIN_FREQUENCY_BINS - i;
            if (n < domain.count_sums[i]) { // it's in this bin
                let inside = n - domain.count_sums[i-1];
                let idx = offset + Math.floor(inside / count);
                return domain.entries[idx];
            } else {
                // it's not in this bin, so adjust our offset
                offset += Math.floor(
                    (domain.count_sums[i] - domain.count_sums[i-1])
                    / count
                );
            }
        }
    }
    if (WARNINGS) {
        console.warn(
            "WARNING: unexpectedly dodged both cases in unrolled_word!\n"
            + "  (n is " + n + " and the domain is '" + domain.name + "')"
        );
    }
    // default to the most-frequent entry in this should-be-impossible case:
    return domain.entries[0];
}

/**
 * Finds the nth short word in the given domain, where each word is
 * repeated according to its frequency. The words are sorted by frequency,
 * so lower values of n will tend to return more-common words. Time taken
 * is at worst proportional to the number of high-frequency words in the
 * domain, or the number of explicit bins (DOMAIN_FREQUENCY_BINS, which is
 * fixed).
 *
 * Note that n will be wrapped to fit into the total word count of the
 * domain.
 *
 * @param n An integer identifying which word-copy to extract.
 * @param domain A domain object (not just a name).
 *
 * @return A 3-element [glyphs, word, frequency] array.
 */
export function unrolled_short_word(n, domain) {
    n %= domain.short_count_sums[DOMAIN_FREQUENCY_BINS - 1];
    if (n < domain.short_count_sums[0]) {
        // In this case, we're within the realm of the most-frequent
        // words, which are each appear more than DOMAIN_FREQUENCY_BINS
        // times. We need to iterate to find our target.
        for (var i = 0; i < domain.short_high_frequency_entries; ++i) {
            var e = domain.entries[domain.normlength[i]];
            n -= e[2];
            if (n < 0) {
                return e;
            }
        }
    } else {
        // In this case, we're within some other part of the
        // short-words-binned-by-frequency realm.
        let offset = domain.short_high_frequency_entries;
        for (let i = 1; i < DOMAIN_FREQUENCY_BINS; ++i) {
            // The i-th bin represents words that appear
            // DOMAIN_FREQUENCY_BINS - i times in our domain:
            let count = DOMAIN_FREQUENCY_BINS - i;
            if (n < domain.short_count_sums[i]) { // it's in this bin
                let inside = n - domain.short_count_sums[i-1];
                let idx = offset + Math.floor(inside / count);
                return domain.entries[domain.normlength[idx]];
            } else {
                // it's not in this bin, so adjust our offset
                offset += Math.floor(
                    (domain.short_count_sums[i] - domain.short_count_sums[i-1])
                    / count
                );
            }
        }
    }
    if (WARNINGS) {
        console.warn(
            "WARNING: unexpectedly dodged both cases in unrolled_short_word!\n"
            + "  (n is " + n + " and the domain is '" + domain.name + "')"
        );
    }
    // default to the most-frequent entry in this should-be-impossible case:
    return domain.entries[0];
}


/**
 * Returns the number of words in the given domain that are no longer than
 * the given length. Note: this will be inefficient if there are lots of
 * words longer than DOMAIN_LENGTH_BINS glyphs long and the given limit
 * is also longer than DOMAIN_LENGTH_BINS.
 *
 * Note: this function counts domain entries, not the sum of their
 * frequencies.
 *
 * @param domain A domain object (not just a name).
 * @param L the desired length limit (must be an integer).
 *
 * @return An integer number of domain entries whose glyph sequences are
 *     no longer than the given limit; possibly 0 (always 0 when L <= 0).
 */
export function words_no_longer_than(domain, L) {
    if (L <= 0) {
        return 0;
    } else if (L - 1 < DOMAIN_LENGTH_BINS - 1) {
        return domain.length_sums[L - 1];
    } else {
        let count = domain.length_sums[DOMAIN_LENGTH_BINS - 2];
        for (let i = count; i < domain.length_ordering.length; ++i) {
            let len = domain.entries[domain.length_ordering[i]][0].length;
            if (len > L) {
                return count;
            } else {
                count += 1;
            }
        }
        return count;
    }
}

/**
 * Returns the nth word no longer than L glyphs in the given domain. N is
 * wrapped to fit in the appropriate number for words_no_longer_than.
 * Undefined is returned if there are no words in the domain short enough.
 *
 * @param domain A domain object (not just a name).
 * @param L The integer length limit.
 * @param n An integer that determines which word to select.
 *
 * @return A 3-element [glyphs, word, frequency] array.
 */
export function nth_short_word(domain, L, n) {
    let max = words_no_longer_than(domain, L);
    if (max == 0) {
        return undefined;
    }
    n %= max;
    return domain.entries[domain.length_ordering[n]];
}
