// quests.js
// Quests functionality.

define(["./content", "./dimensions"], function(content, dimensions) {

  function matches(hint, word) {
    // Checks whether a word matches a hint.
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

  function unlocked_encircled(dimension) {
    // Computes how many tiles are encircled within unlocked tiles in a given
    // dimension. Includes unlocked tiles themselves.

    // Create map for checking whether tiles are in the unlocked region:
    let unlk = content.unlocked_set(dimension);

    // Compute bounding box of unlocked region
    let bounds = [undefined, undefined, undefined, undefined];
    for (var pos of joint) {
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
    for (var k of Object.keys(edges)) {
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

  function unlocked_span(dimension) {
    // Computes how many tiles are spanned by the unlocked area in the given
    // dimension.

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

  function unlocked_branches(dimension) {
    // Computes how many y-shaped branches exist among the unlocked tiles in
    // the given dimension.

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

  function unlocked_sizes(dimension) {
    // Computes an array containing the number of words found of size i at each
    // index i.

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

  function revive_quest(q, words_found) {
    // Takes a stored quest and re-creates a full quest object, re-initializing
    // the object using the given words found list.
    let result = undefined;
    if (q.type == "hunt") {
      result = new HuntQuest(q.targets, q.bonuses, q.params, q.reward, q.found);
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


  function Quest(type, reward) {
    // Takes a type and a reward and initializes a quest object.
    this.type = type;
    this.reward = reward;
  };

  Quest.prototype.initialize = function(dimension, words_found) {
    this.dimension = dimension;
  };

  Quest.prototype.find_word = function(dimension, word, path) {
    console.error("Quest.find_word isn't implemented.");
  };

  Quest.prototype.is_complete = function() {
    console.error("Quest.is_complete isn't implemented.");
    return false;
  };

  Quest.prototype.got_bonus = function() {
    console.error("Quest.got_bonus isn't implemented.");
    return false;
  };


  function HuntQuest(targets, bonuses, params, reward, found) {
    // Targets and bonuses should each be lists of hint strings. Params may
    // include:
    //
    // "retroactive" -- Initializes quest with previously-discovered words.
    //
    // "found" is optional and initializes the found-words map.
    Quest.call(this, "hunt", reward);
    this.targets = targets;
    this.bonuses = bonuses;
    this.found = found || {};
    this.params = params || {};
  }

  HuntQuest.prototype = Object.create(Quest.prototype);
  HuntQuest.prototype.constructor = HuntQuest;

  HuntQuest.prototype.initialize = function(dimension, words_found) {
    Quest.prototype.initialize.call(this, dimension, words_found);
    // Sets already-found words as discovered for the quest if the
    // "retroactive" parameter is set.
    // TODO: Is this too slow?
    if (this.params.retroactive) {
      for (var w of Object.keys(words_found)) {
        for (var pos of words_found[w]) {
          let dim = pos[0];
          if (dimensions.same(this.dimension, dim)) {
            this.find_word(dim, w);
            break;
          }
        }
      }
    }
  }

  HuntQuest.prototype.find_word = function(dimension, word) {
    if (!dimensions.same(this.dimension, dimension)) {
      return;
    }
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
  }

  HuntQuest.prototype.is_complete = function() {
    let complete = true;
    for (var t of this.targets) {
      if (!this.found[t]) {
        complete = false;
      }
    }
    return complete;
  }

  HuntQuest.prototype.got_bonus = function() {
    let bonus = true;
    for (var b of this.bonuses) {
      if (!this.found[b]) {
        bonus = false;
      }
    }
    return bonus;
  }

  HuntQuest.prototype.summary_display = function () {
    return {
      "draw": function (ctx, width) {
      },
      "height": function () {
      }
    }
  }

  HuntQuest.prototype.details_display = function () {
    return {
      "draw": function (ctx, width) {
      },
      "height": function () {
      }
    }
  }

  HuntQuest.prototype.width = function (ctx) {
    // TODO: HERE
  }

  HuntQuest.prototype.height = function (ctx) {
    // TODO: HERE
  }

  HuntQuest.prototype.tap = function (rxy) {
    // TODO: HERE
  }

  HuntQuest.prototype.draw = function (ctx, width) {
    // TODO: HERE
  }


  function EncircleQuest(target, bonus, reward) {
    // Target and bonus should each be area numbers.
    Quest.call(this, "encircle", reward);
    this.target = target;
    this.bonus = bonus;
    this.area_encircled = 0;
  }

  EncircleQuest.prototype = Object.create(Quest.prototype);
  EncircleQuest.prototype.constructor = EncircleQuest;

  EncircleQuest.prototype.initialize = function(dimension, words_found) {
    Quest.prototype.initialize.call(this, dimension, words_found);
    this.area_encircled = unlocked_encircled(this.dimension);
  };

  EncircleQuest.prototype.find_word = function(word, path) {
    // Update our measure of encircled area.
    this.area_encircled = unlocked_encircled(this.dimension);
  };

  EncircleQuest.prototype.is_complete = function () {
    return this.area_encircled >= this.target; 
  }

  EncircleQuest.prototype.got_bonus = function () {
    return this.area_encircled >= this.bonus; 
  }


  function StretchQuest(target, bonus, reward) {
    // Target and bonus should each be area numbers.
    Quest.call(this, "stretch", reward);
    this.target = target;
    this.bonus = bonus;
    this.span = 0;
  };

  StretchQuest.prototype = Object.create(Quest.prototype);
  StretchQuest.prototype.constructor = StretchQuest;

  StretchQuest.prototype.initialize = function(dimension, words_found) {
    Quest.prototype.initialize.call(this, dimension, words_found);
    this.span = unlocked_span(this.dimension);
  };

  StretchQuest.prototype.find_word = function(word, path) {
    // Update our span measure.
    this.span = unlocked_span(this.dimension);
  };

  StretchQuest.prototype.is_complete = function () {
    return this.span >= this.target; 
  }

  StretchQuest.prototype.got_bonus = function () {
    return this.span >= this.bonus; 
  }


  function BranchQuest(target, bonus, reward) {
    // Target and bonus should each be area numbers.
    Quest.call(this, "branch", reward);
    this.target = target;
    this.bonus = bonus;
    this.branches = 0;
  }

  BranchQuest.prototype = Object.create(Quest.prototype);
  BranchQuest.prototype.constructor = BranchQuest;

  BranchQuest.prototype.initialize = function(dimension, words_found) {
    Quest.prototype.initialize.call(this, dimension, words_found);
    this.branches = unlocked_branches(this.dimension);
  };

  BranchQuest.prototype.find_word = function(word, path) {
    // Update our branches measure.
    this.branches = unlocked_branches(this.dimension);
  };

  BranchQuest.prototype.is_complete = function () {
    return this.branches >= this.target; 
  }

  BranchQuest.prototype.got_bonus = function () {
    return this.branches >= this.bonus; 
  }


  function BigQuest(target, bonus, reward) {
    // Target and bonus should each be [ length, number] pairs.
    Quest.call(this, reward);
    this.target = target;
    this.bonus = bonus;
    this.sizes = [];
  }

  BigQuest.prototype = Object.create(Quest.prototype);
  BigQuest.prototype.constructor = BigQuest;

  BigQuest.prototype.initialize = function(dimension, words_found) {
    Quest.prototype.initialize.call(this, dimension, words_found);
    this.sizes = unlocked_sizes(this.dimension);
  };

  BigQuest.prototype.find_word = function(word, path) {
    // Update our sizes array.
    let l = path.length;
    if (this.sizes[l] == undefined) {
      this.sizes[l] = 1;
    } else {
      this.sizes[l] += 1;
    }
  };

  BigQuest.prototype.is_complete = function () {
    let count = 0;
    for (let i = this.target[0]; i < this.sizes.length; ++i) {
      count += this.sizes[i] || 0;
    }
    return count >= this.target[1];
  }

  BigQuest.prototype.got_bonus = function () {
    let count = 0;
    for (let i = this.bonus[0]; i < this.sizes.length; ++i) {
      count += this.sizes[i] || 0;
    }
    return count >= this.bonus[1];
  }


  function GlyphQuest(targets, bonuses, reward, found) {
    // Targets and bonuses should each be maps from glyphs to amounts. Found is
    // optional and will initialize the found glyphs map.
    Quest.call(this, "glyph", reward);
    this.targets = targets;
    this.bonuses = bonuses;
    this.found = found || {};
  }

  GlyphQuest.prototype = Object.create(Quest.prototype);
  GlyphQuest.prototype.constructor = GlyphQuest;

  GlyphQuest.prototype.initialize = function(dimension, words_found) {
    Quest.prototype.initialize.call(this, dimension, words_found);
    // Already-discovered glyphs are *not* counted, because unlocked areas
    // might possibly be unloaded.
  };

  GlyphQuest.prototype.find_word = function(word, path) {
    for (var g of word) {
      found[g] = true;
    }
  }

  GlyphQuest.prototype.is_complete = function () {
    let missing = false;
    for (let g of this.targets) {
      if (!found[g]) {
        missing = true;
      }
    }
    return !missing;
  }

  GlyphQuest.prototype.got_bonus = function () {
    let missing = false;
    for (let g of this.bonuses) {
      if (!found[g]) {
        missing = true;
      }
    }
    return !missing;
  }

  return {
    "matches": matches,
    "Quest": Quest,
    "HuntQuest": HuntQuest,
    "StretchQuest": StretchQuest,
    "BranchQuest": BranchQuest,
    "BigQuest": BigQuest,
    "GlyphQuest": GlyphQuest,
  }
});
