importScripts("../../bower_components/requirejs/require.js");

var finalize_dict;

var msg_handler;

require(["../locale"], function (locale) {

  var INDEX_DEPTH_LIMIT = 6;
  var INDEX_BIN_SIZE = 64;

  function create_index(entries, indices, position) {
    // Creates an index on the position-th glyphs from each of the given
    // entries, picked out from the full list by the indices array. Calls
    // itself recursively until INDEX_BIN_SIZE is satisfied or
    // INDEX_DEPTH_LIMIT is met. Returns an object mapping glyphs to
    // sub-indices or an array for terminal entries.
    var result = { "_count_": indices.length };
    var nkeys = 0;
    indices.forEach(function (idx) {
      var entry = entries[idx];
      if (entry[0].length <= position) {
        // This entry is too short
        if (result.hasOwnProperty("")) {
          reuslt[""].push(idx);
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
        var gl = entry[0]; // glyphs list
        var f = entry[2]; // word frequency

        for (var j = 0; j < gl.length; ++j) {
          if (f == undefined) {
            f = 1;
          }

          var g = gl[j]; // this glyph

          // This because glyph counts are used for generation:
          if (!json.cased) {
            g = locale.upper(g, json.locale);
          }

          // Count glyph:
          if (json.glyph_counts.hasOwnProperty(g)) {
            json.glyph_counts[g] += f / l;
          } else {
            json.glyph_counts[g] = f / l;
          }
          json.total_glyph_count += f / l;

          // Count bigrams/trigrams:
          if (json.ordered) {
            if (j < gl.length - 1) {
              var bi = gl.slice(i, i+2);
              if (json.bigram_counts.hasOwnProperty(bi[0])) {
                var bg_entry = json.bigram_counts[bi[0]];
              } else {
                var bg_entry = {};
                json.bigram_counts[bi[0]] = bg_entry;
              }
              if (bg_entry.hasOwnProperty(bi[1])) {
                bg_entry[bi[1]] += f / l;
              } else {
                bg_entry[bi[1]] = f / l;
              }
              json.total_bigram_count += f / l;
            }
            if (j < gl.length - 2) {
              var tri = gl.slice(i, i+3);
              if (json.trigram_counts.hasOwnProperty(bi[0])) {
                var tr_entry = json.bigram_counts[tri[0]];
              } else {
                var tr_entry = {};
                json.bigram_counts[tri[0]] = tr_entry;
              }
              if (tr_entry.hasOwnProperty(tri[1])) {
                tr_entry = tr_entry[tri[1]];
              } else {
                new_entry = {}
                tr_entry[tri[1]] = new_entry;
                tr_entry = new_entry;
              }
              if (tr_entry.hasOwnProperty(tri[2])) {
                tr_entry[tri[2]] += f / l;
              } else {
                tr_entry[tri[2]] = f / l;
              }
              json.total_trigram_count += f / l;
            }
          } else { // unordered: count all pairs
            for (var k = j+1; k < gl.length; ++k) {
              var o = gl[k];
              if (g < o) {
                var pair = g + o;
              } else {
                var pair = o + g;
              }
              // TODO: Nest these like the bigrams?
              if (json.pair_counts.hasOwnProperty(pair)) {
                json.pair_counts[pair] += f / l;
              } else {
                json.pair_counts[pair] = f / l;
              }
              json.total_pair_count += f / l;
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
