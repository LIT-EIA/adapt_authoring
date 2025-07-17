const axios = require('axios');
const configuration = require('./configuration');
const logger = require('./logger');

const CONFIG_SETTINGS = [
  'useMailService',
  'printMailService',
  'mailServiceUrl',
  'mailServiceApiKey',
];

const MailService = function () {
  CONFIG_SETTINGS.forEach(key => this[key] = configuration.getConfig(key));
  var self = this;
  self.templates = {};
  var configs = configuration.getConfig();
  const regex = /^mailServiceTemplates\/.+/;
  Object.keys(configs).forEach(function (key) {
    if(regex.test(key)){
      var template = key.split('/')[1];
      self.templates[template] = configs[key];
    }
  });
};


MailService.prototype.send = function (data, callback) {
  logger.log('info', 'Trying to send email via notification API');

  if (!data.template) {
    logger.log('error', 'Mail service requires a template.');
    return callback({ message: 'Mail service requires a template.' });
  }

  const config = {
    headers: { Authorization: `ApiKey-v1 ${this.mailServiceApiKey}` }
  };

  if (this.printMailService) {
    console.log("email data: ", data.personalisation);
  }
  if (!this.useMailService) {
    logger.log('info', 'MaileService.send: MailService is not enabled.');
    return callback();
  }
  const bodyParameters = {
    email_address: data.email,
    template_id: this.templates[data.template],
    personalisation: data.personalisation
  };
  axios.post(
    this.mailServiceUrl,
    bodyParameters,
    config
  )
    .then(function (data) {
      logger.log('info', 'Email sent');
      return callback();
    })
    .catch(function (error) {
      logger.log('error', JSON.stringify(error.response.data));
      return callback({ message: JSON.stringify(error.response.data) });
    });
}

module.exports = MailService;
