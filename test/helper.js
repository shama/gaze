'use strict';

var helper = module.exports = {};

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
