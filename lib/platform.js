/*
 * gaze
 * https://github.com/shama/gaze
 *
 * Copyright (c) 2014 Kyle Robinson Young
 * Licensed under the MIT license.
 */

'use strict';

var EE = require('events').EventEmitter;
var fs = require('graceful-fs');
var inherits = require('util').inherits;
var statpoll = require('./statpoll.js');
var helper = require('./helper');
var nextback = require('nextback');

// on purpose globals
var renameWaiting = null;
var renameWaitingFile = null;

var path = require('path');
var v8 = 'v8-' + /[0-9]+\.[0-9]+/.exec(process.versions.v8)[0];
var pathwatcherPath = path.join(__dirname, '..', 'bin', process.platform + '-' + process.arch + '-' + v8, 'pathwatcher.node');

var binding = require(pathwatcherPath);
var handleWatchers = new binding.HandleMap;
binding.setCallback(function(event, handle, filePath, oldFilePath) {
  if (handleWatchers.has(handle)) {
    console.log('setCallback', event, filePath, oldFilePath)
    return handleWatchers.get(handle).onEvent(event, filePath, oldFilePath);
  }
});

function HandleWatcher(p) {
  EE.call(this);
  this.setMaxListeners(0);
  this.path = p;
  this.start();
}
inherits(HandleWatcher, EE);

HandleWatcher.prototype.onEvent = function(event, filePath, oldFilePath) {
  var self = this;
  switch (event) {
    case 'rename':
      this.close();
      return setTimeout(function() {
        return fs.stat(self.path, function(err) {
          if (err) {
            self.path = filePath;
            self.start();
            return self.emit('change', 'rename', filePath);
          } else {
            self.start();
            return self.emit('change', 'change', null);
          }
        });
      }, 100);
    case 'delete':
      this.emit('change', 'delete', null);
      return this.close();
    case 'unknown':
      throw new Error('Received unknown event for path: ' + this.path);
      break;
    default:
      return this.emit('change', event, filePath, oldFilePath);
  }
};

HandleWatcher.prototype.start = function() {
  this.handle = binding.watch(this.path);
  if (handleWatchers.has(this.handle)) {
    handleWatchers.get(this.handle).close();
  }
  return handleWatchers.add(this.handle, this);
};

HandleWatcher.prototype.closeIfNoListener = function() {
  if (this.listeners('change').length === 0) {
    return this.close();
  }
};

HandleWatcher.prototype.close = function() {
  if (handleWatchers.has(this.handle)) {
    binding.unwatch(this.handle);
    return handleWatchers.remove(this.handle);
  }
};

PathWatcher.prototype.isWatchingParent = false;

PathWatcher.prototype.path = null;

PathWatcher.prototype.handleWatcher = null;

function PathWatcher(filePath, callback) {
  EE.call(this);
  this.setMaxListeners(0);
  var self = this;
  this.path = filePath;
  if (process.platform === 'win32') {
    var stats = fs.statSync(filePath);
    this.isWatchingParent = !stats.isDirectory();
  }
  if (this.isWatchingParent) {
    filePath = path.dirname(filePath);
  }
  var values = handleWatchers.values();
  for (var i = 0; i < values.length; i++) {
    var watcher = values[i];
    if (watcher.path === filePath) {
      this.handleWatcher = watcher;
      break;
    }
  }
  if (this.handleWatcher == null) {
    this.handleWatcher = new HandleWatcher(filePath);
  }
  this.onChange = function(event, newFilePath, oldFilePath) {
    switch (event) {
      case 'rename':
      case 'change':
      case 'delete':
        if (event === 'rename') {
          self.path = newFilePath;
        }
        if (typeof callback === 'function') {
          callback.call(self, event, newFilePath);
        }
        return self.emit('change', event, newFilePath);
      case 'child-rename':
        if (self.isWatchingParent) {
          if (self.path === oldFilePath) {
            return self.onChange('rename', newFilePath);
          }
        } else {
          return self.onChange('change', '');
        }
        break;
      case 'child-delete':
        if (self.isWatchingParent) {
          if (self.path === newFilePath) {
            return self.onChange('delete', null);
          }
        } else {
          return self.onChange('change', '');
        }
        break;
      case 'child-change':
        if (self.isWatchingParent && self.path === newFilePath) {
          return self.onChange('change', '');
        }
        break;
      case 'child-create':
        if (!self.isWatchingParent) {
          return self.onChange('change', '');
        }
    }
  };
  this.handleWatcher.on('change', this.onChange);
}
inherits(PathWatcher, EE);

PathWatcher.prototype.close = function() {
  this.handleWatcher.removeListener('change', this.onChange);
  return this.handleWatcher.closeIfNoListener();
};

var platform = module.exports = function(file, cb, done) {
  // Ignore non-existent files
  if (!fs.existsSync(file)) return;

  // Mark every folder
  file = markDir(file);

  // Also watch all folders, needed to catch change for detecting added files
  if (!helper.isDir(file)) {
    platform(path.dirname(file), cb, done);
  }

  // Helper for when to use statpoll
  function useStatPoll() {
    return statpoll(file, function(event) {
      var filepath = file;
      if (process.platform === 'linux') {
        var go = linuxWorkarounds(event, filepath, cb);
        if (go === false) { return; }
      }
      cb(null, event, filepath);
    });
  }

  // By default try using native OS watchers
  if (platform.mode === 'auto' || platform.mode === 'watch') {
    // Delay adding files to watch
    // Fixes the duplicate handle race condition when renaming files
    // ie: (The handle(26) returned by watching [filename] is the same with an already watched path([filename]))
    setTimeout(function() {
      if (!fs.existsSync(file)) {
        return;
      }
      // Workaround for lack of rename support on linux
      if (process.platform === 'linux' && renameWaiting) {
        clearTimeout(renameWaiting);
        cb(null, 'rename', renameWaitingFile, file);
        renameWaiting = renameWaitingFile = null;
        return;
      }
      try {
        return done(new PathWatcher(path.resolve(file), function(event, newFile) {
          var filepath = file;
          if (process.platform === 'linux') {
            var go = linuxWorkarounds(event, filepath, cb);
            if (go === false) { return; }
          }
          cb(null, event, filepath, newFile);
        }));
      } catch (error) {
        // If we hit EMFILE, use stat poll
        if (error.message.slice(0, 6) === 'EMFILE') { error.code = 'EMFILE'; }
        if (error.code === 'EMFILE') {
          // Only fallback to stat poll if not forced in watch mode
          if (platform.mode !== 'watch') {
            return done(useStatPoll());
          }
          // Format the error message for EMFILE a bit better
          error.message = 'Too many open files.\nUnable to watch "' + file + '"\nusing native OS events so falling back to slower stat polling.\n';
        }
        cb(error);
      }
    }, 10);
  } else {
    return done(useStatPoll());
  }
};

platform.mode = 'auto';

platform.closeAll = function() {
  var values = handleWatchers.values();
  for (var i = 0; i < values.length; i++) {
    values[i].close();
  }
  statpoll.closeAll();
  return handleWatchers.clear();
};

// Close up a single watcher
platform.close = function(filepath, cb) {
  var values = handleWatchers.values();
  for (var i = 0; i < values.length; i++) {
    if (values[i].path === filepath) {
      values[i].close();
      break;
    }
  }
  statpoll.close(filepath);
  if (typeof cb === 'function') {
    cb(null);
  }
};

platform.getWatchedPaths = function() {
  var paths = [];
  var values = handleWatchers.values();
  for (var i = 0; i < values.length; i++) {
    paths.push(markDir(values[i].path));
  }
  return paths.concat(statpoll.getWatchedPaths());
};

// Run the stat poller
// NOTE: Run at minimum of 500ms to adequately capture change event
// to folders when adding files
platform.tick = statpoll.tick.bind(statpoll);

// Mark folders if not marked
function markDir(file) {
  if (file.slice(-1) !== path.sep) {
    if (fs.lstatSync(file).isDirectory()) {
      file += path.sep;
    }
  }
  return file;
}

// Workarounds for lack of rename support on linux and folders emit before files
// https://github.com/atom/node-pathwatcher/commit/004a202dea89f4303cdef33912902ed5caf67b23
var linuxQueue = Object.create(null);
var linuxQueueInterval = null;
function linuxProcessQueue(cb) {
  var len = Object.keys(linuxQueue).length;
  if (len === 1) {
    var key = Object.keys(linuxQueue).slice(0, 1)[0];
    cb(null, key, linuxQueue[key]);
  } else if (len > 1) {
    if (linuxQueue['delete'] && linuxQueue['change']) {
      renameWaitingFile = linuxQueue['delete'];
      renameWaiting = setTimeout(function(filepath) {
        cb(null, 'delete', filepath);
        renameWaiting = renameWaitingFile = null;
      }, 100, linuxQueue['delete']);
      cb(null, 'change', linuxQueue['change']);
    } else {
      // TODO: This might not be needed
      for (var i in linuxQueue) {
        if (linuxQueue.hasOwnProperty(i)) {
          cb(null, i, linuxQueue[i]);
        }
      }
    }
  }
  linuxQueue = Object.create(null);
}
function linuxWorkarounds(event, filepath, cb) {
  linuxQueue[event] = filepath;
  clearTimeout(linuxQueueInterval);
  linuxQueueInterval = setTimeout(function() {
    linuxProcessQueue(cb);
  }, 100);
  return false;
}

