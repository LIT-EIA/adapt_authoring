define(function(require) {
  var TalkHandler = require('./talkHandler');

  const beforeFormInstantiation = function(model) {
    if (model && model.get('_component') == 'talk') {
      TalkHandler.before(model);
    }
  }

  const afterFormInstantiation = function(model, form) {
    if (model && model.get('_component') == 'talk') {
      TalkHandler.after(model, form);
    }
  }

  return {
    beforeFormInstantiation: beforeFormInstantiation,
    afterFormInstantiation: afterFormInstantiation
  };
});
