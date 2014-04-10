/*
 * gaze
 * https://github.com/shama/gaze
 *
 * Copyright (c) 2014 Kyle Robinson Young
 * Licensed under the MIT license.
 */

'use strict';

var path = require('path');
var helper = module.exports = {};

// Returns boolean whether filepath is dir terminated
helper.isDir = function isDir(dir) {
  if (typeof dir !== 'string') { return false; }
  return (dir.slice(-(path.sep.length)) === path.sep) || (dir.slice(-1) === '/');
};

// Create a `key:[]` if doesnt exist on `obj` then push or concat the `val`
helper.objectPush = function objectPush(obj, key, val) {
  if (obj[key] == null) { obj[key] = []; }
  if (Array.isArray(val)) { obj[key] = obj[key].concat(val); }
  else if (val) { obj[key].push(val); }
  return obj[key] = helper.unique(obj[key]);
};

// Ensures the dir is marked with path.sep
helper.markDir = function markDir(dir) {
  if (typeof dir === 'string' &&
    dir.slice(-(path.sep.length)) !== path.sep &&
    dir !== '.') {
    dir += path.sep;
  }
  return dir;
};

// Changes path.sep to unix ones for testing
helper.unixifyPathSep = function unixifyPathSep(filepath) {
  return (process.platform === 'win32') ? String(filepath).replace(/\\/g, '/') : filepath;
};

// Converts a flat list of paths to the old style tree
helper.flatToTree = function flatToTree(files, cwd, relative, unixify, done) {
  cwd = helper.markDir(cwd);
  var tree = Object.create(null);

  helper.forEachSeries(files, function(filepath, next) {
    var parent = path.dirname(filepath) + path.sep;

    // If parent outside cwd, ignore
    if (path.relative(cwd, parent) === '..') {
      return next();
    }

    // If we want relative paths
    if (relative === true) {
      if (path.resolve(parent) === path.resolve(cwd)) {
        parent = './';
      } else {
        parent = path.relative(cwd, parent) + path.sep;
      }
      filepath = path.relative(path.join(cwd, parent), filepath) + (helper.isDir(filepath) ? path.sep : '');
    }

    // If we want to transform paths to unix seps
    if (unixify === true) {
      filepath = helper.unixifyPathSep(filepath);
      if (parent !== './') {
        parent = helper.unixifyPathSep(parent);
      }
    }

    if (!parent) { return next(); }

    if (!Array.isArray(tree[parent])) {
      tree[parent] = [];
    }
    tree[parent].push(filepath);
    next();
  }, function() {
    done(null, tree);
  });
};

/**
 * Lo-Dash 1.0.1 <http://lodash.com/>
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.4.4 <http://underscorejs.org/>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
 * Available under MIT license <http://lodash.com/license>
 */
helper.unique = function unique() { var array = Array.prototype.concat.apply(Array.prototype, arguments); var result = []; for (var i = 0; i < array.length; i++) { if (result.indexOf(array[i]) === -1) { result.push(array[i]); } } return result; };

/**
 * Copyright (c) 2010 Caolan McMahon
 * Available under MIT license <https://raw.github.com/caolan/async/master/LICENSE>
 */
helper.forEachSeries = function forEachSeries(arr, iterator, callback) {
  callback = callback || function () {};
  if (!arr.length) {
    return callback();
  }
  var completed = 0;
  var iterate = function () {
    iterator(arr[completed], function (err) {
      if (err) {
        callback(err);
        callback = function () {};
      }
      else {
        completed += 1;
        if (completed >= arr.length) {
          callback(null);
        } else {
          iterate();
        }
      }
    });
  };
  iterate();
};
