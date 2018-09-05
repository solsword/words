self.onmessage = function(msg) {
  let obj = msg.data;
  let str = JSON.stringify(obj);
  postMessage(str);
  close(); // this worker is done.
}

self.postMessage("worker_ready");
