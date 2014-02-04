'use strict';

var Gaze = require('../index.js').Gaze;
var path = require('path');
var fs = require('fs');
var helper = require('./helper');

var fixtures = path.resolve(__dirname, 'fixtures');
var sortobj = helper.sortobj;

exports.add = {
  setUp: function(done) {
    process.chdir(fixtures);
    done();
  },
  addToWatched: function(test) {
    test.expect(1);
    var files = [
      'Project (LO)/',
      'Project (LO)/one.js',
      'nested/',
      'nested/one.js',
      'nested/three.js',
      'nested/sub/',
      'nested/sub/two.js',
      'one.js',
    ];
    var expected = {
      'Project (LO)/': ['one.js'],
      '.': ['Project (LO)/', 'nested/', 'one.js', 'sub/'],
      'nested/': ['sub/', 'sub2/', 'one.js', 'three.js'],
      'nested/sub/': ['two.js'],
    };
    var gaze = new Gaze('addnothingtowatch');
    gaze._addToWatched(files);
    var result = gaze.relative(null, true);
    test.deepEqual(sortobj(result), sortobj(expected));
    gaze.on('end', test.done);
    gaze.close();
  },
  addLater: function(test) {
    test.expect(3);
    new Gaze('sub/one.js', function(err, watcher) {
      test.deepEqual(watcher.relative('sub'), ['one.js']);
      watcher.add('sub/*.js', function() {
        test.deepEqual(watcher.relative('sub'), ['one.js', 'two.js']);
        watcher.on('changed', function(filepath) {
          test.equal('two.js', path.basename(filepath));
          watcher.on('end', test.done);
          watcher.close();
        });
        fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'two.js'), 'var two = true;');
      });
    });
  },
  addNoCallback: function(test) {
    test.expect(1);
    new Gaze('sub/one.js', function(err, watcher) {
      this.add('sub/two.js');
      this.on('changed', function(filepath) {
        test.equal('two.js', path.basename(filepath));
        watcher.on('end', test.done);
        watcher.close();
      });
      setTimeout(function() {
        fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'two.js'), 'var two = true;');
      }, 500);
    });
  },
};
