import { And, Feature, Given, Scenario, Then } from '../steps'

import Chance from 'chance'

import { Channel } from '../../src/channel'
import { Connection } from '../../src/connection'

const chance = new Chance()

const AMQP_URL = process.env.AMQP_URL || 'amqp://localhost'

Feature('Amqplib send to queue async', () => {
  let connection: Connection
  let channel: Channel
  let queueName: string
  let messageContent: string
  let consumerTag: string
  let closePromise: Promise<void>

  Scenario('Basic scenario', async () => {
    Given('Set config', async () => {
      queueName = chance.word()
      messageContent = chance.word()
      consumerTag = chance.word()
    })

    And('Connection', async () => {
      connection = new Connection(AMQP_URL)
      await connection.init()
    })

    And('Channel in connection', async () => {
      channel = await connection.createChannel()
    })

    And('Create queue', async () => {
      await channel.assertQueue(queueName, { durable: true })
    })

    And('Get close handler', () => {
      closePromise = connection.waitForClose()
    })

    const limit = 100000

    Then(`Send ${limit} messages`, async () => {
      for (let i = 1; i <= limit / 2; i++) {
        await Promise.all([
          channel.sendToQueue(queueName, Buffer.from(messageContent)),
          channel.sendToQueue(queueName, Buffer.from(messageContent)),
        ])
      }
    })

    Then('Get message', async () => {
      await new Promise(async (resolve) => {
        let counter = 0

        await channel.consume(
          queueName,
          async (message) => {
            if (message) {
              message.content.toString().should.equal(messageContent, 'Invalid consumed message content')
              channel.ack(message)
              counter++
            }

            if (counter === limit) {
              await channel.cancel(consumerTag)
              resolve()
            }
          },
          {
            consumerTag,
          },
        )
      })
    })

    Then('Remove queue', async () => {
      await channel.deleteQueue(queueName)
    })

    And('Close channel', async () => {
      await channel.close()
    })

    And('Finally disconnect', async () => {
      await connection.close()
    })

    And('Close promise is fulfilled', (done) => {
      closePromise.should.be.fulfilled.and.notify(done)
    })
  })
})
