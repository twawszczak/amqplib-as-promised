let amqplib = require('amqplib')

class AmqplibAsPromised {
  static wrap (object) {
    amqplib = object
    return this
  }

  static connect (url, socketOptions) {
    return amqplib.connect(url, socketOptions)
      .then(connection => AmqplibConnectionWrapper.wrap(connection)
      )
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
        try {
          const canSend = sendToQueue(queue, content, options)
          if (canSend) {
            resolve()
          } else {
            channel.once('drain', resolve)
            channel.once('error', reject)
          }
        } catch (error) {
          reject(error)
        }
      })
    }
    return channel
  }
}

module.exports = AmqplibAsPromised