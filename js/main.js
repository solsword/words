function is_odd(n) {
  return n % 2 != 0;
}

requirejs.config({
  baseURL: "js/",
/*
  paths: {
    "planck": "bower_components/planck-js/dist/planck",
  }
*/
});

requirejs(
  ["words/words"],
  function(words) {
    words.start_game()
  }
);
