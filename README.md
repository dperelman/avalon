# Resistance: Avalon

The Resistance: Avalon - on your mobile device!

The Resistance is a party game of social deduction designed by Don Eskridge. It is designed for five to ten players, lasts about 30 minutes, and has no player elimination. The Resistance is inspired by Mafia/Werewolf, yet it is unique in its core mechanics, which increase the resources for informed decisions, intensify player interaction, and eliminate player elimination.

##Disclaimer

[Resistance: Avalon](https://boardgamegeek.com/boardgame/128882/resistance-avalon) is a social deduction game designed by Don Eskridge. This is an unofficial fan project designed to complement the physical game, and is not endorsed in any way by the designer or publisher. I encourage everyone to go out and pick up a copy of the game.

[Click here to play!](http://www.resistance-avalon.com)

Built using:

  * Meteor
  * Javascript
  * MongoDB
  * CSS and HTML
  * Spacebars

## Key Features

**Mobile Design/Compatibility** This web app was designed to be primarily used on a mobile app. It features clean design and friendly mobile interface. Is also responsive and can be played on any screen size.

**Multiple Rooms** Asynchronously handles requests from multiple users in multiple rooms. Uses Meteor's publish and subscribe pattern to deliver information to the right users.

**Reactive Objects** Keeps users synched up by having users listen to reactive objects. Certain players are given permission to the game state (as per the game's rules) while everyone else's views react to the game state.
