const info = require('../../private').twilio
const accountSid = info.TWILIO_ACCOUNT_SID // Your Account SID from www.twilio.com/console
const authToken = info.TWILIO_AUTH_TOKEN // Your Auth Token from www.twilio.com/console
const number = info.TWILIO_PHONE_NUMBER

const twilioLibrary = require('twilio')
const client = new twilioLibrary.Twilio(accountSid, authToken)

module.exports = {client, number}
