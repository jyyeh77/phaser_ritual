// for retrieving game state

app.factory('GameFactory', function ($http) {
  let GameFactory = {}
  let gameState = null

  // gets game state object from db upon user login
  GameFactory.getUserState = () => {
    if (!gameState) {
      return $http.get('/api/gamestate')
        .then(res => {
          gameState = res.data
          return res.data
        })
    } else {
      return gameState
    }
  }

  // on logout, reset gameState
  GameFactory.clearUserState = () => {
    gameState = null
  }

  return GameFactory
})
