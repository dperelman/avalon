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

      if (!game) {
        return null;
      }

      var players = Players.find({'gameID': game._id}, {'sort': {'createdAt': 1}}).fetch();

      return players;
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
    state: "lobby"
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
  var player = {
    gameID: game._id,
    name: name,
    roll: null,
    team: null
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
