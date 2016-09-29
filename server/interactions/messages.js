module.exports = {
  wakeUp: [`Ready to get to Work? Tell us:
    what you want to do @ what time ! how long`,
    'Hey, you really should be telling us what you want to get done if you want to be productive today!',
    'You gonna get your shit done today?',
    'Enjoy your procrastination, you failure'],
  startTask: task => [`It's time to ${task.task}. You have ${task.duration}, minutes.`,
    `Hey you gonna ${task.task} or not?`,
    `Enjoy failing to ${task.task}.`]
}
