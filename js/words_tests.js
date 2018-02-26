requirejs.config({
  baseURL: "js/",
});

// anarchy_tests.js
// Tests for words stuff.

requirejs(
  ["words/grid", "words/generate", "words/dict"],
  function(grid, generate, dict) {
    function display_message(m) {
      document.body.innerHTML += "<div>" + m + "</div>";
    }

    VALUE_TESTS = {
      "rotation": [
        [ grid.rotate(grid.NE, 1), grid.SE ],
        [ grid.rotate(grid.SE, 1), grid.S ],
        [ grid.rotate(grid.S, 1), grid.SW ],
        [ grid.rotate(grid.SW, 1), grid.NW ],
        [ grid.rotate(grid.NW, 1), grid.N ],
        [ grid.rotate(grid.N, 1), grid.NE ],
        [ grid.rotate(grid.N, 0), grid.N ],
        [ grid.rotate(grid.N, 1), grid.NE ],
        [ grid.rotate(grid.N, 2), grid.SE ],
        [ grid.rotate(grid.N, 3), grid.S ],
        [ grid.rotate(grid.N, 4), grid.SW ],
        [ grid.rotate(grid.N, 5), grid.NW ],
        [ grid.rotate(grid.N, 6), grid.N ],
      ],
    }

    EXEC_TESTS = {
      "path_rotation": function () {
        var p = [grid.SE, grid.S, grid.SW, grid.N];
        var r1 = grid.rotate_path(p, 1);
        var r2 = grid.rotate_path(p, 2);
        var c1 = [grid.S, grid.SW, grid.NW, grid.NE];
        var c2 = [grid.SW, grid.NW, grid.N, grid.SE];
        result = 0;
        for (var i = 0; i < p.length; ++i) {
          if (r1[i] != c1[i]) {
            display_message("Path rotation by 1 failed at index " + i);
            display_message("&nbsp;&nbsp;" + r1[i] + " != " + c1[i]);
            result += 1;
          }
          if (r2[i] != c2[i]) {
            display_message("Path rotation by 2 failed at index " + i);
            display_message("&nbsp;&nbsp;" + r2[i] + " != " + c2[i]);
            result += 1;
          }
        }
        return result;
      },
    }
    
    function run_value_tests() {
      display_message("Starting value tests...");
      for (var t in VALUE_TESTS) {
        if (VALUE_TESTS.hasOwnProperty(t)) {
          var test_count = VALUE_TESTS[t].length;
          var passed = 0;
          VALUE_TESTS[t].forEach(function (sub_t, index) {
            if (sub_t[0] == sub_t[1]) {
              passed += 1;
            } else {
              display_message("Test failed: " + t + "." + index);
              display_message(
                "&nbsp;&nbsp;expected: " + sub_t[1] + " got: " + sub_t[0]
              );
            }
          });
          display_message(
            "Suite '" + t + "': passed " + passed + " / " + test_count
          );
        }
      }
      display_message("Done with value tests.");
    }

    function run_exec_tests() {
      for (var t in EXEC_TESTS) {
        if (EXEC_TESTS.hasOwnProperty(t)) {
          var result = EXEC_TESTS[t]()
          if (result != 0) {
            display_message("Test '" + t + "' failed " + result +" sub-tests.");
          } else {
            display_message("Test '" + t + "' succeeded.")
          }
        }
      }
    }

    // do it!
    run_value_tests();
    run_exec_tests();
  }
);
