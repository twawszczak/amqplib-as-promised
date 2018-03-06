import { Connection } from '../../lib/connection'
import { Channel } from '../../lib/channel'
import { Message } from 'amqplib'
import { After, And, Feature, Given, Then, When } from '../init'

const AMQP_URL = process.env.AMQP_URL || 'amqp://localhost'

const tap = require('tap')
require('tap-given')(tap)

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
chai.should()

let queueName: string
let connection: Connection
let channel: Channel
let receivedMessage = ''
let testMessage: string
let consumerTag: string

Feature('basic usage', async () => {
  Given('test queue name', () => {
    queueName  = 'amqplib-as-promised-test'
  })

  And('test message', () => {
    testMessage  = 'test message'
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
        await channel.ack(message)
      }
    })).consumerTag
  })

  And ('send message', async () => {
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