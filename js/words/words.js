// words.js
// Word game.

define(["./draw", "./grid"], function(draw, grid) {

  var VIEWPORT_SIZE = 800.0;
  var VIEWPORT_SCALE = 1.0;

  function start_game() {
    // set up canvas context
    CANVAS = document.getElementById("canvas");
    var bounds = CANVAS.getBoundingClientRect();
    var car = bounds.width / bounds.height;
    CANVAS.width = 800 * car;
    CANVAS.height = 800;
    CTX = CANVAS.getContext("2d");
    CTX.cwidth = CANVAS.width;
    CTX.cheight = CANVAS.height; // TODO: Update these dynamically
    CTX.middle = [CTX.cwidth / 2, CTX.cheight / 2];
    CTX.bounds = bounds;
    CTX.viewport_size = VIEWPORT_SIZE;
    CTX.viewport_center = [0, 0];
    CTX.viewport_scale = VIEWPORT_SCALE;

    // kick off animation
    window.requestAnimationFrame(animate);

    // set up event handlers
    /*
    Event.observe(CANVAS, 'click', function(e) {
      var vpos = [
        Event.pointerX(e) - CTX.bounds.left,
        Event.pointerY(e) - CTX.bounds.top
      ]
      var wpos = draw.world_pos(CTX, vpos);
      // TODO: HERE!
      if (e.preventDefault) {
        e.preventDefault();
      }
    });
    */
  }

  function animate(now) {
    // draw the world
    CTX.clearRect(0, 0, CTX.cwidth, CTX.cheight);
    draw.draw(CTX);

    // reschedule ourselves
    window.requestAnimationFrame(animate);
  }

  return {
    "start_game": start_game
  }
});
