// player.js
// Holds all player-specific information in one place so that it can be saved
// and loaded.

define(
  [],
  function() {

  // All current players by ID:
  var CURRENT_PLAYERS = {};

  // ID of the player currently controlled by input in this session
  var INPUT_PLAYER_ID = undefined;

  // Player ID counter:
  var NEXT_ID = 0;

  function next_id() {
    NEXT_ID += 1;
    return "player:" + NEXT_ID;
  }

  function new_player() {
    // Returns a new player object
    let id = next_id();
    let result = {
      "id": id,
      "unlock_limit": 1,
      "unlock_xp": 0,
      "domains_visited": [],
      "words_found": {},
    }
    CURRENT_PLAYERS[id] = result;
    return result;
  }

  function current_input_player() {
    // Returns the player who is currently being controlled by input from
    // this session.
    return CURRENT_PLAYERS[INPUT_PLAYER_ID];
  }

  return {
    "CURRENT_PLAYERS": CURRENT_PLAYERS,
    "INPUT_PLAYER_ID": INPUT_PLAYER_ID,
    "new_player": new_player,
    "current_input_player": current_input_player,
  };
});
