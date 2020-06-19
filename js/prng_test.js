import * as anarchy from "./anarchy.mjs"

function update_canvas_size(canavs, ctx) {
  // Updates the canvas size.
  var bounds = canvas.getBoundingClientRect();
  var car = bounds.width / bounds.height;
  canvas.width = 800 * car;
  canvas.height = 800;
  ctx.cwidth = canvas.width;
  ctx.cheight = canvas.height;
  ctx.middle = [ctx.cwidth / 2, ctx.cheight / 2];
  ctx.bounds = bounds;
}

function xyhash(x, y, seed) {
  var r = anarchy.prng(
    x ^ anarchy.prng(
      y,
      seed + 18921
    ),
    1748120
  );
  for (var i = 0; i < 1 + (x + y + seed) % 3; ++i) {
    r = anarchy.prng(r, seed);
  }
  return r;
}

function prng(x) {
  // return anarchy.prng(x, 1);
  // return anarchy.prng(x, -3000000);
  // return anarchy.prng(x, anarchy.scramble(1));
  x = anarchy.fold(x, 15);
  return anarchy.prng(x, 0xa564de64);
  // return anarchy.prng(x, 0x80000001);
  // return anarchy.scramble(x);
  // return anarchy.lfsr(x);
}

function rev_prng(x) {
  // var r =  anarchy.rev_prng(x, 1);
  // var r =  anarchy.rev_prng(x, -3000000);
  // var r =  anarchy.rev_prng(x, anarchy.scramble(1));
  var r =  anarchy.rev_prng(x, 0xa564de64);
  // var r =  anarchy.rev_prng(x, 0x80000001);
  // var r =  anarchy.rev_scramble(x);
  r = anarchy.fold(r, 15);
  return r;
}

function gray(value) {
  var v = Math.floor(value * 256);
  return "rgb(" + v + ", " + v + ", " + v + ")";
}

function draw_dot(ctx, x, y) {
  ctx.fillRect(x, y, 1, 1);
}

function draw_line(ctx, fx, fy, tx, ty) {
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
}

var CTX;
export function main() {
  var canvas = document.getElementById("canvas");
  CTX = canvas.getContext("2d");
  update_canvas_size(canvas, CTX);

  draw(CTX);

  check();
}

var MODE = 0;
var N_MODES = 5;

FROMTO = 0;
AUTOCORRELATIONS = 1;
GAPS = 2;
HISTOGRAMS = 3;
XY = 4;

MODE = AUTOCORRELATIONS;

// event handler for mode switching:
document.onmousedown = function (e) {
  if (e.preventDefault) { e.preventDefault(); }
  MODE = (MODE + 1) % N_MODES;
  draw(CTX);
}

function draw(ctx) {
  // erase everything and start over with pure white background:
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, ctx.cwidth, ctx.cheight);
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1.0;

  var ss_sample = []; // sequential-seeds sample
  var sv_sample = []; // sequential-values sample
  var sample_size = 1000000;
  var p = 1;
  for (var i = 0; i < sample_size; ++i) {
    ss_sample.push(prng(i + 1));
    sv_sample.push(p);
    p = prng(p);
  }

  var gw = ctx.middle[0];
  var gh = ctx.middle[1];

  // draw sequential seeds in the upper left:
  gw = ctx.middle[0];
  gh = ctx.middle[1];
  for (var x = 0; x < gw; ++x) {
    for (var y = 0; y < gh; ++y) {
      var v = anarchy.udist(ss_sample[x + y*gw]);
      ctx.fillStyle = gray(v);
      draw_dot(ctx, x, y);
    }
  }
  ctx.fillStyle = "#000";

  // draw in the lower left:
  gw = ctx.middle[0];
  gh = ctx.cheight - ctx.middle[1];
  if (MODE == FROMTO) {
    // from/to plot with overdraw:
    for (var x = 0; x < gw * 8; ++x) {
      var y = ss_sample[x];
      var sx = x % gw;
      var sy = y % gh;
      draw_dot(ctx, sx, ctx.middle[1] + sy);
    }
  } else if (MODE == AUTOCORRELATIONS) {
    // autocorrelation graph
    for (var x = 0; x < gw; ++x) {
      var stride = Math.floor(Math.exp(x / 50));
      var ac = 0;
      for (var idx = 0; idx < sample_size - stride; idx += 1) {
        ac += udist(ss_sample[idx]) * udist(ss_sample[idx + stride]);
      }
      ac /= (sample_size - stride);
      draw_dot(
        ctx,
        x,
        ctx.middle[1] + gh - (ac * gh)
      );
    }
  } else if (MODE == HISTOGRAMS) {
    var bins = [];
    var max_bin = 0;
    for (var x = 0; x < gw; ++x) {
      var in_bin = 0;
      for (var idx = 0; idx < gw*gh; ++idx) {
        var s = udist(ss_sample[idx]);
        if (s >= (x / gw) && s < (x + 1) / gw) {
          in_bin += 1;
        }
      }
      if (in_bin > max_bin) {
        max_bin = in_bin;
      }
      bins.push(in_bin);
    }
    for (var x = 0; x < gw; ++x) {
      var v = bins[x] / (max_bin * 1.1);
      ctx.strokeStyle = gray(1 - (bins[x] / max_bin));
      draw_line(
        ctx,
        x,
        ctx.middle[1] + gh,
        x,
        ctx.middle[1] + gh - v * gh
      );
    }
  } else if (MODE == GAPS) {
    // sequential gaps
    for (var x = 0; x < gw; ++x) {
      for (var y = 0; y < gh; ++y) {
        var idx = x + y * gw;
        var s = ss_sample[idx];
        var next_s = ss_sample[idx + 1]
        var v = (1 + udist(s) - udist(next_s)) / 2;
        ctx.fillStyle = gray(v);
        draw_dot(ctx, x, ctx.middle[1] + y);
      }
    }
  } else if (MODE == XY) {
    for (var x = 0; x < gw; ++x) {
      for (var y = 0; y < gh; ++y) {
        var h = xyhash(x, y, 17);
        var v = udist(h);
        ctx.fillStyle = gray(v);
        draw_dot(ctx, x, ctx.middle[1] + y);
      }
    }
  }

  // draw sequential values in the upper right:
  gw = ctx.cwidth - ctx.middle[0];
  gh = ctx.middle[1];
  for (var x = 0; x < gw; ++x) {
    for (var y = 0; y < gh; ++y) {
      var v = udist(sv_sample[x + y*gw]);
      ctx.fillStyle = gray(v);
      draw_dot(ctx, ctx.middle[0] + x, y);
    }
  }
  ctx.fillStyle = "#000";

  // draw in the lower right
  gh = ctx.cheight - ctx.middle[1];
  if (MODE == FROMTO) {
    // from/to plot with overdraw:
    for (var x = 0; x < gw * 8; ++x) {
      var y = sv_sample[x];
      var sx = x % gw;
      var sy = y % gh;
      draw_dot(ctx, ctx.middle[0] + sx, ctx.middle[1] + sy);
    }
  } else if (MODE == AUTOCORRELATIONS) {
    // autocorrelation graph
    for (var x = 0; x < gw; ++x) {
      var stride = Math.floor(Math.exp(x / 50));
      var ac = 0;
      for (var idx = 0; idx < sample_size - stride; idx += 1) {
        ac += udist(sv_sample[idx]) * udist(sv_sample[idx + stride]);
      }
      ac /= (sample_size - stride);
      draw_dot(
        ctx,
        ctx.middle[0] + x,
        ctx.middle[1] + gh - (ac * gh)
      );
    }
  } else if (MODE == HISTOGRAMS) {
    var bins = [];
    var max_bin = 0;
    for (var x = 0; x < gw; ++x) {
      var in_bin = 0;
      for (var idx = 0; idx < gw*gh; ++idx) {
        var s = udist(sv_sample[idx]);
        if (s >= (x / gw) && s < (x + 1) / gw) {
          in_bin += 1;
        }
      }
      if (in_bin > max_bin) {
        max_bin = in_bin;
      }
      bins.push(in_bin);
    }
    for (var x = 0; x < gw; ++x) {
      var v = bins[x] / (max_bin * 1.1);
      ctx.strokeStyle = gray(1 - (bins[x] / max_bin));
      draw_line(
        ctx,
        ctx.middle[0] + x,
        ctx.middle[1] + gh,
        ctx.middle[0] + x,
        ctx.middle[1] + gh - v * gh
      );
    }
  } else if (MODE == GAPS) {
    // sequential gaps
    for (var x = 0; x < gw; ++x) {
      for (var y = 0; y < gh; ++y) {
        var idx = x + y * gw;
        var s = sv_sample[idx];
        var next_s = sv_sample[idx + 1]
        var v = (1 + udist(s) - udist(next_s)) / 2;
        ctx.fillStyle = gray(v);
        draw_dot(ctx, ctx.middle[0] + x, ctx.middle[1] + y);
      }
    }
  } else if (MODE == XY) {
    var bins = [];
    for (var idx = 0; idx < gw; ++idx) {
      bins[idx] = 0;
    }
    var max_bin = 0;
    for (var x = 0; x < gw; ++x) {
      for (var y = 0; y < gh; ++y) {
        var h = xyhash(x, y, 17);
        var v = udist(h + h % 12345);
        var idx = Math.floor(v * gw);
        bins[idx] += 1;
        if (bins[idx] > max_bin) {
          max_bin = bins[idx];
        }
      }
    }
    for (var x = 0; x < gw; ++x) {
      var v = bins[x] / (max_bin * 1.1);
      ctx.strokeStyle = gray(1 - (bins[x] / max_bin));
      draw_line(
        ctx,
        ctx.middle[0] + x,
        ctx.middle[1] + gh,
        ctx.middle[0] + x,
        ctx.middle[1] + gh - v * gh
      );
    }
  }
}

function check() {
  for (var i = 1; i < 10000; ++i) {
    var seed = anarchy.lfsr(i + 37);
    for (var j = 0; j < (2 + i % 5); ++j) {
      seed = anarchy.lfsr(seed);
    }
    var s = anarchy.prng(i, seed);
    var us = anarchy.rev_prng(s, seed);
    if (i != us) {
      console.log("Reverse failed @ " + seed + "! " + i + " != " + us);
    }
    seed = 0xffffffff - anarchy.lfsr(seed);
    var ai = i + 189379182
    var s = anarchy.prng(ai, seed);
    var us = anarchy.rev_prng(s, seed);
    if (ai != us) {
      console.log("Reverse failed @ " + seed + "! " + ai + " != " + us);
    }
  }
}

// do it!
main();
