let amqplib = require('amqplib')

const EVENT_DRAIN = 'drain'
const EVENT_ERROR = 'error'
const EVENT_CLOSE = 'close'

class AmqplibAsPromised {
  static wrap (object) {
    amqplib = object
    return this
  }

  static connect (url, socketOptions) {
    return amqplib.connect(url, socketOptions)
      .then(connection => AmqplibConnectionWrapper.wrap(connection))
  }
}

AmqplibAsPromised.credentials = amqplib.credentials

class AmqplibConnectionWrapper {
  static wrap (connection) {
    const createChannel = connection.createChannel.bind(connection)
    connection.createChannel = () => {
      return createChannel()
        .then(channel => AmqplibChannelWrapper.wrap(channel))
    }
    return connection
  }
}

class AmqplibChannelWrapper {
  static wrap (channel) {
    const sendToQueue = channel.sendToQueue.bind(channel)
    channel.sendToQueue = (queue, content, options) => {
      return new Promise((resolve, reject) => {
        let canSend = false
        try {
          canSend = sendToQueue(queue, content, options)
        } catch (error) {
          reject(error)
        }

        if (canSend) {
          resolve()
        } else {
          const eventHandlers = {}

          const eventHandlerWrapper = (eventName) => {
            return eventHandlers[eventName] = () => {
              [EVENT_DRAIN, EVENT_CLOSE, EVENT_ERROR].forEach(event => {
                if (event !== eventName) {
                  channel.removeListener(event, eventHandlers[eventName])
                }
              })

              eventName === EVENT_DRAIN ? resolve() : reject()
            }
          }

          channel.once(EVENT_DRAIN, eventHandlerWrapper(EVENT_DRAIN))
          channel.once(EVENT_ERROR, eventHandlerWrapper(EVENT_ERROR))
          channel.once(EVENT_CLOSE, eventHandlerWrapper(EVENT_CLOSE))
        }
      })
    }
    return channel
  }
}

module.exports = AmqplibAsPromised