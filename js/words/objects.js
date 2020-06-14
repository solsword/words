// objects.js
// Code for keeping track of objects, their types, their effects, etc.

define(
    ["anarchy", "./colors"],
    function(anarchy, colors) {

        var RESOURCE_TYPES = [
            "🔑",
            "📄",
            "♻",
            "🖌",
            "🌱",
            "🌼",
            "💬",
            "🔍",
            "🔆",
            "🔧",
            "🔔",
            "🌈",
            "🌍",
            "🌎",
            "🌏"
        ];

        var LINK_TYPES = ["🔗", "🌀", "🚪" ];

        var BASIC_COLORS = "红黄蓝";

        var HYBRID_COLORS = "橙紫绿白";

        // Which basic colors is each combined color made of?
        var COLOR_COMPOSITIONS = {
            "空": "",
            "红": "红",
            "黄": "黄",
            "蓝": "蓝",
            "橙": "红黄",
            "紫": "红蓝",
            "绿": "黄蓝",
            "白": "红黄蓝",
        };

        var COLOR_ADD = {
            // combinations -> 2x colors
            "红黄": "橙",
            "黄红": "橙",

            "红蓝": "紫",
            "蓝红": "紫",

            "黄蓝": "绿",
            "蓝黄": "绿",

            // redundant colors -> no effect
            "红橙": "橙",
            "橙红": "橙",
            "橙黄": "橙",
            "黄橙": "橙",

            "红紫": "紫",
            "紫红": "紫",
            "紫蓝": "紫",
            "蓝紫": "紫",

            "黄绿": "绿",
            "绿黄": "绿",
            "绿蓝": "绿",
            "蓝绿": "绿",

            // triples -> white
            "红黄蓝": "白",
            "黄红蓝": "白",
            "红蓝黄": "白",
            "黄蓝红": "白",
            "蓝红黄": "白",
            "蓝黄红": "白",

            // adding to white
            "红白": "白",
            "白红": "白",
            "白黄": "白",
            "黄白": "白",
            "蓝白": "白",
            "白蓝": "白",

            "白绿": "白",
            "绿白": "白",
            "白紫": "白",
            "紫白": "白",
            "白橙": "白",
            "橙白": "白",

            // completing 2x colors
            "红绿": "白",
            "绿红": "白",

            "黄紫": "白",
            "紫黄": "白",

            "蓝橙": "白",
            "橙蓝": "白",

            // adding empty
            "空红": "红",
            "红空": "红",
            "空黄": "黄",
            "黄空": "黄",
            "空蓝": "蓝",
            "蓝空": "蓝",

            "空绿": "绿",
            "绿空": "绿",
            "空紫": "紫",
            "紫空": "紫",
            "空橙": "橙",
            "橙空": "橙",

            "空白": "白",
            "白空": "白",
        };

        var COLOR_SUBTRACT = {
            // subtractions from white
            "白红": "绿",
            "白黄": "紫",
            "白蓝": "橙",

            "白绿": "红",
            "白紫": "黄",
            "白橙": "蓝",

            // subtractions from 2x colors
            "紫红": "蓝",
            "紫蓝": "红",

            "橙黄": "红",
            "橙红": "黄",

            "绿蓝": "黄",
            "绿黄": "蓝",

            // subtractions to empty
            "白白": "空",

            "红红": "空",
            "黄黄": "空",
            "蓝蓝": "空",

            "绿绿": "空",
            "紫紫": "空",
            "橙橙": "空",

            "空空": "空",
        };

        function random_resource(seed) {
            // Takes just a seed value and returns a random resource
            // character.
            seed = anarchy.lfsr(seed + 7492374);
            return RESOURCE_TYPES[anarchy.posmod(seed, RESOURCE_TYPES.length)];
        }

        function random_color(seed) {
            // Takes just a seed value and returns a random color character.
            let r = anarchy.lfsr(seed + 5986912731);
            if (anarchy.posmod(seed, 100) < 90) { // a basic color
                return BASIC_COLORS[anarchy.posmod(r, BASIC_COLORS.length)];
            } else {
                let c1i = anarchy.posmod(r, BASIC_COLORS.length);
                let c1 = BASIC_COLORS[c1i];
                r = anarchy.lfsr(r);
                let c2i = anarchy.posmod(
                    c1i + 1 + anarchy.posmod(r, BASIC_COLORS.length - 1),
                    BASIC_COLORS.length
                );
                let c2 = BASIC_COLORS[c2i]; 
                if (COLOR_ADD[c1 + c2] == undefined) {
                    console.warn(
                        "Undefined color addition: '" + (c1 + c2) + "'"
                    );
                }
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
            // Takes a list of color glyphs and returns a single color
            // glyph describing their combined color.
            let result = "空";
            for (let color of colors) {
                let cmb = result + color;
                if (COLOR_ADD.hasOwnProperty(cmb)) {
                    result = COLOR_ADD[cmb];
                }
            }
            return result;
        }

        function color_contains(combined_color, color_aspect) {
            // Returns True if the given combined color contains the
            // given color aspect. So for example. White contains all
            // aspects, including itself, whereas orange contains orange,
            // red, and yellow, but not blue, green, or purple.
            //
            // Empty (空) contains no aspects, except itself, and every
            // aspect contains empty.
            if (color_aspect == "空") {
                return true;
            }

            comb_comp = COLOR_COMPOSITIONS[combined_color];
            asp_comp = COLOR_COMPOSITIONS[color_aspect];
            for (let c of asp_comp) {
                if (comb_comp.indexOf(c) < 0) {
                    return false;
                }
            }
            return true;
        }

        function has_hue(color_glyph) {
            // Returns True if the given color glyph (e.g., a combined
            // color) is not 空 (empty).
            return color_glyph != "空";
        }

        function color_color(color_glyph, energized) {
            // Takes a color glyph and returns the corresponding actual
            // color.
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
            } else { // 空 etc.
                return fetch("bk");
            }
        }

        function object_color(obj_glyph, energized) {
            // Returns the color for any kind of object, depending on
            // whether it's energized or not.
            if (is_color(obj_glyph)) {
                // TODO: Energy states for colors!
                return color_color(obj_glyph, true);
            } else if (energized) {
                return colors.tile_color("unlocked-glyph");
            } else {
                // TODO: is this too inconspicuous?
                return colors.tile_color("pad");
            }
        }

        function is_connector(obj_glyph) {
            // Whether the object is a connector or not
            return LINK_TYPES.indexOf(obj_glyph) >= 0;
        }

        return {
            "RESOURCE_TYPES": RESOURCE_TYPES,
            "LINK_TYPES": LINK_TYPES,
            "BASIC_COLORS": BASIC_COLORS,
            "COLOR_COMPOSITIONS": COLOR_COMPOSITIONS,
            "COLOR_ADD": COLOR_ADD,
            "COLOR_SUBTRACT": COLOR_SUBTRACT,
            "random_resource": random_resource,
            "random_color": random_color,
            "is_color": is_color,
            "combined_color": combined_color,
            "color_contains": color_contains,
            "has_hue": has_hue,
            "color_color": color_color,
            "object_color": object_color,
            "is_connector": is_connector,
        };
    }
);
