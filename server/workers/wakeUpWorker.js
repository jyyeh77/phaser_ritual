var User = require('../db/models/user')

var notificationWorkerFactory = function () {
  return {
    run: function () {
      User.findAll()
        .then(users => Promise.all(users.map(user => user.getCurrent()
          .then(current => current
            ? current.run()
            : user.findNext())
        )))
        .then(nexts => nexts.map(next => {
          return next
            ? next.run()
            : null
        }))
    }
  }
}

module.exports = notificationWorkerFactory()
