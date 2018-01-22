// generate.js
// Generates hex grid supertiles for word puzzling.

define(["./dict", "./grid", "./anarchy"], function(dict, grid, anarchy) {

  // Smoothing for table sampling.
  var SMOOTHING = 1.5;

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

  // Number of possible connections from each plane:
  var MULTIPLANAR_CONNECTIONS = 64;

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

  function ultratile_punctuation_parameters(ugp) {
    // Takes an ultragrid position and returns two values:
    //
    // 1. The number of non-inclusion assignment positions within this tile's
    //    assignment grid tile prior to it.
    // 2. The number of inclusion assignment positions within this ultragrid
    //    tile.

    // assignment grid position:
    var ag_x = ugp[0] / grid.ASSIGNMENT_REGION_SIDE;
    var ag_y = ugp[1] / grid.ASSIGNMENT_REGION_SIDE;

    // density of inclusions in this assignment grid unit:
    var d_seed = anarchy.lfsr(mix_seeds(ag_x, ag_y, 8190813480));
    var incl_density = (
      MIN_INCLUSION_DENSITY
    + anarchy.udist(d_seed) * (MAX_INCLUSION_DENSITY - MIN_INCLUSION_DENSITY)
    );
    d_seed = anarchy.lfsr(d_seed);

    // segment parameters:
    var segment = ugp[0] + grid.ASSIGNMENT_REGION_SIDE * ugp[1];
    var n_segments = grid.ASSIGNMENT_REGION_SIDE * grid.ASSIGNMENT_REGION_SIDE;
    var segment_capacity = Math.floor(
      MAX_LOCAL_INCLUSION_DENSITY
      grid.ULTRATILE_INTERIOR_SOCKETS
    );
    var segment_full_size = grid.ULTRATILE_SOCKETS;

    // total number of assignment slots reserved for inclusions:
    var incl_mass = Math.floor(
      incl_density
    * grid.ASSIGNMENT_REGION_SIDE
    * grid.ASSIGNMENT_REGION_SIDE
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

    return [ nat_prior, incl_here ];
  }

  function ultratile_muliplanar_info(ugp, seed) {
    // Takes an ultragrid position and computes multiplanar offset info for
    // each assignment position in that ultratile. Returns three things:
    // 1. The number of prior non-inclusion positions in this assignment tiles,
    //    as returned by ultratile_punctuation_parameters (see above).
    // 2. A flat array containing the multiplanar offset for each assignment
    //    position in the given ultragrid tile.
    // 3. A one-dimensional array containing the sum of the number of
    //    non-inclusion assignments on each row of the ultragrid.

    var r = sghash(seed + 489813, ugp);

    var info = ultratile_punctuation_parameters(ugp);
    var nat_prior = info[0];
    var incl_here = info[1];

    // initialize result to all-natural:
    var result = [];
    for (var i = 0; i < ULTRATILE_SOCKETS; ++i) {
      result[i] = 0;
    }

    var min_ni = incl_here / INCLUSION_MAX_SIZE;
    var max_ni = incl_here / INCLUSION_MIN_SIZE;

    var n_inclusions = anarchy.idist(r, min_ni, max_ni + 1);
    r = anarchy.lfsr(r);

    // compute the seed location and index of each inclusion:
    var iseeds = [];
    var isizes = [];
    var impi = [];
    var queues = [];
    for (var i = 0; i < n_inclusions; ++i) {
      // random (non-overlapping) seed from core sockets:
      iseeds[i] = (
        ULTRATILE_PRE_CORE
      + anarchy.cohort_shuffle(i, ULTRATILE_CORE_SOCKETS, r)
      );
      r = anarchy.lfsr(r);

      // zero size:
      isizes[i] = 0;

      // TODO: better here
      // random multiplanar index
      impi[i] = anarchy.idist(r, 0, MULTIPLANAR_CONNECTIONS);
      r = anarchy.lfsr(r);

      // seed is on the queue:
      queues[i] = [ iseeds[i] ];
    }

    // now iteratively expand each inclusion:
    var left = incl_here;
    var blocked = [];
    while (left > 0) {
      for (var i = 0; i < iseeds.length; ++i) { // each inclusion gets a turn
        // detect blocked inclusions:
        if (queues[i].length == 0) {
          if (isizes[i] >= INCLUSION_MIN_SIZE) {
            continue; // this inclusion will just be small
          } else {
            blocked.push(i); // must keep expanding!
          }
        }
        var loc = queues[i].shift();

        if (blocked.length > 0) {
          here = blocked.shift(); // steal the expansion point!
          i -= 1; // redo this iteration next
        } else {
          here = i;
        }

        // assign to this inclusion & decrement remaining:
        result[loc] = impi[here];
        left -= 1;

        // add neighbors to queue if possible:
        var x = (loc / grid.ASSIGNMENT_SOCKETS) % grid.ULTRAGRID_SIZE;
        var y = (loc / grid.ASSIGNMENT_SOCKETS) / grid.ULTRAGRID_SIZE;
        var a = loc % grid.ASSIGNMENT_SOCKETS;
        var neighbors = grid.supergrid_asg_neighbors([x, y, a]);
        for (var j = 0; j < neighbors.length; ++j) {
          var nb = neighbors[j];
          if (
            nb[0] > 0
         && nb[0] < grid.ULTRAGRID_SIZE - 1
            nb[1] > 0
         && nb[1] < grid.ULTRAGRID_SIZE - 1
          ) { // not on the edge (slight asymmetry, but that's alright).
            var nloc = (
              nb[0] * grid.ASSIGNMENT_SOCKETS
            + nb[1] * grid.ULTRAGRID_SIZE * grid.ASSIGNMENT_SOCKETS
            + nb[2]
            );
            var taken = false;
            // check for queue overlap
            for (var k = 0; k < queues.length; ++k) {
              if (queues[k].indexOf(nloc) >= 0) {
                taken = true;
                break;
              }
            }
            if (result[nloc] == 0 && !taken) {
              // add to queue in random position:
              // max of two rngs biases towards later indices, letting earlier
              // things mostly stay early.
              var idx = anarchy.idist(r, 0, queues[here].length);
              r = anarchy.lfsr(r);
              var alt_idx = anarchy.idist(r, 0, queues[here].length);
              r = anarchy.lfsr(r);
              if (alt_idx > idx) {
                idx = alt_idx;
              }
              queues[here].splice(idx, 0, nloc);
            }
          }
        }
      }
    }

    // now that our results matrix is done, compute row pre-totals
    var presums = [];
    var sum = 0;
    for (var y = 0; y < grid.ULTRAGRID_SIZE - 1; ++y) {
      presums.push(sum);
      for (var x = 0; x < grid.ULTRAGRID_SIZE * grid.ASSIGNMENT_SOCKETS; ++x) {
        var loc = x + y * grid.ULTRAGRID_SIZE * grid.ASSIGNMENT_SOCKETS;
        if (result[loc] == 0) {
          sum += 1;
        }
      }
    }

    // return our results:
    return [nat_prior, result, presums];
  }

  function punctuated_assignment_index(ugap, mpinfo, seed) {
    // Takes an ultragrid assignment position (ultratile x/y, sub x/y, and
    // assignment index) and corresponding ultragrid multiplanar offset info
    // (the result of ultratile_muliplanar_info above) and returns an array
    // containing:
    //
    //   x,y - assignment grid position
    //   n - assignment index
    //   m - multiplanar offset value
    //
    //   Note that the given ultragrid assignment position must be in canonical
    //   form, so that the correspondence with given mpinfo won't be broken.

    // unpack:
    var nat_prior = mpinfo[0];
    var mptable = mpinfo[1];
    var mpsums = mpinfo[2];

    var ut_x = ugp[0];
    var ut_y = ugp[1];
    var sub_x = ugp[2];
    var sub_y = ugp[3];
    var ap = ugp[4];

    // compute assignment tile:
    var asg_x = Math.floor(ut_x / grid.ASSIGNMENT_REGION_SIDE);
    var asg_y = Math.floor(ut_y / grid.ASSIGNMENT_REGION_SIDE);

    // linear index within ultratile:
    var lin = (
      (
        sub_x
      + sub_y * grid.ULTRAGRID_SIZE
      ) * grid.ASSIGNMENT_SOCKETS
    + ap
    );

    // get mutiplanar offset
    var mp_offset = mptable[lin];
    var asg_index = 0;
    var r = sghash(seed + 379238109821, [ut_x, ut_y])
    if (mp_offset == 0) { // natural: index determined by prior stuff
      var row = Math.floor(lin / grid.ULTRATILE_ROW_SOCKETS);
      asg_index = nat_prior + mpsums[row];
      // iterate from beginning of row to count local priors
      for (var here = sub_y * grid.ULTRATILE_ROW_SOCKETS; here < lin; ++here) {
        if (mptable[here] == 0) {
          asg_index += 1;
        }
      }
    } else { // inclusion: index determined by RNG
      // TODO: Pull these together near a destination?
      // compute a suitable seed value for this inclusion:
      var ir = r + mp_offset;
      for (var i = 0; i < (mp_offset % 7) + 2; ++i) {
        ir = anarchy.lfsr(r);
      }
      asg_index = anarchy.cohort_shuffle(
        lin,
        grid.ASSIGNMENT_REGION_TOTAL_SOCKETS,
        ir
      );
    }

    // Return values:
    return [ asg_x, asg_y, asg_index, mp_offset ];
  }

  function punctuated_assignment_lookup(agp, mp_offset) {
    // The inverse of punctuated_assignment_index (see above); this takes an
    // assignment position (assignment grid x/y and linear number) and a
    // multiplanar offset, and returns a (canonical) supergrid assignment
    // position that contains the indicated assignment index.

    // TODO: How to look up cached mpinfo?!?

    // unpack:
    var nat_prior = mpinfo[0];
    var mptable = mpinfo[1];
    var mpsums = mpinfo[2];

    var asg_x = agp[0];
    var asg_y = agp[1];
    var ap = agp[2];

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
    "punctuated_agpos": punctuated_agpos,
    "ultratile_punctuation_parameters": ultratile_punctuation_parameters,
    "ultratile_muliplanar_info": ultratile_muliplanar_info,
    "punctuated_agpos": punctuated_agpos,
  };
});

