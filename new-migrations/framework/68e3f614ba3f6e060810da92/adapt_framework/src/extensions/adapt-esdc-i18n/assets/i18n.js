$.i18n.translate = function (key, options) {
  var mode = options && options.mode;
  var data = options && options.data;
  var messages = this().messageStore.messages;
  var override = messages.override && messages.override[key];
  var lang = (mode === 'aat') ? localStorage.getItem("lang") || 'en' : document.documentElement.lang;
  this().locale = lang;
  var string = (mode !== 'aat') && override || this(key, data);
  var template = Handlebars.compile(string);
  var translation = template(data);
  return translation;
};

Handlebars.registerHelper('t', function (key, data) {
  return $.i18n.translate(key, {data: data});
});

Handlebars.registerHelper('tp', function (string, key) {
  return $.i18n.translate(string + key);
});

Handlebars.registerHelper('ta', function (key, data) {
  return $.i18n.translate(key, {data: data, mode: 'aat'});
});

Handlebars.registerHelper('tpa', function (string, key) {
  return $.i18n.translate(string + key, {mode: 'aat'});
});
