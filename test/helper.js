'use strict';

var path = require('path');
var rimraf = require('rimraf');
var helper = module.exports = {};

// Access to the lib helper to prevent confusion with having both in the tests
helper.lib = require('../lib/helper.js');

helper.fixtures = path.resolve(__dirname, 'fixtures');

helper.sortobj = function sortobj(obj) {
  if (Array.isArray(obj)) {
    obj.sort();
    return obj;
  }
  var out = Object.create(null);
  var keys = Object.keys(obj);
  keys.sort();
  keys.forEach(function(key) {
    var val = obj[key];
    if (Array.isArray(val)) {
      val.sort();
    }
    out[key] = val;
  });
  return out;
};

helper.unixifyobj = function unixifyobj(obj) {
  function unixify(filepath) {
    return (process.platform === 'win32') ? String(filepath).replace(/\\/g, '/') : filepath;
  }
  if (typeof obj === 'string') {
    return unixify(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(unixify);
  }
  var res = Object.create(null);
  Object.keys(obj).forEach(function(key) {
    res[unixify(key)] = unixifyobj(obj[key]);
  });
  return res;
};

helper.onlyTest = function(name, tests) {
  if (!Array.isArray(name)) name = [name];
  var keys = Object.keys(tests);
  for (var i = 0; i < keys.length; i++) {
    var n = keys[i];
    if (n === 'setUp' || n === 'tearDown' || name.indexOf(n) !== -1) continue;
    delete tests[n];
  }
};

// Clean up helper to call in setUp and tearDown
helper.cleanUp = function(done) {
  helper.lib.forEachSeries([
    'sub/tmp.js',
    'sub/tmp',
    'sub/renamed.js',
    'added.js',
    'nested/added.js',
    'nested/.tmp',
    'nested/sub/added.js',
    'new_dir',
    'newfolder',
  ], function(d, next) {
    rimraf(path.resolve(helper.fixtures, d), next);
  }, done);
};
