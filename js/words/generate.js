// generate.js
// Generates hex grid supertiles for word puzzling.

define(["./dict", "./grid", "./anarchy"], function(dict, grid, anarchy) {

  // Smoothing for table sampling.
  var SMOOTHING = 1.5;

  // Size of assignment region is this squared; should be large enough to
  // accommodate even a relatively large corpus (vocabulary, not count).
  // The units are ultragrid tiles.
  var ASSIGNMENT_REGION_SIDE = 1000;

  // Limits on the fraction of an available assignment grid spaces that can be
  // made up of inclusions. Computed as a fraction of remaining spaces after
  // MAX_LOCAL_INCLUSION_DENSITY and edge restrictions have been accounted for.
  // Actual inclusion density of each assignment grid tile is randomized.
  var MIN_INCLUSION_DENSITY = 0.03;
  var MAX_INCLUSION_DENSITY = 0.2;

  // Maximum fraction of a single ultragrid cell that can be assigned to
  // inclusions. Actually a fraction of the non-edge locations, instead of
  // fraction of the entire cell.
  var MAX_LOCAL_INCLUSION_DENSITY = 0.7;

  // roughness of inclusions distribution
  var INCLUSION_ROUGHNESS = 0.75;

  // Min/max sizes for inclusions (measured in assignment slots).
  // TODO: Use these?
  var INCLUSION_MIN_SIZE = 6;
  var INCLUSION_MAX_SIZE = 35;

  // All known combined domains.
  var DOMAIN_COMBOS = {
    //"base": [ "türk" ],
    "base": [ "adj", "adv", "noun", "verb" ]
  }

  // Relative frequency of different domains.
  var DOMAIN_WEIGHTS = {
    "türk": 5,
    "اللغة_العربية_الفصحى": 5,
    "base": 50
  }

  // Limits on the number of unlocked tiles per supertile:
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

  function mix_seeds(s1, s2, off) {
    // Mixes two seeds (variables) using a third offset (constant).
    return (
      anarchy.prng(s1, 1731)
    ^ anarchy.prng(s2, off)
    );
  }

  function sghash(seed, sgp) {
    // Hashes a seed and a supergrid position together into a combined seed
    // value.

    var r = anarchy.prng(
      sgp[0] ^ anarchy.prng(
        sgp[1],
        seed + 18921
      ),
      1748120
    );
    for (var i = 0; i < 1 + (sgp[0] + sgp[1] + seed) % 3; ++i) {
      r = anarchy.prng(r, seed);
    }
    return r;
  }

  function sample_table(table, seed) {
    // Samples a table of weights.
    var total_weight = 0;
    for (var e in table) {
      if (table.hasOwnProperty(e)) {
        total_weight += table[e] + SMOOTHING;
      }
    }
    var r = anarchy.udist(seed) * total_weight;

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
        array.push([k, w * anarchy.expdist(seed)]);
        seed = anarchy.lfsr(seed);
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
      seed = anarchy.lfsr(seed);
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
            var ov = anarchy.udist(seed);
            seed = anarchy.lfsr(seed);
            return ov < anarchy.udist(seed);
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

  function canonical_sgapos(sgap) {
    // Converts an arbitrary supergrid+assignment position combination to the
    // corresponding canonical combination. Assignment positions 4, 5, and 6
    // are mirrored to positions 0, 1, an 2, while positions 0--3 are
    // unchanged. The return value is an array with supergrid x,y followed by
    // canonical assignment position. The assignment positions are as follows,
    // with positions 0--3 being canonical:
    //
    //
    //                     1     ###     2
    //                        ###   ###
    //                     ###         ###
    //                  ###               ###
    //                  #                   #
    //                  #                   #
    //                0 #         3         # 4
    //                  #                   #
    //                  #                   #
    //                  ###               ###
    //                     ###         ###
    //                        ###   ###
    //                      6    ###     5
    //
    var x = sgap[0];
    var y = sgap[1];
    var asg_pos = sgap[2];
    if (asg_pos == 0) { // take from a neighbor
      x -= 1;
    } else if (asg_pos == 1) { // take from a neighbor
      x -= 1;
      y += 1;
    } else if (asg_pos == 2) { // take from a neighbor
      y += 1;
    } else if (asg_pos > 3) {
      asg_pos -= 3;
    }
    return [ x, y, asg_pos ];
  }

  function supergrid_alternate(sgap) {
    // Returns an array containing the supergrid position and assignment
    // position which overlap with the given position. Returns the inputs if
    // the given asg_position is 6 (center).
    var asg_pos = sgap[2];
    if (asg_pos == 0) {
      return [ sgap[0] - 1, sgap[1], 4 ];
    } else if (asg_pos == 1) {
      return [ sgap[0] - 1, sgap[1] + 1, 5 ];
    } else if (asg_pos == 2) {
      return [ sgap[0], sgap[1] + 1, 6 ];

    } else if (asg_pos == 4) {
      return [ sgap[0] + 1, sgap[1], 0 ];
    } else if (asg_pos == 5) {
      return [ sgap[0] + 1, sgap[1] - 1, 1 ];
    } else if (asg_pos == 6) {
      return [ sgap[0], sgap[1] - 1, 2 ];

    } else {
      // neighbor via asg_pos 3 (center) it just yourself
      return [ sgap[0], sgap[1], asg_pos ];
    }
  }

  function next_edge(asg_pos) {
    // Computes the next edge index for an assignment position, ignoring the
    // center position (the next edge for the center is the first edge).
    if (asg_pos == 3 || asg_pos == 6) {
      return 0;
    } else if (asg_pos == 2) {
      return 4;
    } else {
      return asg_pos + 1;
    }
  }

  function prev_edge(asg_pos) {
    // Computes the previous edge index for an assignment position, ignoring
    // the center position (the previous edge for the center is the last edge).
    if (asg_pos == 3 || asg_pos == 0) {
      return 6;
    } else if (asg_pos == 4) {
      return 2;
    } else {
      return asg_pos - 1;
    }
  }

  function supergrid_asg_neighbors(sgap) {
    // Returns a list of supergrid/assignment positions which are adjacent to
    // the given position. Each entry has three values: supergrid x,y and
    // assignment position. There are always six possible neighbors, and they
    // are returned in canonical form.
    if (sgap[2] == 3) { // center: all 6 edges are the neighbors
      return [
        canonical_sgapos([ sgap[0], sgap[1], 0 ]),
        canonical_sgapos([ sgap[0], sgap[1], 1 ]),
        canonical_sgapos([ sgap[0], sgap[1], 2 ]),
        canonical_sgapos([ sgap[0], sgap[1], 4 ]),
        canonical_sgapos([ sgap[0], sgap[1], 5 ]),
        canonical_sgapos([ sgap[0], sgap[1], 6 ])
      ];
    } else {
      var alt = supergrid_alternate(sgap);
      return [
        // adjacent edges on original supergrid tile:
        canonical_sgapos([ sgap[0], sgap[1], prev_edge(sgap[2]) ]),
        canonical_sgapos([ sgap[0], sgap[1], next_edge(sgap[2]) ]),
        // adjacent edges on alternate supergrid tile:
        canonical_sgapos([ alt[0], alt[1], prev_edge(alt[2]) ]),
        canonical_sgapos([ alt[0], alt[1], next_edge(alt[2]) ]),
        // centers of original and alternate tiles:
        [ sgap[0], sgap[1], 3 ],
        [ alt[0], alt[1], 3 ]
      ];
    }
  }

  function agpos(sgap) {
    // Takes a supergrid position and an assignment position (0--5 for sides
    // clockwise from left-vertical and 6 for center) and returns the
    // assignment grid position plus assignment grid number of that position on
    // that supergrid tile. Note that each assignment grid number is assigned
    // to two supergrid tiles, except the center position. For example, the
    // position-4 grid number for the tile at (0, 0) is also the position-1
    // grid number for the tile at (1, 0) because those tiles share that edge.
    var cp = canonical_sgapos(sgap);
    var asg_x = cp[0] / (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE);
    var asg_y = cp[1] / (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE);
    var x = cp[0] % (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE);
    var y = cp[1] % (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE);
    asg_pos = cp[2];
    return [
      asg_x,
      asg_y,
      (x * ASSIGNMENT_REGION_SIDE + y) * 4 + asg_pos
    ];
  }

  function supergrid_home(agp) {
    // The inverse of agpos, takes an assignment grid position
    // (grid indices and number) and returns the supergrid position of a
    // supergrid tile which includes the given assignment number, along with
    // the assignment position within that supergrid tile. The tile returned
    // will be the leftmost/bottommost of the two tiles which are assigned
    // given assignment number.
    var asg_x = agp[0];
    var asg_y = agp[1];
    var asg_number = agp[2];

    var asg_pos = asg_number % 4;
    var apg_xy = Math.floor(asg_number / 4);
    var y = asg_xy % (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE);
    var x = Math.floor(asg_xy / (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE));

    return [
      asg_x * (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE) + x,
      asg_y * (ASSIGNMENT_REGION_SIDE * grid.ULTRAGRID_SIZE) + y,
      asg_pos
    ];
  }

  function punctuated_agpos(sgap) {
    // Takes a supergrid position and an assignment position (0--6 clockwise
    // from left-vertical with 3 indicating center; see canonical_sgapos) and
    // returns an array containing:
    //
    //   x,y - assignment grid position
    //   n - assignment index
    //   m - multiplanar offset value


    // canonical supergrid position and ultragrid position of that:
    var cp = canonical_sgapos(sgap);
    var ugp = grid.ugpos(cp); // third entry is ignored

    // assignment grid position:
    var ag_x = ugp[0] / ASSIGNMENT_REGION_SIDE;
    var ag_y = ugp[1] / ASSIGNMENT_REGION_SIDE;
    var asg_pos = cp[2];

    // density of inclusions in this assignment grid unit:
    var d_seed = anarchy.lfsr(mix_seeds(ag_x, ag_y, 8190813480));
    var incl_density = (
      MIN_INCLUSION_DENSITY
    + anarchy.udist(d_seed) * (MAX_INCLUSION_DENSITY - MIN_INCLUSION_DENSITY)
    );
    d_seed = anarchy.lfsr(d_seed);

    // segment parameters:
    var segment = ugp[0] + ASSIGNMENT_REGION_SIDE * ugp[1];
    var n_segments = ASSIGNMENT_REGION_SIDE * ASSIGNMENT_REGION_SIDE;
    var segment_capacity = Math.floor(
      MAX_LOCAL_INCLUSION_DENSITY
    * (grid.ULTRAGRID_SIZE - 2)
    * (grid.ULTRAGRID_SIZE - 2)
    * 4 // assignment positions per supergrid tile
    );
    var segment_full_size = (
      grid.ULTRAGRID_SIZE
    * grid.ULTRAGRID_SIZE
    * 4 // assignment positions per supergrid tile
    );

    // total number of assignment slots reserved for inclusions:
    var incl_mass = Math.floor(
      incl_density
    * ASSIGNMENT_REGION_SIDE
    * ASSIGNMENT_REGION_SIDE
    * segment_capacity
    );

    // prior inclusions:
    var incl_prior = anarchy.distribution_prior_sum(
      segment,
      incl_mass,
      n_segments,
      segment_capacity,
      INCLUSION_ROUGHNESS,
      d_seed
    );

    // inclusions here:
    var incl_here = anarchy.distribution_portion(
      segment,
      incl_mass,
      n_segments,
      segment_capacity,
      INCLUSION_ROUGHNESS,
      d_seed // seed must be the same as in distribution_prior_sum above!
    );

    // prior natural (non-inclusion) assignments:
    var nat_prior = (segment_full_size * segment) - incl_prior;

    // TODO: HERE!
  }

  // TODO: HERE

  function generate_domains(seed, spos) {
    // Generates the domain list for the given supergrid position according to
    // the given seed.
    var smix = sghash(seed + 1, spos);

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
    hash = anarchy.lfsr(hash);
    var n_unlocked = MIN_UNLOCKED + (hash % (MAX_UNLOCKED - MIN_UNLOCKED));
    for (var i = 0; i < n_unlocked; ++i) {
      hash = anarchy.lfsr(hash);
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
    "canonical_sgapos": canonical_sgapos,
    "supergrid_alternate": supergrid_alternate,
    "supergrid_asg_neighbors": supergrid_asg_neighbors,
    "agpos": agpos,
    "supergrid_home": supergrid_home,
    "punctuated_agpos": punctuated_agpos,
  };
});

