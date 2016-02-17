'use strict';

var helper = module.exports = {};

helper.sortobj = function sortobj (obj) {
  if (Array.isArray(obj)) {
    obj.sort();
    return obj;
  }
  var out = Object.create(null);
  var keys = Object.keys(obj);
  keys.sort();
  keys.forEach(function (key) {
    var val = obj[key];
    if (Array.isArray(val)) {
      val.sort();
    }
    out[key] = val;
  });
  return out;
};

// The sorting is different on Windows, we are
// ignoring the sort order for now
helper.deepEqual = function deepEqual (test, a, b, message) {
  a.sort();
  b.sort();
  test.deepEqual(a, b, message);
};