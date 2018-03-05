import amqplib from 'amqplib'

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

  async cancel (tag: string): Promise<amqplib.Replies.Empty> {
    return this.nativeOperation(async (channel) => {
      const result = await channel.cancel(tag)
      delete this.consumerHandlers[tag]

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
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.sendToQueue(queueName, content, options))
    })
  }

  async prefetch (count: number, global: boolean): Promise<void> {
    return this.nativeOperation((channel) => {
      return Promise.resolve(channel.prefetch(count, global))
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

  protected async nativeOperation (operation: (channel: amqplib.Channel) => Promise<any>): Promise<any> {
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
    })
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
