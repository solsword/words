// generate.js
// Generates hex grid supertiles for word puzzling.

define(
["anarchy", "./dict", "./grid", "./dimensions", "./caching"],
function(anarchy, dict, grid, dimensions, caching) {

  // Whether or not to issue warnings to the console.
  var WARNINGS = true;

  // Whether to show sockets using tile colors or not.
  var DEBUG_SHOW_SOCKETS = false;

  function toggle_socket_colors() {
    DEBUG_SHOW_SOCKETS = !DEBUG_SHOW_SOCKETS;
  }

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
  var INCLUSION_MIN_SIZE = 6;
  var INCLUSION_MAX_SIZE = 35;

  // Cache size for multiplanar info:
  var MULTIPLANAR_INFO_CACHE_SIZE = 4096;

  // All known combined domains.
  var DOMAIN_COMBOS = {
    //"base": [ "türk" ],
    "base": [ "adj", "adv", "noun", "verb" ]
  };

  var BASE_PERMUTATIONS = [
    // 46, defined in the SE socket including anchors (see EDGE_SOCKET_ANCHORS)

    // 16 from the top-left
    [0, [ grid.NE, grid.NE, grid.S, grid.SW, grid.SE ]],
    [0, [ grid.NE, grid.NE, grid.S, grid.S, grid.NW ]],
    [0, [ grid.NE, grid.SE, grid.N ]],
    [0, [ grid.NE, grid.SE, grid.SW, grid.SE ]],
    [0, [ grid.NE, grid.SE, grid.S, grid.NW ]],
    [0, [ grid.NE, grid.S, grid.SE, grid.N, grid.N ]],
    [0, [ grid.NE, grid.S, grid.NE, grid.N ]],
    [0, [ grid.NE, grid.S, grid.NE, grid.S ]],

    [0, [ grid.SE, grid.N, grid.NE, grid.S, grid.S ]],
    [0, [ grid.SE, grid.N, grid.SE, grid.N ]],
    [0, [ grid.SE, grid.N, grid.SE, grid.S ]],
    [0, [ grid.SE, grid.NE, grid.NW, grid.NE ]],
    [0, [ grid.SE, grid.NE, grid.N, grid.SW ]],
    [0, [ grid.SE, grid.NE, grid.S ]],
    [0, [ grid.SE, grid.SE, grid.N, grid.NW, grid.NE ]],
    [0, [ grid.SE, grid.SE, grid.N, grid.N, grid.SW ]],

    // 14 from the middle
    [1, [ grid.NW, grid.NE, grid.NE, grid.S, grid.S ]],
    [1, [ grid.NW, grid.NE, grid.SE, grid.N ]],
    [1, [ grid.NW, grid.NE, grid.SE, grid.S ]],

    [1, [ grid.N, grid.SW ]],
    [1, [ grid.N, grid.NE, grid.S, grid.S ]],
    [1, [ grid.N, grid.SE, grid.N ]],
    [1, [ grid.N, grid.SE, grid.S ]],

    [1, [ grid.NE, grid.S ]],
    [1, [ grid.NE, grid.NW, grid.SW ]],
    [1, [ grid.NE, grid.NW, grid.NE ]],
    [1, [ grid.NE, grid.N, grid.SW, grid.SW ]],

    [1, [ grid.SE, grid.N, grid.NW, grid.SW ]],
    [1, [ grid.SE, grid.N, grid.NW, grid.NE ]],
    [1, [ grid.SE, grid.N, grid.N, grid.SW, grid.SW ]],

    // 16 from the bottom-right
    [2, [ grid.NW, grid.NW, grid.NE, grid.NE, grid.S ]],
    [2, [ grid.NW, grid.NW, grid.NE, grid.SE, grid.N ]],
    [2, [ grid.NW, grid.N, grid.SW ]],
    [2, [ grid.NW, grid.N, grid.NE, grid.S ]],
    [2, [ grid.NW, grid.N, grid.SE, grid.N ]],
    [2, [ grid.NW, grid.NE, grid.NW, grid.SW ]],
    [2, [ grid.NW, grid.NE, grid.NW, grid.NE ]],
    [2, [ grid.NW, grid.NE, grid.N, grid.SW, grid.SW ]],

    [2, [ grid.N, grid.SW, grid.NW, grid.NE, grid.NE ]],
    [2, [ grid.N, grid.SW, grid.N, grid.SW ]],
    [2, [ grid.N, grid.SW, grid.N, grid.NE ]],
    [2, [ grid.N, grid.NW, grid.SW, grid.SE ]],
    [2, [ grid.N, grid.NW, grid.S, grid.NW ]],
    [2, [ grid.N, grid.NW, grid.NE ]],
    [2, [ grid.N, grid.N, grid.SW, grid.SW, grid.SE ]],
    [2, [ grid.N, grid.N, grid.SW, grid.S, grid.NW ]],
  ]

  var EDGE_SOCKET_ANCHORS = [
    [ [0, 3], [0, 2], [0, 1] ],
    [ [3, 6], [2, 5], [1, 4] ],
    [ [6, 6], [5, 6], [4, 6] ],
    [ [6, 3], [6, 4], [6, 5] ],
    [ [3, 0], [4, 1], [5, 2] ],
    [ [0, 0], [1, 0], [2, 0] ],
  ]

  // Which permutation-site-value combinations are valid for crossover
  var CROSSOVER_POINTS = [
    [1, 2],
    [2, 1],
    [2, 2]
  ];

  // Add rotations to compute per-socket permutations:
  var SOCKET_PERMUTATIONS = [];
  var rotated = BASE_PERMUTATIONS;
  for (var socket = 0; socket < grid.COMBINED_SOCKETS; ++socket) {
    SOCKET_PERMUTATIONS.push([]);
    for (var i = 0; i < rotated.length; ++i) {
      var site = rotated[i][0];
      var path = rotated[i][1];
      // Base is defined for socket 6, so rotate before appending:
      rotated[i] = [ site, grid.rotate_path(path, 1) ];
      SOCKET_PERMUTATIONS[socket].push(
        [ rotated[i][0], EDGE_SOCKET_ANCHORS[socket][site], rotated[i][1] ]
      );
    }
  }

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

  function sample_glyph(seed, context, unicounts, bicounts, tricounts) {
    // Sample a glyph from counts given context, falling back to smaller
    // amounts of context/less complicated counts when other info isn't
    // available. context, bicounts, and tricounts may individually be given as
    // 'undefined.'
    var table = undefined;
    if (context != undefined && context.length >= 2 && tricounts != undefined) {
      // try tricounts
      if (tricounts.hasOwnProperty(context[0])) {
        if (tricounts[context[0]].hasOwnProperty(context[1])) {
          table = tricounts[context[0]][context[1]];
        }
      }
    }
    if (
      table == undefined
   && context != undefined
   && context.length >= 1
   && bicounts != undefined
    ) {
      // try bicounts
      if (bicounts.hasOwnProperty(context[0])) {
        table = bicounts[context[0]];
      }
    }
    if (table == undefined) {
      // unicounts must be given!
      table = unicounts;
    }
    return sample_table(table, seed);
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

    var ug_x = ugp[0] % grid.ASSIGNMENT_REGION_SIDE;
    var ug_y = ugp[1] % grid.ASSIGNMENT_REGION_SIDE;
    ug_x = (ug_x + grid.ASSIGNMENT_REGION_SIDE) % grid.ASSIGNMENT_REGION_SIDE;
    ug_y = (ug_y + grid.ASSIGNMENT_REGION_SIDE) % grid.ASSIGNMENT_REGION_SIDE;

    // density of inclusions in this assignment grid unit:
    var d_seed = anarchy.lfsr(mix_seeds(ag_x, ag_y, 8190813480));
    var incl_density = (
      MIN_INCLUSION_DENSITY
    + anarchy.udist(d_seed) * (MAX_INCLUSION_DENSITY - MIN_INCLUSION_DENSITY)
    );
    d_seed = anarchy.lfsr(d_seed);

    // segment parameters:
    var segment = ug_x + grid.ASSIGNMENT_REGION_SIDE * ug_y;
    var n_segments = grid.ASSIGNMENT_REGION_SIDE * grid.ASSIGNMENT_REGION_SIDE;
    var segment_capacity = Math.floor(
      MAX_LOCAL_INCLUSION_DENSITY
    * grid.ULTRATILE_INTERIOR_SOCKETS
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

  function assignment_punctuation_parameters(agp) {
    // The converse of ultratile_punctuation_parameters, this looks up the same
    // parameters using the assignment position (assignment grid coordinates
    // plus linear assignment number in that tile) instead of the ultratile
    // position. Returns the discovered ultratile position as well as the prior
    // and inclusion information, structured as follows:
    //
    // [
    //   [ ultragrid_x, ultragrid_y ],
    //   [ nat_prior, incl_here ]
    // ]

    var ag_x = agp[0];
    var ag_y = agp[1];
    var ag_idx = agp[2];

    // density of inclusions in this assignment grid unit:
    var d_seed = anarchy.lfsr(mix_seeds(ag_x, ag_y, 8190813480));
    var incl_density = (
      MIN_INCLUSION_DENSITY
    + anarchy.udist(d_seed) * (MAX_INCLUSION_DENSITY - MIN_INCLUSION_DENSITY)
    );
    d_seed = anarchy.lfsr(d_seed);

    // segment parameters:
    var segment_full_size = grid.ULTRATILE_SOCKETS;
    var n_segments = grid.ASSIGNMENT_REGION_SIDE * grid.ASSIGNMENT_REGION_SIDE;
    var segment_capacity = Math.floor(
      MAX_LOCAL_INCLUSION_DENSITY
    * grid.ULTRATILE_INTERIOR_SOCKETS
    );

    // total number of assignment slots reserved for inclusions:
    var incl_mass = Math.floor(
      incl_density
    * grid.ASSIGNMENT_REGION_SIDE
    * grid.ASSIGNMENT_REGION_SIDE
    * segment_capacity
    );

    // compute segment:
    var segment = anarchy.distribution_segment(
      ag_idx,
      incl_mass,
      n_segments,
      segment_capacity,
      INCLUSION_ROUGHNESS,
      d_seed
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

    // back out (global) ultragrid position:
    var ugp = [
      (
        (segment % grid.ASSIGNMENT_REGION_SIDE)
      + (ag_x * grid.ASSIGNMENT_REGION_SIDE)
      ),
      (
        Math.floor(segment / grid.ASSIGNMENT_REGION_SIDE)
      + (ag_y * grid.ASSIGNMENT_REGION_SIDE)
      )
    ];

    return [
      ugp,
      [ nat_prior, incl_here ]
    ];
  }

  function ultratile_muliplanar_info(ugp, seed) {
    // Takes an ultragrid position and computes multiplanar offset info for
    // each assignment position in that ultratile. Returns three things:
    // 1. The number of prior non-inclusion positions in this assignment tile,
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
    for (var i = 0; i < grid.ULTRATILE_SOCKETS; ++i) {
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
        grid.ULTRATILE_PRE_CORE
      + anarchy.cohort_shuffle(i, grid.ULTRATILE_CORE_SOCKETS, r)
      );
      r = anarchy.lfsr(r);

      // zero size:
      isizes[i] = 0;

      // TODO: better here
      // random multiplanar index
      impi[i] = anarchy.idist(r, 0, dimensions.MULTIPLANAR_CONNECTIONS);
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
            continue;
          }
        }
        var loc = queues[i].shift();
        if (isNaN(loc)) {
          console.log("NAN");
          console.log(queues);
          return undefined;
        }

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
        var x = Math.floor(loc / grid.ASSIGNMENT_SOCKETS) % grid.ULTRAGRID_SIZE;
        var y = Math.floor(
          loc / (grid.ASSIGNMENT_SOCKETS * grid.ULTRAGRID_SIZE)
        );
        var a = loc % grid.ASSIGNMENT_SOCKETS;
        var neighbors = grid.supergrid_asg_neighbors([x, y, a]);
        for (var j = 0; j < neighbors.length; ++j) {
          var nb = neighbors[j];
          if (
            nb[0] > 0
         && nb[0] < grid.ULTRAGRID_SIZE - 1
         && nb[1] > 0
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
    // final row:
    presums.push(sum);

    // return our results:
    return [nat_prior, result, presums];
  }
  // register ultratile_multiplanar_info as a caching domain:
  caching.register_domain(
    "ultratile_multiplanar_info", 
    function (ugp, seed) {
      return ugp[0] + "," + ugp[1] + ":" + seed
    },
    ultratile_muliplanar_info,
    MULTIPLANAR_INFO_CACHE_SIZE
  );

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

    var ut_x = ugap[0];
    var ut_y = ugap[1];
    var sub_x = ugap[2];
    var sub_y = ugap[3];
    var ap = ugap[4];

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

  function punctuated_assignment_lookup(agp, mp_offset, seed) {
    // The inverse of punctuated_assignment_index (see above); this takes an
    // assignment position (assignment grid x/y and linear number) and a
    // multiplanar offset, and returns a (canonical) supergrid assignment
    // position that contains the indicated assignment index. If suitable
    // cached multiplanar offset info isn't yet available, this will return
    // null. Use caching.with_cached_value to execute code as soon as the info
    // becomes available.

    // TODO: How to look up cached mpinfo?!?

    var asg_x = agp[0];
    var asg_y = agp[1];
    var asg_idx = agp[2];

    var params = assignment_punctuation_parameters(agp);
    var ugp = params[0];
    var nat_prior = params[1][0];
    var incl_here = params[1][1];

    // fetch mpinfo or fail:
    mpinfo = caching.cached_value(
      "ultratile_multiplanar_info", 
      [ ugp, seed ]
    );
    if (mpinfo == null) {
      return undefined;
    }

    // unpack:
    var nat_prior = mpinfo[0];
    var mptable = mpinfo[1];
    var mpsums = mpinfo[2];

    var internal_idx = asg_idx - nat_prior;
    var prior_row = max_smaller(internal_idx, mpsums);
    var before = 0;
    if (prior_row > -1) {
      before = mpsums[prior_row];
    }
    var in_row_idx = asg_idx - nat_prior - before;
    var col_idx = 0;
    for (
      var mp_idx = grid.ULTRATILE_ROW_SOCKETS * prior_row;
      mp_idx < grid.ULTRATILE_ROW_SOCKETS * (prior_row + 1);
      mp_idx += 1
    ) {
      if (in_row_idx == 0) {
        break;
      }
      if (mptable[mp_idx] == 0) {
        in_row_idx -= 1;
        col_idx += 1;
      }
    }

    // Escape the assignment grid tile and our ultragrid tile within that
    // assignment grid tile to get a global supergrid position along with an
    // assignment socket index.
    return [
      (
        (asg_x * grid.ASSIGNMENT_REGION_SIDE + ugp[0]) * grid.ULTRAGRID_SIZE
      + Math.floor(col_idx / grid.ASSIGNMENT_SOCKETS)
      ),
      (
        (asg_y * grid.ASSIGNMENT_REGION_SIDE + ugp[1]) * grid.ULTRAGRID_SIZE
      + prior_row + 1
      ),
      col_idx % grid.ASSIGNMENT_SOCKETS
    ];
  }

  function pick_word(domains, asg, seed) {
    // Given an assignment position (assignment grid x/y and assignment index)
    // and a seed, returns the corresponding word from the given domain list.
    // If required domain information isn't available, returns undefined.
    //
    // Returns a domain entry, which is a [glyphs, word, frequency] triple.
    //
    // TODO: Handle words that are too big for their sockets!

    var any_missing = false;
    var grand_total = 0;
    var lesser_total = 0;
    var greater_counttable = [];
    var lesser_counttable = [];
    var domain_objects = [];
    domains.forEach(function (d) {
      var dom = dict.lookup_domain(d);
      if (dom == undefined) {
        any_missing = true;
      } else {
        domain_objects.push(dom);
        greater_counttable.push(dom.total_count);
        grand_total += dom.total_count;
        lesser_counttable.push(dom.entries.length);
        lesser_total += dom.entries.length;
      }
    });
    if (any_missing) {
      return undefined;
    }
    if (WARNINGS && lesser_total > grid.ASSIGNMENT_REGION_TOTAL_SOCKETS) {
      console.log(
        "Warning: domain (combo?) size exceeds number of assignable sockets: "
      + grand_total + " > " + grid.ASSIGNMENT_REGION_TOTAL_SOCKETS
      )
    }

    var r = sghash(seed, asg);

    var idx = anarchy.cohort_shuffle(
      asg[2],
      grid.ASSIGNMENT_REGION_TOTAL_SOCKETS,
      r
    );
    r = anarchy.lfsr(r);

    if (idx < lesser_total) { // one of the per-index assignments
      var ct_idx = 0;
      for (ct_idx = 0; ct_idx < lesser_counttable.length; ++ct_idx) {
        var here = lesser_counttable[ct_idx];
        if (idx < here) {
          break;
        }
        idx -= here;
      }
      var dom = domain_objects[ct_idx];
      if (WARNINGS && ct_idx == lesser_counttable.length) {
        console.log("Warning: lesser couttable loop failed to break!");
        ct_idx = lesser_counttable.length - 1;
        idx %= dom.entries.length;
      }
      return dom.entries[idx]; // all words get equal representation
    } else {
      idx -= lesser_total;
      idx %= grand_total;
      var ct_idx = 0;
      for (ct_idx = 0; ct_idx < greater_counttable.length; ++ct_idx) {
        var here = greater_counttable[ct_idx];
        if (idx < here) {
          break;
        }
        idx -= here;
      }
      if (WARNINGS && ct_idx == greater_counttable.length) {
        console.log("Warning: greater counttable loop failed to break!");
        ct_idx = greater_counttable.length - 1;
        idx %= dict.total_count;
      }
      var dom = domain_objects[ct_idx];
      return dict.unrolled_word(idx, dom); // representation according to freq
    }
  }

  function filter_permutations(permutations, site, min_length) {
    // Takes a permutation list containing permutations listed as site-index,
    // starting-coordinates, move-list triples, and filters for a list
    // containing only permutations that are at the given site and which are at
    // least the given minimum length (min_length shouldn't exceed the socket
    // size, or the result will be an empty list). If site is given as -1,
    // results for all sites are returned.
    //
    // TODO: Merge cut-equal paths to avoid biasing shape distribution of
    // shorter words?
    var result = [];
    for (var i = 0; i < permutations.length; ++i) {
      if (
        permutations[i][2].length >= min_length
     && (site < 0 || permutations[i][0] == site)
      ) {
        result.push( // deepish copy
          [
            permutations[i][0],
            permutations[i][1],
            permutations[i][2].slice()
          ]
        );
      }
    }
    return result;
  }

  function inlay_word(supertile, glyphs, socket, seed) {
    // Fits a word (or part of it, for edge-adjacent sockets) into the given
    // socket of the given supertile, updating the glyphs array. Returns a list
    // of tile positions updated.
    var result = [];
    var r = anarchy.lfsr(seed + 1892831081);
    var chosen;

    // Choose a permutation:

    // First pick the crossover point:
    var xo = CROSSOVER_POINTS[anarchy.idist(r, 0, CROSSOVER_POINTS.length)];
    r = anarchy.lfsr(r);
    var site = 2;
    if (grid.is_canonical(socket)) {
      site = xo[0];
    } else {
      site = xo[1];
    }

    var filtered = filter_permutations(
      SOCKET_PERMUTATIONS[socket],
      site,
      glyphs.length - 1 // path connects glyphs
    );
    // TODO: How can we end up with > 5 glyphs?!?
    var cidx = anarchy.idist(r, 0, filtered.length);
    chosen = filtered[cidx]

    // Finally, punch in the glyphs:
    var pos = chosen[1];
    var path = chosen[2];
    for (var i = 0; i < glyphs.length; ++i) {
      supertile.glyphs[pos[0] + pos[1]*grid.SUPERTILE_SIZE] = glyphs[i];
      result.push(pos);
      if (i < glyphs.length - 1) {
        pos = grid.neighbor(pos, path[i]);
      }
    }

    return result;
  }

  function generate_supertile(dimension, sgp, seed) {
    // Given that the necessary domain(s) and multiplanar info are all
    // available, generates the glyph contents of the supertile at the given
    // position in the given dimension. Returns undefined if there's missing
    // information.

    var result = {
      "dimension": dimension,
      "glyphs": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
      "colors": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
      "domains": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
    };

    var default_domain = dimensions.natural_domain(dimension);

    seed ^= dimension;
    for (var i = 0; i < (dimension % 5) + 3; ++i) {
      seed = anarchy.prng(seed);
    }

    // set glyphs, colors, and domains to undefined:
    for (var i = 0; i < grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE; ++i) {
      result.glyphs[i] = undefined;
      result.colors[i] = [];
      result.domains[i] = undefined;
    }

    // Pick a word for each socket and embed it (or the relevant part of it).
    for (var socket = 0; socket < grid.COMBINED_SOCKETS; socket += 1) {
      var sgap = grid.canonical_sgapos([sgp[0], sgp[1], socket]);
      var ugp = grid.ugpos(sgap); // socket index is ignored
      var mpinfo = caching.cached_value(
        "ultratile_multiplanar_info",
        [ [ ugp[0], ugp[1] ], seed ]
      );
      if (mpinfo == null) {
        return undefined;
      }

      var asg = punctuated_assignment_index(
        [ ugp[0], ugp[1], ugp[2], ugp[3], sgap[2] ],
        mpinfo,
        seed
      );
      var asg_x = asg[0];
      var asg_y = asg[1];
      var asg_idx = asg[2];
      var mpo = asg[3];
      var l_seed = sghash(seed, asg);
      var r = anarchy.lfsr(l_seed);

      var mdim = dimensions.neighboring_dimension(dimension, mpo)
      var domain = dimensions.natural_domain(mdim);

      // Ensure domain(s) are loaded:
      var dl = domains_list(domain);
      var any_undef = false;
      for (var i = 0; i < dl.length; ++i) {
        var def = dict.lookup_domain(dl[i]);
        if (def == undefined) {
          any_undef = true;
        }
      }
      if (any_undef) {
        return undefined;
      }

      // Pick a word for this socket:
      var entry = pick_word(dl, asg, l_seed);
      if (entry == undefined) {
        return undefined;
      }

      // TODO: Handle longer words gracefully
      var glyphs = entry[0].slice();
      var maxlen = 12;

      // pick embedding direction & portion to embed
      var flip = (r % 2) == 0;
      r = anarchy.lfsr(r);
      var half_max = Math.floor(maxlen / 2);
      var min_cut = glyphs.length - half_max;
      var max_cut = half_max;
      if (min_cut == max_cut) {
        var cut = min_cut;
      } else if (min_cut > max_cut) {
        // TODO: Handle these overlength words properly!
        glyphs = glyphs.slice(0, maxlen);
        cut = half_max;
      } else {
        var cut = anarchy.idist(r, min_cut, max_cut + 1);
      }
      r = anarchy.lfsr(r);
      if (flip ^ grid.is_canonical(socket)) { // take first half
        glyphs = glyphs.slice(0, cut);
        // and reverse ordering
        glyphs = glyphs.split("").reverse().join("");
      } else {
        glyphs = glyphs.slice(cut);
      }
      var touched = inlay_word(result, glyphs, socket, r);
      for (var i = 0; i < touched.length; ++i) {
        var idx = touched[i][0] + touched[i][1]*grid.SUPERTILE_SIZE;
        result.domains[idx] = domain;
        result.colors[idx] = colors_for_domains(dl);
        if (DEBUG_SHOW_SOCKETS) {
          result.colors[idx].push(
            ["bl", "yl", "gn"][socket % 3]
          );
        }
      }
    }
    r = anarchy.lfsr(r);

    // Now that each socket has been inlaid, fill remaining spots with letters
    // according to unigram, bigram, and trigram probabilities.
    var sseed = r;
    var baseline_counts = {}; // combined glyph counts caches
    var binary_counts = {};
    var trinary_counts = {};
    for (var i = 0; i < grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE; ++i) {
      var u = anarchy.cohort_shuffle(
        i,
        grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE,
        sseed
      ); // iterate in shuffled order
      var x = u % grid.SUPERTILE_SIZE;
      var y = Math.floor(u / grid.SUPERTILE_SIZE);
      if (!grid.is_valid_subindex([x, y])) { // skip out-of-bounds indices
        continue;
      }
      if (result.glyphs[u] == undefined) { // need to fill it in
        var neighbors = []; // list filled-in neighbors
        var nbdoms = []; // list their domains
        for (var j = 0; j < 6; ++j) {
          var nb = grid.neighbor([x, y], j);
          var ni = nb[0] + nb[1]*grid.SUPERTILE_SIZE;
          var ng = result.glyphs[ni];
          if (ng != undefined) {
            neighbors.push(ng);
            nbdoms.push(result.domains[ni]);
          }
        }

        // Simplify mixed-domain neighbors list to single-domain + glyphs list:
        var nbdom = undefined;
        var nbglyphs = undefined;
        if (neighbors.length == 0) { // should be rare
          nbdom = default_domain;
          nbglyphs = [];
        } else if (neighbors.length == 1) {
          nbdom = nbdoms[0];
          nbglyphs = neighbors[0];
        } else if (neighbors.length == 2) {
          if (nbdoms[0] == nbdoms[1]) {
            nbdom = nbdoms[0];
            nbglyphs = neighbors.slice();
          } else {
            var ri = (r & 0x10) >>> 4; // check an arbitrary bit
            r = anarchy.lfsr(r);
            nbdom = nbdoms[ri];
            nbglyphs = [ neighbors[ri] ];
          }
        } else { // more than 2 neighbors: pick some
          var maxdom = undefined;
          var maxcount = 0;
          var domcounts = {};
          var domglyphs = {};
          for (var j = 0; j < nbdoms.length; ++j) {
            if (domcounts.hasOwnProperty(nbdoms[j])) {
              domcounts[nbdoms[j]] += 1;
              domglyphs[nbdoms[j]].push(neighbors[j]);
            } else {
              domcounts[nbdoms[j]] = 1;
              domglyphs[nbdoms[j]] = [ neighbors[j] ];
            }
            if (domcounts[nbdoms[j]] > maxcount) {
              maxcount = domcounts[nbdoms[j]];
              maxdom = nbdoms[j];
            }
          }
          nbdom = maxdom;
          nbglyphs = domglyphs[maxdom];
        }

        // Now that we have single-domain neighbors, pick a glyph:
        result.domains[u] = nbdom;
        result.colors[u] = colors_for_domains(domains_list(nbdom));
        var unicounts = undefined;
        var bicounts = undefined;
        var tricounts = undefined;
        if (nbglyphs.length == 0) {
          if (baseline_counts.hasOwnProperty(nbdom)) {
            unicounts = baseline_counts[nbdom];
          } else {
            unicounts = combined_counts(domains_list(nbdom));
            baseline_counts[nbdom] = unicounts;
          }
          result.glyphs[u] = sample_glyph(r, undefined, unicounts);
          r = anarchy.lfsr(r);
        } else if (nbglyphs.length == 1) {
          if (baseline_counts.hasOwnProperty(nbdom)) {
            unicounts = baseline_counts[nbdom];
          } else {
            unicounts = combined_counts(domains_list(nbdom));
            baseline_counts[nbdom] = unicounts;
          }
          if (binary_counts.hasOwnProperty(nbdom)) {
            bicounts = binary_counts[nbdom];
          } else {
            bicounts = combined_bicounts(domains_list(nbdom));
            binary_counts[nbdom] = bicounts;
          }
          result.glyphs[u] = sample_glyph(
            r,
            nbglyphs[0],
            unicounts,
            bicounts
          );
          r = anarchy.lfsr(r);
        } else if (nbglyphs.length >= 2) {
          // TODO: Shuffle first here?
          nbglyphs = nbglyphs.slice(0,2);
          if (baseline_counts.hasOwnProperty(nbdom)) {
            unicounts = baseline_counts[nbdom];
          } else {
            unicounts = combined_counts(domains_list(nbdom));
            baseline_counts[nbdom] = unicounts;
          }
          if (binary_counts.hasOwnProperty(nbdom)) {
            bicounts = binary_counts[nbdom];
          } else {
            bicounts = combined_bicounts(domains_list(nbdom));
            binary_counts[nbdom] = bicounts;
          }
          if (trinary_counts.hasOwnProperty(nbdom)) {
            tricounts = trinary_counts[nbdom];
          } else {
            tricounts = combined_tricounts(domains_list(nbdom));
            trinary_counts[nbdom] = tricounts;
          }
          result.glyphs[u] = sample_glyph(
            r,
            nbglyphs,
            unicounts,
            bicounts,
            tricounts
          );
          r = anarchy.lfsr(r);
        }
      }
    }

    // all glyphs have been filled in, we're done here!
    return result;
  }

  function colors_for_domains(domains) {
    // Returns a color value for a domain list, or undefined if one or more of
    // the given domains aren't loaded yet.
    var result = [];
    domains.forEach(function (d) {
      var dom = dict.lookup_domain(d);
      if (dom == undefined) {
        return undefined;
      }
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

  function merge_glyph_bicounts(gs1, gs2) {
    // Merges two-layer nested frequency counts.
    var result = {};
    var gs1_total = 0;
    var gs2_total = 0;
    for (var g in gs1) {
      if (gs1.hasOwnProperty(g)) {
        for (var gg in gs1[g]) {
          if (gs1[g].hasOwnProperty(gg)) {
            gs1_total += gs1[g][gg];
          }
        }
      }
    }
    for (var g in gs2) {
      if (gs2.hasOwnProperty(g)) {
        for (var gg in gs2[g]) {
          if (gs2[g].hasOwnProperty(gg)) {
            gs2_total += gs2[g][gg];
          }
        }
      }
    }
    for (var g in gs1) {
      if (gs1.hasOwnProperty(g)) {
        result[g] = {};
        for (var gg in gs1[g]) {
          if (gs1[g].hasOwnProperty(gg)) {
            result[g][gg] = gs1[g][gg] / gs1_total;
          }
        }
      }
    }
    for (var g in gs2) {
      if (gs2.hasOwnProperty(g)) {
        if (result.hasOwnProperty(g)) {
          for (var gg in gs2[g]) {
            if (gs2[g].hasOwnProperty(gg)) {
              if (result[g].hasOwnProperty(gg)) {
                result[g][gg] += gs2[g][gg] / gs2_total;
              } else {
                result[g][gg] = gs2[g][gg] / gs2_total;
              }
            }
          }
        } else {
          result[g] = {};
          for (var gg in gs2[g]) {
            if (gs2[g].hasOwnProperty(gg)) {
              result[g][gg] = gs2[g][gg] / gs2_total;
            }
          }
        }
      }
    }
    return result;
  }

  function merge_glyph_tricounts(gs1, gs2) {
    // Merges three-layer nested frequency counts.
    var result = {};
    var gs1_total = 0;
    var gs2_total = 0;
    for (var g in gs1) {
      if (gs1.hasOwnProperty(g)) {
        for (var gg in gs1[g]) {
          if (gs1[g].hasOwnProperty(gg)) {
            for (var ggg in gs1[g][gg]) {
              if (gs1[g][gg].hasOwnProperty(ggg)) {
                gs1_total += gs1[g][gg][ggg];
              }
            }
          }
        }
      }
    }
    for (var g in gs2) {
      if (gs2.hasOwnProperty(g)) {
        for (var gg in gs2[g]) {
          if (gs2[g].hasOwnProperty(gg)) {
            for (var ggg in gs2[g][gg]) {
              if (gs2[g][gg].hasOwnProperty(ggg)) {
                gs2_total += gs2[g][gg][ggg];
              }
            }
          }
        }
      }
    }
    for (var g in gs1) {
      if (gs1.hasOwnProperty(g)) {
        result[g] = {};
        for (var gg in gs1[g]) {
          if (gs1[g].hasOwnProperty(gg)) {
            result[g][gg] = {};
            for (var ggg in gs1[g][gg]) {
              result[g][gg][ggg] = gs1[g][gg][ggg] / gs1_total;
            }
          }
        }
      }
    }
    for (var g in gs2) {
      if (gs2.hasOwnProperty(g)) {
        if (result.hasOwnProperty(g)) {
          for (var gg in gs2[g]) {
            if (gs2[g].hasOwnProperty(gg)) {
              if (result[g].hasOwnProperty(gg)) {
                for (var ggg in gs2[g][gg]) {
                  if (gs2[g][gg].hasOwnProperty(ggg)) {
                    if (result[g][gg].hasOwnProperty(ggg)) {
                      result[g][gg][ggg] += gs2[g][gg][ggg] / gs2_total;
                    } else {
                      result[g][gg][ggg] = gs2[g][gg][ggg] / gs2_total;
                    }
                  }
                }
              } else {
                result[g][gg] = {};
                for (var ggg in gs2[g][gg]) {
                  if (gs2[g][gg].hasOwnProperty(ggg)) {
                    result[g][gg][ggg] = gs2[g][gg][ggg] / gs2_total;
                  }
                }
              }
            }
          }
        } else {
          result[g] = {};
          for (var gg in gs2[g]) {
            if (gs2[g].hasOwnProperty(gg)) {
              result[g][gg] = {};
              for (var ggg in gs2[g][gg]) {
                if (gs2[g][gg].hasOwnProperty(ggg)) {
                  result[g][gg][ggg] = gs2[g][gg][ggg] / gs2_total;
                }
              }
            }
          }
        }
      }
    }
    return result;
  }

  function merge_bigrams_into_trigrams(trigrams, bigrams) {
    // Merges two-layer frequency counts into every layer-1 entry of
    // three-layer counts.
    var result = {};
    var tri_total = 0;
    var bi_total = 0;
    for (var g in trigrams) {
      if (trigrams.hasOwnProperty(g)) {
        for (var gg in trigrams[g]) {
          if (trigrams[g].hasOwnProperty(gg)) {
            for (var ggg in trigrams[g][gg]) {
              if (trigrams[g][gg].hasOwnProperty(ggg)) {
                tri_total += trigrams[g][gg][ggg];
              }
            }
          }
        }
      }
    }
    for (var g in bigrams) {
      if (bigrams.hasOwnProperty(g)) {
        for (var gg in bigrams[g]) {
          if (bigrams[g].hasOwnProperty(gg)) {
            for (var ggg in bigrams[g][gg]) {
              if (bigrams[g][gg].hasOwnProperty(ggg)) {
                gs2_total += bigrams[g][gg][ggg];
              }
            }
          }
        }
      }
    }
    for (var g in trigrams) {
      if (trigrams.hasOwnProperty(g)) {
        result[g] = {};
        for (var gg in trigrams[g]) {
          if (trigrams[g].hasOwnProperty(gg)) {
            result[g][gg] = {};
            for (var ggg in trigrams[g][gg]) {
              result[g][gg][ggg] = trigrams[g][gg][ggg] / tri_total;
            }
          }
        }
      }
    }
    for (var base in result) {
      if (result.hasOwnProperty(base)) {
        for (var g in bigrams) {
          if (bigrams.hasOwnProperty(g)) {
            if (result[base].hasOwnProperty(g)) {
              var entry = result[base][g];
            } else {
              var entry = {};
              result[base][g] = entry;
            }
            for (var gg in bigrams[g]) {
              if (bigrams[g].hasOwnProperty(gg)) {
                if (entry.hasOwnProperty(gg)) {
                  entry[gg] += bigrams[g][gg] / bi_total;
                } else {
                  entry[gg] = bigrams[g][gg] / bi_total;
                }
              }
            }
          }
        }
      }
    }
    return result;
  }

  function combined_counts(domains) {
    // Combines the base glyph counts for the given domains into a single joint
    // distribution table.
    var result = {};
    domains.forEach(function (d) {
      var dom = dict.lookup_domain(d);
      result = merge_glyph_counts(result, dom.glyph_counts);
    });
    return result;
  }

  function combined_bicounts(domains) {
    // As above, but works on bigram counts and/or pair counts (mixing the two
    // if ordered/unordered domains are grouped together).
    var result = {};
    domains.forEach(function (d) {
      var dom = dict.lookup_domain(d);
      if (dom.hasOwnProperty("bigram_counts")) {
        result = merge_glyph_bicounts(result, dom.bigram_counts);
      } else if (dom.hasOwnProperty("pair_counts")) {
        result = merge_glyph_bicounts(result, dom.pair_counts);
      }
    });
    return result;
  }

  function combined_tricounts(domains) {
    // As above, for trigram counts. If unordered domains are included, their
    // pair counts are grafted onto every possible unary prefix.
    var result = {};
    last = [];
    domains.forEach(function (d) {
      var dom = dict.lookup_domain(d);
      if (dom.hasOwnProperty("trigram_counts")) {
        result = merge_glyph_tricounts(result, dom.trigram_counts);
      } else {
        last.push(dom);
      }
      result = merge_glyph_tricounts(result, dom.trigram_counts);
    });
    // Merge trigram-deficient domains last to ensure they are grafted onto
    // every possible unitary prefix.
    last.forEach(function (dom) {
      if (dom.hasOwnProperty("pair_counts")) {
        result = merge_bigrams_into_trigrams(result, dom.pair_counts);
      } else if (dom.hasOwnProperty("bigram_counts")) {
        result = merge_bigrams_into_trigrams(result, dom.bigram_counts);
      }
    });
    return result;
  }

  function generate_test_supertile(sgp, seed) {
    // Generates a test supertile, using the given position and seed.

    var r = seed;
    var result = {
      "glyphs": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
      "colors": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
      "domains": [],
    };

    for (var i = 0; i < grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE; ++i) {
      result.glyphs[i] = undefined;
      result.colors[i] = [];
    }

    // Pick a word for each socket and embed it (or the relevant part of it).
    for (var socket = 0; socket < grid.COMBINED_SOCKETS; socket += 1) {
      var sgap = grid.canonical_sgapos([sgp[0], sgp[1], socket]);
      var cs = sgap[2];
      var ugp = grid.ugpos(sgap); // socket index is ignored

      var l_seed = sghash(seed, sgap);
      var r = anarchy.lfsr(l_seed);

      var glyphs = [
        ["0a", "0b", "0c", "0d", "0e", "0f", "0g", "0h"],
        ["1a", "1b", "1c", "1d", "1e", "1f", "1g", "1h"],
        ["2a", "2b", "2c", "2d", "2e", "2f", "2g", "2h"],
        ["3a", "3b", "3c", "3d", "3e", "3f", "3g", "3h"],
        ["4a", "4b", "4c", "4d", "4e", "4f", "4g", "4h"],
        ["5a", "5b", "5c", "5d", "5e", "5f", "5g", "5h"],
        ["6a", "6b", "6c", "6d", "6e", "6f", "6g", "6h"],
        ["7a", "7b", "7c", "7d", "7e", "7f", "7g", "7h"],
        ["8a", "8b", "8c", "8d", "8e", "8f", "8g", "8h"],
        ["9a", "9b", "9c", "9d", "9e", "9f", "9g", "9h"],
      ][cs];
      var tile_colors = [
        ["bl"],
        ["yl"],
        ["rd"],
        ["gn"],
        ["lb"],
        ["lg"],
        ["gr"],
      ][cs];

      // TODO: Handle longer words gracefully
      var maxlen = 10;

      // pick embedding direction & portion to embed
      var flip = (r % 2) == 0;
      r = anarchy.lfsr(r);
      var half_max = Math.floor(maxlen / 2);
      var min_cut = glyphs.length - half_max;
      var max_cut = half_max;
      if (min_cut == max_cut) {
        var cut = min_cut;
      } else if (min_cut > max_cut) {
        // TODO: Handle these overlength words properly!
        glyphs = glyphs.slice(0, maxlen);
        cut = half_max;
      } else {
        var cut = anarchy.idist(r, min_cut, max_cut + 1);
      }
      r = anarchy.lfsr(r);
      if (flip ^ grid.is_canonical(socket)) { // take first half
        glyphs = glyphs.slice(0, cut);
        // and reverse ordering
        glyphs = glyphs.reverse();
      } else {
        glyphs = glyphs.slice(cut);
      }
      var touched = inlay_word(result, glyphs, socket, r);
      for (var i = 0; i < touched.length; ++i) {
        var idx = touched[i][0] + touched[i][1]*grid.SUPERTILE_SIZE;
        result.colors[idx] = tile_colors;
      }
    }
    r = anarchy.lfsr(r);

    // TODO: Fill in remaining spots or not?

    // done with test supertile
    return result;
  }

  return {
    "WARNINGS": WARNINGS,
    "toggle_socket_colors": toggle_socket_colors,
    "sample_glyph": sample_glyph,
    "mix_seeds": mix_seeds,
    "generate_supertile": generate_supertile,
    "domains_list": domains_list,
    "ultratile_punctuation_parameters": ultratile_punctuation_parameters,
    "ultratile_muliplanar_info": ultratile_muliplanar_info,
    "generate_test_supertile": generate_test_supertile,
  };
});

