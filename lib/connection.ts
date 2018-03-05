import amqplib from 'amqplib'
import { Channel } from './channel'

export class Connection {
  protected connection?: amqplib.Connection

  constructor (protected url: string, protected options?: amqplib.Options.Connect) {}

  async init (): Promise<void> {
    this.connection = await amqplib.connect(this.url, this.options)
  }

  async createChannel (): Promise<Channel> {
    if (!this.connection) {
      throw new Error('Cannot create channel - connection wrapper is not initialized.')
    }
    const nativeChannel = await this.connection.createChannel()
    return new Channel(nativeChannel, this.connection)
  }

  async close (): Promise<void> {
    if (this.connection) {
      await this.connection.close()
    }
  }

  async waitForClose (): Promise<void> {
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
