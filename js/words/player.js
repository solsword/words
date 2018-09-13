// player.js
// Holds all player-specific information in one place so that it can be saved
// and loaded.

define(
  [],
  function() {

  // All current players by ID:
  var CURRENT_PLAYERS = {};

  // Player ID counter:
  var NEXT_ID = 0;

  function next_id() {
    NEXT_ID += 1;
    return "player:" + NEXT_ID;
  }

  function new_player() {
    let id = next_id();
    let result = {
      "id": id,
    }
    CURRENT_PLAYERS[id] = result;
    return result;
  }

  return {
    "CURRENT_PLAYERS": CURRENT_PLAYERS,
    "new_player": new_player,
  };
});
