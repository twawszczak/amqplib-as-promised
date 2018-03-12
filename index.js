"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const channel_1 = require("./lib/channel");
exports.Channel = channel_1.Channel;
const connection_1 = require("./lib/connection");
exports.Connection = connection_1.Connection;
tslib_1.__exportStar(require("amqplib"), exports);
