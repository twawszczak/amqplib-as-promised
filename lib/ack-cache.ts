export type MessageOperation = 'ack' | 'noAck'

export interface CacheStorage {[queueName: string]: { [deliveryTag: string]: MessageOperation }}

export class AckCache {

  static readonly ACK: MessageOperation = 'ack'
  static readonly NO_ACK: MessageOperation = 'noAck'

  protected cache: CacheStorage = {}
  protected abandonedCache: CacheStorage = {}

  static findInCache (cache: CacheStorage, queueName: string, deliveryTag: number): MessageOperation | undefined {
    const stringDeliveryTag: string = String(deliveryTag)

    return cache[queueName] ? cache[queueName][stringDeliveryTag] : undefined
  }

  static updateCache (cache: CacheStorage, queueName: string, deliveryTag: number, operation: MessageOperation | undefined): void {
    const stringDeliveryTag: string = String(deliveryTag)

    if (!cache[queueName]) {
      cache[queueName] = {}
    }

    if (operation) {
      cache[queueName][stringDeliveryTag] = operation
    } else {
      delete cache[queueName][stringDeliveryTag]
    }
  }

  static mergeCache (first: CacheStorage, second: CacheStorage): CacheStorage {
    const result: CacheStorage = {}

    const queues: string[] = Object.keys(first).concat(Object.keys(second)).reduce((currentValue: string[], currentItem: string) => {
      if (currentValue.includes(currentItem)) {
        return currentValue
      } else {
        return [...currentValue, currentItem]
      }
    }, [])

    for (const queue of queues) {
      result[queue] = {
        ...(first[queue] || {}),
        ...(second[queue] || {})
      }
    }

    return result
  }

  consumed (queueName: string, deliveryTag: number): MessageOperation | undefined {
    const cachedOperation = AckCache.findInCache(this.abandonedCache, queueName, deliveryTag)

    if (cachedOperation) {
      if (cachedOperation === AckCache.ACK) {
        AckCache.updateCache(this.abandonedCache, queueName, deliveryTag, undefined)
      }

      return cachedOperation
    }

    if (AckCache.findInCache(this.cache, queueName, deliveryTag)) {
      throw new Error('Ack Cache consuming message already cached to ack.  Queue: ' + queueName + ', deliveryTag: ' + deliveryTag + '.')
    } else {
      AckCache.updateCache(this.cache, queueName, deliveryTag, AckCache.NO_ACK)
      return undefined
    }
  }

  ack (queueName: string, deliveryTag: number): boolean {
    if (AckCache.findInCache(this.cache, queueName, deliveryTag)) {
      AckCache.updateCache(this.cache, queueName, deliveryTag, undefined)

      return true
    } else if (AckCache.findInCache(this.abandonedCache, queueName, deliveryTag)) {
      AckCache.updateCache(this.abandonedCache, queueName, deliveryTag, AckCache.ACK)

      return false
    } else {
      throw Error('Acking message not passed through this channel. Queue: ' + queueName + ', deliveryTag: ' + deliveryTag + '.')
    }
  }

  nack (queueName: string, deliveryTag: number): boolean {
    if (AckCache.findInCache(this.cache, queueName, deliveryTag)) {
      AckCache.updateCache(this.cache, queueName, deliveryTag, undefined)

      return true
    } else if (AckCache.findInCache(this.abandonedCache, queueName, deliveryTag)) {
      return false
    } else {
      throw Error('Nacking message not passed through this channel. Queue: ' + queueName + ', deliveryTag: ' + deliveryTag + '.')
    }
  }

  abandon (): void {
    this.abandonedCache = AckCache.mergeCache(this.abandonedCache, this.cache)
    this.cache = {}
  }
}
