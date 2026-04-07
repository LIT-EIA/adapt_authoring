const { OutputPlugin } = require('../../../lib/outputmanager');
const util = require('util');

function StoryboardOutput() {}
util.inherits(StoryboardOutput, OutputPlugin);

// ONLY storyboard functionality
StoryboardOutput.prototype.storyboard = require('./storyboard');

module.exports = StoryboardOutput;
