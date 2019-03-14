var amqp = require('..');

var QUEUE_NAME = 'RPC-test'

// Create a connetion manager
var connection = amqp.connect(['amqp://localhost'], {json: true});
connection.on('connect', function() {
    console.log('Connected!');
});
connection.on('disconnect', function(params) {
    console.log('Disconnected.', params.err.stack);
});

// Set up a channel for RPC requests.
const ttl = 60; // Time to live for RPC request (seconds)
var channelWrapper = connection.createRPCClient(QUEUE_NAME, ttl);

channelWrapper.waitForConnect()
.then(async function() {
    console.log("Connected to RPC channel");

    let req = { a: 1, b: 2};
    try{
        let prc_reply = await channelWrapper.sendRPC(req);
        console.log("RPC reply: ", prc_reply);
    } catch (err) {
        console.log("RPC error: ", err);
    }
});
