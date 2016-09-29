const Moment = require('moment')
const db = require('../db')
const User = db.model('user')
const Todo = db.model('todo')
module.exports = function makeWakeUpTask () {
  User.findAll()
    .then(users => {
      users.forEach(user => {
        if (user.workDay) {
          Todo.create({
            task: 'Ritual Schedule Setting',
            start: Moment(user.wakeupTime, 'HH:mm'),
            duration: 10
          }).then(todo => user.addTodo(todo))
        }
      })
    })
}
