app.config(function ($stateProvider) {
  $stateProvider.state('master.navbar.game', {
    url: '/game',
    templateUrl: 'js/gameView/gameView.html',
    controller: 'GameController',
    resolve: {
      showGame: function () {
        return true
      }
    }
  })
})

