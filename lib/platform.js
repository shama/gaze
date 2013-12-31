var PathWatcher = require('pathwatcher');
var statpoll = require('./statpoll.js');
var helper = require('./helper');
var fs = require('fs');
var path = require('path');

// on purpose globals
var watched = Object.create(null);
var emfiled = false;

var platform = module.exports = function(file, opts, cb) {
  if (arguments.length === 2) {
    cb = opts;
    opts = {};
  }

  // Ignore non-existent files
  if (!fs.existsSync(file)) return;

  // Mark every folder
  file = markDir(file);

  // Also watch all folders, needed to catch change for detecting added files
  if (!helper.isDir(file)) {
    platform(path.dirname(file), opts, cb);
  }

  // Already watched, move on
  if (watched[file]) return false;

  // if we haven't emfiled or in watch mode, use faster watch
  if ((platform.mode === 'auto' && emfiled === false) || platform.mode === 'watch') {
    try {
      watched[file] = PathWatcher.watch(file, function(event, newFile) {
        var filepath = file;
        cb(null, event, filepath, newFile);
      });
    } catch (error) {
      platform.error(error, file, cb);
    }
  } else {
    // Poll the file instead
    statpoll(file, function(event) {
      var filepath = file;
      cb(null, event, filepath);
    });
  }
};

platform.mode = 'auto';

// Run the stat poller
// NOTE: Run at minimum of 500ms to adequately capture change event
// to folders when adding files
platform.tick = statpoll.tick.bind(statpoll);

// Close up a single watcher
platform.close = function(filepath, cb) {
  if (watched[filepath]) {
    try {
      watched[filepath].close();
      delete watched[filepath];
      // Always be hopeful
      emfiled = false;
    } catch (error) {
      return platform.error(error, null, cb);
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
  emfiled = false;
  statpoll.closeAll();
  PathWatcher.closeAllWatchers();
};

// Return all watched file paths
platform.getWatchedPaths = function() {
  return Object.keys(watched).concat(statpoll.getWatchedPaths());
};

platform.error = function(error, file, cb) {
  // We've hit emfile, start your polling
  if (emfiled === false && error.code === 'EMFILE' && platform.mode !== 'watch') {
    emfiled = true;
    return platform.watch(file, cb);
  }
  cb(error);
};

// Mark folders if not marked
function markDir(file) {
  if (file.slice(-1) !== path.sep) {
    if (fs.lstatSync(file).isDirectory()) {
      file += path.sep;
    }
  }
  return file;
}
