// dimensions.js
// Dimension handling code.

define(["anarchy"], function(anarchy) {
  // Number of possible connections from each plane:
  var MULTIPLANAR_CONNECTIONS = 64;

  // TODO: Better here!
  var MULTIPLANAR_DOMAINS = [
    "base",
    "عربى",
    "かんたんなひらがな", // DEBUG TODO
    "türk",
    //"اللغة_العربية_الفصحى", //Too large for demo
  ];

  function kind(dimension) {
    return dimension[0];
  }

  function natural_domain(dimension) {
    return dimension[1];
  }

  function seed(dimension) {
    return dimension[2];
  }

  function pocket_word_count(dimension) {
    return dimension[3];
  }

  function pocket_nth_word(dimension, n) {
    return dimension[4+n];
  }

  function neighboring_dimension(dimension, offset) {
    let i = MULTIPLANAR_DOMAINS.indexOf(dimension[1]);
    return [
      dimension[0],
      MULTIPLANAR_DOMAINS[
        anarchy.posmod((i + offset), MULTIPLANAR_DOMAINS.length)
      ],
      dimension[2]
    ];
  }

  function stacked_dimension(dimension, offset) {
    let seed = dimension[2];
    let n = Math.abs(offset);
    if (offset > 0) {
      for (let i = 0; i < n; ++i) {
        seed = anarchy.prng(seed, 501930842);
      }
    } else {
      for (let i = 0; i < n; ++i) {
        seed = anarchy.rev_prng(seed, 501930842);
      }
    }
    return [dimension[0], dimension[1], seed];
  }

  function shape_for(dimension) {
    let x = MULTIPLANAR_DOMAINS.indexOf(dimension[1]);
    x ^= 1092830198;
    for (var i = 0; i < 4; ++i) {
      x = anarchy.lfsr(x);
    }
    var t_shape = x >>> 0;
    x ^= dimension;
    x = anarchy.lfsr(x);
    var b_shape = x >>> 0;
    x ^= dimension;
    x = anarchy.lfsr(x);
    var v_shape = x >>> 0;
    x ^= dimension;
    x = anarchy.lfsr(x);
    var c_shape = x >>> 0;
    return [
      t_shape,
      b_shape,
      v_shape,
      c_shape
    ];
  }

  return {
    "MULTIPLANAR_CONNECTIONS": MULTIPLANAR_CONNECTIONS,
    "MULTIPLANAR_DOMAINS": MULTIPLANAR_DOMAINS,
    "kind": kind,
    "natural_domain": natural_domain,
    "seed": seed,
    "neighboring_dimension": neighboring_dimension,
    "stacked_dimension": stacked_dimension,
    "shape_for": shape_for,
  };
});
