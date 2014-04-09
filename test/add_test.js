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
  addLater: function(test) {
    test.expect(3);
    new Gaze('sub/one.js', function(err, watcher) {
      watcher.on('changed', function(filepath) {
        test.equal('two.js', path.basename(filepath));
        watcher.on('end', test.done);
        watcher.close();
      });

      function addLater() {
        watcher.add('sub/*.js', function() {
          watcher.relative('sub', function(err, result) {
            test.deepEqual(result, ['one.js', 'two.js']);
            fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'two.js'), 'var two = true;');
          });
        });
      }

      watcher.relative('sub', function(err, result) {
        test.deepEqual(result, ['one.js']);
        addLater();
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
