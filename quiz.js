// quiz.js
// Word game quiz mode

/**
 * This function is getting the file from the given file element and reads if
 * there is anything and if it doesn't read anything, it reloads again. If it
 * does, it sets up a reader process to read the first of
 * those and process it as a words list for creating a domain, Then, it calls
 * handle_uploaded_word_list to split the file to be read the way
 * we want it to.
 *
 * @param element A DOM <input> node with type="file".
 */
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

/**
* This function gets the file and the selected option of the user. The words and
* and definitions are separated. The words are then placed in a string.
*
* @param filename  The file is a txt file in format: word`definition~
* @param text The words and definitions the user uploads which are then separated.
*/
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

  let wordsURL = words.join(";");
  wordsURL = escape(wordsURL);
  let link = document.getElementById("quiz_link");
  link.href = "index.html#"+ encodeURIComponent("words=" + wordsURL + ",domain=" + result);
  link.innerText = link.href;

}

/**
* Setup quiz function sets up the function for the domain page (start_quiz.html)
*
* Calls eventually_process_word_list to set up the file upload input to kick off
* the polishing process.
*/
export function setup_quiz() {
  var file_input = document.getElementById("words_list");

  file_input.onmousedown = function () { this.setAttribute("value", ""); };
  file_input.ontouchstart = file_input.onmousedown;
  file_input.onchange = function () {
    eventually_process_word_list(this);
  }
};
