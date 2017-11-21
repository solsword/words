// generate.js
// Generates hex grid supertiles for word puzzling.

define(["./dict"], function(dict) {

  var SMOOTHING = 1.5;

  var DOMAIN_COMBOS = {
    "test_combined": [ "test", "test_combo" ]
  }

  var DOMAIN_WEIGHTS = {
    "test": 1,
    "test_combined": 1
  }

  // TODO: Why are there too many A's?
  // (because my PRNG is BAD!)
  function sample_glyph(gcounts, seed) {
    // Sample a glyph from a counts dictionary, using the counts as weights.
    var total_weight = 0;
    for (var g in gcounts) {
      if (gcounts.hasOwnProperty(g)) {
        total_weight += gcounts[g] + SMOOTHING;
      }
    }
    var r = (((seed * 1029830183) % 1e9) / 1e9) * total_weight;
    // TODO: DEBUG
    //var r = Math.random() * GS_TOTAL_WEIGHT;
    var last = undefined;
    var selected = null;
    for (var g in gcounts) {
      if (gcounts.hasOwnProperty(g)) {
        selected = g;
        r -= gcounts[g] + SMOOTHING;
        if (r < 0) {
          break;
        }
      }
    }
    return selected;
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

    // TODO: HERE
    if (Math.random() < 0.7) {
      return ["test"];
    } else {
      return ["test_combo"];
    }
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

  function generate_supertile(seed, spos) {
    // Takes a seed and a supertile position and generates the corresponding
    // supertile.
    //
    // TODO: Uses globally-known edge content to generate guaranteed inroads.
    //
    // Note: the '| 0' is a hack to truncate to 32-bit int content.
    var smix = sghash(seed, spos);

    var result = {
      "glyphs": Array(49),
      "domains": generate_domains(seed, spos)
    };

    result["colors"] = colors_for_domains(result["domains"]);

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

