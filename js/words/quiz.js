// quiz.js
// Setup and other functions for the quiz builder page.
/* global console, window, document, locale */

"use strict";

/**
 * Setup function for the quiz builder. Creates the event handlers for
 * the interactive elements on the page.
 */
export function setup_quiz() {
  var file_input = document.getElementById("words_list");

  file_input.onmousedown = function () { this.setAttribute("value", ""); };
  file_input.ontouchstart = file_input.onmousedown;
  file_input.onchange = function () {
    eventually_process_word_list(this);
  };
}

/**
 * Reschedules itself until a worldist file has been successfully
 * uploaded, and then calls handle_uploaded_word_list with the filename
 * and text of the file.
 *
 * @param element The type="file" <input> element where a file is being
 *     uploaded.
 */
function eventually_process_word_list(element) {
  var files = element.files;
  if (files === null || files === undefined || files.length < 1) {
    window.setTimeout(eventually_process_word_list, 50, element);
  } else {
    var first = files[0];
    var firstname = first.name;
    var fr = new window.FileReader();
    fr.onload = function (e) {
      var file_text = e.target.result;
      handle_uploaded_word_list(firstname.split(".")[0], file_text);
    };
    fr.readAsText(first);
  }
}

/**
 * Handles a word list once it's been uploaded. Creates a custom URL for
 * that wordlist and the currently-selected domain in "quiz" mode, and
 * sets that as the URL of the #quiz_link element.
 *
 * @param file_name The name of the file that was uploaded.
 * @param text The raw text of the file. Words in the file should be
 *     separated by tilde characters, and each may optionally have a
 *     definition separated from the word by a `. If using a
 *     case-insensitive domain, the words will eventually be uppercased
 *     automatically.
 *     TODO Better word list format...
 */
function handle_uploaded_word_list(file_name, text) {
    //let words = text.split(/\s+/);
    let words = text.split('~').map(w => w.trim());
    if(words[words.length-1] == ""){
        words.pop();
    }
    if(words[0] == ""){
        words.shift();
    }


    var language_select = document.getElementById("language");
    var result = language_select.options[language_select.selectedIndex].value;

    let wordsURL = words.join(";");
    wordsURL = window.escape(wordsURL);
    let link = document.getElementById("quiz_link");
    link.href = (
        "index.html#"
      + encodeURIComponent("mode=quiz,words=" + wordsURL + ",domain=" + result)
    );
    link.innerText = link.href;
}
