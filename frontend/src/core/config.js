// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
require.config({
  paths: {
    ace: 'libraries/ace',
    backbone: 'libraries/backbone',
    'backbone-forms': 'libraries/backbone-forms',
    'backbone-forms-lists': 'libraries/backbone-forms-lists',
    ckeditor: 'libraries/ckeditor',
    ckeditorTranslationFr: 'libraries/ckeditorTranslationFr',
    handlebars: 'libraries/handlebars',
    imageReady: 'libraries/imageReady',
    inview: 'libraries/inview',
    jquery: 'libraries/jquery',
    jqueryForm : 'libraries/jquery.form',
    jqueryTagsInput: 'libraries/jquery.tagsinput.min',
    jqueryUI: 'libraries/jquery-ui.min',
    modernizr: 'libraries/modernizr',
    moment: 'libraries/moment.min',
    pikaday: 'libraries/pikaday/js/pikaday',
    polyglot: 'libraries/polyglot.min',
    rangeslider: 'libraries/rangeslider',
    scrollTo: 'libraries/scrollTo',
    selectize: 'libraries/selectize/js/selectize',
    shepherd: 'libraries/shepherd/shepherd',
    cropper: 'libraries/cropperjs/js/cropper',
    sweetalert: 'libraries/sweetalert.min',
    sweetalert2: 'libraries/sweetalert2.min',
    typeahead: 'libraries/typeahead',
    underscore: 'libraries/underscore',
    velocity: 'libraries/velocity'
  },
  shim: {
    // third-party
    ace: {
      exports: 'ace/ace'
    },
    backbone: {
      deps: ['underscore','jquery'],
      exports: 'Backbone'
    },
    'backbone-forms': {
      deps: ['backbone']
    },
    'backbone-forms-lists': {
      deps: ['backbone-forms']
    },
    handlebars: {
      exports: 'Handlebars'
    },
    imageReady: {
      deps: ['jquery'],
      exports: 'imageready'
    },
    inview: {
      deps: ['jquery'],
      exports: 'inview'
    },
    jqueryForm: {
      deps: ['jquery'],
      exports: "$"
    },
    jqueryTagsInput: {
      deps: ['jquery'],
      exports: "$"
    },
    jqueryUI: {
      deps: ['jquery'],
      exports: "$"
    },
    moment: {
      exports: 'moment'
    },
    polyglot: {
      exports: 'Polyglot'
    },
    scrollTo: {
      deps: ['jquery'],
      exports: 'scrollTo'
    },
    selectize: {
      deps: ['jquery'],
      exports: "$"
    },
    sweetalert: {
      deps: ['jquery'],
      exports: 'sweetAlert'
    },
    sweetalert2: {
      deps: ['jquery'],
      exports: 'sweetAlert2'
    },
    underscore: {
      exports: '_'
    },
    velocity: {
      deps: ['jquery'],
      exports: 'velocity'
    },
    // internal
    'templates/templates': {
      deps:['handlebars']
    }
  }
});
