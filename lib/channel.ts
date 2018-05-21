import { Channel as NativeChannel, Connection, Message, Options, Replies } from 'amqplib'
import { EventEmitter } from 'events'
import { AckCache } from './ack-cache'

export type MessageHandler = (message: Message | null) => any

export class Channel extends EventEmitter {
  protected error: any
  protected channel?: NativeChannel
  protected processing: boolean = false
  protected suspended: Array<{ resolve: () => void, reject: (error: any) => void }> = []
  protected ackCache: AckCache = new AckCache()
  private consumerHandlers: { [tag: string]: { queue: string, handler: MessageHandler, options?: Options.Consume } } = {}
  private prefetchCache?: { count: number, global?: boolean }
  private reconnectPromise?: Promise<void>
  private closingByClient: boolean = false

  constructor (channel: NativeChannel, protected connection: Connection) {
    super()
    this.bindNativeChannel(channel)
  }

  protected static extractDeliveryTagFromMessage (message: Message): number {
    return message.fields.deliveryTag
  }

  async consume (queueName: string, handler: MessageHandler, options?: Options.Consume): Promise<Replies.Consume> {
    return this.nativeOperation(async (channel) => {
      const wrappedHandler = async (message: Message | null) => {
        if (message && this.channel) {
          const deliveryTag = Channel.extractDeliveryTagFromMessage(message)
          const cachedOperation = this.ackCache.consumed(queueName, deliveryTag)

          try {
            if (cachedOperation) {
              if (cachedOperation === AckCache.NO_ACK) {
                this.channel.nack(message)
              } else if (cachedOperation === AckCache.ACK) {
                this.channel.ack(message)
              }

              return undefined
            }
          } catch (e) {
            this.emit('error', new Error('Amqp channel wrapper - cached ack/nack failed with message: ' + e.message))
          }
        }

        return handler(message)
      }
      const response = await channel.consume(queueName, wrappedHandler, options)
      this.consumerHandlers[response.consumerTag] = {
        queue: queueName,
        handler: wrappedHandler,
        options
      }

      return response
    })
  }

  async cancel (consumerTag: string): Promise<Replies.Empty> {
    return this.nativeOperation(async (channel) => {
      const result = await channel.cancel(consumerTag)
      delete this.consumerHandlers[consumerTag]

      return result
    })
  }

  async checkQueue (queueName: string): Promise<Replies.AssertQueue> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.checkQueue(queueName))
    })
  }

  async assertQueue (queueName: string, options?: Options.AssertQueue): Promise<Replies.AssertQueue> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.assertQueue(queueName, options))
    })
  }

  async deleteQueue (queueName: string, options?: Options.DeleteQueue): Promise<Replies.DeleteQueue> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.deleteQueue(queueName, options))
    })
  }

  async sendToQueue (queueName: string, content: Buffer, options?: Options.Publish): Promise<boolean> {
    return this.publish('', queueName, content, options)
  }

  async bindQueue (queueName: string, source: string, pattern: string, args?: any): Promise<Replies.Empty> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.bindQueue(queueName, source, pattern, args))
    })
  }

  async unbindQueue (queueName: string, source: string, pattern: string, args?: any): Promise<Replies.Empty> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.unbindQueue(queueName, source, pattern, args))
    })
  }

  async publish (exchange: string, queue: string, content: Buffer, options?: Options.Publish): Promise<boolean> {
    const EVENT_DRAIN = 'drain'
    const EVENT_ERROR = 'error'
    const EVENT_CLOSE = 'close'

    return this.nativeOperation((channel) => {
      return new Promise<boolean>((resolve, reject) => {
        let canSend = false
        try {
          canSend = channel.publish(exchange, queue, content, options)
        } catch (error) {
          reject(error)
        }

        if (canSend) {
          resolve(true)
        } else {
          const eventHandlers: { [key: string]: (...args: any[]) => void } = {}

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

  async prefetch (count: number, global?: boolean): Promise<Replies.Empty> {
    this.prefetchCache = { count, global }
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.prefetch(count, global))
    })
  }

  async assertExchange (exchangeName: string, exchangeType: string, options?: Options.AssertExchange): Promise<Replies.AssertExchange> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.assertExchange(exchangeName, exchangeType, options))
    })
  }

  async checkExchange (exchangeName: string): Promise<Replies.Empty> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.checkExchange(exchangeName))
    })
  }

  async deleteExchange (exchangeName: string, options?: Options.DeleteExchange): Promise<Replies.Empty> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.deleteExchange(exchangeName, options))
    })
  }

  async bindExchange (destination: string, source: string, pattern: string, args?: any): Promise<Replies.Empty> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.bindExchange(destination, source, pattern, args))
    })
  }

  async unbindExchange (destination: string, source: string, pattern: string, args?: any): Promise<Replies.Empty> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.unbindExchange(destination, source, pattern, args))
    })
  }

  ack (message: Message, allUpTo?: boolean): void {
    if (!this.channel) {
      throw new Error('Cannot execute method ack() - channel wrapper not initialized.')
    }

    try {
      if (this.ackCache.ack(message.fields.routingKey, Channel.extractDeliveryTagFromMessage(message))) {
        this.channel.ack(message, allUpTo)
      }

    } catch (e) {
      this.emit('error', e)
    }
  }

  nack (message: Message, allUpTo?: boolean, requeue?: boolean): void {
    if (!this.channel) {
      throw new Error('Cannot execute method nack() - channel wrapper not initialized.')
    }

    try {
      if (this.ackCache.nack(message.fields.routingKey, Channel.extractDeliveryTagFromMessage(message))) {
        return this.channel.nack(message, allUpTo, requeue)
      }

    } catch (e) {
      this.emit('error', e)
    }
  }

  async close (): Promise<void> {
    return this.nativeOperation(async (channel) => {
      this.closingByClient = true
      try {
        await Promise.resolve(channel.close())
      } catch (e) {
        this.closingByClient = false
      }
    })
  }

  async get (queueName: string, options?: Options.Get): Promise<Message | false> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.get(queueName, options)) as Promise<Message | false>
    })
  }

  protected async nativeOperation<T> (operation: (channel: NativeChannel) => Promise<T>): Promise<T> {
    if (this.reconnectPromise) {
      await this.reconnectPromise
    }

    if (this.processing) {
      await new Promise((resolve, reject) => {
        this.suspended.push({
          resolve,
          reject
        })
      })
    }

    this.processing = true

    return new Promise<T>(async (resolve, reject) => {
      try {
        if (!this.channel) {
          reject(new Error())
        } else {
          const result = await operation(this.channel)
          resolve(result)
        }
      } catch (error) {
        reject(this.error)
      }
      this.processUnprocessed()
      this.processing = false
    })
  }

  protected async reconnect (reason?: any): Promise<void> {
    this.emit('reconnect', reason)
    const nativeChannel = await this.connection.createChannel()
    this.bindNativeChannel(nativeChannel)
    await this.checkPrefetchCache()

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

  protected bindNativeChannel (channel: NativeChannel): void {
    channel.once('error', (error) => {
      this.error = error
    })

    channel.once('close', async () => {
      try {
        try {
          this.ackCache.abandon()
        } catch (e) {
          this.emit('error', e)
        }

        if (!this.closingByClient) {
          this.reconnectPromise = this.reconnect(this.error)
          await this.reconnectPromise
        }
      } catch (e) {
        this.emit('error', new Error('Cannot reconnect amqp channel with message: ' + e.message))
      }
    })

    this.channel = channel
  }

  protected async checkPrefetchCache (): Promise<void> {
    if (this.channel && this.prefetchCache) {
      await this.channel.prefetch(this.prefetchCache.count, this.prefetchCache.global)
    }
  }
}
