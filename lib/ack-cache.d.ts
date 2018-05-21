export declare type MessageOperation = 'ack' | 'noAck';
export interface CacheStorage {
    [queueName: string]: {
        [deliveryTag: string]: MessageOperation;
    };
}
export declare class AckCache {
    static readonly ACK: MessageOperation;
    static readonly NO_ACK: MessageOperation;
    protected cache: CacheStorage;
    protected abandonedCache: CacheStorage;
    static findInCache(cache: CacheStorage, queueName: string, deliveryTag: number): MessageOperation | undefined;
    static updateCache(cache: CacheStorage, queueName: string, deliveryTag: number, operation: MessageOperation | undefined): void;
    static mergeCache(first: CacheStorage, second: CacheStorage): CacheStorage;
    consumed(queueName: string, deliveryTag: number): MessageOperation | undefined;
    ack(queueName: string, deliveryTag: number): boolean;
    nack(queueName: string, deliveryTag: number): boolean;
    abandon(): void;
}
