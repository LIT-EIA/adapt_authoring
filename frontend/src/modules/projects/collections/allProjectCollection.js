define(function (require) {
  var Backbone = require('backbone');
  var CourseModel = require('core/models/courseModel');

  var AllProjectCollection = Backbone.Collection.extend({
    model: CourseModel,
    url: 'api/all/course'
  });

  return AllProjectCollection;
});
