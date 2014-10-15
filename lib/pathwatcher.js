/*
Copyright (c) 2013 GitHub Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var EE = require('events').EventEmitter;
var fs = require('graceful-fs');
var inherits = require('util').inherits;
var statpoll = require('./statpoll.js');
var helper = require('./helper');

// on purpose globals
var watched = Object.create(null);
var renameWaiting = null;
var renameWaitingFile = null;

var path = require('path');
var v8 = 'v8-' + /[0-9]+\.[0-9]+/.exec(process.versions.v8)[0];
var pathwatcherPath = path.join(__dirname, '..', 'bin', process.platform + '-' + process.arch + '-' + v8, 'pathwatcher.node');

var binding = require(pathwatcherPath);
var handleWatchers = new binding.HandleMap;
binding.setCallback(function(event, handle, filePath, oldFilePath) {
  if (handleWatchers.has(handle)) {
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
  var detectRename,
    _this = this;
  switch (event) {
    case 'rename':
      this.close();
      detectRename = function() {
        return fs.stat(_this.path, function(err) {
          if (err) {
            _this.path = filePath;
            _this.start();
            return _this.emit('change', 'rename', filePath);
          } else {
            _this.start();
            return _this.emit('change', 'change', null);
          }
        });
      };
      return setTimeout(detectRename, 100);
    case 'delete':
      this.emit('change', 'delete', null);
      return this.close();
    case 'unknown':
      throw new Error("Received unknown event for path: " + this.path);
      break;
    default:
      return this.emit('change', event, filePath, oldFilePath);
  }
};

HandleWatcher.prototype.start = function() {
  var troubleWatcher;
  this.handle = binding.watch(this.path);
  if (handleWatchers.has(this.handle)) {
    troubleWatcher = handleWatchers.get(this.handle);
    troubleWatcher.close();
    //console.error("The handle(" + this.handle + ") returned by watching " + this.path + " is the same with an already watched path(" + troubleWatcher.path + ")");
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
  var stats, watcher, _i, _len, _ref,
    _this = this;
  this.path = filePath;
  if (process.platform === 'win32') {
    stats = fs.statSync(filePath);
    this.isWatchingParent = !stats.isDirectory();
  }
  if (this.isWatchingParent) {
    filePath = path.dirname(filePath);
  }
  _ref = handleWatchers.values();
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    watcher = _ref[_i];
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
          _this.path = newFilePath;
        }
        if (typeof callback === 'function') {
          callback.call(_this, event, newFilePath);
        }
        return _this.emit('change', event, newFilePath);
      case 'child-rename':
        if (_this.isWatchingParent) {
          if (_this.path === oldFilePath) {
            return _this.onChange('rename', newFilePath);
          }
        } else {
          return _this.onChange('change', '');
        }
        break;
      case 'child-delete':
        if (_this.isWatchingParent) {
          if (_this.path === newFilePath) {
            return _this.onChange('delete', null);
          }
        } else {
          return _this.onChange('change', '');
        }
        break;
      case 'child-change':
        if (_this.isWatchingParent && _this.path === newFilePath) {
          return _this.onChange('change', '');
        }
        break;
      case 'child-create':
        if (!_this.isWatchingParent) {
          return _this.onChange('change', '');
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

var platform = module.exports = function(file, cb) {
  // Ignore non-existent files
  if (!fs.existsSync(file)) return;

  // Mark every folder
  file = markDir(file);

  // Also watch all folders, needed to catch change for detecting added files
  if (!helper.isDir(file)) {
    platform(path.dirname(file), cb);
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
    //setTimeout(function() {
      if (!fs.existsSync(file)) {
        //return;
      }
      // Workaround for lack of rename support on linux
      if (process.platform === 'linux' && renameWaiting) {
        clearTimeout(renameWaiting);
        cb(null, 'rename', renameWaitingFile, file);
        renameWaiting = renameWaitingFile = null;
        return;
      }
      try {
        console.log('add', file)
        return new PathWatcher(path.resolve(file), function(event, newFile) {
          var filepath = file;
          if (process.platform === 'linux') {
            var go = linuxWorkarounds(event, filepath, cb);
            if (go === false) { return; }
          }
          cb(null, event, filepath, newFile);
        });
      } catch (error) {
        // If we hit EMFILE, use stat poll
        if (error.message.slice(0, 6) === 'EMFILE') { error.code = 'EMFILE'; }
        if (error.code === 'EMFILE') {
          // Only fallback to stat poll if not forced in watch mode
          if (platform.mode !== 'watch') {
            return useStatPoll();
          }
          // Format the error message for EMFILE a bit better
          error.message = 'Too many open files.\nUnable to watch "' + file + '"\nusing native OS events so falling back to slower stat polling.\n';
        }
        cb(error);
      }
    //}, 10);
  } else {
    return useStatPoll();
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
