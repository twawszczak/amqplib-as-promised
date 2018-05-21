import { And, Feature, Given, Scenario, Then, When } from '../init'

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { AckCache } from '../../lib/ack-cache'

chai.use(chaiAsPromised)
chai.should()

let ackCache: AckCache
let deliveryTag: number
let queueName: string

Feature('Standalone ack cache', async () => {
  Scenario('consume, channel close, ack', async () => {
    Given('ack cache', () => {
      ackCache = new AckCache()
    })

    And('queue name', () => {
      queueName = 'name'
    })

    And('delivery tag', () => {
      deliveryTag = 1
    })

    When('consuming message', () => {
      ackCache.consumed(queueName, deliveryTag)
    })

    And('channel closed - cache abandoned', () => {
      ackCache.abandon()
    })

    And('acking message by client', () => {
      ackCache.ack(queueName, deliveryTag)
    })

    Then('message is to immediate ack when consumed again', () => {
      (ackCache.consumed(queueName, deliveryTag) || '').should.equal(AckCache.ACK)
    })

    And('message is passed when consuming one more time with same deliveryTag', () => {
      (ackCache.consumed(queueName, deliveryTag) || 'undefined').should.equal('undefined')
    })
  })

  Scenario('consume, channel close, nack', async () => {
    Given('ack cache', () => {
      ackCache = new AckCache()
    })

    And('queue name', () => {
      queueName = 'name'
    })

    And('delivery tag', () => {
      deliveryTag = 1
    })

    When('consuming message', () => {
      ackCache.consumed(queueName, deliveryTag)
    })

    And('channel closed - cache abandoned', () => {
      ackCache.abandon()
    })

    And('nacking message by client', () => {
      ackCache.nack(queueName, deliveryTag)
    })

    Then('message is to immediate nack when consumed again', () => {
      for (let i = 1; i <= 5; i++) {
        (ackCache.consumed(queueName, deliveryTag) || '').should.equal(AckCache.NO_ACK)
      }
    })
  })

  Scenario('transparent behaviour when channel is ok', async () => {
    Given('ack cache', () => {
      ackCache = new AckCache()
    })

    And('queue name', () => {
      queueName = 'name'
    })

    And('delivery tag', () => {
      deliveryTag = 1
    })

    When('consuming message', () => {
      ackCache.consumed(queueName, deliveryTag)
    })

    And('nacking message by client', () => {
      ackCache.nack(queueName, deliveryTag)
    })

    Then('cache has no reply when received again', () => {
      (ackCache.consumed(queueName, deliveryTag) || 'undefined').should.equal('undefined')
    })
  })
})
