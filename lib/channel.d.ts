/// <reference types="node" />
import { Channel as NativeChannel, Connection, Message, Options, Replies } from 'amqplib';
export declare type MessageHandler = (message: Message | null) => any;
export declare class Channel {
    protected connection: Connection;
    protected error: any;
    protected channel?: NativeChannel;
    protected processing: boolean;
    protected suspended: Array<{
        resolve: () => void;
        reject: (error: any) => void;
    }>;
    protected consumerHandlers: {
        [tag: string]: {
            queue: string;
            handler: MessageHandler;
            options?: Options.Consume;
        };
    };
    constructor(channel: NativeChannel, connection: Connection);
    consume(queueName: string, handler: MessageHandler, options?: Options.Consume): Promise<Replies.Consume>;
    cancel(consumerTag: string): Promise<Replies.Empty>;
    checkQueue(queueName: string): Promise<Replies.AssertQueue>;
    assertQueue(queueName: string, options?: Options.AssertQueue): Promise<Replies.AssertQueue>;
    deleteQueue(queueName: string, options?: Options.DeleteQueue): Promise<Replies.DeleteQueue>;
    sendToQueue(queueName: string, content: Buffer, options?: Options.Publish): Promise<boolean>;
    bindQueue(queueName: string, source: string, pattern: string, args?: any): Promise<Replies.Empty>;
    unbindQueue(queueName: string, source: string, pattern: string, args?: any): Promise<Replies.Empty>;
    publish(exchange: string, queue: string, content: Buffer, options?: Options.Publish): Promise<boolean>;
    prefetch(count: number, global: boolean): Promise<Replies.Empty>;
    assertExchange(exchangeName: string, exchangeType: string, options?: Options.AssertExchange): Promise<Replies.AssertExchange>;
    checkExchange(exchangeName: string): Promise<Replies.Empty>;
    deleteExchange(exchangeName: string, options?: Options.DeleteExchange): Promise<Replies.Empty>;
    bindExchange(destination: string, source: string, pattern: string, args?: any): Promise<Replies.Empty>;
    unbindExchange(destination: string, source: string, pattern: string, args?: any): Promise<Replies.Empty>;
    ack(message: Message, allUpTo?: boolean): void;
    nack(message: Message, allUpTo?: boolean, requeue?: boolean): void;
    close(): Promise<void>;
    get(queueName: string, options?: Options.Get): Promise<Message | false>;
    protected nativeOperation<T>(operation: (channel: NativeChannel) => Promise<T>): Promise<T>;
    protected reconnect(): Promise<void>;
    protected bindConsumersAfterReconnect(): Promise<void>;
    protected processUnprocessed(): void;
    protected bindNativeChannel(channel: NativeChannel): void;
}
