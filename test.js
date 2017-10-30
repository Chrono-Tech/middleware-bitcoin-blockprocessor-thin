const Promise = require('bluebird'),
  _ = require('lodash'),
  bitcoin = Promise.promisifyAll(require('bitcoin'));

let client = new bitcoin.Client({
  host: 'localhost',
  port: 18332,
  user: 'user',
  pass: '123',
  timeout: 30000
});

let init = async () => {

  let blockHash = await client.getBlockHashAsync(4110).catch((e) => console.log(e));
  let block = await client.getBlockAsync(blockHash);
  //let rawTxs = await Promise.mapSeries(block.tx, tx => client.getRawTransactionAsync(tx, 1));
  //let rawTxs = await Promise.mapSeries(block.tx, tx => client.getRawTransactionAsync(tx, 1));

  let batch = block.tx.map(tx => ({
    method: 'getrawtransaction',
    params: [tx, 1]
  }));

  let rawTxs = await Promise.mapSeries(
    _.chunk(batch, 10),
    chunk =>
      new Promise(res => {
        let counter = 0;
        let result = [];
        client.cmd(chunk, function (err, data) {
          counter++;
          if (!err)
            result.push(data);
          if (counter === chunk.length)
            res(result);
        });
      })
  );

  rawTxs = _.flattenDeep(rawTxs);

  let inputs = _.chain(rawTxs)
    .map(tx => tx.vin)
    .flattenDeep()
    .reject(vin => _.has(vin, 'coinbase'))
    .value();

  console.log(inputs.length);

  let batch2 = inputs.map(input => ({
    method: 'getrawtransaction',
    params: [input.txid, 1]
  }));

  let inputTxs = await Promise.mapSeries(
    _.chunk(batch2, 5),
    chunk =>
      new Promise(res => {
        let counter = 0;
        let result = [];
        client.cmd(chunk, function (err, data) {
          counter++;
          if (!err)
            result.push(data);
          if (counter === chunk.length) {
            res(result);
            console.log('chunk accomplished');
          }
        });
      })
  );

  inputTxs = _.flattenDeep(inputTxs);

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