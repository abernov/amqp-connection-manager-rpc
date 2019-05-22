
<a name="1.1.0"></a>
# 1.1.0 (2019-05-22)
 * For internal function getResponce changed cache checkperiod value

### Features

<a name="1.0.0"></a>
# 1.0.0 (2019-04-12)

### Features
* For AmqpConnectionManager#createRPCClient(queue_name, ttl, setup)
  - added optional parameter 'setup'.
* For ChannelWrapper#sendRPC = async function (msg, ttl, exchangeName, routingKey)
  - added optional parameter 'exchangeName'
  - added optional parameter 'routingKey'

### BREAKING CHANGES
 - timeout exception message changed to "TimeExpired"

<a name="0.2.0"></a>
# 0.2.0 (2019-04-10)

### Features
* For AmqpConnectionManager#createRPCServer(queue_name, callback[, options]):
  - added options parameter 'setup'.
  - for callback added second argument.

<a name="0.1.0"></a>
# 0.1.0 (2019-03-15)

### Features

* More accurately transmits errors to RPC client. It also works with custom error.
* For AmqpConnectionManager#createRPCServer(queue_name, callback[, options]) added options parameter.

<a name="0.0.1"></a>
# 0.0.1 (2019-03-14)

### Features

* **initial-release:**