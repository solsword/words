// anarchy.js
// Reversible chaos library.

define([], function() {
  // Note: anarchy.js operates using 32-bit integer values to remain
  // dependency-free. This breaks full compatibility with the C library, which
  // uses 64-bit integers for obvious reason. Javascript does not support
  // 64-bit integers at this time (Number.MAX_SAFE_INTEGER is 2^53-1), and in
  // particular, bitwise operations only work on 32-bit integers.
  var ID_BITS = 32;
  var ID_BYTES = 4;

  function mask(bits) {
    // Creates a mask with the given number of 1 bits.
    // Avoids shift operator because of 32-bit limit, but watch out for
    // floating point behavior for bit amounts greater than ~52 (see
    // Number.MAX_SAFE_INTEGER).
    return Math.pow(2, bits) - 1;
  }

  function byte_mask(n) {
    // Returns a mask that covers just the nth byte (zero-indexed), starting
    // from the least-significant digits. Starts to break down when
    // Number.MAX_SAFE_INTEGER is exceeded (byte 6).
    return Math.pow(2, n*8) * 255;
  }

  function circular_shift(x, distance) {
    // Circular bit shift; distance is capped at 3/4 of ID_BITS
    distance %= Math.floor(3 * ID_BITS / 4);
    var m = mask(distance);
    var fall_off = x & m;
    var shift_by = (ID_BITS - distance);
    return (
      (x >>> distance)
    | (fall_off << shift_by)
    );
  }

  function rev_circular_shift(x, distance) {
    // Inverse circular shift (see above).
    distance %= Math.floor(3 * ID_BITS / 4);
    var m = mask(distance);
    var fall_off = x & (m << (ID_BITS - distance));
    var shift_by = (ID_BITS - distance);
    return (
      (x << distance)
    | (fall_off >>> shift_by)
    );
  }

  function fold(x, where) {
    // Folds lower bits into upper bits using xor. 'where' is restricted to
    // fall between 1/4 and 1/2 of ID_BITS.
    var quarter = Math.floor(ID_BITS / 4)
    var where = (where % quarter) + quarter;
    var m = mask(where);
    var lower = x & m;
    var shift_by = ID_BITS - where;
    return x ^ (lower << shift_by);
  }
  // fold is its own inverse.

  var FLOP_MASK = 0xf0f0f0f0;

  function flop(x) {
    // Flops each 1/2 byte with the adjacent 1/2 byte.
    var left = x & FLOP_MASK;
    var right = x & ~FLOP_MASK;
    return (right << 4) | (left >>> 4);
  }
  // flop is its own inverse.

  function scramble(x) {
    // Implements a reversible linear-feedback-shift-register-like operation.
    var trigger = x & 0x80200003;
    var r = circular_shift(x, 1);
    if (trigger) {
      r ^= 0x03040610;
    }
    return r;
  }

  function rev_scramble(x) {
    // Inverse of scramble (see above).
    var pr = rev_circular_shift(x, 1);
    var trigger = pr & 0x80200003;
    if (trigger) {
      // pr ^= rev_circular_shift(0x03040610, 1);
      pr ^= 0x06080c20;
    }
    return pr;
  }

  function prng(x, seed) {
    // A simple reversible pseudo-random number generator.

    // seed scrambling:
    seed = seed >>> 0;
    seed = ((seed + 1) * (3 + (seed % 23))) >>> 0;
    seed = fold(seed, 11) >>> 0; // prime
    seed = scramble(seed) >>> 0;
    seed = circular_shift(seed, seed + 23) >>> 0; // prime
    seed = scramble(seed) >>> 0;
    seed ^= (seed % 153) * scramble(seed);
    seed = seed >>> 0;

    // value scrambling:
    x ^= seed;
    x = fold(x, seed + 3); // prime
    x = flop(x);
    x = circular_shift(x, seed + 37); // prime
    x = fold(x, seed + 89); // prime
    x = circular_shift(x, seed + 107); // prime
    x = scramble(x);
    return x;
  }

  function rev_prng(x, seed) {
    // Inverse of prng (see above).

    // seed scrambling:
    seed = seed >>> 0;
    seed = ((seed + 1) * (3 + (seed % 23))) >>> 0;
    seed = fold(seed, 11) >>> 0; // prime
    seed = scramble(seed) >>> 0;
    seed = circular_shift(seed, seed + 23) >>> 0; // prime
    seed = scramble(seed) >>> 0;
    seed ^= (seed % 153) * scramble(seed);
    seed = seed >>> 0;

    // value unscrambling:
    x = rev_scramble(x);
    x = rev_circular_shift(x, seed + 107); // prime
    x = fold(x, seed + 89); // prime
    x = rev_circular_shift(x, seed + 37); // prime
    x = flop(x);
    x = fold(x, seed + 3); // prime
    x ^= seed;
    return x;
  }

  function lfsr(x) {
    // Implements a max-cycle-length 32-bit linear-feedback-shift-register.
    // See: https://en.wikipedia.org/wiki/Linear-feedback_shift_register
    // Note that this is NOT reversible!
    var lsb = x & 1;
    var r = x >>> 1;
    if (lsb) {
      r ^= 0x80200003; // 32, 22, 2, 1
    }
    return r;
  }

  function udist(x) {
    // Generates a random number between 0 and 1 given a seed value.
    var ux = lfsr(x >>> 0);
    var sc = (ux ^ (ux << 16)) >>> 0;
    return (sc % 2147483659) / 2147483659; // prime near 2^31
  }

  function expdist(x) {
    // Generates a number from an exponential distribution with mean 0.5 given
    // a seed. See:
    // https://math.stackexchange.com/questions/28004/random-exponential-like-distribution
    var u = udist(x);
    return -Math.log(1 - u)/0.5;
  }

  function cohort(outer, cohort_size) {
    // Computes cohort number for the given outer index and cohort size.
    return Math.floor(outer / cohort_size);
  }

  function cohort_inner(outer, cohort_size) {
    // Computes within-cohort index for the given outer index and cohorts of
    // the given size.
    return outer % cohort_size;
  }

  function cohort_and_inner(outer, cohort_size) {
    // Returns an array containing both the cohort number and inner index for
    // the given outer index and cohort size.
    return [which_cohort(outer, cohort_size), cohort_inner(outer, cohort_size)];
  }

  function cohort_outer(cohort, inner, cohort_size) {
    // Inverse of cohort_and_inner; computes the outer index from a cohort
    // number and inner index.
    return cohort_size * cohort + inner;
  }

  function cohort_interleave(inner, cohort_size) {
    // Interleaves cohort members by folding the top half into the bottom half.
    if (inner < Math.floor((cohort_size+1)/2)) {
      return inner * 2;
    } else {
      return ((cohort_size - 1 - inner) * 2) + 1;
    }
  }

  function rev_cohort_interleave(inner, cohort_size) {
    // Inverse interleave (see above).
    if (inner % 2) {
      return cohort_size - 1 - Math.floor(inner/2);
    } else {
      return Math.floor(inner/2);
    }
  }

  function cohort_fold(inner, cohort_size, seed) {
    // Folds items past an arbitrary split point (in the second half of the
    // cohort) into the middle of the cohort. The split will always leave an
    // odd number at the end.
    var half = Math.floor(cohort_size / 2);
    var quarter = Math.floor(cohort_size / 4);
    var split = half;
    if (quarter > 0) {
      split += (seed % quarter);
    }
    var after = cohort_size - split;
    split += (after + 1) % 2; // force an odd split point

    var fold_to = half - Math.floor(after / 2);

    if (inner < fold_to) { // first region
      return inner;
    } else if (inner >= split) { // second region
      return inner + after; // push out past fold region
    } else { // fold region
      return fold_to + (inner - split);
    }
  }

  function rev_cohort_fold(inner, cohort_size, seed) {
    // Inverse fold (see above).
    var half = Math.floor(cohort_size / 2);
    var quarter = Math.floor(cohort_size / 4);
    var split = half;
    if (quarter > 0) {
      split += (seed % quarter);
    }
    var after = cohort_size - split;
    split += (after + 1) % 2; // force an odd split point

    var fold_to = half - Math.floor(after / 2);

    if (inner < fold_to) { // first region
      return inner;
    } else if (inner > half + Math.floor(after / 2)) { // second region
      return inner - after;
    } else {
      return split + inner - fold_to;
    }
  }

  function cohort_spin(inner, cohort_size, seed) {
    // Applies a circular offset
    return (inner + seed) % cohort_size;
  }

  function rev_cohort_spin(inner, cohort_size, seed) {
    // Inverse spin (see above).
    return (inner + (cohort_size - (seed % cohort_size))) % cohort_size;
  }

  function cohort_flop(inner, cohort_size, seed) {
    // Flops sections (with seeded sizes) with their neighbors.
    var limit = Math.floor(cohort_size / 8);
    if (limit < 4) {
      limit += 4;
    }
    var size = (seed % limit) + 2;
    var which = Math.floor(inner / size);
    var local = inner % size;

    var result = 0;
    if (which % 2) {
      result = (which - 1) * size + local;
    } else {
      result = (which + 1) * size + local;
    }

    if (result >= cohort_size) { // don't flop out of the cohort
      return inner;
    } else {
      return result;
    }
  }
  // flop is its own inverse

  function cohort_mix(inner, cohort_size, seed) {
    // Applies a spin to both even and odd items with different seeds.
    var even = inner - (inner % 2);
    var target = 0;
    if (inner % 2) {
      target = cohort_spin(
        Math.floor(even / 2),
        Math.floor((cohort_size = (1 - cohort_size % 2)) / 2),
        seed + 464185
      );
      return 2 * target + 1;
    } else {
      target = cohort_spin(
        Math.floor(even / 2),
        (cohort_size + 1) / 2,
        seed + 1048239
      );
      return 2 * target;
    }
  }

  function rev_cohort_mix(inner, cohort_size, seed) {
    // Inverse mix (see above).
    var even = inner - (inner % 2);
    var target = 0;
    if (inner % 2) {
      target = rev_cohort_spin(
        Math.floor(even / 2),
        Math.floor((cohort_size = (1 - cohort_size % 2)) / 2),
        seed + 464185
      );
      return 2 * target + 1;
    } else {
      target = rev_cohort_spin(
        Math.floor(even / 2),
        (cohort_size + 1) / 2,
        seed + 1048239
      );
      return 2 * target;
    }
  }

  var MIN_REGION_SIZE = 2;
  var MAX_REGION_COUNT = 16;

  function cohort_spread(inner, cohort_size, seed) {
    // Spreads items out between a random number of different regions within
    // the cohort.
    var min_regions = 2;
    if (cohort_size < 2 * MIN_REGION_SIZE) {
      min_regions = 1;
    }
    var max_regions = 1 + Math.floor(cohort_size / MIN_REGION_SIZE);
    var regions = (
      min_regions + (
        (seed % (1 + (max_regions - min_regions)))
      % MAX_REGION_COUNT
      )
    );
    var region_size = Math.floor(cohort_size / regions);
    var leftovers = cohort_size - (regions * region_size);

    var region = inner % regions;
    var index = inner / regions;
    if (index < region_size) { // non-leftovers
      return region * region_size + index + leftovers;
    } else { // leftovers go at the front:
      return inner - regions * region_size;
    }
  }

  function rev_cohort_spread(inner, cohort_size, seed) {
    // Inverse spread (see above).
    var min_regions = 2;
    if (cohort_size < 2 * MIN_REGION_SIZE) {
      min_regions = 1;
    }
    var max_regions = 1 + Math.floor(cohort_size / MIN_REGION_SIZE);
    var regions = (
      min_regions + (
        (seed % (1 + (max_regions - min_regions)))
      % MAX_REGION_COUNT
      )
    );

    var region_size = Math.floor(cohort_size / regions);
    var leftovers = cohort_size - (regions * region_size);

    var index = (inner - leftovers) / region_size;
    var region = (inner - leftovers) % region_size;

    if (inner < leftovers) { // leftovers back to the end:
      return regions * reigon_size + inner;
    } else {
      return region * regions + index;
    }
  }

  function cohort_upend(inner, cohort_size, seed) {
    // Reverses ordering within each of several fragments.
    var min_regions = 2;
    if (cohort_size < 2 * MIN_REGION_SIZE) {
      min_regions = 1;
    }
    var max_regions = 1 + Math.floor(cohort_size / MIN_REGION_SIZE);
    var regions = (
      min_regions + (
        (seed % (1 + (max_regions - min_regions)))
      % MAX_REGION_COUNT
      )
    );

    var region = inner / region_size;
    var index = inner % region_size;

    var result = (region * region_size) + (region_size - 1 - index);

    if (result < cohort_size) {
      return result;
    } else {
      return inner;
    }
  }
  // Upend is its own inverse.

  function cohort_shuffle(inner, cohort_size, seed) {
    // Compose a bunch of the above functions to perform a nice thorough
    // shuffle within a cohort.
    var r = inner;
    seed = seed ^ cohort_size;
    r = cohort_spread(r, cohort_size, seed + 457); // prime
    r = cohort_mix(r, cohort_size, seed + 2897); // prime
    r = cohort_interleave(r, cohort_size);
    r = cohort_spin(r, cohort_size, seed + 1987); // prime
    r = cohort_upend(r, cohort_size, seed + 47); // prime
    r = cohort_fold(r, cohort_size, seed + 839); // prime
    r = cohort_interleave(r, cohort_size);
    r = cohort_flop(r, cohort_size, seed + 53); // prime
    r = cohort_fold(r, cohort_size, seed + 211); // prime
    r = cohort_mix(r, cohort_size, seed + 733); // prime
    r = cohort_spread(r, cohort_size, seed + 881); // prime
    r = cohort_interleave(r, cohort_size);
    r = cohort_flop(r, cohort_size, seed + 193); // prime
    r = cohort_upend(r, cohort_size, seed + 794641); // prime
    r = cohort_spin(r, cohort_size, seed + 19); // prime
    return r;
  }

  function rev_cohort_shuffle(inner, cohort_size, seed) {
    // Inverse shuffle (see above).
    var r = inner;
    seed = seed ^ cohort_size;
    r = rev_cohort_spin(r, cohort_size, seed + 19); // prime
    r = cohort_upend(r, cohort_size, seed + 794641); // prime
    r = cohort_flop(r, cohort_size, seed + 193); // prime
    r = rev_cohort_interleave(r, cohort_size);
    r = rev_cohort_spread(r, cohort_size, seed + 881); // prime
    r = rev_cohort_mix(r, cohort_size, seed + 733); // prime
    r = rev_cohort_fold(r, cohort_size, seed + 211); // prime
    r = cohort_flop(r, cohort_size, seed + 53); // prime
    r = rev_cohort_interleave(r, cohort_size);
    r = rev_cohort_fold(r, cohort_size, seed + 839); // prime
    r = cohort_upend(r, cohort_size, seed + 47); // prime
    r = rev_cohort_spin(r, cohort_size, seed + 1987); // prime
    r = rev_cohort_interleave(r, cohort_size);
    r = rev_cohort_mix(r, cohort_size, seed + 2897); // prime
    r = rev_cohort_spread(r, cohort_size, seed + 457); // prime
    return r;
  }

  function distribution_spilt_point(
    total,
    n_segments,
    segment_capacity,
    roughness,
    seed
  ) {
    // Implements common distribution functionality: given a total item count,
    // a segment count and per-segment capacity, and a roughness value and
    // seed, computes the split point for the items as well as the halfway
    // index for the segments.

    // how the segments are divided:
    var first_half = Math.floor(n_segments / 2);

    // compute min/max split points according to roughness:
    var half = Math.floor(total / 2);
    var split_min = Math.floor(half - half * roughness);
    var split_max = Math.floor(half + (total - half) * roughness);

    // adjust for capacity limits:
    if ((total - split_min) > segment_capacity * (n_segments - first_half)) {
      split_min = total - (segment_capacity * (n_segments - first_half));
    }

    if (split_max > segment_capacity * first_half) {
      split_max = segment_capacity * first_half;
    }

    // compute a random split point:
    var split = half;
    if (split_min >= split_max) {
      split = split_min;
    } else {
      split = split_min + (prng(total ^ prng(seed)) % (split_max - split_min))
    }

    return [split, first_half];
  }

  function distribution_portion(
    segment,
    total,
    n_segments,
    segment_capacity,
    roughness,
    seed
  ) {
    // Given that 'total' items are to be distributed evenly among 'n_segment'
    // segments each with at most 'segment_capacity' items and we're in segment
    // 'segment' of those, computes how many items are in this segment. The
    // 'roughness' argument should be a number between 0 and 1 indicating how
    // even the distribution is: 0 indicates a perfectly even distribution,
    // while 1 indicates a perfectly random distribution. Does work
    // proportional to the log of the number of segments.
    //
    // Note that segment_capacity * n_segments should be > total.

    // base case
    if (n_segments == 1) {
      return total;
    }

    // compute split point:
    split = distribution_spilt_point(
      total,
      n_segments,
      segment_capacity,
      roughness,
      seed
    );

    // call ourselves recursively:
    if (segment < split[1]) {
      return distribution_portion(
        split[0],
        segment,
        split[1],
        roughness,
        seed
      );
    } else {
      return distribution_portion(
        total - split[0],
        segment - split[1],
        n_segments - split[1],
        roughness,
        seed
      );
    }
  }

  function distribution_prior_sum(
    segment,
    total,
    n_segments,
    segment_capacity,
    roughness,
    seed
  ) {
    // Does similar math to the distribution_portion function above, but
    // instead of returning the number of items in the given segment, it
    // returns the number of items in all segments before the given segment.
    // Only does work proportional to the log of the number of segments.

    // base case
    if (n_segments == 1) {
      return 0; // nothing prior
    }

    // compute split point:
    split = distribution_spilt_point(
      total,
      n_segments,
      segment_capacity,
      roughness,
      seed
    );

    // call ourselves recursively:
    if (segment < first_half) {
      return distribution_prior_sum(
        split[0],
        segment,
        split[1],
        roughness,
        seed
      );
    } else {
      return split[0] + distribution_prior_sum(
        total - split[0],
        segment - split[1],
        n_segments - split[1],
        roughness,
        seed
      );
    }
  }

  function distribution_segment(
    index,
    total,
    n_segments,
    segment_capacity,
    roughness,
    seed
  ) {
    // Computes the segment number in which a certain item appears (one of the
    // 'total' items distributed between segments; see distribution_portion
    // above). Requires work proportional to the log of the number of segments.

    // base case
    if (n_segments == 1) {
      return 0; // we are in the only segment there is
    }

    // compute split point:
    split = distribution_spilt_point(
      total,
      n_segments,
      segment_capacity,
      roughness,
      seed
    );

    // call ourselves recursively:
    if (index < split) {
      return distribution_segment(
        split[0],
        index,
        split[1],
        roughness,
        seed
      );
    } else {
      return split[1] + distribution_segment(
        total - split[0],
        index - split[0],
        n_segments - split[1],
        roughness,
        seed
      );
    }
  }

  return {
    "mask": mask,
    "byte_mask": byte_mask,
    "circular_shift": circular_shift,
    "rev_circular_shift": rev_circular_shift,
    "fold": fold,
    "flop": flop,
    "scramble": scramble,
    "rev_scramble": rev_scramble,

    "prng": prng,
    "rev_prng": rev_prng,

    "lfsr": lfsr,

    "udist": udist,
    "expdist": expdist,

    "cohort": cohort,
    "cohort_inner": cohort_inner,
    "cohort_and_inner": cohort_and_inner,
    "cohort_outer": cohort_outer,

    "cohort_interleave": cohort_interleave,
    "rev_cohort_interleave": rev_cohort_interleave,
    "cohort_fold": cohort_fold,
    "rev_cohort_fold": rev_cohort_fold,
    "cohort_spin": cohort_spin,
    "rev_cohort_spin": rev_cohort_spin,
    "cohort_flop": cohort_flop,
    "cohort_mix": cohort_mix,
    "rev_cohort_mix": rev_cohort_mix,
    "cohort_spread": cohort_spread,
    "rev_cohort_spread": rev_cohort_spread,
    "cohort_upend": cohort_upend,
    "cohort_shuffle": cohort_shuffle,
    "rev_cohort_shuffle": rev_cohort_shuffle,

    "distribution_spilt_point": distribution_spilt_point,
    "distribution_portion": distribution_portion,
    "distribution_prior_sum": distribution_prior_sum,
    "distribution_segment": distribution_segment,
  };
});
