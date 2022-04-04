import { Channel } from '../../src/channel'
import { ConfirmChannel } from '../../src/confirm-channel'
import { Connection } from '../../src/connection'

import { Message } from 'amqplib'

import { After, And, Feature, Given, Scenario, Then, When } from '../steps'

const AMQP_URL = process.env.AMQP_URL || 'amqp://localhost'

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
chai.use(chaiAsPromised)
chai.should()

Feature('Use Connection object', async () => {
  Scenario('channel usage', async () => {
    let queueName: string
    let connection: Connection
    let channel: Channel
    let receivedMessage = ''
    let testMessage: string
    let consumerTag: string

    Given('test queue name', () => {
      queueName = 'amqplib-as-promised-test'
    })

    And('test message', () => {
      testMessage = 'test message'
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

    When('create consumer', async () => {
      consumerTag = (
        await channel.consume(queueName, async (message: Message | null) => {
          if (message) {
            receivedMessage = message.content.toString()
            channel.ack(message)
          }
        })
      ).consumerTag
    })

    And('send message', async () => {
      await channel.sendToQueue(queueName, Buffer.from(testMessage))
    })

    And('Wait 1 sec', async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 1000)
      })
    })

    Then('message is received', () => {
      receivedMessage.should.equals(testMessage)
    })

    After(async () => {
      await channel.cancel(consumerTag)
      await channel.deleteQueue(queueName)
      await channel.close()
      await connection.close()
    })
  })

  Scenario('confirm channel usage', async () => {
    let queueName: string
    let connection: Connection
    let confirmChannel: ConfirmChannel
    let receivedMessage = ''
    let testMessage: string
    let consumerTag: string

    Given('test queue name', () => {
      queueName = 'amqplib-as-promised-test'
    })

    And('test message', () => {
      testMessage = 'test message'
    })

    When('create connection', () => {
      connection = new Connection(AMQP_URL)
    })

    Then('init connection', async () => {
      await connection.init()
    })

    When('create channel', async () => {
      confirmChannel = await connection.createConfirmChannel()
    })

    Then('assert queue', async () => {
      await confirmChannel.assertQueue(queueName)
    })

    When('create consumer', async () => {
      consumerTag = (
        await confirmChannel.consume(queueName, async (message: Message | null) => {
          if (message) {
            receivedMessage = message.content.toString()
            confirmChannel.ack(message)
          }
        })
      ).consumerTag
    })

    And('send message', async () => {
      await confirmChannel.sendToQueue(queueName, Buffer.from(testMessage))
    })

    And('Wait 1 sec', async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 1000)
      })
    })

    Then('message is received', () => {
      receivedMessage.should.equals(testMessage)
    })

    After(async () => {
      await confirmChannel.cancel(consumerTag)
      await confirmChannel.deleteQueue(queueName)
      await confirmChannel.close()
      await connection.close()
    })
  })
})
