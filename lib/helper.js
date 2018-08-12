const path = require('path');
const helper = module.exports = {};

function emptyFunction () {}

// Returns boolean whether filepath is dir terminated
helper.isDir = function isDir (dir) {
  if (typeof dir !== 'string') {
    return false;
  }
  return (dir.slice(-(path.sep.length)) === path.sep);
};

// Create a `key:[]` if doesnt exist on `obj` then push or concat the `val`
helper.objectPush = function objectPush (obj, key, val) {
  if (obj[key] == null) {
    obj[key] = [];
  }
  if (Array.isArray(val)) {
    obj[key] = obj[key].concat(val);
  } else if (val) {
    obj[key].push(val);
  }
  obj[key] = helper.unique(obj[key]);
  return obj[key];
};

// Ensures the dir is marked with path.sep
helper.markDir = function markDir (dir) {
  if (typeof dir === 'string' &&
    dir.slice(-(path.sep.length)) !== path.sep &&
    dir !== '.') {
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
  const array = Array.prototype.concat.apply(Array.prototype, arguments);
  let result = [];
  for (let i = 0; i < array.length; i++) {
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
  let completed = 0;
  const iterate = () => {
    iterator(arr[completed], err => {
      if (err) {
        callback(err);
        callback = emptyFunction;
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
