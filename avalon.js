Games = new Mongo.Collection("games");
Rounds = new Mongo.Collection("rounds");
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

  Template.score.helpers({
    game: function () {
      return getCurrentGame();
    },
    missionNum: function (object) {
      var game = getCurrentGame();
      var numPlayers = missionNumPlayers(object.hash.round, game.numPlayers);
      if (numPlayers[1] === 2) {
        return numPlayers[0] + "*";
      } else {
        return numPlayers[0];
      }
    },
    roundFinished: function (object) {
      var game = getCurrentGame();
      var param = "result" + object.hash.round;
      if (game[param] === "pass") {
        return "pass";
      } else if (game[param] === "fail"){
        return "fail";
      } else {
        return null;
      }
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
    },
    isSpy: function () {
      var player = getCurrentPlayer();
      return (player.team === "spy" ? true : false);
    },
    allSpies: function () {
      var game = getCurrentGame();
      if (!game) { return null; }
      var players = Players.find({'gameID': game._id}, {'sort': {'createdAt': 1}}).fetch();
      var spies = [];

      players.forEach(function (player) {
        if (player.team === "spy") {
          spies.push(player);
        }
      });

      return spies;
    }
  });

  Template.pickPhaseLeader.events({
    'click button':function () {
      var game = getCurrentGame();
      Games.update(game._id, {$set: {state: "votingPhase"}});
    }
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
    },
    chosenPlayers:function () {
      var game = getCurrentGame();
      var players = Players.find({'gameID': game._id, 'chosen': true}, {'sort': {'createdAt': 1}}).fetch();
      return players;
    }
  });

  Template.player.events({
    'click .player':function () {
      var game = getCurrentGame();
      var numChosen = Players.find({'gameID': game._id, 'chosen': true}).count();
      var roundMax = missionNumPlayers(game.round, game.numPlayers)[0];

      if (numChosen < roundMax) {
        Players.update(this._id, {$set: {chosen: ! this.chosen}});
      } else if(this.chosen) {
        Players.update(this._id, {$set: {chosen: false}});
      }
    }
  });

  Template.player.helpers({
    isSpy: function () {
      return (this.team === "spy" ? true : false);
    }
  });

  Template.votingPhase.helpers({
    chosenPlayers: function () {
      var game = getCurrentGame();
      var players = Players.find({'gameID': game._id, 'chosen': true}, {'sort': {'createdAt': 1}}).fetch();
      return players;
    },
    players: function () {
      var game = getCurrentGame();
      if (!game) { return null; }
      var players = Players.find({'gameID': game._id}, {'sort': {'createdAt': 1}}).fetch();
      return players;
    },
    playerVote: function () {
      var player = getCurrentPlayer();
      return player.vote;
    }
  });

  Template.votingPhase.events({
    'click .button-accept':function () {
      var player = getCurrentPlayer();
      Players.update(player._id, {$set: {vote: "accept"}});
    },
    'click .button-reject':function () {
      var player = getCurrentPlayer();
      Players.update(player._id, {$set: {vote: "reject"}});
    }
  });

  Template.voteResults.helpers({
    exists: function () {
      var game = getCurrentGame();
      if (!game || game.turn < 1) { return null; }
      return true;
    },
    acceptVoters: function () {
      var game = getCurrentGame();
      if (!game) { return null; }
      var players = Players.find({'gameID': game._id, 'previousVote': 'accept'}, {'sort': {'createdAt': 1}}).fetch();
      return players;
    },
    rejectVoters: function () {
      var game = getCurrentGame();
      if (!game) { return null; }
      var players = Players.find({'gameID': game._id, 'previousVote': 'reject'}, {'sort': {'createdAt': 1}}).fetch();
      return players;
    }
  });

  Template.missionPhaseChosen.events({
    'click .button-pass':function () {
      var player = getCurrentPlayer();
      Players.update(player._id, {$set: {mission: "pass"}});
    },
    'click .button-fail':function () {
      var player = getCurrentPlayer();
      Players.update(player._id, {$set: {mission: "fail"}});
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
    Games.remove({});
    Players.remove({});
    Rounds.remove({});
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
    round: 1,
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

  return null;
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
  } else if (game.state === "votingPhase") {
    Session.set("currentView", 'votingPhase');
  } else if (game.state === "lobby") {
    Session.set("currentView", "lobby");
  } else if (game.state === "pickPhase"){
    if (player._id === leader._id) {
      Session.set("currentView", "pickPhaseLeader");
    } else {
      Session.set("currentView", "pickPhase");
    }
  } else if (game.state === "missionPhase") {
    if (player.chosen) {
      Session.set("currentView", "missionPhaseChosen");
    } else {
      Session.set("currentView", "missionPhase");
    }
  }
}

function trackPlayersState() {
  var game = Games.findOne(Session.get("gameID"));
  var players = Players.find({'gameID': game._id});

  if (Session.get("currentView") === "rolePhase" && allReady(players)){
    Games.update(game._id, {$set: {state: 'pickPhase'}});
  }

  if (Session.get("currentView") === "votingPhase" && !!allVoted(players)){
    if (allVoted(players) === "accept"){
      recordVotes(players);
      resetVotes(players);
      Games.update(game._id, {$set: {state: "missionPhase", turn: game.turn + 1}});
    } else {
      recordVotes(players);
      resetAll(players);
      Games.update(game._id, {$set: {state: "pickPhase", turn: game.turn + 1 }});
    }
  }
  if (Session.get("currentView") === "missionPhase" && !!missionFinished(players)){
    handleMissionResult(missionFinished(players));
    resetAll(players);
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


function allVoted(players) {
  var accept = 0;
  var reject = 0;
  players.forEach(function (player) {
    if (player.vote === "accept") {
      accept++;
    } else if (player.vote === "reject"){
      reject++;
    }
  });

  if(players.count() > (accept + reject)) {
    return false;
  } else {
    return ( accept > reject ? "accept" : "reject" );
  }
}

function resetAll(players) {
  players.forEach(function (player) {
    Players.update(player._id, { $set: { vote: "" }});
    Players.update(player._id, { $set: { chosen: "" }});
    Players.update(player._id, { $set: { mission: "" }});
  });
}

function recordVotes(players) {
  players.forEach(function (player) {
    Players.update(player._id, { $set: { previousVote: player.vote }});
  });
}

function resetVotes(players) {
  players.forEach(function (player) {
    Players.update(player._id, { $set: { vote: "" }});
  });
}

function updateLeader(leader, players) {
  players.forEach(function (player) {
    Players.update(player._id, {$set: {leader: true}});
  });

  Players.update(leader._id, {$set: {leader: true}});
}

function missionFinished(players) {
  var game = getCurrentGame();
  var pass = 0;
  var fail = 0;
  var numToFail = missionNumPlayers(game.round, game.numPlayers)[1];

  players.forEach(function (player) {
    if (player.mission === "fail"){
      fail ++;
    } else if (player.mission === "pass"){
      pass ++;
    }
  });

  if (missionNumPlayers(game.round, game.numPlayers)[0] > (pass + fail)) {
    return false;
  } else {
    return ( fail >= numToFail ? "fail" : "pass");
  }
}

function missionNumPlayers(roundNum, numPlayers) {
  switch (true) {
    case numPlayers == 5:
      switch(roundNum) {
        case 1: return [2, 1];
        case 2: return [3, 1];
        case 3: return [2, 1];
        case 4: return [3, 1];
        case 5: return [3, 1];
      }
      break;
    case numPlayers == 6:
      switch(roundNum) {
        case 1: return [2, 1];
        case 2: return [3, 1];
        case 3: return [4, 1];
        case 4: return [3, 1];
        case 5: return [4, 1];
      }
      break;
    case numPlayers == 7:
      switch(roundNum) {
        case 1: return [2, 1];
        case 2: return [3, 1];
        case 3: return [3, 1];
        case 4: return [4, 2];
        case 5: return [4, 1];
      }
      break;
    case numPlayers > 7 && numPlayers < 11:
      switch(roundNum) {
        case 1: return [3, 1];
        case 2: return [4, 1];
        case 3: return [4, 1];
        case 4: return [5, 2];
        case 5: return [5, 1];
      }
      break;
    default:
      return null;
  }
}

function handleMissionResult(result) {
  var game = getCurrentGame();
  var param = "result" + game.round;
  var query = {};
  query[param] = result;
  Games.update(game._id, {$set: {state: "pickPhase", round: game.round + 1, prevResult: result}});
  Games.update(game._id, {$set: query});
}
