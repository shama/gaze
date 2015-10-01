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
var fs = require('graceful-fs');
var path = require('path');
var globule = require('globule');
var nextback = require('nextback');
var helper = require('./helper');
var platform = require('navelgazer');
var isAbsolute = require('absolute-path');
var debug = require('debug')('gaze');

// keep track of instances to call multiple times for backwards compatibility
var instances = [];

// `Gaze` EventEmitter object to return in the callback
function Gaze(patterns, opts, done) {
  var self = this;
  EE.call(self);

  // Keep track of all instances created
  this._instanceNum = instances.length;
  instances.push(this);

  this._debug = function() {
    arguments[0] = '(' + this._instanceNum + ') ' + arguments[0];
    debug.apply(this, arguments);
  };

  // Optional arguments
  if (typeof patterns === 'function') {
    done = patterns;
    patterns = null;
    opts = {};
  }
  if (typeof opts === 'function') {
    done = opts;
    opts = {};
  }

  // Default options
  this._emitEvents = true;
  opts = opts || {};
  opts.mark = true;
  opts.interval = opts.interval || 500;
  opts.debounceDelay = opts.debounceDelay || 500;
  opts.cwd = opts.cwd || process.cwd();
  this.options = opts;

  this._debug('new: %s', patterns);

  // Default error handler to prevent emit('error') throwing magically for us
  function defaultError(error) {
    if (self.listeners('error').length > 1) {
      return self.removeListener('error', defaultError);
    }
    nextback(function() {
      done.call(self, error, self);
    })();
  }
  this.on('error', defaultError);

  // File watching mode to use when adding files to the platform
  this._mode = opts.mode || 'auto';

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
  if (this.options.maxListeners != null) {
    this.setMaxListeners(this.options.maxListeners);
    Gaze.super_.prototype.setMaxListeners(this.options.maxListeners);
    delete this.options.maxListeners;
  }

  // Initialize the watch on files
  if (patterns) {
    this.add(patterns, done);
  }

  // keep the process alive
  this._keepalive = setInterval(platform.tick.bind(platform), opts.interval);


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
  if (!this._emitEvents) {
    return;
  }

  var self = this;
  var args = arguments;

  var e = args[0];
  var filepath = args[1];

  self._debug('emit: ### %s %s ###', e, filepath);

  // If not added/deleted/changed/renamed then just emit the event
  if (e.slice(-2) !== 'ed') {
    self._debug('emit: => emit it and quit it');
    Gaze.super_.prototype.emit.apply(self, args);
    return this;
  }

  // Detect rename event, if added and previous deleted is in the cache
  if (e === 'added') {
    Object.keys(this._cached).forEach(function(oldFile) {
      if (self._cached[oldFile].indexOf('deleted') !== -1) {
        self._debug('emit: transmogrifying added to renamed because of cached delete');
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
      self._debug('emit: => emitting normal delete');
      Gaze.super_.prototype.emit.apply(self, args);
      Gaze.super_.prototype.emit.apply(self, ['all', e].concat([].slice.call(args, 1)));
      self._safewriting = null;
    }, this.options.debounceDelay);
    return this;
  } else if ((e === 'added' || e === 'renamed') && this._safewriting === filepath) {
    self._debug('emit: transmogrifying added/renamed to changed in safewrite for %s', filepath);
    clearTimeout(this._safewriteTimeout);
    this._safewriteTimeout = setTimeout(function() {
      self._safewriting = null;
    }, this.options.debounceDelay);
    args[0] = e = 'changed';
  } else if (e === 'deleted' && this._safewriting === filepath) {
    self._debug('emit: X not emitting because delete in safewrite for %s', filepath);
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
    self._debug('emit: => emitting all and debounce caching %s %s', e, filepath);
    Gaze.super_.prototype.emit.apply(self, args);
    Gaze.super_.prototype.emit.apply(self, ['all', e].concat([].slice.call(args, 1)));
  } else {
    self._debug('emit: X not emitting because of debounce');
    return this;
  }

  // Detect if new folder added to trigger for matching files within folder
  if (e === 'added' && helper.isDir(filepath)) {
    fs.readdirSync(filepath).map(function(file) {
      return path.join(filepath, file);
    }).filter(function(file) {
      return globule.isMatch(self._patterns, file, self.options);
    }).forEach(function(file) {
      self.emit('added', file);
    });
  }

  return this;
};

// Close watchers
Gaze.prototype.close = function(_reset) {
  var self = this;
  //instances.splice(this._instanceNum, 1);
  //platform.closeAll();
  var files = Object.keys(this._watchers);
  helper.forEachSeries(files, function(file, next) {
    if (self._watchers[file]) {
      self._watchers[file].close();
    }
    next();
  }, function() {
    self._watchers = Object.create(null);
    platform.closeAll();
    self.emit('end');
  });
  this._emitEvents = false;
  return this;
};

// Add file patterns to be watched
Gaze.prototype.add = function(files, done) {
  var self = this;
  if (typeof files === 'string') { files = [files]; }
  this._patterns = helper.unique.apply(null, [this._patterns, files]);
  files = globule.find(this._patterns, this.options);

  // If no matching files
  if (files.length < 1) {
    self._debug('no files found to watch');
    // Defer to emitting to give a chance to attach event handlers.
    nextback(function() {
      self.emit('ready', self);
      if (done) {
        done.call(self, null, self);
      }
      self.emit('nomatch');
    })();
    return;
  }

  // Set the platform mode before adding files
  platform.mode = self._mode;

  helper.forEachSeries(files, function(file, next) {
    function watch(filepath, done) {
      // Don't watch the same thing twice
      if(!self._watchers[filepath]) {
        platform(filepath, self._trigger.bind(self), function(watcher) {
          self._debug('added watch: ./%s', path.relative(self.options.cwd, filepath));
          self._watchers[filepath] = watcher;
          done(watcher);
        });
      } else {
        done(self._watchers[filepath]);
      }
    }

    try {
      var filepath = (!isAbsolute(file)) ? path.join(self.options.cwd, file) : file;
      watch(filepath, function(watcher) {
        // Watch parent directories to catch added files
        if(!watcher.isWatchingParent && !fs.lstatSync(filepath).isDirectory()) {
          watch(helper.markDir(path.dirname(filepath)), function() { next(); });
        } else {
          next();
        }
      });
    } catch (err) {
      self._debug('caught error watching file %s', file);
      self.emit('error', err);
      next();
    }
  }, function() {
    // A little delay here for backwards compatibility, lol
    setTimeout(function() {
      self.emit('ready', self);
      if (done) {
        done.call(self, null, self);
      }
    }, 10);
  });
};

// Call when the platform has triggered
Gaze.prototype._trigger = function(error, event, filepath, newFile) {
  if (error) {
    this._debug('event: error from platform watcher callback');
    return this.emit('error', error);
  }

  this._debug('event: from watcher %s %s %s', event, filepath, newFile);

  // Set the platform mode before adding files
  platform.mode = this._mode;

  if (event === 'change' && helper.isDir(filepath)) {
    this._wasAdded(filepath);
  } else if (event === 'change') {
    this._emitAll('changed', filepath);
  } else if (event === 'delete') {
    this._debug('event: unwatching deleted file path %s', filepath);
    // Close out deleted filepaths (important to make safewrite detection work)
    if (this._watchers[filepath]) {
      this._watchers[filepath].close();
      delete this._watchers[filepath];
    }
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
  try {
    self._debug('event: child add stating dir');
    var dirstat = fs.lstatSync(dir);
  } catch (err) {
    self.emit('error', err);
    return;
  }
  fs.readdir(dir, function(err, current) {
    if (err) {
      self.emit('error', err);
      return;
    }

    self._debug('event: child add read all files in dir');

    helper.forEachSeries(current, function(file, next) {
      var filepath = path.join(dir, file);
      //If we're already watching the file then done
      if (self._watchers[filepath]){
        self._debug('event: child add already watching file %s', filepath);
        return next();
      }

      var stat;
      try {
        stat = fs.lstatSync(filepath);
      }
      catch (err) {
        if (err.code === 'ENOENT') return next();
        throw err;
      }
      if ((dirstat.mtime - stat.mtime) <= 0) {
        var relpath = path.relative(self.options.cwd, filepath);
        if (stat.isDirectory()) {
          self._debug('event: child add directory was added');
          // If it was a dir, watch the dir and emit that it was added
          filepath = helper.markDir(filepath);
          // TODO: Here is where mkdirThenAddFile fails
          // a pattern **/*.js doesnt match the folder fixtures/new_dir
          // should silently watch?
          if (globule.isMatch(self._patterns, relpath, self.options)) {
            platform(filepath, self._trigger.bind(self), function(watcher) {
              self._watchers[filepath] = watcher;
              self._emitAll('added', filepath);
            });
          }
          self._wasAddedSub(filepath);
        } else if (globule.isMatch(self._patterns, relpath, self.options)) {
          self._debug('event: child add file was added');
          // Otherwise if the file matches, emit added
          if (globule.isMatch(self._patterns, relpath, self.options)) {
            platform(filepath, self._trigger.bind(self), function(watcher) {
              self._watchers[filepath] = watcher;
              self._emitAll('added', filepath);
            });
          }
        }
      }
      next();
    });
  });
};

// If a sub folder was added, investigate further
// Such as with grunt.file.write('new_dir/tmp.js', '') as it will create the folder and file simultaneously
Gaze.prototype._wasAddedSub = function(dir) {
  var self = this;
  fs.readdir(dir, function(err, current) {
    helper.forEachSeries(current, function(file, next) {
      var filepath = path.join(dir, file);
      var relpath = path.relative(self.options.cwd, filepath);
      try {
        if (fs.lstatSync(filepath).isDirectory()) {
          self._wasAdded(filepath);
        } else if (globule.isMatch(self._patterns, relpath, self.options)) {
          // Make sure to watch the newly added sub file
          platform(filepath, self._trigger.bind(self), function(watcher) {
            self._watchers[filepath] = watcher;
            if (!helper.isDir(filepath)) {
              self._watchers[filepath] = watcher;
            }
            self._emitAll('added', filepath);
          });
        }
      } catch (err) {
        self.emit('error', err);
      }
      next();
    });
  });
};

// Wrapper for emit to ensure we emit on all instances
Gaze.prototype._emitAll = function() {
  var args = Array.prototype.slice.call(arguments);
  this.emit.apply(this, args);
  //for (var i = 0; i < instances.length; i++) {
    //instances[i].emit.apply(instances[i], args);
  //}
};

// Remove file/dir from `watched`
Gaze.prototype.remove = function(file) {
  if (file in this._watchers) {
    if (this._watchers[file] && typeof this._watchers[file].close === 'function') {
      this._watchers[file].close();
    }
    delete this._watchers[file];
  }
  return this;
};

// Return watched files
Gaze.prototype.watched = function(done) {
  done = nextback(done || function() {});
  //helper.flatToTree(platform.getWatchedPaths(), this.options.cwd, false, false, done);
  helper.flatToTree(Object.keys(this._watchers), this.options.cwd, false, false, done);
  return this;
};

// Returns `watched` files with relative paths to cwd
Gaze.prototype.relative = function(dir, unixify, done) {
  if (typeof dir === 'function') {
    done = dir;
    dir = null;
    unixify = false;
  }
  if (typeof unixify === 'function') {
    done = unixify;
    unixify = false;
  }
  done = nextback(done || function() {});
  helper.flatToTree(Object.keys(this._watchers), this.options.cwd, true, unixify, function(err, relative) {
    if (dir) {
      if (unixify) {
        dir = helper.unixifyPathSep(dir);
      }
      // Better guess what to return for backwards compatibility
      return done(null, relative[dir] || relative[dir + (unixify ? '/' : path.sep)] || []);
    }
    return done(null, relative);
  });
  return this;
};
