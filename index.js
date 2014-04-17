/*
 * gaze
 * https://github.com/shama/gaze
 *
 * Copyright (c) 2014 Kyle Robinson Young
 * Licensed under the MIT license.
 */

// If on node v0.8, serve gaze04
var version = process.versions.node.split('.');
if (version[0] === '0' && version[1] === '8') {
  module.exports = require('./lib/gaze04.js');
} else {
  try {
    // Check whether pathwatcher successfully built without running it
    require('bindings')({ bindings: 'pathwatcher.node', path: true });
    // If successfully built, give the better version
    module.exports = require('./lib/gaze.js');
  } catch (err) {
    // Otherwise serve gaze04
    module.exports = require('./lib/gaze04.js');
  }
}
