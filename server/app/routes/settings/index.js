const router = require('express').Router()
const User = require('../../../db/models/user.js')
const Sequelize = require('sequelize')
// eslint-disable-line new-cap
module.exports = router

var ensureAuthenticated = function (req, res, next) {
  if (req.isAuthenticated()) {
    next()
  } else {
    res.status(401).send({message: 'Not currently logged in, cannot modify settings.'})
  }
}

router.post('/', ensureAuthenticated, function (req, res, next) {
  User.findOne({
    where: {
      id: req.user.id
    }
  })
    .then(function (foundUser) {
      foundUser.workDays = req.body.workdays
      foundUser.wakeupTime = req.body.waketime
      return foundUser.save()
    })
    .then(function (updatedUser) {
      console.log('User settings updated/created successfully!')
      res.status(200).send({message: 'Successful update!'})
    })
    .catch(function (error) {
      next(error)
    })
})

// Will fetch current settings.
router.get('/', function (req, res, next) {
  next()
})
