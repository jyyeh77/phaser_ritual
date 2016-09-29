const texts = require('./messages').wakeUp
const twilioText = require('./twilioText')
const called = {}

function * makeContact (phone) {
  let stop = false
  for (let text of texts) {
    stop = (yield) || stop
    if (!stop) twilioText(phone, text)
  }
  delete called[phone]
}

module.exports = function wakeUpProcess (user, responded = false) {
  let phone = user.phone
  if (!Object.keys(called).includes(String(phone))) {
    called[String(phone)] = makeContact(phone)
    let it = called[phone]
    it.next()
    it.next(responded)
    for (let i = 1; i < texts.length; i++) {
      setTimeout(() => it.next(), i * 5000)
    }
    user.getCurrent().then(current => current.update({active: false, complete: true}))
  } else {
    if (responded) (called[phone].return(true))
  }
}
