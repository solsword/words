// stringify.js
// Web worker for converting (big) objects to JSON strings.

/**
 * Message handling function which simply takes the message data object,
 * converts it to a string with JSON.stringify, posts a message
 * containing the resulting string, and shuts down this worker.
 *
 * @param A message object whose data should be a JSON-able object.
 */
function handle_message(msg) {
  let obj = msg.data;
  let str = JSON.stringify(obj);
  postMessage(str);
  close(); // this worker is done.
}


// Set up our message handler
self.onmessage = handle_message;

// Let the main page know we're ready
self.postMessage("worker_ready");
