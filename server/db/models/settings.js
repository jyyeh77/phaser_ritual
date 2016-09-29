'use strict'
// const _ = require('lodash')
const Sequelize = require('sequelize')
const moment = require('moment')
const db = require('../_db')

module.exports = db.define('setting', {
  wakeupTime: {
    type: Sequelize.TIME
  },
  workDays: {
    type: Sequelize.ARRAY(Sequelize.INTEGER)
  }
}, {
  getterMethods: {
    workDay: function () {
      return this.workDays.includes(moment().format('d'))
    }
  },
  setterMethods: {
    duration: function (mins) {
      this.endTime = this.startTime + mins
    }
  },
  instanceMethods: {
  },
  classMethods: {
    isTime: function () {
      let wakeAt = moment(this.wakeupTime)
      let now = moment()
      return now.hour() === wakeAt.hour() && now.minute() === wakeAt.minute()
    },
    wakeUp: function () {
      if (this.workDay && this.isTime()) {
        require('../../interactions/wakeUp')()
      }
    }
  },
  hooks: {
  }
})
