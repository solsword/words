// generate.js
// Generates hex grid supertiles for word puzzling.

define([], function() {

  var SMOOTHING = 1.5;

  var DOMAIN_COMBOS = {
    "test_combined": [ "test", "test_combo" ]
  }

  var DOMAIN_WEIGHTS = {
    "test": 1,
    "test_combined": 1
  }

  var GLYPH_SET = {
    "A": 8.2,
    "B": 1.5,
    "C": 2.8,
    "D": 4.3,
    "E": 12.7,
    "F": 2.2,
    "G": 2.0,
    "H": 6.1,
    "I": 7.0,
    "J": 0.2,
    "K": 0.8,
    "L": 4.0,
    "M": 2.4,
    "N": 6.8,
    "O": 7.5,
    "P": 1.9,
    "Q": 0.1,
    "R": 6.0,
    "S": 6.3,
    "T": 9.0,
    "U": 2.8,
    "V": 1.0,
    "W": 2.4,
    "X": 0.2,
    "Y": 2.0,
    "Z": 0.1
  }
  // TODO: Derive this from a dictionary.

  var GS_TOTAL_WEIGHT = 0;

  function set_glyph_set(gs) {
    GLYPH_SET = gs;
    GS_TOTAL_WEIGHT = 0;
    for (var g in GLYPH_SET) {
      if (GLYPH_SET.hasOwnProperty(g)) {
        GS_TOTAL_WEIGHT += GLYPH_SET[g] + SMOOTHING;
      }
    }
  }

  // To compute GS_TOTAL_WEIGHT:
  set_glyph_set(GLYPH_SET);

  // TODO: Why are there too many A's?
  // (because my PRNG is BAD!)
  function sample_glyph(seed) {
    var r = (((seed * 1029830183) % 1e9) / 1e9) * GS_TOTAL_WEIGHT;
    // TODO: DEBUG
    //var r = Math.random() * GS_TOTAL_WEIGHT;
    var last = undefined;
    for (var g in GLYPH_SET) {
      if (GLYPH_SET.hasOwnProperty(g)) {
        selected = g;
        r -= GLYPH_SET[g] + SMOOTHING;
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

  function color_for_domains(domains) {
    // Returns a color value for a domain list.

    // TODO: HERE
    var colors = ["gr", "bl", "rd", "yl", "gn"]
    var cchoice = colors[Math.floor(Math.random()*colors.length)];

    return cchoice;
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

    result["color"] = color_for_domains(result["domains"]);

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
        result["glyphs"][x + y*7] = sample_glyph(smix);
      }
    }

    return result;
  }

  return {
    "set_glyph_set": set_glyph_set,
    "sample_glyph": sample_glyph,
    "mix_seeds": mix_seeds,
    "generate_supertile": generate_supertile,
  };
});

