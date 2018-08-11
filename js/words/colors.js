// colors.js
// Color schemes for words game.

define(
[],
function() {

  var SCHEMES = {
    "underground": {
      "outer": {
        "background": "#444",
        "edge": "#000",
      },
      "ui": {
 "highlight": "#fff",
      "poke": "#ddd",
     "trail": "#ddd",
      },
      "tile": {
       "outline": "#555",
         "inner": "#333",
           "rim": "#555",
           "pad": "#444",
         "glyph": "#bbb",
  "unlocked-pad": "#777",
  "unlocked-rim": "#eee",
"unlocked-glyph": "#fff",
  "included-pad": "#555",
  "included-rim": "#777",
      },
      "loading": {
"pre_outline": "#999",
    "outline": "#999",
      "inner": "#333",
     "counts": "#777",
      "index": "#999",
       "text": "#fff"
      },
      "menu": {
        "background": "#333",
        "border": "#777",
        "active_background": "#555",
        "active_border": "#bbb",
        "text": "#ddd",
        "text_outline": "#fff",
        "button": "#555",
        "selected_button": "#444",
        "button_border": "#ddd",
        "button_text": "#aaa",
        "button_text_outline": "#ddd",
      },
      "bright": {
        "gr": "#888",
        "bl": "#8bf",
        "lb": "#bef",
        "rd": "#f66",
        "yl": "#ff2",
        "gn": "#6f6",
        "lg": "#af7",
      },
      "dark": {
        "gr": "#444",
        "bl": "#224",
        "lb": "#335",
        "rd": "#422",
        "yl": "#442",
        "gn": "#242",
        "lg": "#353",
      },
    },
    "graph_paper": {
      "outer": {
        "background": "#fff",
        "edge": "#000",
      },
      "ui": {
 "highlight": "#000",
      "poke": "#bbf",
     "trail": "#222",
      },
      "tile": {
       "outline": "#eef",
         "inner": "#fff",
           "rim": "#ddf",
           "pad": "#fff",
         "glyph": "#000",
  "unlocked-pad": "#fff",
  "unlocked-rim": "#88f",
"unlocked-glyph": "#000",
  "included-pad": "#fff",
  "included-rim": "#dfe",
      },
      "loading": {
"pre_outline": "#ccf",
    "outline": "#eef",
      "inner": "#fff",
     "counts": "#555",
      "index": "#777",
       "text": "#000"
      },
      "menu": {
        "background": "#ddf",
        "border": "#99f",
        "active_background": "#aaf",
        "active_border": "#66f",
        "text": "#000",
        "text_outline": "#224",
        "button": "#ccf",
        "selected_button": "#aaf",
        "button_border": "#eef",
        "button_text": "#333",
        "button_text_outline": "#555",
      },
      "bright": {
        "gr": "#888",
        "bl": "#8bf",
        "lb": "#bef",
        "rd": "#f66",
        "yl": "#ff2",
        "gn": "#6f6",
        "lg": "#af7",
      },
      "dark": {
        "gr": "#444",
        "bl": "#224",
        "lb": "#335",
        "rd": "#422",
        "yl": "#442",
        "gn": "#242",
        "lg": "#353",
      },
    },
    "dusk": {
      // TODO
    },
    "noon": {
      // TODO
    }
  }

  var CURRENT_SCHEME = undefined;

  function scheme_names() { return Object.keys(SCHEMES); }
  function set_color_scheme(name) { CURRENT_SCHEME = SCHEMES[name]; }

  function outer_color(c) { return CURRENT_SCHEME["outer"][c]; }
  function ui_color(c) { return CURRENT_SCHEME["ui"][c]; }
  function tile_color(c) { return CURRENT_SCHEME["tile"][c]; }
  function loading_color(c) { return CURRENT_SCHEME["loading"][c]; }
  function bright_color(c) { return CURRENT_SCHEME["bright"][c]; }
  function dark_color(c) { return CURRENT_SCHEME["dark"][c]; }
  function menu_color(c) { return CURRENT_SCHEME["menu"][c]; }

  function set_color_scheme(cs) {
    CURRENT_SCHEME = SCHEMES[cs];
    // TODO: Set styles non-destructively
    document.body.style = "background: " + outer_color("background") + ";";
    document.getElementById("canvas").style = (
      "border_color: " + outer_color("edge") + ";"
    );
  }

  // Initialize default color scheme:
  // set_color_scheme("graph_paper");
  set_color_scheme("underground");

  return {
    "scheme_names": scheme_names,
    "set_color_scheme": set_color_scheme,
    "outer_color": outer_color,
    "ui_color": ui_color,
    "tile_color": tile_color,
    "loading_color": loading_color,
    "bright_color": bright_color,
    "dark_color": dark_color,
    "menu_color": menu_color,
    "set_color_scheme": set_color_scheme,
  }
});
