const Promise = require('bluebird'),
  _ = require('lodash'),
  sizeof = require('object-sizeof'),
  Client = require('bitcoin-core');

let client = new Client({
  host: 'localhost',
  port: 18332,
  username: 'user',
  password: '123',
  timeout: 30000
});

const inspect = data => {
  console.log(require('util').inspect(data, { showHidden: true, depth: null }));
}

let init = async () => {

  let blockHash = await client.getBlockHash(4110).catch((e) => console.log(e));
  let block = await client.getBlock(blockHash);
  
  let batch = block.tx.map(tx => ({
    method: 'getrawtransaction',
    parameters: [tx, 1]
  }));

  let rawTxs = await Promise.mapSeries(
    _.chunk(batch, 10), chunk => client.command(chunk)
  );
  
  let inputs = _.chain(rawTxs)
    .flattenDeep()
    .reject(tx => tx instanceof Error)
    .map(tx => tx.vin)
    .flattenDeep()
    .reject(vin => _.has(vin, 'coinbase'))
    .value();

  let batch2 = inputs.map(input => ({
    method: 'getrawtransaction',
    parameters: [input.txid, 1]
  }));

let cc =0;
  let inputTxs = await Promise.mapSeries(
    _.chunk(batch2, 5), async (chunk, idx) => {
      let zz = await client.command(chunk)
      _.map(zz, e => { delete e.hex });
      cc += sizeof(zz);
      return Promise.resolve(zz)
    }
  );

  inputTxs = _.chain(inputTxs)
    .flattenDeep()
    .reject(tx => tx instanceof Error)
    .value();

///
  let addresses = _.chain(rawTxs)
    .map(tx =>
      _.chain(tx.vin)
        .filter(vin => vin.txid)
        .map(vin => {
          console.log(vin.txid);
          console.log(inputTxs[0]);
          let tx = _.find(inputTxs, {hash: vin.txid});
          //console.log(tx)
          return tx.vout[vin.vout];
        })
        .union(tx.vout)
        .value()
    )
    .flattenDeep()
    .map(v => v.scriptPubKey.addresses)
    .flattenDeep()
    .uniq()
    .value();

  let filtered = [_.take(addresses, 2), []];

  let out = _.chain(filtered)
    .flattenDeep()
    .compact()
    .map(account => ({
      address: account,
      txs: _.chain(rawTxs)
        .filter(tx => _.chain(tx.vin)
          .union(tx.vout)
          .flattenDeep()
          .map(v => v.scriptPubKey.addresses)
          .flattenDeep()
          .includes(account)
          .value()
        )
        .map(tx => tx.hash)
        .value()
    }))
    .value();

  console.log(out);

};

module.exports = init().catch(e => console.log(e));