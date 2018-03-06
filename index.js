"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = require("./lib/connection");
exports.Connection = connection_1.Connection;
const channel_1 = require("./lib/channel");
exports.Channel = channel_1.Channel;
__export(require("amqplib"));
