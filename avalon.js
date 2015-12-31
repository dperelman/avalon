Games = new Mongo.Collection("games");
Players = new Mongo.Collection("players");
// A round is one of the 5 game rounds.
Rounds = new Mongo.Collection("rounds");
// Each round contains one or more votes.
Votes = new Mongo.Collection("votes");
// Each vote has a player vote from each player.
PlayerVotes = new Mongo.Collection("playerVotes");

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
      Meteor.subscribe('rounds', game._id)
      Meteor.subscribe('votes', game._id)
      Meteor.subscribe('playerVotes', game._id)

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
      var game = Games.findOne({ accessCode: code });

      Session.set("loading", true);

      Meteor.subscribe('games', code, function onReady() {
        Session.set("loading", false);

        var game = Games.findOne({ accessCode: code });

        if (game.state === 'lobby') {
          Meteor.subscribe('players', game._id, function onReady() {
            var sameNamePlayer = Players.findOne({ gameID: game._id, name: name });
            $('.alert-game-started').hide();
            if (sameNamePlayer) {
              $('.alert-unique-name').show();
              return false;
            } else {
              $('.alert-unique-name').hide();
            }

            player = generateNewPlayer(game, name);

            Meteor.subscribe('rounds', game._id)
            Meteor.subscribe('votes', game._id)
            Meteor.subscribe('playerVotes', game._id)

            Session.set("gameID", game._id);
            Session.set("playerID", player._id);
            Session.set("currentView", "lobby");
          });
        } else if (game) {
          Meteor.subscribe('players', game._id, function onReady() {
            var sameNamePlayer = Players.findOne({ gameID: game._id, name: name });
            $('.alert-unique-name').hide();
            if (sameNamePlayer) {
              $('.alert-game-started').hide();
              player = sameNamePlayer;
            } else {
              $('.alert-game-started').show();
            }

            Session.set("gameID", game._id);
            Session.set("playerID", player._id);
            Session.set("currentView", "lobby");
          });
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

      if (players.count() < 3) {
        $('.player-alert-5').show();
        $('.player-alert-10').hide();
        return false;
      }

      if (players.count() > 10) {
        $('.player-alert-10').show();
        $('.player-alert-5').hide();
        return false;
      }

      assignTurnOrder(players);
      players = Players.find({'gameID': game._id}, {'sort': {'ord': 1}});
      assignTeams(players);
      assignSpecialRoles(players, game);
      
      generateNewRound(game, 0);

      Games.update(game._id, {$set: {state: 'rolePhase'}});
    },
    "click .button-leave":function () {
      var game = getCurrentGame();
      Games.update(game._id, {$set: {numPlayers: game.numPlayers - 1}});
      Session.set("currentView", "startMenu");
      Players.remove(getCurrentPlayer()._id);
      Session.set("playerID", null);
      Session.set("gameID", null);
    },
    "click .displayHistory":function () {
      var game = getCurrentGame();
      Games.update(game._id, {$set: {displayHistory: ! game.displayHistory}});
    },
    "click .merlin":function () {
      var game = getCurrentGame();
      Games.update(game._id, {$set: {merlin: ! game.merlin}});
    },
    "click .assassin":function () {
      var game = getCurrentGame();
      Games.update(game._id, {$set: {assassin: ! game.assassin}});
    },
    "click .morgana":function () {
      var game = getCurrentGame();
      Games.update(game._id, {$set: {morgana: ! game.morgana}});
    },
    "click .percival":function () {
      var game = getCurrentGame();
      Games.update(game._id, {$set: {percival: ! game.percival}});
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
      var players = Players.find({'gameID': game._id}, {'sort': {'ord': 1}}).fetch();
      return players;
    },
    displayHistory: function () {
      return getCurrentGame().displayHistory;
    },
    merlin: function () {
      return getCurrentGame().merlin;
    },
    assassin: function () {
      return getCurrentGame().assassin;
    },
    morgana: function () {
      return getCurrentGame().morgana;
    },
    percival: function () {
      return getCurrentGame().percival;
    }
  });

  Template.score.helpers({
    game: function () {
      return getCurrentGame();
    },
    missionNum: function (object) {
      var game = getCurrentGame();
      var numPlayers = missionNumPlayers(object.hash.round, game.numPlayers);
      if (!numPlayers) {return null;}
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

  Template.roleInfo.helpers({
    player: function () {
      return getCurrentPlayer();
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
      var players = Players.find({'gameID': game._id}, {'sort': {'ord': 1}}).fetch();
      return players;
    },
    team: function () {
      return capitalize(getCurrentPlayer().team);
    },
    isSpy: function () {
      return (getCurrentPlayer().team === "spy");
    },
    isMerlin: function () {
      return (getCurrentPlayer().role === "merlin");
    },
    isAssassin: function () {
      return (getCurrentPlayer().role === "assassin");
    },
    isPercival: function () {
      return (getCurrentPlayer().role === "percival");
    },
    isMorgana: function () {
      return (getCurrentPlayer().role === "morgana");
    },
    possibleMerlins: function () {
      var result = [];
      var merlins =  Players.find({
        $and: [
          {'gameID': getCurrentGame()._id},
          {$or :[
            {'role': 'merlin'},
            {'role': 'morgana'}
          ] }
        ]
      }, {sort: {'name': 1}});

      merlins.forEach(function (player) {
        result.push(player.name);
      });

      return result.join(' or ');
    },
    allSpies: function () {
      var game = getCurrentGame();
      var currentPlayer = getCurrentPlayer();
      if (!game) { return null; }
      var players = Players.find({'gameID': game._id}, {'sort': {'ord': 1}}).fetch();
      var spies = [];

      players.forEach(function (player) {
        if (player.team === "spy" && player._id !== currentPlayer._id) {
          spies.push(player);
        }
      });

      return spies;
    }
  });

  Template.pickPhaseLeader.events({
    'click button':function () {
      var game = getCurrentGame();
      var numChosen = Players.find({'gameID': game._id, 'chosen': true}).count();
      var roundMax = missionNumPlayers(game.round, game.numPlayers)[0];
      if (numChosen == roundMax) {
        var currentVote = getCurrentVote();
        var chosen = [];
        Players.find({'gameID': game._id, 'chosen': true})
               .fetch()
               .forEach(function (player) {
          chosen.push(player.ord);
          var pv = PlayerVotes.findOne({voteID: currentVote._id, ord: player.ord});
          pv.classes.push("chosen");
          PlayerVotes.update(pv._id, { $set: { chosen: true, classes: pv.classes } });
        });
        Votes.update(currentVote._id, { $set: { chosen: chosen, status: "voting" }});
        Games.update(game._id, {$set: {state: "votingPhase"}});
      }
    }
  });

  Template.pickPhaseLeader.helpers({
    players: function () {
      var game = getCurrentGame();
      if (!game) { return null; }
      var players = Players.find({'gameID': game._id}, {'sort': {'ord': 1}}).fetch();
      return players;
    },
    pickMax: function () {
      var game = getCurrentGame();
      var numChosen = Players.find({'gameID': game._id, 'chosen': true}).count();
      var roundMax = missionNumPlayers(game.round, game.numPlayers)[0];
      return numChosen == roundMax;
    },
    voteRejected: function () {
      return getCurrentGame().voteRejected;
    }
  });

  Template.pickPhase.helpers({
    player: function () {
      return getCurrentPlayer();
    },
    leader: function () {
      return getCurrentGame().leader;
    },
    chosen: function () {
      return getCurrentPlayer().chosen;
    },
    chosenPlayers:function () {
      var game = getCurrentGame();
      var players = Players.find({'gameID': game._id, 'chosen': true}, {'sort': {'ord': 1}}).fetch();
      if (!players) { return null; }
      return players;
    },
    voteRejected: function () {
      return getCurrentGame().voteRejected;
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
      var players = Players.find({'gameID': game._id, 'chosen': true}, {'sort': {'ord': 1}}).fetch();
      return players;
    },
    playersCount: function () {
      var game = getCurrentGame();
      if (!game) { return null; }
      var players = Players.find({ $and: [{vote: {$ne: "accept"}}, {vote: {$ne: "reject"}} ]}).fetch();
      return players.length;
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
      var players = Players.find({'gameID': game._id, 'previousVote': 'accept'}, {'sort': {'ord': 1}}).fetch();
      return players;
    },
    rejectVoters: function () {
      var game = getCurrentGame();
      if (!game) { return null; }
      var players = Players.find({'gameID': game._id, 'previousVote': 'reject'}, {'sort': {'ord': 1}}).fetch();
      return players;
    },
    numSabotaged: function () {
      var game = getCurrentGame();
      if (!game) {return null; }
      if (game.prevResult[1] < 1) {
        return null;
      } else {
        if (game.prevResult[1] == 1) {
          return "1 spy";
        } else {
          return game.prevResult[1] + " spies";
        }
      }
    },
    missionResult: function () {
      var game = getCurrentGame();
      if (!game) {return null; }
      return (game.prevResult[0] === "fail" ? "failed" : "succeeded");
    },
    missionExists: function () {
      var game = getCurrentGame();
      if (!game) {return null;}
      return game.prevResult;
    }
  });

  Template.missionPhaseChosen.events({
    'click .button-pass':function () {
      var player = getCurrentPlayer();
      Players.update(player._id, {$set: {mission: "pass"}});
    },
    'click .button-fail':function () {
      var player = getCurrentPlayer();
      if (player.team === "spy") {
        Players.update(player._id, {$set: {mission: "fail"}});
      } else {
        Players.update(player._id, {$set: {mission: "pass"}});
      }
    }
  });

  Template.missionPhaseChosen.helpers({
    mission: function () {
      return getCurrentPlayer().mission;
    }
  });

  Template.assassinPhase.events({
    'click .assassinate': function () {
      var game = getCurrentGame();
      var merlin = Players.findOne({'gameID': getCurrentGame()._id, 'role': 'merlin'});
      var target = Players.findOne({'gameID': getCurrentGame()._id, 'assassinated': true});
      if (merlin._id === target._id) {
        Games.update(game._id, {$set: {winner: "spies"}});
      } else {
        Games.update(game._id, {$set: {winner: "resistance"}});
      }
    }
  });

  Template.assassinPhase.helpers({
    resistanceMembers: function () {
      return Players.find({'team': 'resistance', 'gameID': getCurrentGame()._id});
    }
  });

  Template.assassinPick.events({
    'click .player': function () {
      var player = Players.findOne({'gameID': getCurrentGame()._id, 'assassinated': true});
      if (player) { Players.update(player._id, {$set: {assassinated: false}}); }
      Players.update(this._id, {$set: {assassinated: true}});
    }
  });

  Template.assassinPick.helpers({
    chosen: function () {
      return this.assassinated;
    }
  });

  Template.specialGameOver.helpers({
    resistanceWins: function () {
      return (getCurrentGame().winner === "resistance");
    },
    destroyGame: function () {
      var game = getCurrentGame();
      setInterval(function () {
        Games.remove(game._id);
      }, 20000);
    }
  });

  Template.gameOver.helpers({
    destroyGame: function () {
      var game = getCurrentGame();
      setInterval(function () {
        Games.remove(game._id);
      }, 5000);
    }
  });

  Template.history.helpers({
    displayHistory: function() {
      var game = getCurrentGame();
      return game != null && game.displayHistory;
    },
    players: function() {
      return Players.find({'gameID': getCurrentGame()._id}, {'sort': {'ord': 1}});
    },
    rounds: function() {
      return Rounds.find({gameID: getCurrentGame()._id}, {sort: {'round': 1}});
    },
    votes: function() {
      return Votes.find({gameID: getCurrentGame()._id, roundID: this._id}, {sort: {'ord': 1}});
    },
    playerVotes: function() {
      return PlayerVotes.find({gameID: getCurrentGame()._id, voteID: this._id}, {sort: {'ord': 1}});
    },
    classList: function() {
      return this.classes.join(' ');
    },
    isCompleted: function() {
      return this.result == "fail" || this.result == "pass";
    },
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
    Games.remove({});
    Players.remove({});
    Rounds.remove({});
    Votes.remove({});
    PlayerVotes.remove({});
  });

  Meteor.publish('games', function(accessCode) {
    return Games.find({"accessCode": accessCode});
  });

  Meteor.publish('players', function(gameID) {
    return Players.find({"gameID": gameID});
  });

  Meteor.publish('rounds', function(gameID) {
    return Rounds.find({"gameID": gameID});
  });

  Meteor.publish('votes', function(gameID) {
    return Votes.find({"gameID": gameID});
  });

  Meteor.publish('playerVotes', function(gameID) {
    return PlayerVotes.find({"gameID": gameID});
  });
}


function generateNewGame() {
  var game = {
    accessCode: generateAccessCode(),
    numPlayers: 0,
    state: "lobby",
    turn: 0,
    round: 0,
    spyRoundsWon: 0,
    resRoundsWon: 0,
    displayHistory: true,
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
    ord: game.numPlayers,
  };

  var playerID = Players.insert(player);
  player = Players.findOne(playerID);
  return player;
}

function generateNewVote(game, round, leader) {
  var vote = {
    gameID: game._id,
    roundID: round._id,
    ord: Votes.find({roundID: round._id}).count(),
    leader: leader,
    status: "pending",
  }
  
  var voteID = Votes.insert(vote);
  var vote = Votes.findOne(voteID);

  var players = Players.find({'gameID': game._id}, {'sort': {'ord': 1}});
  players.forEach(function (player, index) {
    var playerVote = {
      gameID: game._id,
      roundID: round._id,
      voteID: voteID,
      ord: player.ord,
      classes: player.ord == leader ? ["leader"] : [],
    }
    PlayerVotes.insert(playerVote);
  });
}
function generateNewRound(game, leader) {
  var roundNum = game.round + 1;
  Games.update(game._id, {$set: {round: roundNum}});

  var round = {
    gameID: game._id,
    round: roundNum,
    fails: null,
    result: null,
  };

  var roundID = Rounds.insert(round);
  var round = Rounds.findOne(roundID);

  generateNewVote(game, round, leader);

  return round;
}

function getCurrentGame() {
  var gameID = Session.get("gameID");

  if (gameID) {
    return Games.findOne(gameID);
  }

  return null;
}

function getCurrentRound() {
  var game = getCurrentGame();

  if (game) {
    return Rounds.findOne({gameID: game._id, round: game.round});
  }

  return null;
}

function getCurrentVote() {
  var round = getCurrentRound();
  
  if(round) {
    var votes = Votes.find({'gameID': round.gameID, 'roundID': round._id}, { sort: {'ord': -1} }).fetch();
    return votes[0];
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

function capitalize(string) {
  return string.slice(0,1).toUpperCase() + string.slice(1);
}

function assignTurnOrder(players) {
  var turnOrder = [];

  for(var i = 0; i < players.count(); i++) {
      turnOrder.push(i);
  }

  shuffle(turnOrder);

  players.forEach(function (player, index) {
    Players.update(player._id, {$set: {
      ord: turnOrder.pop()
    }});
  });
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
               "resistance", "resistance", "resistance", "resistance", "res)istance", "resistance"];
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

function assignSpecialRoles(players, game) {
  var goodRoles = [];
  var evilRoles = [];
  var goodPlayers = [];
  var evilPlayers = [];

  if (game.merlin) {goodRoles.push("merlin");}
  if (game.assassin) {evilRoles.push("assassin");}
  if (game.morgana) {evilRoles.push("morgana");}
  if (game.percival) {goodRoles.push("percival");}

  players.forEach(function (player) {
    if (player.team == "resistance") {
      goodPlayers.push(player);
    } else {
      evilPlayers.push(player);
    }
  });

  shuffle(goodPlayers);
  shuffle(evilPlayers);

  for (var i = 0; i < goodRoles.length; i++) {
    Players.update(goodPlayers[i]._id, {$set: {role: goodRoles[i] }});
  }
  for (var j = 0; j < evilRoles.length; j++) {
    Players.update(evilPlayers[j]._id, {$set: {role: evilRoles[j] }});
  }
}

function trackGameState() {
  var gameID = Session.get("gameID");
  var playerID = Session.get("playerID");

  if (!gameID || !playerID){
    return;
  }

  var game = Games.findOne(gameID);
  if (!game) {
    return;
  }
  var player = Players.findOne(playerID);
  var players = Players.find({'gameID': game._id}, {'sort': {'ord': 1}});
  var leader = Players.findOne({
     $and: [
            { 'gameID' : game._id },
            { 'ord': game.turn % game.numPlayers }
          ]
   });
  updateLeader(leader, game);


  if (!game || !player){
    Session.set("gameID", null);
    Session.set("playerID", null);
    Session.set("currentView", "startMenu");
    return;
  }

  if(game.state === "rolePhase"){
    Session.set("currentView", "rolePhase");
  } else if (game.state === "votingPhase") {
    Games.update(game._id, {$set: {prevResult: "", voteRejected: false}});
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
  } else if (game.state === "assassinPhase") {
    if (player.role === "assassin"){
      Session.set("currentView", "assassinPhase");
    } else {
      Session.set("currentView", "assassinPhaseWait");
    }
  } else if (game.state === "gameOver") {
    Session.set("currentView", "gameOver");
  }

  if(!game.winner && game.assassin && game.resRoundsWon > 2){
    Games.update(game._id, {$set: {state: 'assassinPhase'}});
  } else if (!!game.winner) {
    Session.set("currentView", "specialGameOver");
  } else if (game.resRoundsWon > 2 || game.spyRoundsWon > 2 || game.result5) {
    Games.update(game._id, {$set: {state: 'gameOver'}});
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
      Games.update(game._id, {$set: {state: "pickPhase", turn: game.turn + 1, voteRejected: true }});
    }
  }
  if (game.state === "missionPhase" && !!missionFinished(players)){
    handleMissionResult(missionFinished(players));
    resetAll(players);
    // All players get here. Only run once.
    if (getCurrentPlayer().ord == 0
        && game.spyRoundsWon < 3 && game.resRoundsWon < 3) {
      generateNewRound(game, game.turn % game.numPlayers);
    }
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
  var currentVote = getCurrentVote();

  players.forEach(function (player) {
    var pv = PlayerVotes.findOne({voteID: currentVote._id, ord: player.ord});
    pv.classes.push(player.vote);
    PlayerVotes.update(pv._id, { $set: { vote: player.vote, classes: pv.classes } });

    Players.update(player._id, { $set: { previousVote: player.vote }});
  });
  // This function gets called for every player, but we only want to do
  // this once.
  if (getCurrentPlayer().ord == 0) {
    if (allVoted(players) == "accept") {
      Votes.update(currentVote._id, { $set: { status: "accept-pending" }});
    } else {
      Votes.update(currentVote._id, { $set: { status: "reject" }});

      var game = getCurrentGame();
      var newLeader = currentVote.leader + 1 % game.numPlayers;
      generateNewVote(game, getCurrentRound(), newLeader);
    }
  }
}

function resetVotes(players) {
  players.forEach(function (player) {
    Players.update(player._id, { $set: { vote: "" }});
  });
}

function updateLeader(player, game) {
  Games.update(game._id, {$set: {"leader": player.name}});
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
    var round = getCurrentRound();
    var resString = fail < numToFail ? "pass" : "fail";
    Rounds.update(round._id, { $set: { result: resString, fails: fail } });
    var vote = getCurrentVote();
    Votes.update(vote._id, { $set: { status: resString } });
    return ( fail >= numToFail ? fail : "pass");
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
  if (result == "pass") {
    result = ["pass", null];
    Games.update(game._id, {$set: {resRoundsWon: game.resRoundsWon + 1}});
  } else {
    result = ["fail", result];
    Games.update(game._id, {$set: {spyRoundsWon: game.spyRoundsWon + 1}});
  }
  query[param] = result[0];
  Games.update(game._id, {$set: {state: "pickPhase", round: game.round + 1, prevResult: result}});
  Games.update(game._id, {$set: query});
}
