var Sequelize = require('sequelize')
var db = require('../_db')

module.exports = db.define('message', {
  body: Sequelize.STRING,
  phone: Sequelize.FLOAT,
  fromUser: Sequelize.BOOLEAN
})
