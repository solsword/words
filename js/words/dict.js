// dict.js
// Dictionary implementation.

define([], function() {

  DOMAINS = {}

  INDEX_DEPTH_LIMIT = 6;
  INDEX_BIN_SIZE = 64;

  function lookup_domain(name) {
    // Looks up a domain by name.
    if (DOMAINS.hasOwnProperty(name)) {
      return DOMAINS[name];
    } else {
      console.log("Internal Error: Unknown domain '" + name + "'.");
      console.log("Known domains are:");
      for (var d in DOMAINS) {
        if (DOMAINS.hasOwnProperty(d)) {
          console.log("  " + d);
        }
      }
      console.log("---");
      return undefined;
    }
  }

  function finish_loading(name, json) {
    // Takes a JSON object from a domain file and augments it before adding it
    // to DOMAINS.

    // Default properties:
    if (!json.hasOwnProperty("ordered")) { json.ordered = true; }
    if (!json.hasOwnProperty("cased")) { json.cased = false; }
    if (!json.hasOwnProperty("colors")) { json.colors = []; }

    // Analyze glyphs if needed:
    if (!json.hasOwnProperty("glyph_counts")) {
      json.glyph_counts = {};
      for (var i = 0; i < json.entries.length; ++i) {
        var entry = json.entries[i];
        for (var j = 0; j < entry[0].length; ++j) {
          var g = entry[0][j];
          // This because glyph counts are used for generation:
          if (!json.cased) {
            g = g.toUpperCase();
          }
          if (json.glyph_counts.hasOwnProperty(g)) {
            json.glyph_counts[g] += 1;
          } else {
            json.glyph_counts[g] = 1;
          }
        }
      }
    }

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

    // Add it as a domain:
    DOMAINS[name] = json;
  }

  function load_dictionary(domain) {
    // Loads the dictionary for the given domain. Does nothing if that domain
    // is already loaded. Puts the data into the DOMAINS object. Builds an
    // index if the loaded domain doesn't have one, which may take some time.
    if (DOMAINS.hasOwnProperty(domain)) {
      return;
    }

    // From:
    // https://codepen.io/KryptoniteDove/post/load-json-file-locally-using-pure-javascript
    // Use with Chrome and --allow-file-access-from-files to run locally.
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    var url = window.location.href;
    var path = url.substr(0, url.lastIndexOf('/'));
    var dpath = path + "/js/words/domains/" + domain + ".json";

    // Load synchronously
    xobj.open("GET", dpath, false);
    xobj.onload = function () {
      var json = JSON.parse(xobj.responseText);
      finish_loading(domain, json);
    };
    xobj.send(null);
  }

  function create_index(entries, indices, position) {
    // Creates an index on the position-th glyphs from each of the given
    // entries, picked out from the full list by the indices array. Calls
    // itself recursively until INDEX_BIN_SIZE is satisfied or
    // INDEX_DEPTH_LIMIT is met. Returns an object mapping glyphs to
    // sub-indices or an array for terminal entries.
    result = {};
    indices.forEach(function (idx) {
      var entry = entries[idx];
      if (entry[0].length <= position) {
        // This entry is too short
        if (reuslt.hasOwnProperty("")) {
          console.log("Internal Error: multiple too-short entry:\n" + entry);
        }
        result[""] = idx;
      } else {
        var glyph = entry[0][position]
        if (result.hasOwnProperty(glyph)) {
          result[glyph].push(idx);
        } else {
          result[glyph] = [ idx ];
        }
      }
    });
    for (var key in result) {
      if (result.hasOwnProperty(key) && key != "") {
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

  function check_word(glyphs, domains) {
    // Returns a list of word, definition pairs that match the given glyphs in
    // one of the given domains. The list will be empty if there are no
    // matches.
    var entries = [];
    domains.forEach(function (domain) {
      var match = find_word_in_domain(glyphs, domain);
      if (match != null) {
        entries.push(match);
      }
    });
    return entries;
  }

  function find_word_in_domain(glyphs, domain) {
    // Finds the given glyph sequence in the given domain. Returns an array
    // containing the matching word (combined & with cannonical case) and its
    // definition. Returns null if there is no match.

    // For unordered domains, sort glyphs so that indexing will work:
    var dom = DOMAINS[domain];
    if (dom == undefined) {
      console.log("Internal Error: unknown domain '" + domain + "'.");
      return null;
    }
    if (!domain.ordered) {
      glyphs.sort();
    }
    // Turn the array into a string:
    glyphs = glyphs.join("");

    // For uncased domains, convert the glyph sequence to lower case:
    if (!domain.cased) {
      glyphs = glyphs.toLowerCase();
    }

    var original = glyphs;

    // Now search the domain's index:
    var index = domain.index;
    var g = glyphs[0];
    while (index.hasOwnProperty(g) && glyphs.length > 0) {
      index = index[g];
      glyphs = glyphs.slice(1);
      if (glyphs.length > 0) {
        g = glyphs[0];
      } else {
        g = null;
      }
      if (Array.isArray(index)) {
        // no more indices to search
        break
      }
    }
    var entry = null;
    if (g == null && Array.isArray(index)) {
      for (var i = 0; i < index.length; ++i) {
        var idx = index[i];
        var entry = domain.entries[idx];
        var against = entry[0];
        // TODO: Permit any ordering in domain files for unordered domains?
        if (!domain.cased) {
          against = against.toLowerCase();
        }
        if (against === original) {
          entry = entry;
        }
      }
    } else if (g == null) {
      if (index.hasOwnProperty("")) {
        entry = domain.entries[index[""]];
      } else {
        // word prefix
        return null;
      }
    } else {
      // word + suffix or just a non-word
      return null;
    }

    if (entry != null && entry.length == 3) {
      // Truncate 3-item entries that include glyph combinations separately
      // from words.
      return [ entry[1], entry[2] ];
    } else {
      return entry;
    }
  }

  // Load dictionaries:
  // TODO: HERE
  load_dictionary("test");
  load_dictionary("test_combo");

  return {
    "lookup_domain": lookup_domain,
    "load_dictionary": load_dictionary,
    "check_word": check_word,
    "find_word_in_domain": find_word_in_domain,
  };
});
