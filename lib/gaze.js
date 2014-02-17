/*
 * gaze
 * https://github.com/shama/gaze
 *
 * Copyright (c) 2014 Kyle Robinson Young
 * Licensed under the MIT license.
 */

'use strict';

// libs
var util = require('util');
var EE = require('events').EventEmitter;
var fs = require('fs');
var path = require('path');
var globule = require('globule');
var helper = require('./helper');
var platform = require('./platform');

// keep track of instances to call multiple times for backwards compatibility
var instances = [];

// `Gaze` EventEmitter object to return in the callback
function Gaze(patterns, opts, done) {
  var self = this;
  EE.call(self);

  // If second arg is the callback
  if (typeof opts === 'function') {
    done = opts;
    opts = {};
  }

  // Default options
  opts = opts || {};
  opts.mark = true;
  opts.interval = opts.interval || 100;
  opts.debounceDelay = opts.debounceDelay || 500;
  opts.cwd = opts.cwd || process.cwd();
  this.options = opts;

  // Default done callback
  done = done || function() {};

  // Remember our watched dir:files
  this._watched = Object.create(null);

  // Store watchers
  this._watchers = Object.create(null);

  // Store watchFile listeners
  this._pollers = Object.create(null);

  // Store patterns
  this._patterns = [];

  // Cached events for debouncing
  this._cached = Object.create(null);

  // Set maxListeners
  if (this.options.maxListeners) {
    this.setMaxListeners(this.options.maxListeners);
    Gaze.super_.prototype.setMaxListeners(this.options.maxListeners);
    delete this.options.maxListeners;
  }

  // Initialize the watch on files
  if (patterns) {
    this.add(patterns, done);
  }

  // keep the process alive
  this._keepalive = setInterval(function() {}, 200);

  // Keep track of all instances created
  this._instanceNum = instances.length;
  instances.push(this);

  // Keep track of safewriting and debounce timeouts
  this._safewriting = null;
  this._safewriteTimeout = null;
  this._timeoutId = null;

  return this;
}
util.inherits(Gaze, EE);

// Main entry point. Start watching and call done when setup
module.exports = function gaze(patterns, opts, done) {
  return new Gaze(patterns, opts, done);
};
module.exports.Gaze = Gaze;

// Override the emit function to emit `all` events
// and debounce on duplicate events per file
Gaze.prototype.emit = function() {
  var self = this;
  var args = arguments;

  var e = args[0];
  var filepath = args[1];

  // If not added/deleted/changed/renamed then just emit the event
  if (e.slice(-2) !== 'ed') {
    Gaze.super_.prototype.emit.apply(self, args);
    return this;
  }

  // Detect rename event, if added and previous deleted is in the cache
  if (e === 'added') {
    Object.keys(this._cached).forEach(function(oldFile) {
      if (self._cached[oldFile].indexOf('deleted') !== -1) {
        args[0] = e = 'renamed';
        [].push.call(args, oldFile);
        delete self._cached[oldFile];
        return false;
      }
    });
  }

  // Detect safewrite events, if file is deleted and then added/renamed, assume a safewrite happened
  if (e === 'deleted' && this._safewriting == null) {
    this._safewriting = filepath;
    this._safewriteTimeout = setTimeout(function() {
      // Just a normal delete, carry on
      Gaze.super_.prototype.emit.apply(self, args);
      Gaze.super_.prototype.emit.apply(self, ['all', e].concat([].slice.call(args, 1)));
      self._safewriting = null;
    }, this.options.debounceDelay);
    return this;
  } else if ((e === 'added' || e === 'renamed') && this._safewriting === filepath) {
    clearTimeout(this._safewriteTimeout);
    this._safewriteTimeout = setTimeout(function() {
      self._safewriting = null;
    }, this.options.debounceDelay);
    args[0] = e = 'changed';
  } else if (e === 'deleted' && this._safewriting === filepath) {
    return this;
  }

  // If cached doesnt exist, create a delay before running the next
  // then emit the event
  var cache = this._cached[filepath] || [];
  if (cache.indexOf(e) === -1) {
    helper.objectPush(self._cached, filepath, e);
    clearTimeout(this._timeoutId);
    this._timeoutId = setTimeout(function() {
      delete self._cached[filepath];
    }, this.options.debounceDelay);
    // Emit the event and `all` event
    Gaze.super_.prototype.emit.apply(self, args);
    Gaze.super_.prototype.emit.apply(self, ['all', e].concat([].slice.call(args, 1)));
  }

  // Detect if new folder added to trigger for matching files within folder
  if (e === 'added') {
    if (helper.isDir(filepath)) {
      fs.readdirSync(filepath).map(function(file) {
        return path.join(filepath, file);
      }).filter(function(file) {
        return globule.isMatch(self._patterns, file, self.options);
      }).forEach(function(file) {
        self.emit('added', file);
      });
    }
  }

  return this;
};

// Close watchers
Gaze.prototype.close = function(_reset) {
  instances.splice(this._instanceNum, 1);
  platform.closeAll();
  this.emit('end');
};

// Add file patterns to be watched
Gaze.prototype.add = function(files, done) {
  var self = this;
  if (typeof files === 'string') { files = [files]; }
  this._patterns = helper.unique.apply(null, [this._patterns, files]);
  files = globule.find(this._patterns, this.options);

  // If no matching files
  if (files.length < 1) {
    this.emit('ready', this);
    if (done) { done.call(this, null, this); }
    this.emit('nomatch');
    return;
  }

  for (var i = 0; i < files.length; i++) {
    platform(path.join(this.options.cwd, files[i]), this._trigger.bind(this));
  }
  platform(this.options.cwd, this._trigger.bind(this));

  // A little delay here for backwards compatibility, lol
  setTimeout(function() {
    self.emit('ready', self);
    if (done) done.call(self, null, self);
  }, 10);
};

// Call when the platform has triggered
Gaze.prototype._trigger = function(error, event, filepath, newFile) {
  if (error) { return this.emit('error', error); }
  if (event === 'change' && helper.isDir(filepath)) {
    this._wasAdded(filepath);
  } else if (event === 'change') {
    this._emitAll('changed', filepath);
  } else if (event === 'delete') {
    // Close out deleted filepaths (important to make safewrite detection work)
    platform.close(filepath);
    this._emitAll('deleted', filepath);
  } else if (event === 'rename') {
    // TODO: This occasionally throws, figure out why or use the old style rename detect
    // The handle(26) returned by watching [filename] is the same with an already watched path([filename])
    this._emitAll('renamed', newFile, filepath);
  }
};

// If a folder received a change event, investigate
Gaze.prototype._wasAdded = function(dir) {
  var self = this;
  var dirstat = fs.statSync(dir);
  fs.readdir(dir, function(err, current) {
    for (var i = 0; i < current.length; i++) {
      var filepath = path.join(dir, current[i]);
      if (!fs.existsSync(filepath)) continue;
      var stat = fs.lstatSync(filepath);
      if ((dirstat.mtime - stat.mtime) <= 0) {
        var relpath = path.relative(self.options.cwd, filepath);
        if (stat.isDirectory()) {
          // If it was a dir, watch the dir and emit that it was added
          platform(filepath, self._trigger.bind(self));
          self._emitAll('added', filepath);
          self._wasAddedSub(filepath);
        } else if (globule.isMatch(self._patterns, relpath, self.options)) {
          // Otherwise if the file matches, emit added
          platform(filepath, self._trigger.bind(self));
          self._emitAll('added', filepath);
        }
      }
    }
  });
};

// If a sub folder was added, investigate further
// Such as with grunt.file.write('new_dir/tmp.js', '') as it will create the folder and file simultaneously
Gaze.prototype._wasAddedSub = function(dir) {
  var self = this;
  fs.readdir(dir, function(err, current) {
    for (var i = 0; i < current.length; i++) {
      var filepath = path.join(dir, current[i]);
      var relpath = path.relative(self.options.cwd, filepath);
      if (fs.lstatSync(filepath).isDirectory()) {
        self._wasAdded(filepath);
      } else if (globule.isMatch(self._patterns, relpath, self.options)) {
        // Make sure to watch the newly added sub file
        platform(filepath, self._trigger.bind(self));
        self._emitAll('added', filepath);
      }
    }
  });
};

// Wrapper for emit to ensure we emit on all instances
Gaze.prototype._emitAll = function() {
  var args = Array.prototype.slice.call(arguments);
  for (var i = 0; i < instances.length; i++) {
    instances[i].emit.apply(instances[i], args);
  }
};

// Remove file/dir from `watched`
Gaze.prototype.remove = function(file) {
  platform.close(file);
  return this;
};

// Return watched files
Gaze.prototype.watched = function() {
  return helper.flatToTree(platform.getWatchedPaths(), this.options.cwd, false);
};

// Returns `watched` files with relative paths to cwd
Gaze.prototype.relative = function(dir, unixify) {
  var relative = helper.flatToTree(platform.getWatchedPaths(), this.options.cwd, true, unixify);
  if (dir) {
    if (unixify) {
      dir = helper.unixifyPathSep(dir);
    }
    // Better guess what to return for backwards compatibility
    return relative[dir] || relative[dir + (unixify ? '/' : path.sep)] || [];
  }
  return relative;
};
