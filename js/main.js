function is_odd(n) {
  return n % 2 != 0;
}

requirejs.config({
  baseURL: "js/",
});

requirejs(
  ["words/words"],
  function(words) {
    words.start_game()
  }
);
