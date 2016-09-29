'use strict'

window.app = angular.module('Ritual', ['fsaPreBuilt', 'ui.router', 'ui.bootstrap', 'ngAnimate'])

app.config(function ($urlRouterProvider, $locationProvider) {
  // This turns off hashbang urls (/#about) and changes it to something normal (/about)
  $locationProvider.html5Mode(true)
  // If we go to a URL that ui-router doesn't have registered, go to the "/" url.
  $urlRouterProvider.otherwise('/')
  // Trigger page refresh when accessing an OAuth route
  $urlRouterProvider.when('/auth/:provider', function () {
    window.location.reload()
  })
})

// This app.run is for controlling access to specific states.
app.run(function ($rootScope, AuthService, $state) {
  // The given state requires an authenticated user.
  var destinationStateRequiresAuth = function destinationStateRequiresAuth (state) {
    return state.data && state.data.authenticate
  }

  // $stateChangeStart is an event fired
  // whenever the process of changing a state begins.
  $rootScope.$on('$stateChangeStart', function (event, toState, toParams) {
    if (!destinationStateRequiresAuth(toState)) {
      // The destination state does not require authentication
      // Short circuit with return.
      return
    }

    if (AuthService.isAuthenticated()) {
      // The user is authenticated.
      // Short circuit with return.
      return
    }

    // Cancel navigating to new state.
    event.preventDefault()

    AuthService.getLoggedInUser().then(function (user) {
      // If a user is retrieved, then renavigate to the destination
      // (the second time, AuthService.isAuthenticated() will work)
      // otherwise, if no user is logged in, go to "login" state.
      if (user) {
        $state.go(toState.name, toParams)
      } else {
        $state.go('login')
      }
    })
  })
})

app.config(function ($stateProvider) {
  $stateProvider.state('master.navbar.docs', {
    url: '/docs',
    templateUrl: 'js/docs/docs.html'
  })
})
; (function () {
  'use strict'

  // Hope you didn't forget Angular! Duh-doy.

  if (!window.angular) throw new Error("I can't find Angular!")

  var app = angular.module('fsaPreBuilt', [])

  app.factory('Socket', function () {
    if (!window.io) throw new Error('socket.io not found!')
    return window.io(window.location.origin)
  })

  // AUTH_EVENTS is used throughout our app to
  // broadcast and listen from and to the $rootScope
  // for important events about authentication flow.
  app.constant('AUTH_EVENTS', {
    loginSuccess: 'auth-login-success',
    loginFailed: 'auth-login-failed',
    logoutSuccess: 'auth-logout-success',
    sessionTimeout: 'auth-session-timeout',
    notAuthenticated: 'auth-not-authenticated',
    notAuthorized: 'auth-not-authorized'
  })

  app.factory('AuthInterceptor', function ($rootScope, $q, AUTH_EVENTS) {
    var statusDict = {
      401: AUTH_EVENTS.notAuthenticated,
      403: AUTH_EVENTS.notAuthorized,
      419: AUTH_EVENTS.sessionTimeout,
      440: AUTH_EVENTS.sessionTimeout
    }
    return {
      responseError: function responseError (response) {
        $rootScope.$broadcast(statusDict[response.status], response)
        return $q.reject(response)
      }
    }
  })

  app.config(function ($httpProvider) {
    $httpProvider.interceptors.push(['$injector', function ($injector) {
      return $injector.get('AuthInterceptor')
    }])
  })

  app.service('AuthService', function ($http, Session, $rootScope, AUTH_EVENTS, $q) {
    function onSuccessfulLogin (response) {
      var data = response.data
      Session.create(data.id, data.user)
      $rootScope.$broadcast(AUTH_EVENTS.loginSuccess)
      return data.user
    }

    // Uses the session factory to see if an
    // authenticated user is currently registered.
    this.isAuthenticated = function () {
      return !!Session.user
    }

    this.getLoggedInUser = function (fromServer) {
      // If an authenticated session exists, we
      // return the user attached to that session
      // with a promise. This ensures that we can
      // always interface with this method asynchronously.

      // Optionally, if true is given as the fromServer parameter,
      // then this cached value will not be used.

      if (this.isAuthenticated() && fromServer !== true) {
        return $q.when(Session.user)
      }

      // Make request GET /session.
      // If it returns a user, call onSuccessfulLogin with the response.
      // If it returns a 401 response, we catch it and instead resolve to null.
      return $http.get('/session').then(onSuccessfulLogin).catch(function () {
        return null
      })
    }

    this.login = function (credentials) {
      return $http.post('/login', credentials).then(onSuccessfulLogin).catch(function () {
        return $q.reject({ message: 'Invalid login credentials.' })
      })
    }

    this.logout = function () {
      return $http.get('/logout').then(function () {
        Session.destroy()
        $rootScope.$broadcast(AUTH_EVENTS.logoutSuccess)
      })
    }
  })

  app.service('Session', function ($rootScope, AUTH_EVENTS) {
    var self = this

    $rootScope.$on(AUTH_EVENTS.notAuthenticated, function () {
      self.destroy()
    })

    $rootScope.$on(AUTH_EVENTS.sessionTimeout, function () {
      self.destroy()
    })

    this.id = null
    this.user = null

    this.create = function (sessionId, user) {
      this.id = sessionId
      this.user = user
    }

    this.destroy = function () {
      this.id = null
      this.user = null
    }
  })
})()

app.config(function ($stateProvider) {
  $stateProvider.state('master.navbar.home', {
    url: '/',
    templateUrl: 'js/home/home.html'
  })
})

app.controller('LoginCtrl', function ($scope, AuthService, $state) {
  $scope.login = {}
  $scope.error = null

  $scope.sendLogin = function (loginInfo) {
    $scope.error = null

    AuthService.login(loginInfo).then(function () {
      $state.go('master.navbar.tasks')
    }).catch(function () {
      $scope.error = 'Invalid login credentials.'
    })
  }
})

app.config(function ($stateProvider) {
  $stateProvider.state('master.navbar.login', {
    url: '/login',
    templateUrl: 'js/login/login.html',
    controller: 'LoginCtrl'
  })
})

app.config(function ($stateProvider) {
  $stateProvider.state('master', {
    templateUrl: 'js/master/master.html',
    controller: function controller ($scope, $state) {
      $state.go('master.navbar.home')
    }
  })
})

app.config(function ($stateProvider) {
  $stateProvider.state('membersOnly', {
    url: '/members-area',
    template: '<img ng-repeat="item in stash" width="300" ng-src="{{ item }}" />',
    controller: function controller ($scope, SecretStash) {
      SecretStash.getStash().then(function (stash) {
        $scope.stash = stash
      })
    },
    // The following data.authenticate is read by an event listener
    // that controls access to this state. Refer to app.js.
    data: {
      authenticate: true
    }
  })
})

app.factory('SecretStash', function ($http) {
  var getStash = function getStash () {
    return $http.get('/api/members/secret-stash').then(function (response) {
      return response.data
    })
  }

  return {
    getStash: getStash
  }
})

app.controller('SignupCtrl', function ($scope, AuthService, $state, SignupFactory) {
  $scope.createUser = function (signupInfo) {
    $scope.error = null

    SignupFactory.createUser(signupInfo).then(function () {
      AuthService.login(signupInfo).then(function () {
        $state.go('master.navbar.signup-settings')
      }).catch(function () {
        $scope.error = 'Invalid login credentials.'
      })
    }).catch(function () {
      $scope.error = 'Could not create account.'
    })
  }
})

'use strict'

app.directive('equals', function () {
  return {
    restrict: 'A', // only activate on element attribute
    require: '?ngModel', // get a hold of NgModelController
    link: function link (scope, elem, attrs, ngModel) {
      if (!ngModel) return // do nothing if no ng-model

      // watch own value and re-validate on change
      scope.$watch(attrs.ngModel, function () {
        validate()
      })

      // observe the other value and re-validate on change
      attrs.$observe('equals', function (val) {
        validate()
      })

      var validate = function validate () {
        // values
        var val1 = ngModel.$viewValue
        var val2 = attrs.equals

        // set validity
        ngModel.$setValidity('equals', !val1 || !val2 || val1 === val2)
      }
    }
  }
})

app.factory('SignupFactory', function ($http, $log, $q) {
  return {
    createUser: function createUser (signupInfo) {
      return $http.post('/api/signup', signupInfo).then(function () {
        return $q.resolve({ message: 'User created!' })
      }).catch(function () {
        return $q.resolve({ message: 'Unable to create user.' })
      })
    }
  }
})

app.config(function ($stateProvider) {
  $stateProvider.state('master.navbar.signup', {
    url: '/signup',
    templateUrl: 'js/signup/signup.html',
    controller: 'SignupCtrl'
  })
})

app.controller('SignupSettingsCtrl', function ($scope, AuthService, $state, SignupSettingsFactory) {
  $scope.week = [{ selected: false, name: 'Mo', number: 0 }, { selected: false, name: 'Tu', number: 1 }, { selected: false, name: 'We', number: 2 }, { selected: false, name: 'Th', number: 3 }, { selected: false, name: 'Fr', number: 4 }, { selected: false, name: 'Sa', number: 5 }, { selected: false, name: 'Su', number: 6 }]

  $scope.isOptionsRequired = function () {
    return $scope.week.some(function (options) {
      return options.selected
    })
  }

  $scope.createSettings = function (settingsInfo) {
    var myWorkdays = []

    $scope.week.forEach(function (elem) {
      if (elem.selected === true) {
        myWorkdays.push(elem.number)
      }
    })

    var toBeSent = {
      waketime: settingsInfo.waketime + ' AM',
      workdays: myWorkdays
    }

    SignupSettingsFactory.createSettings(toBeSent).then(function (createdSettings) {
      $state.go('master.navbar.tasks')
    }).catch(function () {
      $scope.error = 'Could not create settings.'
      console.log('Error creating task.')
    })
  }
})

app.factory('SignupSettingsFactory', function ($http, $log, $q) {
  return {
    createSettings: function createSettings (settingsInfo) {
      return $http.post('/api/settings', settingsInfo).then(function () {
        return $q.resolve({ message: 'Settings created!' })
      }).catch(function () {
        return $q.resolve({ message: 'Unable to create settings.' })
      })
    }
  }
})

app.config(function ($stateProvider) {
  $stateProvider.state('master.navbar.signup-settings', {
    url: '/signup-settings',
    templateUrl: 'js/signup-settings/signup-settings.html',
    controller: 'SignupSettingsCtrl'
  })
})

app.directive('task', function ($rootScope, AuthService, AUTH_EVENTS, $state) {
  return {
    restrict: 'E',
    scope: {
      task: '=task'
    },
    templateUrl: 'js/tasks/tasks-directive.html',
    link: function link (scope) {}
  }
})

app.controller('TaskCtrl', function ($scope, AuthService, $state, TaskFactory, Tasks) {
  $scope.showTask = false
  $scope.customError = false
  $scope.errormsg = []

  Tasks.sort(function (a, b) {
    return b.startTime < a.startTime ? 1 : -1
  })

  console.log(Tasks)

  $scope.tasks = Tasks

  $scope.createTask = function (taskInfo) {
    TaskFactory.createATask(taskInfo).then(function (createdTask) {
      $scope.updateTasks()
      $scope.clearFields()
    }).catch(function (error) {
      $scope.error = 'Could not create task.'
      console.log('Error creating task.')
    })
  }

  $scope.updateTasks = function () {
    TaskFactory.fetchAllTasks().then(function (allTasks) {
      allTasks.sort(function (a, b) {
        return b.startTime < a.startTime ? 1 : -1
      })
      $scope.tasks = allTasks
      $scope.toggleCreateTask()
    }).catch(function (error) {
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
    if ($scope.task.hour < 1 || $scope.task.hour > 12 || $scope.task.minute < 0 || $scope.task.minute > 59) {
      $scope.errormsg.push('Please enter a real start time.')
      $scope.customError = true
    }
    if ($scope.task.lhour > 11 || $scope.task.lhour < 0 || $scope.task.lminute < 0 || $scope.task.lhour > 59) {
      $scope.errormsg.push('All durations must be under 12 hours, and more than 0 minutes.')
      $scope.customError = true
    }

    return $scope.customError
  }
})

app.factory('TaskFactory', function ($http, $log, $q) {
  return {
    createATask: function createATask (taskInfo) {
      var addSum = 0
      if (taskInfo.ampm !== 'AM' && taskInfo.hour !== 12) {
        addSum = 12
      }
      var hour = taskInfo.hour + addSum
      var start = moment().hour(hour).minute(taskInfo.minute)
      console.log('Start: ')
      console.log(start)
      var curZone = moment.tz.guess()
      taskInfo.startTime = moment.tz(start, curZone).format()
      return $http.post('/api/tasks', taskInfo).then(function () {
        return $q.resolve({ message: 'Task created!' })
      }).catch(function () {
        return $q.resolve({ message: 'Unable to create task.' })
      })
    },
    fetchAllTasks: function fetchAllTasks () {
      return $http.get('api/tasks').then(function (allTasks) {
        var refinedTasks = allTasks.data.slice()
        refinedTasks.forEach(function (elem) {
          var curZone = moment.tz.guess()
          if (elem.complete === true) {
            elem.myColor = '#33691E'
          } else {
            if (elem.active === true) {
              elem.myColor = '#9E9D24'
            } else {
              elem.myColor = '#7f0202'
            }
          }
          elem.startTime = moment.tz(elem.startTime, curZone).format()
        })
        return allTasks.data
      }).catch(function () {
        return $q.resolve({ message: 'Unable to fetch tasks.' })
      })
    }
  }
})

app.config(function ($stateProvider) {
  $stateProvider.state('master.navbar.tasks', {
    url: '/tasks',
    templateUrl: 'js/tasks/tasks.html',
    controller: 'TaskCtrl',
    resolve: {
      Tasks: function Tasks (TaskFactory) {
        return TaskFactory.fetchAllTasks()
      }
    }
  })
})

app.directive('footer', function ($rootScope, AuthService, AUTH_EVENTS, $state) {
  return {
    restrict: 'E',
    scope: {},
    templateUrl: 'js/common/directives/footer/footer.html',
    link: function link (scope) {}
  }
})

app.directive('navbar', function ($rootScope, AuthService, AUTH_EVENTS, $state) {
  return {
    restrict: 'E',
    scope: {},
    templateUrl: 'js/common/directives/navbar/navbar.html',
    link: function link (scope) {
      scope.items = [{ label: 'Account Settings', state: 'master.navbar.signup-settings', auth: true }, { label: 'Tasks', state: 'master.navbar.tasks', auth: true }]

      scope.user = null

      scope.isLoggedIn = function () {
        return AuthService.isAuthenticated()
      }

      scope.logout = function () {
        AuthService.logout().then(function () {
          $state.go('master.navbar.home')
        })
      }

      var setUser = function setUser () {
        AuthService.getLoggedInUser().then(function (user) {
          scope.user = user
          if (user) $state.go('master.navbar.tasks')
        })
      }

      var removeUser = function removeUser () {
        scope.user = null
      }

      setUser()

      $rootScope.$on(AUTH_EVENTS.loginSuccess, setUser)
      $rootScope.$on(AUTH_EVENTS.logoutSuccess, removeUser)
      $rootScope.$on(AUTH_EVENTS.sessionTimeout, removeUser)
    }

  }
})

app.config(function ($stateProvider) {
  $stateProvider.state('master.navbar', {
    templateUrl: 'js/common/directives/navbar/navbar-state.html',
    controller: function controller ($state, $scope) {
      $state.go('master.navbar.home')
    }
  })
})
// # sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImRvY3MvZG9jcy5zdGF0ZS5qcyIsImZzYS9mc2EtcHJlLWJ1aWx0LmpzIiwiaG9tZS9ob21lLnN0YXRlLmpzIiwibG9naW4vbG9naW4uY29udHJvbGxlci5qcyIsImxvZ2luL2xvZ2luLnN0YXRlLmpzIiwibWFzdGVyL21hc3Rlci5zdGF0ZS5qcyIsIm1lbWJlcnMtb25seS9tZW1iZXJzLW9ubHkuanMiLCJzaWdudXAvc2lnbnVwLmNvbnRyb2xsZXIuanMiLCJzaWdudXAvc2lnbnVwLmRpcmVjdGl2ZS5qcyIsInNpZ251cC9zaWdudXAuZmFjdG9yeS5qcyIsInNpZ251cC9zaWdudXAuc3RhdGUuanMiLCJzaWdudXAtc2V0dGluZ3Mvc2lnbnVwLnNldHRpbmdzLmNvbnRyb2xsZXIuanMiLCJzaWdudXAtc2V0dGluZ3Mvc2lnbnVwLnNldHRpbmdzLmZhY3RvcnkuanMiLCJzaWdudXAtc2V0dGluZ3Mvc2lnbnVwLnNldHRpbmdzLnN0YXRlLmpzIiwidGFza3MvdGFzay5kaXJlY3RpdmUuanMiLCJ0YXNrcy90YXNrcy5jb250cm9sbGVyLmpzIiwidGFza3MvdGFza3MuZmFjdG9yeS5qcyIsInRhc2tzL3Rhc2tzLnN0YXRlLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvZm9vdGVyL2Zvb3Rlci5kaXJlY3RpdmUuanMiLCJjb21tb24vZGlyZWN0aXZlcy9uYXZiYXIvbmF2YmFyLmRpcmVjdGl2ZS5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuc3RhdGUuanMiXSwibmFtZXMiOlsid2luZG93IiwiYXBwIiwiYW5ndWxhciIsIm1vZHVsZSIsImNvbmZpZyIsIiR1cmxSb3V0ZXJQcm92aWRlciIsIiRsb2NhdGlvblByb3ZpZGVyIiwiaHRtbDVNb2RlIiwib3RoZXJ3aXNlIiwid2hlbiIsImxvY2F0aW9uIiwicmVsb2FkIiwicnVuIiwiJHJvb3RTY29wZSIsIkF1dGhTZXJ2aWNlIiwiJHN0YXRlIiwiZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCIsInN0YXRlIiwiZGF0YSIsImF1dGhlbnRpY2F0ZSIsIiRvbiIsImV2ZW50IiwidG9TdGF0ZSIsInRvUGFyYW1zIiwiaXNBdXRoZW50aWNhdGVkIiwicHJldmVudERlZmF1bHQiLCJnZXRMb2dnZWRJblVzZXIiLCJ0aGVuIiwidXNlciIsImdvIiwibmFtZSIsIiRzdGF0ZVByb3ZpZGVyIiwidXJsIiwidGVtcGxhdGVVcmwiLCJFcnJvciIsImZhY3RvcnkiLCJpbyIsIm9yaWdpbiIsImNvbnN0YW50IiwibG9naW5TdWNjZXNzIiwibG9naW5GYWlsZWQiLCJsb2dvdXRTdWNjZXNzIiwic2Vzc2lvblRpbWVvdXQiLCJub3RBdXRoZW50aWNhdGVkIiwibm90QXV0aG9yaXplZCIsIiRxIiwiQVVUSF9FVkVOVFMiLCJzdGF0dXNEaWN0IiwicmVzcG9uc2VFcnJvciIsInJlc3BvbnNlIiwiJGJyb2FkY2FzdCIsInN0YXR1cyIsInJlamVjdCIsIiRodHRwUHJvdmlkZXIiLCJpbnRlcmNlcHRvcnMiLCJwdXNoIiwiJGluamVjdG9yIiwiZ2V0Iiwic2VydmljZSIsIiRodHRwIiwiU2Vzc2lvbiIsIm9uU3VjY2Vzc2Z1bExvZ2luIiwiY3JlYXRlIiwiaWQiLCJmcm9tU2VydmVyIiwiY2F0Y2giLCJsb2dpbiIsImNyZWRlbnRpYWxzIiwicG9zdCIsIm1lc3NhZ2UiLCJsb2dvdXQiLCJkZXN0cm95Iiwic2VsZiIsInNlc3Npb25JZCIsImNvbnRyb2xsZXIiLCIkc2NvcGUiLCJlcnJvciIsInNlbmRMb2dpbiIsImxvZ2luSW5mbyIsInRlbXBsYXRlIiwiU2VjcmV0U3Rhc2giLCJnZXRTdGFzaCIsInN0YXNoIiwiU2lnbnVwRmFjdG9yeSIsImNyZWF0ZVVzZXIiLCJzaWdudXBJbmZvIiwiZGlyZWN0aXZlIiwicmVzdHJpY3QiLCJyZXF1aXJlIiwibGluayIsInNjb3BlIiwiZWxlbSIsImF0dHJzIiwibmdNb2RlbCIsIiR3YXRjaCIsInZhbGlkYXRlIiwiJG9ic2VydmUiLCJ2YWwiLCJ2YWwxIiwiJHZpZXdWYWx1ZSIsInZhbDIiLCJlcXVhbHMiLCIkc2V0VmFsaWRpdHkiLCIkbG9nIiwicmVzb2x2ZSIsIlNpZ251cFNldHRpbmdzRmFjdG9yeSIsIndlZWsiLCJzZWxlY3RlZCIsIm51bWJlciIsImlzT3B0aW9uc1JlcXVpcmVkIiwic29tZSIsIm9wdGlvbnMiLCJjcmVhdGVTZXR0aW5ncyIsInNldHRpbmdzSW5mbyIsIm15V29ya2RheXMiLCJmb3JFYWNoIiwidG9CZVNlbnQiLCJ3YWtldGltZSIsIndvcmtkYXlzIiwiY3JlYXRlZFNldHRpbmdzIiwiY29uc29sZSIsImxvZyIsInRhc2siLCJUYXNrRmFjdG9yeSIsIlRhc2tzIiwic2hvd1Rhc2siLCJjdXN0b21FcnJvciIsImVycm9ybXNnIiwic29ydCIsImEiLCJiIiwic3RhcnRUaW1lIiwidGFza3MiLCJjcmVhdGVUYXNrIiwidGFza0luZm8iLCJjcmVhdGVBVGFzayIsImNyZWF0ZWRUYXNrIiwidXBkYXRlVGFza3MiLCJjbGVhckZpZWxkcyIsImZldGNoQWxsVGFza3MiLCJhbGxUYXNrcyIsInRvZ2dsZUNyZWF0ZVRhc2siLCJ0aXRsZSIsImxob3VyIiwibG1pbnV0ZSIsImhvdXIiLCJtaW51dGUiLCJjaGVja0ZpZWxkcyIsImFkZFN1bSIsImFtcG0iLCJzdGFydCIsIm1vbWVudCIsImN1clpvbmUiLCJ0eiIsImd1ZXNzIiwiZm9ybWF0IiwicmVmaW5lZFRhc2tzIiwic2xpY2UiLCJjb21wbGV0ZSIsIm15Q29sb3IiLCJhY3RpdmUiLCJpdGVtcyIsImxhYmVsIiwiYXV0aCIsImlzTG9nZ2VkSW4iLCJzZXRVc2VyIiwicmVtb3ZlVXNlciJdLCJtYXBwaW5ncyI6IkFBQUE7O0FBQ0FBLE9BQUFDLEdBQUEsR0FBQUMsUUFBQUMsTUFBQSxDQUFBLFFBQUEsRUFBQSxDQUFBLGFBQUEsRUFBQSxXQUFBLEVBQUEsY0FBQSxFQUFBLFdBQUEsQ0FBQSxDQUFBOztBQUVBRixJQUFBRyxNQUFBLENBQUEsVUFBQUMsa0JBQUEsRUFBQUMsaUJBQUEsRUFBQTtBQUNBO0FB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QUFBd0ksVUFBQSxTQUFBQSxPQUFBLEdBQUE7QUFDQXZKLG9CQUFBWSxlQUFBLEdBQUFDLElBQUEsQ0FBQSxVQUFBQyxJQUFBLEVBQUE7QUFDQThELGdCQUFBOUQsSUFBQSxHQUFBQSxJQUFBO0FBQ0EsY0FBQUEsSUFBQSxFQUFBYixPQUFBYyxFQUFBLENBQUEscUJBQUE7QUFDQSxTQUhBO0FBSUEsT0FMQTs7QUFPQSxVQUFBeUksYUFBQSxTQUFBQSxVQUFBLEdBQUE7QUFDQTVFLGNBQUE5RCxJQUFBLEdBQUEsSUFBQTtBQUNBLE9BRkE7O0FBSUF5STs7QUFFQXhKLGlCQUFBTyxHQUFBLENBQUEwQixZQUFBUCxZQUFBLEVBQUE4SCxPQUFBO0FBQ0F4SixpQkFBQU8sR0FBQSxDQUFBMEIsWUFBQUwsYUFBQSxFQUFBNkgsVUFBQTtBQUNBekosaUJBQUFPLEdBQUEsQ0FBQTBCLFlBQUFKLGNBQUEsRUFBQTRILFVBQUE7QUFDQTs7QUF0Q0EsR0FBQTtBQXlDQSxDQTFDQTs7QUNBQXJLLElBQUFHLE1BQUEsQ0FBQSxVQUFBMkIsY0FBQSxFQUFBO0FBQ0FBLGlCQUFBZCxLQUFBLENBQUEsZUFBQSxFQUFBO0FBQ0FnQixpQkFBQSwrQ0FEQTtBQUVBeUMsZ0JBQUEsb0JBQUEzRCxNQUFBLEVBQUE0RCxNQUFBLEVBQUE7QUFDQTVELGFBQUFjLEVBQUEsQ0FBQSxvQkFBQTtBQUNBO0FBSkEsR0FBQTtBQU1BLENBUEEiLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0J1xud2luZG93LmFwcCA9IGFuZ3VsYXIubW9kdWxlKCdSaXR1YWwnLCBbJ2ZzYVByZUJ1aWx0JywgJ3VpLnJvdXRlcicsICd1aS5ib290c3RyYXAnLCAnbmdBbmltYXRlJ10pXG5cbmFwcC5jb25maWcoZnVuY3Rpb24gKCR1cmxSb3V0ZXJQcm92aWRlciwgJGxvY2F0aW9uUHJvdmlkZXIpIHtcbiAgLy8gVGhpcyB0dXJucyBvZmYgaGFzaGJhbmcgdXJscyAoLyNhYm91dCkgYW5kIGNoYW5nZXMgaXQgdG8gc29tZXRoaW5nIG5vcm1hbCAoL2Fib3V0KVxuICAkbG9jYXRpb25Qcm92aWRlci5odG1sNU1vZGUodHJ1ZSlcbiAgLy8gSWYgd2UgZ28gdG8gYSBVUkwgdGhhdCB1aS1yb3V0ZXIgZG9lc24ndCBoYXZlIHJlZ2lzdGVyZWQsIGdvIHRvIHRoZSBcIi9cIiB1cmwuXG4gICR1cmxSb3V0ZXJQcm92aWRlci5vdGhlcndpc2UoJy8nKVxuICAvLyBUcmlnZ2VyIHBhZ2UgcmVmcmVzaCB3aGVuIGFjY2Vzc2luZyBhbiBPQXV0aCByb3V0ZVxuICAkdXJsUm91dGVyUHJvdmlkZXIud2hlbignL2F1dGgvOnByb3ZpZGVyJywgZnVuY3Rpb24gKCkge1xuICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKVxuICB9KVxufSlcblxuLy8gVGhpcyBhcHAucnVuIGlzIGZvciBjb250cm9sbGluZyBhY2Nlc3MgdG8gc3BlY2lmaWMgc3RhdGVzLlxuYXBwLnJ1bihmdW5jdGlvbiAoJHJvb3RTY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSkge1xuXG4gIC8vIFRoZSBnaXZlbiBzdGF0ZSByZXF1aXJlcyBhbiBhdXRoZW50aWNhdGVkIHVzZXIuXG4gIHZhciBkZXN0aW5hdGlvblN0YXRlUmVxdWlyZXNBdXRoID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgcmV0dXJuIHN0YXRlLmRhdGEgJiYgc3RhdGUuZGF0YS5hdXRoZW50aWNhdGVcbiAgfVxuXG4gIC8vICRzdGF0ZUNoYW5nZVN0YXJ0IGlzIGFuIGV2ZW50IGZpcmVkXG4gIC8vIHdoZW5ldmVyIHRoZSBwcm9jZXNzIG9mIGNoYW5naW5nIGEgc3RhdGUgYmVnaW5zLlxuICAkcm9vdFNjb3BlLiRvbignJHN0YXRlQ2hhbmdlU3RhcnQnLCBmdW5jdGlvbiAoZXZlbnQsIHRvU3RhdGUsIHRvUGFyYW1zKSB7XG4gICAgaWYgKCFkZXN0aW5hdGlvblN0YXRlUmVxdWlyZXNBdXRoKHRvU3RhdGUpKSB7XG4gICAgICAvLyBUaGUgZGVzdGluYXRpb24gc3RhdGUgZG9lcyBub3QgcmVxdWlyZSBhdXRoZW50aWNhdGlvblxuICAgICAgLy8gU2hvcnQgY2lyY3VpdCB3aXRoIHJldHVybi5cbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmIChBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKSkge1xuICAgICAgLy8gVGhlIHVzZXIgaXMgYXV0aGVudGljYXRlZC5cbiAgICAgIC8vIFNob3J0IGNpcmN1aXQgd2l0aCByZXR1cm4uXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyBDYW5jZWwgbmF2aWdhdGluZyB0byBuZXcgc3RhdGUuXG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKVxuXG4gICAgQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgLy8gSWYgYSB1c2VyIGlzIHJldHJpZXZlZCwgdGhlbiByZW5hdmlnYXRlIHRvIHRoZSBkZXN0aW5hdGlvblxuICAgICAgLy8gKHRoZSBzZWNvbmQgdGltZSwgQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCkgd2lsbCB3b3JrKVxuICAgICAgLy8gb3RoZXJ3aXNlLCBpZiBubyB1c2VyIGlzIGxvZ2dlZCBpbiwgZ28gdG8gXCJsb2dpblwiIHN0YXRlLlxuICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgJHN0YXRlLmdvKHRvU3RhdGUubmFtZSwgdG9QYXJhbXMpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAkc3RhdGUuZ28oJ2xvZ2luJylcbiAgICAgIH1cbiAgICB9KVxuICB9KVxufSlcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdtYXN0ZXIubmF2YmFyLmRvY3MnLCB7XG4gICAgdXJsOiAnL2RvY3MnLFxuICAgIHRlbXBsYXRlVXJsOiAnanMvZG9jcy9kb2NzLmh0bWwnXG4gIH0pXG59KVxuIiwiOyhmdW5jdGlvbiAoKSB7XG4gICd1c2Ugc3RyaWN0J1xuXG4gIC8vIEhvcGUgeW91IGRpZG4ndCBmb3JnZXQgQW5ndWxhciEgRHVoLWRveS5cbiAgaWYgKCF3aW5kb3cuYW5ndWxhcikgdGhyb3cgbmV3IEVycm9yKFwiSSBjYW4ndCBmaW5kIEFuZ3VsYXIhXCIpXG5cbiAgdmFyIGFwcCA9IGFuZ3VsYXIubW9kdWxlKCdmc2FQcmVCdWlsdCcsIFtdKVxuXG4gIGFwcC5mYWN0b3J5KCdTb2NrZXQnLCBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCF3aW5kb3cuaW8pIHRocm93IG5ldyBFcnJvcignc29ja2V0LmlvIG5vdCBmb3VuZCEnKVxuICAgIHJldHVybiB3aW5kb3cuaW8od2luZG93LmxvY2F0aW9uLm9yaWdpbilcbiAgfSlcblxuICAvLyBBVVRIX0VWRU5UUyBpcyB1c2VkIHRocm91Z2hvdXQgb3VyIGFwcCB0b1xuICAvLyBicm9hZGNhc3QgYW5kIGxpc3RlbiBmcm9tIGFuZCB0byB0aGUgJHJvb3RTY29wZVxuICAvLyBmb3IgaW1wb3J0YW50IGV2ZW50cyBhYm91dCBhdXRoZW50aWNhdGlvbiBmbG93LlxuICBhcHAuY29uc3RhbnQoJ0FVVEhfRVZFTlRTJywge1xuICAgIGxvZ2luU3VjY2VzczogJ2F1dGgtbG9naW4tc3VjY2VzcycsXG4gICAgbG9naW5GYWlsZWQ6ICdhdXRoLWxvZ2luLWZhaWxlZCcsXG4gICAgbG9nb3V0U3VjY2VzczogJ2F1dGgtbG9nb3V0LXN1Y2Nlc3MnLFxuICAgIHNlc3Npb25UaW1lb3V0OiAnYXV0aC1zZXNzaW9uLXRpbWVvdXQnLFxuICAgIG5vdEF1dGhlbnRpY2F0ZWQ6ICdhdXRoLW5vdC1hdXRoZW50aWNhdGVkJyxcbiAgICBub3RBdXRob3JpemVkOiAnYXV0aC1ub3QtYXV0aG9yaXplZCdcbiAgfSlcblxuICBhcHAuZmFjdG9yeSgnQXV0aEludGVyY2VwdG9yJywgZnVuY3Rpb24gKCRyb290U2NvcGUsICRxLCBBVVRIX0VWRU5UUykge1xuICAgIHZhciBzdGF0dXNEaWN0ID0ge1xuICAgICAgNDAxOiBBVVRIX0VWRU5UUy5ub3RBdXRoZW50aWNhdGVkLFxuICAgICAgNDAzOiBBVVRIX0VWRU5UUy5ub3RBdXRob3JpemVkLFxuICAgICAgNDE5OiBBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCxcbiAgICAgIDQ0MDogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXRcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHJlc3BvbnNlRXJyb3I6IGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3Qoc3RhdHVzRGljdFtyZXNwb25zZS5zdGF0dXNdLCByZXNwb25zZSlcbiAgICAgICAgcmV0dXJuICRxLnJlamVjdChyZXNwb25zZSlcbiAgICAgIH1cbiAgICB9XG4gIH0pXG5cbiAgYXBwLmNvbmZpZyhmdW5jdGlvbiAoJGh0dHBQcm92aWRlcikge1xuICAgICRodHRwUHJvdmlkZXIuaW50ZXJjZXB0b3JzLnB1c2goW1xuICAgICAgJyRpbmplY3RvcicsXG4gICAgICBmdW5jdGlvbiAoJGluamVjdG9yKSB7XG4gICAgICAgIHJldHVybiAkaW5qZWN0b3IuZ2V0KCdBdXRoSW50ZXJjZXB0b3InKVxuICAgICAgfVxuICAgIF0pXG4gIH0pXG5cbiAgYXBwLnNlcnZpY2UoJ0F1dGhTZXJ2aWNlJywgZnVuY3Rpb24gKCRodHRwLCBTZXNzaW9uLCAkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUywgJHEpIHtcbiAgICBmdW5jdGlvbiBvblN1Y2Nlc3NmdWxMb2dpbiAocmVzcG9uc2UpIHtcbiAgICAgIHZhciBkYXRhID0gcmVzcG9uc2UuZGF0YVxuICAgICAgU2Vzc2lvbi5jcmVhdGUoZGF0YS5pZCwgZGF0YS51c2VyKVxuICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KEFVVEhfRVZFTlRTLmxvZ2luU3VjY2VzcylcbiAgICAgIHJldHVybiBkYXRhLnVzZXJcbiAgICB9XG5cbiAgICAvLyBVc2VzIHRoZSBzZXNzaW9uIGZhY3RvcnkgdG8gc2VlIGlmIGFuXG4gICAgLy8gYXV0aGVudGljYXRlZCB1c2VyIGlzIGN1cnJlbnRseSByZWdpc3RlcmVkLlxuICAgIHRoaXMuaXNBdXRoZW50aWNhdGVkID0gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuICEhU2Vzc2lvbi51c2VyXG4gICAgfVxuXG4gICAgdGhpcy5nZXRMb2dnZWRJblVzZXIgPSBmdW5jdGlvbiAoZnJvbVNlcnZlcikge1xuXG4gICAgICAvLyBJZiBhbiBhdXRoZW50aWNhdGVkIHNlc3Npb24gZXhpc3RzLCB3ZVxuICAgICAgLy8gcmV0dXJuIHRoZSB1c2VyIGF0dGFjaGVkIHRvIHRoYXQgc2Vzc2lvblxuICAgICAgLy8gd2l0aCBhIHByb21pc2UuIFRoaXMgZW5zdXJlcyB0aGF0IHdlIGNhblxuICAgICAgLy8gYWx3YXlzIGludGVyZmFjZSB3aXRoIHRoaXMgbWV0aG9kIGFzeW5jaHJvbm91c2x5LlxuXG4gICAgICAvLyBPcHRpb25hbGx5LCBpZiB0cnVlIGlzIGdpdmVuIGFzIHRoZSBmcm9tU2VydmVyIHBhcmFtZXRlcixcbiAgICAgIC8vIHRoZW4gdGhpcyBjYWNoZWQgdmFsdWUgd2lsbCBub3QgYmUgdXNlZC5cblxuICAgICAgaWYgKHRoaXMuaXNBdXRoZW50aWNhdGVkKCkgJiYgZnJvbVNlcnZlciAhPT0gdHJ1ZSkge1xuICAgICAgICByZXR1cm4gJHEud2hlbihTZXNzaW9uLnVzZXIpXG4gICAgICB9XG5cbiAgICAgIC8vIE1ha2UgcmVxdWVzdCBHRVQgL3Nlc3Npb24uXG4gICAgICAvLyBJZiBpdCByZXR1cm5zIGEgdXNlciwgY2FsbCBvblN1Y2Nlc3NmdWxMb2dpbiB3aXRoIHRoZSByZXNwb25zZS5cbiAgICAgIC8vIElmIGl0IHJldHVybnMgYSA0MDEgcmVzcG9uc2UsIHdlIGNhdGNoIGl0IGFuZCBpbnN0ZWFkIHJlc29sdmUgdG8gbnVsbC5cbiAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9zZXNzaW9uJykudGhlbihvblN1Y2Nlc3NmdWxMb2dpbikuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgfSlcbiAgICB9XG5cbiAgICB0aGlzLmxvZ2luID0gZnVuY3Rpb24gKGNyZWRlbnRpYWxzKSB7XG4gICAgICByZXR1cm4gJGh0dHAucG9zdCgnL2xvZ2luJywgY3JlZGVudGlhbHMpXG4gICAgICAgIC50aGVuKG9uU3VjY2Vzc2Z1bExvZ2luKVxuICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiAkcS5yZWplY3QoeyBtZXNzYWdlOiAnSW52YWxpZCBsb2dpbiBjcmVkZW50aWFscy4nIH0pXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgdGhpcy5sb2dvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvbG9nb3V0JykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgIFNlc3Npb24uZGVzdHJveSgpXG4gICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChBVVRIX0VWRU5UUy5sb2dvdXRTdWNjZXNzKVxuICAgICAgfSlcbiAgICB9XG4gIH0pXG5cbiAgYXBwLnNlcnZpY2UoJ1Nlc3Npb24nLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgQVVUSF9FVkVOVFMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXNcblxuICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLm5vdEF1dGhlbnRpY2F0ZWQsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuZGVzdHJveSgpXG4gICAgfSlcblxuICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0LCBmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLmRlc3Ryb3koKVxuICAgIH0pXG5cbiAgICB0aGlzLmlkID0gbnVsbFxuICAgIHRoaXMudXNlciA9IG51bGxcblxuICAgIHRoaXMuY3JlYXRlID0gZnVuY3Rpb24gKHNlc3Npb25JZCwgdXNlcikge1xuICAgICAgdGhpcy5pZCA9IHNlc3Npb25JZFxuICAgICAgdGhpcy51c2VyID0gdXNlclxuICAgIH1cblxuICAgIHRoaXMuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHRoaXMuaWQgPSBudWxsXG4gICAgICB0aGlzLnVzZXIgPSBudWxsXG4gICAgfVxuICB9KVxufSkoKVxuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ21hc3Rlci5uYXZiYXIuaG9tZScsIHtcbiAgICB1cmw6ICcvJyxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL2hvbWUvaG9tZS5odG1sJ1xuICB9KVxufSlcbiIsImFwcC5jb250cm9sbGVyKCdMb2dpbkN0cmwnLCBmdW5jdGlvbiAoJHNjb3BlLCBBdXRoU2VydmljZSwgJHN0YXRlKSB7XG4gICRzY29wZS5sb2dpbiA9IHt9XG4gICRzY29wZS5lcnJvciA9IG51bGxcblxuICAkc2NvcGUuc2VuZExvZ2luID0gZnVuY3Rpb24gKGxvZ2luSW5mbykge1xuICAgICRzY29wZS5lcnJvciA9IG51bGxcblxuICAgIEF1dGhTZXJ2aWNlLmxvZ2luKGxvZ2luSW5mbykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAkc3RhdGUuZ28oJ21hc3Rlci5uYXZiYXIudGFza3MnKVxuICAgIH0pLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICRzY29wZS5lcnJvciA9ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLidcbiAgICB9KVxuICB9XG59KVxuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ21hc3Rlci5uYXZiYXIubG9naW4nLCB7XG4gICAgdXJsOiAnL2xvZ2luJyxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL2xvZ2luL2xvZ2luLmh0bWwnLFxuICAgIGNvbnRyb2xsZXI6ICdMb2dpbkN0cmwnXG4gIH0pXG59KVxuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ21hc3RlcicsIHtcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL21hc3Rlci9tYXN0ZXIuaHRtbCcsXG4gICAgY29udHJvbGxlcjogZnVuY3Rpb24gKCRzY29wZSwgJHN0YXRlKSB7XG4gICAgICAkc3RhdGUuZ28oJ21hc3Rlci5uYXZiYXIuaG9tZScpXG4gICAgfVxuICB9KVxufSlcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdtZW1iZXJzT25seScsIHtcbiAgICB1cmw6ICcvbWVtYmVycy1hcmVhJyxcbiAgICB0ZW1wbGF0ZTogJzxpbWcgbmctcmVwZWF0PVwiaXRlbSBpbiBzdGFzaFwiIHdpZHRoPVwiMzAwXCIgbmctc3JjPVwie3sgaXRlbSB9fVwiIC8+JyxcbiAgICBjb250cm9sbGVyOiBmdW5jdGlvbiAoJHNjb3BlLCBTZWNyZXRTdGFzaCkge1xuICAgICAgU2VjcmV0U3Rhc2guZ2V0U3Rhc2goKS50aGVuKGZ1bmN0aW9uIChzdGFzaCkge1xuICAgICAgICAkc2NvcGUuc3Rhc2ggPSBzdGFzaFxuICAgICAgfSlcbiAgICB9LFxuICAgIC8vIFRoZSBmb2xsb3dpbmcgZGF0YS5hdXRoZW50aWNhdGUgaXMgcmVhZCBieSBhbiBldmVudCBsaXN0ZW5lclxuICAgIC8vIHRoYXQgY29udHJvbHMgYWNjZXNzIHRvIHRoaXMgc3RhdGUuIFJlZmVyIHRvIGFwcC5qcy5cbiAgICBkYXRhOiB7XG4gICAgICBhdXRoZW50aWNhdGU6IHRydWVcbiAgICB9XG4gIH0pXG59KVxuXG5hcHAuZmFjdG9yeSgnU2VjcmV0U3Rhc2gnLCBmdW5jdGlvbiAoJGh0dHApIHtcbiAgdmFyIGdldFN0YXNoID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAkaHR0cC5nZXQoJy9hcGkvbWVtYmVycy9zZWNyZXQtc3Rhc2gnKS50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgcmV0dXJuIHJlc3BvbnNlLmRhdGFcbiAgICB9KVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBnZXRTdGFzaDogZ2V0U3Rhc2hcbiAgfVxufSlcbiIsImFwcC5jb250cm9sbGVyKCdTaWdudXBDdHJsJywgZnVuY3Rpb24gKCRzY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSwgU2lnbnVwRmFjdG9yeSkge1xuICAkc2NvcGUuY3JlYXRlVXNlciA9IGZ1bmN0aW9uIChzaWdudXBJbmZvKSB7XG4gICAgJHNjb3BlLmVycm9yID0gbnVsbFxuXG4gICAgU2lnbnVwRmFjdG9yeS5jcmVhdGVVc2VyKHNpZ251cEluZm8pLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgQXV0aFNlcnZpY2UubG9naW4oc2lnbnVwSW5mbykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICRzdGF0ZS5nbygnbWFzdGVyLm5hdmJhci5zaWdudXAtc2V0dGluZ3MnKVxuICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAkc2NvcGUuZXJyb3IgPSAnSW52YWxpZCBsb2dpbiBjcmVkZW50aWFscy4nXG4gICAgICB9KVxuICAgIH0pLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICRzY29wZS5lcnJvciA9ICdDb3VsZCBub3QgY3JlYXRlIGFjY291bnQuJ1xuICAgIH0pXG4gIH1cbn0pXG4iLCIndXNlIHN0cmljdCdcblxuYXBwLmRpcmVjdGl2ZSgnZXF1YWxzJywgZnVuY3Rpb24gKCkge1xuICByZXR1cm4ge1xuICAgIHJlc3RyaWN0OiAnQScsIC8vIG9ubHkgYWN0aXZhdGUgb24gZWxlbWVudCBhdHRyaWJ1dGVcbiAgICByZXF1aXJlOiAnP25nTW9kZWwnLCAvLyBnZXQgYSBob2xkIG9mIE5nTW9kZWxDb250cm9sbGVyXG4gICAgbGluazogZnVuY3Rpb24gKHNjb3BlLCBlbGVtLCBhdHRycywgbmdNb2RlbCkge1xuICAgICAgaWYgKCFuZ01vZGVsKSByZXR1cm4gLy8gZG8gbm90aGluZyBpZiBubyBuZy1tb2RlbFxuXG4gICAgICAvLyB3YXRjaCBvd24gdmFsdWUgYW5kIHJlLXZhbGlkYXRlIG9uIGNoYW5nZVxuICAgICAgc2NvcGUuJHdhdGNoKGF0dHJzLm5nTW9kZWwsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFsaWRhdGUoKVxuICAgICAgfSlcblxuICAgICAgLy8gb2JzZXJ2ZSB0aGUgb3RoZXIgdmFsdWUgYW5kIHJlLXZhbGlkYXRlIG9uIGNoYW5nZVxuICAgICAgYXR0cnMuJG9ic2VydmUoJ2VxdWFscycsIGZ1bmN0aW9uICh2YWwpIHtcbiAgICAgICAgdmFsaWRhdGUoKVxuICAgICAgfSlcblxuICAgICAgdmFyIHZhbGlkYXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyB2YWx1ZXNcbiAgICAgICAgdmFyIHZhbDEgPSBuZ01vZGVsLiR2aWV3VmFsdWVcbiAgICAgICAgdmFyIHZhbDIgPSBhdHRycy5lcXVhbHNcblxuICAgICAgICAvLyBzZXQgdmFsaWRpdHlcbiAgICAgICAgbmdNb2RlbC4kc2V0VmFsaWRpdHkoJ2VxdWFscycsICF2YWwxIHx8ICF2YWwyIHx8IHZhbDEgPT09IHZhbDIpXG4gICAgICB9XG4gICAgfVxuICB9XG59KVxuIiwiYXBwLmZhY3RvcnkoJ1NpZ251cEZhY3RvcnknLCBmdW5jdGlvbiAoJGh0dHAsICRsb2csICRxKSB7XG4gIHJldHVybiB7XG4gICAgY3JlYXRlVXNlcjogZnVuY3Rpb24gKHNpZ251cEluZm8pIHtcbiAgICAgIHJldHVybiAkaHR0cC5wb3N0KCcvYXBpL3NpZ251cCcsIHNpZ251cEluZm8pXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gJHEucmVzb2x2ZSh7bWVzc2FnZTogJ1VzZXIgY3JlYXRlZCEnfSlcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gJHEucmVzb2x2ZSh7IG1lc3NhZ2U6ICdVbmFibGUgdG8gY3JlYXRlIHVzZXIuJyB9KVxuICAgICAgICB9KVxuICAgIH1cbiAgfVxufSlcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdtYXN0ZXIubmF2YmFyLnNpZ251cCcsIHtcbiAgICB1cmw6ICcvc2lnbnVwJyxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL3NpZ251cC9zaWdudXAuaHRtbCcsXG4gICAgY29udHJvbGxlcjogJ1NpZ251cEN0cmwnXG4gIH0pXG59KVxuIiwiYXBwLmNvbnRyb2xsZXIoJ1NpZ251cFNldHRpbmdzQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsIEF1dGhTZXJ2aWNlLCAkc3RhdGUsIFNpZ251cFNldHRpbmdzRmFjdG9yeSkge1xuICAkc2NvcGUud2VlayA9IFtcbiAgICB7c2VsZWN0ZWQ6IGZhbHNlLCBuYW1lOiAnTW8nLCBudW1iZXI6IDB9LFxuICAgIHtzZWxlY3RlZDogZmFsc2UsIG5hbWU6ICdUdScsIG51bWJlcjogMX0sXG4gICAge3NlbGVjdGVkOiBmYWxzZSwgbmFtZTogJ1dlJywgbnVtYmVyOiAyfSxcbiAgICB7c2VsZWN0ZWQ6IGZhbHNlLCBuYW1lOiAnVGgnLCBudW1iZXI6IDN9LFxuICAgIHtzZWxlY3RlZDogZmFsc2UsIG5hbWU6ICdGcicsIG51bWJlcjogNH0sXG4gICAge3NlbGVjdGVkOiBmYWxzZSwgbmFtZTogJ1NhJywgbnVtYmVyOiA1fSxcbiAgICB7c2VsZWN0ZWQ6IGZhbHNlLCBuYW1lOiAnU3UnLCBudW1iZXI6IDZ9XG4gIF1cblxuICAkc2NvcGUuaXNPcHRpb25zUmVxdWlyZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICRzY29wZS53ZWVrLnNvbWUoZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgIHJldHVybiBvcHRpb25zLnNlbGVjdGVkXG4gICAgfSlcbiAgfVxuXG4gICRzY29wZS5jcmVhdGVTZXR0aW5ncyA9IGZ1bmN0aW9uIChzZXR0aW5nc0luZm8pIHtcbiAgICBsZXQgbXlXb3JrZGF5cyA9IFtdXG5cbiAgICAkc2NvcGUud2Vlay5mb3JFYWNoKGZ1bmN0aW9uIChlbGVtKSB7XG4gICAgICBpZiAoZWxlbS5zZWxlY3RlZCA9PT0gdHJ1ZSkge1xuICAgICAgICBteVdvcmtkYXlzLnB1c2goZWxlbS5udW1iZXIpXG4gICAgICB9XG4gICAgfSlcblxuICAgIGxldCB0b0JlU2VudCA9IHtcbiAgICAgIHdha2V0aW1lOiBzZXR0aW5nc0luZm8ud2FrZXRpbWUgKyAnIEFNJyxcbiAgICAgIHdvcmtkYXlzOiBteVdvcmtkYXlzXG4gICAgfVxuXG4gICAgU2lnbnVwU2V0dGluZ3NGYWN0b3J5LmNyZWF0ZVNldHRpbmdzKHRvQmVTZW50KVxuICAgICAgLnRoZW4oZnVuY3Rpb24gKGNyZWF0ZWRTZXR0aW5ncykge1xuICAgICAgICAkc3RhdGUuZ28oJ21hc3Rlci5uYXZiYXIudGFza3MnKVxuICAgICAgfSlcbiAgICAgIC5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICRzY29wZS5lcnJvciA9ICdDb3VsZCBub3QgY3JlYXRlIHNldHRpbmdzLidcbiAgICAgICAgY29uc29sZS5sb2coJ0Vycm9yIGNyZWF0aW5nIHRhc2suJylcbiAgICAgIH0pXG4gIH1cbn0pXG4iLCJhcHAuZmFjdG9yeSgnU2lnbnVwU2V0dGluZ3NGYWN0b3J5JywgZnVuY3Rpb24gKCRodHRwLCAkbG9nLCAkcSkge1xuICByZXR1cm4ge1xuICAgIGNyZWF0ZVNldHRpbmdzOiBmdW5jdGlvbiAoc2V0dGluZ3NJbmZvKSB7XG4gICAgICByZXR1cm4gJGh0dHAucG9zdCgnL2FwaS9zZXR0aW5ncycsIHNldHRpbmdzSW5mbylcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiAkcS5yZXNvbHZlKHttZXNzYWdlOiAnU2V0dGluZ3MgY3JlYXRlZCEnfSlcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gJHEucmVzb2x2ZSh7IG1lc3NhZ2U6ICdVbmFibGUgdG8gY3JlYXRlIHNldHRpbmdzLicgfSlcbiAgICAgICAgfSlcbiAgICB9XG4gIH1cbn0pXG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbWFzdGVyLm5hdmJhci5zaWdudXAtc2V0dGluZ3MnLCB7XG4gICAgdXJsOiAnL3NpZ251cC1zZXR0aW5ncycsXG4gICAgdGVtcGxhdGVVcmw6ICdqcy9zaWdudXAtc2V0dGluZ3Mvc2lnbnVwLXNldHRpbmdzLmh0bWwnLFxuICAgIGNvbnRyb2xsZXI6ICdTaWdudXBTZXR0aW5nc0N0cmwnXG4gIH0pXG59KVxuIiwiYXBwLmRpcmVjdGl2ZSgndGFzaycsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBdXRoU2VydmljZSwgQVVUSF9FVkVOVFMsICRzdGF0ZSkge1xuICByZXR1cm4ge1xuICAgIHJlc3RyaWN0OiAnRScsXG4gICAgc2NvcGU6IHtcbiAgICAgIHRhc2s6ICc9dGFzaydcbiAgICB9LFxuICAgIHRlbXBsYXRlVXJsOiAnanMvdGFza3MvdGFza3MtZGlyZWN0aXZlLmh0bWwnLFxuICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSkge31cbiAgfVxufSlcbiIsImFwcC5jb250cm9sbGVyKCdUYXNrQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsIEF1dGhTZXJ2aWNlLCAkc3RhdGUsIFRhc2tGYWN0b3J5LCBUYXNrcykge1xuICAkc2NvcGUuc2hvd1Rhc2sgPSBmYWxzZVxuICAkc2NvcGUuY3VzdG9tRXJyb3IgPSBmYWxzZVxuICAkc2NvcGUuZXJyb3Jtc2cgPSBbXVxuXG4gIFRhc2tzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICByZXR1cm4gYi5zdGFydFRpbWUgPCBhLnN0YXJ0VGltZSA/IDEgOiAtMVxuICB9KVxuXG4gIGNvbnNvbGUubG9nKFRhc2tzKVxuXG4gICRzY29wZS50YXNrcyA9IFRhc2tzXG5cbiAgJHNjb3BlLmNyZWF0ZVRhc2sgPSBmdW5jdGlvbiAodGFza0luZm8pIHtcbiAgICBUYXNrRmFjdG9yeS5jcmVhdGVBVGFzayh0YXNrSW5mbylcbiAgICAgIC50aGVuKGZ1bmN0aW9uIChjcmVhdGVkVGFzaykge1xuICAgICAgICAkc2NvcGUudXBkYXRlVGFza3MoKVxuICAgICAgICAkc2NvcGUuY2xlYXJGaWVsZHMoKVxuICAgICAgfSlcbiAgICAgIC5jYXRjaChmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgJHNjb3BlLmVycm9yID0gJ0NvdWxkIG5vdCBjcmVhdGUgdGFzay4nXG4gICAgICAgIGNvbnNvbGUubG9nKCdFcnJvciBjcmVhdGluZyB0YXNrLicpXG4gICAgICB9KVxuICB9XG5cbiAgJHNjb3BlLnVwZGF0ZVRhc2tzID0gZnVuY3Rpb24gKCkge1xuICAgIFRhc2tGYWN0b3J5LmZldGNoQWxsVGFza3MoKVxuICAgICAgLnRoZW4oZnVuY3Rpb24gKGFsbFRhc2tzKSB7XG4gICAgICAgIGFsbFRhc2tzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgICByZXR1cm4gYi5zdGFydFRpbWUgPCBhLnN0YXJ0VGltZSA/IDEgOiAtMVxuICAgICAgICB9KVxuICAgICAgICAkc2NvcGUudGFza3MgPSBhbGxUYXNrc1xuICAgICAgICAkc2NvcGUudG9nZ2xlQ3JlYXRlVGFzaygpXG4gICAgICB9KVxuICAgICAgLmNhdGNoKGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAkc2NvcGUuZXJyb3IgPSAnQ291bGQgbm90IHVwZGF0ZSB0YXNrcy4nXG4gICAgICAgIGNvbnNvbGUubG9nKCdFcnJvciBjcmVhdGluZyB0YXNrLicpXG4gICAgICB9KVxuICB9XG5cbiAgJHNjb3BlLnRvZ2dsZUNyZWF0ZVRhc2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgJHNjb3BlLnNob3dUYXNrID0gISRzY29wZS5zaG93VGFza1xuICB9XG5cbiAgJHNjb3BlLmNsZWFyRmllbGRzID0gZnVuY3Rpb24gKCkge1xuICAgICRzY29wZS50YXNrLnRpdGxlID0gJydcbiAgICAkc2NvcGUudGFzay5saG91ciA9IG51bGxcbiAgICAkc2NvcGUudGFzay5sbWludXRlID0gbnVsbFxuICAgICRzY29wZS50YXNrLmhvdXIgPSBudWxsXG4gICAgJHNjb3BlLnRhc2subWludXRlID0gbnVsbFxuICB9XG5cbiAgJHNjb3BlLmNoZWNrRmllbGRzID0gZnVuY3Rpb24gKCkge1xuICAgICRzY29wZS5jdXN0b21FcnJvciA9IGZhbHNlXG4gICAgJHNjb3BlLmVycm9ybXNnID0gW11cbiAgICBpZiAoKCRzY29wZS50YXNrLmhvdXIgPCAxIHx8ICRzY29wZS50YXNrLmhvdXIgPiAxMikgfHwgKCRzY29wZS50YXNrLm1pbnV0ZSA8IDAgfHwgJHNjb3BlLnRhc2subWludXRlID4gNTkpKSB7XG4gICAgICAkc2NvcGUuZXJyb3Jtc2cucHVzaCgnUGxlYXNlIGVudGVyIGEgcmVhbCBzdGFydCB0aW1lLicpXG4gICAgICAkc2NvcGUuY3VzdG9tRXJyb3IgPSB0cnVlXG4gICAgfVxuICAgIGlmICgoJHNjb3BlLnRhc2subGhvdXIgPiAxMSB8fCAkc2NvcGUudGFzay5saG91ciA8IDApIHx8ICgkc2NvcGUudGFzay5sbWludXRlIDwgMCB8fCAkc2NvcGUudGFzay5saG91ciA+IDU5KSkge1xuICAgICAgJHNjb3BlLmVycm9ybXNnLnB1c2goJ0FsbCBkdXJhdGlvbnMgbXVzdCBiZSB1bmRlciAxMiBob3VycywgYW5kIG1vcmUgdGhhbiAwIG1pbnV0ZXMuJylcbiAgICAgICRzY29wZS5jdXN0b21FcnJvciA9IHRydWVcbiAgICB9XG5cbiAgICByZXR1cm4gJHNjb3BlLmN1c3RvbUVycm9yXG4gIH1cbn0pXG4iLCJhcHAuZmFjdG9yeSgnVGFza0ZhY3RvcnknLCBmdW5jdGlvbiAoJGh0dHAsICRsb2csICRxKSB7XG4gIHJldHVybiB7XG4gICAgY3JlYXRlQVRhc2s6IGZ1bmN0aW9uICh0YXNrSW5mbykge1xuICAgICAgbGV0IGFkZFN1bSA9IDBcbiAgICAgIGlmICh0YXNrSW5mby5hbXBtICE9PSAnQU0nICYmIHRhc2tJbmZvLmhvdXIgIT09IDEyKSB7XG4gICAgICAgIGFkZFN1bSA9IDEyXG4gICAgICB9XG4gICAgICBsZXQgaG91ciA9IHRhc2tJbmZvLmhvdXIgKyBhZGRTdW1cbiAgICAgIGxldCBzdGFydCA9IG1vbWVudCgpLmhvdXIoaG91cikubWludXRlKHRhc2tJbmZvLm1pbnV0ZSlcbiAgICAgIGNvbnNvbGUubG9nKCdTdGFydDogJylcbiAgICAgIGNvbnNvbGUubG9nKHN0YXJ0KVxuICAgICAgbGV0IGN1clpvbmUgPSBtb21lbnQudHouZ3Vlc3MoKVxuICAgICAgdGFza0luZm8uc3RhcnRUaW1lID0gbW9tZW50LnR6KHN0YXJ0LCBjdXJab25lKS5mb3JtYXQoKVxuICAgICAgcmV0dXJuICRodHRwLnBvc3QoJy9hcGkvdGFza3MnLCB0YXNrSW5mbylcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiAkcS5yZXNvbHZlKHttZXNzYWdlOiAnVGFzayBjcmVhdGVkISd9KVxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiAkcS5yZXNvbHZlKHsgbWVzc2FnZTogJ1VuYWJsZSB0byBjcmVhdGUgdGFzay4nIH0pXG4gICAgICAgIH0pXG4gICAgfSxcbiAgICBmZXRjaEFsbFRhc2tzOiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gJGh0dHAuZ2V0KCdhcGkvdGFza3MnKVxuICAgICAgICAudGhlbihmdW5jdGlvbiAoYWxsVGFza3MpIHtcbiAgICAgICAgICBsZXQgcmVmaW5lZFRhc2tzID0gYWxsVGFza3MuZGF0YS5zbGljZSgpXG4gICAgICAgICAgcmVmaW5lZFRhc2tzLmZvckVhY2goZnVuY3Rpb24gKGVsZW0pIHtcbiAgICAgICAgICAgIGxldCBjdXJab25lID0gbW9tZW50LnR6Lmd1ZXNzKClcbiAgICAgICAgICAgIGlmIChlbGVtLmNvbXBsZXRlID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgIGVsZW0ubXlDb2xvciA9ICcjMzM2OTFFJ1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgaWYgKGVsZW0uYWN0aXZlID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgZWxlbS5teUNvbG9yID0gJyM5RTlEMjQnXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5teUNvbG9yID0gJyM3ZjAyMDInXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsZW0uc3RhcnRUaW1lID0gbW9tZW50LnR6KGVsZW0uc3RhcnRUaW1lLCBjdXJab25lKS5mb3JtYXQoKVxuICAgICAgICAgIH0pXG4gICAgICAgICAgcmV0dXJuIGFsbFRhc2tzLmRhdGFcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gJHEucmVzb2x2ZSh7IG1lc3NhZ2U6ICdVbmFibGUgdG8gZmV0Y2ggdGFza3MuJyB9KVxuICAgICAgICB9KVxuICAgIH1cbiAgfVxufSlcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdtYXN0ZXIubmF2YmFyLnRhc2tzJywge1xuICAgIHVybDogJy90YXNrcycsXG4gICAgdGVtcGxhdGVVcmw6ICdqcy90YXNrcy90YXNrcy5odG1sJyxcbiAgICBjb250cm9sbGVyOiAnVGFza0N0cmwnLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIFRhc2tzOiBmdW5jdGlvbiAoVGFza0ZhY3RvcnkpIHtcbiAgICAgICAgcmV0dXJuIFRhc2tGYWN0b3J5LmZldGNoQWxsVGFza3MoKVxuICAgICAgfVxuICAgIH1cbiAgfSlcbn0pXG4iLCJhcHAuZGlyZWN0aXZlKCdmb290ZXInLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgQXV0aFNlcnZpY2UsIEFVVEhfRVZFTlRTLCAkc3RhdGUpIHtcbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0UnLFxuICAgIHNjb3BlOiB7fSxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL2Zvb3Rlci9mb290ZXIuaHRtbCcsXG4gICAgbGluazogZnVuY3Rpb24gKHNjb3BlKSB7fVxuICB9XG59KVxuIiwiYXBwLmRpcmVjdGl2ZSgnbmF2YmFyJywgZnVuY3Rpb24gKCRyb290U2NvcGUsIEF1dGhTZXJ2aWNlLCBBVVRIX0VWRU5UUywgJHN0YXRlKSB7XG4gIHJldHVybiB7XG4gICAgcmVzdHJpY3Q6ICdFJyxcbiAgICBzY29wZToge30sXG4gICAgdGVtcGxhdGVVcmw6ICdqcy9jb21tb24vZGlyZWN0aXZlcy9uYXZiYXIvbmF2YmFyLmh0bWwnLFxuICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSkge1xuICAgICAgc2NvcGUuaXRlbXMgPSBbXG4gICAgICAgIHsgbGFiZWw6ICdBY2NvdW50IFNldHRpbmdzJywgc3RhdGU6ICdtYXN0ZXIubmF2YmFyLnNpZ251cC1zZXR0aW5ncycsIGF1dGg6IHRydWV9LFxuICAgICAgICB7IGxhYmVsOiAnVGFza3MnLCBzdGF0ZTogJ21hc3Rlci5uYXZiYXIudGFza3MnLCBhdXRoOiB0cnVlfVxuICAgICAgXVxuXG4gICAgICBzY29wZS51c2VyID0gbnVsbFxuXG4gICAgICBzY29wZS5pc0xvZ2dlZEluID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKClcbiAgICAgIH1cblxuICAgICAgc2NvcGUubG9nb3V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBBdXRoU2VydmljZS5sb2dvdXQoKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAkc3RhdGUuZ28oJ21hc3Rlci5uYXZiYXIuaG9tZScpXG4gICAgICAgIH0pXG4gICAgICB9XG5cbiAgICAgIHZhciBzZXRVc2VyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgICAgc2NvcGUudXNlciA9IHVzZXJcbiAgICAgICAgICBpZiAodXNlcikgJHN0YXRlLmdvKCdtYXN0ZXIubmF2YmFyLnRhc2tzJylcbiAgICAgICAgfSlcbiAgICAgIH1cblxuICAgICAgdmFyIHJlbW92ZVVzZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNjb3BlLnVzZXIgPSBudWxsXG4gICAgICB9XG5cbiAgICAgIHNldFVzZXIoKVxuXG4gICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5sb2dpblN1Y2Nlc3MsIHNldFVzZXIpXG4gICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5sb2dvdXRTdWNjZXNzLCByZW1vdmVVc2VyKVxuICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsIHJlbW92ZVVzZXIpXG4gICAgfVxuXG4gIH1cbn0pXG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbWFzdGVyLm5hdmJhcicsIHtcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXItc3RhdGUuaHRtbCcsXG4gICAgY29udHJvbGxlcjogZnVuY3Rpb24gKCRzdGF0ZSwgJHNjb3BlKSB7XG4gICAgICAkc3RhdGUuZ28oJ21hc3Rlci5uYXZiYXIuaG9tZScpXG4gICAgfVxuICB9KVxufSlcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
