/*
 * gaze
 * https://github.com/shama/gaze
 *
 * Copyright (c) 2018 Kyle Robinson Young
 * Licensed under the MIT license.
 */

'use strict';

// libs
const util = require('util');
const EE = require('events').EventEmitter;
const fs = require('fs');
const path = require('path');
const globule = require('globule');
const helper = require('./helper');

// shim setImmediate for node v0.8
const setImmediate = require('timers').setImmediate;
if (typeof setImmediate !== 'function') {
  setImmediate = process.nextTick;
}

// globals
const delay = 10;

// `Gaze` EventEmitter object to return in the callback
function Gaze (patterns, opts, done) {
  EE.call(this);

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
  done = done || () => {};

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
  this._keepalive = setInterval(() => {}, 200);

  return this;
}
util.inherits(Gaze, EE);

// Main entry point. Start watching and call done when setup
module.exports = function gaze (patterns, opts, done) {
  return new Gaze(patterns, opts, done);
};
module.exports.Gaze = Gaze;

// Override the emit function to emit `all` events
// and debounce on duplicate events per file
Gaze.prototype.emit = function () {
  let args = arguments;

  const e = args[0];
  const filepath = args[1];
  let timeoutId;

  // If not added/deleted/changed/renamed then just emit the event
  if (e.slice(-2) !== 'ed') {
    Gaze.super_.prototype.emit.apply(this, args);
    return this;
  }

  // Detect rename event, if added and previous deleted is in the cache
  if (e === 'added') {
    Object.keys(this._cached).forEach( oldFile => {
      if (this._cached[oldFile].indexOf('deleted') !== -1) {
        args[0] = e = 'renamed';
        [].push.call(args, oldFile);
        delete this._cached[oldFile];
        return false;
      }
    });
  }

  // If cached doesnt exist, create a delay before running the next
  // then emit the event
  const cache = this._cached[filepath] || [];
  if (cache.indexOf(e) === -1) {
    helper.objectPush(this._cached, filepath, e);
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      delete this._cached[filepath];
    }, this.options.debounceDelay);
    // Emit the event and `all` event
    Gaze.super_.prototype.emit.apply(this, args);
    Gaze.super_.prototype.emit.apply(this, ['all', e].concat([].slice.call(args, 1)));
  }

  // Detect if new folder added to trigger for matching files within folder
  if (e === 'added') {
    if (helper.isDir(filepath)) {
      // It's possible that between `isDir` and `readdirSync()` calls the `filepath`
      // gets removed, which will result in `ENOENT` exception

      let files;

      try {
        files = fs.readdirSync(filepath);
      } catch (e) {
        // Rethrow the error if it's anything other than `ENOENT`
        if (e.code !== 'ENOENT') {
          throw e;
        }

        files = [];
      }

      files.map(file => {
        return path.join(filepath, file);
      }).filter(file => {
        return globule.isMatch(this._patterns, file, this.options);
      }).forEach(file => {
        this.emit('added', file);
      });
    }
  }

  return this;
};

// Close watchers
Gaze.prototype.close = function (_reset) {
  Object.keys(this._watchers).forEach(file => {
    this._watchers[file].close();
  });
  this._watchers = Object.create(null);
  Object.keys(this._watched).forEach(dir => {
    this._unpollDir(dir);
  });
  if (_reset !== false) {
    this._watched = Object.create(null);
    setTimeout(() => {
      this.emit('end');
      this.removeAllListeners();
      clearInterval(this._keepalive);
    }, delay + 100);
  }
  return this;
};

// Add file patterns to be watched
Gaze.prototype.add = function (files, done) {
  if (typeof files === 'string') { files = [files]; }
  this._patterns = helper.unique.apply(null, [this._patterns, files]);
  files = globule.find(this._patterns, this.options);
  this._addToWatched(files);
  this.close(false);
  this._initWatched(done);
};

// Dont increment patterns and dont call done if nothing added
Gaze.prototype._internalAdd = function (file, done) {
  let files = [];
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

// Remove file/dir from `watched`
Gaze.prototype.remove = function (file) {
  if (this._watched[file]) {
    // is dir, remove all files
    this._unpollDir(file);
    delete this._watched[file];
  } else {
    // is a file, find and remove
    Object.keys(this._watched).forEach(dir => {
      const index = this._watched[dir].indexOf(file);
      if (index !== -1) {
        this._unpollFile(file);
        this._watched[dir].splice(index, 1);
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
Gaze.prototype.watched = function () {
  return this._watched;
};

// Returns `watched` files with relative paths to process.cwd()
Gaze.prototype.relative = function (dir, unixify) {
  let relative = Object.create(null);
  let relDir, relFile, unixRelDir;
  const cwd = this.options.cwd || process.cwd();
  if (dir === '') { dir = '.'; }
  dir = helper.markDir(dir);
  unixify = unixify || false;
  Object.keys(this._watched).forEach(dir => {
    relDir = path.relative(cwd, dir) + path.sep;
    if (relDir === path.sep) { relDir = '.'; }
    unixRelDir = unixify ? helper.unixifyPathSep(relDir) : relDir;
    relative[unixRelDir] = this._watched[dir].map(file => {
      relFile = path.relative(path.join(cwd, relDir) || '', file || '');
      if (helper.isDir(file)) {
        relFile = helper.markDir(relFile);
      }
      if (unixify) {
        relFile = helper.unixifyPathSep(relFile);
      }
      return relFile;
    });
  });
  if (dir && unixify) {
    dir = helper.unixifyPathSep(dir);
  }
  return dir ? relative[dir] || [] : relative;
};

// Adds files and dirs to watched
Gaze.prototype._addToWatched = function (files) {
  let dirs = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filepath = path.resolve(this.options.cwd, file);

    let dirname = (helper.isDir(file)) ? filepath : path.dirname(filepath);
    dirname = helper.markDir(dirname);

    // If a new dir is added
    if (helper.isDir(file) && !(dirname in this._watched)) {
      helper.objectPush(this._watched, dirname, []);
    }

    if (file.slice(-1) === '/') { filepath += path.sep; }
    helper.objectPush(this._watched, path.dirname(filepath) + path.sep, filepath);

    dirs.push(dirname);
  }

  dirs = helper.unique(dirs);

  for (let k = 0; k < dirs.length; k++) {
    dirname = dirs[k];
    // add folders into the mix
    const readdir = fs.readdirSync(dirname);
    for (let j = 0; j < readdir.length; j++) {
      const dirfile = path.join(dirname, readdir[j]);
      if (fs.lstatSync(dirfile).isDirectory()) {
        helper.objectPush(this._watched, dirname, dirfile + path.sep);
      }
    }
  }

  return this;
};

Gaze.prototype._watchDir = function (dir, done) {
  let timeoutId;
  try {
    this._watchers[dir] = fs.watch(dir, event => {
      // race condition. Let's give the fs a little time to settle down. so we
      // don't fire events on non existent files.
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // race condition. Ensure that this directory is still being watched
        // before continuing.
        if ((dir in this._watchers) && fs.existsSync(dir)) {
          done(null, dir);
        }
      }, delay + 100);
    });

    this._watchers[dir].on('error', err => {
      this._handleError(err);
    });
  } catch (err) {
    return this._handleError(err);
  }
  return this;
};

Gaze.prototype._unpollFile = function (file) {
  if (this._pollers[file]) {
    fs.unwatchFile(file, this._pollers[file]);
    delete this._pollers[file];
  }
  return this;
};

Gaze.prototype._unpollDir = function (dir) {
  this._unpollFile(dir);
  for (let i = 0; i < this._watched[dir].length; i++) {
    this._unpollFile(this._watched[dir][i]);
  }
};

Gaze.prototype._pollFile = function (file, done) {
  const opts = { persistent: true, interval: this.options.interval };
  if (!this._pollers[file]) {
    this._pollers[file] = (curr, prev) => {
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
Gaze.prototype._initWatched = function (done) {
  const cwd = this.options.cwd || process.cwd();
  let curWatched = Object.keys(this._watched);

  // if no matching files
  if (curWatched.length < 1) {
    // Defer to emitting to give a chance to attach event handlers.
    setImmediate(() => {
      this.emit('ready', this);
      if (done) { done.call(this, null, this); }
      this.emit('nomatch');
    });
    return;
  }

  helper.forEachSeries(curWatched, (dir, next) => {
    dir = dir || '';
    let files = this._watched[dir];
    // Triggered when a watched dir has an event
    this._watchDir(dir, (event, dirpath) => {
      let relDir = cwd === dir ? '.' : path.relative(cwd, dir);
      relDir = relDir || '';

      fs.readdir(dirpath, (err, current) => {
        if (err) { return this.emit('error', err); }
        if (!current) { return; }

        try {
          // append path.sep to directories so they match previous.
          current = current.map(curPath => {
            if (fs.existsSync(path.join(dir, curPath)) && fs.lstatSync(path.join(dir, curPath)).isDirectory()) {
              return curPath + path.sep;
            } else {
              return curPath;
            }
          });
        } catch (err) {
          // race condition-- sometimes the file no longer exists
        }

        // Get watched files for this dir
        const previous = this.relative(relDir);

        // If file was deleted
        previous.filter(file => {
          return current.indexOf(file) < 0;
        }).forEach(file => {
          if (!helper.isDir(file)) {
            const filepath = path.join(dir, file);
            this.remove(filepath);
            this.emit('deleted', filepath);
          }
        });

        // If file was added
        current.filter(file => {
          return previous.indexOf(file) < 0;
        }).forEach(file => {
          // Is it a matching pattern?
          const relFile = path.join(relDir, file);
          // Add to watch then emit event
          this._internalAdd(relFile, () => {
            this.emit('added', path.join(dir, file));
          });
        });
      });
    });

    // Watch for change/rename events on files
    files.forEach(file => {
      if (helper.isDir(file)) { return; }
      this._pollFile(file, (err, filepath) => {
        if (err) {
          this.emit('error', err);
          return;
        }
        // Only emit changed if the file still exists
        // Prevents changed/deleted duplicate events
        if (fs.existsSync(filepath)) {
          this.emit('changed', filepath);
        }
      });
    });

    next();
  }, () => {
    // Return this instance of Gaze
    // delay before ready solves a lot of issues
    setTimeout(() => {
      this.emit('ready', this);
      if (done) { done.call(this, null, this); }
    }, delay + 100);
  });
};

// If an error, handle it here
Gaze.prototype._handleError = function (err) {
  if (err.code === 'EMFILE') {
    return this.emit('error', new Error('EMFILE: Too many opened files.'));
  }
  return this.emit('error', err);
};
