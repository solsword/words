// quests.js
// Quests functionality.
/* global console, document */

"use strict";

import * as grid from "./grid.js";
import * as draw from "./draw.js";
import * as content from "./content.js";
import * as dimensions from "./dimensions.js";
import * as icons from "./icons.js";
import * as colors from "./colors.js";

/**
 * All of the valid type values for quests. They behave roughly as
 * follows:
 *
 * encircle: Fulfilled by matching words such that the resulting unlocked
 *     tiles completely encircle a certain total area.
 * stretch: Fulfilled by matching words such that the maximum distance
 *     between two unlocked tiles is above a certain threshold.
 * branch: Fulfilled by matching words such that the pattern of unlocked
 *     tiles contains a certain number of Y-shaped branches.
 * hunt: Fulfilled by finding words which match each hint from a list of
 *     hints.
 * glyphs: Fulfilled by finding words that contain minimum numbers of
 *     each of a certain list of target glyphs.
 * big: Fulfilled by finding a certain number of words which are each at
 *     least a certain length.
 */
export var QUEST_TYPES = [
    "hunt",
    "big",
    "glyphs",
    "encircle",
    "stretch",
    "branch",
];

/**
 * HTML instructions for each quest type.
 *
 * TODO: gettext here!
 */
export var QUEST_INSTRUCTIONS = {
    "hunt": "TODO",
    "big": "TODO",
    "glyphs": "TODO",
    "encircle": "TODO",
    "stretch": "TODO",
    "branch": "TODO",
};

/**
 * All of the valid reward types for quests. Each reward type will be
 * paired with a certain kind of reward value, as follows:
 *
 * exp: A 2-element array containing an experience-point type and a
 *     number of experience points to award of that type.
 * quest: A quest object.
 * refresh: An integer specifying how many additional times this quest
 *     may be completed.
 * portal: A 2-element array containing a dimension key (a string) and a
 *     position (a 2-element x/y tile coordinate array). The player will
 *     be transported to that position in that dimension when claiming
 *     the quest reward.
 * return: No associated value. In quiz mode, indicates the completion of
 *     a quiz. When a quest is associated with a pocket dimension,
 *     indicates that the player should be transported back to their
 *     previous location outside of that dimension. In other cases,
 *     transports the player to their most-recent history location if
 *     they have one. TODO: really that?!?
 */
export var REWARD_TYPES = [
    "exp",
    "quest",
    "refresh",
    "portal",
    "return",
];

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
export function matches_hint(hint, word) {
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
 * @param dimkey The string key of the dimension to measure in.
 *
 * @return The total number of unlocked hexes in the given dimension,
 *     plus the total number of locked hexes which are completely
 *     encircled by unlocked hexes.
 */
export function unlocked_encircled(dimkey) {
    // Create map for checking whether tiles are in the unlocked region:
    let unlk = content.unlocked_set(dimkey);
    if (Object.keys(unlk).length == 0) {
        return 0;
    }

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
 * @param dimkey The string key of the dimension to measure in.
 *
 * @return The maximum x-, y-, or z-axis difference between two unlocked
 *     tiles in the given dimension. Because of hex movement
 *     possibilities, this is also the maximum number of steps required
 *     to move between any pair of unlocked tiles.
 */
export function unlocked_span(dimkey) {
    // Create map for checking whether tiles are in the unlocked region:
    let xbounds = [undefined, undefined];
    let ybounds = [undefined, undefined];
    let zbounds = [undefined, undefined];
    let unlk = content.unlocked_set(dimkey);
    if (Object.keys(unlk).length == 0) {
        return 0;
    }
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
 * @param dimkey The string key of the dimension to measure in.
 * 
 * @return The number of unlocked tiles in the given dimension which have
 *     unlocked neighbors in one of the two possible y-shaped neighbor
 *     configurations.
 */
export function unlocked_branches(dimkey) {
    let unlk = content.unlocked_set(dimkey);
    if (Object.keys(unlk).length == 0) {
        return 0;
    }

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
 * @param dimkey The string key of the dimension to measure in.
 *
 * @return An array with one entry at each index for which there is at
 *     least one unlocked word. There may be in-between entries that are
 *     undefined for which there is no unlocked word of that length. For
 *     each entry that does exist, the value will be the number of
 *     unlocked words of that length.
 */
export function unlocked_sizes(dimkey) {
    let unlk = content.unlocked_entries(dimkey);
    let result = [];

    // Record length of each unlocked path:
    for (let entry of unlk) {
        let l = entry.path.length;
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
 * Creates a new quest object with the given type, target, bonus, and
 * reward.
 *
 * @param type The quest type (a string, one of the QUEST_TYPES).
 * @param target The quest target for most types of quest, this is just
 *     an integer, but here are exceptions:
 *
 *     For a "hunt" quest, it's an array of glyph-sequence hint strings.
 *     For a "big" quest, it's a 2-element array of the minimum size and
 *     the number of words of at least that size required.
 *     For a "glyphs" quest, its a mapping from 1-character glyph strings
 *     to the number of copies of that glyph required for the quest.
 *
 * @param bonus The bonus requirement, in the same format as the target.
 *     TODO: Bonus rewards!
 *
 * @param rewards An array of 2-element reward arrays which each contain
 *     a type and a value. Their types must be one of the REWARD_TYPES,
 *     and their values depend on their types (see REWARD_TYPES).
 *
 * @return A new quest object, which stores each parameter value under a
 *     key of the same name. In addition to those slots, it has the
 *     following keys:
 *
 *     dimension Initially undefined; used to store the dimension a quest
 *         is bound to (as a dimension key string). If you want a quest
 *         to be dimension-specific, use the bind_dimension function.
 *
 *     player The player ID of the player who is completing this quest.
 *
 *     element The DOM element that represents this quest.
 *
 *     progress A number indicating progress towards quest completion, or
 *         a more complicated data structure for some quest types:
 *
 *         For hunt quests, a mapping from hint strings to true for
 *             fulfilled hints.
 *         For big quests, an array with partial indices where the
 *             element at that index indicates that that many words of
 *             length equal to that index have been matched.
 *         For glyphs quests, an object that maps glyphs to the number of
 *             copies found.
 *
 *     completed Whether or not the quest has been completed before (a
 *         boolean). May be true even for a currently-incomplete quest if
 *         quest progress has lapsed since completion, or if a quest has
 *         been refreshed.
 */
export function new_quest(type, target, bonus, rewards) {
    if (QUEST_TYPES.indexOf(type) < 0) {
        throw ("Invalid quest type '" + type + "'.");
    }
    for (let reward of rewards) {
        if (REWARD_TYPES.indexOf(reward[0]) < 0) {
            throw ("Invalid reward type '" + reward[0] + "'.");
        }
    }
    return {
        "type": type,
        "target": target,
        "bonus": bonus,
        "rewards": rewards,
        "dimension": undefined,
        "player": undefined,
        "element": undefined,
        "progress": undefined,
        "completed": false,
    };
}


/**
 * Binds the given quest to a specific dimension. Once bound, the quest
 * will ignore updates which don't happen within that dimension, and the
 * various numeric quests will use that dimension (instead of their
 * player's current dimension) as the basis for their progress.
 *
 * @param quest The quest to bind.
 * @param dimkey The string key of the dimension to bind the quest to.
 */
export function bind_dimension(quest, dimkey) {
    quest.dimension = dimkey;
}

/**
 * Binds the quest to a specific player, and initializes (or resets) all
 * quest progress. This should be called before taking any other actions
 * with the quest.
 *
 * @param quest The quest to initialize.
 * @param agent The player object that the quest will be associated with.
 * @param claim_function The function to run to claim the quest reward
 *     when the quest is complete. It will be given the quest as an
 *     argument when run, and it will be attached to the quest's UI
 *     element as a callback (but only enabled when the quest is
 *     complete).
 * @param retroactive (optional) If true, the quest will be initialized
 *     with progress based on the player's current words found. Only
 *     applies to hunt and big quests. TODO: Use this ever?
 */
export function initialize_quest(quest, agent, claim_function, retroactive) {
    quest.agent = agent.id;
    let quest_dimension = quest.dimension || agent.position.dimension;

    if (quest.type == "hunt") {
        if (retroactive) {
            // TODO
        } else {
            quest.progress = {};
        }
    } else if (quest.type == "big") {
        if (retroactive) {
            quest.progress = unlocked_sizes(quest_dimension);
        } else {
            quest.progress = [];
        }
    } else if (quest.type == "glyphs") {
        quest.progress = {};
    } else if (quest.type == "encircle") {
        quest.progress = unlocked_encircled(quest_dimension);
    } else if (quest.type == "stretch") {
        quest.progress = unlocked_span(quest_dimension);
    } else if (quest.type == "branch") {
        quest.progress = unlocked_branches(quest_dimension);
    } else {
        throw ("Unknown quest type '" + quest.type + "'.");
    }

    // TODO: enable retroactive hunt quests?
    /* Based on this code?
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
    */

    // Construct the quest element
    construct_quest_element(quest, claim_function);
}

/**
 * Called whenever a match is made by the associated player; updates the
 * quest state taking that new match into account. This function calls
 * display_status at the end to make sure that any state changes are
 * reflected in the quest UI elements.
 *
 * @param quest The quest to update.
 * @param glyphs A string containing the glyphs that were matched.
 * @param path The path along which the match was found, as an array of
 *     2-element x/y tile position arrays.
 * @param current_dimension The string key of the dimension that the
 *     update happens in.
 */
export function update_quest(
    quest,
    glyphs,
    path,
    current_dimension
) {
    if (quest.dimension && current_dimension != quest.dimension) {
        // no update for activity in another dimension if the quest is
        // bound to a particular dimension.
        return;
    }

    let quest_dimension = quest.dimension || current_dimension;
    if (quest_dimension == undefined) {
        throw "No current dimension for quest update.";
    }

    if (quest.type == "hunt") {
        for (var t of quest.targets) {
            if (matches_hint(t, glyphs)) {
                quest.progress[t] = true;
            }
        }
        for (var b of quest.bonuses) {
            if (matches_hint(b, glyphs)) {
                quest.progress[b] = true;
            }
        }
    } else if (quest.type == "big") {
        if (quest.progress[path.length] == undefined) {
            quest.progress[path.length] = 1;
        } else {
            quest.progress[path.length] += 1;
        }
    } else if (quest.type == "glyphs") {
        for (let g of glyphs) {
            if (quest.progress[g] == undefined) {
                quest.progress[g] = 1;
            } else {
                quest.progress[g] += 1;
            }
        }
    } else if (quest.type == "encircle") {
        quest.progress = unlocked_encircled(quest_dimension);
    } else if (quest.type == "stretch") {
        quest.progress = unlocked_span(quest_dimension);
    } else if (quest.type == "branch") {
        quest.progress = unlocked_branches(quest_dimension);
    } else {
        throw ("Unknown quest type '" + quest.type + "'.");
    }

    // Make sure changes are visible to the player:
    display_status(quest);
}

/**
 * Tests whether a quest is complete.
 *
 * @param quest The quest object to test.
 * @return True if that quest is completed; false otherwise.
 */
export function is_complete(quest) {
    if (quest.type == "hunt") {
        for (let hint of quest.target) {
            if (!quest.progress[hint]) {
                return false;
            }
        }
        return true;
    } else if (quest.type == "big") {
        let [size_req, n_req] = quest.target;
        let found = 0;
        for (let idx in quest.progress) { // skips empty slots
            if (idx >= size_req) {
                found += 1;
                if (found >= n_req) {
                    return true;
                }
            }
        }
        return false;
    } else if (quest.type == "glyphs") {
        for (let g of Object.keys(quest.target)) {
            if (!quest.progress[g] || quest.progress[g] < quest.target[g]) {
                return false;
            }
        }
        return true;
    } else if (quest.type == "encircle") {
        return quest.progress >= quest.target;
    } else if (quest.type == "stretch") {
        return quest.progress >= quest.target;
    } else if (quest.type == "branch") {
        return quest.progress >= quest.target;
    } else {
        throw ("Unknown quest type '" + quest.type + "'.");
    }
}

/**
 * Tests whether a quest's bonus condition has been met. This will always
 * return false if the quest's completion condition has not been met,
 * even if the bonus condition has technically been satisfied.
 *
 * @param quest The quest to test.
 * @return True if the bonus condition has been met; false otherwise.
 */
export function completed_bonus(quest) {
    if (!is_complete(quest)) {
        return false;
    }

    if (quest.type == "hunt") {
        for (let hint of quest.bonus) {
            if (!quest.progress[hint]) {
                return false;
            }
        }
        return true;
    } else if (quest.type == "big") {
        let [size_req, n_req] = quest.bonus;
        let found = 0;
        for (let idx in quest.progress) { // skips empty slots
            if (idx >= size_req) {
                found += 1;
                if (found >= n_req) {
                    return true;
                }
            }
        }
        return false;
    } else if (quest.type == "glyphs") {
        for (let g of Object.keys(quest.bonus)) {
            if (!quest.progress[g] || quest.progress[g] < quest.target[g]) {
                return false;
            }
        }
        return true;
    } else if (quest.type == "encircle") {
        return quest.progress >= quest.bonus;
    } else if (quest.type == "stretch") {
        return quest.progress >= quest.bonus;
    } else if (quest.type == "branch") {
        return quest.progress >= quest.bonus;
    } else {
        throw ("Unknown quest type '" + quest.type + "'.");
    }
}

/**
 * Constructs a DOM element that can represent the quest in a quests
 * list. Builds a details element that summarizes the quest state, and
 * stores it as quest.element. Calls display_status to make sure the
 * element reflects the quest's current status.
 *
 * @param quest The quest object to construct an element for.
 * @param claim_function The function to run when the quest is complete
 *     and the player wants to claim the reward. Will be attached to the
 *     element's completion indicator and activated by display_status
 *     only when the quest is complete.
 */
export function construct_quest_element(quest, claim_function) {
    quest.element = document.createElement("details");
    quest.element.classList.add("quest");
    let summary = document.createElement("summary");
    let complete = document.createElement("a");
    complete.innerHTML = "?"; // TODO: empty check box instead?
    // simply attach for now without creating handler
    complete.claim_function = function () { claim_function(quest); };
    summary.appendChild(complete);
    // TODO: capitalize?
    summary.appendChild(document.createTextNode(" " + quest.type + " "));
    let progress = document.createElement("span");
    progress.innerHTML = "?/?";
    summary.appendChild(progress);
    quest.element.appendChild(summary);

    let instructions = document.createElement("div");
    instructions.innerHTML = QUEST_INSTRUCTIONS[quest.type];
    quest.element.appendChild(instructions);

    let details = document.createElement("div");
    details.classList.add("passive");
    quest.element.appendChild(details);

    details.innerHTML = QUEST_INSTRUCTIONS[quest.type];

    if (quest.type == "hunt") {
        let target_container = document.createElement("div");
        let bonus_container = document.createElement("div");
        details.appendChild(target_container);
        details.appendChild(bonus_container);

        for (let hint of quest.target) {
            let elem = document.createElement("div");
            let found_span = document.createElement("span");
            found_span.classList.add("icon");
            found_span.innerHTML = "&nbsp;";
            elem.appendChild(found_span);
            elem.appendChild(document.createTextNode(hint));
            target_container.appendChild(elem);
        }

        for (let hint of quest.bonus) {
            let elem = document.createElement("div");
            let found_span = document.createElement("span");
            found_span.classList.add("icon");
            found_span.innerHTML = "&nbsp;";
            elem.appendChild(found_span);
            elem.appendChild(document.createTextNode(hint));
            bonus_container.appendChild(elem);
        }
    } else if (quest.type == "big") {
        // Nothing special here
    } else if (quest.type == "glyphs") {
        let target_container = document.createElement("div");
        let bonus_container = document.createElement("div");
        details.appendChild(target_container);
        details.appendChild(bonus_container);

        for (let g of Object.keys(quest.target)) {
            let elem = document.createElement("div");
            let nspan = document.createElement("span");
            elem.innerHTML = g + ":";
            elem.appendChild(nspan);
            nspan.innerHTML = (quest.progress[g] || 0) + "/" + quest.target[g];
            target_container.appendChild(elem);
        }

        for (let g of Object.keys(quest.bonus)) {
            let elem = document.createElement("div");
            let nspan = document.createElement("span");
            elem.innerHTML = g + ":";
            elem.appendChild(nspan);
            nspan.innerHTML = (quest.progress[g] || 0) + "/" + quest.bonus[g];
            bonus_container.appendChild(elem);
        }
    } else if (quest.type == "encircle") {
        let details = quest.element.lastChild;
        details.innerHTML = (
            `Your matches currently encircle ${quest.progress}`
          + `/${quest.target} total tiles. Encircle ${quest.bonus} tiles`
          + ` for a bonus reward.`
        );
        // TODO: completion alt text
    } else if (quest.type == "stretch") {
        details.innerHTML = (
            `Your matches currently include two tiles that are`
          + ` ${quest.progress} tiles apart. Stretch across ${quest.target}`
          + ` tiles to complete the quest, or across ${quest.bonus} tiles`
          + ` for a bonus reward.`
        );
        // TODO: completion alt text
    } else if (quest.type == "branch") {
        details.innerHTML = (
            `Your matches currently form ${quest.progress} Y-shaped`
          + ` branches. Form ${quest.target} branches to complete`
          + ` the quest, or form ${quest.bonus} branches for a bonus`
          + ` reward.`
        );
        // TODO: completion alt text
    } else {
        throw ("Unknown quest type '" + quest.type + "'.");
    }

    display_status(quest);
}

/**
 * Updates the UI element for the given quest according to the quest's
 * current status. Updates progress information as well as the completion
 * indicator, and turns that into a link when the quest is completed.
 *
 * @param quest The quest to update status for.
 */
export function display_status(quest) {
    let completion = quest.element.firstChild.firstChild;
    let claim_function = completion.claim_function;

    if (is_complete(quest)) {
        quest.element.classList.add("complete");
        completion.addEventListener("click", claim_function);
        if (completed_bonus(quest)) {
            completion.innerHTML = "✓+";
        } else {
            completion.innerHTML = "✓";
        }
    } else {
        quest.element.classList.remove("complete");
        // It's fine if this misses
        completion.removeEventListener("click", claim_function);
        completion.innerHTML = "○";
    }

    let progress = quest.element.firstChild.lastChild;
    let summary;
    if (quest.type == "hunt") {
        let tfound = 0;
        let bfound = 0;

        let target_hint_elements = quest.element.lastChild.firstChild.children;
        for (let idx in quest.target) {
            let hint = quest.target[idx];
            if (quest.progress[hint]) {
                tfound += 1;
                target_hint_elements[idx].classList.add("complete");
                target_hint_elements[idx].firstChild.innerHTML = "✓";
            }
        }

        let bonus_hint_elements = quest.element.lastChild.lastChild.children;
        for (let idx in quest.bonus) {
            let hint = quest.bonus[idx];
            if (quest.progress[hint]) {
                bfound += 1;
                bonus_hint_elements[idx].classList.add("complete");
                bonus_hint_elements[idx].firstChild.innerHTML = "✓";
            }
        }

        if (bfound > 0) {
            summary = tfound + "+" + bfound + "/" + quest.target.length;
        } else {
            summary = tfound + "/" + quest.target.length;
        }
    } else if (quest.type == "big") {
        let [size_req, n_req] = quest.target;
        let [b_size_req, b_n_req] = quest.target;
        let found = 0;
        let b_found = 0;
        for (let idx in quest.progress) { // skips empty slots
            if (idx >= size_req) {
                found += 1;
            }
            if (idx >= b_size_req) {
                b_found += 1;
            }
        }

        let details = quest.element.lastChild;
        details.innerHTML = (
            `Found ${found} out of ${n_req} words at least`
          + ` ${size_req} glyphs long.`
        );
        if (b_n_req > 0) {
            details.innerHTML += (
                ` Found ${b_found} out of ${b_n_req} words at least`
              + ` ${b_size_req} glyphs long.`
            );
        }

        if (b_found > 0) {
            summary = found + "+" + b_found + "/" + n_req;
        } else {
            summary = found + "/" + n_req;
        }
    } else if (quest.type == "glyphs") {
        let target_elements = quest.element.lastChild.firstChild.children;
        let bonus_elements = quest.element.lastChild.lastChild.children;

        let total_progress = 0;
        let bonus_progress = 0;
        let total_goal = 0;

        let idx = 0;
        for (let g of Object.keys(quest.target)) {
            let elem = target_elements[idx];
            let nspan = elem.lastChild;
            nspan.innerHTML = (quest.progress[g] || 0) + "/" + quest.target[g];
            total_progress += quest.progress[g];
            total_goal += quest.target[g];
            idx += 1;
        }

        idx = 0;
        for (let g of Object.keys(quest.bonus)) {
            let elem = bonus_elements[idx];
            let nspan = elem.lastChild;
            nspan.innerHTML = (quest.progress[g] || 0) + "/" + quest.bonus[g];
            // TODO: simpler here?
            if (quest.bonus[g] > (quest.target[g] || 0)) {
                bonus_progress += Math.max(
                    0,
                    quest.progress[g] - (quest.target[g] || 0)
                );
            }
            idx += 1;
        }

        if (bonus_progress > 0) {
            summary = total_progress + "+" + bonus_progress + "/" + total_goal;
        } else {
            summary = total_progress + "/" + total_goal;
        }
    } else if (quest.type == "encircle") {
        summary = quest.progress + "/" + quest.target;
    } else if (quest.type == "stretch") {
        summary = quest.progress + "/" + quest.target;
    } else if (quest.type == "branch") {
        summary = quest.progress + "/" + quest.target;
    } else {
        throw ("Unknown quest type '" + quest.type + "'.");
    }

    progress.innerHTML = summary;
}
