/*
 * gaze
 * https://github.com/shama/gaze
 *
 * Copyright (c) 2014 Kyle Robinson Young
 * Licensed under the MIT license.
 */

try {
  // Attempt to resolve optional pathwatcher
  require('bindings')('pathwatcher.node');
  var version = process.versions.node.split('.');
  module.exports = (version[0] === '0' && version[1] === '8')
    ? require('./lib/gaze04.js')
    : require('./lib/gaze.js');
} catch (err)  {
  // Otherwise serve gaze04
  module.exports = require('./lib/gaze04.js');
}
