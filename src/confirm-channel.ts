import { Channel as NativeChannel, ConfirmChannel as NativeConfirmChannel, Options, Replies } from 'amqplib'

import { Channel } from './channel'
import { Connection } from './connection'

export class ConfirmChannel extends Channel {
  protected channel?: NativeConfirmChannel

  constructor(channel: NativeConfirmChannel, protected connection: Connection) {
    super(channel, connection)
  }

  async publish(exchange: string, queue: string, content: Buffer, options?: Options.Publish): Promise<Replies.Empty> {
    return this.nativeOperation((confirmChannel: NativeConfirmChannel) => {
      return new Promise<Replies.Empty>((resolve, reject) => {
        confirmChannel.publish(exchange, queue, content, options, (err: Error | null, ok) => {
          if (err) reject(err)
          else resolve(ok)
        })
      })
    })
  }

  async waitForConfirms(): Promise<void> {
    return this.nativeOperation((confirmChannel: NativeConfirmChannel) => {
      return new Promise<void>((resolve, reject) => {
        confirmChannel
          .waitForConfirms()
          .then(() => resolve())
          .catch((err) => reject(err))
      })
    })
  }

  protected async nativeOperation<T>(operation: (channel: NativeConfirmChannel) => Promise<T>): Promise<T> {
    return super.nativeOperation(operation as (channel: NativeChannel) => Promise<T>)
  }
}
