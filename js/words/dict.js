// dict.js
// Dictionary implementation.

define(["./locale"], function(locale, finalize) {

  var DOMAINS = {};
  var LOADING = {};
  var FAILED = {};

  var FINALIZE_URL = "js/words/workers/finalize_dict.js";
  //var FINALIZE_URL = "js/words/workers/test.js";

  function lookup_domain(name) {
    // Looks up a domain by name.
    if (DOMAINS.hasOwnProperty(name)) {
      return DOMAINS[name];
    } else if (FAILED.hasOwnProperty(name)) {
      console.log("Internal Error: Unknown domain '" + name + "'.");
      console.log("Known domains are:");
      for (var d in DOMAINS) {
        if (DOMAINS.hasOwnProperty(d)) {
          console.log("  " + d);
        }
      }
      console.log("...still-loading domains:");
      for (var d in LOADING) {
        if (LOADING.hasOwnProperty(d)) {
          console.log("  " + d);
        }
      }
      console.log("---");
      return undefined;
    } else if (!LOADING.hasOwnProperty(d)) {
      load_dictionary(name);
      return undefined;
    }
  }

  function finish_loading(name, json) {
    // Takes a JSON object from a domain file and augments it before adding it
    // to DOMAINS.
    if (DOMAINS.hasOwnProperty(name)) {
      console.log("Not finalizing already-loaded domain: '" + name + "'.");
      return;
    }

    // Create a worker to do the work:
    var worker = new Worker(FINALIZE_URL);
    worker.payload = [name, json];
    worker.onmessage = function (msg) {
      // Gets a name + finalized domain from the worker and adds the domain.
      if (msg.data == "worker_ready") { // initial ready message
        worker.postMessage(worker.payload);
      } else if (msg.data[0] == "count-progress") { // counting progress
        LOADING[name][1] = msg.data[1];
      } else if (msg.data[0] == "index-progress") { // indexing progress
        LOADING[name][2] = msg.data[1];
      } else { // finished message w/ product
        add_domain(msg.data[0], msg.data[1]);
      }
    }
  }

  function add_domain(name, json) {
    // Adds a domain, taking care of the necessary status checks/updates.
    if (DOMAINS.hasOwnProperty(name)) {
      console.log("Not adding already-loaded domain: '" + name + "'.");
      return;
    }

    DOMAINS[name] = json;
    if (LOADING.hasOwnProperty(name)) {
      delete LOADING[name];
    }
    if (FAILED.hasOwnProperty(name)) {
      delete FAILED[name];
    }
  }


  function load_dictionary(domain, is_simple=undefined) {
    // Loads the dictionary for the given domain. Does nothing if that domain
    // is already loaded (or is currently being loaded). Puts the data into the
    // DOMAINS object. Builds an index if the loaded domain doesn't have one,
    // which may take some time.
    if (DOMAINS.hasOwnProperty(domain) || LOADING.hasOwnProperty(domain)) {
      return;
    }
    LOADING[domain] = [false, 0, 0]; // http-done, count-prog, index prog
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
        var json = JSON.parse(xobj.responseText);
        finish_loading(name, json);
      } catch (e) {
        load_simple_word_list(name);
        return;
      }
    };
    xobj.onerror = function () {
      load_simple_word_list(name);
    }
    try {
      xobj.send(null);
    } catch (e) {
      load_simple_word_list(name);
    }
  }

  function name_hash(name) {
    // Hashes a name
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

    // Load asynchronously
    xobj.open("GET", dpath);
    xobj.onload = function () {
      var successful = (
        xobj.status == 200
     || (xobj.status == 0 && dpath.startsWith("file://"))
      );
      if (!successful) {
        console.log("Internal Error: Failed to fetch domain '" + name + "'!");
        console.log("  Response code: " + xobj.status);
        console.log("  Response content:\n" + xobj.responseText.slice(0,80));
        FAILED[name] = true;
        return undefined;
      }
      LOADING[name][0] = true;
      var words = xobj.responseText.split("\n");
      var i = 0;
      while (words[i][0] == '#') {
        i += 1;
      }
      if (i > 0) {
        directives = words.slice(0,i);
        words = words.slice(i);
      }
      var entries = [];
      words.forEach(function (w) {
        var bits = w.split(",");
        var word = bits[0];
        var freq = bits[1]; // might be 'undefined'
        bits = word.split("→")
        var glyphs = bits[0];
        var word = bits[1]; // might be undefined
        if (word == undefined) {
          word = glyphs;
        }
        // TODO: HERE
        entries.push([glyphs, word, freq]);
      });
      // TODO: Really this?
      /*
      entries.sort(function (a, b) {
        return b[2] - a[2]; // put most-frequent words first
      });
      */
      var json = {
        "ordered": true,
        "cased": false,
        "colors": [],
        "entries": entries
      }
      directives.forEach(function (d) {
        dbits = d.slice(1).split(":");
        key = dbits[0].trim()
        val = dbits[1].trim()
        if (key == "colors") {
          var colors = val.split(",");
          json["colors"] = [];
          colors.forEach(function (c) {
            json["colors"].push(c.trim());
          });
        } else if (key == "ordered" || key == "cased") {
          json[key] = [
            "true", "True", "TRUE",
            "yes", "Yes", "YES",
            "y", "Y"
          ].indexOf(val) >= 0;
        } else {
          json[key] = dbits[1].trim();
        }
      });
      finish_loading(name, json);
    };
    try {
      xobj.send(null);
    } catch (e) {
      FAILED[name] = true;
    }
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
    // containing the matching word (combined & with canonical case) and its
    // frequency. Returns null if there is no match.

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
      glyphs = locale.lower(glyphs, dom.locale);
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
          against = locale.lower(against, dom.locale);
        }
        if (against === original) {
          entry = test_entry;
        }
      }
    } else if (g == null) {
      if (index.hasOwnProperty("")) {
        for (var i = 0 ;i < index[""].length; ++i) {
          var idx = index[""][i];
          var test_entry = dom.entries[ids];
          var against = test_entry[0];
          if (!dom.cased) {
            against = locale.lower(against, dom.locale);
          }
          if (against === original) {
            entry = test_entry;
          }
        }
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

  return {
    "lookup_domain": lookup_domain,
    "load_dictionary": load_dictionary,
    "check_word": check_word,
    "find_word_in_domain": find_word_in_domain,
  };
});
