'use strict'
var chalk = require('chalk')
var db = require('./db')
// var user = require('./db/models/user')
// Create a node server instance! cOoL!
var server = require('http').createServer()

var createApplication = function () {
  var app = require('./app')(db)
  server.on('request', app) // Attach the Express application.
  require('./io')(server) // Attach socket.io.
}

var startServer = function () {
  var PORT = process.env.PORT || 1337

  server.listen(PORT, function () {
    console.log(chalk.blue('Server started on port', chalk.magenta(PORT)))
  })
}

var schedule = require('./workers/scheduler')

db.sync().then(createApplication).then(startServer)
  .then(schedule.start)
  .catch(function (err) {
    console.error(chalk.red(err.stack))
  })
