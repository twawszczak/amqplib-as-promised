"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const amqplib_1 = __importDefault(require("amqplib"));
const events_1 = require("events");
const channel_1 = require("./channel");
class Connection extends events_1.EventEmitter {
    constructor(url, options) {
        super();
        this.url = url;
        this.options = options;
    }
    async init() {
        this.connection = await amqplib_1.default.connect(this.url, this.options);
        this.connection.once('close', () => {
            this.emit('close');
            delete this.connection;
        });
    }
    async createChannel() {
        if (!this.connection) {
            throw new Error('Cannot create channel - connection wrapper is not initialized.');
        }
        const nativeChannel = await this.connection.createChannel();
        return new channel_1.Channel(nativeChannel, this.connection);
    }
    async close() {
        if (this.connection) {
            await this.connection.close();
        }
    }
    async waitForClose() {
        return new Promise((resolve, reject) => {
            if (!this.connection) {
                reject(new Error('Cannot wait for connection close - connection not initialized.'));
            }
            else {
                this.connection.once('close', () => {
                    resolve();
                });
            }
        });
    }
}
exports.Connection = Connection;
