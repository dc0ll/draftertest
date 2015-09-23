'use strict';

angular.module('giganticDrafterApp', [
  'ngCookies',
  'ngResource',
  'ngSanitize',
  'ngRoute',
  'akoenig.deckgrid'
])
  .config(function($routeProvider, $locationProvider) {
    $routeProvider
      .when('/', {
        templateUrl: 'partials/main',
        controller: 'MainCtrl'
      })
      .otherwise({
        redirectTo: '/'
      });

    $locationProvider.html5Mode(true);
  });