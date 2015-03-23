/*
 * gaze
 * https://github.com/shama/gaze
 *
 * Copyright (c) 2015 Kyle Robinson Young
 * Licensed under the MIT license.
 */

var path = require('path');
var fs = require('fs');

// If on node v0.8, serve gaze04
var version = process.versions.node.split('.');
if (version[0] === '0' && version[1] === '8') {
  module.exports = require('./lib/gaze04.js');
} else {
  var v8 = 'v8-' + /[0-9]+\.[0-9]+/.exec(process.versions.v8)[0];
  var pathwatcherPath = path.join(__dirname, 'bin', process.platform + '-' + process.arch + '-' + v8, 'pathwatcher.node');
  if (fs.existsSync(pathwatcherPath)) {
    module.exports = require('./lib/gaze.js');
  } else {
    // Otherwise serve gaze04
    module.exports = require('./lib/gaze04.js');
  }
}
