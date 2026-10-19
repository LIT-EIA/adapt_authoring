define(function(require) {
  var Origin = require('core/origin');

  const getProperties = function(model) {
    return model.get('properties');
  };

  const buildCharacterMap = function(characters) {
    const characterMap = {};

    characters.forEach(function(character, index) {
      characterMap[String(index + 1)] = character.name;
    });

    return characterMap;
  };

  const remapCharacterIndexes = function(items, oldIndex, newIndex) {
    const oldCharacterIndex = Number(oldIndex) + 1;
    const newCharacterIndex = Number(newIndex) + 1;

    items.forEach(function(item) {

      let currentIndex = Number(item._character);

      // moved character
      if (currentIndex === oldCharacterIndex) {
        currentIndex = newCharacterIndex;
      }

      // moved upward (3 -> 2)
      else if (oldCharacterIndex > newCharacterIndex) {

        if (
          currentIndex >= newCharacterIndex &&
          currentIndex < oldCharacterIndex
        ) {
          currentIndex += 1;
        }

      }

      // moved downward (2 -> 3)
      else if (oldCharacterIndex < newCharacterIndex) {

        if (
          currentIndex > oldCharacterIndex &&
          currentIndex <= newCharacterIndex
        ) {
          currentIndex -= 1;
        }

      }

      // Keep storage type consistent
      item._character = String(currentIndex);

    });
  };

  const getCurrentCharacterMap = function(model, form) {
    const formPropertiesEditor =
      form.fields &&
      form.fields.properties &&
      form.fields.properties.editor;

    if (formPropertiesEditor) {

      const names = formPropertiesEditor.$el
        .find('[data-id="name"] .list-item-value')
        .toArray()
        .map(function(el) {
          return el.innerText;
        });

      const map = {};

      names.forEach(function(name, index) {
        map[String(index + 1)] = name;
      });

      return map;
    }

    return buildCharacterMap(
      getProperties(model)._characters
    );
  };

  const syncCharacterNames = function(items, characterMap) {

    items.forEach(function(item) {

      if (item._character === '0') {
        item._characterName = 'Narrator';
        return;
      }

      item._characterName = characterMap[item._character] || '';

    });

  };

  const before = function(model) {    
    const properties = getProperties(model);
    if (!properties) return;

    const characterMap = buildCharacterMap(
      properties._characters
    );

    syncCharacterNames(
      properties._items,
      characterMap
    );
  }

  const after = function(model, form) {
    const onCharactersReordered = function(data) {
      if (data.listName !== '_characters') return;      

      const properties = getProperties(model);
      if (!properties) return;

      var items = properties['_items'];

      remapCharacterIndexes(
        items,
        data.oldIndex,
        data.newIndex
      );
    };

    Origin.off('list:reordered', onCharactersReordered);
    Origin.on('list:reordered', onCharactersReordered);

    Origin.on('scaffold:decreaseActiveModals', function() {
      if (model.get('_component') !== 'talk') return;

      const properties = getProperties(model);
      if (!properties) return;

      const characterMap = getCurrentCharacterMap(model, form);

      syncCharacterNames(
        properties._items,
        characterMap
      );
    })
  }

  return {
    before: before,
    after: after
  };
});
