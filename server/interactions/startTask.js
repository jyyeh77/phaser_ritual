const makeTexts = require('./messages').startTask
const twilioText = require('./twilioText')
const called = {}

function * makeContact (texts, phone) {
  let stop = false
  for (let text of texts) {
    stop = (yield) || stop
    if (!stop) twilioText(phone, text)
  }
  delete called[phone]
}

module.exports = function wakeUpProcess (task, phone, responded = false) {
  if (!Object.keys(called).includes(String(phone))) {
    let texts = makeTexts(task)
    called[String(phone)] = makeContact(texts, phone)
    let it = called[phone]
    it.next()
    it.next(responded)
    for (let i = 1; i < texts.length; i++) {
      setTimeout(() => it.next(), i * 5000)
    }
  } else {
    if (responded) (called[phone].return(true))
  }
}
