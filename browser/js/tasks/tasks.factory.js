app.factory('TaskFactory', function ($http, $log, $q) {
  return {
    createATask: function (taskInfo) {
      let addSum = 0
      if (taskInfo.ampm !== 'AM' && taskInfo.hour !== 12) {
        addSum = 12
      }
      let hour = taskInfo.hour + addSum
      let start = moment().hour(hour).minute(taskInfo.minute)
      console.log('Start: ')
      console.log(start)
      let curZone = moment.tz.guess()
      taskInfo.startTime = moment.tz(start, curZone).format()
      return $http.post('/api/tasks', taskInfo)
        .then(function () {
          return $q.resolve({message: 'Task created!'})
        })
        .catch(function () {
          return $q.resolve({ message: 'Unable to create task.' })
        })
    },
    fetchAllTasks: function () {
      return $http.get('api/tasks')
        .then(function (allTasks) {
          let refinedTasks = allTasks.data.slice()
          refinedTasks.forEach(function (elem) {
            let curZone = 'America/New_York'
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
        })
        .catch(function () {
          return $q.resolve({ message: 'Unable to fetch tasks.' })
        })
    }
  }
})
