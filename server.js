
'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var _ = require('lodash');
var debug = require('debug')('io');
debug('booting %s', 'Test App');
/**
 * Main application file
 */
var drafts = [];
var HEROES = {
  Aisling: 'Aisling',
	Beckett: 'Beckett',
  Charnok: 'Charnok',
  Griselma: 'Griselma',
  HK: 'HK',
  Imani: 'Imani',
  Knossos: 'Knossos',
  Margrave: 'Margrave',
  Mozu: 'Mozu',
  Sven: 'Sven',
  Tripp: 'Tripp',
  Tyto: 'Tyto',
  Vadasi: 'Vadasi',
  Voden: 'Voden',
  Wu: 'Wu',
  Xenobia: 'Xenobia',
  None: 'None'
};
var TEAMS = {BanTeamA: -1, BanTeamB: -2, TeamA: 1, TeamB: 2};

var DRAFT_FORMATS = {
  gigantor: [-2, -1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2]
};

// Set default node environment to development
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var config = require('./lib/config/config');

// Setup Express
require('./lib/config/express')(app);
require('./lib/routes')(app);

// Start server
http.listen(config.port, config.ip, function () {
  console.log('Express server listening on %s:%d, in %s mode', config.ip, config.port, app.get('env'));
});

app.get('/drafts', function(req, res) {
	res.send(_.pluck(drafts, 'name'));
});

// Expose app
exports = module.exports = app;

function Draft(name, format, timeLimit) {
  format = format || 'gigantor';
	this.name = name || 'Room';
  this.timeLimit = timeLimit;
	this.team1 = [];
	this.team2 = [];
	this.pool = _.toArray(HEROES);
	this.bans = [];
	this.team1User = {}; //A socket
	this.team2User = {};
	this.sequenceIndex = 0;
	this.draftSequence = DRAFT_FORMATS[format] || DRAFT_FORMATS.gigantor; //[-1, -2, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2]; //1 = glory, 2 = valor, negative = ban
	this.emitTeams = function() {
		io.to(this.name).emit('teams', {
			team1: this.team1,
			team2: this.team2,
			pool: this.pool,
			bans: this.bans,
			currentTurn: this.draftSequence[this.sequenceIndex],
      timeLimit: timeLimit
		});
	};
	this.emitSeats = function() {
		io.to(this.name).emit('sit', {
			teamaUser: this.team1User.username,
			teambUser: this.team2User.username
		});
	};
}

function cleanRooms() {
	var currentRooms = io.sockets.adapter.rooms;
	var hasChanges = false;
	_.forEachRight(drafts, function(draft) {
		var hasUser = false;
		for (var key in currentRooms[draft.name]) {
			hasUser = true;
			break;
		}
		
		if (!hasUser) {
			_.pull(drafts, draft);
			hasChanges = true;
		}
	});
	if (hasChanges) {
		io.emit('drafts', {drafts: _.pluck(drafts, 'name')});
	}
}

function getDraft(name) {
	return _.where(drafts, {name: name})[0];
}

function getTeam(team) {
	switch (team.toString().toLowerCase()) {
		case '-1' || 'banteama':
			return TEAMS.BanTeamA;
		case '-2' || 'banteamb':
			return TEAMS.BanTeamB;
		case '1' || 'teama':
			return TEAMS.TeamA;
		case '2' || 'teamb':
			return TEAMS.TeamB;
	}
}

function pickHero(draft, team, hero) {
	if (team === TEAMS.TeamA) {
		if (!_.find(draft.team1, hero) && draft.team1.indexOf(hero) < 0) 
			{draft.team1.push(hero);}
	} else if (team === TEAMS.TeamB) {
		if (!_.find(draft.team2, hero) && draft.team2.indexOf(hero) < 0) 
		{
			draft.team2.push(hero);
		}
	} else if (team === TEAMS.BanTeamA || team === TEAMS.BanTeamB) {
		if (!_.find(draft.bans, hero)) {
			draft.bans.push(hero);
			if(hero != HEROES.None)
			{	
				draft.pool.splice(draft.pool.indexOf(hero), 1);
			}
			
		}
	}

	//_.pull(draft.pool, hero);

	draft.sequenceIndex++;
	if(draft.sequenceIndex == 2)
	{
		draft.pool.splice(draft.pool.indexOf(HEROES.None), 1);
	}
	if (draft.sequenceIndex >= draft.draftSequence.length) {
		console.log('Draft Complete: ' + draft.team1User.username + ' vs ' + draft.team2User.username + '\nTeamA: ' + draft.team1 + '\nTeamB: ' + draft.team2 + '\nBans: ' + draft.bans);
	}
}

io.on('connection', function(socket) {
	socket.on('register', function(data) {
		this.username = data.username;
		console.log('registered ' + this.username + ' id: ' + this.id);
	});

	socket.on('join', function(data) {
		if (!data.name) {return;}
		var joinedDraft = getDraft(data.name);

		if (!joinedDraft) {
			drafts.push(new Draft(data.name, data.format, data.timeLimit));
			io.emit('drafts', {drafts: _.pluck(drafts, 'name')});
			joinedDraft = getDraft(data.name);
		}

		this.leave(data.leaving);
		this.join(data.name);

		joinedDraft.emitTeams();
		joinedDraft.emitSeats();
	});

	socket.on('leave', function(data) {
		var draft = getDraft(data.leaving);
		this.leave(data.leaving);
		cleanRooms();
	});

	socket.on('pick', function(data) {
		if (!data.hero || !data.team || !data.draft) {return;}
		var draft = getDraft(data.draft);
		if (draft.sequenceIndex >= draft.draftSequence.length) {return;}
		var team = getTeam(data.team);
		if (draft.draftSequence[draft.sequenceIndex] !== team) {return;}

		pickHero(draft, team, data.hero);

		draft.emitTeams();
	});

	socket.on('sit', function(data) {
		if (!data.draft || !data.team) {return;}
		var draft = getDraft(data.draft);
		var team = getTeam(data.team);

		var userSocket = data.unsit ? {} : this;

		if (team === TEAMS.TeamA) {
			draft.team1User = userSocket;
		} else if (team === TEAMS.TeamB) {
			draft.team2User = userSocket;
		}

		draft.emitSeats();
	});

	socket.on('reset', function(data) {
		if (!data.draft) {return;}
		var draft = getDraft(data.draft);
		draft.team1 = [];
		draft.team2 = [];
		draft.pool = _.toArray(HEROES);
		draft.emitTeams();
	});

	socket.on('disconnect', function() {
		cleanRooms();
	});
});
