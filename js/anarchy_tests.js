requirejs.config({
  baseURL: "js/",
});

// anarchy_tests.js
// Tests for the anarchy reversible chaos library.


requirejs(
  ["anarchy"],
  function(anarchy) {
    function display_message(m) {
      document.body.innerHTML += "<div>" + m + "</div>";
    }

    VALUE_TESTS = {
      "posmod": [
        [ anarchy.posmod(-1, 7), 6 ],
        [ anarchy.posmod(0, 11), 0 ],
        [ anarchy.posmod(3, 11), 3 ],
        [ anarchy.posmod(-13, 11), 9 ],
        [ anarchy.posmod(15, 11), 4 ],
        [ anarchy.posmod(115, 10), 5 ],
        [ anarchy.posmod(115, 100), 15 ],
      ],
      "mask": [
        [ anarchy.mask(0), 0 ],
        [ anarchy.mask(1), 1 ],
        [ anarchy.mask(2), 3 ],
        [ anarchy.mask(4), 15 ],
        [ anarchy.mask(10), 1023 ],
      ],
      "byte_mask": [
        [ anarchy.byte_mask(0), 255 ],
        [ anarchy.byte_mask(1), 65280 ],
        [ anarchy.byte_mask(2), 16711680 ],
      ],
      "circular_shift": [
        [ anarchy.circular_shift(2, 1), 1 ],
        [ anarchy.circular_shift(4, 1), 2 ],
        [ anarchy.circular_shift(8, 2), 2 ],
        [ anarchy.circular_shift(1, 1), 0x80000000 ],
        [ anarchy.circular_shift(2, 2), 0x80000000 ],
        [ anarchy.circular_shift(1, 2), 0x40000000 ],
        [ anarchy.rev_circular_shift(1, 2), 4 ],
        [ anarchy.rev_circular_shift(1, 3), 8 ],
        [ anarchy.rev_circular_shift(2, 2), 8 ],
        [ anarchy.rev_circular_shift(0x80000000, 1), 1 ],
        [ anarchy.rev_circular_shift(0x80000000, 2), 2 ],
        [ anarchy.rev_circular_shift(0x80000000, 3), 4 ],
        [ anarchy.rev_circular_shift(0x40000000, 3), 2 ],
        [ anarchy.rev_circular_shift(0x00101030, 1), 0x00202060 ],
        [
          anarchy.rev_circular_shift(anarchy.circular_shift(1098301, 17), 17),
          1098301
        ],
      ],
      "fold": [
        // TODO: Verify these!
        [ anarchy.fold(22908, 7), 3002620284 ],
        [ anarchy.fold(18201, 18), 3326101273 ],
        [ anarchy.fold(anarchy.fold(18201, 18), 18), 18201 ],
      ],
      /*
      "": [
        [, ],
        [, ]
      ],
      "": [
        [, ],
        [, ]
      ],
      */
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

    // do it!
    run_value_tests();
  }
);
define(["anarchy"], function(anarchy) {
});
