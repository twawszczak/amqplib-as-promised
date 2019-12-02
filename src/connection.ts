import amqplib from 'amqplib'
import { EventEmitter } from 'events'

import { Channel } from './channel'
import { ConfirmChannel } from './confirm-channel'

export class Connection extends EventEmitter {
  finallyClosed: boolean = false

  protected connection?: amqplib.Connection

  constructor(protected url: string, protected options?: amqplib.Options.Connect) {
    super()
  }

  async init(): Promise<void> {
    this.connection = await amqplib.connect(this.url, this.options)

    this.connection.once('close', () => {
      this.finallyClosed = true
      this.emit('close')
      delete this.connection
    })

    this.connection.on('error', (e) => this.emit('error', e))
  }

  async createNativeChannel(): Promise<amqplib.ConfirmChannel> {
    if (!this.connection) {
      throw new Error('Cannot create channel - connection wrapper is not initialized.')
    }
    return this.connection.createConfirmChannel()
  }

  async createChannel(): Promise<Channel> {
    if (!this.connection) {
      throw new Error('Cannot create channel - connection wrapper is not initialized.')
    }
    const nativeChannel = await this.createNativeChannel()
    return new Channel(nativeChannel, this)
  }

  async createNativeConfirmChannel(): Promise<amqplib.ConfirmChannel> {
    if (!this.connection) {
      throw new Error('Cannot create channel - connection wrapper is not initialized.')
    }
    return this.connection.createConfirmChannel()
  }

  async createConfirmChannel(): Promise<ConfirmChannel> {
    if (!this.connection) {
      throw new Error('Cannot create channel - connection wrapper is not initialized.')
    }
    const nativeConfirmChannel = await this.createNativeConfirmChannel()
    return new ConfirmChannel(nativeConfirmChannel, this)
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close()
    }
  }

  async waitForClose(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.connection) {
        reject(new Error('Cannot wait for connection close - connection not initialized.'))
      } else {
        this.connection.once('close', () => {
          resolve()
        })
      }
    })
  }
}
