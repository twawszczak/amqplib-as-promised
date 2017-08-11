## amqplib-as-promised

This module wrapping [amqplib node.js library](http://www.squaremobius.net/amqp.node/channel_api.html) to provide support for asynchronous message sending.

### Requirements

This module requires Node >= 8.

### Installation

```shell
npm install amqplib-as-promised
```

### Usage

`amqplib-as-promised` can be used like standard `amqplib` module:

```js
const amqp = require('amqplib-as-promised')
```

the only difference is, that methods `publish` and `sendToQueue` returns promise instead of boolean value, so you can check when you can send next message to queue like that:

```js

(async () => {
  const connection = amqp.connect('amqp://localhost')
  const channel = connection.createChannel()
  
  for (let i = i; i <= 100; i++) {
    await channel.sendToQueue(queueName, nextMessage())  
  }
})()
```


### License

Copyright (c) 2016-2017 Piotr Roszatycki <piotr.roszatycki@gmail.com>

[MIT](https://opensource.org/licenses/MIT)