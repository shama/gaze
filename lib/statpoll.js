/*
 * gaze
 * https://github.com/shama/gaze
 *
 * Copyright (c) 2014 Kyle Robinson Young
 * Licensed under the MIT license.
 */

'use strict';

var fs = require('fs');
var polled = Object.create(null);
var lastTick = Date.now();
var running = false;

var statpoll = module.exports = function(filepath, cb) {
  if (!polled[filepath]) {
    polled[filepath] = { stat: fs.lstatSync(filepath), cb: cb, last: null };
  }
};

// Iterate over polled files
statpoll.tick = function() {
  var files = Object.keys(polled);
  if (files.length < 1 || running === true) return;
  running = true;
  for (var i = 0; i < files.length; i++) {
    var file = files[i];

    // If file deleted
    if (!fs.existsSync(file)) {
      polled[file].cb('delete', file);
      delete polled[file];
      continue;
    }

    var stat = fs.lstatSync(file);

    // If file has changed
    var diff = stat.mtime - polled[file].stat.mtime;
    if (diff > 0) {
      polled[file].cb('change', file);
    }

    // Set new last accessed time
    polled[file].stat = stat;
  }
  process.nextTick(function() {
    lastTick = Date.now();
    running = false;
  });
};

// Close up a single watcher
statpoll.close = function(file) {
  process.nextTick(function() {
    delete polled[file];
    running = false;
  });
};

// Close up all watchers
statpoll.closeAll = function() {
  process.nextTick(function() {
    polled = Object.create(null);
    running = false;
  });
};

// Return all statpolled watched paths
statpoll.getWatchedPaths = function() {
  return Object.keys(polled);
};
