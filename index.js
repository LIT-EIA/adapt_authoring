// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
var app = require('./lib/application');
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}

module.exports = app;
