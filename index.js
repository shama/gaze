/*
 * gaze
 * https://github.com/shama/gaze
 *
 * Copyright (c) 2013 Kyle Robinson Young
 * Licensed under the MIT license.
 */

var version = process.versions.node.split('.');
module.exports = (version[0] === '0' && version[1] === '8')
  ? require('./lib/gaze04.js')
  : require('./lib/gaze.js');
