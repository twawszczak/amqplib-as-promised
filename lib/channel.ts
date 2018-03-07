import amqplib, { Message } from 'amqplib'

export type MessageHandler = (message: amqplib.Message | null) => any

export class Channel {
  protected error: any
  protected channel?: amqplib.Channel
  protected processing: boolean = false
  protected suspended: Array<{ resolve: () => void, reject: (error: any) => void }> = []
  protected consumerHandlers: { [tag: string]: { queue: string, handler: MessageHandler, options?: amqplib.Options.Consume } } = {}

  constructor (channel: amqplib.Channel, protected connection: amqplib.Connection) {
    this.bindNativeChannel(channel)
  }

  async consume (queueName: string, handler: MessageHandler, options?: amqplib.Options.Consume): Promise<amqplib.Replies.Consume> {
    return this.nativeOperation(async (channel) => {
      const response = await channel.consume(queueName, handler, options)
      this.consumerHandlers[response.consumerTag] = {
        queue: queueName,
        handler,
        options
      }

      return response
    })
  }

  async cancel (consumerTag: string): Promise<amqplib.Replies.Empty> {
    return this.nativeOperation(async (channel) => {
      const result = await channel.cancel(consumerTag)
      delete this.consumerHandlers[consumerTag]

      return result
    })
  }

  async checkQueue (queueName: string): Promise<amqplib.Replies.AssertQueue> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.checkQueue(queueName))
    })
  }

  async assertQueue (queueName: string, options?: amqplib.Options.AssertQueue): Promise<amqplib.Replies.AssertQueue> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.assertQueue(queueName, options))
    })
  }

  async deleteQueue (queueName: string, options?: amqplib.Options.DeleteQueue): Promise<amqplib.Replies.DeleteQueue> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.deleteQueue(queueName, options))
    })
  }

  async sendToQueue (queueName: string, content: Buffer, options?: amqplib.Options.Publish): Promise<boolean> {
    return this.publish('', queueName, content, options)
  }

  async publish (exchange: string, queue: string, content: Buffer, options?: amqplib.Options.Publish): Promise<boolean> {
    const EVENT_DRAIN = 'drain'
    const EVENT_ERROR = 'error'
    const EVENT_CLOSE = 'close'

    return this.nativeOperation<boolean>((channel) => {
      return new Promise((resolve, reject) => {
        let canSend = false
        try {
          canSend = channel.publish(exchange, queue, content, options)
        } catch (error) {
          reject(error)
        }

        if (canSend) {
          resolve(true)
        } else {
          const eventHandlers: {[key: string]: (...args: any[]) => void} = {}

          const eventHandlerWrapper = (specificEventName: string) => {
            eventHandlers[specificEventName] = (handlerArg) => {
              [EVENT_DRAIN, EVENT_CLOSE, EVENT_ERROR].forEach((eventName) => {
                if (eventName !== specificEventName) {
                  channel.removeListener(eventName, eventHandlers[eventName])
                }
              })

              specificEventName === EVENT_DRAIN ? resolve(true) : reject(String(handlerArg))
            }

            return eventHandlers[specificEventName]
          }

          channel.once(EVENT_DRAIN, eventHandlerWrapper(EVENT_DRAIN))
          channel.once(EVENT_ERROR, eventHandlerWrapper(EVENT_ERROR))
          channel.once(EVENT_CLOSE, eventHandlerWrapper(EVENT_CLOSE))
        }
      })
    })
  }

  async prefetch (count: number, global: boolean): Promise<amqplib.Replies.Empty> {
    return this.nativeOperation<amqplib.Replies.Empty>((channel) => {
      return Promise.resolve(channel.prefetch(count, global))
    })
  }

  async assertExchange (exchangeName: string, exchangeType: string, options?: amqplib.Options.AssertExchange): Promise<amqplib.Replies.AssertExchange> {
    return this.nativeOperation<amqplib.Replies.AssertExchange>((channel) => {
      return Promise.resolve(channel.assertExchange(exchangeName, exchangeType, options))
    })
  }

  async checkExchange (exchangeName: string): Promise<amqplib.Replies.Empty> {
    return this.nativeOperation<amqplib.Replies.Empty>((channel) => {
      return Promise.resolve(channel.checkExchange(exchangeName))
    })
  }

  async deleteExchange (exchangeName: string, options: amqplib.Options.DeleteExchange): Promise<amqplib.Replies.Empty> {
    return this.nativeOperation<amqplib.Replies.Empty>((channel) => {
      return Promise.resolve(channel.deleteExchange(exchangeName, options))
    })
  }

  async bindExchange (destination: string, source: string, pattern: string, args?: any): Promise<amqplib.Replies.Empty> {
    return this.nativeOperation<amqplib.Replies.Empty>((channel) => {
      return Promise.resolve(channel.bindExchange(destination, source, pattern, args))
    })
  }

  async unbindExchange (destination: string, source: string, pattern: string, args?: any): Promise<amqplib.Replies.Empty> {
    return this.nativeOperation<amqplib.Replies.Empty>((channel) => {
      return Promise.resolve(channel.unbindExchange(destination, source, pattern, args))
    })
  }

  ack (message: amqplib.Message, allUpTo?: boolean): void {
    if (!this.channel) {
      throw new Error('Cannot execute method ack() - channel wrapper not initialized.')
    }

    return this.channel.ack(message, allUpTo)
  }

  nack (message: amqplib.Message, allUpTo?: boolean, requeue?: boolean): void {
    if (!this.channel) {
      throw new Error('Cannot execute method nack() - channel wrapper not initialized.')
    }

    return this.channel.nack(message, allUpTo, requeue)
  }

  async close (): Promise<void> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.close())
    })
  }

  async get (queueName: string, options?: amqplib.Options.Get): Promise<Message | boolean> {
    return this.nativeOperation<Message | boolean>((channel) => {
      return Promise.resolve(channel.get(queueName, options))
    })
  }

  protected async nativeOperation<T> (operation: (channel: amqplib.Channel) => Promise<T>): Promise<T> {
    if (this.processing) {
      await new Promise((resolve, reject) => {
        this.suspended.push({
          resolve,
          reject
        })
      })
    }

    this.processing = true

    return new Promise(async (resolve, reject) => {
      try {
        if (!this.channel) {
          reject(new Error())
        } else {
          const result = await operation(this.channel)
          resolve(result)
        }
      } catch (error) {
        await this.reconnect()
        reject(this.error)
      }
      this.processUnprocessed()
      this.processing = false
    }) as Promise<T>
  }

  protected async reconnect (): Promise<void> {
    const nativeChannel = await this.connection.createChannel()
    this.bindNativeChannel(nativeChannel)
    await this.bindConsumersAfterReconnect()
  }

  protected async bindConsumersAfterReconnect (): Promise<void> {
    if (!this.channel) {
      throw new Error('Cannot bind consumers after reconnect - channel not exists.')
    }

    for (const tag of Object.keys(this.consumerHandlers)) {
      const consumer = this.consumerHandlers[tag]
      const tagOption = { consumerTag: tag }
      await this.channel.consume(
        consumer.queue,
        consumer.handler,
        consumer.options ? { ...consumer.options, ...tagOption } : tagOption
      )
    }
  }

  protected processUnprocessed (): void {
    const unprocessed = this.suspended.shift()

    if (unprocessed) {
      unprocessed.resolve()
    }
  }

  protected bindNativeChannel (channel: amqplib.Channel): void {
    channel.once('error', (error) => {
      this.error = error
    })

    this.channel = channel
  }
}
