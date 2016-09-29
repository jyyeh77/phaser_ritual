app.controller('TaskCtrl', function ($scope, AuthService, $state, TaskFactory, Tasks, $rootScope) {
  $scope.showTask = false
  $scope.customError = false
  $scope.errormsg = []

  Tasks.sort(function (a, b) {
    return b.startTime < a.startTime ? 1 : -1
  })

  console.log(Tasks)

  $scope.tasks = Tasks

  $rootScope.socket.on('updateTasks', function (userId) {
    AuthService.getLoggedInUser().then(function (user) {
      if (user.id === userId.userId) {
        TaskFactory.fetchAllTasks()
          .then(function (allTasks) {
            allTasks.sort(function (a, b) {
              return b.startTime < a.startTime ? 1 : -1
            })
            $scope.tasks = allTasks
          })
          .catch(function (error) {
            $scope.error = 'Could not update tasks.'
            console.log('Error creating task.')
          })
      }
    })
  })

  $scope.createTask = function (taskInfo) {
    TaskFactory.createATask(taskInfo)
      .then(function (createdTask) {
        $scope.updateTasks()
        $scope.clearFields()
      })
      .catch(function (error) {
        $scope.error = 'Could not create task.'
        console.log('Error creating task.')
      })
  }

  $scope.updateTasks = function () {
    TaskFactory.fetchAllTasks()
      .then(function (allTasks) {
        allTasks.sort(function (a, b) {
          return b.startTime < a.startTime ? 1 : -1
        })
        $scope.tasks = allTasks
        $scope.toggleCreateTask()
      })
      .catch(function (error) {
        $scope.error = 'Could not update tasks.'
        console.log('Error creating task.')
      })
  }

  $scope.toggleCreateTask = function () {
    $scope.showTask = !$scope.showTask
  }

  $scope.clearFields = function () {
    $scope.task.title = ''
    $scope.task.lhour = null
    $scope.task.lminute = null
    $scope.task.hour = null
    $scope.task.minute = null
  }

  $scope.checkFields = function () {
    $scope.customError = false
    $scope.errormsg = []
    if (($scope.task.hour < 1 || $scope.task.hour > 12) || ($scope.task.minute < 0 || $scope.task.minute > 59)) {
      $scope.errormsg.push('Please enter a real start time.')
      $scope.customError = true
    }
    if (($scope.task.lhour > 11 || $scope.task.lhour < 0) || ($scope.task.lminute < 0 || $scope.task.lhour > 59)) {
      $scope.errormsg.push('All durations must be under 12 hours, and more than 0 minutes.')
      $scope.customError = true
    }

    return $scope.customError
  }
})
