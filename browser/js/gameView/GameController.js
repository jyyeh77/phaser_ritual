app.controller('GameController', function ($scope, $localStorage, showGame, GameFactory) {
  // display game upon transition to game view
  $scope.showGame = showGame

  // show in-game menu on clicking Menu option in nav-bar
  $scope.showMenu = () => {
    return GameFactory.getMenuView()
  }

  // removes erroneous 'second' game view on page refresh
  $scope.$on('$destroy', () => {
    $scope.showGame = !$scope.showGame
  })
})
