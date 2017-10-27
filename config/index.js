require('dotenv').config();

/**
 * @factory config
 * @description base app's configuration
 * @returns {{
 *    mongo: {
 *      uri: (*)
 *      },
 *    rabbit: {
 *      url: (*)
 *      },
 *    bitcoin: {
 *      host: (*),
 *      port: (*),
 *      user: (*),
 *      pass: (*)
 *      }
 *    }}
 */

module.exports = {
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/data'
  },
  rabbit: {
    url: process.env.RABBIT_URI || 'amqp://localhost:5672',
    serviceName: process.env.RABBIT_SERVICE_NAME || 'app_bitcoin'
  },
  bitcoin: {
    network: process.env.BITCOIN_NETWORK || 'testnet',
    host: process.env.BITCOIN_HOST || 'localhost',
    port: process.env.BITCOIN_PORT || 8332,
    user: process.env.BITCOIN_USERNAME || 'username',
    pass: process.env.BITCOIN_PASSWORD || 'password',
    timeout: parseInt(process.env.BITCOIN_TIMEOUT) || 30000
  }
};
