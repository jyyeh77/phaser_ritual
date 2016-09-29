'use strict'
const router = require('express').Router()
const User = require('../../../db/models/user.js')
const Message = require('../../../db/models/messages.js')
const Task = require('../../../db/models/todo.js')
const Sequelize = require('sequelize')
const twilio = require('twilio')
module.exports = router

router.post('/', function (req, res, next) {
  console.log(req.body)
  let myUser = {}
  let twiml = new twilio.TwimlResponse()
  User.findOne({
    where: {
      phone: Number(req.body.Caller.slice(2))
    }
  })
    .then(function (foundUser) {
      myUser = foundUser
      console.log('User: ' + foundUser.email)
      return Task.findAll({
        where: {
          userId: foundUser.id
        }
      })
    })
    .then(function (foundTodos) {
      console.log('Todos: ' + foundTodos)
      if (foundTodos !== null && foundTodos !== undefined && foundTodos.length > 0) {
        let taskStr = ''
        foundTodos.forEach(function (elem) {
          taskStr += elem.task + ', '
        })
        twiml.say('Hello, ' + myUser.email + ' thanks for reaching out! Your tasks today are ' + taskStr + ' so get to! Goodbye.', { voice: 'alice' })
        res.type('text/xml')
        res.send(twiml.toString())
      } else {
        twiml.say('Hello, ' + myUser.email + ' thanks for reaching out! You have no tasks today.', { voice: 'alice' })
        res.type('text/xml')
        res.send(twiml.toString())
      }
    })
    .catch(function (error) {
      twiml.say('Catastrophic failure!', { voice: 'man' })
      res.type('text/xml')
      res.send(twiml.toString())
    })
})
