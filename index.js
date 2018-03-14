"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const channel_1 = require("./lib/channel");
exports.Channel = channel_1.Channel;
const connection_1 = require("./lib/connection");
exports.Connection = connection_1.Connection;
var amqplib_1 = require("amqplib");
exports.credentials = amqplib_1.credentials;
exports.connect = amqplib_1.connect;
