const _ = require('lodash'),
  Promise = require('bluebird'),
  accountModel = require('../models/accountModel');


module.exports = async (client, blockHash) => {

  let block = await client.getBlockAsync(blockHash);
  let rawTxs = await Promise.mapSeries(block.tx, tx => client.getRawTransactionAsync(tx, 1));

  for (let s = 0; s < rawTxs.length; s++) {
    rawTxs[s].vin = await Promise.mapSeries(
      _.filter(rawTxs[s].vin, v => v.txid),
      async function (vin) {
        let tx = await client.getRawTransactionAsync(vin.txid, 1);
        return tx.vout[vin.vout];
      });
  }

  let addresses = _.chain(rawTxs)
    .map(tx => _.union(tx.vin, tx.vout))
    .flattenDeep()
    .map(v => v.scriptPubKey.addresses)
    .flattenDeep()
    .uniq()
    .chunk(100)
    .value();

  let filteredByChunks = await Promise.all(addresses.map(chunk =>
    accountModel.find({address: {$in: chunk}})
  ));

  return _.chain(filteredByChunks)
    .flattenDeep()
    .compact()
    .map(account => ({
      address: account.address,
      txs: _.chain(rawTxs)
        .filter(tx => _.chain(tx.vin)
          .union(tx.vout)
          .flattenDeep()
          .map(v => v.scriptPubKey.addresses)
          .flattenDeep()
          .includes(account.address)
          .value()
        )
        .map(tx => tx.hash)
        .value()
    }))
    .value();

};
