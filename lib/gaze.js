/*
 * gaze
 * https://github.com/shama/gaze
 *
 * Copyright (c) 2012 Kyle Robinson Young
 * Licensed under the MIT license.
 */

'use strict';

// libs
var events = require('events');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var async = require('async');
var Glob = require('glob').Glob;
var minimatch = require('minimatch');
var Gaze, gaze;

// globals
var delay = 10;

// exports
module.exports = gaze;

// Node v0.6 compat
fs.existsSync = fs.existsSync || path.existsSync;

// CoffeeScript's __extends utility
var __extends = function(child, parent) {
  for (var key in parent) {
    if ({}.hasOwnProperty.call(parent, key)) {
      child[key] = parent[key];
    }
  }
  function Ctor() {
    this.constructor = child;
  }
  Ctor.prototype = parent.prototype;
  child.prototype = new Ctor();
  child.__super__ = parent.prototype;
  return child;
};

// Main entry point. Start watching and call done when setup
function gaze(files, opts, done) {
  return new Gaze(files, opts, done);
}

// `Gaze` EventEmitter object to return in the callback
Gaze = gaze.Gaze = __extends(function(files, opts, done) {
  var _this = this;

  // If second arg is the callback
  if (typeof opts === 'function') {
    done = opts;
    opts = {};
  }

  // Default options
  this.options = _.defaults(opts || {}, {
    // Tell glob to mark directories
    mark: true,
    // Interval to pass to fs.watchFile
    interval: 100,
    // Delay for events called in succession for the same file/event
    debounceDelay: 500
  });

  // Default done callback
  done = done || function() {};

  // Remember our watched dir:files
  this._watched = Object.create(null);

  // Store watchers
  this._watchers = Object.create(null);

  // Store patterns
  this._patterns = [];

  // Cached events for debouncing
  this._cached = Object.create(null);

  // Set maxListeners
  if (this.options.maxListeners) {
    this.setMaxListeners(this.options.maxListeners);
    Gaze.__super__.setMaxListeners(this.options.maxListeners);
    delete this.options.maxListeners;
  }

  // Initialize the watch on files
  this.add(files, function() {
    _this._initWatched(done);
  });

  return this;
}, events.EventEmitter);

// Override the emit function to emit `all` events
// and debounce on duplicate events per file
Gaze.prototype.emit = function() {
  var _this = this;
  var args = arguments;

  var e = args[0];
  var filepath = args[1];
  var timeoutId;

  // Actually emit the event and `all` event
  var emit = function() {
    Gaze.__super__.emit.apply(_this, args);
    if (e === 'added' || e === 'changed' || e === 'deleted') {
      Gaze.__super__.emit.apply(_this, ['all', e].concat([].slice.call(args, 1)));
    }
    return _this;
  };

  // If no filepath just emit the event
  if (typeof filepath !== 'string') { return emit(); }

  // If cached doesnt exist, create a delay before running the next
  // then emit the event
  var cache = this._cached[filepath] || [];
  if (_.indexOf(cache, e) === -1) {
    this._objectPush(_this._cached, filepath, e);
    clearTimeout(timeoutId);
    timeoutId = setTimeout(function() {
      delete _this._cached[filepath];
    }, this.options.debounceDelay);
    return emit();
  }

  return this;
};

// Close watchers
Gaze.prototype.close = function() {
  var _this = this;
  Object.keys(this._watchers).forEach(function(file) {
    _this._watchers[file].close();
  });
  this._watchers = Object.create(null);
  Object.keys(this._watched).forEach(function(dir) {
    fs.unwatchFile(dir);
    _this._watched[dir].forEach(fs.unwatchFile);
  });
  this._watched = Object.create(null);
  _this.emit('end');
  return this;
};

// Add file patterns to be watched
Gaze.prototype.add = function(files, done) {
  var _this = this;
  if (typeof files === 'string') {
    files = [files];
  }
  this._patterns = _.union(this._patterns, files);
  async.forEachSeries(files, function(pattern, next) {
    if (_.isEmpty(pattern)) { return; }
    _this._glob = new Glob(pattern, _this.options, function(err, files) {
      if (err) {
        _this.emit('error', err);
        return done(err);
      }
      _this._addToWatched(files);
      next();
    });
  }, done);
};

// Remove file/dir from `watched`
Gaze.prototype.remove = function(file) {
  var _this = this;
  if (this._watched[file]) {
    // is dir, remove all files
    fs.unwatchFile(file);
    this._watched[file].forEach(fs.unwatchFile);
    delete this._watched[file];
  } else {
    // is a file, find and remove
    Object.keys(this._watched).forEach(function(dir) {
      var index = _.indexOf(_this._watched[dir], file);
      if (index) {
        fs.unwatchFile(file);
        delete _this._watched[dir][index];
        return false;
      }
    });
  }
  if (this._watchers[file]) {
    this._watchers[file].close();
  }
  return this;
};

// Return watched files
Gaze.prototype.watched = function() {
  return this._watched;
};

// Returns `watched` files with relative paths to process.cwd()
Gaze.prototype.relative = function(dir) {
  var _this = this;
  var relative = Object.create(null);
  var relDir;
  Object.keys(this._watched).forEach(function(dir) {
    relDir = path.relative(process.cwd(), dir);
    if (relDir === '') { relDir = '.'; }
    relative[relDir] = _this._watched[dir].map(function(file) {
      return path.relative(path.join(process.cwd(), relDir), file);
    });
  });
  return dir ? relative[dir] || [] : relative;
};

// Adds files and dirs to watched
Gaze.prototype._addToWatched = function(files) {
  var _this = this;
  var dir;
  files.forEach(function(file) {
    var filepath = path.resolve(process.cwd(), file);
    // if mark false, use stat to figure the isDir
    if (_this.options.mark === false) {
      if (fs.statSync(filepath).isDirectory()) {
        file += '/';
      }
    }
    // is a dir if marked with / at the end from glob
    if (file.slice(-1) === '/') {
      dir = filepath;
      filepath = null;
    } else {
      dir = path.dirname(filepath);
    }
    // Create a dir key on `watched` if doesnt exist and init array
    _this._objectPush(_this._watched, dir, filepath);
  });
  return this;
};

// Create a `key`:[] if doesnt exist on `obj` then push or concat the `val`
Gaze.prototype._objectPush = function(obj, key, val) {
  if (obj[key] == null) { obj[key] = []; }
  if (_.isArray(val)) { obj[key] = obj[key].concat(val); }
  else if (val) { obj[key].push(val); }
  return obj[key];
};

// Returns true if the file matches this._patterns
Gaze.prototype._isMatch = function(file) {
  var matched = false;
  this._patterns.forEach(function(pattern) {
    if (matched = minimatch(file, pattern)) {
      return false;
    }
  });
  return matched;
};

// Wrapper for fs.watch/fs.watchFile
Gaze.prototype._watchFile = function(file, done) {
  var _this = this;
  var opts = Object.create(this.options);
  try {
    _this._watchers[file] = fs.watch(file, opts, function(event) {
      done(event, file);
    });
    fs.watchFile(file, opts, function(curr, prev) {
      done(null, file);
    });
  } catch (err) {
    done(err);
  }
  return this;
};

// Initialize the actual watch on `watched` files
Gaze.prototype._initWatched = function(done) {
  var _this = this;
  async.forEachSeries(Object.keys(_this._watched), function(dir, next) {
    var files = _this._watched[dir];

    // Triggered when a watched dir has an event
    _this._watchFile(dir, function(event, dirpath) {
      var relDir = process.cwd() === dir ? '.' : path.relative(process.cwd(), dir);
      return fs.readdir(dirpath, function(err, current) {
        if (err) { return _this.emit('error', err); }
        if (!current) { return; }

        // Get watched files for this dir
        var previous = _this.relative(relDir);

        // If file was deleted
        _.filter(previous, function(file) {
          return _.indexOf(current, file) < 0;
        }).forEach(function(file) {
          var filepath = path.join(dir, file);
          _this.remove(filepath);
          _this.emit('deleted', filepath);
        });

        // If file was added
        _.filter(current, function(file) {
          return _.indexOf(previous, file) < 0;
        }).forEach(function(file) {
          // Is it a matching pattern?
          if (_this._isMatch(file)) {
            var filepath = path.join(dir, file);
            // Add to watch then emit event
            _this.add(file, function() {
              _this.emit('added', filepath);
            });
          }
        });
      });
    });
  
    // Watch for change/rename events on files
    files.forEach(function(file) {
      _this._watchFile(file, function(e, filepath) {
        // TODO: If event rename, update the watched index
        // Only emit changed if the file still exists
        // Prevents changed/deleted duplicate events
        if (fs.existsSync(filepath)) {
          _this.emit('changed', filepath);
        }
      });
    });

    next();
  }, function() {
    
    // Return this instance of Gaze
    // delay before ready solves a lot of issues
    setTimeout(function() {
      _this.emit('ready', _this);
      done.call(_this, null, _this);
    }, delay + 100);

  });
};
