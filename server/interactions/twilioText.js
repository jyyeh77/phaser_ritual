const twilio = require('./_twilio')

module.exports = function (a, b) {
  twilio.client.messages.create({
    to: `+1${a}`,
    from: twilio.number,
    body: b
  }, function (err, message) {
    if (err) console.log(err)
    console.log(message.sid)
  })
}
//   console.log(`texting ${a}: ${b}`)
// }
