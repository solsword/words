requirejs.config({
  baseURL: "js/",
});

requirejs(
  ["words/words"],
  function(words) {
    words.build_domains()
  }
);
