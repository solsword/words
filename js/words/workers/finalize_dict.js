// Because cross-browser support for importing modules from within
// workers is not available yet, we'll use importScripts as a hack...
// Thank goodness neither of these modules themselves imports anything
// else, or we'd be back to square 1 T_T.
// Hopefully you who is reading this right now a few years from when it
// was written are about to remove it!
importScripts("../locale.js")

// TODO: This is what we should do once we can import modules from within
// web workers across (at least a few) browsers:
/*
import * as locale from "../locale.js";
*/

const INDEX_DEPTH_LIMIT = 7;
const INDEX_BIN_SIZE = 64;

/**
 * Creates an index on the position-th glyphs from each of the given
 * entries, picked out from the full list by the indices array. Calls
 * itself recursively until INDEX_BIN_SIZE is satisfied or
 * INDEX_DEPTH_LIMIT is met. Returns an object mapping glyphs to
 * sub-indices or an array for terminal entries. Each object result
 * includes a "_count_" key indicating the total entries under that
 * index.
 *
 * This function posts progress messages as it runs containing 2-element
 * arrays where the first element is the string "index-progress" and the
 * second is a number between 0 and 1 indicating progress in building the
 * index.
 *
 * @param entries An array of domain entries, which are 3-element arrays
 *     containing a glyphs string, a word string, and a frequency
 *     integer. We use the glyphs strings to build the index because
 *     those are the search terms the index will be used with.
 * @param indices An array of integer indices into the entries list; only
 *     those entries will be included in the resulting index.
 * @param position An integer indicating which glyph from each glyph
 *     sequence in the given entries to use for the index. As the
 *     recursion plays out, this number will advance from 0 to
 *     INDEX_DEPTH_LIMIT.
 *
 * @return An object with a "_count_" key and one additional key for each
 *     of the glyphs that appears at the given position within the glyphs
 *     string of one of the given entries. There may also be a "^D" key
 *     to hold entries whose length is equal to the current position
 *     value (and thus which don't have a glyph at that position).
 *
 *     The value for "_count_" is an integer indicating how many words
 *     are in this index and all subindexes combined; the value for "^D"
 *     is an array of integer entry indices containing all words whose
 *     glyph sequence is exactly the sequence of glyphs used to reach
 *     this index. For all other glyphs, the value is *either* an array
 *     containing the indices of entries (usually no more than
 *     INDEX_BIN_SIZE) whose glyphs lists start with the sequence of
 *     glyphs used to reach this index, plus the glyph key for that
 *     entry, *or* it is a subindex containing those same indices mapped
 *     out between different glyph prefixes (i.e., another recursive
 *     layer of the same thing).
 */
function create_index(entries, indices, position) {
    var result = { "_count_": indices.length };
    var nkeys = 0;
    indices.forEach(function (idx) {
        var entry = entries[idx];
        if (entry[0].length <= position) {
            // This entry is too short
            if (result.hasOwnProperty("")) {
                result[""].push(idx);
            } else {
                nkeys += 1;
                result[""] = [ idx ];
            }
        } else {
            var glyph = entry[0][position];
            if (result.hasOwnProperty(glyph)) {
                result[glyph].push(idx);
            } else {
                nkeys += 1;
                result[glyph] = [ idx ];
            }
        }
    });
    var processed = -1;
    for (var key in result) {
        processed += 1;
        if (position == 0 && (nkeys < 50 || processed % 5 == 0)) {
            postMessage(["index-progress", processed / nkeys]);
        }
        if (result.hasOwnProperty(key) && key != "" && key != "_count_") {
            // scan sub-indices to recurse if needed
            if (
                result[key].length > INDEX_BIN_SIZE
                && position < INDEX_DEPTH_LIMIT
            ) {
                // Recurse
                result[key] = create_index(entries, result[key], position + 1);
            }
        }
    }
    return result;
}


/**
 * Cleans up a domain object ensuring that all of the basic required
 * properties have values (and giving them default values if needed) and
 * then adding glyph counts and building an index if those data
 * structures don't already exist.
 *
 * This function posts progress messages as it runs, using 2-element
 * arrays starting with the strings 'count-progress' or 'index-progress'
 * where the second element is a number between 0 and 1 indicating
 * progress.
 *
 * @param dom A domain object with at least an 'entries' property (see
 *     dict.finish_loading). TODO: it must have most of the stats
 *     properties too... compute those here instead?
 *
 * @return A finalized dictionary which in addition to the properties it
 *     had before, has the following:
 *
 *     ordered, cased, colors, and locale: Defaults set if they were
 *         missing, but unchanged if they were present.
 *     glyph_counts, total_glyph_count, bigram-counts,
 *     total_bigram_count, trigram_counts, and total_trigram_count:
 *         For ordered domains, these properties are determined by
 *         analyzing glyph patterns from the entries. These will be
 *         unchanged if 'glyph_counts' already exists.
 *     glyph_counts, total_glyph_count, pair_counts, and
 *     total_pair_count:
 *         For unordered domains, these properties are determined by
 *         analyzing glyph coincidences from the entries. These will be
 *         unchanged if 'glyph_counts' already exists.
 *     index: Unchanged if it exists, but if not, a new index for all of
 *         the entries in the domain is created using create_index.
 *
 */
function finalize_dict(dom) {
    // Default properties:
    if (!dom.hasOwnProperty("ordered")) { dom.ordered = true; }
    if (!dom.hasOwnProperty("cased")) { dom.cased = false; }
    if (!dom.hasOwnProperty("colors")) { dom.colors = []; }
    if (!dom.hasOwnProperty("locale")) { dom.locale = locale.DEFAULT_LOCALE; }

    // Analyze glyphs if needed:
    if (!dom.hasOwnProperty("glyph_counts")) {
        dom.glyph_counts = {};
        dom.total_glyph_count = 0;
        if (dom.ordered) {
            dom.bigram_counts = {};
            dom.total_bigram_count = 0;
            dom.trigram_counts = {};
            dom.total_trigram_count = 0;
        } else {
            dom.pair_counts = {};
            dom.total_pair_count = 0;
        }

        var l = dom.entries.length;

        for (var i = 0; i < dom.entries.length; ++i) {
            if (dom.entries.length < 200 || i % 100 == 0) {
                postMessage(["count-progress", i / dom.entries.length]);
            }

            var entry = dom.entries[i];

            if (!dom.cased) {
                // normalize to upper-case
                entry[0] = locale.lc_upper(entry[0], dom.locale);
                entry[1] = locale.lc_upper(entry[1], dom.locale);
            }

            var gl = entry[0]; // glyphs list
            var f = entry[2]; // word frequency

            for (var j = 0; j < gl.length; ++j) {
                if (f == undefined) {
                    f = 1;
                }
                var w = f / l;

                // This because glyph counts are used for generation:
                if (!dom.cased) {
                    gl[j] = locale.lc_upper(gl[j], dom.locale);
                }

                var g = gl[j]; // this glyph

                // Count glyphs:
                if (dom.glyph_counts.hasOwnProperty(g)) {
                    dom.glyph_counts[g] += w;
                } else {
                    dom.glyph_counts[g] = w;
                }
                dom.total_glyph_count += w;

                // Count bigrams/trigrams:
                if (dom.ordered) {
                    if (j < gl.length - 1) {
                        var b2 = gl[j+1];
                        if (dom.bigram_counts.hasOwnProperty(g)) {
                            var bg_entry = dom.bigram_counts[g];
                        } else {
                            var bg_entry = {};
                            dom.bigram_counts[g] = bg_entry;
                        }
                        if (bg_entry.hasOwnProperty(b2)) {
                            bg_entry[b2] += w;
                        } else {
                            bg_entry[b2] = w;
                        }
                        dom.total_bigram_count += w;
                    }
                    if (j < gl.length - 2) {
                        var t3 = gl[j+2];
                        if (dom.trigram_counts.hasOwnProperty(g)) {
                            var tr_entry = dom.trigram_counts[g];
                        } else {
                            var tr_entry = {};
                            dom.trigram_counts[g] = tr_entry;
                        }
                        if (tr_entry.hasOwnProperty(b2)) {
                            tr_entry = tr_entry[b2];
                        } else {
                            new_entry = {}
                            tr_entry[b2] = new_entry;
                            tr_entry = new_entry;
                        }
                        if (tr_entry.hasOwnProperty(t3)) {
                            tr_entry[t3] += w;
                        } else {
                            tr_entry[t3] = w;
                        }
                        dom.total_trigram_count += w;
                    }
                } else { // unordered: count all pairs
                    for (var k = j+1; k < gl.length; ++k) {
                        var o = gl[k];
                        if (g < o) {
                            var pair = [g, o];
                        } else {
                            var pair = [o, g];
                        }
                        // Enter in canonical order:
                        if (dom.pair_counts.hasOwnProperty(pair[0])) {
                            var pr_entry = dom.pair_counts[pair[0]];
                            dom.pair_counts[pair[0]] += w;
                        } else {
                            var pr_entry = {}
                            dom.pair_counts[pair[0]] = pr_entry;
                        }
                        if (pr_entry.hasOwnProperty(pair[1])) {
                            pr_entry[pair[1]] += w;
                        } else {
                            pr_entry[pair[1]] = w;
                        }
                        dom.total_pair_count += w;
                        // Enter reversed:
                        if (dom.pair_counts.hasOwnProperty(pair[1])) {
                            var pr_entry = dom.pair_counts[pair[1]];
                            dom.pair_counts[pair[1]] += w;
                        } else {
                            var pr_entry = {}
                            dom.pair_counts[pair[1]] = pr_entry;
                        }
                        if (pr_entry.hasOwnProperty(pair[0])) {
                            pr_entry[pair[0]] += w;
                        } else {
                            pr_entry[pair[0]] = w;
                        }
                        dom.total_pair_count += w;
                    }
                }
            }
        }
    }
    postMessage(["count-progress", 1.0]);

    // Build an index if needed:
    if (!dom.hasOwnProperty("index")) {
        // Create an array of indices:
        var indices = [];
        for (let i = 0; i < dom.entries.length; ++i) {
            indices.push(i);
        }
        // Build the index:
        dom.index = create_index(dom.entries, indices, 0);
    }
    postMessage(["index-progress", 1.0]);

    return dom;
}

/**
 * Message handler function for this worker. Calls finalize_dict on the
 * rough domain in the message and posts a response message when that's
 * done (in addition to the progress messages that that function posts).
 * After posting its response, it shuts down this worker.
 * 
 * @param msg An incoming message object, whose data is a pair containing
 *     a domain name at index 0 and a rough domain object at index 1 (see
 *     finalize_dict).
 */
function msg_handler(msg) {
    var fin = finalize_dict(msg.data[1]);
    postMessage([msg.data[0], fin]);
    close(); // this worker is done.
}

// Set up the message handler
self.onmessage = msg_handler;

// Send a message so that the main page knows we're ready to accept
// requests.
self.postMessage("worker_ready");
