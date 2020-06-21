// builder.js
// Word game domain-builder code.
/* global console, window, document */

"use strict";

import * as dict from "./dict.js";

/**
 * Waits until the given file upload element has file(s) available, and
 * as soon as it does, sets up a reader process to read the first of
 * those and process it as a words list for creating a domain. Ultimately
 * calls handle_uploaded_domain with the text and filename from the
 * uploaded file.
 *
 * @param element A DOM <input> node with type="file".
 */
export function eventually_process_upload(element) {
    var files = element.files;
    if (files === null || files === undefined || files.length < 1) {
        window.setTimeout(eventually_process_upload, 50, element);
    } else {
        var first = files[0];
        var firstname = first.name;
        var fr = new window.FileReader();
        fr.onload = function (e) {
            var file_text = e.target.result;
            handle_uploaded_domain(firstname.split(".")[0], file_text);
        };
        fr.readAsText(first);
    }
}

/**
 * Helper to convert a fraction to a percentage string.
 *
 * @param n A number between 0 and 1 (technically could be any number) to
 *     be converted to a percentage string.
 * @return A string containing 100x the input number with 1 digit after
 *     the decimal point.
 */
export function pct(n) {
    return (n * 100).toFixed(1);
}

/**
 * Called in the domain builder once a domain file has been uploaded and we
 * have the text. This function calls load_json_or_list_from_data and
 * hooks up callbacks such that progress is displayed on the page, and
 * ultimately, done_processing is called with the domain name and
 * polished domain object as arguments.
 *
 * @param name A string naming the domain being processed.
 * @param text The raw data to be used to create the domain, either a
 *     JSON string or a words list string.
 */
export function handle_uploaded_domain(name, text) {
    var loading = document.getElementById("loading");
    dict.load_json_or_list_from_data(
        name,
        text,
        function (progress) {
            loading.innerText = "Counting glyphs... " + pct(progress) + "%";
        },
        function (progress) {
            if (progress == 1) {
                loading.innerText = (
                    "Done counting; done indexing; transferring result... "
                );
            } else {
                loading.innerText = (
                    "Done counting; building index... " + pct(progress) + "%"
                );
            }
        },
        function (name, polished) {
            loading.innerText = (
                "Recieved result..."
            );
            done_processing(name, polished);
        }
    );
}

/**
 * Called when the web worker is done polishing a domain in the domain
 * builder. Initiates a second web worker job to turn the domain object
 * into a JSON string, and sets up a callback so that offer_string will
 * be called on that string when it's ready.
 *
 * @param name The name of the domain being processed.
 * @param output A polished domain object for that domain.
 */
function done_processing(name, output) {
    let loading = document.getElementById("loading");
    loading.innerText = (
        "Done counting; done building index; building JSON string..."
    );
    dict.stringify_and_callback(
        output,
        function (str) {
            offer_string(name, str);
        }
    );
}

/**
 * Offers a string to the user via a disabled text input element for
 * copy/paste and via a download button.
 *
 * @param name The name to use for the file download offered.
 * @param str A string containing JSON data.
 */
export function offer_string(name, str) {
    let loading = document.getElementById("loading");
    loading.innerText = "Done loading. Receive output below.";

    let output_bin = document.getElementById("output_bin");
    output_bin.removeAttribute("disabled");
    output_bin.innerText = str;
    output_bin.onclick = function () { this.select(); };
    output_bin.ontouchend = output_bin.onclick;

    let download_button = document.getElementById("download_button");
    download_button.removeAttribute("disabled");
    download_button.onmousedown = function () {
        let blob = new window.Blob([str], {type: "text/json;charset=utf-8"});
        let ourl = window.URL.createObjectURL(blob);
        let link = document.getElementById("download_link");
        link.setAttribute("href", ourl);
        link.setAttribute("download", name + ".json");
    };
}

/**
 * Setup function for the domain builder page.
 *
 * Sets up the file upload input to kick off the polishing process.
 */
export function build_domains() {
    let file_input = document.getElementById("words_list");

    file_input.onmousedown = function () { this.setAttribute("value", ""); };
    file_input.ontouchstart = file_input.onmousedown;
    file_input.onchange = function () {
        eventually_process_upload(this);
    };
}
