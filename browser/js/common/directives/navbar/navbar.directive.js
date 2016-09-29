app.directive('navbar', function ($rootScope, Socket, AuthService, AUTH_EVENTS, $state) {
  return {
    restrict: 'E',
    scope: {},
    templateUrl: 'js/common/directives/navbar/navbar.html',
    link: function (scope) {
      scope.items = [
        {label: 'Account Settings', state: 'master.navbar.signup-settings', auth: true},
        {label: 'Tasks', state: 'master.navbar.tasks', auth: true}
      ]

      scope.user = null

      $rootScope.socket = Socket

      scope.isLoggedIn = function () {
        return AuthService.isAuthenticated()
      }

      scope.logout = function () {
        AuthService.logout().then(function () {
          $state.go('master.navbar.home')
        })
      }

      var setUser = function () {
        AuthService.getLoggedInUser().then(function (user) {
          scope.user = user
          if (user) $state.go('master.navbar.tasks')
        })
      }

      var removeUser = function () {
        scope.user = null
      }

      setUser()

      $rootScope.$on(AUTH_EVENTS.loginSuccess, setUser)
      $rootScope.$on(AUTH_EVENTS.logoutSuccess, removeUser)
      $rootScope.$on(AUTH_EVENTS.sessionTimeout, removeUser)
    }

  }
})
