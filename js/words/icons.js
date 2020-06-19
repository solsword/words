// icons.js
// Custom icon drawing code.
/* jshint esversion: 6 */


/**
 * Constants that define the size of an icon in pixels.
 */
export const WIDTH = 30;
export const HEIGHT = 30;

/**
 * Draws an icon for unknown things. Uses the typical icon parameters:
 *
 * @param ctx The canvas context to draw on.
 * @param xy A 2-element x/y canvas coordinate position indicating the
 * center of the icon.
 */
export function unknown(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("?", ...xy); // TODO
}

/**
 * Draws an icon for hunt quests. Typical icon parameters.
 */
export function hunt(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("H", ...xy); // TODO
}

/**
 * Draws an icon for encircle quests. Typical icon parameters.
 */
export function encircle(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("O", ...xy); // TODO
}

/**
 * Draws an icon for stretch quests. Typical icon parameters.
 */
export function stretch(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("|", ...xy); // TODO
}

/**
 * Draws an icon for branch quests. Typical icon parameters.
 */
export function branch(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("Y", ...xy); // TODO
}

/**
 * Draws an icon for big quests. Typical icon parameters.
 */
export function big(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("B", ...xy); // TODO
}

/**
 * Draws an icon for glyphs quests. Typical icon parameters.
 */
export function glyphs(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("G", ...xy); // TODO
}

/**
 * Draws an icon indicating that a quest is in-progress. Typical icon
 * parameters.
 */
export function quest_in_progress(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("‥", ...xy); // TODO
}

/**
 * Draws an icon indicating that a quest is finished. Typical icon
 * parameters.
 */
export function quest_finished(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("!", ...xy); // TODO
}

/**
 * Draws an icon indicating that a quest is finished and the bonus
 * criterion has been achieved. Typical icon parameters.
 */
export function quest_perfect(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("%", ...xy); // TODO
}

/**
 * Draws an icon indicating that one item has been completed. Typical
 * icon parameters.
 */
export function item_complete(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("✓", ...xy); // TODO
}

/**
 * Draws an icon indicating that one bonus item has been completed.
 * Typical icon parameters.
 */
export function item_bonus(ctx, xy) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText("+", ...xy); // TODO
}
