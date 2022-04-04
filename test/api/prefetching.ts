import { Channel } from '../../src/channel'
import { Connection } from '../../src/connection'

import { Message } from 'amqplib'

import { After, And, Feature, Given, Scenario, Then, When } from '../steps'

const AMQP_URL = process.env.AMQP_URL || 'amqp://localhost'

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)
chai.should()

let queueName: string
let connection: Connection
let channel: Channel
let testMessage: string
let consumerTag: string
let limit: number
let receivedMessages: Message[]

Feature('Using prefetch channel option', async () => {
  Scenario('basic prefetch', async () => {
    Given('test queue name', () => {
      queueName = 'prefetch'
    })

    And('test message', () => {
      testMessage = 'test message'
    })

    And('prefetch count', () => {
      limit = 10
    })

    And('received messages array', () => {
      receivedMessages = []
    })

    When('create connection', () => {
      connection = new Connection(AMQP_URL)
    })

    Then('init connection', async () => {
      await connection.init()
    })

    When('create channel', async () => {
      channel = await connection.createChannel()
    })

    Then('assert queue', async () => {
      await channel.assertQueue(queueName)
    })

    And('prefetch', async () => {
      await channel.prefetch(limit)
    })

    When('create consumer which not ack', async () => {
      consumerTag = (
        await channel.consume(queueName, async (message: Message | null) => {
          if (message) {
            receivedMessages.push(message)
          }
        })
      ).consumerTag
    })

    And('send messages', async () => {
      const amountToSend = limit * 2
      for (let i = 1; i <= amountToSend; i++) {
        await channel.sendToQueue(queueName, Buffer.from(testMessage))
      }
    })

    And('Wait 3 sec', async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 3000)
      })
    })

    Then('exact number of messages is received', () => {
      receivedMessages.length.should.equals(limit)
    })

    After(async () => {
      await channel.cancel(consumerTag)
      await channel.deleteQueue(queueName)
      await channel.close()
      await connection.close()
    })
  })

  Scenario('keep prefetch after error', async () => {
    Given('test queue name', () => {
      queueName = 'prefetch'
    })

    And('test message', () => {
      testMessage = 'test message'
    })

    And('prefetch count', () => {
      limit = 10
    })

    And('received messages array', () => {
      receivedMessages = []
    })

    When('create connection', () => {
      connection = new Connection(AMQP_URL)
    })

    Then('init connection', async () => {
      await connection.init()
    })

    When('create channel', async () => {
      channel = await connection.createChannel()
    })

    Then('assert queue', async () => {
      await channel.assertQueue(queueName)
    })

    And('prefetch', async () => {
      await channel.prefetch(limit)
    })

    When('check queue which not exists to force internal channel error', async () => {
      try {
        await channel.checkQueue(queueName + '123')
      } catch (e) {
        /**/
      }
    })

    And('create consumer which not ack', async () => {
      consumerTag = (
        await channel.consume(queueName, async (message: Message | null) => {
          if (message) {
            receivedMessages.push(message)
          }
        })
      ).consumerTag
    })

    And('send messages', async () => {
      const amountToSend = limit * 2
      for (let i = 1; i <= amountToSend; i++) {
        await channel.sendToQueue(queueName, Buffer.from(testMessage))
      }
    })

    And('Wait 3 sec', async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 3000)
      })
    })

    Then('exact number of messages is received', () => {
      receivedMessages.length.should.equals(limit)
    })

    After(async () => {
      await channel.cancel(consumerTag)
      await channel.deleteQueue(queueName)
      await channel.close()
      await connection.close()
    })
  })
})
