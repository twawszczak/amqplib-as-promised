/// <reference types="node" />
import amqplib from 'amqplib';
export declare type MessageHandler = (message: amqplib.Message | null) => any;
export declare class Channel {
    protected connection: amqplib.Connection;
    protected error: any;
    protected channel?: amqplib.Channel;
    protected processing: boolean;
    protected suspended: Array<{
        resolve: () => void;
        reject: (error: any) => void;
    }>;
    protected consumerHandlers: {
        [tag: string]: {
            queue: string;
            handler: MessageHandler;
            options?: amqplib.Options.Consume;
        };
    };
    constructor(channel: amqplib.Channel, connection: amqplib.Connection);
    consume(queueName: string, handler: MessageHandler, options?: amqplib.Options.Consume): Promise<amqplib.Replies.Consume>;
    cancel(tag: string): Promise<amqplib.Replies.Empty>;
    checkQueue(queueName: string): Promise<amqplib.Replies.AssertQueue>;
    assertQueue(queueName: string, options?: amqplib.Options.AssertQueue): Promise<amqplib.Replies.AssertQueue>;
    deleteQueue(queueName: string, options?: amqplib.Options.DeleteQueue): Promise<amqplib.Replies.DeleteQueue>;
    sendToQueue(queueName: string, content: Buffer, options?: amqplib.Options.Publish): Promise<boolean>;
    publish(exchange: string, queue: string, content: Buffer, options?: amqplib.Options.Publish): Promise<boolean>;
    prefetch(count: number, global: boolean): Promise<void>;
    ack(message: amqplib.Message, allUpTo?: boolean): void;
    nack(message: amqplib.Message, allUpTo?: boolean, requeue?: boolean): void;
    close(): Promise<void>;
    protected nativeOperation(operation: (channel: amqplib.Channel) => Promise<any>): Promise<any>;
    protected reconnect(): Promise<void>;
    protected bindConsumersAfterReconnect(): Promise<void>;
    protected processUnprocessed(): void;
    protected bindNativeChannel(channel: amqplib.Channel): void;
}
