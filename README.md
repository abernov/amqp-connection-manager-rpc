[![NPM Package](https://img.shields.io/npm/v/amqp-connection-manager-rpc.svg?style=flat-square)](https://www.npmjs.org/package/amqp-connection-manager-rpc)
[![Build Status](https://travis-ci.org/niahmiah/amqp-connection-manager-rpc.svg?branch=master)](https://travis-ci.org/niahmiah/amqp-connection-manager-rpc)
[![Coverage Status](https://coveralls.io/repos/niahmiah/amqp-connection-manager-rpc/badge.svg?branch=master&service=github)](https://coveralls.io/github/niahmiah/amqp-connection-manager-rpc?branch=master)
[![Greenkeeper badge](https://badges.greenkeeper.io/niahmiah/amqp-connection-manager-rpc.svg)](https://greenkeeper.io/)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

[![Dependency Status](https://david-dm.org/niahmiah/amqp-connection-manager-rpc.svg)](https://david-dm.org/niahmiah/amqp-connection-manager-rpc)
[![devDependency Status](https://david-dm.org/niahmiah/amqp-connection-manager-rpc/dev-status.svg)](https://david-dm.org/niahmiah/amqp-connection-manager-rpc#info=devDependencies)
[![peerDependency Status](https://david-dm.org/niahmiah/amqp-connection-manager-rpc/peer-status.svg)](https://david-dm.org/niahmiah/amqp-connection-manager-rpc#info=peerDependencies)

Extend [amqp-connection-manager connection management for amqplib](https://github.com/niahmiah/node-amqp-connection-manager) to support [Remote procedure call (RPC)](https://www.rabbitmq.com/tutorials/tutorial-six-java.html).

# amqp-connection-manager-rpc

## Features

* Time to live for RPC requests.
* Exceptions transmitted from RPC server to RPC client.
* Simple async function API design

## Installation

    npm install --save amqplib amqp-connection-manager amqp-connection-manager-rpc

## Basics

The basic idea described [at rabbitmq](https://www.rabbitmq.com/tutorials/tutorial-six-java.html).
To manage responses from an RPC server, [node-cache](https://github.com/mpneuried/nodecache) is used.


Here's the RPC client example:

```js
var amqp = require('amqp-connection-manager-rpc');

// Create a new connection manager
var connection = amqp.connect(['amqp://localhost'], {json: true});

// Setup a channel for RPC requests.
const ttl = 60; // Time to live for RPC request (seconds). 0 - infinite
var channelWrapper = connection.createRPCClient('RPC-QUEUE-test', ttl);

// Send some request to RPC server and receive reply. Exception can occupied!
let req = { a: 1, b: 2}; //request data
try{
    let prc_reply = await channelWrapper.sendRPC(req);
    console.log("RPC reply: ", prc_reply);
} catch (err) {
    console.log("RPC error: ", err);
}

```

Here's the RPC server example:

```js
var amqp = require('amqp-connection-manager-rpc');

// Create a new connection manager
var connection = amqp.connect(['amqp://localhost'], {json: true});

// Set up a channel for RPC requests.
var channelWrapper = connection.createRPCServer('RPC-QUEUE-test', doRpcJob);

//do RPC job
async function doRpcJob(msg) {
    if (!msg.b) throw new Error('B is not set'); //Exceptions allowed! Will be send to RPC client.
    let reply = {
        a: msg.a ? msg.a + 1 : null
    }
    return reply;
}

```

See a complete example in the [examples](./examples) folder.

## API

See [amqp-connection-manager API](https://github.com/niahmiah/node-amqp-connection-manager).

### AmqpConnectionManager#createRPCClient(queue_name[, ttl])

Create a new RPC client ChannelWrapper.

* `queue_name` -  Name of queue for RPC request.
* `ttl` - time to live for RPC request (seconds). To infinite set to 0. If not defined used 0.
  
Returns ChannelWrapper 

### AmqpConnectionManager#createRPCServer(queue_name, callback[, options] )

Create a new RPC server ChannelWrapper.

* `queue_name` -  Name of queue for RPC request.
* `callback` - A callback function, which returns a Promise. This should return RPC server json reply.
Callback function has one argument - message from RPC client.

Options:

* `options.sendErrorStack` - if true errors stack will be send to client. Default - false.

Returns ChannelWrapper 

### ChannelWrapper#sendRPC(msg [,ttl])

Send RPC request to RPC server. Call it on client only.

* `msg` -  request Object to RPC server.
* `ttl` - time to live for RPC request (seconds). To infinite set to 0. If not defined used value from createRPCClient().

Returns Object with RPC job reply or Exception

## Fork it!

Pull requests, issues, and feedback are welcome.
