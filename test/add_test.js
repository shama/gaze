'use strict';

var Gaze = require('../lib/gaze.js').Gaze;
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
