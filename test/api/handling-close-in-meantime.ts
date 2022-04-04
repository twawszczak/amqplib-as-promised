import { Channel } from '../../src/channel'
import { Connection } from '../../src/connection'

import { Message } from 'amqplib'

import { After, And, Feature, Given, Scenario, Then, When } from '../steps'

const AMQP_URL = process.env.AMQP_URL || 'amqp://localhost'

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)
chai.should()

const fakeMessage: Message = {
  content: Buffer.from(''),
  properties: {
    contentType: 'text',
    contentEncoding: 'utf8',
    headers: {},
    deliveryMode: 1,
    priority: 2,
    correlationId: 1,
    replyTo: 1,
    expiration: 0,
    messageId: 0,
    timestamp: 0,
    type: 0,
    userId: 0,
    appId: 0,
    clusterId: 0,
  },
  fields: {
    deliveryTag: 1231231231,
    redelivered: false,
    exchange: '',
    routingKey: '',
    messageCount: 123,
  },
}

let queueName: string
let connection: Connection
let channel: Channel
let testMessage: string
let consumerTag: string
let counter: number
let reconnects: number

Feature('Using prefetch channel option', async () => {
  Scenario('basic prefetch', async () => {
    Given('test queue name', () => {
      queueName = 'handling-closing'
    })

    And('test message', () => {
      testMessage = 'test message'
    })

    And('connection', async () => {
      connection = new Connection(AMQP_URL)
      await connection.init()
    })

    And('channel', async () => {
      channel = await connection.createChannel()
    })

    And('channel reconnect handler', () => {
      reconnects = 0
      channel.on('reconnect', (_r) => {
        reconnects++
      })
    })

    When('create queue', async () => {
      await channel.assertQueue(queueName)
    })

    And('create consumer', async () => {
      counter = 0

      consumerTag = (
        await channel.consume(queueName, async (m: Message | null) => {
          counter++

          if (counter === 1) {
            try {
              await channel.checkQueue(queueName + 'zawawaz')
            } catch (e) {
              /**/
            }
          } else if (counter === 2) {
            channel.ack(fakeMessage)
          } else if (counter === 3) {
            if (m) {
              channel.ack(m)
            }
          }
        })
      ).consumerTag
    })

    And('send message', async () => {
      await channel.sendToQueue(queueName, Buffer.from(testMessage))
    })

    And('wait 3 seconds', async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 3 * 1000)
      })
    })

    Then('message received expected times', () => {
      counter.should.equal(3)
    })

    And('reconnected expected times', () => {
      reconnects.should.equal(2)
    })

    After(async () => {
      await channel.cancel(consumerTag)
      await channel.deleteQueue(queueName)
      await channel.close()
      await connection.close()
    })
  })
})
