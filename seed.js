/*

This seed file is only a placeholder. It should be expanded and altered
to fit the development of your application.

It uses the same file the server uses to establish
the database connection:
--- server/db/index.js

The name of the database used is set in your environment files:
--- server/env/*

This seed file has a safety check to see if you already have users
in the database. If you are developing multiple applications with the
fsg scaffolding, keep in mind that fsg always uses the same database
name in the environment files.

*/
var moment = require('moment')
var info = require('./private')
var chalk = require('chalk')
var db = require('./server/db')
var User = db.model('user')
var Promise = require('sequelize').Promise

console.log(moment().add(1, 'minute').format('HH:mm'))
var seedUsers = function () {
  var users = [
    {
      email: 'testing@fsa.com',
      password: 'password'
    },
    {
      email: 'obama@gmail.com',
      password: 'potus'
    },
    {
      email: 'eliot@admin.com',
      password: 'admin123',
      workDays: [0, 1, 2, 3, 4, 5, 6],
      wakeupTime: moment().add(1, 'minute').format('HH:mm'),
      phone: info.numbers.eliot
    }
  ]

  var creatingUsers = users.map(function (userObj) {
    return User.create(userObj)
  })

  return Promise.all(creatingUsers)
}

db.sync({ force: true })
  .then(function () {
    return seedUsers()
  })
  .then(function () {
    console.log(chalk.green('User Seed successful!'))
    process.exit(0)
  })
  .catch(function (err) {
    console.error(err)
    process.exit(1)
  })
