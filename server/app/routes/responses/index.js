'use strict'
const router = require('express').Router()
const User = require('../../../db/models/user.js')
const Message = require('../../../db/models/messages.js')
const Task = require('../../../db/models/todo.js')
const Sequelize = require('sequelize')
const twilio = require('twilio')
const co = require('co')
const Moment = require('moment-timezone')
const asocket = require('../../../io')
module.exports = router

router.get('/', function (req, res, next) {
  console.log(req.body)
  next()
})

router.post('/', function (req, res, next) {
  co(function * () {
    console.log(req.body)
    let message = req.body.Body
    let twiml = new twilio.TwimlResponse()
    let user = yield User.findOne({where: {phone: Number(req.body.From.slice(2))}})
    try {
      let parsed = [].concat(...(message.split('@').map(elem => elem.split('!')))).map(elem => elem.trim())
      console.log(parsed)
      let duration = parsed[2].split(':').map(Number).reduce((a, b) => 60 * a + b)
      let time = Moment.tz(parsed[1], 'h:mm A', 'America/New_York')
      console.log('change to ny time', time)
      let refinedTime = Moment.tz(time, 'UTC').format()
      console.log('change to utc time', refinedTime)
      let created = yield Task.create({
        task: parsed[0],
        start: refinedTime,
        duration: duration
      })
      yield user.addTodo(created)
    } catch(e) {
      console.log('caught', e)
    } finally {
      res.writeHead(200, {'Content-Type': 'text/xml'})
      res.end(twiml.toString())
    }
  })
})
