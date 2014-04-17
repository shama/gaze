/*
Copyright (c) 2013 GitHub Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
(function() {
  var EventEmitter, HandleMap, HandleWatcher, PathWatcher, binding, fs, handleWatchers, path,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  binding = require('bindings')('pathwatcher.node');

  HandleMap = binding.HandleMap;

  EventEmitter = require('events').EventEmitter;

  fs = require('graceful-fs');

  path = require('path');

  handleWatchers = new HandleMap;

  binding.setCallback(function(event, handle, filePath, oldFilePath) {
    if (handleWatchers.has(handle)) {
      return handleWatchers.get(handle).onEvent(event, filePath, oldFilePath);
    }
  });

  HandleWatcher = (function(_super) {
    __extends(HandleWatcher, _super);

    function HandleWatcher(path) {
      this.path = path;
      this.start();
    }

    HandleWatcher.prototype.onEvent = function(event, filePath, oldFilePath) {
      var detectRename,
        _this = this;
      switch (event) {
        case 'rename':
          this.close();
          detectRename = function() {
            return fs.stat(_this.path, function(err) {
              if (err) {
                _this.path = filePath;
                _this.start();
                return _this.emit('change', 'rename', filePath);
              } else {
                _this.start();
                return _this.emit('change', 'change', null);
              }
            });
          };
          return setTimeout(detectRename, 100);
        case 'delete':
          this.emit('change', 'delete', null);
          return this.close();
        case 'unknown':
          throw new Error("Received unknown event for path: " + this.path);
          break;
        default:
          return this.emit('change', event, filePath, oldFilePath);
      }
    };

    HandleWatcher.prototype.start = function() {
      var troubleWatcher;
      this.handle = binding.watch(this.path);
      if (handleWatchers.has(this.handle)) {
        troubleWatcher = handleWatchers.get(this.handle);
        troubleWatcher.close();
        //console.error("The handle(" + this.handle + ") returned by watching " + this.path + " is the same with an already watched path(" + troubleWatcher.path + ")");
      }
      return handleWatchers.add(this.handle, this);
    };

    HandleWatcher.prototype.closeIfNoListener = function() {
      if (this.listeners('change').length === 0) {
        return this.close();
      }
    };

    HandleWatcher.prototype.close = function() {
      if (handleWatchers.has(this.handle)) {
        binding.unwatch(this.handle);
        return handleWatchers.remove(this.handle);
      }
    };

    return HandleWatcher;

  })(EventEmitter);

  PathWatcher = (function(_super) {
    __extends(PathWatcher, _super);

    PathWatcher.prototype.isWatchingParent = false;

    PathWatcher.prototype.path = null;

    PathWatcher.prototype.handleWatcher = null;

    function PathWatcher(filePath, callback) {
      var stats, watcher, _i, _len, _ref,
        _this = this;
      this.path = filePath;
      if (process.platform === 'win32') {
        stats = fs.statSync(filePath);
        this.isWatchingParent = !stats.isDirectory();
      }
      if (this.isWatchingParent) {
        filePath = path.dirname(filePath);
      }
      _ref = handleWatchers.values();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        watcher = _ref[_i];
        if (watcher.path === filePath) {
          this.handleWatcher = watcher;
          break;
        }
      }
      if (this.handleWatcher == null) {
        this.handleWatcher = new HandleWatcher(filePath);
      }
      this.onChange = function(event, newFilePath, oldFilePath) {
        switch (event) {
          case 'rename':
          case 'change':
          case 'delete':
            if (event === 'rename') {
              _this.path = newFilePath;
            }
            if (typeof callback === 'function') {
              callback.call(_this, event, newFilePath);
            }
            return _this.emit('change', event, newFilePath);
          case 'child-rename':
            if (_this.isWatchingParent) {
              if (_this.path === oldFilePath) {
                return _this.onChange('rename', newFilePath);
              }
            } else {
              return _this.onChange('change', '');
            }
            break;
          case 'child-delete':
            if (_this.isWatchingParent) {
              if (_this.path === newFilePath) {
                return _this.onChange('delete', null);
              }
            } else {
              return _this.onChange('change', '');
            }
            break;
          case 'child-change':
            if (_this.isWatchingParent && _this.path === newFilePath) {
              return _this.onChange('change', '');
            }
            break;
          case 'child-create':
            if (!_this.isWatchingParent) {
              return _this.onChange('change', '');
            }
        }
      };
      this.handleWatcher.on('change', this.onChange);
    }

    PathWatcher.prototype.close = function() {
      this.handleWatcher.removeListener('change', this.onChange);
      return this.handleWatcher.closeIfNoListener();
    };

    return PathWatcher;

  })(EventEmitter);

  exports.watch = function(path, callback) {
    path = require('path').resolve(path);
    return new PathWatcher(path, callback);
  };

  exports.closeAllWatchers = function() {
    var watcher, _i, _len, _ref;
    _ref = handleWatchers.values();
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      watcher = _ref[_i];
      watcher.close();
    }
    return handleWatchers.clear();
  };

  exports.getWatchedPaths = function() {
    var paths, watcher, _i, _len, _ref;
    paths = [];
    _ref = handleWatchers.values();
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      watcher = _ref[_i];
      paths.push(watcher.path);
    }
    return paths;
  };

}).call(this);
