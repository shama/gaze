/*
 * gaze
 * https://github.com/shama/gaze
 *
 * Copyright (c) 2013 Kyle Robinson Young
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

// globals
var delay = 10;

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
  var timeoutId;

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

  // If cached doesnt exist, create a delay before running the next
  // then emit the event
  var cache = this._cached[filepath] || [];
  if (cache.indexOf(e) === -1) {
    helper.objectPush(self._cached, filepath, e);
    clearTimeout(timeoutId);
    timeoutId = setTimeout(function() {
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
  if (error) return this.emit('error', error);
  if (event === 'change' && helper.isDir(filepath)) {
    this._wasAdded(filepath);
  } else if (event === 'change') {
    this._emitAll('changed', filepath);
  } else if (event === 'delete') {
    this._emitAll('deleted', filepath);
  } else if (event === 'rename') {
    // TODO: This occasionally throws, figure out why or use the old style rename detect
    // The handle(26) returned by watching [filename] is the same with an already watched path([filename])
    platform(newFile, this._trigger.bind(this));
    platform.close(filepath);
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
  //console.log(relative);
  if (dir) {
    if (unixify) {
      dir = helper.unixifyPathSep(dir);
    }
    // Better guess what to return for backwards compatibility
    return relative[dir] || relative[dir + path.sep] || [];
  }
  return relative;
};




// === POTENTIALLY DELETE BELOW THIS LINE ===

// Dont increment patterns and dont call done if nothing added
Gaze.prototype._internalAdd = function(file, done) {
  var files = [];
  if (helper.isDir(file)) {
    files = [helper.markDir(file)].concat(globule.find(this._patterns, this.options));
  } else {
    if (globule.isMatch(this._patterns, file, this.options)) {
      files = [file];
    }
  }
  if (files.length > 0) {
    this._addToWatched(files);
    this.close(false);
    this._initWatched(done);
  }
};

// Adds files and dirs to watched
Gaze.prototype._addToWatched = function(files) {
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var filepath = path.resolve(this.options.cwd, file);

    var dirname = (helper.isDir(file)) ? filepath : path.dirname(filepath);
    dirname = helper.markDir(dirname);

    // If a new dir is added
    if (helper.isDir(file) && !(filepath in this._watched)) {
      helper.objectPush(this._watched, filepath, []);
    }

    if (file.slice(-1) === '/') { filepath += path.sep; }
    helper.objectPush(this._watched, path.dirname(filepath) + path.sep, filepath);

    // add folders into the mix
    var readdir = fs.readdirSync(dirname);
    for (var j = 0; j < readdir.length; j++) {
      var dirfile = path.join(dirname, readdir[j]);
      if (fs.statSync(dirfile).isDirectory()) {
        helper.objectPush(this._watched, dirname, dirfile + path.sep);
      }
    }
  }
  return this;
};

Gaze.prototype._watchDir = function(dir, done) {
  var self = this;
  var timeoutId;
  // Dont even try watching the dir if it doesnt exist
  if (!fs.existsSync(dir)) { return; }
  try {
    this._watchers[dir] = fs.watch(dir, function(event) {
      // race condition. Let's give the fs a little time to settle down. so we
      // don't fire events on non existent files.
      clearTimeout(timeoutId);
      timeoutId = setTimeout(function() {
        // race condition. Ensure that this directory is still being watched
        // before continuing.
        if ((dir in self._watchers) && fs.existsSync(dir)) {
          done(null, dir);
        }
      }, delay + 100);
    });
  } catch (err) {
    return this._handleError(err);
  }
  return this;
};

Gaze.prototype._unpollFile = function(file) {
  if (this._pollers[file]) {
    fs.unwatchFile(file, this._pollers[file] );
    delete this._pollers[file];
  }
  return this;
};

Gaze.prototype._unpollDir = function(dir) {
  this._unpollFile(dir);
  for (var i = 0; i < this._watched[dir].length; i++) {
    this._unpollFile(this._watched[dir][i]);
  }
};

Gaze.prototype._pollFile = function(file, done) {
  var opts = { persistent: true, interval: this.options.interval };
  if (!this._pollers[file]) {
    this._pollers[file] = function(curr, prev) {
      done(null, file);
    };
    try {
      fs.watchFile(file, opts, this._pollers[file]);
    } catch (err) {
      return this._handleError(err);
    }
  }
  return this;
};

// Initialize the actual watch on `watched` files
Gaze.prototype._initWatched = function(done) {
  var self = this;
  var cwd = this.options.cwd || process.cwd();
  var curWatched = Object.keys(self._watched);

  // if no matching files
  if (curWatched.length < 1) {
    self.emit('ready', self);
    if (done) { done.call(self, null, self); }
    self.emit('nomatch');
    return;
  }

  helper.forEachSeries(curWatched, function(dir, next) {
    dir = dir || '';
    var files = self._watched[dir];
    // Triggered when a watched dir has an event
    self._watchDir(dir, function(event, dirpath) {
      var relDir = cwd === dir ? '.' : path.relative(cwd, dir);
      relDir = relDir || '';

      fs.readdir(dirpath, function(err, current) {
        if (err) { return self.emit('error', err); }
        if (!current) { return; }

        try {
          // append path.sep to directories so they match previous.
          current = current.map(function(curPath) {
            if (fs.existsSync(path.join(dir, curPath)) && fs.statSync(path.join(dir, curPath)).isDirectory()) {
              return curPath + path.sep;
            } else {
              return curPath;
            }
          });
        } catch (err) {
          // race condition-- sometimes the file no longer exists
        }

        // Get watched files for this dir
        var previous = self.relative(relDir);

        // If file was deleted
        previous.filter(function(file) {
          return current.indexOf(file) < 0;
        }).forEach(function(file) {
          if (!helper.isDir(file)) {
            var filepath = path.join(dir, file);
            self.remove(filepath);
            self.emit('deleted', filepath);
          }
        });

        // If file was added
        current.filter(function(file) {
          return previous.indexOf(file) < 0;
        }).forEach(function(file) {
          // Is it a matching pattern?
          var relFile = path.join(relDir, file);
          // Add to watch then emit event
          self._internalAdd(relFile, function() {
            self.emit('added', path.join(dir, file));
          });
        });

      });
    });

    // Watch for change/rename events on files
    files.forEach(function(file) {
      if (helper.isDir(file)) { return; }
      self._pollFile(file, function(err, filepath) {
        // Only emit changed if the file still exists
        // Prevents changed/deleted duplicate events
        if (fs.existsSync(filepath)) {
          self.emit('changed', filepath);
        }
      });
    });

    next();
  }, function() {

    // Return this instance of Gaze
    // delay before ready solves a lot of issues
    setTimeout(function() {
      self.emit('ready', self);
      if (done) { done.call(self, null, self); }
    }, delay + 100);

  });
};

// If an error, handle it here
Gaze.prototype._handleError = function(err) {
  if (err.code === 'EMFILE') {
    return this.emit('error', new Error('EMFILE: Too many opened files.'));
  }
  return this.emit('error', err);
};
