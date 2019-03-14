import _amqp from 'amqp-connection-manager';
import NodeCache from 'node-cache';
import uuidv1 from 'uuid/v1';

async function getResponce(channelWrapper, corr, ttl) {
    return new Promise((resolve, reject) => {
        if (!channelWrapper.cache) {
            let cache = new NodeCache({
                stdTTL: channelWrapper.ttl,
                checkperiod: Math.floor(channelWrapper.ttl / 2)
            });
            cache.on("expired", (key, value) => {
                value.reject(new Error('Time expired'));
            });
            channelWrapper.cache = cache;
        }
        channelWrapper.cache.set(corr, {
            resolve,
            reject
        });
        if (ttl !== null) {
            channelWrapper.cache.ttl(corr, ttl);
        }
    });
}


function errorToJson(err) {
    let alt = {};
    Object.getOwnPropertyNames(err).forEach(function (key) {
        if (key !== 'stack') { alt[key] = err[key]; }
    });
    return alt;
}

function jsonToError(err) {
    return new Error(err.message ? err.message : 'unknown');
}

export function connect(urls, options) {
    let connection = _amqp.connect(urls, options);

    /**
     * Create a new RPC worker(server).
     *
     * @param {string} queue_name - Name of queue for RPC request 
     * @param {function} callback - A callback function, which returns a Promise.
     * @return {Object} Should return RPC worker(server) json reply .
     */
    connection.createRPCServer = function (queue_name, callback) {
        let channelWrapper = this.createChannel({
            json: true,
            setup: channel =>
                Promise.all([
                    channel.assertQueue(queue_name, {
                        durable: false
                    }),
                    channel.prefetch(1),
                    channel.consume(queue_name, async function (msg) {
                        try {
                            let reply = {};
                            try {
                                let message = JSON.parse(msg.content.toString());
                                reply.msg = await callback(message);
                            } catch (err) {
                                reply.err = errorToJson(err);
                            }
                            await channelWrapper.sendToQueue(msg.properties.replyTo, reply, {
                                correlationId: msg.properties.correlationId
                            });
                        } catch (err) {
                            console.error("RPCServer, consume exception: ", err);
                        }
                        channel.ack(msg);
                    })
                ])
            });
        return channelWrapper;
    };

    /**
     * Create a new RPC client.
     *
     * @param {string} queue_name - Name of queue for RPC request 
     * @param {int} ttl - time to live for RPC request (seconds).
     * To infinite set to 0. If not defined used 0.
     * @returns {Object} - Channel wrapper
     */
    connection.createRPCClient = function (queue_name, ttl) {
        let channelWrapper = connection.createChannel({
            json: true,
            setup: function (channel) {
                return new Promise(async function (resolve, reject) {
                    try {
                        let q = await channel.assertQueue('', {
                            exclusive: true
                        });

                        /**
                         * Async function. Send request to RPC server.
                         *
                         * @param {Object} msg - message 
                         * @param {int} ttl - time to live for RPC request (seconds).
                         * To infinite set to 0. If not set used value from createRPCClient.
                         * @returns {Object|Exception} - RPC job reply
                         */
                        channelWrapper.sendRPC = async function (msg, ttl) {
                            let corr = uuidv1();
                            channelWrapper.corr = corr;
                            await channelWrapper.sendToQueue(queue_name, msg, {
                                correlationId: corr,
                                replyTo: q.queue,
                                expiration: (ttl !== null ? ttl : channelWrapper.ttl) * 1000
                            });
                            return await getResponce(channelWrapper, corr, ttl);
                        };
                        channel.consume(q.queue, function (msg) {
                            let cache = channelWrapper.cache;
                            if (cache) {
                                let value = cache.get(msg.properties.correlationId);
                                if (value) {
                                    cache.del(msg.properties.correlationId);
                                    try {
                                        let json = JSON.parse(msg.content.toString());
                                        if (json.err) {
                                            value.reject(jsonToError(json.err));
                                        } else {
                                            value.resolve(json.msg);
                                        }
                                    } catch (err) {
                                        value.reject(err);
                                    }
                                }
                            }
                        }, {
                            noAck: true
                        });
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                });
            }
        });
        channelWrapper.ttl = ttl || 0;
        if (channelWrapper.sendRPC === null) {
            channelWrapper.sendRPC = async () => {
                throw new Error('ChannelNotReady');
            };
        }
        return channelWrapper;
    };
    return connection;
}

const amqp = {
    connect
};

export default amqp;