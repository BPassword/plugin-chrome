const keythereum = require('keythereum-pure-js');

const { GeneratorWallet } = require('../../src/libs/accounts/wallet-generator.js');

const params = { keyBytes: 32, ivBytes: 16 };

const options = {};

t();

function t() {
  let ko = GeneratorWallet('12422');

  // tKeyether()
}

function tKeyether() {
  const dk = keythereum.create(params);
}
