app.config(function ($stateProvider) {
  $stateProvider.state('master.navbar.tasks', {
    url: '/tasks',
    templateUrl: 'js/tasks/tasks.html',
    controller: 'TaskCtrl',
    resolve: {
      Tasks: function (TaskFactory) {
        return TaskFactory.fetchAllTasks()
      }
    }
  })
})
