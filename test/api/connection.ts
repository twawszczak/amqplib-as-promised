import { Channel } from '../../src/channel'
import { Connection } from '../../src/connection'

import { Message } from 'amqplib'

import { After, And, Feature, Given, Scenario, Then, When } from '../init'

const AMQP_URL = process.env.AMQP_URL || 'amqp://localhost'

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
chai.use(chaiAsPromised)
chai.should()

let queueName: string
let connection: Connection
let channel: Channel
let receivedMessage = ''
let testMessage: string
let consumerTag: string

Feature('Use Connection object', async () => {
  Scenario('basic usage', async () => {
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
      consumerTag = (await channel.consume(queueName, async (message: Message | null) => {
        if (message) {
          receivedMessage = message.content.toString()
          channel.ack(message)
        }
      })).consumerTag
    })

    And('send message', async () => {
      await channel.sendToQueue(queueName, Buffer.from(testMessage))
    })

    And('Wait 1 sec', async () => {
      await new Promise((resolve) => {
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
})
