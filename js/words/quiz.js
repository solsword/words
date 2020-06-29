"use strict";

function eventually_process_word_list(element) {
  var files = element.files;
  if (files === null || files === undefined || files.length < 1) {
    setTimeout(eventually_process_word_list, 50, element);
  } else {
    var first = files[0];
    var firstname = first.name;
    var fr = new FileReader();
    fr.onload = function (e) {
      var file_text = e.target.result;
      handle_uploaded_word_list(firstname.split(".")[0], file_text);
    }
    fr.readAsText(first);
  }
}

function handle_uploaded_word_list(fileName, text){
  let words = text.split(/\s+/);
  if(words[words.length-1] == ""){
    words.pop();
  }
  if(words[0] == ""){
    words.shift();
  }


  var value_selected = document.getElementById("language");
  var result = value_selected.options[value_selected.selectedIndex].value;

  let wordsURL = words.join(" ");
  wordsURL = escape(wordsURL);
  let link = document.getElementById("quiz_link");
  link.href = "index.html#"+ encodeURIComponent("words=" + wordsURL + ",domain=" + result);
  link.innerText = link.href;

}

export function setup_quiz() {
  // Setup function for the domain builder.
  var file_input = document.getElementById("words_list");

  file_input.onmousedown = function () { this.setAttribute("value", ""); };
  file_input.ontouchstart = file_input.onmousedown;
  file_input.onchange = function () {
    eventually_process_word_list(this);
  }
};
