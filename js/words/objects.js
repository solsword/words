// objects.js
// Code for keeping track of objects, their types, their effects, etc.

define(
["anarchy", "./colors"],
function(anarchy, colors) {

  var RESOURCE_TYPES = "🔑📄♻🖌🌱🌼💬🔍🔆🔧🔔🌈🌍🌎🌏";

  var BASIC_COLORS = "红黄蓝";

  var HYBRID_COLORS = "橙紫绿白";

  var COLOR_COMPOSITIONS = {
    "黑": "黑",
    "红": "红",
    "黄": "黄",
    "蓝": "蓝",
    "橙": "红黄",
    "紫": "红蓝",
    "绿": "黄蓝",
    "白": "红黄蓝",
  };

  var COLOR_ADD = {
    "红黄": "橙",
    "黄红": "橙",

    "红蓝": "紫",
    "蓝红": "紫",

    "黄蓝": "绿",
    "蓝黄": "绿",

    "红黄蓝": "白",
    "黄红蓝": "白",
    "红蓝黄": "白",
    "黄蓝红": "白",
    "蓝红黄": "白",
    "蓝黄红": "白",

    "红绿": "白",
    "绿红": "白",

    "黄紫": "白",
    "紫黄": "白",

    "蓝橙": "白",
    "橙蓝": "白",

    "黑红": "红",
    "黑黄": "黄",
    "黑蓝": "蓝",

    "黑绿": "绿",
    "黑紫": "紫",
    "黑橙": "橙",

    "黑白": "白",
  };

  var COLOR_SUBTRACT = {
    "白红": "绿",
    "白黄": "紫",
    "白蓝": "橙",

    "白绿": "红",
    "白紫": "黄",
    "白橙": "蓝",

    "紫红": "蓝",
    "紫蓝": "红",

    "橙黄": "红",
    "橙红": "黄",

    "绿蓝": "黄",
    "绿黄": "蓝",

    "白白": "黑",

    "红红": "黑",
    "黄黄": "黑",
    "蓝蓝": "黑",

    "绿绿": "黑",
    "紫紫": "黑",
    "橙橙": "黑",

    "黑黑": "黑",
  };

  function random_resource(seed) {
    // Takes just a seed value and returns a random resource character.
    seed = anarchy.lfsr(seed + 7492374);
    return RESOURCE_TYPES[seed % RESOURCE_TYPES.length];
  }

  function random_color(seed) {
    // Takes just a seed value and returns a random color character.
    // TODO: DEBUG relative frequencies!
    // return "橙";
    let r = anarchy.lfsr(seed + 5986912731);
    if (seed % 100 < 90) { // a basic color
      return BASIC_COLORS[r % BASIC_COLORS.length];
    } else {
      let c1 = BASIC_COLORS[r % BASIC_COLORS.length];
      r = anarchy.lfsr(r);
      let c2 = BASIC_COLORS[r % BASIC_COLORS.length]; 
      return COLOR_ADD[c1 + c2];
    }
  }

  function is_color(obj_glyph) {
    // Whether the given object is a color object or not.
    return (
      BASIC_COLORS.indexOf(obj_glyph) >= 0
   || HYBRID_COLORS.indexOf(obj_glyph) >= 0
    );
  }

  function combined_color(colors) {
    // Takes a list of color glyphs and returns a single color glyph describing
    // their combined color.
    let result = "黑";
    for (let color of colors) {
      let cmb = result + color;
      if (COLOR_ADD.hasOwnProperty(cmb)) {
        result = COLOR_ADD[cmb];
      }
    }
    return result;
  }

  function color_color(color_glyph, energized) {
    // Takes a color glyph and returns the corresponding actual color.
    if (energized) {
      fetch = colors.bright_color;
    } else {
      fetch = colors.dark_color;
    }
    if (color_glyph == "红") {
      return fetch("rd");
    } else if (color_glyph == "黄") {
      return fetch("yl");
    } else if (color_glyph == "蓝") {
      return fetch("bl");
    } else if (color_glyph == "橙") {
      return fetch("or");
    } else if (color_glyph == "绿") {
      return fetch("gn");
    } else if (color_glyph == "紫") {
      return fetch("pl");
    } else if (color_glyph == "白") {
      return fetch("wt");
    } else { // 黑 etc.
      return fetch("bk");
    }
  }

  function object_color(obj_glyph, energized) {
    // Returns the color for any kind of object, depending on whether it's
    // energized or not.
    if (is_color(obj_glyph)) {
      // TODO: Energy states for colors?
      return color_color(obj_glyph, true);
    } else if (energized) {
      return colors.tile_color("unlocked-glyph");
    } else {
      // TODO: is this too inconspicuous?
      return colors.tile_color("pad");
    }
  }

  return {
    "RESOURCE_TYPES": RESOURCE_TYPES,
    "BASIC_COLORS": BASIC_COLORS,
    "COLOR_COMPOSITIONS": COLOR_COMPOSITIONS,
    "COLOR_ADD": COLOR_ADD,
    "COLOR_SUBTRACT": COLOR_SUBTRACT,
    "random_resource": random_resource,
    "random_color": random_color,
    "is_color": is_color,
    "combined_color": combined_color,
    "color_color": color_color,
    "object_color": object_color,
  };
});
