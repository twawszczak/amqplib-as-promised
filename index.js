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

    connection.waitForClose = () => {
      return new Promise((resolve) => {
        connection.on('close', () => {
          resolve()
        })
      })
    }

    return connection
  }
}

class AmqplibChannelWrapper {
  static wrap (channel) {
    const publish = channel.publish.bind(channel)
    channel.publishWithConfirmation = (exchange, queue, content, options) => {
      return new Promise((resolve, reject) => {
        let canSend = false
        try {
          canSend = publish(exchange, queue, content, options)
        } catch (error) {
          reject(error)
        }

        if (canSend) {
          resolve()
        } else {
          const eventHandlers = {}

          const eventHandlerWrapper = (specificEventName) => {
            eventHandlers[specificEventName] = (handlerArg) => {
              [EVENT_DRAIN, EVENT_CLOSE, EVENT_ERROR].forEach(eventName => {
                if (eventName !== specificEventName) {
                  channel.removeListener(eventName, eventHandlers[eventName])
                }
              })

              specificEventName === EVENT_DRAIN ? resolve() : reject(String(handlerArg))
            }

            return eventHandlers[specificEventName]
          }

          channel.once(EVENT_DRAIN, eventHandlerWrapper(EVENT_DRAIN))
          channel.once(EVENT_ERROR, eventHandlerWrapper(EVENT_ERROR))
          channel.once(EVENT_CLOSE, eventHandlerWrapper(EVENT_CLOSE))
        }
      })
    }

    channel.sendToQueueWithConfirmation = (queue, content, options) => {
      return channel.publishWithConfirmation('', queue, content, options)
    }

    return channel
  }
}

module.exports = AmqplibAsPromised
