// icons.js
// Custom icon drawing code.

define([], function() {

  let WIDTH = 30;
  let HEIGHT = 30;

  function unknown(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("?", ...xy); // TODO
  }

  function hunt(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("H", ...xy); // TODO
  }

  function encircle(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("O", ...xy); // TODO
  }

  function stretch(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("|", ...xy); // TODO
  }

  function branch(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("Y", ...xy); // TODO
  }

  function big(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("B", ...xy); // TODO
  }

  function glyphs(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("G", ...xy); // TODO
  }

  function quest_in_progress(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("‥", ...xy); // TODO
  }

  function quest_finished(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("!", ...xy); // TODO
  }

  function quest_perfect(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("%", ...xy); // TODO
  }

  return {
    "WIDTH": WIDTH,
    "HEIGHT": HEIGHT,
    "unknown": unknown,
    "hunt": hunt,
    "encircle": encircle,
    "stretch": stretch,
    "branch": branch,
    "big": big,
    "glyphs": glyphs,
    "quest_in_progress": quest_in_progress,
    "quest_finished": quest_finished,
    "quest_perfect": quest_perfect,
  }
});
