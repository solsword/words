// generate.js
// Generates hex grid supertiles for word puzzling.

define(["./dict", "./grid"], function(dict, grid) {

  var SMOOTHING = 1.5;

  var DOMAIN_COMBOS = {
    //"base": [ "türk" ],
    "base": [ "adj", "adv", "noun", "verb" ]
  }

  var DOMAIN_WEIGHTS = {
    "türk": 5,
    "العربية": 5,
    "base": 20
  }

  var MAX_UNLOCKED = 8;
  var MIN_UNLOCKED = 5; // but they can miss and collide, of course

  function domains_list(domain_or_combo) {
    // Returns an array of all domains in the given group or combo.
    if (DOMAIN_COMBOS.hasOwnProperty(domain_or_combo)) {
      result = [];
      DOMAIN_COMBOS[domain_or_combo].forEach(function (d) {
        domains_list(d).forEach(function (rd) {
          result.push(rd);
        });
      });
      return result;
    } else {
      return [ domain_or_combo ];
    }
  }

  function prng(seed) {
    // TODO: Better here!
    var result =  ((((seed * 1029830183) << 5) - seed) % 1e9);
    if (result < 0) {
      result = -result;
    }
    return result;
  }

  function udist(seed) {
    // Generates a random number between 0 and 1 given a seed value.
    // TODO: WAY better here!
    return (seed % 120283013) / 120283013
  }

  function expdist(seed) {
    // Samples from an exponential distribution with mean 0.5 given a seed.
    // See:
    // https://math.stackexchange.com/questions/28004/random-exponential-like-distribution
    var u = udist(seed);
    return -Math.log(1 - u)/0.5
  }

  function sample_table(table, seed) {
    // Samples a table of weights.
    var total_weight = 0;
    for (var e in table) {
      if (table.hasOwnProperty(e)) {
        total_weight += table[e] + SMOOTHING;
      }
    }
    var r = udist(prng(seed)) * total_weight;

    var last = undefined;
    var selected = null;
    for (var e in table) {
      if (table.hasOwnProperty(e)) {
        selected = e;
        r -= table[e] + SMOOTHING;
        if (r < 0) {
          break;
        }
      }
    }
    return selected;
  }

  function sample_glyph(gcounts, seed) {
    // Sample a glyph from a counts dictionary, using the counts as weights.
    return sample_table(gcounts, seed);
  }

  function distort_probabilities(probabilities, bias) {
    // Distorts the given probability distribution (an object mapping options
    // to probabilities) according to the given bias value, which should be
    // between -1 and 1. A bias value of -1 skews the distribution towards
    // uncommon values, while a bias value of +1 skews it even more towards
    // already-common values. A bias value of zero returns the base
    // probabilities unchanged. The probability values should all be between 0
    // and 1, and should sum to 1.
    result = {};
    var newsum = 0;
    var exp = 1;
    if (bias < 0) {
      exp = 1/(1 + (-bias*4));
    } else if (bias > 0) {
      exp = (1 + bias*4);
    }
    // distort
    for (var k in probabilities) {
      if (probabilities.hasOwnProperty(k)) {
        var adj = Math.pow(probabilities[k], exp);
        newsum += adj;
        result[k] = adj;
      }
    }
    // re-normalize:
    for (var k in result) {
      if (result.hasOwnProperty(k)) {
        result[k] /= newsum;
      }
    }
    return result;
  }

  function weighted_shuffle(items, seed) {
    // Returns an array containing keys from the items dictionary shuffled
    // according to their values. See:
    // https://softwareengineering.stackexchange.com/questions/233541/how-to-implement-a-weighted-shuffle
    var array = [];
    for (var k in items) {
      if (items.hasOwnProperty(k)) {
        var w = items[k];
        array.push([k, w * expdist(seed)]);
        seed = prng(seed);
      }
    }

    // Weighted random shuffle -> sort by expdist * weight
    array.sort(function (a, b) { return a[1] - b[1]; });

    var result = [];
    for (var i = 0; i < array.length; ++i) {
      result.push(array[i][0]);
    }
  }

  function index_order(index, seed, bias) {
    // Returns an ordered list of keys, shuffled with bias. The bias value
    // should be between -1 and 1 and controls how much bias there is towards
    // (or away from, for negative values) more-common glyph sequences.
    var bc = index["_count_"];
    var probs = {};
    var n_keys = 0;
    for (var key in index) {
      if (index.hasOwnProperty(key) && key != "" && key != "_count_") {
        n_keys += 1;
        if (Array.isArray(index[key])) {
          probs[key] = index[key].length / bc;
        } else {
          probs[key] = index[key]["_count"] / bc;
        }
      }
    }
    if (index.hasOwnProperty("")) {
      probs[""] = 1/bc;
    }
    probs = distort_probabilities(probs, bias);
    return weighted_shuffle(probs, seed);
  }

  function sample_word(domain, seed, bias, max_len) {
    // Sample a word from the given domain, weighted according to sequential
    // unigram probabilities adjusted by the given bias factor, which should be
    // between -1 (bias away from common glyph combinations) to 1 (bias towards
    // common combinations). Returns a full domain entry a (glyphs-string,
    // word-string pair). If there are no words short enough in the domain,
    // this will return undefined.

    var dom = lookup_domain(domain);
    var index = dom.index;
    var l = 0
    while (l < max_len) {
      seed = prng(seed);
      var try_order = index_order(index, seed, bias);
      try_order.forEach(function (key) {
        if (key == "") { // single-index item
          var entry = dom.entries[index[key]];
          if (entry[0].length <= max_len) {
            return entry;
          } // else keep going in the outer loop
        } else if (Array.isArray(index[key])) { // array-of-indices item
          eindices = index[key].slice();
          eindices.sort(function (a, b) {
            var ov = udist(seed);
            seed = prng(seed);
            return ov < udist(seed);
          });
          var result = undefined;
          eindices.forEach(function (ei) {
            var entry = dom.entries[ei];
            if (entry[0].length <= max_len) {
              return entry;
            } // else keep going to the next eindex
          });
        } else { // sub-index item
          index = index[key];
          l += 1;
          // continue with outer loop
        }
      });
    }
    // If we got here, we couldn't find any word that was short enough!
    return undefined;
  }

  function mix_seeds(s1, s2, off) {
    // Mixes two seeds (variables) using a third offset (constant).
    return s1 ^ ((s2 + off/2) * off);
  }

  function sghash(seed, spos) {
    // Hashes a seed and a supergrid position together into a combined seed
    // value.

    var smix = mix_seeds(seed, spos[0], 40349);
    smix = mix_seeds(smix, spos[1], 4839482);

    return smix;
  }

  function generate_domains(seed, spos) {
    // Generates the domain list for the given supergrid position according to
    // the given seed.
    var smix = sghash(seed, spos);

    var domain = sample_table(DOMAIN_WEIGHTS, smix);
    result = domains_list(domain);
    return result;
  }

  function colors_for_domains(domains) {
    // Returns a color value for a domain list.
    var result = [];
    domains.forEach(function (d) {
      var dom = dict.lookup_domain(d);
      dom.colors.forEach(function (c) {
        result.push(c);
      });
    });
    return result.slice(0,6);
  }

  function merge_glyph_counts(gs1, gs2) {
    // Merges two glyph counts, returning a new object. Normalizes both counts
    // first to avoid source-set-size bias.
    var result = {};
    var gs1_total = 0;
    var gs2_total = 0;
    for (var g in gs1) {
      if (gs1.hasOwnProperty(g)) {
        gs1_total += gs1[g];
      }
    }
    for (var g in gs2) {
      if (gs2.hasOwnProperty(g)) {
        gs2_total += gs2[g];
      }
    }
    for (var g in gs1) {
      if (gs1.hasOwnProperty(g)) {
        result[g] = gs1[g] / gs1_total;
      }
    }
    for (var g in gs2) {
      if (gs2.hasOwnProperty(g)) {
        if (result.hasOwnProperty(g)) {
          result[g] += gs2[g] / gs2_total;
        } else {
          result[g] = gs2[g] / gs2_total;
        }
      }
    }
    return result;
  }

  function combined_counts(domains) {
    var result = {};
    domains.forEach(function (d) {
      var dom = dict.lookup_domain(d);
      result = merge_glyph_counts(result, dom.glyph_counts);
    });
    return result;
  }

  function generate_unlocked(hash) {
    // Generates an unlocked bitmask for a fresh supertile using the given hash.
    var result = [ 0, 0 ];
    hash = prng(hash);
    var n_unlocked = MIN_UNLOCKED + (hash % (MAX_UNLOCKED - MIN_UNLOCKED));
    for (var i = 0; i < n_unlocked; ++i) {
      hash = prng(hash);
      var ord = hash % 49;
      if (ord >= 32) {
        ord -= 32;
        result[1] |= 1 << ord;
      } else {
        result[0] |= 1 << ord;
      }
    }
    return result;
  }

  function generate_supertile(seed, sp) {
    // Takes a seed and a supertile position and generates the corresponding
    // supertile. If a required domain is not-yet-loaded, this will return
    // undefined, and the generation process should be re-initiated.
    //
    // TODO: Uses globally-known edge content to generate guaranteed inroads.
    var smix = sghash(seed, sp);

    var result = {
      "glyphs": Array(49),
      "domains": generate_domains(seed, sp)
    };

    var any_missing = false;
    result["domains"].forEach(function (d) {
      var dom = dict.lookup_domain(d);
      if (dom == undefined) {
        any_missing = true;
      }
    });
    if (any_missing) {
      return undefined;
    }

    result["colors"] = colors_for_domains(result["domains"]);

    result["unlocked"] = generate_unlocked(smix);

    var gcounts = combined_counts(result["domains"]);

    for (var x = 0; x < 7; ++x) {
      smix = mix_seeds(smix, x, 950384);
      for (var y = 0; y < 7; ++y) {
        // Skip out-of-bounds regions:
        if (
          (x < 3 && y > 3 + x)
       || (x > 3 && y < x - 3)
        ) {
          continue;
        }
        // Mix the seed and sample a glyph: 
        smix = mix_seeds(smix, y, 3264615);
        result["glyphs"][x + y*7] = sample_glyph(gcounts, smix);
      }
    }

    return result;
  }

  function supertile_base_glyph(seed, sp, rp) {
    // The first level of supertile glyph generation ensures supertile
    // connectivity via edge-crossing words.
    var domains = generate_domains(seed, sp);
  }

  return {
    "sample_glyph": sample_glyph,
    "mix_seeds": mix_seeds,
    "generate_supertile": generate_supertile,
  };
});

