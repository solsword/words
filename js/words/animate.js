// animate.js
// Temporary animation objects for HTML5 canvas.

import * as draw from "./draw.js";

var ACTIVE = [];
var HORIZONS = [];
var QUEUED = [];

// When to wrap animation frame count:
export var ANIMATION_FRAME_MAX = 1000000000;

// Various duration constants (in frames)
export var INSTANT = 2;
export var BRIEF_MOMENT = 8;
export var MOMENT = 18;
export var SECOND = 60; // TODO: Make it so

// Previous frame count to measure frames elapsed:
var PREVIOUS_FRAME = undefined;

/**
 * A SimpleAnimation has a duration and an (optional) callback function to
 * be triggered when the animation ends. Its draw_at function will be
 * called by the draw function whenever drawing is necessary with three
 * arguments: the context, a progress number between 0 and 1 indicating
 * fraction of the duration elapsed, and a frame number counting from 0
 * when the animation starts. The SimpleAnimation will only request a
 * single redraw at the end of its duration (this does trigger two
 * subsequent updates: one with the animation drawn, and one without it).
 *
 * @param duration The duration of the animation in frames.
 * @param on_end A callback to activate when the animation ends.
 *
 * Note: override the draw_at method.
 */
export function SimpleAnimation(duration, on_end) {
    this.duration = duration;
    this.total_elapsed = 0;
    this.on_end = on_end;
}

/**
 * Default empty implementation of draw_at.
 *
 * @param ctx The canvas context to use for drawing.
 * @param progress A number between 0 and 1 indicating animation
 *     progress; reaches 1 at the end of the animation.
 * @param frame The current frame number, starting with 0 when the
 *     animation starts.
 */
SimpleAnimation.prototype.draw_at = function (ctx, progress, frame) {};

/**
 * Draw manages progress counting and calls draw_at.
 *
 * @param ctx The canvas context to draw on.
 * @param frames_elapsed The number of frames elapsed since the previous
 *     call to draw for this animation.
 *
 * @return The number of remaining frames before the end of this
 *     animation, or null if the animation is now over.
 */
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

/**
 * Creates an animation group that combines multiple simple animations.
 * Each member animation will have its draw method called when this
 * animation is drawn; when this animation is activated they will all
 * start drawing at the same time.
 *
 * @param members An array of animation objects to be drawn together.
 * @param on_end A callback function to be called when all member
 *     animations are finished (without arguments).
 */
export function AnimGroup(members, on_end) {
    let duration = Math.max(...members.map(x => x.duration));
    SimpleAnimation.call(this, duration, on_end);
    this.members = members;
    this.active = this.members.map(x => true);
}
AnimGroup.prototype = Object.create(SimpleAnimation.prototype);
AnimGroup.prototype.constructor = AnimGroup;

/**
 * Calls the draw function of each member animation instead of calling
 * the draw_at function of this object.
 *
 * @param ctx The canvas context to use for drawing.
 * @param frames_elapsed The number of frames elapsed since the previous
 *     call to draw.
 */
AnimGroup.prototype.draw = function (ctx, frames_elapsed) {
    if (frames_elapsed) {
        this.total_elapsed += frames_elapsed;
    }

    for (let member of this.members) {
        member.draw(ctx, frames_elapsed);
        // we ignore the return value
    }

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

/**
 * A MotionLine is an animation that indicates motion from one location
 * to another on the canvas.
 *
 * @param duration The duration of the animation in frames.
 * @param on_end A callback that will be called (with no arguments) when
 *     the animation ends.
 * @param from An x/y coordinate pair array specifying the origin of the
 *     line to be drawn.
 * @param to An x/y coordinate pair array specifying the destination of
 *     the line to be drawn.
 * @param style A style object specifying the 'color' and/or 'line_width'
 *     of the line to be drawn. May be omitted to use a default style
 *     (1-pixel white).
 */
export function MotionLine(duration, on_end, from, to, style) {
    SimpleAnimation.call(this, duration, on_end);
    this.from = from;
    this.to = to;
    this.style = style || {};
    this.style.color = this.style.color || "#fff";
    this.style.line_width = this.style.line_width || 1;
};
MotionLine.prototype = Object.create(SimpleAnimation.prototype);
MotionLine.prototype.constructor = MotionLine;

/**
 * Draws a line between the origin and destination points, which persists
 * while the animation is active and then disappears.
 * TODO: More complex animation here?
 *
 * @param ctx The canvas context to use for drawing.
 * @param progress The fractional progress of the animation, between 0
 *     and 1.
 * @param frame The frame number of the animation, starting at 0 when the
 *     animation starts.
 */
MotionLine.prototype.draw_at = function (ctx, progress, frame) {
    ctx.strokeStyle = this.style.color;
    ctx.lineWidth = this.style.line_width;
    ctx.beginPath();
    ctx.moveTo(this.from[0], this.from[1]);
    ctx.lineTo(this.to[0], this.to[1]);
    ctx.stroke();
}

/**
 * Draws all active animations. Returns undefined if all animations are
 * stable, or an integer number of frames to advance until the next
 * animation needs a redraw.
 *
 * @param ctx The canvas context to draw on.
 * @param frame The current animation frame (an integer). This value will
 *     sometimes decrease when the animation frame counter wraps around.
 *
 * @return The number of frames until the next animation needs a redraw,
 *     or undefined if all animations are stable.
 */
export function draw_active(ctx, frame) {
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

/**
 * Activates the given animation, causing it to start drawing after the
 * given delay (default 0 frames). The animation can only start when a
 * frame is drawn, so the delay starts counting with the first call to
 * draw_active after activate_animation is called.
 *
 * @param anim The animation to activate.
 * @param delay The number of frames to delay before the animation should
 *     start.
 */
export function activate_animation(anim, delay) {
    QUEUED.push([anim, delay || 0]);
}

/**
 * Immediately removes the given animation from the list of active
 * animations. A redraw should be triggered after calling this. If the
 * given animation isn't active, this function safely does nothing.
 *
 * @param anim The animation to stop.
 */
export function stop_animation(anim) {
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

/**
 * Returns whether the given animation is still active.
 *
 * @param anim The animation to check on.
 */
export function is_active(anim) {
    for (var i = 0; i < ACTIVE.length; ++i) {
        if (ACTIVE[i] === anim) {
            return true;
        }
    }
    return false;
}
