requirejs.config({
  baseURL: "js/",
});

// anarchy_tests.js
// Tests for words stuff.

requirejs(
  ["words/grid", "words/generate", "words/dict", "words/quests"],
  function(grid, generate, dict, quests) {
    function display_message(m) {
      document.body.innerHTML += "<div>" + m + "</div>";
    }

    function check_tensors(test, solution) {
      if (Array.isArray(solution)) {
        var passed = true;
        for (var i = 0; i < solution.length; ++i) {
          passed = passed && check_tensors(test[i], solution[i]);
        }
        return passed;
      } else {
        return test == solution;
      }
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
      "canonical_sgapos": [
        [ grid.canonical_sgapos([ 0, 0, 0 ]), [0, 0, 0] ],
        [ grid.canonical_sgapos([ 0, 0, 1 ]), [0, 0, 1] ],
        [ grid.canonical_sgapos([ 0, 0, 2 ]), [0, 0, 2] ],
        [ grid.canonical_sgapos([ 0, 0, 3 ]), [1, 0, 0] ],
        [ grid.canonical_sgapos([ 0, 0, 4 ]), [1, -1, 1] ],
        [ grid.canonical_sgapos([ 0, 0, 5 ]), [0, -1, 2] ],
        [ grid.canonical_sgapos([ 111, 111, 0 ]), [111, 111, 0] ],
        [ grid.canonical_sgapos([ 111, 111, 1 ]), [111, 111, 1] ],
        [ grid.canonical_sgapos([ 111, 111, 2 ]), [111, 111, 2] ],
        [ grid.canonical_sgapos([ 111, 111, 3 ]), [112, 111, 0] ],
        [ grid.canonical_sgapos([ 111, 111, 4 ]), [112, 110, 1] ],
        [ grid.canonical_sgapos([ 111, 111, 5 ]), [111, 110, 2] ],
      ],
      "hint_matching": [
        [ quests.matches("S*R", "SOAR"), true ],
        [ quests.matches("S__R", "SOAR"), true ],
        [ quests.matches("S*", "SOAR"), true ],
        [ quests.matches("*R", "SOAR"), true ],
        [ quests.matches("*", "SOAR"), true ],
        [ quests.matches("_OA_", "SOAR"), true ],
        [ quests.matches("D*R", "DISCOVER"), true ],
        [ quests.matches("*VER", "DISCOVER"), true ],
        [ quests.matches("DIS*", "DISCOVER"), true ],
        [ quests.matches("*COV*", "DISCOVER"), true ],
        [ quests.matches("*COV**", "DISCOVER"), true ],
        [ quests.matches("DISC*OVER", "DISCOVER"), true ],
        [ quests.matches("***", "A"), true ],
        [ quests.matches("D_S_O_E_", "DISCOVER"), true ],
        [ quests.matches("_I_C_V_R", "DISCOVER"), true ],
        [ quests.matches("D______R", "DISCOVER"), true ],
        [ quests.matches("__SCOV__", "DISCOVER"), true ],
        [ quests.matches("___SCOV__", "DISCOVER"), false ],
        [ quests.matches("__SCOV___", "DISCOVER"), false ],
        [ quests.matches("DI___ER", "DISCOVER"), false ],
        [ quests.matches("DI_____ER", "DISCOVER"), false ],
        [ quests.matches("*VOC*", "DISCOVER"), false ],
        [ quests.matches("*Z", "DISCOVER"), false ],
        [ quests.matches("I*", "DISCOVER"), false ],
        [ quests.matches("_", "AA"), false ],
        [ quests.matches("*_", "AA"), true ],
        [ quests.matches("*A*", "AA"), true ],
        [ quests.matches("*A_", "AA"), true ],
        [ quests.matches("_A*", "AA"), true ], // fails
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
      "asg_neighbors": function () {
        var result = 0;
        // Test next/prev edge functions:
        for (var socket = 0; socket < grid.COMBINED_SOCKETS; ++socket) {
          var t = grid.next_edge(grid.prev_edge(socket));
          if (t != socket) {
            display_message("Socket next/prev irrev [" + socket + "] → " + t);
            result += 1;
          }
        }

        // Test full neighbors:
        var nb = grid.supergrid_asg_neighbors([0, 0, 0]);
        var sol = [
          [ 0, -1, 2 ],
          [ 0, 0, 1 ],
          [ -1, 0, 2 ],
          [ 0, -1, 1 ],
        ];
        if (!check_tensors(nb, sol)) {
          display_message("Asg neighbors failed!");
          result += 1;
        }
        if (result != 0) {
          console.log("Supergrid neighbors:");
          console.log(nb);
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
            if (check_tensors(sub_t[0], sub_t[1])) {
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
