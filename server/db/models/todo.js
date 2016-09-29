'use strict'
// const _ = require('lodash')
const Moment = require('moment-timezone')
const Sequelize = require('sequelize')
const wakeUp = require('../../interactions/wakeUp')
const startTask = require('../../interactions/startTask')
const endTask = require('../../interactions/endTask')
const db = require('../_db')

module.exports = db.define('todo', {
  task: {
    type: Sequelize.STRING,
    allowNull: false
  },
  startTime: {
    type: Sequelize.DATE,
    allowNull: false
  },
  endTime: {
    type: Sequelize.DATE,
    allowNull: false
  },
  active: {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  },
  complete: {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  }
}, {
  getterMethods: {
    duration: function () {
      return this.end.diff(this.start, 'minute')
    },
    start: function () {
      return Moment(this.startTime)
    },
    end: function () {
      return Moment(this.endTime)
    }
  },
  setterMethods: {
    duration: function (mins) {
      this.endTime = Moment(this.startTime).add(mins, 'minute')
    },
    start: function (momentObj) {
      this.startTime = momentObj
    }
  // end: function (momentObj) {
  //   this.endTime = momentObj.toDate()
  // }
  },
  instanceMethods: {
    run: function () {
      console.log('running, ', this.userId, this.task)
      let now = Moment()
      if (now.isSame(this.start, 'minute')) {
        this.update({active: true})
        this.getUser()
          .then(user => {
            if (this.task === 'Ritual Schedule Setting') wakeUp(user)
            else startTask(this, user.phone)
          })
      } else if (now.isSame(this.end, 'minute') && this.task !== 'Ritual Schedule Setting') {
        this.getUser()
          .then(user => endTask(this, user.phone))
      }
    }
  },
  classMethods: {
  },
  hooks: {
  }
})
