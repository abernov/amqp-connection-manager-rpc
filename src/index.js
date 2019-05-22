import _amqp from 'amqp-connection-manager';
import NodeCache from 'node-cache';
import uuidv1 from 'uuid/v1';
import serializeError from 'serialize-error';
import deserializeError from 'deserialize-error';

async function getResponce(channelWrapper, corr, ttl) {
    return new Promise((resolve, reject) => {
        if (!channelWrapper.cache) {
            let checkperiod = Math.floor(channelWrapper.ttl / 5);
            if (!checkperiod) {
                checkperiod = 1;
            }
            let cache = new NodeCache({
                stdTTL: channelWrapper.ttl,
                checkperiod
            });
            cache.on("expired", (key, value) => {
                value.reject(new Error('TimeExpired'));
            });
            channelWrapper.cache = cache;
        }
        channelWrapper.cache.set(corr, {
            resolve,
            reject
        });
        if (ttl !== undefined) {
            channelWrapper.cache.ttl(corr, ttl);
        }
    });
}

export function connect(urls, options) {
    let connection = _amqp.connect(urls, options);

    /**
     * Create a new RPC worker(server).
     *
     * @param {string} queue_name - Name of queue for RPC request 
     * @param {function} callback - A callback function, 
     * returns a Promise with RPC server reply or Exception.
     * @param {Object} [options] -
     * @param {string} [options.sendErrorStack] - if true errors stack will be send to client. Default - false.
     * @param {string} [options.setup] - async function(channel). Default:
     * async function (channel) => {
     *      channel.prefetch(1);
     *      await channel.assertQueue(queue_name, { durable: false });
     *      return queue_name;
     * };
     * @return {Object} Return RPC worker(server) json reply.
     */
    connection.createRPCServer = function (queue_name, callback, options) {
        let channelWrapper = this.createChannel({
            json: true,
            setup: channel => {
                return new Promise(async function (resolve, reject) {
                    try {
                        let queue;
                        if (!options || typeof options.setup !== "function") {
                            channel.prefetch(1);
                            await channel.assertQueue(queue_name, {
                                durable: false
                            });
                            queue = queue_name;
                        } else {
                            queue = await options.setup(channel);
                        }                      
                        channel.consume(queue, async function (msg) {
                            try {
                                let reply = {};
                                try {
                                    let message = JSON.parse(msg.content.toString());
                                    reply.msg = await callback(message, msg);
                                } catch (err) {
                                    if (!options || !options.sendErrorStack) {
                                        delete err.stack;
                                    }
                                    reply.err = serializeError(err);
                                }
                                let exchangeName = '';
                                await channelWrapper.publish(exchangeName, msg.properties.replyTo, reply, {
                                    correlationId: msg.properties.correlationId
                                });
                            } catch (err) {
                                console.error("RPCServer, consume exception: ", err);
                            }
                            channel.ack(msg);
                        });
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                });
            }
        });
        return channelWrapper;
    };

    /**
     * Create a new RPC client.
     *
     * @param {string} queue_name - Name of queue for RPC request. Default ""
     * @param {int} [ttl] - time to live for RPC request (seconds).
     * To infinite set to 0. If not defined used 0.
     * @param {Function} [setup] - async function(channel). Default:
     * async function (channel) => {
     *      return await channel.assertQueue('', { exclusive: true })
     * };
     * @returns {Object} - Channel wrapper
     */
    connection.createRPCClient = function (queue_name = "", ttl = 0, setup) {
        let channelWrapper = connection.createChannel({
            json: true,
            setup: function (channel) {
                channelWrapper.ttl = ttl;
                return new Promise(async function (resolve, reject) {
                    try {
                        let queue;
                        if (typeof setup !== "function") {
                            queue = await channel.assertQueue('', { exclusive: true });
                        } else {
                            queue = await setup(channel);
                        }
                        /**
                         * Async function. Send request to RPC server.
                         *
                         * @param {Object} msg - message 
                         * @param {int} [ttl] - time to live for RPC request (seconds).
                         * To infinite set to 0. If not set used value from createRPCClient.
                         * @param {String} [exchangeName] - exchange name. Default value ""
                         * @param {String} [routingKey] - routing key. Default value ""
                         * @returns {Object|Exception} - RPC job reply
                         */
                        channelWrapper.sendRPC = async function (msg, ttl, exchangeName = "", routingKey = queue_name) {
                            let corr = uuidv1();
                            channelWrapper.corr = corr;
                            await channelWrapper.publish(exchangeName, routingKey, msg, {
                                correlationId: corr,
                                replyTo: queue.queue,
                                expiration: (ttl !== undefined ? ttl : channelWrapper.ttl) * 1000
                            });
                            return await getResponce(channelWrapper, corr, ttl);
                        };
                        channel.consume(queue.queue, function (msg) {
                            let cache = channelWrapper.cache;
                            if (cache) {
                                let value = cache.get(msg.properties.correlationId);
                                if (value) {
                                    cache.del(msg.properties.correlationId);
                                    try {
                                        let json = JSON.parse(msg.content.toString());
                                        if (json.err) {
                                            value.reject(deserializeError(json.err));
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