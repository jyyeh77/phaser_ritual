'use strict'
var crypto = require('crypto')
var _ = require('lodash')
var Sequelize = require('sequelize')
const moment = require('moment')

var db = require('../_db')

module.exports = db.define('user', {
  email: {
    type: Sequelize.STRING
  },
  password: {
    type: Sequelize.STRING
  },
  salt: {
    type: Sequelize.STRING
  },
  phone: {
    type: Sequelize.FLOAT
  },
  isAdmin: {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  },
  wakeupTime: {
    type: Sequelize.STRING
  },
  workDays: {
    type: Sequelize.ARRAY(Sequelize.INTEGER),
    defaultValue: []
  }
// messagesSent: {
//   type: Sequelize.ARRAY(Sequelize.STRING),
//   defaultValue: []
// },
// responses: {
//   type: Sequelize.ARRAY(Sequelize.STRING),
//   defaultValue: []
// },
// lastContacted: {
//   type: Sequelize.TIME
// },
// lastReplied: {
//   type: Sequelize.TIME
// },
// isActive: {
//   type: Sequelize.BOOLEAN,
//   defaultValue: false
// }
// twitter_id: {
//   type: Sequelize.STRING
// },
// facebook_id: {
//   type: Sequelize.STRING
// },
// google_id: {
//   type: Sequelize.STRING
// }
}, {
  getterMethods: {
    workDay: function () {
      return this.workDays.includes(Number(moment().format('d')))
    }
  },
  instanceMethods: {
    sanitize: function () {
      return _.omit(this.toJSON(), ['password', 'salt'])
    },
    correctPassword: function (candidatePassword) {
      return this.Model.encryptPassword(candidatePassword, this.salt) === this.password
    },
    getCurrent: function () {
      console.log('getting for ', this.email)
      return this.getTodos({where: {active: true}})
        .then(todos => todos.length > 0 ? todos[0] : false)
    },
    findNext: function () {
      return this.getTodos({where: {active: false, complete: false}, order: ['startTime']})
        .then(arr => arr[0] || null)
    }
  // isTime: function () {
  //   let wakeAt = moment(this.wakeupTime, 'HH:mm')
  //   let now = moment()
  //   return now.hour() === wakeAt.hour() && now.minute() === wakeAt.minute()
  // },
  // wakeUp: function () {
  //   if (this.workDay && this.isTime()) {
  //     wakeUpCall(this.phone)
  //   }
  // },
  // addSent: function (message) {
  //   this.lastContacted = new Date()
  //   this.messagesSent.push(message)
  // },
  // addResponse: function (message) {
  //   this.lastReplied = new Date()
  //   this.responses.push(message)
  // },
  // reset: function() {
  //   this.lastContacted = null
  //   this.lastReplied = null
  //   this.messagesSent= []
  //   this.responses = []
  // }
  },
  classMethods: {
    generateSalt: function () {
      return crypto.randomBytes(16).toString('base64')
    },
    encryptPassword: function (plainText, salt) {
      var hash = crypto.createHash('sha1')
      hash.update(plainText)
      hash.update(salt)
      return hash.digest('hex')
    }
  },
  hooks: {
    beforeValidate: function (user) {
      if (user.changed('password')) {
        user.salt = user.Model.generateSalt()
        user.password = user.Model.encryptPassword(user.password, user.salt)
      }
    }
  }
})
