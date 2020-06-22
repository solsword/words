requirejs.config({
  baseURL: "js/",
});

requirejs(
  ["words/words"],
  function(words) {
    words.setup_quiz()
  }
);

function GetSelectedValue(){
				var value_selected = document.getElementById("language");
				var result = value_selected.options[value_selected.selectedIndex].value;

			}
