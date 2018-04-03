// animate.js
// Temporary animation objects for HTML5 canvas.

define(["./draw", "./locale"], function(draw, locale) {
  var ACTIVE = [];
  var HORIZONS = [];
  var QUEUED = [];

  // When to wrap animation frame count:
  var ANIMATION_FRAME_MAX = 1000000000;

  // Various duration constants (in frames)
  var INSTANT = 2;
  var BRIEF_MOMENT = 8;
  var MOMENT = 18;
  var SECOND = 60; // TODO: Make it so

  // Previous frame count to measure frames elapsed:
  var PREVIOUS_FRAME = undefined;

  function SimpleAnimation(ctx, duration, on_end) {
    // A SimpleAnimation has a duration and an (optional) callback function to
    // be triggered when the animation ends. Its draw_at function will be
    // called by the draw function whenever drawing is necessary with three
    // arguments: the context, a progress number between 0 and 1 indicating
    // fraction of the duration elapsed, and a frame number counting from 0
    // when the animation starts. The SimpleAnimation will only requests a
    // single redraw at the end of its duration (this does trigger two
    // subsequent updates: one with the animation drawn, and one without it).
    this.duration = duration;
    this.total_elapsed = 0;
    this.on_end = on_end;
  }

  // Default empty implementation
  SimpleAnimation.prototype.draw_at = function (ctx, progress, frame) {};

  // Draw manages progress counting and calls draw_at;
  SimpleAnimation.prototype.draw = function (ctx, frames_elapsed) {
    if (frames_elapsed) {
      this.total_elapsed += frames_elapsed;
    }

    this.draw_at(ctx, this.total_elapsed / this.duration, this.total_elapsed);

    var remaining = this.duration - this.total_elapsed;
    if (remaining > 0) {
      return remaining;
    } else {
      if (this.on_end != undefined) {
        this.on_end(); // call ending callback
      }
      return null;
    }
  }

  function AnimGroup(ctx, duration, on_end, members) {
    SimpleAnimation.call(this, ctx, duration, on_end);
    this.members = members;
  }
  AnimGroup.prototype = Object.create(SimpleAnimation.prototype);
  AnimGroup.prototype.constructor = AnimGroup;

  AnimGroup.prototype.draw_at = function (ctx, progress, frame) {
    this.members.forEach(m => m.draw_at(ctx, progress, frame));
  }

  function MotionLine(ctx, duration, on_end, from, to, style) {
    SimpleAnimation.call(this, ctx, duration, on_end);
    this.from = from;
    this.to = to;
    this.style = style || {};
    this.style.color = this.style.color || "#fff";
    this.style.line_width = this.style.line_width || 1;
  };
  MotionLine.prototype = Object.create(SimpleAnimation.prototype);
  MotionLine.prototype.constructor = MotionLine;

  MotionLine.prototype.draw_at = function (ctx, progress, frame) {
    // TODO: More complex animation here?
    ctx.strokeStyle = this.style.color;
    ctx.lineWidth = this.style.line_width;
    ctx.beginPath();
    ctx.moveTo(this.from[0], this.from[1]);
    ctx.lineTo(this.to[0], this.to[1]);
    ctx.stroke();
  }

  function draw_active(ctx, frame) {
    // Draws all active animations. Returns undefined if all animations are
    // stable, or an integer number of frames to advance until the next
    // animation needs a redraw.
    var result = false;
    var frames_elapsed;
    if (PREVIOUS_FRAME == undefined) {
      frames_elapsed = 1;
    } else if (PREVIOUS_FRAME > frame) {
      frames_elapsed = (ANIMATION_FRAME_MAX - PREVIOUS_FRAME) + frame;
    } else {
      frames_elapsed = frame - PREVIOUS_FRAME;
    }
    PREVIOUS_FRAME = frame;

    // Add queued animations:
    var n_old = ACTIVE.length;
    while (QUEUED.length) {
      var entry = QUEUED.pop();
      ACTIVE.push(entry[0]);
      HORIZONS.push(entry[1]);
    }

    var min_horizon = undefined;
    var any_expired = false;
    var still_active = [];
    var new_horizons = [];
    for (let i = 0; i < ACTIVE.length; ++i) {
      var anim = ACTIVE[i];
      var horizon = HORIZONS[i];
      var new_horizon;
      let adj_elapsed = frames_elapsed;
      if (i >= n_old) {
        adj_elapsed = 0; // for fresh animations added from the queue
      }
      if (horizon <= adj_elapsed) {
        new_horizon = anim.draw(ctx, adj_elapsed);
        // TODO: Some way to hang around indefinitely without prompting
        // redraws?
        if (new_horizon == null) { // animation is over
          any_expired = true;
        } else { // animation isn't over
          still_active.push(anim);
          new_horizons.push(new_horizon);
        }
      } else {
        anim.draw(ctx, adj_elapsed); // don't care about horizon response
        // TODO: Do we really not care?
        new_horizon = horizon - adj_elapsed;
        still_active.push(anim);
        new_horizons.push(new_horizon);
      }
      if (
        new_horizon != null
     && (
          min_horizon == undefined
       || min_horizon > new_horizon
        )
      ) {
        min_horizon = new_horizon;
      }
    }
    ACTIVE = still_active;
    HORIZONS = new_horizons;
    if (any_expired) {
      return 0; // need to redraw next frame without expired animations
    } else {
      return min_horizon;
    }
  }

  function activate_animation(anim, delay) {
    // Activates the given animation, causing it to start drawing after the
    // given delay (default 0 frames). The animation can only start when a
    // frame is drawn, so the delay starts counting with the first call to
    // draw_active after activate_animation is called.
    QUEUED.push([anim, delay || 0]);
  }

  function stop_animation(anim) {
    // Immediately removes the given animation from the list of active
    // animations. A redraw should be triggered after calling this. If the
    // given animation isn't active, this function safely does nothing.
    for (var i = 0; i < ACTIVE.length; ++i) {
      if (ACTIVE[i] === anim) {
        break;
      }
    }
    if (i < ACTIVE.length) {
      ACTIVE.splice(i, 1);
      HORIZONS.splice(i, 1);
    }
  }

  function is_active(anim) {
    // Returns whether the given animation is still active.
    for (var i = 0; i < ACTIVE.length; ++i) {
      if (ACTIVE[i] === anim) {
        return true;
      }
    }
    return false;
  }

  return {
    "ANIMATION_FRAME_MAX": ANIMATION_FRAME_MAX,
    "INSTANT": INSTANT,
    "BRIEF_MOMENT": BRIEF_MOMENT,
    "MOMENT": MOMENT,
    "SECOND": SECOND,
    "SimpleAnimation": SimpleAnimation,
    "AnimGroup": AnimGroup,
    "MotionLine": MotionLine,
    "draw_active": draw_active,
    "activate_animation": activate_animation,
    "stop_animation": stop_animation,
    "is_active": is_active,
  };
});
