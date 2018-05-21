"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AckCache {
    constructor() {
        this.cache = {};
        this.abandonedCache = {};
    }
    static findInCache(cache, queueName, deliveryTag) {
        const stringDeliveryTag = String(deliveryTag);
        return cache[queueName] ? cache[queueName][stringDeliveryTag] : undefined;
    }
    static updateCache(cache, queueName, deliveryTag, operation) {
        const stringDeliveryTag = String(deliveryTag);
        if (!cache[queueName]) {
            cache[queueName] = {};
        }
        if (operation) {
            cache[queueName][stringDeliveryTag] = operation;
        }
        else {
            delete cache[queueName][stringDeliveryTag];
        }
    }
    static mergeCache(first, second) {
        const result = {};
        const queues = Object.keys(first).concat(Object.keys(second)).reduce((currentValue, currentItem) => {
            if (currentValue.includes(currentItem)) {
                return currentValue;
            }
            else {
                return [...currentValue, currentItem];
            }
        }, []);
        for (const queue of queues) {
            result[queue] = Object.assign({}, (first[queue] || {}), (second[queue] || {}));
        }
        return result;
    }
    consumed(queueName, deliveryTag) {
        const cachedOperation = AckCache.findInCache(this.abandonedCache, queueName, deliveryTag);
        if (cachedOperation) {
            if (cachedOperation === AckCache.ACK) {
                AckCache.updateCache(this.abandonedCache, queueName, deliveryTag, undefined);
            }
            return cachedOperation;
        }
        if (AckCache.findInCache(this.cache, queueName, deliveryTag)) {
            throw new Error('Ack Cache consuming message already cached to ack.  Queue: ' + queueName + ', deliveryTag: ' + deliveryTag + '.');
        }
        else {
            AckCache.updateCache(this.cache, queueName, deliveryTag, AckCache.NO_ACK);
            return undefined;
        }
    }
    ack(queueName, deliveryTag) {
        if (AckCache.findInCache(this.cache, queueName, deliveryTag)) {
            AckCache.updateCache(this.cache, queueName, deliveryTag, undefined);
            return true;
        }
        else if (AckCache.findInCache(this.abandonedCache, queueName, deliveryTag)) {
            AckCache.updateCache(this.abandonedCache, queueName, deliveryTag, AckCache.ACK);
            return false;
        }
        else {
            throw Error('Acking message not passed through this channel. Queue: ' + queueName + ', deliveryTag: ' + deliveryTag + '.');
        }
    }
    nack(queueName, deliveryTag) {
        if (AckCache.findInCache(this.cache, queueName, deliveryTag)) {
            AckCache.updateCache(this.cache, queueName, deliveryTag, undefined);
            return true;
        }
        else if (AckCache.findInCache(this.abandonedCache, queueName, deliveryTag)) {
            return false;
        }
        else {
            throw Error('Nacking message not passed through this channel. Queue: ' + queueName + ', deliveryTag: ' + deliveryTag + '.');
        }
    }
    abandon() {
        this.abandonedCache = AckCache.mergeCache(this.abandonedCache, this.cache);
        this.cache = {};
    }
}
AckCache.ACK = 'ack';
AckCache.NO_ACK = 'noAck';
exports.AckCache = AckCache;
