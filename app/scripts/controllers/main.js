'use strict';

angular.module('giganticDrafterApp')
  .factory('socket', function($rootScope) {
      var socket = io();
      return {
        on: function(eventName, callback) {
          socket.on(eventName, function() {
            var args = arguments;
            $rootScope.$apply(function() {
              callback.apply(socket, args);
            });
          });
        },
        emit: function(eventName, data, callback) {
          socket.emit(eventName, data, function() {
            var args = arguments;
            $rootScope.$apply(function() {
              if (callback) {
                callback.apply(socket, args);
              }
            });
          });
        }
      };
    })
  .controller('MainCtrl', function($scope, $http, $timeout, socket) {
    $scope.TEAMS = {BanTeamA: -1, BanTeamB: -2, TeamA: 1, TeamB: 2};

    $scope.bans = ['Tyto', 'Tripp'];
    $scope.draftFormat = 'gigantor';
    $scope.timePerTurn = 60;
    var timerPromise;
    $scope.username = localStorage.username || 'User' + Math.floor(Math.random()*1000);
    if (localStorage.username && localStorage.username.indexOf('User') === 0) {
      $scope.firstLogin = true;
    }
    // $http.get('/teams').success(function(teams) {
    //   $scope.setTeams(teams);
    // });
    $http.get('/drafts').success(function(drafts) {
      $scope.drafts = drafts;
    });

    $scope.$watch('username', function() {
      localStorage.username = $scope.username;
      socket.emit('register', {username: $scope.username});
    });

    $scope.login = function() {
      $scope.firstLogin = false;
    };

    $scope.setTeams = function(teams) {
      $scope.team1 = teams.team1;
      $scope.team2 = teams.team2;
      $scope.pool = teams.pool;
      $scope.bans = teams.bans;
      $scope.currentTurn = teams.currentTurn;
      if ($scope.bans && $scope.bans.length > 0 && teams.timeLimit) {restartTimer(teams.timeLimit);} //If draft has started
    };

    $scope.handleClick = function(hero) {
      var currentTeam = getTeam($scope.currentTeam);

      if (currentTeam === $scope.TEAMS.TeamA) {
        if ($scope.team1.length > 4) {return;}
      } else {
        if ($scope.team2.length > 4) {return;}
      }

      if (currentTeam === Math.abs($scope.currentTurn)) {
		  if(currentTeam === $scope.TEAMS.TeamA)
		  {
			if($scope.team1.indexOf(hero) < 0)
				{socket.emit('pick', {hero: hero, team: $scope.currentTurn, draft: $scope.currentDraft});}
		  }
		  else
		  {
			if($scope.team2.indexOf(hero) < 0)
				{socket.emit('pick', {hero: hero, team: $scope.currentTurn, draft: $scope.currentDraft});}
		  }
      }
    };

    $scope.reset = function() {
      socket.emit('reset', {draft: $scope.currentDraft});
    };

    $scope.startDraftCreation = function() {
      $scope.creatingDraft = true;
    };

    $scope.joinDraft = function(draft) {
      var oldDraft = $scope.currentDraft;
      $scope.currentDraft = draft;
      stopTimer();
      socket.emit('join', {name: draft, leaving: oldDraft});
    };

    $scope.createDraft = function() {
      $scope.currentDraft = $scope.draftCreate;
      stopTimer();
      var timeLimit;
      if ($scope.useTimer && !!parseInt($scope.timePerTurn) && parseInt($scope.timePerTurn) > 0) {
        timeLimit = parseInt($scope.timePerTurn);
      }
      socket.emit('join', {name: $scope.draftCreate, format: $scope.draftFormat, timeLimit: timeLimit});
      $scope.creatingDraft = false;
    };

    $scope.sitTeamA = function() {
      $scope.leaveSeat();
      $scope.currentTeam = $scope.TEAMS.TeamA;
      socket.emit('sit', {
        draft: $scope.currentDraft,
        team: $scope.currentTeam
      });
    };

    $scope.sitTeamB = function() {
      $scope.leaveSeat();
      $scope.currentTeam = $scope.TEAMS.TeamB;
      socket.emit('sit', {
        draft: $scope.currentDraft,
        team: $scope.currentTeam
      });
    };

    $scope.displayTeam = function(team) {
      switch (Math.abs(team)) {
        case $scope.currentTeam:
          return 'Your';
        case $scope.TEAMS.TeamA:
          return 'TeamA';
        case $scope.TEAMS.TeamB:
          return 'TeamB';
      }
    };

    $scope.displayPickBan = function(team) {
      if (!team) {return 'Draft Complete';}
      if (team < 0) {
        return 'Ban';
      } else {
        return 'Pick';
      }
    };

    $scope.displayTimer = function(team) {
      if (!team) {
        return 'hidden';
      }
    };

    $scope.getAllyEnemyStatus = function(team) {
      if (!$scope.currentTeam || !team) {return '';}

      if ($scope.currentTeam === Math.abs(team)) {
        return 'draft-ally';
      } else {
        return 'draft-enemy';
      }
    };

    $scope.leaveSeat = function() {
      if ($scope.currentTeam) {
        socket.emit('sit', {
          draft: $scope.currentDraft,
          team: $scope.currentTeam,
          unsit: true
        });
        $scope.currentTeam = '';
      }
    };

    $scope.leaveDraft = function() {
      $scope.leaveSeat();
      socket.emit('leave', {leaving: $scope.currentDraft});
      $scope.currentDraft = '';
    };

    socket.on('reconnect', function() {
      socket.emit('register', {username: $scope.username});
    });

    socket.on('teams', function(data) {
      $scope.setTeams(data);
    });

    socket.on('drafts', function(data) {
      $scope.drafts = data.drafts;
    });

    socket.on('sit', function(data) {
      $scope.teamaUser = data.teamaUser;
      $scope.teambUser = data.teambUser;
    });

    function restartTimer(timeLimit) {
      $scope.timeLimit = timeLimit;
      stopTimer();
      countdown();
    }

    function countdown() {
      timerPromise = $timeout(function() {
        $scope.draftTimer--;
        if ($scope.draftTimer < 1) {
          handleEndOfTimer();
        } else {
          countdown();
        }
      }, 1000);
    }

    function stopTimer() {
      $timeout.cancel(timerPromise);
      $scope.draftTimer = $scope.timeLimit;
    }

    function handleEndOfTimer() {
      if (getTeam($scope.currentTeam) === Math.abs($scope.currentTurn)) {
        var randomHero = $scope.pool[Math.floor(Math.random() * $scope.pool.length)];
        $scope.handleClick(randomHero);
      }
    }

    function getTeam(team) {
      if (!team) {return;}
      switch (team.toString().toLowerCase()) {
        case '-1' || 'banteama':
          return $scope.TEAMS.BanTeamA;
        case '-2' || 'banteamb':
          return $scope.TEAMS.BanTeamB;
        case '1' || 'teama':
          return $scope.TEAMS.TeamA;
        case '2' || 'teamb':
          return $scope.TEAMS.TeamB;
      }
    }
  })
  .directive('editInline', function($window) {
    return function(scope, element) {
      // a method to update the width of an input
      // based on it's value.
      var updateWidth = function() {
        // create a dummy span, we'll use this to measure text.
        var tester = angular.element('<span>'),

          // get the computed style of the input
          elemStyle = $window.document.defaultView
          .getComputedStyle(element[0], '');

        // apply any styling that affects the font to the tester span.
        tester.css({
          'font-family': elemStyle.fontFamily,
          'line-height': elemStyle.lineHeight,
          'font-size': elemStyle.fontSize,
          'font-weight': elemStyle.fontWeight
        });

        // update the text of the tester span
        tester.text(element.val());

        // put the tester next to the input temporarily.
        element.parent().append(tester);

        // measure!
        var r = tester[0].getBoundingClientRect();
        var w = Math.max(20, r.width);

        // apply the new width!
        element.css('width', w + 'px');

        // remove the tester.
        tester.remove();
      };

      // initalize the input
      $window.setTimeout(updateWidth, 0);

      // do it on keydown so it updates "real time"
      element.bind('keydown', function() {

        // set an immediate timeout, so the value in
        // the input has updated by the time this executes.
        $window.setTimeout(updateWidth, 0);
      });

    };
  });