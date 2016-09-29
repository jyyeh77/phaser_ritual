'use strict'
const router = require('express').Router()
const User = require('../../../db/models/user.js')
const Sequelize = require('sequelize')
const wakeUp = require('../../../interactions/wakeUp.js')
// eslint-disable-line new-cap
module.exports = router

router.post('/', function (req, res, next) {
  let inputData = req.body
  inputData.isAdmin = false
  inputData.phone = inputData.phone
  User.create(inputData)
    .then(() => {
      wakeUp(inputData)
      res.status(200).send('User created successfully!')
    })
    .catch(Sequelize.ValimdationError, function (err) {
      res.status(422).send(err.errors)
    })
    .catch(function (err) {
      res.status(400).send({
        message: err.message
      })
    })
})
