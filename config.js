'use strict';
const Store = require('electron-store');

const privateKeys = require('@maxmobility/private-keys');

module.exports = new Store({
  defaults: {
    kinvey: {
      environment: privateKeys.SmartEvalKinveyKeys.PROD_KEY,
      collection: 'PSDSData'
    }
  }
});
