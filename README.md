# amqplib-as-promised

<!-- markdownlint-disable MD013 -->

[![Build Status](https://secure.travis-ci.org/twawszczak/amqplib-as-promised.svg)](http://travis-ci.org/twawszczak/amqplib-as-promised) [![npm](https://img.shields.io/npm/v/amqplib-as-promised.svg)](https://www.npmjs.com/package/amqplib-as-promised)

<!-- markdownlint-enable MD013 -->

This module wrapping [amqplib node.js
library](http://www.squaremobius.net/amqp.node/channel_api.html) to provide
classic `Promise` interface (instead of original implementation using Bluebird
promises).

Publishing messages in a channel or confirm channel will resolve the promise
only if operation will be finished.

Also, AMQP protocol closing channel when any error occurs. (even in case of
using `checkQueue` method, error is emitted and channel is closed, when queue
does not exist). That library wrapper automatically reconnects channel and
returning error as a Promise `reject` response.

## Requirements

This module requires Node >= 10.

## Installation

```shell
npm install amqplib-as-promised
```

## Usage

(with `async` `await` syntax)

```js
const { Connection } = require('amqplib-as-promised')
const connection = new Connection(AMQP_URL)
await connection.init()
const channel = await connection.createChannel() // or createConfirmChannel
await channel.assertQueue(queueName)
await channel.sendToQueue(queueName, Buffer.from(testMessage))
await channel.close()
await connection.close()
```

TypeScript version

```ts
import { Connection } from 'amqplib-as-promised'
const connection = new Connection(AMQP_URL)
await connection.init()
const channel = await connection.createChannel() // or createConfirmChannel
await channel.assertQueue(queueName)
await channel.sendToQueue(queueName, Buffer.from(testMessage))
await channel.close()
await connection.close()
```

For proper typing with TypeScript, _@types/amqplib_ in `devDependencies` is
needed. (compatible versions: 0.5.4 < 1)

## API

<!-- markdownlint-disable MD013 -->

### Connection

| Method               | arguments                                             | return type              | notes |
| -------------------- | ----------------------------------------------------- | ------------------------ | ----- |
| _constructor_        | **url**: string **options**?: amqplib.Options.Connect | Connection               |       |
| init                 | -                                                     | Promise\<void>           |       |
| createChannel        | -                                                     | Promise\<Channel>        |       |
| createConfirmChannel | -                                                     | Promise\<ConfirmChannel> |       |
| close                | -                                                     | Promise\<void>           |       |
| waitForClose         | -                                                     | Promise\<void>           |       |

### Channel

| Method         | arguments                                                                                                          | return type                              | notes |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ----- |
| checkQueue     | **queueName**: string                                                                                              | Promise\<amqplib.Replies.AssertQueue>    |       |
| assertQueue    | **queueName**: string **options**?: amqplib.Options.AssertQueue                                                    | Promise\<amqplib.Replies.AssertQueue>    |       |
| deleteQueue    | **queueName**: string **options**?: amqplib.Options.DeleteQueue                                                    | Promise\<amqplib.Replies.DeleteQueue>    |       |
| sendToQueue    | **queueName**: string **content**: Buffer **options**?: amqplib.Options.Publish                                    | Promise\<unknown>                        |       |
| bindQueue      | **queueName**: string, **source**: string, **pattern**: string, **args**?: any                                     | Promise\<amqplib.Replies.Empty>          |       |
| unbindQueue    | **queueName**: string, **source**: string, **pattern**: string, **args**?: any                                     | Promise\<amqplib.Replies.Empty>          |       |
| assertExchange | **exchangeName**: string **exchangeType**: string **options**?: amqplib.Options.AssertExchange                     | Promise\<amqplib.Replies.AssertExchange> |       |
| checkExchange  | **exchangeName**: string                                                                                           | Promise\<amqplib.Replies.Empty>          |       |
| deleteExchange | **exchangeName**: string **options**: amqplib.Options.DeleteExchange                                               | Promise\<amqplib.Replies.Empty>          |       |
| bindExchange   | **destination**: string **source**: string **pattern**: string **args**?: any                                      | Promise\<amqplib.Replies.Empty>          |       |
| unbindExchange | **destination**: string **source**: string **pattern**: string **args**?: any                                      | Promise\<amqplib.Replies.Empty>          |       |
| publish        | **exchange**: string **queue**: string **content**: Buffer **options**?: amqplib.Options.Publish                   | Promise\<unknown>                        |       |
| prefetch       | **count**: number **global**: boolean                                                                              | Promise\<void>                           |       |
| consume        | **queueName**: string **handler**: (message: amqplib.Message \| null) => any **options**?: amqplib.Options.Consume | Promise\<amqplib.Replies.Consume>        |       |
| cancel         | **consumerTag**: string                                                                                            | Promise\<amqplib.Replies.Empty>          |       |
| get            | **queueName**: string **options**?: amqplib.Options.Get                                                            | Promise\<Message \| false>               |       |
| ack            | **message**: amqplib.Message **allUpTo**?: boolean                                                                 | void                                     |       |
| nack           | **message**: amqplib.Message **allUpTo**?: boolean **requeue**?: boolean                                           | void                                     |       |
| close          | -                                                                                                                  | Promise\<void>                           |       |

### Confirm channel

| Method          | arguments                                                                                        | return type                     | notes |
| --------------- | ------------------------------------------------------------------------------------------------ | ------------------------------- | ----- |
| sendToQueue     | **queueName**: string **content**: Buffer **options**?: amqplib.Options.Publish                  | Promise\<amqplib.Replies.Empty> |       |
| publish         | **exchange**: string **queue**: string **content**: Buffer **options**?: amqplib.Options.Publish | Promise\<amqplib.Replies.Empty> |       |
| waitForConfirms | **exchange**: string **queue**: string **content**: Buffer **options**?: amqplib.Options.Publish | Promise\<void>                  |       |

<!-- markdownlint-enable MD013 -->

## License

Copyright (c) 2019 Piotr Roszatycki <piotr.roszatycki@gmail.com>

Copyright (c) 2017-2018 Tadeusz Wawszczak

[MIT](https://opensource.org/licenses/MIT)
