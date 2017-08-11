'use strict'

const tap = require('tap')
require('tap-given')(tap)

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
chai.should()

const Chance = require('chance')
const chance = new Chance()

const amqplib = require('./../index')

Feature('Amqplib send to queue async ', () => {
  let connection, channel, queueName, messageContent, consumerTag

  async function prepareScenario () {
    Given('Set config', async () => {
      queueName = chance.word()
      messageContent = chance.word()
      consumerTag = chance.word()
    })

    And('Connection', async () => {
      connection = await amqplib.connect('amqp://localhost')
    })

    And('Channel in connection', async () => {
      channel = await connection.createChannel()
    })

    And('Create queue', async () => {
      await channel.assertQueue(queueName, {durable: true})
    })
  }

  async function cleanUp () {
    Then('Remove queue', async () => {
      await channel.deleteQueue(queueName)
    })

    Then('Close channel', async () => {
      await channel.close()
    })

    Then('Finally disconnect', async () => {
      await connection.close()
    })
  }

  Scenario('Basic scenario', async () => {
    await prepareScenario()
    const limit = 100000

    Then('Send message', async () => {
      for (let i = 1; i <= limit; i++) {
        await channel.sendToQueue(queueName, Buffer.from(messageContent))
      }
    })

    Then('Get message', async () => {
      await new Promise((resolve, reject) => {
        let counter = 0

        channel.consume(queueName, (message) => {
          message.content.toString().should.equal(messageContent, 'Invalid consumed message content')
          channel.ack(message)
          counter++

          if (counter === limit) {
            channel.cancel(consumerTag)
            resolve()
          }
        }, {
          consumerTag
        })
      })
    })

    await cleanUp()
  })
})
