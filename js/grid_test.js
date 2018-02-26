requirejs.config({
  baseURL: "js/",
});

requirejs(
  ["words/words"],
  function(words) {
    words.test_grid()
  }
);
