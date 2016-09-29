app.directive('task', function ($rootScope, AuthService, AUTH_EVENTS, $state) {
  return {
    restrict: 'E',
    scope: {
      task: '=task'
    },
    templateUrl: 'js/tasks/tasks-directive.html',
    link: function (scope) {}
  }
})
