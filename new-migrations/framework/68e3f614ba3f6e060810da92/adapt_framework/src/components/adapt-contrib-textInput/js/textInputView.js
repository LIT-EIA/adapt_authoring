define([
    'core/js/views/questionView'
], function(QuestionView) {

    var TextInputView = QuestionView.extend({

        events: {
            'focus input': 'clearValidationError',
            'change input': 'onInputChanged'
        },

        resetQuestionOnRevisit: function() {
            this.setAllItemsEnabled(false);
            this.resetQuestion();
        },

        setupQuestion: function() {
            this.model.setupRandomisation();
        },

        disableQuestion: function() {
            this.setAllItemsEnabled(false);
        },

        enableQuestion: function() {
            this.setAllItemsEnabled(true);
        },

        setAllItemsEnabled: function(isEnabled) {
            this.model.get('_items').forEach(function(item, index) {
                var $itemInput = this.$('input').eq(index);

                $itemInput.prop('disabled', !isEnabled);
            }, this);
        },

        onQuestionRendered: function() {
            this.setReadyStatus();
        },

        clearValidationError: function() {
            this.$('.textinput-item-textbox').removeClass('textinput-validation-error');
        },

        // Blank method for question to fill out when the question cannot be submitted
        onCannotSubmit: function() {
            this.showValidationError();
        },

        showValidationError: function() {
            this.$('.textinput-item-textbox').addClass('textinput-validation-error');
        },

        // This is important and should give the user feedback on how they answered the question
        // Normally done through ticks and crosses by adding classes
        showMarking: function() {
            if (!this.model.get('_canShowMarking')) return;

            this.model.get('_items').forEach(function(item, i) {
                var $item = this.$('.textinput-item').eq(i);
                $item.removeClass('correct incorrect').addClass(item._isCorrect ? 'correct' : 'incorrect');
            }, this);
        },

        // Used by the question view to reset the look and feel of the component.
        resetQuestion: function() {
            this.$('.textinput-item-textbox').prop('disabled', !this.model.get('_isEnabled')).val('');

            this.model.set({
                _isAtLeastOneCorrectSelection: false,
                _isCorrect: undefined
            });
        },

        showCorrectAnswer: function() {

            if (this.model.get('_answers'))  {

                var correctAnswers = this.model.get('_answers');
                this.model.get('_items').forEach(function(item, index) {
                    this.$('.textinput-item-textbox').eq(index).val(correctAnswers[index][0]);
                }, this);

            } else {
                this.model.get('_items').forEach(function(item, index) {
                    this.$('.textinput-item-textbox').eq(index).val(item._answers[0]);
                }, this);
            }

        },

        hideCorrectAnswer: function() {
            this.model.get('_items').forEach(function(item, index) {
                this.$('.textinput-item-textbox').eq(index).val(item.userAnswer);
            }, this);
        },

        onInputChanged: function(e) {
            var $input = $(e.target);
            this.model.setItemUserAnswer($input.parent('.component-item').index(), $input.val());
        }
    });

    return TextInputView;
});
