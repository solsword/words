// generate.js
// Generates hex grid supertiles for word puzzling.

define(["./dict"], function(dict) {

  var SMOOTHING = 1.5;

  var DOMAIN_COMBOS = {
    "base": [ "adj", "adv", "noun", "verb" ],
    "all_mammals": [ "mammals", "monotremes" ],
    "all_plants": [ "us_plants", "plants" ],
    "all_bugs": [
      "insects",
      "spiders",
      "au_ants",
      "gb_ants",
      "gb_bees",
      "gb_wasps",
      "ca_butterflies"
    ],
    "big_animals": [
      "fish",
      "birds",
      "mammals",
      "monotremes",
      "amphibians",
      "reptiles"
    ],
    "all_animals": [
      "animals",
      "fish",
      "birds",
      "mammals",
      "monotremes",
      "amphibians",
      "reptiles",
      "all_bugs"
    ],
  }

  var DOMAIN_WEIGHTS = {
    "big_animals": 3,
    "all_bugs": 3,
    "all_plants": 3,
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
    var result =  ((((seed * 1029830183) << 5) - seed) % 1e9) / 1e9;
    if (result < 0) {
      result = -result;
    }
    return result;
  }

  function sample_table(table, seed) {
    // Samples a table of weights.
    var total_weight = 0;
    for (var e in table) {
      if (table.hasOwnProperty(e)) {
        total_weight += table[e] + SMOOTHING;
      }
    }
    var r = prng(seed) * total_weight;

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
    DOMAIN_COMBOS["base"].forEach(function (d) {
      if (!result.includes(d)) {
        result.push(d);
      }
    });
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
    // Merges two glyph counts, returning a new object.
    var result = {};
    for (var g in gs1) {
      if (gs1.hasOwnProperty(g)) {
        result[g] = gs1[g];
      }
    }
    for (var g in gs2) {
      if (gs2.hasOwnProperty(g)) {
        if (result.hasOwnProperty(g)) {
          result[g] += gs2[g];
        } else {
          result[g] = gs2[g];
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

  function generate_supertile(seed, spos) {
    // Takes a seed and a supertile position and generates the corresponding
    // supertile.
    //
    // TODO: Uses globally-known edge content to generate guaranteed inroads.
    var smix = sghash(seed, spos);

    var result = {
      "glyphs": Array(49),
      "domains": generate_domains(seed, spos)
    };

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

  return {
    "sample_glyph": sample_glyph,
    "mix_seeds": mix_seeds,
    "generate_supertile": generate_supertile,
  };
});

