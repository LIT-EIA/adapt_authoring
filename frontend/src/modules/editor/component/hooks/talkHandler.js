define(function(require) {
  var Origin = require('core/origin');

  const updateModelItemNames = function (items, nameArray, formPropertiesEditor) {
    nameArray.forEach(function(element, index) {
      var filteredItems = items.filter(function(item){
        return item['_character'] == (index + 1);
      });
      filteredItems.forEach(function(item) {
        item['_characterName'] = element;
      });
      if (formPropertiesEditor) {
        var characterNameEls = formPropertiesEditor.$el.find(`[data-realvalue="${index + 1}"] .list-item-value`).toArray();
        characterNameEls.forEach(function(char) {
          char.innerHTML = element;
        });
      }
    });
  };

  const before = function(model) {
    var properties = model.get('properties');
    if (!properties) return;
    var items = properties['_items'];
    var characters = properties['_characters'].map(function(character) {
      return character['name'];
    });
    updateModelItemNames(items, characters);
  }

  const after = function(model, form) {
    Origin.on('scaffold:decreaseActiveModals', function() {
      if (model.get('_component') == 'talk') {
        var properties = model.get('properties');
        if (!properties) return;
        var items = properties['_items'];
        var formPropertiesEditor = form.fields && form.fields['properties'] && form.fields['properties'].editor;
        if (formPropertiesEditor) {
          var formCharacterNamesElArray = formPropertiesEditor.$el.find('[data-id="name"] .list-item-value').toArray();
          var formCharacterNames = formCharacterNamesElArray.map(function(element) {
            return element.innerText;
          });
          updateModelItemNames(items, formCharacterNames, formPropertiesEditor);
        }
      }
    })
  }

  return {
    before: before,
    after: after
  };
});
