import { Channel as NativeChannel, Message, Options, Replies } from 'amqplib'
import { EventEmitter } from 'events'

import { Connection } from './connection'

export type MessageHandler = (message: Message | null) => any

export class Channel extends EventEmitter {
  protected error: any
  protected channel?: NativeChannel
  protected processing: boolean = false
  protected suspended: Array<{ resolve: () => void; reject: (error: any) => void }> = []
  protected consumerHandlers: {
    [tag: string]: { queue: string; handler: MessageHandler; options?: Options.Consume }
  } = {}
  private prefetchCache?: { count: number; global?: boolean }
  private reconnectPromise?: Promise<void>
  private closingByClient: boolean = false

  constructor(channel: NativeChannel, protected connection: Connection) {
    super()
    this.bindNativeChannel(channel)
  }

  async consume(queueName: string, handler: MessageHandler, options?: Options.Consume): Promise<Replies.Consume> {
    return this.nativeOperation(async (channel) => {
      const response = await channel.consume(queueName, handler, options)
      this.consumerHandlers[response.consumerTag] = {
        queue: queueName,
        handler,
        options,
      }

      return response
    })
  }

  async cancel(consumerTag: string): Promise<Replies.Empty> {
    return this.nativeOperation(async (channel) => {
      const result = await channel.cancel(consumerTag)
      delete this.consumerHandlers[consumerTag]

      return result
    })
  }

  async checkQueue(queueName: string): Promise<Replies.AssertQueue> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.checkQueue(queueName))
    })
  }

  async assertQueue(queueName: string, options?: Options.AssertQueue): Promise<Replies.AssertQueue> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.assertQueue(queueName, options))
    })
  }

  async deleteQueue(queueName: string, options?: Options.DeleteQueue): Promise<Replies.DeleteQueue> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.deleteQueue(queueName, options))
    })
  }

  async sendToQueue(queueName: string, content: Buffer, options?: Options.Publish): Promise<unknown> {
    return this.publish('', queueName, content, options)
  }

  async bindQueue(queueName: string, source: string, pattern: string, args?: any): Promise<Replies.Empty> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.bindQueue(queueName, source, pattern, args))
    })
  }

  async unbindQueue(queueName: string, source: string, pattern: string, args?: any): Promise<Replies.Empty> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.unbindQueue(queueName, source, pattern, args))
    })
  }

  async publish(exchange: string, queue: string, content: Buffer, options?: Options.Publish): Promise<unknown> {
    const EVENT_DRAIN = 'drain'
    const EVENT_ERROR = 'error'
    const EVENT_CLOSE = 'close'

    return this.nativeOperation((channel) => {
      return new Promise<void>((resolve, reject) => {
        let canSend = false
        try {
          canSend = channel.publish(exchange, queue, content, options)
        } catch (error) {
          reject(error)
        }

        if (canSend) {
          resolve()
        } else {
          const eventHandlers: { [key: string]: (...args: any[]) => void } = {}

          const eventHandlerWrapper = (specificEventName: string) => {
            eventHandlers[specificEventName] = (handlerArg) => {
              ;[EVENT_DRAIN, EVENT_CLOSE, EVENT_ERROR].forEach((eventName) => {
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
    })
  }

  async prefetch(count: number, global?: boolean): Promise<Replies.Empty> {
    this.prefetchCache = { count, global }
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.prefetch(count, global))
    })
  }

  async assertExchange(
    exchangeName: string,
    exchangeType: string,
    options?: Options.AssertExchange,
  ): Promise<Replies.AssertExchange> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.assertExchange(exchangeName, exchangeType, options))
    })
  }

  async checkExchange(exchangeName: string): Promise<Replies.Empty> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.checkExchange(exchangeName))
    })
  }

  async deleteExchange(exchangeName: string, options?: Options.DeleteExchange): Promise<Replies.Empty> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.deleteExchange(exchangeName, options))
    })
  }

  async bindExchange(destination: string, source: string, pattern: string, args?: any): Promise<Replies.Empty> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.bindExchange(destination, source, pattern, args))
    })
  }

  async unbindExchange(destination: string, source: string, pattern: string, args?: any): Promise<Replies.Empty> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.unbindExchange(destination, source, pattern, args))
    })
  }

  ack(message: Message, allUpTo?: boolean): void {
    if (!this.channel) {
      throw new Error('Cannot execute method ack() - channel wrapper not initialized.')
    }

    return this.channel.ack(message, allUpTo)
  }

  nack(message: Message, allUpTo?: boolean, requeue?: boolean): void {
    if (!this.channel) {
      throw new Error('Cannot execute method nack() - channel wrapper not initialized.')
    }

    return this.channel.nack(message, allUpTo, requeue)
  }

  async close(): Promise<void> {
    return this.nativeOperation(async (channel) => {
      this.closingByClient = true
      try {
        await Promise.resolve(channel.close())
      } catch (e) {
        this.closingByClient = false
      }
    })
  }

  async get(queueName: string, options?: Options.Get): Promise<Message | false> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.get(queueName, options)) as Promise<Message | false>
    })
  }

  protected async nativeOperation<T>(operation: (channel: NativeChannel) => Promise<T>): Promise<T> {
    if (this.reconnectPromise) {
      await this.reconnectPromise
    }

    if (this.processing) {
      await new Promise((resolve, reject) => {
        this.suspended.push({
          resolve,
          reject,
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

  protected async reconnect(reason?: any): Promise<void> {
    if (this.connection.finallyClosed) {
      return
    }

    this.emit('reconnect', reason)
    const nativeChannel = await this.connection.createNativeChannel()
    this.bindNativeChannel(nativeChannel)
    await this.checkPrefetchCache()

    await this.bindConsumersAfterReconnect()
  }

  protected async bindConsumersAfterReconnect(): Promise<void> {
    if (!this.channel) {
      throw new Error('Cannot bind consumers after reconnect - channel not exists.')
    }

    for (const tag of Object.keys(this.consumerHandlers)) {
      const consumer = this.consumerHandlers[tag]
      const tagOption = { consumerTag: tag }
      await this.channel.consume(
        consumer.queue,
        consumer.handler,
        consumer.options ? { ...consumer.options, ...tagOption } : tagOption,
      )
    }
  }

  protected processUnprocessed(): void {
    const unprocessed = this.suspended.shift()

    if (unprocessed) {
      unprocessed.resolve()
    }
  }

  protected bindNativeChannel(channel: NativeChannel): void {
    const onClose = async () => {
      channel.removeListener('error', onError)
      try {
        if (!this.closingByClient) {
          this.reconnectPromise = this.reconnect(this.error)
          await this.reconnectPromise
        }
      } catch (e) {
        this.emit('error', new Error('Cannot reconnect amqp channel with message: ' + e.message))
      }
    }

    const onError = (err: Error) => {
      this.error = err
    }

    channel.once('close', onClose)
    channel.once('error', onError)

    this.channel = channel
  }

  protected async checkPrefetchCache(): Promise<void> {
    if (this.channel && this.prefetchCache) {
      await this.channel.prefetch(this.prefetchCache.count, this.prefetchCache.global)
    }
  }
}
