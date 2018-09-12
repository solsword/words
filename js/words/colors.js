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
     "trail": "#ccc",
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
         "background": "#057",
             "border": "#0af",
  "active_background": "#079",
      "active_border": "#0cf",
               "text": "#fff",
       "text_outline": "#fff",
             "button": "#079",
    "selected_button": "#035",
      "button_border": "#0cf",
        "button_text": "#fff",
"button_text_outline": "#fff",
      },
      "bright": {
        "rd": "#f44",
        "yl": "#ff2",
        "bl": "#46f",
        "pk": "#f4c",
        "aq": "#4cf",
        "or": "#fa2",
        "gn": "#6f6",
        "cr": "#efa",
        "lb": "#bef",
        "lg": "#af4",
      },
      "dark": {
        "rd": "#411",
        "yl": "#431",
        "bl": "#114",
        "pk": "#403",
        "aq": "#034",
        "or": "#420",
        "gn": "#141",
        "cr": "#342",
        "lb": "#335",
        "lg": "#453",
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
        "rd": "#f44",
        "yl": "#ff2",
        "bl": "#46f",
        "pk": "#f4c",
        "aq": "#4cf",
        "or": "#fa2",
        "gn": "#6f6",
        "cr": "#efa",
        "lb": "#bef",
        "lg": "#af4",
      },
      "dark": {
        "rd": "#411",
        "yl": "#431",
        "bl": "#114",
        "pk": "#403",
        "aq": "#034",
        "or": "#420",
        "gn": "#141",
        "cr": "#342",
        "lb": "#335",
        "lg": "#453",
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
    let canvas = document.getElementById("canvas");
    if (canvas) {
      canvas.style = ("border_color: " + outer_color("edge") + ";");
    }
  }

  // Initialize default color scheme:
  // set_color_scheme("graph_paper");
  set_color_scheme("underground");

  function palette() {
    return [
        "rd", // red
        "yl", // yellow
        "bl", // blue
        "pk", // pink
        "aq", // aqua
        "or", // orange
        "gn", // green
        "cr", // cream
        "lb", // light blue
        "lg", // lime green
    ];
  }

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
    "palette": palette,
  }
});
