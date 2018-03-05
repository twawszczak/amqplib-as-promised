import amqplib from 'amqplib';
import { Channel } from './channel';
export declare class Connection {
    protected url: string;
    protected options: amqplib.Options.Connect | undefined;
    protected connection?: amqplib.Connection;
    constructor(url: string, options?: amqplib.Options.Connect | undefined);
    init(): Promise<void>;
    createChannel(): Promise<Channel>;
    close(): Promise<void>;
    waitForClose(): Promise<void>;
}
