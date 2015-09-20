Games = new Mongo.Collection("games");
Players = new Mongo.Collection("players");

if (Meteor.isClient) {
  Template.body.created = function () {
    Session.set("currentView", "startMenu");
  };

  Template.main.helpers({
    whichView: function () {
      return Session.get("currentView");
    }
  });

  Template.startMenu.events({
    "click .button-new-game": function (event) {
      Session.set("currentView", "newGame");
    },
    "click .button-join-game": function (event) {
      Session.set("currentView", "joinGame");
    }
  });

  Template.newGame.events({
    "click .button-main-menu": function (event) {
      Session.set("currentView", "startMenu");
    },

    'submit .new-game-form': function (event) {
      event.preventDefault();
      var playerName = $(event.currentTarget).find('.name-input').val();

      if (!playerName) {
        return false;
      }

      var game = generateNewGame();
      var player = generateNewPlayer(game, playerName);

      Meteor.subscribe('games', game.accessCode);

      Session.set("loading", true);

      Meteor.subscribe('players', game._id, function onReady() {
        Session.set("loading", false);
        Session.set("gameID", game._id);
        Session.set("playerID", player._id);
        Session.set("currentView", "lobby");
      });

      Tracker.autorun(trackGameState);
    }
  });

  Template.newGame.helpers({
    track: function () {
      trackGameState();
    },
    trackPlayers: function () {
      trackPlayersState();
    }
  });

  Template.joinGame.events({
    "click .button-main-menu": function (event) {
      Session.set("currentView", "startMenu");
    },

    'submit .join-game-form': function (event) {
      event.preventDefault();
      var code = $(event.currentTarget).find('.code-input').val();
      var name = $(event.currentTarget).find('.name-input').val();

      if (!name){
        return false;
      }

      code = code.trim().toLowerCase();

      Session.set("loading", true);

      Meteor.subscribe('games', code, function onReady() {
        Session.set("loading", false);

        var game = Games.findOne({ accessCode: code });

        if (game) {
          Meteor.subscribe('players', game._id);
          player = generateNewPlayer(game, name);

          Session.set("gameID", game._id);
          Session.set("playerID", player._id);
          Session.set("currentView", "lobby");
        } else {
          //invalid code validation here
          return false;
        }
      });

      Tracker.autorun(trackGameState);
    }
  });

  Template.lobby.events({
    "click .button-start":function () {

      var game = getCurrentGame();
      var players = Players.find({'gameID': game._id});

      if (players.count < 3) {
        return false;
      }

      assignTeams(players);
      Games.update(game._id, {$set: {state: 'rolePhase'}});
    }
  });

  Template.lobby.helpers({
    game: function () {
      return getCurrentGame();
    },
    code: function () {
      return getAccessCode();
    },
    players: function () {
      var game = getCurrentGame();
      if (!game) { return null; }
      var players = Players.find({'gameID': game._id}, {'sort': {'createdAt': 1}}).fetch();
      return players;
    }
  });

  Template.rolePhase.events({
    'click button': function () {
      var player = getCurrentPlayer();
      Players.update(player._id, {$set: {ready: "ready"}});
      Tracker.autorun(trackPlayersState);
    }
  });

  Template.rolePhase.helpers({
    player: function () {
      return getCurrentPlayer();
    },
    players: function () {
      var game = getCurrentGame();
      if (!game) { return null; }
      var players = Players.find({'gameID': game._id}, {'sort': {'createdAt': 1}}).fetch();
      return players;
    }
  });

  Template.pickPhase.events({

  });

  Template.pickPhaseLeader.helpers({
    players: function () {
      var game = getCurrentGame();
      if (!game) { return null; }
      var players = Players.find({'gameID': game._id}, {'sort': {'createdAt': 1}}).fetch();
      return players;
    }
  });

  Template.pickPhase.helpers({
    player: function () {
      return getCurrentPlayer();
    },
    chosen: function () {
      return getCurrentPlayer().chosen;
    }
  });

  Template.player.events({
    'click .player':function () {
      Players.update(this._id, {$set: {chosen: ! this.chosen}});
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
    Games.remove({});
    Players.remove({});
  });

  Meteor.publish('games', function(accessCode) {
    return Games.find({"accessCode": accessCode});
  });

  Meteor.publish('players', function(gameID) {
    return Players.find({"gameID": gameID});
  });
}


function generateNewGame() {
  var game = {
    accessCode: generateAccessCode(),
    numPlayers: 0,
    state: "lobby",
    turn: 0,
  };

  var gameID = Games.insert(game);
  game = Games.findOne(gameID);
  return game;
}

function generateAccessCode() {
  var code = "";
  var alpha = "abcdefghjiklmnopqrstuvwxyz";

  for (var i = 0; i < 6; i++) {
    code += alpha.charAt(Math.floor(Math.random() * alpha.length));
  }

  return code;
}

function generateNewPlayer(game, name) {
  Games.update(game._id, {$set: {numPlayers: game.numPlayers + 1}});

  var player = {
    gameID: game._id,
    name: name,
    ord: game.numPlayers
  };

  var playerID = Players.insert(player);
  player = Players.findOne(playerID);
  return player;
}

function getCurrentGame() {
  var gameID = Session.get("gameID");

  if (gameID) {
    return Games.findOne(gameID);
  }
}

function getCurrentPlayer() {
  var playerID = Session.get("playerID");

  if (playerID) {
    return Players.findOne(playerID);
  }
}

function getAccessCode() {
  var game = getCurrentGame();
  if (!game) { return; }
  return game.accessCode;
}

function shuffle(array){
  for(var j, x, i = array.length; i; j = Math.floor(Math.random() * i), x = array[--i], array[i] = array[j], array[j] = x);
  return array;
}

function assignTeams(players) {
  var teams = [];
  switch (players.count()) {
    case 3:
      teams = ["spy", "resistance", "resistance"];
      break;
    case 4:
      teams = ["spy", "resistance", "resistance", "resistance"];
      break;
    case 5:
      teams = ["spy", "spy",
               "resistance", "resistance", "resistance"];
      break;
    case 6:
      teams = ["spy", "spy",
               "resistance", "resistance", "resistance", "resistance"];
      break;
    case 7:
      teams = ["spy", "spy", "spy",
               "resistance", "resistance", "resistance", "resistance"];
      break;
    case 8:
      teams = ["spy", "spy",  "spy",
               "resistance", "resistance", "resistance", "resistance", "resistance"];
      break;
    case 9:
      teams = ["spy", "spy",  "spy",
               "resistance", "resistance", "resistance", "resistance", "resistance", "resistance"];
      break;
    case 10:
      teams = ["spy", "spy", "spy",  "spy",
               "resistance", "resistance", "resistance", "resistance", "resistance", "resistance"];
      break;
  }

  shuffle(teams);

  players.forEach(function (player, index) {
    Players.update(player._id, {$set: {
      team: teams.pop()
    }});
  });

  return players;
}

function trackGameState() {
  var gameID = Session.get("gameID");
  var playerID = Session.get("playerID");

  if (!gameID || !playerID){
    return;
  }

  var game = Games.findOne(gameID);
  var player = Players.findOne(playerID);
  var players = Players.find({'gameID': game._id});
  var leader = Players.findOne({
     $and: [
            { 'gameID' : game._id },
            { 'ord': game.turn % game.numPlayers }
          ]
   });
  updateLeader(leader, players);

  if (!game || !player){
    Session.set("gameID", null);
    Session.set("playerID", null);
    Session.set("currentView", "startMenu");
    return;
  }

  if(game.state === "rolePhase"){
    Session.set("currentView", "rolePhase");
  } else if (game.state === "lobby") {
    Session.set("currentView", "lobby");
  } else {
    if (player._id === leader._id) {
      if (game.state === "pickPhase") {
        Session.set("currentView", "pickPhaseLeader");
      }
    } else {
      if (game.state === "pickPhase") {
        Session.set("currentView", "pickPhase");
      }
    }
  }
}

function trackPlayersState() {
  var game = Games.findOne(Session.get("gameID"));
  var players = Players.find({'gameID': game._id});

  if (Session.get("currentView") === "rolePhase" && allReady(players)){
    Games.update(game._id, {$set: {state: 'pickPhase'}});
  }
}

function allReady(players) {
  var result = true;
  players.forEach(function (player) {
    if (player.ready !== "ready") {
      result = false;
    }
  });

  return result;
}

function updateLeader(leader, players) {
  players.forEach(function (player) {
    Players.update(player._id, {$set: {leader: true}});
  });

  Players.update(leader._id, {$set: {leader: true}});
}
