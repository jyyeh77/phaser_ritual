'use strict'
var router = require('express').Router()
module.exports = router
const wakeUp = require('../../interactions/wakeUp')
const User = require('../../db/models/user')

router.use('/members', require('./members'))
router.use('/signup', require('./signup'))
router.use('/settings', require('./settings'))
router.use('/tasks', require('./tasks'))
router.use('/responses', require('./responses'))
router.use('/callresponses', require('./callresponses'))

router.get('/stop/:number', function (req, res, next) {
  wakeUp(req.params.number, true)
})

router.get('/user', function (req, res, next) {
  User.findAll().then(data => Promise.all(data.map(elem => elem.findNext()))).then(data => res.send(data))
})
// Make sure this is after all of
// the registered routes!
router.use(function (req, res) {
  res.status(404).end()
})
