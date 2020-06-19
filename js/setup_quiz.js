requirejs.config({
  baseURL: "js/",
});

requirejs(
  ["words/words"],
  function(words) {
    words.setup_quiz()
  }
);
