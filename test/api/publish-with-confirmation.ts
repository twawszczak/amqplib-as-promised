import { And, Feature, Given, Scenario, Then } from '../steps'

import Chance from 'chance'

import { ConfirmChannel } from '../../src/confirm-channel'
import { Connection } from '../../src/connection'

const chance = new Chance()

const AMQP_URL = process.env.AMQP_URL || 'amqp://localhost'

Feature('Amqplib send to queue async and confirm', () => {
  let connection: Connection
  let confirmChannel: ConfirmChannel
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
      confirmChannel = await connection.createConfirmChannel()
    })

    And('Create queue', async () => {
      await confirmChannel.assertQueue(queueName, { durable: true })
    })

    And('Get close handler', () => {
      closePromise = connection.waitForClose()
    })

    const limit = 1000

    Then(`Send ${limit} messages`, async () => {
      for (let i = 1; i <= limit / 2; i++) {
        await Promise.all([
          confirmChannel.sendToQueue(queueName, Buffer.from(messageContent)),
          confirmChannel.sendToQueue(queueName, Buffer.from(messageContent)),
        ])
      }
    })

    Then('Wait for confirms', async () => {
      await confirmChannel.waitForConfirms()
    })

    Then('Get message', async () => {
      await new Promise<void>(async (resolve) => {
        let counter = 0

        await confirmChannel.consume(
          queueName,
          async (message) => {
            if (message) {
              message.content.toString().should.equal(messageContent, 'Invalid consumed message content')
              confirmChannel.ack(message)
              counter++
            }

            if (counter === limit) {
              await confirmChannel.cancel(consumerTag)
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
      await confirmChannel.deleteQueue(queueName)
    })

    And('Close channel', async () => {
      await confirmChannel.close()
    })

    And('Finally disconnect', async () => {
      await connection.close()
    })

    And('Close promise is fulfilled', (done) => {
      closePromise.should.be.fulfilled.and.notify(done)
    })
  })
})
