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
var channelWrapper = connection.createRPCServer(QUEUE_NAME, doRpcJob);

async function doRpcJob(msg) {
    if (!msg.b) throw new Error('B is not set'); //Exceptions allowed! Will be send to RPC client.
    let reply = {
        a: msg.a ? msg.a + 1 : null
    }
    return reply;
}

channelWrapper.waitForConnect()
.then(async function() {
    console.log("Connected to RPC channel");
});
