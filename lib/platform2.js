
var path = require('path');
var v8 = 'v8-' + /[0-9]+\.[0-9]+/.exec(process.versions.v8)[0];
var pathwatcherPath = path.join(__dirname, '..', 'bin', process.platform + '-' + process.arch + '-' + v8, 'pathwatcher.node');

var binding = require(pathwatcherPath);
var HandleMap = binding.HandleMap;

function Platform(filepath) {
  if (!(this instanceof Platform)) return new Platform(filepath);
}
module.exports = Platform

Platform.prototype.close = function() {
  binding.close()
}
