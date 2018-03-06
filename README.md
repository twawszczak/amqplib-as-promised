## amqplib-as-promised

This module wrapping [amqplib node.js library](http://www.squaremobius.net/amqp.node/channel_api.html)
to provide classic `Promise` interface. (instead of original implementation using Bluebird promises)
Also, AMQP protocol closing channel when any error occurs. (even in case of using `checkQueue` method,
error is emitted and channel is closed, when queue does not exist) That library wrapper automatically
reconnects channel and returning error as a Promise `reject` response.


### Requirements

This module requires Node >= 8.

### Installation

```shell
npm install amqplib-as-promised
```

### Usage

(with `async` `await` syntax)

```js
const { Connection } = require('amqplib-as-promised')
const connection = new Connection(AMQP_URL)
await connection.init()
const channel = await connection.createChannel()
await channel.assertQueue(queueName)
await channel.sendToQueue(queueName, Buffer.from(testMessage))
await channel.close()
await connection.close()
```

### License

Copyright (c) 2017-2018 Tadeusz Wawszczak

[MIT](https://opensource.org/licenses/MIT)