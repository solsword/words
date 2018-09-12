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

  // Minimum number of objects in each ultratile.
  var MIN_OBJECTS_PER_ULTRATILE = 8;

  // Number of attempts to make before giving up on embedding.
  var EMBEDDING_ATTEMPTS = 500;

  // Word length to ignore when filling worms.
  var WORM_FILL_SKIP = 2;

  // If this many or more of the words in a domain are shorter than the
  // WORM_FILL_SKIP value, reduce the skip value to compensate until the
  // skipped words account for this many or fewer of the domain's words.
  var WORM_FILL_SKIP_BACKOFF_RATIO = 0.1;

  // Minimum number of spaces to leave empty during worm-based augmentation.
  var WORMS_LEAVE_EMPTY = 5;

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

  // Cache size for pocket dimension layouts
  var POCKET_LAYOUT_CACHE_SIZE = 128;

  // All known combined domains.
  var DOMAIN_COMBOS = {
    //"base": [ "türk" ],
    "base": [ "adj", "adv", "noun", "verb", "stop" ]
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

  function sample_word(domain, seed, max_len, max_attempts) {
    // Sample a word from the given domain, weighted according to word
    // frequencies. Up to max_attempts (default 20) will be made to find a word
    // no longer than max_len before giving up, in which case a flat-weighted
    // word under that length will be returned, or undefined if there are no
    // such words in the given domain. Returns a [glyphs, word, frequency]
    // triple. If max_len is not given, max_attempts will be ignored, all words
    // will be considered and undefined will never result.
    var domain_objs = domain_objects(domain);
    let combined_total = domain_objs
      .map(d => d.total_count)
      .reduce((a, b) => a + b);

    if (max_len == undefined) {
      let n = anarchy.cohort_shuffle(712839, combined_total, seed);
      let i = 0;
      while (n >= domain_objs[i].total_count) {
        n -= domain_objs[i].total_count;
        i += 1;
      }
      return dict.unrolled_word(n, domain_objs[i]);
    }

    if (max_attempts == undefined) {
      max_attempts = 20;
    }

    for (let i = 0; i < max_attempts; ++i) {
      let ii = anarchy.cohort_shuffle(i, combined_total, seed);
      let di = 0;
      while (ii >= domain_objs[di].total_count) {
        ii -= domain_objs[di].total_count;
        di += 1;
      }
      let dom = domain_objs[di];
      let entry = dict.unrolled_word(ii, dom);
      if (entry[0].length <= max_len) {
        return entry;
      }
    }
    let short_total = domain_objs
      .map(d => dict.words_no_longer_than(d, max_len))
      .reduce((a, b) => a + b);
    if (short_total == 0) {
      return undefined; // no words short enough
    }
    let n = anarchy.cohort_shuffle(712839, short_total, seed);
    let di = 0;
    let short_words = dict.words_no_longer_than(domain_objs[di], max_len);
    while (n >= short_words) {
      n -= short_words;
      di += 1;
      short_words = dict.words_no_longer_than(domain_objs[di], max_len);
    }
    // undefined if none exists:
    return dict.nth_short_word(domain_objs[di], max_len, n);
  }

  function ultratile_punctuation_parameters(ugp) {
    // Takes an ultragrid position and returns three values:
    //
    // 1. The number of non-inclusion, non-overlength assignment positions
    //    within this tile's assignment grid tile prior to it.
    // 2. The number of inclusion assignment positions within this ultragrid
    //    tile.
    // 3. The number of overlength supertiles within this ultragrid tile.
    // TODO: #3 HERE

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

  function ultratile_context(ugp, seed) {
    // Takes an ultragrid position and computes generation info including
    // mutiplanar offsets for each assignment position in that ultratile, and
    // object contents of the ultratile.
    //
    // Returns an object with the following keys:
    //
    //   nat_prior:
    //     The number of prior non-inclusion positions in this assignment tile,
    //     as returned by ultratile_punctuation_parameters (see above).
    //   offsets:
    //     A flat array containing the multiplanar offset for each assignment
    //     position in the given ultragrid tile.
    //   nat_sums:
    //     A one-dimensional array containing the sum of the number of
    //     non-inclusion assignments on each row of the ultragrid.
    //   objects:
    //     A one-dimensional array of object types to be inserted into each
    //     supertile in this ultratile (ULTRAGRID_SIZE×ULTRAGRID_SIZE).
    //     May have missing entries for supertiles that don't have objects in
    //     them. Note that the objects are assigned to supertiles, not sockets.

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
          console.warn("NAN");
          console.warn(queues);
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

    // now that multiplanar info is computed, add object info
    // decide how many objects we'll have:
    var ugtotal = grid.ULTRAGRID_SIZE * grid.ULTRAGRID_SIZE;
    // TODO: continuously varying value here!
    var richness = anarchy.idist(
      r,
      MIN_OBJECTS_PER_ULTRATILE,
      Math.floor(3 * ugtotal / 4)
    );
    r = anarchy.lfsr(r);

    // Build a queue of objects to insert
    obj_queue = [];
    for (let i = 0; i < richness; ++i) {
      // TODO: Object types here!
      obj_queue.push("🗍");
    }

    // index objects into grid:
    var objects = [];
    var shuf_seed = r;
    r = anarchy.lfsr(r);
    for (let i = 0; i < richness; ++i) {
      var si = anarchy.cohort_shuffle(i, ugtotal, shuf_seed);
      var sgp = [
        si % grid.ULTRAGRID_SIZE,
        Math.floor(si / grid.ULTRAGRID_SIZE)
      ];
      // iterate over canonical sockets in this supertile
      for (let socket = 0; socket < grid.ASSIGNMENT_SOCKETS; ++socket) {
        var sgap = grid.canonical_sgapos(sgp[0], sgp[1], socket);
        var loc = (
          sgp[0]  * grid.ASSIGNMENT_SOCKETS
        + sgp[1] * grid.ULTRAGRID_SIZE * grid.ASSIGNMENT_SOCKETS
        + socket
        );
        var mpo = result[loc];
        if (mpo == 0) {
          objects[si] = obj_queue.pop();
        } else {
          // TODO: Foreign objects?
          objects[si] = null;
        }
      }
    }

    // return our results:
    return {
      "nat_prior": nat_prior,
      "offsets": result,
      "nat_sums": presums,
      "objects": objects,
    };
  }
  // register ultratile_context as a caching domain:
  caching.register_domain(
    "ultratile_context", 
    function (ugp, seed) {
      return ugp[0] + "," + ugp[1] + ":" + seed
    },
    ultratile_context,
    MULTIPLANAR_INFO_CACHE_SIZE
  );

  function punctuated_assignment_index(ugap, utcontext, seed) {
    // Takes an ultragrid assignment position (ultratile x/y, sub x/y, and
    // assignment index) and corresponding ultragrid multiplanar offset info
    // (the result of ultratile_context above) and returns an array containing:
    //
    //   x,y - assignment grid position
    //   n - assignment index
    //   m - multiplanar offset value
    //
    //   Note that the given ultragrid assignment position must be in canonical
    //   form, so that the correspondence with given utcontext won't be broken.

    // unpack:
    var nat_prior = utcontext.nat_prior;
    var mptable = utcontext.offsets;
    var mpsums = utcontext.nat_sums;

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
      for (let i = 0; i < (mp_offset % 7) + 2; ++i) {
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

    var asg_x = agp[0];
    var asg_y = agp[1];
    var asg_idx = agp[2];

    var params = assignment_punctuation_parameters(agp);
    var ugp = params[0];
    var nat_prior = params[1][0];
    var incl_here = params[1][1];

    // fetch utcontext or fail:
    var utcontext = caching.cached_value(
      "ultratile_context", 
      [ ugp, seed ]
    );
    if (utcontext == null) {
      return undefined;
    }

    // unpack:
    var nat_prior = utcontext.nat_prior;
    var mptable = utcontext.offsets;
    var mpsums = utcontext.nat_sums;

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

  function word_at(domains, index) {
    // Returns the nth word across all of the given domain(s) (which should be
    // a list of domain objects, not domain names). Returns a (glyphs,
    // canonical, frequency) triple.
    for (let i = 0; i < domains.length; ++i) {
      let d = domains[i];
      if (index < d.entries.length) {
        return d.entries[index];
      } else {
        index -= d.entries.length;
      }
    }
    console.warn("Internal Error: word_at index is out of range!");
    console.warn([domains, index]);
    return undefined;
  }

  function first_match_in(domains, glyphs) {
    // Returns a (glyphs, canonical, frequency) triple obtained by looking up
    // the given glyphs string (or list) in each of the given domains. Returns
    // only the first match from the first domain that has a match.
    for (let i = 0; i < domains.length; ++i) {
      let d = domains[i];
      let matches = dict.find_word_in_domain(glyphs, d);
      if (matches.length > 0) {
        return matches[0].slice(1);
      }
    }
    console.warn("Internal Error: first_match_in failed to find match!");
    console.warn([domains, glyphs]);
    return undefined;
  }

  function pick_word(domains, asg, seed) {
    // Given an assignment position (assignment grid x/y and assignment index)
    // and a seed, returns the corresponding word from the given domain object
    // (not name) list.
    //
    // Returns a domain entry, which is a [glyphs, word, frequency] triple.
    //
    // TODO: Handle words that are too big for their sockets!

    var any_missing = false;
    var grand_total = 0;
    var lesser_total = 0;
    var greater_counttable = [];
    var lesser_counttable = [];
    domains.forEach(function (d) {
      greater_counttable.push(d.total_count);
      grand_total += d.total_count;
      lesser_counttable.push(d.entries.length);
      lesser_total += d.entries.length;
    });
    if (WARNINGS && lesser_total > grid.ASSIGNMENT_REGION_TOTAL_SOCKETS) {
      console.warn(
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
      var dom = domains[ct_idx];
      if (WARNINGS && ct_idx == lesser_counttable.length) {
        console.warn("Warning: lesser counttable loop failed to break!");
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
        console.warn("Warning: greater counttable loop failed to break!");
        ct_idx = greater_counttable.length - 1;
        idx %= dict.total_count;
      }
      var dom = domains[ct_idx];
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
    var cidx = anarchy.idist(r, 0, filtered.length);
    chosen = filtered[cidx]

    // Finally, punch in the glyphs:
    var pos = chosen[1];
    var path = chosen[2];
    for (var i = 0; i < glyphs.length; ++i) {
      supertile.glyphs[grid.gp__index(pos)] = glyphs[i];
      result.push(pos);
      if (i < glyphs.length - 1) {
        pos = grid.neighbor(pos, path[i]);
      }
    }

    return result;
  }

  function generate_supertile(dimension, sgp, seed) {
    // Calls the appropriate supertile generator for the dimension requested.
    let k = dimensions.kind(dimension);
    if (k == "full") {
      return generate_full_supertile(dimension, sgp, seed);
    } else if (k == "pocket" || k == "custom") {
      return generate_pocket_supertile(
        dimension,
        sgp,
        seed
      );
    } else {
      console.warn(
        "Internal Error: unknown dimension type '"
      + dimensions.kind(dimension) + "'"
      );
      return undefined;
    }
  }

  function domain_objects(dom_or_string) {
    // Returns a list of domain objects for the given domain, which can be
    // either a string or a single domain object.
    if ("" + dom_or_string === dom_or_string) {
      return dict.lookup_domains(domains_list(dom_or_string));
    } else {
      return [ dom_or_string ];
    }
  }


  function generate_full_supertile(dimension, sgp, seed) {
    // Given that the necessary domain(s) and multiplanar info are all
    // available, generates the glyph contents of the supertile at the given
    // position in a full dimension. Returns undefined if there's missing
    // information.

    var result = {
      "pos": sgp.slice(),
      "dimension": dimension,
      "glyphs": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
      "colors": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
      "domains": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
      "words": [],
    };

    var default_domain = dimensions.natural_domain(dimension);

    let s = dimensions.seed(dimension)
    seed ^= s;
    for (var i = 0; i < (s % 5) + 3; ++i) {
      seed = anarchy.prng(seed);
    }

    // set glyphs, colors, and domains to undefined:
    for (var i = 0; i < grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE; ++i) {
      result.glyphs[i] = undefined;
      result.colors[i] = [];
      result.domains[i] = undefined;
    }

    // Add an active element to the center:
    // TODO: Objects
    // result.glyphs[grid.SG_CENTER_IDX] = "🗍";
    // result.domains[grid.SG_CENTER_IDX] = "__object__";
    // TODO: Scatter objects
    // TODO: Interesting objects

    // Pick a word for each socket and embed it (or the relevant part of it).
    for (var socket = 0; socket < grid.COMBINED_SOCKETS; socket += 1) {
      var sgap = grid.canonical_sgapos([sgp[0], sgp[1], socket]);
      var ugp = grid.ugpos(sgap); // socket index is ignored

      // Compute ultratile multiplanar info:
      var utcontext = caching.cached_value(
        "ultratile_context",
        [ [ ugp[0], ugp[1] ], seed ]
      );
      if (utcontext == null) {
        return undefined;
      }

      var asg = punctuated_assignment_index(
        [ ugp[0], ugp[1], ugp[2], ugp[3], sgap[2] ],
        utcontext,
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
      var doms = dict.lookup_domains(dl);
      if (doms == undefined) {
        return undefined;
      }

      // Pick a word for this socket:
      var entry = pick_word(doms, asg, l_seed);
      if (entry == undefined) {
        return undefined;
      }

      // TODO: Handle longer words gracefully
      var glyphs = entry[0].slice();
      var maxlen = grid.SOCKET_SIZE;
      if (glyphs.length > maxlen) {
        // TODO: Distribute these words elsehow
        // This word will be assigned to a long-word supertile; we can skip it
        // here in favor of a shorter word:
        entry = sample_word(domain, r, maxlen);
        if (entry == undefined) {
          // No words short enough? Skip all sockets (more food for worms)!
          // Note: This shouldn't happen much!
          break;
        }
        glyphs = entry[0].slice();
      }
      result.words.push(glyphs);

      // pick embedding direction & portion to embed
      var flip = (r % 2) == 0;
      r = anarchy.lfsr(r);
      var half_max = Math.floor(maxlen / 2);
      var min_cut = glyphs.length - half_max;
      var max_cut = half_max;
      var cut;
      if (min_cut == max_cut) {
        cut = min_cut;
      } else if (min_cut > max_cut) {
        // This shouldn't be possible any more...
        console.error("Slicing glyphs for overlength word: '" + glyphs + "'");
        glyphs = glyphs.slice(0, maxlen);
        cut = half_max;
      } else {
        cut = anarchy.idist(r, min_cut, max_cut + 1);
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
        var idx = grid.gp__index(touched[i]);
        result.domains[idx] = domain;
        // TODO: Get rid of this?
        //result.colors[idx] = colors_for_domains(dl);
        if (DEBUG_SHOW_SOCKETS) {
          result.colors[idx].push(
            ["bl", "yl", "gn"][socket % 3]
          );
        }
      }
    }
    r = anarchy.lfsr(r);

    // First try to add more words, then fill any remaining voids:
    // TODO: Call augment multiple times with different domains when inclusions
    // are present?
    // TODO: Leave some empty spaces
    //augment_words(result, default_domain, r, WORMS_LEAVE_EMPTY);
    augment_words(result, default_domain, r, 0);
    r = anarchy.lfsr(r);
    // TODO: Do fill voids
    //fill_voids(result, default_domain, r);

    // all glyphs have been filled in; we're done here!
    return result;
  }

  function supertile_known_words(dimension, sgp, seed) {
    // Returns a list of words known to be on the given supertile without
    // generating the supertile. Not all words on the supertile (e.g.,
    // augmented words) are returned.
    // TODO: Add maybe-words when standby augmentation is implemented.
    // TODO: IMPLEMENT THIS!
  }

  function worm_fill_skip(domain) {
    // Computes and returns the size of small worms to skip over when
    // augmenting supertiles using the given domain.
    var domain_objs = domain_objects(domain);
    let wfs = WORM_FILL_SKIP;
    while (wfs > 0) {
      let short_total = domain_objs
        .map(d => dict.words_no_longer_than(d, wfs))
        .reduce((a, b) => a + b);
      let grand_total = domain_objs
        .map(d => d.entries.length)
        .reduce((a, b) => a + b);
      let ratio = short_total / grand_total;
      if (ratio >= WORM_FILL_SKIP_BACKOFF_RATIO) {
        wfs -= 1; // and check again
      } else {
        break; // skipping is allowed
      }
    }
    return wfs;
  }

  function augment_words(supertile, domain, seed, leave_empty) {
    // Finds all open spaces in the supertile and organizes them into linear
    // paths, and then fills some or all of those paths with words from the
    // given domain, leaving at least the given number of spaces empty (or none
    // if leave_empty is not given). More spaces may be left empty if the
    // available space (or its partition into linear paths) doesn't leave
    // enough space in some places to fit a whole word from the domain. Fewer
    // empty spaces may remain if there weren't that many spaces open to begin
    // with.
    // TODO: Use standby words in order to create more reverse-searchability.
    if (leave_empty == undefined) {
      leave_empty = 0;
    }
    let attempts = 0;
    let sseed = sghash(seed + 128301982, supertile.pos); // worm origins
    let dseed = sghash(seed + 9849283, supertile.pos); // worm growth directions
    let wseed = sghash(seed + 619287712, supertile.pos); // word sampling
    let open_spaces = 0;
    let worms = [];
    let claimed = {};
    // First, find all worms of open space in the supertile
    function can_grow(i) {
      let xy = grid.index__gp(i);
      return (
        grid.is_valid_subindex(xy)
     && supertile.glyphs[i] == undefined
     && !claimed.hasOwnProperty(grid.coords__key(xy))
      );
    }
    function claim_space(i) {
      let xy = grid.index__gp(i);
      claimed[grid.coords__key(xy)] = true;
      open_spaces += 1;
    }
    for (let i = 0; i < grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE; ++i) {
      let ii = anarchy.cohort_shuffle(
        i,
        grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE,
        sseed
      ); // iterate in shuffled order
      if (!can_grow(ii)) {
        continue;
      }
      // Build a worm here:
      let origin = ii;
      let worm = [origin];
      claim_space(origin);
      worms.push(worm);
      // grow twice for head & tail
      for (let j = 0; j < 2; ++j) {
        let here;
        if (j == 0) { // tail grows at end
          here = worm[worm.length - 1];
        } else { // head grows at front
          here = worm[0];
        }
        while (true) {
          dseed = anarchy.lfsr(dseed);
          let hxy = grid.index__gp(here);
          let did_grow = false;
          for (let d = 0; d < grid.N_DIRECTIONS; ++d) {
            let dd = anarchy.cohort_shuffle(d, grid.N_DIRECTIONS, dseed);
            let nb = grid.neighbor(hxy, dd);
            if (!grid.is_valid_subindex(nb)) {
              continue; // skip out-of-bounds
            }
            let ni = grid.gp__index(nb);
            if (can_grow(ni)) {
              claim_space(ni);
              if (j == 0) { // tail grows at end
                worm.push(ni);
              } else { // head grows at front
                worm.unshift(ni);
              }
              here = ni;
              did_grow = true;
              break;
            }
          }
          if (!did_grow) {
            break; // we've run out of room to grow this end
          }
        }
      } // done growing this worm; loop again to grow the next one
    } // done growing all possible worms

    // limit for skipping small worms
    let wfs = worm_fill_skip(domain);
    // Now fill up worms with glyphs:
    // TODO: Fill worms using inclusion domains when nearby?
    for (let i = 0; i < worms.length; ++i) {
      let ii = anarchy.cohort_shuffle(i, worms.length, sseed);
      let worm = worms[ii];
      let wtw = 0; // which Word in This Worm?
      let remaining;
      let limit;
      // multiple words per worm
      while (worm.length > wfs) {
        remaining = open_spaces - leave_empty;
        limit = Math.min(worm.length, remaining)
        wseed = anarchy.lfsr(wseed + worm[worm.length-1] + wtw);
        wtw += 1;
        let fill = sample_word(domain, wseed, limit);
        if (fill == undefined) {
          break; // no more possible words for this worm; try next
        }
        seed = anarchy.lfsr(seed);
        let glyphs = fill[0].slice();
        supertile.words.push(glyphs);
        for (let j = 0; j < glyphs.length; ++j) {
          let idx = worm.pop();
          supertile.glyphs[idx] = glyphs[j];
          supertile.domains[idx] = domain;
          if (DEBUG_SHOW_SOCKETS) {
            let color = ["lb", "rd", "lg"][anarchy.posmod(wseed, 3)];
            supertile.colors[idx].push(color);
          }
          open_spaces -= 1;
        }
      }
      if (remaining <= worm.length) {
        break; // We're totally done: our remaining spaces aren't enough
      } // Otherwise try the next worm
    }

    // Done with agumentation
  }

  function fill_voids(supertile, default_domain, seed) {
    // Given a partially-filled supertile, fill remaining spots with letters
    // according to unigram, bigram, and trigram probabilities from the given
    // dimensions.
    let sseed = seed;
    let r = seed;
    let baseline_counts = {}; // combined glyph counts caches
    let binary_counts = {};
    let trinary_counts = {};
    for (let i = 0; i < grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE; ++i) {
      let ii = anarchy.cohort_shuffle(
        i,
        grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE,
        sseed
      ); // iterate in shuffled order
      let xy = grid.index__gp(ii);
      if (!grid.is_valid_subindex(xy)) { // skip out-of-bounds indices
        continue;
      }
      if (supertile.glyphs[ii] == undefined) { // need to fill it in
        let neighbors = []; // list filled-in neighbors
        let nbdoms = []; // list their domains
        for (let j = 0; j < grid.N_DIRECTIONS; ++j) {
          let nb = grid.neighbor(xy, j);
          let ni = grid.gp__index(nb);
          let ng = supertile.glyphs[ni];
          let nd = supertile.domains[ni];
          if (ng != undefined && nd != "__object__") {
            neighbors.push(ng);
            nbdoms.push(supertile.domains[ni]);
          }
        }

        // Simplify mixed-domain neighbors list to single-domain + glyphs list:
        let nbdom = undefined;
        let nbglyphs = undefined;
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
            let ri = (r & 0x10) >>> 4; // check an arbitrary bit
            r = anarchy.lfsr(r);
            nbdom = nbdoms[ri];
            nbglyphs = [ neighbors[ri] ];
          }
        } else { // more than 2 neighbors: pick some
          let maxdom = undefined;
          let maxcount = 0;
          let domcounts = {};
          let domglyphs = {};
          for (let j = 0; j < nbdoms.length; ++j) {
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
        supertile.domains[ii] = nbdom;
        let unicounts = undefined;
        let bicounts = undefined;
        let tricounts = undefined;
        if (nbglyphs.length == 0) {
          if (baseline_counts.hasOwnProperty(nbdom)) {
            unicounts = baseline_counts[nbdom];
          } else {
            unicounts = combined_counts(domains_list(nbdom));
            baseline_counts[nbdom] = unicounts;
          }
          supertile.glyphs[ii] = sample_glyph(r, undefined, unicounts);
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
          supertile.glyphs[ii] = sample_glyph(
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
          supertile.glyphs[ii] = sample_glyph(
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
  }

  function place_glyphs_in_layout(layout, glyphs_lists, seed) {
    // Takes a list of glyph sequences and ensures that each is placed in the
    // given layout. Modifies the given layout.

    for (let i = 0; i < glyphs_lists.length; ++i) {
      let ii = anarchy.cohort_shuffle(i, glyphs_lists.length, seed);
      let gl = glyphs_lists[ii];
      add_glyphs_to_layout(layout, gl, seed);
    }
  }

  function add_glyphs_to_layout(layout, glyphs, seed) {
    // Adds a single glyphs list to the given layout, overlapping with existing
    // material where reasonably possible, otherwise on its own.
    let set = layout[0];
    let find = layout[1];
    let shs = seed; // stable seed for shuffling
    let ishs = seed + 173; // inner shuffle seed
    seed = anarchy.lfsr(seed);
    let done = false;
    let additions = undefined;
    for (let attempt = 0; attempt < EMBEDDING_ATTEMPTS; ++attempt) {
      for (let i = 0; i < glyphs.length; ++i) {
        let ii = anarchy.cohort_shuffle(i, glyphs.length, shs);
        let g = glyphs[ii];
        let after = glyphs.slice(ii);
        let before = glyphs.slice(0,ii+1);
        before.reverse();
        ishs = anarchy.lfsr(ishs);
        if (find.hasOwnProperty(g)) { // try to start from an existing anchor
          let anchors = find[g];
          for (let j = 0; j < anchors.length; ++j) {
            let jj = anarchy.cohort_shuffle(j, anchors.length, ishs);
            let start = anchors[jj];
            additions = attempt_to_add_glyph_sequence(
              layout,
              after,
              start,
              seed
            );
            seed = anarchy.lfsr(seed);
            if (additions == undefined) {
              continue;
            }
            additions = attempt_to_add_glyph_sequence(
              layout,
              before,
              start,
              seed,
              additions
            );
            seed = anarchy.lfsr(seed);
            if (additions != undefined) {
              done = true;
              break;
            }
          }
        }
        if (done) {
          break;
        }
        // start in a random unused position near the origin
        let start = random_unused(layout, seed);
        seed = anarchy.lfsr(seed);
        additions = attempt_to_add_glyph_sequence(
          layout,
          glyphs,
          start,
          seed
        );
        if (additions != undefined) {
          done = true;
          break;
        }
      }
      if (done) {
        break;
      }
    }
    if (done) {
      // now actually modify the layout:
      for (let k of Object.keys(additions)) {
        let g = additions[k];
        let gp = grid.key__coords(k);
        if (set.hasOwnProperty(k) && set[k] != g) {
          let old = set[k];
          console.warn(
            "Reassigning layout glyph at " + k + ": '" + old
          + "' -> '" + g + "'"
          );
        }
        set[k] = g;
        if (find.hasOwnProperty(g)) {
          find[g].push(gp);
        } else {
          find[g] = [ gp ];
        }
      }
    } else {
      // fallback: add using regular pattern in unused space.
      // TODO: THIS!
    }
  }

  function random_unused(layout, seed) {
    // Finds a random unused position within the given layout, prioritizing
    // positions within the origin supertile and tiles around it, expanding
    // gradually outwards. The number of already-assigned positions in the
    // given layout influences the spread of unused position selection.
    let set = layout[0];
    let used = Object.keys(set).length;
    // Figure out which ring we'll limit ourselves to
    let filled = 4 * used / grid.SUPERTILE_TILES; // exaggerate filled
    let ring = 0;
    while (grid.tiles_inside_ring(ring) <= filled) {
      ring += 1;
    }
    // Now pick a random unused spot within that ring
    let total_tiles = grid.tiles_inside_ring(ring) * grid.SUPERTILE_TILES;
    for (let i = 0; i < total_tiles; ++i) {
      let st = Math.floor(i / grid.SUPERTILE_TILES);
      let rpos = grid.sc__rpos(st);
      let sgp = grid.rpos__sgpos(rpos[0], rpos[1]);
      let inner_pos = grid.spiral_grid_pos(i % grid.SUPERTILE_TILES);
      let gp = grid.gpos([sgp[0], sgp[1], inner_pos[0], inner_pos[1]]);
      let k = grid.coords__key(gp);
      if (set.hasOwnProperty(k)) {
        continue;
      }
      return gp;
    }
  }

  function attempt_to_add_glyph_sequence(layout, glyphs, start, seed, prev) {
    // Makes a random attempt to add the given glyph sequence to the given
    // layout, attempting overlaps half of the time when possible. The optional
    // 'prev' argument is a mapping from coordinate keys to glyphs indicating
    // glyphs not in the layout that have been provisionally placed (these
    // positions won't be reused even when overlap might be possible). Does not
    // modify the given layout, but instead modifies the previous partial
    // mapping, or returns a new mapping from coordinate keys to glyphs.
    let result = prev || {};
    let set = layout[0];
    let pos = start;
    let failed = false;
    let shs = seed;
    seed = anarchy.lfsr(seed);
    let g = glyphs[0];
    for (let i = 1; i < glyphs.length; ++i) {
      // put glyph into place
      let k = grid.coords__key(pos);
      result[k] = g;
      g = glyphs[i];
      let overlaps = [];
      let fresh = [];
      let next = undefined;
      shs = anarchy.lfsr(shs);
      for (let nd = 0; nd < grid.N_DIRECTIONS; ++nd) {
        let sd = anarchy.cohort_shuffle(nd, grid.N_DIRECTIONS, shs);
        let np = grid.neighbor(pos, sd);
        let nk = grid.coords__key(np);
        if (result.hasOwnProperty(nk)) {
          // This position is already in use as part of the current extended
          // sequence.
          continue;
        } else if (set.hasOwnProperty(nk)) {
          // This position is used, but could be overlapped upon
          if (set[nk] == g) {
            // Overlap possible
            overlaps.push(np);
          } else {
            // No overlap possible/desired
            continue;
          }
        } else {
          // An open spot 
          fresh.push(np);
        }
      }
      if (overlaps.length > 0 && fresh.length > 0) {
        if (seed % 2 == 0) { // 50:50 use an overlap or a fresh option
          pos = overlaps[0];
        } else {
          pos = fresh[0];
        }
        seed = anarchy.lfsr(seed);
      } else if (overlaps.length > 0) {
        // only overlap available
        pos = overlaps[0];
      } else if (fresh.length > 0) {
        // only fresh available
        pos = fresh[0];
      } else {
        // nothing left
        failed = true;
        break;
      }
    }
    if (failed) {
      return undefined;
    } else {
      let k = grid.coords__key(pos);
      result[k] = g;
      return result;
    }
  }

  function generate_pocket_layout(dimension) {
    // Generates the layout for a pocket dimension by placing each of the
    // required words into a finite space. The layout object returned is a pair
    // of mappings: the first from positions to glyphs, and the second from
    // glyphs to position lists.
    var words = dimensions.pocket_words(dimension);
    var seed = dimensions.seed(dimension);

    var layout = [{}, {}];

    // Ensure domain(s) are loaded:
    var nd = dimensions.natural_domain(dimension);
    var domains = dict.lookup_domains(domains_list(nd));
    if (domains == undefined) {
      return undefined;
    }

    place_glyphs_in_layout(layout, words, seed);

    return layout;
  }

  // Register generate_pocket_layout as a caching domain
  caching.register_domain(
    "pocket_layout", 
    function (dimension) {
      return "" + dimension
    },
    generate_pocket_layout,
    POCKET_LAYOUT_CACHE_SIZE
  );

  function generate_pocket_supertile(dimension, sgp, seed) {
    // Given that the necessary domain(s) and pocket layout are available,
    // generates the glyph contents of the supertile at the given position in a
    // pocket dimension. Returns undefined if there's missing information, or
    // null if the pocket dimension doesn't include a supertile at the given
    // position.

    var result = {
      "dimension": dimension,
      "glyphs": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
      "colors": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
      "domains": Array(grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE),
    };

    // scramble the seed
    let s = dimensions.seed(dimension)
    seed ^= s;
    for (var i = 0; i < (s % 5) + 3; ++i) {
      seed = anarchy.prng(seed);
    }

    let flavor = dimensions.flavor(dimension);

    // Get pocket dimension layout
    var pocket_layout = caching.cached_value(
      "pocket_layout",
      [ dimension ]
    );

    // Ensure domain(s) are loaded:
    var domain = dimensions.natural_domain(dimension);
    var dl = domains_list(domain);
    if (dict.lookup_domains(dl) == undefined) {
      return undefined;
    }

    // set glyphs, colors, and domains to undefined:
    for (var i = 0; i < grid.SUPERTILE_SIZE * grid.SUPERTILE_SIZE; ++i) {
      result.glyphs[i] = undefined;
      result.colors[i] = [];
      result.domains[i] = undefined;
    }
    if (pocket_layout == null) {
      return undefined;
    }

    // Fill in tiles specified by the layout:
    let touched = false;
    for (let sub_gp of grid.ALL_SUPERTILE_POSITIONS) {
      let gp = grid.gpos([sgp[0], sgp[1], sub_gp[0], sub_gp[1]]);
      let k = grid.coords__key(gp);
      let g = pocket_layout[0][k];
      if (g != undefined) {
        touched = true;
        let idx = grid.gp__index(sub_gp);
        result.glyphs[idx] = g;
        result.domains[idx] = domain; 
      }
    }
    if (!touched && flavor != "round") {
      return null;
    } else if (!touched) {
      // determine if we're inside the round area:
      let ring = 0;
      for (let k of Object.keys(pocket_layout[0])) {
        let gp = grid.key__coords(k);
        let sp = grid.sgpos(gp);
        let rh = grid.supergrid_distance([0, 0], sp);
        if (rh > ring) {
          ring = rh;
        }
      }
      if (grid.supergrid_distance([0, 0], sgp) > ring) {
        // outside of the ring
        return null;
      } // else inside
    }

    // Finish filling empty tiles:
    fill_voids(result, domain, seed);

    // TODO: Check for supertile disjointedness?

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
    return result.slice(0, grid.N_DIRECTIONS);
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

      // Note: long words are chopped for test tiles
      var maxlen = grid.SOCKET_SIZE;

      // pick embedding direction & portion to embed
      var flip = (r % 2) == 0;
      r = anarchy.lfsr(r);
      var half_max = Math.floor(maxlen / 2);
      var min_cut = glyphs.length - half_max;
      var max_cut = half_max;
      if (min_cut == max_cut) {
        var cut = min_cut;
      } else if (min_cut > max_cut) {
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
        var idx = grid.gp__index(touched[i]);
        result.colors[idx] = tile_colors;
      }
    }
    r = anarchy.lfsr(r);

    // TODO: Fill in remaining spots or not?

    // done with test supertile
    return result;
  }

  function overlength_per_assignment_region(dom_or_combo) {
    // Computes the number of overlength slots per assignment region required
    // to comfortably support all overlength words in a domain.
    let domains;
    if ("" + dom_or_combo === dom_or_combo) {
      domains = dict.lookup_domains(domains_list(dom_or_string));
    } else {
      domains = [ dom_or_string ];
    }
    let total_overlength = 0;
    let total_entries = 0;
    for (let dom of domains) {
      total_overlength += dom.overlength.length;
      total_entries += dom.entries.length;
    }
    let ratio = total_overlength / total_entries;

    /* Algebra for desired overlength sockets:
    ratio = (
      (grid.ULTRATILE_SOCKETS - 2*x*grid.ASSIGNMENT_SOCKETS)
      / grid.ULTRATILE_SOCKETS
    );
    --------------------------------------------------------
    ratio = US / US - 2*x*AS/US
    --------------------------------------------------------
    ratio - 1 = -2xAS/US
    --------------------------------------------------------
    US*(ratio-1)/(2AS) = -x
    --------------------------------------------------------
    x = US*(1-ratio)/(2AS)
    --------------------------------------------------------
    */
    let overlength_per_ar = Math.ceil(
      (
        grid.ULTRATILE_SOCKETS * (1 - ratio)
      / 2 * grid.ASSIGNMENT_SOCKETS
      )
    * grid.ASSIGNMENT_REGION_TOTAL_SUPERTILES
    );

    return Math.max(overlength_per_ar, total_overlength);
  }

  function superlong_ratio(domain) {
    // Returns the ratio of superlong to all entries in a domain.
    // TODO: Something with/about superlong words (stuff into pocket
    // dimensions?)
    return domain.superlong.length / domain.entries.length;
  }

  return {
    "WARNINGS": WARNINGS,
    "toggle_socket_colors": toggle_socket_colors,
    "sample_glyph": sample_glyph,
    "sample_word": sample_word,
    "mix_seeds": mix_seeds,
    "generate_supertile": generate_supertile,
    "domains_list": domains_list,
    "ultratile_punctuation_parameters": ultratile_punctuation_parameters,
    "ultratile_context": ultratile_context,
    "generate_test_supertile": generate_test_supertile,
  };
});

