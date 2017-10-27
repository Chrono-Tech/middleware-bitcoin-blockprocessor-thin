const mongoose = require('mongoose'),
  amqp = require('amqplib'),
  bunyan = require('bunyan'),
  blockModel = require('./models/blockModel'),
  blockProcessService = require('./services/blockProcessService'),
  _ = require('lodash'),
  log = bunyan.createLogger({name: 'core.blockProcessor'}),
  config = require('./config'),
  Promise = require('bluebird'),
  bitcoin = Promise.promisifyAll(require('bitcoin'));

/**
 * @module entry point
 * @description process blocks, and notify, through rabbitmq, other
 * services about new block or tx, where we meet registered address
 */



mongoose.Promise = Promise;
mongoose.connect(config.mongo.uri, {useMongoClient: true});
let client = new bitcoin.Client(config.bitcoin);

const init = async function () {
  let amqpInstance = await amqp.connect(config.rabbit.url)
    .catch(() => {
      log.error('rabbitmq process has finished!');
      process.exit(0);
    });

  let channel = await amqpInstance.createChannel();
  await channel.assertExchange('events', 'topic', {durable: false});

  let currentBlock = await blockModel.findOne({network: config.bitcoin.network}).sort('-block');
  currentBlock = _.chain(currentBlock).get('block', 0).add(0).value();
  log.info(`search from block:${currentBlock} for network:${config.bitcoin.network}`);

  let processBlock = async () => {

    try {

      console.log(currentBlock)
      let blockHash = await client.getBlockHashAsync(currentBlock)
        .catch(() => Promise.reject({status: 1}));

      await channel.publish('events', `${config.rabbit.serviceName}_block`, new Buffer(JSON.stringify({block: blockHash})));

      let filteredTxs = await Promise.resolve(blockProcessService(client, blockHash)).timeout(5 * 60000);

      await Promise.all(filteredTxs.map(item =>
      channel.publish('events', `${config.rabbit.serviceName}_transaction.${item.address}`, new Buffer(JSON.stringify(Object.assign(item, {block: blockHash}))))
      ));


      await blockModel.findOneAndUpdate({network: config.bitcoin.network}, {
        $set: {
          block: currentBlock,
          created: Date.now()
        }
      }, {upsert: true});

      currentBlock++;
      processBlock();
    } catch (err) {

      console.log(err)

      if (err instanceof Promise.TimeoutError)
        return processBlock();

      if (_.get(err, 'code') === 0) {
        log.info(`await for next block ${currentBlock}`);
        return setTimeout(processBlock, 10000);
      }

      currentBlock++;
      processBlock();
    }
  };

  processBlock();

};

module.exports = init();
