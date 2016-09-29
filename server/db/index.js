'use strict'
const db = require('./_db')
module.exports = db

const User = require('./models/user')
const Todo = require('./models/todo')
const Message = require('./models/messages')

Todo.belongsTo(User)
User.hasMany(Todo)
Todo.hasMany(Message)
