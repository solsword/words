importScripts("../../bower_components/requirejs/require.js");

var finalize_dict;

var msg_handler;

require(["../locale"], function (locale) {

  var INDEX_DEPTH_LIMIT = 7;
  var INDEX_BIN_SIZE = 64;

  function create_index(entries, indices, position) {
    // Creates an index on the position-th glyphs from each of the given
    // entries, picked out from the full list by the indices array. Calls
    // itself recursively until INDEX_BIN_SIZE is satisfied or
    // INDEX_DEPTH_LIMIT is met. Returns an object mapping glyphs to
    // sub-indices or an array for terminal entries. Each object result
    // includes a "_count_" key indicating the total entries under that index.
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
        var glyph = entry[0][position]
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


  finalize_dict = function (json) {
    // Default properties:
    if (!json.hasOwnProperty("ordered")) { json.ordered = true; }
    if (!json.hasOwnProperty("cased")) { json.cased = false; }
    if (!json.hasOwnProperty("colors")) { json.colors = []; }
    if (!json.hasOwnProperty("locale")) { json.locale = locale.DEFAULT_LOCALE; }

    // Analyze glyphs if needed:
    if (!json.hasOwnProperty("glyph_counts")) {
      json.glyph_counts = {};
      json.total_glyph_count = 0;
      if (json.ordered) {
        json.bigram_counts = {};
        json.total_bigram_count = 0;
        json.trigram_counts = {};
        json.total_trigram_count = 0;
      } else {
        json.pair_counts = {};
        json.total_pair_count = 0;
      }

      var l = json.entries.length;

      for (var i = 0; i < json.entries.length; ++i) {
        if (json.entries.length < 200 || i % 100 == 0) {
          postMessage(["count-progress", i / json.entries.length]);
        }

        var entry = json.entries[i];

        if (!json.cased) {
          // normalize to upper-case
          entry[0] = locale.upper(entry[0], json.locale);
          entry[1] = locale.upper(entry[1], json.locale);
        }

        var gl = entry[0]; // glyphs list
        var f = entry[2]; // word frequency

        for (var j = 0; j < gl.length; ++j) {
          if (f == undefined) {
            f = 1;
          }
          var w = f / l;

          // This because glyph counts are used for generation:
          if (!json.cased) {
            gl[j] = locale.upper(gl[j], json.locale);
          }

          var g = gl[j]; // this glyph

          // Count glyphs:
          if (json.glyph_counts.hasOwnProperty(g)) {
            json.glyph_counts[g] += w;
          } else {
            json.glyph_counts[g] = w;
          }
          json.total_glyph_count += w;

          // Count bigrams/trigrams:
          if (json.ordered) {
            if (j < gl.length - 1) {
              var b2 = gl[j+1];
              if (json.bigram_counts.hasOwnProperty(g)) {
                var bg_entry = json.bigram_counts[g];
              } else {
                var bg_entry = {};
                json.bigram_counts[g] = bg_entry;
              }
              if (bg_entry.hasOwnProperty(b2)) {
                bg_entry[b2] += w;
              } else {
                bg_entry[b2] = w;
              }
              json.total_bigram_count += w;
            }
            if (j < gl.length - 2) {
              var t3 = gl[j+2];
              if (json.trigram_counts.hasOwnProperty(g)) {
                var tr_entry = json.trigram_counts[g];
              } else {
                var tr_entry = {};
                json.trigram_counts[g] = tr_entry;
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
              json.total_trigram_count += w;
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
              if (json.pair_counts.hasOwnProperty(pair[0])) {
                var pr_entry = json.pair_counts[pair[0]];
                json.pair_counts[pair[0]] += w;
              } else {
                var pr_entry = {}
                json.pair_counts[pair[0]] = pr_entry;
              }
              if (pr_entry.hasOwnProperty(pair[1])) {
                pr_entry[pair[1]] += w;
              } else {
                pr_entry[pair[1]] = w;
              }
              json.total_pair_count += w;
              // Enter reversed:
              if (json.pair_counts.hasOwnProperty(pair[1])) {
                var pr_entry = json.pair_counts[pair[1]];
                json.pair_counts[pair[1]] += w;
              } else {
                var pr_entry = {}
                json.pair_counts[pair[1]] = pr_entry;
              }
              if (pr_entry.hasOwnProperty(pair[0])) {
                pr_entry[pair[0]] += w;
              } else {
                pr_entry[pair[0]] = w;
              }
              json.total_pair_count += w;
            }
          }
        }
      }
    }
    postMessage(["count-progress", 1.0]);

    // Build an index if needed:
    if (!json.hasOwnProperty("index")) {
      // Create an array of indices:
      var indices = []
      for (var i = 0; i < json.entries.length; ++i) {
        indices.push(i);
      }
      // Build the index:
      json.index = create_index(json.entries, indices, 0);
    }
    postMessage(["index-progress", 1.0]);

    return json;
  }

  msg_handler = function(msg) {
    var fin = finalize_dict(msg.data[1]);
    postMessage([msg.data[0], fin]);
    close(); // this worker is done.
  }

  self.onmessage = msg_handler;

  self.postMessage("worker_ready");
});
