/*
 * gaze
 * https://github.com/shama/gaze
 *
 * Copyright (c) 2014 Kyle Robinson Young
 * Licensed under the MIT license.
 */

'use strict';

var PathWatcher = null;
var statpoll = require('./statpoll.js');
var helper = require('./helper');
var fs = require('graceful-fs');
var path = require('path');

// Define object that contains helper functions, jshint happy :)
var platformUtils = {};

// on purpose globals
var watched = Object.create(null);
var renameWaiting = null;
var renameWaitingFile = null;
var emitEvents = true;

var platform = module.exports = function(file, cb) {
  if (PathWatcher == null) {
    PathWatcher = require('./pathwatcher');
  }

  // Ignore non-existent files
  if (!fs.existsSync(file)) {
    return;
  }

  emitEvents = true;

  // Mark every folder
  file = platformUtils.markDir(file);

  // Also watch all folders, needed to catch change for detecting added files
  if (!helper.isDir(file)) {
    platform(path.dirname(file), cb);
  }

  // Already watched, just add cb to stack
  if (watched[file]) {
    watched[file].push(cb);
    return false;
  }

  // Helper for when to use statpoll
  function useStatPoll() {
    statpoll(file, function(event) {
      var filepath = file;
      if (process.platform === 'linux') {
        var go = platformUtils.linuxWorkarounds(event, filepath, cb);
        if (go === false) { return; }
      }
      platformUtils.cbstack(null, event, filepath);
    });
  }

  // Add callback to watched
  watched[file] = [cb];

  // By default try using native OS watchers
  if (platform.mode === 'auto' || platform.mode === 'watch') {
    // Delay adding files to watch
    // Fixes the duplicate handle race condition when renaming files
    // ie: (The handle(26) returned by watching [filename] is the same with an already watched path([filename]))
    setTimeout(function() {
      if (!fs.existsSync(file)) {
        delete watched[file];
        return;
      }
      // Workaround for lack of rename support on linux
      if (process.platform === 'linux' && renameWaiting) {
        clearTimeout(renameWaiting);
        platformUtils.cbstack(null, 'rename', renameWaitingFile, file);
        renameWaiting = renameWaitingFile = null;
        return;
      }
      try {
        watched[file].push(PathWatcher.watch(file, function(event, newFile) {
          var filepath = file;
          if (process.platform === 'linux') {
            var go = platformUtils.linuxWorkarounds(event, filepath, cb);
            if (go === false) { return; }
          }
          platformUtils.cbstack(null, event, filepath, newFile);
        }));
      } catch (error) {
        // If we hit EMFILE, use stat poll
        if (error.message.slice(0, 6) === 'EMFILE') { error.code = 'EMFILE'; }
        if (error.code === 'EMFILE') {
          // Only fallback to stat poll if not forced in watch mode
          if (platform.mode !== 'watch') { useStatPoll(); }
          // Format the error message for EMFILE a bit better
          error.message = 'Too many open files.\nUnable to watch "' + file + '"\nusing native OS events so falling back to slower stat polling.\n';
        }
        platformUtils.cbstack(error);
      }
    }, 10);
  } else {
    useStatPoll();
  }
};

platform.mode = 'auto';

// Run the stat poller
// NOTE: Run at minimum of 500ms to adequately capture change event
// to folders when adding files
platform.tick = statpoll.tick.bind(statpoll);

// Close up a single watcher
platform.close = function(filepath, cb) {
  if (Array.isArray(watched[filepath])) {
    try {
      for (var i = 0; i < watched[filepath].length; i++) {
        if (watched[filepath].hasOwnProperty('close')) {
          watched[filepath].close();
        }
      }
      delete watched[filepath];
    } catch (error) {
      return cb(error);
    }
  } else {
    statpoll.close(filepath);
  }
  if (typeof cb === 'function') {
    cb(null);
  }
};

// Close up all watchers
platform.closeAll = function() {
  watched = Object.create(null);
  statpoll.closeAll();
  PathWatcher.closeAllWatchers();
  emitEvents = false;
};

// Return all watched file paths
platform.getWatchedPaths = function() {
  return Object.keys(watched).concat(statpoll.getWatchedPaths());
};

// Helper for calling callbacks in a stack
platformUtils.cbstack = function(err, event, filepath, newFile) {
  if(!emitEvents) {
    return;
  }
  if (watched[filepath]) {
    helper.forEachSeries(watched[filepath], function(cb, next) {
      if (typeof cb === 'function') {
        cb(err, event, filepath, newFile);
      }
      next();
    });
  }
};

// Mark folders if not marked
platformUtils.markDir = function(file) {
  if (file.slice(-1) !== path.sep) {
    if (fs.lstatSync(file).isDirectory()) {
      file += path.sep;
    }
  }
  return file;
};

// Workarounds for lack of rename support on linux and folders emit before files
// https://github.com/atom/node-pathwatcher/commit/004a202dea89f4303cdef33912902ed5caf67b23
var linuxQueue = Object.create(null);
var linuxQueueInterval = null;
platformUtils.linuxProcessQueue = function(cb) {
  var len = Object.keys(linuxQueue).length;
  if (len === 1) {
    var key = Object.keys(linuxQueue).slice(0, 1)[0];
    platformUtils.cbstack(null, key, linuxQueue[key]);
  } else if (len > 1) {
    if (linuxQueue['delete'] && linuxQueue['change']) {
      renameWaitingFile = linuxQueue['delete'];
      renameWaiting = setTimeout(function(filepath) {
        platformUtils.cbstack(null, 'delete', filepath);
        renameWaiting = renameWaitingFile = null;
      }, 100, linuxQueue['delete']);
      platformUtils.cbstack(null, 'change', linuxQueue['change']);
    } else {
      // TODO: This might not be needed
      for (var i in linuxQueue) {
        if (linuxQueue.hasOwnProperty(i)) {
          platformUtils.cbstack(null, i, linuxQueue[i]);
        }
      }
    }
  }
  linuxQueue = Object.create(null);
};

platformUtils.linuxWorkarounds = function(event, filepath, cb) {
  linuxQueue[event] = filepath;
  clearTimeout(linuxQueueInterval);
  linuxQueueInterval = setTimeout(function() {
    platformUtils.linuxProcessQueue(cb);
  }, 100);
  return false;
};