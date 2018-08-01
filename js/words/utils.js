define([], function () {

  // Test for deep equality (through arrays and objects)
  function is_equal(a, b) {
    if (Array.isArray(a)) {
      if (Array.isArray(b)) {
        if (a.length != b.length) {
          return false;
        }
        for (var i = 0; i < a.length; ++i) {
          if (!is_equal(a[i], b[i])) {
            return false;
          }
        }
        return true;
      } else {
        return false;
      }
    } else if (typeof a === "object") {
      if (typeof b === "object") {
        // keys & values match:
        for (var k in a) {
          if (a.hasOwnProperty(k)) {
            if (!b.hasOwnProperty(k)) {
              return false;
            }
            if (!is_equal(a[k], b[k])) {
              return false;
            }
          }
        }
        // extra keys in b?
        for (var k in b) {
          if (b.hasOwnProperty(k)) {
            if (!a.hasOwnProperty(k)) {
              return false;
            }
          }
        }
        return true;
      } else {
        return false;
      }
    } else {
      return a === b;
    }
  }
  
  // Converts a string to an array (use .join("") to reverse).
  function string__array(str) {
    let result = [];
    for (let g of str) {
      result.push(g);
    }
    return result;
  }

  return {
    "is_equal": is_equal,
    "string__array": string__array,
  }
});
