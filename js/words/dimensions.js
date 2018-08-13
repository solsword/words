// dimensions.js
// Dimension handling code.

define(["anarchy", "./utils"], function(anarchy, utils) {
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

  var DIMENSION_KINDS = {
    "F": "full",
    "P": "pocket",
    "C": "custom",
  }

  var DIMENSION_LAYOUTS = {
    "full": {
      "S": "simple",
      "E": "easy",
      "R": "reasonable",
      "H": "hard",
    },
    "pocket": {
      "C": "compact",
      "D": "dense",
      "L": "loose",
      "S": "scattered",
    },
    "custom": {
      "C": "compact",
      "D": "dense",
      "L": "loose",
      "S": "scattered",
    },
  };

  var DIMENSION_FLAVORS = {
    "pocket": {
      "B": "bare",
      "F": "full",
      "R": "round",
    },
    "custom": {
      "B": "bare",
      "F": "full",
      "R": "round",
    },
  };

  function dim__key(d) {
    return "" + d;
  }

  function key__dim(k) {
    // TODO: HERE HOW?
    console.error("key__dim isn't implemented yet!");
    return undefined;
  }

  function same(d1, d2) {
    // Whether two dimensions are the same or not.
    return utils.is_equal(d1, d2);
  }

  function kind(dimension) {
    return DIMENSION_KINDS[dimension[0][0]];
  }

  function layout(dimension) {
    let k = kind(dimension);
    return DIMENSION_LAYOUTS[k][dimension[0][2]];
  }

  function flavor(dimension) {
    let k = kind(dimension);
    return DIMENSION_FLAVORS[k][dimension[0][4]];
  }

  function natural_domain(dimension) {
    return dimension[1];
  }

  function seed(dimension) {
    return dimension[2];
  }

  function pocket_word_count(dimension) {
    return dimension[3].length;
  }

  function pocket_nth_word(dimension, n) {
    return dimension[3][n];
  }

  function pocket_words(dimension) {
    let result = [];
    let domain = natural_domain(dimension);
    for (let i = 0; i < pocket_word_count(dimension); ++i) {
      let str = pocket_nth_word(dimension, i);
      result.push(utils.string__array(str));
    }
    return result;
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
    "DIMENSION_KINDS": DIMENSION_KINDS,
    "DIMENSION_LAYOUTS": DIMENSION_LAYOUTS,
    "DIMENSION_FLAVORS": DIMENSION_FLAVORS,
    "same": same,
    "kind": kind,
    "layout": layout,
    "flavor": flavor,
    "natural_domain": natural_domain,
    "seed": seed,
    "pocket_word_count": pocket_word_count,
    "pocket_nth_word": pocket_nth_word,
    "pocket_words": pocket_words,
    "neighboring_dimension": neighboring_dimension,
    "stacked_dimension": stacked_dimension,
    "shape_for": shape_for,
  };
});
