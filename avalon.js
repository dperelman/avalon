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
    }
  });

  Template.joinGame.events({
    "click .button-main-menu": function (event) {
      Session.set("currentView", "startMenu");
    }
  });

  Template.newGame.events({
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
