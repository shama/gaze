'use strict';

var path = require('path');
var helper = module.exports = {};

// Returns boolean whether filepath is dir terminated
helper.isDir = function isDir (dir) {
  if (typeof dir !== 'string') {
    return false;
  }
  var lastChar = dir.slice(-1);
  return lastChar === '/' || lastChar === '\\';
};


// Platform-consistent path.resolve implementation
helper.resolve = function resolve(folder, file) {
  var result = path.resolve(folder, file);
  if(helper.isDir(file) && !helper.isDir(result)) {
    result += path.sep;
  }
  return result;
};

// Create a `key:[]` if doesnt exist on `obj` then push or concat the `val`
helper.objectPush = function objectPush (obj, key, val) {
  var arr = obj[key];
  if (arr == null) {
    obj[key] = arr = [];
  }
  if (Array.isArray(val)) {
    obj[key] = arr = helper.unique(arr, val);
  } else if (val && arr.indexOf(val) === -1) {
    arr.push(val);
  }
  return arr;
};

// Ensures the dir is marked with path.sep
helper.markDir = function markDir (dir) {
  if (typeof dir === 'string' && !helper.isDir(dir) && dir !== '.') {
    dir += path.sep;
  }
  return dir;
};

// Changes path.sep to unix ones for testing
helper.unixifyPathSep = function unixifyPathSep (filepath) {
  return (process.platform === 'win32') ? String(filepath).replace(/\\/g, '/') : filepath;
};

/**
 * Lo-Dash 1.0.1 <http://lodash.com/>
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.4.4 <http://underscorejs.org/>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
 * Available under MIT license <http://lodash.com/license>
 */
helper.unique = function unique () {
  var array = Array.prototype.concat.apply(Array.prototype, arguments);
  var result = [];
  for (var i = 0; i < array.length; i++) {
    if (result.indexOf(array[i]) === -1) {
      result.push(array[i]);
    }
  }
  return result;
};

/**
 * Copyright (c) 2010 Caolan McMahon
 * Available under MIT license <https://raw.github.com/caolan/async/master/LICENSE>
 */
helper.forEachSeries = function forEachSeries (arr, iterator, callback) {
  if (!arr.length) { return callback(); }
  var completed = 0;
  var iterate = function () {
    iterator(arr[completed], function (err) {
      if (err) {
        callback(err);
        callback = function () {};
      } else {
        completed += 1;
        if (completed === arr.length) {
          callback(null);
        } else {
          iterate();
        }
      }
    });
  };
  iterate();
};
