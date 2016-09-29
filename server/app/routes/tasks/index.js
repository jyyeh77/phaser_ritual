'use strict'
const router = require('express').Router()
const Task = require('../../../db/models/todo.js')
const User = require('../../../db/models/user.js')
const Sequelize = require('sequelize')
const Moment = require('moment-timezone')
// eslint-disable-line new-cap
module.exports = router

var ensureAuthenticated = function (req, res, next) {
  if (req.isAuthenticated()) {
    next()
  } else {
    res.status(401).send({message: 'Not currently logged in, cannot modify settings.'})
  }
}

// Create new task. - Will use a seperate route for twilio that will
// search users by phone number.
router.post('/', ensureAuthenticated, function (req, res, next) {
  let taskInfo = req.body
  console.log('Start timme: ')
  console.log(taskInfo.startTime)
  let refinedTaskInfo = {
    task: taskInfo.title,
    start: Moment.tz(taskInfo.startTime, 'UTC').format(),
    duration: taskInfo.lhour * 60 + taskInfo.lminute
  }
  console.log('Start date: ')
  console.log(refinedTaskInfo.start)
  let storeTask = {}
  Task.create(refinedTaskInfo)
    .then(function (createdTask) {
      storeTask = createdTask
      User.findOne({
        where: {
          id: req.user.id
        }
      })
        .then(function (foundUser) {
          return storeTask.setUser(foundUser)
        })
        .then(function () {
          console.log('New task created and associated.')
          res.status(200).send({message: 'New task created.'})
        })
        .catch(function (error) {
          next(error)
        })
    })
})

// Fetch all tasks.
router.get('/', ensureAuthenticated, function (req, res, next) {
  Task.findAll({
    where: {
      userId: req.user.id
    }
  })
    .then(function (foundTasks) {
      let refinedTasks = foundTasks.slice()
      refinedTasks.forEach(function (elem) {
        elem.startTime = Moment.tz(elem.startTime, 'UTC')
      })
      res.status(200).json(foundTasks)
    })
    .catch(function (error) {
      next(error)
    })
})

// Fetch single task.
router.get('/:id', ensureAuthenticated, function (req, res, next) {
  Task.findOne({
    where: {
      id: req.params.id
    }
  })
    .then(function (foundTask) {
      res.status(200).json(foundTask)
    })
    .catch(function (error) {
      next(error)
    })
})
