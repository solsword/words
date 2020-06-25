// quests.js
// Quests functionality.
/* global console */

"use strict";

import * as grid from "./grid.js";
import * as draw from "./draw.js";
import * as content from "./content.js";
import * as dimensions from "./dimensions.js";
import * as icons from "./icons.js";
import * as colors from "./colors.js";

/**
 * Variables that controls spacing of the quest UI elements.
 */
var PADDING = 8;
var SPACE = 20;

/**
 * Checks whether a word matches a hint. The hint string may include '_'
 * to match any single character, and '*' to match any sequence of
 * characters. So for example a hint 'w_tch' matches words like 'watch'
 * and 'witch', or a hint 'c*n' would match words including 'can' and
 * 'cambrian'.
 *
 * @param hint A string that determines which words can match.
 * @param word The word to check.
 */
export function matches(hint, word) {
    let alignments = [[0, 0]];
    while (alignments.length > 0) {
        let next_alignments = [];
        // Compute new alignments
        for (let j = 0; j < alignments.length; ++j) {
            let a = alignments[j];
            let ha = a[0];
            let wa = a[1];
            if (ha >= hint.length) {
                continue;
            }
            let h = hint[ha];
            if (wa >= word.length) {
                if (h == "*") {
                    next_alignments.push([ha + 1, wa + 1]);
                    if (ha == hint.length - 1) {
                        return true;
                    }
                }
                continue;
            }
            let c = word[wa];
            let works = false;
            if (h == c || h == "_") {
                next_alignments.push([ha + 1, wa + 1]);
                works = true;
            } else if (h == "*") {
                next_alignments.push([ha + 1, wa + 1]);
                next_alignments.push([ha, wa + 1]);
                next_alignments.push([ha + 1, wa]);
                works = true;
            }
            if (works && ha == hint.length - 1 && wa == word.length - 1) {
                return true;
            }
        }
        // Swap alignments
        alignments = next_alignments;
    }
    return false;
}

/**
 * Computes how many tiles are encircled within unlocked tiles in a given
 * dimension. Includes unlocked tiles themselves.
 *
 * @param dimension The dimension object to measure in.
 *
 * @return The total number of unlocked hexes in the given dimension,
 *     plus the total number of locked hexes which are completely
 *     encircled by unlocked hexes.
 */
export function unlocked_encircled(dimension) {
    // Create map for checking whether tiles are in the unlocked region:
    let unlk = content.unlocked_set(dimension);

    // Compute bounding box of unlocked region
    let bounds = [undefined, undefined, undefined, undefined];
    for (let k of Object.keys(unlk)) {
        let pos = grid.key__coords(k);
        if (pos == undefined) {
            continue;
        }
        if (bounds[0] == undefined || pos[0] < bounds[0]) {
            bounds[0] = pos[0];
        }
        if (bounds[2] == undefined || pos[0] > bounds[2]) {
            bounds[2] = pos[0];
        }
        if (bounds[1] == undefined || pos[1] < bounds[1]) {
            bounds[1] = pos[1];
        }
        if (bounds[3] == undefined || pos[1] > bounds[3]) {
            bounds[3] = pos[1];
        }
    }
    let edges = {};
    for (let x = bounds[0] - 1; x < bounds[2] + 1; ++x) {
        let k1 = grid.coords__key([x, bounds[1] - 1]);
        let k2 = grid.coords__key([x, bounds[3] + 1]);
        edges[k1] = true;
        edges[k2] = true;
    }
    for (let y = bounds[1] - 1; y < bounds[3] + 1; ++y) {
        let k1 = grid.coords__key([bounds[0] - 1, y]);
        let k2 = grid.coords__key([bounds[2] + 1, y]);
        edges[k1] = true;
        edges[k2] = true;
    }
    let edge_area = Object.keys(edges).length;
    let full_width = bounds[2] - 1 - bounds[0] + 1;
    let full_height = bounds[3] - 1 - bounds[1] + 1;
    let full_area = full_width * full_height;

    // Queue starts containing all edge tiles.
    let queue = [];
    for (let k of Object.keys(edges)) {
        queue.push(grid.key__coords(k));
    }

    // DFS to fill in edge area that's reachable from outside the path.
    while (queue.length > 0) {
        let next = queue.pop();
        for (let d = 0; d < 6; ++d) {
            let np = grid.neighbor(next, d);
            if (
                np[0] < bounds[0]
                || np[0] > bounds[2]
                || np[1] < bounds[1]
                || np[1] > bounds[3]
            ) { // neighbor is out-of-bounds
                continue;
            }
            let nk = grid.coords__key(np);
            if (!edges[nk] && !unlk[nk]) { // not already-visited or in path
                edges[nk] = true;
                queue.push(nk);
                edge_area += 1;
            }
        }
    }

    // And now we know:
    return full_area - edge_area;
}

/**
 * Computes how many tiles are spanned by the unlocked area in the given
 * dimension.
 *
 * @param dimension The dimension object to measure in.
 *
 * @return The maximum x-, y-, or z-axis difference between two unlocked
 *     tiles in the given dimension. Because of hex movement
 *     possibilities, this is also the maximum number of steps required
 *     to move between any pair of unlocked tiles.
 */
export function unlocked_span(dimension) {
    // Create map for checking whether tiles are in the unlocked region:
    let xbounds = [undefined, undefined];
    let ybounds = [undefined, undefined];
    let zbounds = [undefined, undefined];
    let unlk = content.unlocked_set(dimension);
    for (var k of Object.keys(unlk)) {
        let pos = grid.key__coords(k);
        if (pos == undefined) {
            continue;
        }
        let x = pos[0];
        let y = pos[1];
        let z = grid.z_coord(pos);
        if (xbounds[0] == undefined || x < xbounds[0]) {
            xbounds[0] = x;
        }
        if (xbounds[1] == undefined || x > xbounds[1]) {
            xbounds[1] = x;
        }
        if (ybounds[0] == undefined || y < ybounds[0]) {
            ybounds[0] = y;
        }
        if (ybounds[1] == undefined || y > ybounds[1]) {
            ybounds[1] = y;
        }
        if (zbounds[0] == undefined || z < zbounds[0]) {
            zbounds[0] = z;
        }
        if (zbounds[1] == undefined || z > zbounds[1]) {
            zbounds[1] = z;
        }
    }

    let dx = xbounds[1] - xbounds[0];
    let dy = ybounds[1] - ybounds[0];
    let dz = zbounds[1] - zbounds[0];

    // And now we know:
    return Math.max(dx, dy, dz);
}

/**
 * Computes how many y-shaped branches exist among the unlocked tiles in
 * the given dimension.
 *
 * @param dimension The dimension object to check.
 *
 * @return The number of unlocked tiles in the given dimension which have
 *     unlocked neighbors in one of the two possible y-shaped neighbor
 *     configurations.
 */
export function unlocked_branches(dimension) {
    let unlk = content.unlocked_set(dimension);

    // Check each position to see if it's the center of a branch setup:
    let branches = 0;
    for (let k of Object.keys(unlk)) {
        let pos = grid.key__coords(k);
        if (pos == undefined) {
            continue;
        }
        let each = [ true, true ];
        let none = [ true, true ];
        for (let d of [0, 2, 4]) {
            let np = grid.neighbor(pos, d);
            let nk = grid.coords__key(np);
            if (unlk[nk]) {
                none[0] = false;
            } else {
                each[0] = false;
            }
        }
        for (let d of [1, 3, 5]) {
            let np = grid.neighbor(pos, d);
            let nk = grid.coords__key(np);
            if (unlk[nk]) {
                none[1] = false;
            } else {
                each[1] = false;
            }
        }
        if ((each[0] && none[1]) || (each[1] && none[0])) {
            branches += 1;
        }
    }

    // And now we know:
    return branches;
}

/**
 * Computes an array containing the number of words unlocked of size i at
 * each index i (up to the length of the longest word found).
 *
 * @param dimension The dimension object to inspect.
 *
 * @return An array with one entry at each index for which there is at
 *     least one unlocked word. There may be in-between entries that are
 *     undefined for which there is no unlocked word of that length. For
 *     each entry that does exist, the value will be the number of
 *     unlocked words of that length.
 */
export function unlocked_sizes(dimension) {
    let unlk = content.unlocked_paths(dimension);
    let result = [];

    // Record length of each unlocked path:
    for (let path of unlk) {
        let l = path.length;
        if (result[l] == undefined) {
            result[l] = 1;
        } else {
            result[l] += 1;
        }
    }

    // And now we know:
    return result;
}

/**
 * Takes a stored quest and re-creates a full quest object, re-initializing
 * the object using the given words found list.
 *
 * @param q The stored quest object to revive.
 * @param words_found An array of words (strings) that the user has found.
 *
 * @return A full quest object with internal state based on the words
 * found list.
 */
export function revive_quest(q, words_found) {
    let result = undefined;
    if (q.type == "hunt") {
        result = new HuntQuest(
            q.targets,
            q.bonuses,
            q.params,
            q.reward,
            q.found
        );
    } else if (q.type == "encircle") {
        result = new EncircleQuest(q.target, q.bonus, q.reward);
    } else if (q.type == "stretch") {
        result = new StretchQuest(q.target, q.bonus, q.reward);
    } else if (q.type == "branch") {
        result = new BranchQuest(q.target, q.bonus, q.reward);
    } else if (q.type == "glyph") {
        result = new GlyphQuest(q.targets, q.bonuses, q.reward, q.found);
    }
    result.initialize(result.dimension, words_found);
    return result;
}


/**
 * Takes a type and a reward and initializes a quest object.
 *
 * @param type A string indicating the type of quest. One of:
 *     - 'hunt' Find specific words from a list of hints.
 *     - 'encircle' Encircle a certain total area.
 *     - 'stretch' Unlock points a certain distance away from each other.
 *     - 'branch' Create a certain number of y-shaped branches.
 *     - 'glyph' Unlock certain numbers of certain specific glyphs.
 *
 * @param reward TODO: What are these and how do they work?
 */
export function Quest(type, reward) {
    this.type = type;
    this.reward = reward;
    this.expanded = false;
    this.icon = icons.unknown;
}

/**
 * Sets up the quest based on the contents of a specific dimension and a
 * given words-found list.
 *
 * @param dimension The dimension object to associate with the quest.
 * @param words_found The current list of words found.
 */
Quest.prototype.initialize = function(dimension, words_found) {
    this.dimension = dimension;
};

/**
 * Updates the quest state based on the discovery of a specific word
 * along a specific path of tiles.
 *
 * @param dimension The dimension in which the match occurred.
 * @param match A match array TODO: What's that?
 * @param path An array of hex coordinate pairs specifying the layout of
 *     the word that was matched.
 */
Quest.prototype.find_word = function(dimension, match, path) {
    console.error("Quest.find_word isn't implemented.");
};

/**
 * Tests whether the quest is complete. Override this.
 *
 * @return True or false depending on whether the quest is complete or
 * not.
 */
Quest.prototype.is_complete = function() {
    console.error("Quest.is_complete isn't implemented.");
    return false;
};

/**
 * Returns whether or not the quest bonus condition has been completed.
 * Override this.
 *
 * @return True if the quest bonus condition has been completed; false
 *     otherwise.
 */
Quest.prototype.got_bonus = function() {
    console.error("Quest.got_bonus isn't implemented.");
    return false;
};

Quest.prototype.claim_reward = function() {
    this.reward();
    console.log("reward!");
}

/**
 * Handles taps on the quest UI element in a list of quests.
 *
 * @param rxy A 2-element x/y coordinate array specifying the relative
 *     x/y position of the tap from the upper-left corner of the UI
 *     element.
 */
Quest.prototype.tap = function(rxy) {
    console.log("tap!");
    let x = rxy[0];
    let y = rxy[1];
    // console.log("x",y,"y",y, PADDING, icons.WIDTH, icons.HEIGHT);
    if (
        x >= PADDING
        // && x <= PADDING + icons.WIDTH
        && x >= PADDING + icons.WIDTH
        && y >= PADDING
        // && y <= PADDING + icons.HEIGHT
        && y >= PADDING + icons.HEIGHT
    ) {
        let complete = this.is_complete();
        if (complete && this.got_bonus()) {
            // TODO: HERE
            console.log("QUEST w/ BONUS");
        } else if (complete) {
            // TODO: HERE
            console.log("QUEST");
            //staci and kat claim_reward
            this.claim_reward();
        }
    } else {
        this.expanded = !this.expanded;
    }
};

/**
 * Returns a summary string indicating the completion state of the quest.
 *
 * @return A string which will be incorporated into the quest UI element.
 */
Quest.prototype.summary_string = function () {
    console.warn("summary_string isn't implemented for base Quest.");
    return "<error>";
};

/**
 * Returns the canvas width of the quest UI element.
 *
 * @param ctx The canvas context to use for measuring text.
 *
 * @return The natural width of the quest UI element in pixels.
 */
Quest.prototype.width = function(ctx) {
    let ss = this.summary_string();
    let m = draw.measure_text(ctx, ss);
    return 2*(icons.WIDTH + 2*PADDING) + SPACE + m.width + 2*PADDING;
};

/**
 * Returns the canvas height of the quest UI element.
 *
 * @param ctx The canvas context to use for measuring text.
 *
 * @return The natural height of the quest UI element.
 */
Quest.prototype.height = function (ctx) {
    let ss = this.summary_string();
    let m = draw.measure_text(ctx, ss);
    return Math.max(icons.HEIGHT, m.height) + 2*PADDING;
};

/**
 * Base implementation draws border, summary: completion icon, and quest
 * type icon.
 *
 * @param ctx The canvas context to use for drawing.
 * @param width The desired width to draw at. Will generally be at least
 *     as great as the natural width of the quest.
 */
Quest.prototype.draw = function (ctx, width) {
    // Draw border:
    let tw = Math.max(this.width(ctx), width);
    let th = this.height(ctx);
    ctx.beginPath();
    ctx.fillStyle = colors.scheme_color("menu", "button");
    ctx.strokeStyle = colors.scheme_color("menu", "border");
    ctx.rect(PADDING/2, PADDING/2, tw-PADDING, th-PADDING);
    ctx.stroke();
    ctx.fill();
    // Figure out positions & states:
    let complete = this.is_complete();
    let perfect = complete && this.got_bonus();
    let ss = this.summary_string();
    let m = draw.measure_text(ctx, ss);
    let h = Math.max(icons.HEIGHT, m.height) + 2*PADDING;
    let qcpos = [icons.WIDTH/2 + PADDING, h/2];
    let qipos = [icons.WIDTH*1.5 + 3*PADDING, h/2];
    let ss_left = icons.WIDTH*2 + 5*PADDING + SPACE;
    ctx.strokeStyle = colors.scheme_color("menu", "text");
    // Draw completion icon:
    if (perfect) {
        icons.quest_perfect(ctx, qcpos);
    } else if (complete) {
        icons.quest_finished(ctx, qcpos);
    } else {
        icons.quest_in_progress(ctx, qcpos);
    }
    // Draw quest icon:
    this.icon(ctx, qipos);
    // Draw summary text:
    ctx.fillStyle = colors.scheme_color("menu", "text");
    ctx.textBaseline = "middle";
    let sspos;
    if (ss_left + m.width < width) {
        ctx.textAlign = "right";
        sspos = width - PADDING;
    } else {
        ctx.textAlign = "left";
        sspos = ss_left;
    }
    ctx.fillText(ss, sspos, h/2);
};


/**
 * Generic subtype for quests that just have numerical targets/bonuses.
 * Supplies is_complete, got_bonus, summary_string, full_string,
 * threshold_positions, width, height, and draw functions.
 *
 * @param type The quest type (see Quest).
 * @param target The numeric value to reach to complete the quest.
 * @param bonus The numeric value to reach to earn the quest bonus.
 * @param reward The quest reward (TODO: What is this?!?!)
 */
export function NumericQuest(type, target, bonus, reward) {
    Quest.call(this, type, reward);
    this.icon = icons.unknown;
    this.target = target;
    this.bonus = bonus;
    this.value = 0;
}

NumericQuest.prototype = Object.create(Quest.prototype);
NumericQuest.prototype.constructor = NumericQuest;

/**
 * For subtypes, this should return a string that describes the state.
 *
 * @return A string describing quest progress.
 */
NumericQuest.prototype.full_string = function () {
    console.warn("full_string isn't implemented for base NumericQuest.");
    return "<error>";
};

/**
 * @return The positions (on a scale of 0--1) of the current value and
 *     target value relative to the bonus value.
 */
NumericQuest.prototype.threshold_positions = function () {
    return [
        Math.min(1, this.value / this.bonus),
        Math.min(1, this.target / this.bonus)
    ];
};

/**
 * @return True if the current numeric value is greater than or equal to
 *     the target value.
 */
NumericQuest.prototype.is_complete = function () {
    return this.value >= this.target;
};

/**
 * @return True if the current numeric value is greater than or equal to
 *     the bonus value.
 */
NumericQuest.prototype.got_bonus = function () {
    return this.value >= this.bonus;
};

/**
 * Indicates the quest progress with the current value in the numerator
 * and the target value in the denominator.
 *
 * @return A summary string.
 */
NumericQuest.prototype.summary_string = function() {
    return "" + this.value + "/" + this.target;
};

/**
 * A string indicating progress which includes the bonus value as well as
 * the current and target values.
 *
 * @return A detailed summary string.
 */
NumericQuest.prototype.full_string = function() {
    if (this.bonus > this.target) {
        return (
            ""
            + this.value
            + "/"
            + this.target
            + " (" + this.bonus + ")"
        );
    } else {
        return (
            ""
            + this.value
            + "/"
            + this.target
        );
    }
};

/**
 * Computes the natural width of the quest UI element.
 *
 * @param ctx The canvas context to use for measuring strings.
 *
 * @return The UI element's natural width.
 */
NumericQuest.prototype.width = function (ctx) {
    let xw = Quest.prototype.width.call(this, ctx);
    if (this.expanded) {
        let m = draw.measure_text(ctx, this.full_string());
        xw = Math.max(xw, m.width + 2*SPACE + 3*PADDING);
    }
    return xw;
};

/**
 * Computes the height of the quest UI element.
 *
 * @param ctx The canvas context to use for measuring strings.
 *
 * @return The UI element height.
 */
NumericQuest.prototype.height = function (ctx) {
    let th = Quest.prototype.height.call(this, ctx);
    if (this.expanded) {
        th += draw.FONT_SIZE * ctx.viewport_scale + PADDING;
    }
    return th;
};

/**
 * Draws the numeric quest UI element.
 *
 * @param ctx The canvas context to use for measuring strings.
 * @param width The required width (should be >= the natural width).
 */
NumericQuest.prototype.draw = function (ctx, width) {
    Quest.prototype.draw.call(this, ctx, width);
    let bh = Quest.prototype.height.call(this, ctx);
    if (this.expanded) {
        // A line after the summary
        ctx.beginPath();
        ctx.strokeStyle = colors.scheme_color("menu", "text");
        ctx.moveTo(SPACE, bh);
        ctx.lineTo(width - SPACE, bh);
        ctx.stroke();
        // Line height
        let lh = draw.FONT_SIZE * ctx.viewport_scale + PADDING;

        let bar_height = lh - PADDING;
        let tp = this.threshold_positions();

        // Full bar:
        ctx.strokeStyle = colors.scheme_color("menu", "text");
        ctx.fillStyle = colors.scheme_color("menu", "background");
        ctx.rect(PADDING + SPACE, bh + PADDING, SPACE, bar_height);
        ctx.fill();
        ctx.stroke();

        // Filled region:
        ctx.strokeStyle = colors.scheme_color("menu", "text");
        ctx.fillStyle = colors.scheme_color("menu", "button_text");
        ctx.rect(
            PADDING + SPACE,
            bh + PADDING + bar_height * (1 - tp[0]),
            SPACE,
            bar_height * tp[0]
        );
        ctx.fill();
        ctx.stroke();

        // target level line (pokes out sideways a bit)
        ctx.strokeStyle = colors.scheme_color("menu", "text");
        ctx.beginPath();
        let target_y = bh + PADDING + bar_height * (1 - tp[1]);
        ctx.moveTo(SPACE, target_y);
        ctx.lineTo(2*PADDING + 2*SPACE, target_y);
        ctx.stroke();

        // Draw full string:
        let txt = this.full_string();
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(txt, 2*SPACE + 2*PADDING, bh + 0.5*lh);
    }
};

/**
 * A Hunt quest asks the user to search for words that match a specific
 * set of hints.
 *
 * @param targets An array of hint strings (see matches).
 * @param bonuses An array of hint strings required to earn the bonus.
 * @param params An object with the following optional keys:
 *     'retroactive' If true, previously-discovered words are used to
 *     initialize quest progress, otherwise the hints have to be
 *     matched after the quest starts.
 * @param reward The quest reward (TODO).
 * @param found (optional) A list of found words, to be used to
 *     initialize progress when 'retroactive' is specified.
 */
export function HuntQuest(targets, bonuses, params, reward, found) {
    Quest.call(this, "hunt", reward);
    this.icon = icons.hunt;
    this.targets = targets;
    this.bonuses = bonuses;
    this.found = found || {};
    this.params = params || {};
}

HuntQuest.prototype = Object.create(Quest.prototype);
HuntQuest.prototype.constructor = HuntQuest;

/**
 * Binds the hunt quest to a specific dimension.
 *
 * @param dimension The dimension object to associate with this quest.
 * @param words_found A list of strings representing words already found.
 *     Used to fill in progress when retroactive mode is enabled.
 */
HuntQuest.prototype.initialize = function(dimension, words_found) {
    Quest.prototype.initialize.call(this, dimension, words_found);
    // Sets already-found words as discovered for the quest if the
    // "retroactive" parameter is set.
    // TODO: Is this too slow?
    if (this.params.retroactive) {
        for (var w of Object.keys(words_found)) {
            for (var pos of words_found[w]) {
                // TODO: Glyphs instead of words here?
                let dim = pos[0];
                if (dimensions.same(this.dimension, dim)) {
                    this.find_word(
                        dim,
                        [undefined, undefined, undefined, w, undefined]
                    );
                    break;
                }
            }
        }
    }
};

/**
 * Updates the quest to include a match in the given dimension. Any given
 * word can simultaneously match multiple hints, and all matching hints
 * from the targets and bonus arrays will be checked off.
 *
 * @param dimension the dimension object in which the match occurred.
 * @param match The match array (TODO: What's that?)
 */
HuntQuest.prototype.find_word = function(dimension, match) {
    if (!dimensions.same(this.dimension, dimension)) { return; }
    let word = match[3];
    for (var t of this.targets) {
        if (matches(t, word)) {
            this.found[t] = true;
        }
    }
    for (var b of this.bonuses) {
        if (matches(b, word)) {
            this.found[b] = true;
        }
    }
};

/**
 * @return True if the quest is complete.
 */
HuntQuest.prototype.is_complete = function() {
    let complete = true;
    for (var t of this.targets) {
        if (!this.found[t]) {
            complete = false;
        }
    }
    return complete;
};

/**
 * @return True if the bonus is complete.
 */
HuntQuest.prototype.got_bonus = function() {
    let bonus = true;
    for (var b of this.bonuses) {
        if (!this.found[b]) {
            bonus = false;
        }
    }
    return bonus;
};

/**
 * @return A summary string indicating quest progress.
 */
HuntQuest.prototype.summary_string = function() {
    let ft = 0;
    let fb = 0;
    for (let t of this.targets) {
        if (this.found[t]) {
            ft += 1;
        }
    }
    for (let b of this.bonuses) {
        if (this.found[b]) {
            fb += 1;
        }
    }
    if (fb > 0) {
        return ft + "+" + fb + "/" + this.targets.length;
    } else {
        return ft + "/" + this.targets.length;
    }
};

/**
 * @return A string to represent a target or bonus hint.
 *
 * @param target The hint string to be represented.
 */
HuntQuest.prototype.ex_string = function (target) {
    // TODO: Incorporate actual word found?
    return target;
};

/**
 * Returns the natural width of the quest UI element.
 *
 * @param ctx The canvas context to use for measuring strings.
 *
 * @return A width value in canvas units.
 */
HuntQuest.prototype.width = function (ctx) {
    let xw = Quest.prototype.width.call(this, ctx);
    if (this.expanded) {
        for (let t of this.targets) {
            let es = this.ex_string(t);
            let m = draw.measure_text(ctx, es);
            let w = m.width + 2*PADDING + SPACE + icons.WIDTH;
            if (w > xw) {
                xw = w;
            }
        }
        for (let b of this.bonuses) {
            let es = this.ex_string(b);
            let m = draw.measure_text(ctx, es);
            let w = m.width + 2*PADDING + SPACE + icons.WIDTH;
            if (w > xw) {
                xw = w;
            }
        }
    } // else nothing; xw from the base call stands.
    return xw;
};

/**
 * Returns the height of the quest UI element.
 *
 * @param ctx The canvas context to use for measuring strings.
 *
 * @return A height value in canvas units.
 */
HuntQuest.prototype.height = function (ctx) {
    let bh = Quest.prototype.height.call(this, ctx);
    let lh = draw.FONT_SIZE * ctx.viewport_scale + PADDING;
    if (this.expanded) {
        return (
            bh
            + (this.targets.length + this.bonuses.length) * lh
            + 2*PADDING
        );
    } else {
        return bh;
    }
};

/**
 * Draws the quest UI element.
 *
 * @param ctx The canvas context to use for drawing.
 * @param width The required width (should be >= the natural width).
 */
HuntQuest.prototype.draw = function (ctx, width) {
    Quest.prototype.draw.call(this, ctx, width);
    let bh = Quest.prototype.height.call(this, ctx);
    if (this.expanded) {
        // A line after the summary
        ctx.beginPath();
        ctx.strokeStyle = colors.scheme_color("menu", "text");
        ctx.moveTo(SPACE, bh);
        ctx.lineTo(width - SPACE, bh);
        ctx.stroke();
        // Line height
        let lh = draw.FONT_SIZE * ctx.viewport_scale + PADDING;
        let line = 0;
        let c = [];
        let h;
        for (let t of this.targets) {
            h = bh + (line + 0.5) * lh;
            if (this.found[t]) {
                ctx.fillStyle = colors.scheme_color("menu", "text");
                ctx.strokeStyle = colors.scheme_color("menu", "text");
                icons.item_complete(
                    ctx,
                    [SPACE + icons.WIDTH/2, h]
                );
            } else {
                ctx.fillStyle = colors.scheme_color("menu", "button_text");
                ctx.strokeStyle = colors.scheme_color("menu", "button_text");
            }
            let es = this.ex_string(t);
            ctx.textBaseline = "middle";
            ctx.textAlign = "left";
            ctx.fillText(es, SPACE + icons.WIDTH + PADDING, h);
            line += 1;
        }
        h = bh + PADDING + line*lh;
        // Draw a separator line before bonus entries
        // TODO: Make this clearer
        ctx.beginPath();
        ctx.strokeStyle = colors.scheme_color("menu", "text");
        ctx.moveTo(SPACE, h);
        ctx.lineTo(width - SPACE, h);
        ctx.stroke();
        for (let b of this.bonuses) {
            h = bh + PADDING + (line + 0.5) * lh;
            if (this.found[b]) {
                ctx.fillStyle = colors.scheme_color("menu", "text");
                ctx.strokeStyle = colors.scheme_color("menu", "text");
                icons.item_complete(
                    ctx,
                    [SPACE + icons.WIDTH/2, h]
                );
            } else {
                ctx.fillStyle = colors.scheme_color("menu", "button_text");
                ctx.strokeStyle = colors.scheme_color("menu", "button_text");
                icons.item_bonus(
                    ctx,
                    [SPACE + icons.WIDTH/2, h]
                );
            }
            let es = this.ex_string(b);
            ctx.textBaseline = "middle";
            ctx.textAlign = "left";
            ctx.fillText(es, SPACE + icons.WIDTH + PADDING, h);
            line += 1;
        }
    }
};


/**
 * An Encircle quest requires matching words that encircle a certain
 * amount of area. Simply matching that many total tiles works too.
 *
 * @param target An integer area that must be encircled to complete the
 *     quest.
 * @param bonus Another area target (an integer) to complete the quest
 *     bonus.
 * @param reward The quest reward.
 */
export function EncircleQuest(target, bonus, reward) {
    NumericQuest.call(this, "encircle", target, bonus, reward);
    this.icon = icons.encircle;
}

EncircleQuest.prototype = Object.create(NumericQuest.prototype);
EncircleQuest.prototype.constructor = EncircleQuest;

/**
 * Sets up the quest for a particular dimension.
 *
 * @param dimension The dimension to set the quest in.
 * @param words_found The current words found list.
 */
EncircleQuest.prototype.initialize = function(dimension, words_found) {
    Quest.prototype.initialize.call(this, dimension, words_found);
    this.value = unlocked_encircled(this.dimension);
};

/**
 * Update our measure of encircled area.
 *
 * @param dimension The dimension in which to measure area.
 */
EncircleQuest.prototype.find_word = function(dimension) {
    if (!dimensions.same(this.dimension, dimension)) { return; }
    this.value = unlocked_encircled(this.dimension);
};


/**
 * A Stretch quest involves unlocking cells that are as far apart as
 * possible.
 *
 * @param target The target distance between the two most-distant
 *     unlocked cells.
 * @param bonus The bonus distance threshold.
 * @param reward The quest reward.
 */
export function StretchQuest(target, bonus, reward) {
    NumericQuest.call(this, "stretch", target, bonus, reward);
    this.icon = icons.stretch;
}

StretchQuest.prototype = Object.create(NumericQuest.prototype);
StretchQuest.prototype.constructor = StretchQuest;

/**
 * Binds this quest to a particular dimension and updates progress based
 * on the unlocked cells in that dimension.
 *
 * @param dimension The dimension to bind to.
 * @param words_found The current words-found list.
 */
StretchQuest.prototype.initialize = function(dimension, words_found) {
    NumericQuest.prototype.initialize.call(this, dimension, words_found);
    this.value = unlocked_span(this.dimension);
};

/**
 * Update our span measure.
 *
 * @param dimension The dimension in which a word was found.
 */
StretchQuest.prototype.find_word = function(dimension) {
    if (!dimensions.same(this.dimension, dimension)) { return; }
    this.value = unlocked_span(this.dimension);
};


/**
 * A Branch quest involves creating a certain number of Y-shaped
 * branches.
 *
 * @param target The number of distinct branches that must be created to
 *     complete the quest.
 * @param bonus The number of branches required for the quest bonus.
 * @param reward The quest reward.
 */
export function BranchQuest(target, bonus, reward) {
    NumericQuest.call(this, "branch", target, bonus, reward);
    this.icon = icons.branch;
}

BranchQuest.prototype = Object.create(NumericQuest.prototype);
BranchQuest.prototype.constructor = BranchQuest;

/**
 * Binds this quest to a particular dimension and updates progress based
 * on the unlocked cells in that dimension.
 *
 * @param dimension The dimension to bind to.
 * @param words_found The current words-found list.
 */
BranchQuest.prototype.initialize = function(dimension, words_found) {
    NumericQuest.prototype.initialize.call(this, dimension, words_found);
    this.value = unlocked_branches(this.dimension);
};

/**
 * Update our branches measure.
 *
 * @param dimension The dimension in which a word was found.
 */
BranchQuest.prototype.find_word = function(dimension) {
    if (!dimensions.same(this.dimension, dimension)) { return; }
    this.value = unlocked_branches(this.dimension);
};


/**
 * A BigQuest involves finding a certain number of words each above a
 * certain minimum length.
 *
 * @param target A 2-element array containing a length and a number. That
 *     many words of that length or longer must be found to complete the
 *     quest.
 * @param bonus The bonus requirement, with the same format as the
 *     target.
 * @param reward The quest reward.
 */
export function BigQuest(target, bonus, reward) {
    Quest.call(this, reward);
    this.icon = icons.big;
    this.target = target;
    this.bonus = bonus;
    this.sizes = [];
}

BigQuest.prototype = Object.create(Quest.prototype);
BigQuest.prototype.constructor = BigQuest;

/**
 * Binds this quest to a particular dimension and updates progress based
 * on the unlocked cells in that dimension.
 *
 * @param dimension The dimension to bind to.
 * @param words_found The current words-found list.
 */
BigQuest.prototype.initialize = function(dimension, words_found) {
    Quest.prototype.initialize.call(this, dimension, words_found);
    this.sizes = unlocked_sizes(this.dimension);
};

/**
 * Updates the quest when a word is found.
 *
 * @param dimension The dimension in which the word was found.
 * @param match The match object for the word that was found.
 * @param path The path of cells along which the word was found.
 */
BigQuest.prototype.find_word = function(dimension, match, path) {
    // Update our sizes array.
    if (!dimensions.same(this.dimension, dimension)) { return; }
    let l = path.length;
    if (this.sizes[l] == undefined) {
        this.sizes[l] = 1;
    } else {
        this.sizes[l] += 1;
    }
};

/**
 * Computes the current number of words at or above the target threshold
 * length for this quest.
 *
 * @return The number of words at least as long as this quest's target's
 *     length requirement.
 */
BigQuest.prototype.target_count = function () {
    let count = 0;
    for (let i = this.target[0]; i < this.sizes.length; ++i) {
        count += this.sizes[i] || 0;
    }
    return count;
};


/**
 * As target_count, but for the quest's bonus threshold.
 *
 * @return The number of words at least as long as this quest's bonus's
 *     length requirement.
 */
BigQuest.prototype.bonus_count = function () {
    let count = 0;
    for (let i = this.bonus[0]; i < this.sizes.length; ++i) {
        count += this.sizes[i] || 0;
    }
    return count;
};

/**
 * Determines if the quest is complete.
 *
 * @return True if the quest's target has been met.
 */
BigQuest.prototype.is_complete = function () {
    return this.target_count() >= this.target[1];
};


/**
 * Determines if the quest's bonus is complete.
 *
 * @return True if the quest's bonus criterion has been met.
 */
BigQuest.prototype.got_bonus = function () {
    return this.bonus_count() >= this.bonus[1];
};

/**
 * @return A short summary string of goal progress.
 */
BigQuest.prototype.summary_string = function () {
    return "" + this.target_count() + "/" + this.target[1];
    // TODO: Include bonus info somehow?
};

/**
 * @return A short string showing the target length as well as progress
 *     towards the required number of words of that length.
 */
BigQuest.prototype.target_string = function () {
    return (
        "" + this.target[0] + "+: "
        + this.target_count() + "/" + this.target[1]
    );
};

/**
 * @return A short string showing the bonus length as well as progress
 *     towards the required number of words of that length.
 */
BigQuest.prototype.bonus_string = function () {
    return (
        "" + this.bonus[0] + "+: "
        + this.bonus_count() + "/" + this.bonus[1]
    );
};

/**
 * Returns the natural width of the quest UI element.
 *
 * @param ctx The canvas context to use for measuring strings.
 *
 * @return A width value in canvas units.
 */
BigQuest.prototype.width = function(ctx) {
    let xw = Quest.prototype.width.call(this, ctx);
    if (this.expanded) {
        let tw = draw.measure_text(this.target_string()).width;
        tw += SPACE + icons.WIDTH + 2*PADDING;
        let bw = draw.measure_text(this.bonus_string()).width;
        bw += SPACE + icons.WIDTH + 2*PADDING;
        xw = Math.max(xw, tw, bw);
    }
    return xw;
};

/**
 * Returns the height of the quest UI element.
 *
 * @param ctx The canvas context to use for measuring strings.
 *
 * @return A height value in canvas units.
 */
BigQuest.prototype.height = function(ctx) {
    let bh = Quest.prototype.height.call(this, ctx);
    let lh = draw.FONT_SIZE * ctx.viewport_scale + PADDING;
    let result = bh + lh + PADDING;
    if (this.bonus[0] != this.target[0] || this.bonus[1] != this.target[1]) {
        result += lh;
    }
    return result;
};

/**
 * Draws the quest UI element.
 *
 * @param ctx The canvas context to use for drawing.
 * @param width The required width (should be >= the natural width).
 */
BigQuest.prototype.draw = function (ctx, width) {
    Quest.prototype.draw.call(this, ctx, width);
    let bh = Quest.prototype.height.call(this, ctx);
    if (this.expanded) {
        // A line after the summary
        ctx.beginPath();
        ctx.strokeStyle = colors.scheme_color("menu", "text");
        ctx.moveTo(SPACE, bh);
        ctx.lineTo(width - SPACE, bh);
        ctx.stroke();
        // Line height
        let lh = draw.FONT_SIZE * ctx.viewport_scale + PADDING;
        if (this.is_complete()) {
            // Draw check mark
            ctx.fillStyle = colors.scheme_color("menu", "text");
            ctx.strokeStyle = colors.scheme_color("menu", "text");
            icons.item_complete(
                ctx,
                [SPACE + icons.WIDTH/2, bh + 0.5*lh]
            );
        } else {
            ctx.fillStyle = colors.scheme_color("menu", "button_text");
            ctx.strokeStyle = colors.scheme_color("menu", "button_text");
        }
        // Draw target text:
        let ts = this.target_string();
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(ts, PADDING + SPACE + icons.WIDTH, bh + 0.5*lh);

        if (
            this.bonus[0] != this.target[0]
         || this.bonus[1] != this.target[1]
        ) {
            // draw bonus info too
            if (this.got_bonus()) {
                // Draw check mark
                ctx.fillStyle = colors.scheme_color("menu", "text");
                ctx.strokeStyle = colors.scheme_color("menu", "text");
                icons.item_complete(
                    ctx,
                    [SPACE + icons.WIDTH/2, bh + 1.5*lh]
                );
            } else {
                ctx.fillStyle = colors.scheme_color("menu", "button_text");
                ctx.strokeStyle = colors.scheme_color("menu", "button_text");
            }
            // Draw bonus text:
            let bs = this.bonus_string();
            ctx.textBaseline = "middle";
            ctx.textAlign = "left";
            ctx.fillText(bs, PADDING + SPACE + icons.WIDTH, bh + 0.5*lh);
        }
    }
};


/**
 * A Glyph quest requires the player to unlock certain numbers of each of
 * certain types of glyphs.
 *
 * @param targets An object whose keys are glyphs (one-character strings)
 *     and whose values are integers (how many of that glyph must be
 *     unlocked).
 * @param bonuses The same format as targets.
 * @param reward The quest reward.
 * @param found (optional) An object containing glyphs as keys and
 *     integer amounts as values, which will be used to initialize quest
 *     progress if present.
 */
export function GlyphQuest(targets, bonuses, reward, found) {
    Quest.call(this, "glyph", reward);
    this.icon = icons.glyphs;
    this.targets = targets;
    this.bonuses = bonuses;
    this.found = found || {};
}

GlyphQuest.prototype = Object.create(Quest.prototype);
GlyphQuest.prototype.constructor = GlyphQuest;

/**
 * Binds this quest to a particular dimension and updates progress based
 * on the unlocked cells in that dimension.
 *
 * @param dimension The dimension to bind to.
 * @param words_found The current words-found list.
 */
GlyphQuest.prototype.initialize = function(dimension, words_found) {
    Quest.prototype.initialize.call(this, dimension, words_found);
    // Already-discovered glyphs are *not* counted, because unlocked areas
    // might possibly be unloaded.
};

/**
 * Updates the quest's state when a word is found. Updates found counts
 * for each glyph in that word.
 *
 * TODO: Should multiple word matches which re-use the same hex cell
 * count towards glyph totals? Probably not? (but they do currently)
 *
 * @param dimension The dimension in which the glyph was found.
 * @param match The match array for the found word.
 */
GlyphQuest.prototype.find_word = function(dimension, match) {
    // Look for target glyph(s)
    if (!dimensions.same(this.dimension, dimension)) { return; }
    let glyphs = match[2];
    for (var g of glyphs) {
        if (this.targets[g] || this.bonuses[g]) {
            if (this.found.hasOwnProperty(g)) {
                this.found[g] += 1;
            } else {
                this.found[g] = 1;
            }
        }
    }
};

/**
 * @return True if the quest is complete (if for each required target
 *     glyph, the corresponding number of copies have been unlocked.)
 */
GlyphQuest.prototype.is_complete = function () {
    let missing = false;
    for (let g of Object.keys(this.targets)) {
        if (!this.found[g] || this.found[g] < this.targets[g]) {
            missing = true;
        }
    }
    return !missing;
};

/**
 * @return As is_complete, true when the quest's bonus criterion has been
 *     met.
 */
GlyphQuest.prototype.got_bonus = function () {
    for (let g of Object.keys(this.bonuses)) {
        if (!this.found[g] || this.found[g] < this.bonuses[g]) {
            return false;
        }
    }
    return true;
};

/**
 * @return A short string summarizing quest progress.
 */
GlyphQuest.prototype.summary_string = function() {
    let ft = 0;
    let fb = 0;
    for (let t of Object.keys(this.targets)) {
        if (this.found[t] != undefined && this.found[t] >= this.targets[t]) {
            ft += 1;
        }
    }
    for (let b of Object.keys(this.bonuses)) {
        if (this.found[b] != undefined && this.found[b] >= this.bonuses[b]) {
            fb += 1;
        }
    }
    if (fb > 0) {
        return ft + "+" + fb + "/" + this.targets.length;
    } else {
        return ft + "/" + this.targets.length;
    }
};

/**
 * Summarizes progress towards the required count for an individual
 * target glyph count goal.
 *
 * @param The glyph to display information about.
 * @return A string summarizing progress.
 */
GlyphQuest.prototype.ex_tstring = function (t) {
    return "" + t + ": " + (this.found[t] || 0) + "/" + this.targets[t];
};

/**
 * Summarizes progress towards the required count for an individual
 * bonus glyph count goal.
 *
 * @param The glyph to display information about.
 * @return A string summarizing progress.
 */
GlyphQuest.prototype.ex_bstring = function (b) {
    return "" + b + ": " + (this.found[b] || 0) + "/" + this.bonuses[b];
};

/**
 * Returns the natural width of the quest UI element.
 *
 * @param ctx The canvas context to use for measuring strings.
 *
 * @return A width value in canvas units.
 */
GlyphQuest.prototype.width = function (ctx) {
    let xw = Quest.prototype.width.call(this, ctx);
    if (this.expanded) {
        for (let t of Object.keys(this.targets)) {
            let es = this.ex_tstring(t);
            let m = draw.measure_text(ctx, es);
            let w = m.width + 2*PADDING + SPACE + icons.WIDTH;
            if (w > xw) {
                xw = w;
            }
        }
        for (let b of Object.keys(this.bonuses)) {
            let es = this.ex_bstring(b);
            let m = draw.measure_text(ctx, es);
            let w = m.width + 2*PADDING + SPACE + icons.WIDTH;
            if (w > xw) {
                xw = w;
            }
        }
    } // else nothing; xw from the base call stands.
    return xw;
};

/**
 * Returns the height of the quest UI element.
 * TODO: complete this?
 *
 * @param ctx The canvas context to use for measuring strings.
 *
 * @return A height value in canvas units.
 */
GlyphQuest.prototype.height = function (ctx) {
    let bh = Quest.prototype.height.call(this, ctx);
    let lh = draw.FONT_SIZE * ctx.viewport_scale + PADDING;
    if (this.expanded) {
        return (
            bh
            + (this.targets.length + this.bonuses.length) * lh
            + 2*PADDING
        );
    } else {
        return bh;
    }
};

/**
 * Draws the quest UI element.
 *
 * @param ctx The canvas context to use for drawing.
 * @param width The required width (should be >= the natural width).
 */
GlyphQuest.prototype.draw = function (ctx, width) {
    Quest.prototype.draw.call(this, ctx, width);
    let bh = Quest.prototype.height.call(this, ctx);
    if (this.expanded) {
        // A line after the summary
        ctx.beginPath();
        ctx.strokeStyle = colors.scheme_color("menu", "text");
        ctx.moveTo(SPACE, bh);
        ctx.lineTo(width - SPACE, bh);
        ctx.stroke();
        // Line height
        let lh = draw.FONT_SIZE * ctx.viewport_scale + PADDING;
        let line = 0;
        let c = [];
        let h;
        for (let t of Object.keys(this.targets)) {
            h = bh + (line + 0.5) * lh;
            if (this.found[t]) {
                ctx.fillStyle = colors.scheme_color("menu", "text");
                ctx.strokeStyle = colors.scheme_color("menu", "text");
                icons.item_complete(
                    ctx,
                    [SPACE + icons.WIDTH/2, h]
                );
            } else {
                ctx.fillStyle = colors.scheme_color("menu", "button_text");
                ctx.strokeStyle = colors.scheme_color("menu", "button_text");
            }
            let es = this.ex_tstring(t);
            ctx.textBaseline = "middle";
            ctx.textAlign = "left";
            ctx.fillText(es, SPACE + icons.WIDTH + PADDING, h);
            line += 1;
        }
        h = bh + PADDING + line*lh;
        // Draw a separator line before bonus entries
        // TODO: Make this clearer
        ctx.beginPath();
        ctx.strokeStyle = colors.scheme_color("menu", "text");
        ctx.moveTo(SPACE, h);
        ctx.lineTo(width - SPACE, h);
        ctx.stroke();
        for (let b of Object.keys(this.bonuses)) {
            h = bh + PADDING + (line + 0.5) * lh;
            if (this.found[b]) {
                ctx.fillStyle = colors.scheme_color("menu", "text");
                ctx.strokeStyle = colors.scheme_color("menu", "text");
                icons.item_complete(
                    ctx,
                    [SPACE + icons.WIDTH/2, h]
                );
            } else {
                ctx.fillStyle = colors.scheme_color("menu", "button_text");
                ctx.strokeStyle = colors.scheme_color("menu", "button_text");
                icons.item_bonus(
                    ctx,
                    [SPACE + icons.WIDTH/2, h]
                );
            }
            let es = this.ex_bstring(b);
            ctx.textBaseline = "middle";
            ctx.textAlign = "left";
            ctx.fillText(es, SPACE + icons.WIDTH + PADDING, h);
            line += 1;
        }
    }
};
