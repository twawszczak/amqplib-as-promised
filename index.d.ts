/// <reference types="node" />
/// <reference types="amqplib" />

import * as Bluebird from 'bluebird'

export * from 'amqplib'

import { Channel as AmqpChannel, Options, Connection as AmqpConnection } from 'amqplib'

export interface Channel extends AmqpChannel {
    publishWithConfirmation(exchange: string, routingKey: string, content: Buffer, options?: Options.Publish): Promise<boolean>;
    sendToQueueWithConfirmation(queue: string, content: Buffer, options?: Options.Publish): Promise<boolean>
}

export interface Connection extends AmqpConnection {
    waitForClose (): Promise<void>
    createChannel (): Bluebird<Channel>
}

export function connect(url: string, socketOptions?: any): Promise<Connection>;