"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Channel {
    constructor(channel, connection) {
        this.connection = connection;
        this.processing = false;
        this.suspended = [];
        this.consumerHandlers = {};
        this.bindNativeChannel(channel);
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
    async cancel(tag) {
        return this.nativeOperation(async (channel) => {
            const result = await channel.cancel(tag);
            delete this.consumerHandlers[tag];
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
    async publish(exchange, queue, content, options) {
        const EVENT_DRAIN = 'drain';
        const EVENT_ERROR = 'error';
        const EVENT_CLOSE = 'close';
        return this.nativeOperation((channel => {
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
                            [EVENT_DRAIN, EVENT_CLOSE, EVENT_ERROR].forEach(eventName => {
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
        }));
    }
    async prefetch(count, global) {
        return this.nativeOperation((channel) => {
            return Promise.resolve(channel.prefetch(count, global));
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
        return this.nativeOperation((channel) => {
            return Promise.resolve(channel.close());
        });
    }
    async get(queueName, options) {
        return this.nativeOperation((channel) => {
            return Promise.resolve(channel.get(queueName, options));
        });
    }
    async nativeOperation(operation) {
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
                await this.reconnect();
                reject(this.error);
            }
            this.processUnprocessed();
            this.processing = false;
        });
    }
    async reconnect() {
        const nativeChannel = await this.connection.createChannel();
        this.bindNativeChannel(nativeChannel);
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
        channel.once('error', (error) => {
            this.error = error;
        });
        this.channel = channel;
    }
}
exports.Channel = Channel;
