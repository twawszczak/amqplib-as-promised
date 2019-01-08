"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
class Channel extends events_1.EventEmitter {
    constructor(channel, connection) {
        super();
        this.connection = connection;
        this.processing = false;
        this.suspended = [];
        this.consumerHandlers = {};
        this.connectionFinallyClosed = false;
        this.closingByClient = false;
        this.bindNativeChannel(channel);
        this.bindNativeConnection();
    }
    async consume(queueName, handler, options) {
        return this.nativeOperation(async (channel) => {
            const response = await channel.consume(queueName, handler, options);
            this.consumerHandlers[response.consumerTag] = {
                queue: queueName,
                handler,
                options
            };
            return response;
        });
    }
    async cancel(consumerTag) {
        return this.nativeOperation(async (channel) => {
            const result = await channel.cancel(consumerTag);
            delete this.consumerHandlers[consumerTag];
            return result;
        });
    }
    async checkQueue(queueName) {
        return this.nativeOperation((channel) => {
            return Promise.resolve(channel.checkQueue(queueName));
        });
    }
    async assertQueue(queueName, options) {
        return this.nativeOperation((channel) => {
            return Promise.resolve(channel.assertQueue(queueName, options));
        });
    }
    async deleteQueue(queueName, options) {
        return this.nativeOperation((channel) => {
            return Promise.resolve(channel.deleteQueue(queueName, options));
        });
    }
    async sendToQueue(queueName, content, options) {
        return this.publish('', queueName, content, options);
    }
    async bindQueue(queueName, source, pattern, args) {
        return this.nativeOperation((channel) => {
            return Promise.resolve(channel.bindQueue(queueName, source, pattern, args));
        });
    }
    async unbindQueue(queueName, source, pattern, args) {
        return this.nativeOperation((channel) => {
            return Promise.resolve(channel.unbindQueue(queueName, source, pattern, args));
        });
    }
    async publish(exchange, queue, content, options) {
        const EVENT_DRAIN = 'drain';
        const EVENT_ERROR = 'error';
        const EVENT_CLOSE = 'close';
        return this.nativeOperation((channel) => {
            return new Promise((resolve, reject) => {
                let canSend = false;
                try {
                    canSend = channel.publish(exchange, queue, content, options);
                }
                catch (error) {
                    reject(error);
                }
                if (canSend) {
                    resolve(true);
                }
                else {
                    const eventHandlers = {};
                    const eventHandlerWrapper = (specificEventName) => {
                        eventHandlers[specificEventName] = (handlerArg) => {
                            [EVENT_DRAIN, EVENT_CLOSE, EVENT_ERROR].forEach((eventName) => {
                                if (eventName !== specificEventName) {
                                    channel.removeListener(eventName, eventHandlers[eventName]);
                                }
                            });
                            specificEventName === EVENT_DRAIN ? resolve(true) : reject(String(handlerArg));
                        };
                        return eventHandlers[specificEventName];
                    };
                    channel.once(EVENT_DRAIN, eventHandlerWrapper(EVENT_DRAIN));
                    channel.once(EVENT_ERROR, eventHandlerWrapper(EVENT_ERROR));
                    channel.once(EVENT_CLOSE, eventHandlerWrapper(EVENT_CLOSE));
                }
            });
        });
    }
    async prefetch(count, global) {
        this.prefetchCache = { count, global };
        return this.nativeOperation((channel) => {
            return Promise.resolve(channel.prefetch(count, global));
        });
    }
    async assertExchange(exchangeName, exchangeType, options) {
        return this.nativeOperation((channel) => {
            return Promise.resolve(channel.assertExchange(exchangeName, exchangeType, options));
        });
    }
    async checkExchange(exchangeName) {
        return this.nativeOperation((channel) => {
            return Promise.resolve(channel.checkExchange(exchangeName));
        });
    }
    async deleteExchange(exchangeName, options) {
        return this.nativeOperation((channel) => {
            return Promise.resolve(channel.deleteExchange(exchangeName, options));
        });
    }
    async bindExchange(destination, source, pattern, args) {
        return this.nativeOperation((channel) => {
            return Promise.resolve(channel.bindExchange(destination, source, pattern, args));
        });
    }
    async unbindExchange(destination, source, pattern, args) {
        return this.nativeOperation((channel) => {
            return Promise.resolve(channel.unbindExchange(destination, source, pattern, args));
        });
    }
    ack(message, allUpTo) {
        if (!this.channel) {
            throw new Error('Cannot execute method ack() - channel wrapper not initialized.');
        }
        return this.channel.ack(message, allUpTo);
    }
    nack(message, allUpTo, requeue) {
        if (!this.channel) {
            throw new Error('Cannot execute method nack() - channel wrapper not initialized.');
        }
        return this.channel.nack(message, allUpTo, requeue);
    }
    async close() {
        return this.nativeOperation(async (channel) => {
            this.closingByClient = true;
            try {
                await Promise.resolve(channel.close());
            }
            catch (e) {
                this.closingByClient = false;
            }
        });
    }
    async get(queueName, options) {
        return this.nativeOperation((channel) => {
            return Promise.resolve(channel.get(queueName, options));
        });
    }
    async nativeOperation(operation) {
        if (this.reconnectPromise) {
            await this.reconnectPromise;
        }
        if (this.processing) {
            await new Promise((resolve, reject) => {
                this.suspended.push({
                    resolve,
                    reject
                });
            });
        }
        this.processing = true;
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.channel) {
                    reject(new Error());
                }
                else {
                    const result = await operation(this.channel);
                    resolve(result);
                }
            }
            catch (error) {
                reject(this.error);
            }
            this.processUnprocessed();
            this.processing = false;
        });
    }
    async reconnect(reason) {
        if (this.connectionFinallyClosed) {
            return;
        }
        this.emit('reconnect', reason);
        const nativeChannel = await this.connection.createChannel();
        this.bindNativeChannel(nativeChannel);
        await this.checkPrefetchCache();
        await this.bindConsumersAfterReconnect();
    }
    async bindConsumersAfterReconnect() {
        if (!this.channel) {
            throw new Error('Cannot bind consumers after reconnect - channel not exists.');
        }
        for (const tag of Object.keys(this.consumerHandlers)) {
            const consumer = this.consumerHandlers[tag];
            const tagOption = { consumerTag: tag };
            await this.channel.consume(consumer.queue, consumer.handler, consumer.options ? Object.assign({}, consumer.options, tagOption) : tagOption);
        }
    }
    processUnprocessed() {
        const unprocessed = this.suspended.shift();
        if (unprocessed) {
            unprocessed.resolve();
        }
    }
    bindNativeChannel(channel) {
        const onClose = async () => {
            try {
                if (!this.closingByClient) {
                    this.reconnectPromise = this.reconnect(this.error);
                    await this.reconnectPromise;
                }
            }
            catch (e) {
                this.emit('error', new Error('Cannot reconnect amqp channel with message: ' + e.message));
            }
        };
        const onError = (err) => {
            this.error = err;
        };
        channel.once('close', onClose);
        channel.once('error', onError);
        this.channel = channel;
    }
    bindNativeConnection() {
        this.connection.once('close', () => this.connectionFinallyClosed = true);
    }
    async checkPrefetchCache() {
        if (this.channel && this.prefetchCache) {
            await this.channel.prefetch(this.prefetchCache.count, this.prefetchCache.global);
        }
    }
}
exports.Channel = Channel;
