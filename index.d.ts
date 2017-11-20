/// <reference types="amqplib" />

export * from 'amqplib'

import { Channel as AmqpChannel, Options } from 'amqplib'

export class Channel extends AmqpChannel {
    publish(exchange: string, routingKey: string, content: Buffer, options?: Options.Publish): Promise<boolean>;
    sendToQueue(queue: string, content: Buffer, options?: Options.Publish): Promise<boolean>
}
