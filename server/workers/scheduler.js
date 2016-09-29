var CronJob = require('cron').CronJob
var wakeUpWorker = require('./wakeUpWorker')
const makeWakeUpTask = require('./makeWakeUpTask')
var moment = require('moment')

var schedulerFactory = function () {
  makeWakeUpTask()
  return {
    start: function () {
      new CronJob('00 * * * * *', function () {
        console.log('Running Send Notifications Worker for ' + moment().format())
        wakeUpWorker.run()
      }, null, true, '')
      new CronJob('00 00 * * *', function () {
        console.log('Running setSchedule Worker for ' + moment().format())
        makeWakeUpTask()
      }, null, true, '')
    }
  }
}

module.exports = schedulerFactory()
