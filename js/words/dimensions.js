// dimensions.js
// Dimension handling code.

define(["anarchy"], function(anarchy) {
  // Number of possible connections from each plane:
  var MULTIPLANAR_CONNECTIONS = 64;

  // TODO: Better here!
  var MULTIPLANAR_DOMAINS = [
    "عربى",
    "base",
    "かんたんなひらがな", // DEBUG TODO
    //"türk",
    //"اللغة_العربية_الفصحى", //Too large for demo
  ];

  function natural_domain(dimension) {
    return MULTIPLANAR_DOMAINS[
      dimension % MULTIPLANAR_DOMAINS.length
    ];
  }

  function neighboring_dimension(dimension, offset) {
    return (dimension + offset) % MULTIPLANAR_DOMAINS.length;
  }

  function shape_for(dimension) {
    var x = dimension ^ 1092830198;
    for (var i = 0; i < 7; ++i) {
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
    "natural_domain": natural_domain,
    "neighboring_dimension": neighboring_dimension,
    "shape_for": shape_for,
  };
});
