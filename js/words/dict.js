// dict.js
// Dictionary implementation.

define([], function() {

  DOMAINS = {}

  DOMAIN_COLORS = {
    "us_plants": [ "gn" ],
    "plants": [ "gn" ],

    "animals": [ "rd" ],

    "birds": [ "bl" ],
    "fish": [ "bl" ],
    "mammals": [ "rd" ],
    "monotremes": [ "rd" ],
    "reptiles": [ "yl" ],
    "amphibians": [ "yl" ],

    "insects": [ "gn" ],
    "spiders": [ "gn" ],
    "au_ants": [ "gn" ],
    "gb_ants": [ "gn" ],
    "gb_bees": [ "gn" ],
    "gb_wasps": [ "gn" ],
    "ca_butterflies": [ "gn" ],
  }

  INDEX_DEPTH_LIMIT = 6;
  INDEX_BIN_SIZE = 64;

  function colors_for(domain) {
    if (DOMAIN_COLORS.hasOwnProperty(domain)) {
      return DOMAIN_COLORS[domain].slice();
    } else {
      return [];
    }
  }

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

  function load_dictionary(domain, is_simple=undefined) {
    // Loads the dictionary for the given domain. Does nothing if that domain
    // is already loaded. Puts the data into the DOMAINS object. Builds an
    // index if the loaded domain doesn't have one, which may take some time.
    if (DOMAINS.hasOwnProperty(domain)) {
      return;
    }
    if (is_simple == undefined) {
      load_json_or_list(domain);
    } else if (is_simple) {
      load_simple_word_list(domain);
    } else {
      load_json_or_list(domain);
    }
  }

  function load_json_or_list(name) {
    // From:
    // https://codepen.io/KryptoniteDove/post/load-json-file-locally-using-pure-javascript
    // Use with Chrome and --allow-file-access-from-files to run locally.
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    var url = window.location.href;
    var path = url.substr(0, url.lastIndexOf('/'));
    var dpath = path + "/js/words/domains/" + name + ".json";

    // Load synchronously
    xobj.open("GET", dpath, false);
    xobj.onload = function () {
      if (xobj.status != 200) {
        load_simple_word_list(name);
      }
      try {
        var json = JSON.parse(xobj.responseText);
        finish_loading(name, json);
      } catch (e) {
        load_simple_word_list(name);
      }
    };
    try {
      xobj.send(null);
    } catch (e) {
      load_simple_word_list(name);
    }
  }

  function name_hash(name) {
    var h = name.split("").reduce(
      function (a,b) {
        a=((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      },
      0
    );
    if (h < 0) {
      return -h;
    } else {
      return h;
    }
  }

  function load_simple_word_list(name) {
    // Use with Chrome and --allow-file-access-from-files to run locally.
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("text/plain");
    var url = window.location.href;
    var path = url.substr(0, url.lastIndexOf('/'));
    var dpath = path + "/js/words/domains/" + name + ".lst";

    // Load synchronously
    xobj.open("GET", dpath, false);
    xobj.onload = function () {
      var words = xobj.responseText.split("\n");
      var entries = [];
      words.forEach(function (w) {
        entries.push([w, w]);
      });
      var json = {
        "ordered": true,
        "cased": false,
        "colors": colors_for(name),
        "entries": entries
      }
      finish_loading(name, json);
    };
    xobj.send(null);
  }

  function create_index(entries, indices, position) {
    // Creates an index on the position-th glyphs from each of the given
    // entries, picked out from the full list by the indices array. Calls
    // itself recursively until INDEX_BIN_SIZE is satisfied or
    // INDEX_DEPTH_LIMIT is met. Returns an object mapping glyphs to
    // sub-indices or an array for terminal entries.
    var result = {};
    indices.forEach(function (idx) {
      var entry = entries[idx];
      if (entry[0].length <= position) {
        // This entry is too short
        if (result.hasOwnProperty("")) {
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
    if (!dom.ordered) {
      glyphs.sort();
    }
    // Turn the array into a string:
    glyphs = glyphs.join("");

    // For uncased domains, convert the glyph sequence to lower case:
    if (!dom.cased) {
      glyphs = glyphs.toLowerCase();
    }

    var original = glyphs;

    // Now search the domain's index:
    var index = dom.index;
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
    if (Array.isArray(index)) {
      for (var i = 0; i < index.length; ++i) {
        var idx = index[i];
        var test_entry = dom.entries[idx];
        var against = test_entry[0];
        // TODO: Permit any ordering in domain files for unordered domains?
        if (!dom.cased) {
          against = against.toLowerCase();
        }
        if (against === original) {
          entry = test_entry;
        }
      }
    } else if (g == null) {
      if (index.hasOwnProperty("")) {
        entry = dom.entries[index[""]];
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
  //load_dictionary("test");
  //load_dictionary("test_combo");

  // Base domains:
  load_dictionary("adj", true);
  load_dictionary("adv", true);
  load_dictionary("noun", true);
  load_dictionary("verb", true);

  // Bonus domains:
  load_dictionary("us_plants", true);
  load_dictionary("plants", true);

  load_dictionary("animals", true);

  load_dictionary("birds", true);
  load_dictionary("fish", true);
  load_dictionary("mammals", true);
  load_dictionary("monotremes", true);
  load_dictionary("reptiles", true);
  load_dictionary("amphibians", true);

  load_dictionary("insects", true);
  load_dictionary("spiders", true);
  load_dictionary("au_ants", true);
  load_dictionary("gb_ants", true);
  load_dictionary("gb_bees", true);
  load_dictionary("gb_wasps", true);
  load_dictionary("ca_butterflies", true);

  // TODO: Missing animals...
  // load_dictionary("crustaceans");
  // load_dictionary("molluscs");
  // load_dictionary("fungi");

  return {
    "lookup_domain": lookup_domain,
    "load_dictionary": load_dictionary,
    "check_word": check_word,
    "find_word_in_domain": find_word_in_domain,
  };
});
