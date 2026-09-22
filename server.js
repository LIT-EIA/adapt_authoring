const app = require('./lib/application')();
const argv = require('minimist')(process.argv.slice(2));

app.run(argv);
