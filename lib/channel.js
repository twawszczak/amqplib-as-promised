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
        return this.nativeOperation((channel) => {
            console.log('sending')

            const result = Promise.resolve(channel.sendToQueue(queueName, content, options));

            result.then(() => {
              console.log('sent')
            }, (e) => {
                console.log('sending error')
                console.log(e)
            })

            return result
        });
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
            console.log('channel error')
            console.log(error)
            this.error = error;
        });
        this.channel = channel;
    }
}
exports.Channel = Channel;
