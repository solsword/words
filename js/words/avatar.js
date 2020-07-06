// avatar.js
// System for dealing with avatar for HTML5 canvas

"use strict";

// Holds the img element for the avatar
export var AVATAR;

/**
 * Returns a new avatar object. 
 * 
 * @param base_image_name The string base name for an avatar's static image and
 *    animation files. For example, "my_avatar", where "my_avatar.svg" could
 *    be the static image and "my_avatar_jump.svg" could be an animation
 *    of the avatar.
 *
 * @param anim_names (optional) A list with the string names of animations that the 
 *    avatar can do (e.g. "jump" or "dance"). These names must correspond
 *    with how they are appended after the base_image_name as seen in the above
 *    example with "my_avatar_jump.svg".
 *
 * @return An avatar object with the following fields:
 *    
 *    static_img_src: The filename of the avatar's static image within the images
 *        folder in the format "../../images/<filename>.svg" where <filename>
 *        is the name of the file.    
 *
 *    animation_srcs: A list containing the filenames of the avatar's animations
 *        within the images folder in the format "../../images/<filename>.svg"
 *        where <filename> is the name of each file.
 */ 
export function new_avatar(base_image_name, anim_names) {
    // get the filename of the static image for this avatar
    let static_img_src = get_static_img_src(base_image_name);

    // get the filenames of the animations for this avatar and add them to list
    let animation_srcs = [];
    if(anim_names){
        for(anim of anim_names){
           let anim_src = get_anim_img_src(base_image_name, anim);
           animation_srcs.push(anim_src);
        }
    }

    // create the object that will include the avatar's image and animations
    let result = {
        "static_img_src": static_img_src,
        "animation_srcs": animation_srcs,
    }
    return result;
}

/**
 * Returns the string filename for the avatar's static image.
 *
 * @param base_image_name The string base name for an avatar's static image and
 *    animation files. For example, "my_avatar", where "my_avatar.svg" could
 *    be the static image and "my_avatar_jump.svg" could be an animation
 *    of the avatar.
 * 
 * @return The filename for the avatar's static image including the "/images/"
 *    at the beginning in string format.
 */
function get_static_img_src(base_image_name) {
    return "../../images/" + base_image_name + ".svg";
}

/**
 * Returns the string filename for one of the avatar's animations.
 *
 * @param base_image_name The string base name for an avatar's static image and
 *    animation files. For example, "my_avatar", where "my_avatar.svg" could
 *    be the static image and "my_avatar_jump.svg" could be an animation
 *    of the avatar.
 *
 * @param anim The string name of the avatar's animation. This must also be 
 *    part of the image's filename.
 * 
 * @return The string filename for the avatar's animation including the "/images/"
 *    at the beginning.
 */
function get_anim_img_src(base_image_name, anim) {
    return "../../images/" + base_image_name + "_" + anim + ".svg";
}

/**
 * Initializes the avatar and creates the base HTML for it to work
 */
export function init_avatar(current_player) {
    // create an img element in the index.html document to hold the avatar
    AVATAR = document.createElement("img");
    AVATAR.classList.add("avatar");
    AVATAR.src = current_player.avatar.static_img_src; 
    
    let avatar_div = document.getElementById("avatar_div");
    avatar_div.appendChild(AVATAR);
}

export function set_avatar_size(width, height) {
    AVATAR.style.width = width + "px";
    AVATAR.style.height = height + "px";
}

export function set_avatar_position(left, top) {
    left -= parseFloat(AVATAR.style.width)/2;
    top -= parseFloat(AVATAR.style.height);
    AVATAR.style.left = left + "px";
    AVATAR.style.top = top + "px";
}