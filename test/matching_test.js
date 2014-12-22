'use strict';

var gaze = require('../index.js');
var grunt = require('grunt');
var path = require('path');
var helper = require('./helper');

var fixtures = helper.fixtures;
var sortobj = helper.sortobj;

exports.matching = {
  setUp: function(done) {
    process.chdir(fixtures);
    helper.cleanUp(done);
  },
  tearDown: helper.cleanUp,
  globAll: function(test) {
    test.expect(2);
    gaze('**/*', function() {
      this.relative(null, true, function(err, result) {
        test.deepEqual(sortobj(result['./']), sortobj(['Project (LO)/', 'nested/', 'one.js', 'sub/']));
        test.deepEqual(sortobj(result['sub/']), sortobj(['one.js', 'two.js']));
        this.on('end', test.done);
        this.close();
      }.bind(this));
    });
  },
  relativeDir: function(test) {
    test.expect(1);
    gaze('**/*', function() {
      this.relative('sub', true, function(err, result) {
        test.deepEqual(sortobj(result), sortobj(['one.js', 'two.js']));
        this.on('end', test.done);
        this.close();
      }.bind(this));
    });
  },
  // globArray: function(test) {
  //   test.expect(2);
  //   gaze(['*.js', 'sub/*.js'], function() {
  //     this.relative(null, true, function(err, result) {
  //       test.deepEqual(sortobj(result['./']), sortobj(['one.js']));
  //       test.deepEqual(sortobj(result['sub/']), sortobj(['one.js', 'two.js']));
  //       this.on('end', test.done);
  //       this.close();
  //     }.bind(this));
  //   });
  // },
  globArrayDot: function(test) {
    test.expect(1);
    gaze(['./sub/*.js'], function() {
      this.relative(null, true, function(err, result) {
        test.deepEqual(result['sub/'], ['one.js', 'two.js']);
        this.on('end', test.done);
        this.close();
      }.bind(this));
    });
  },
  oddName: function(test) {
    test.expect(1);
    gaze(['Project (LO)/*.js'], function() {
      this.relative(null, true, function(err, result) {
        test.deepEqual(result['Project (LO)/'], ['one.js']);
        this.on('end', test.done);
        this.close();
      }.bind(this));
    });
  },
  // addedLater: function(test) {
  //   var expected = [
  //     ['newfolder/', 'added.js'],
  //     ['newfolder/', 'added.js', 'addedAnother.js'],
  //     ['newfolder/', 'added.js', 'addedAnother.js', 'sub/'],
  //   ];
  //   test.expect(expected.length);
  //   gaze('**/*.js', function(err, watcher) {
  //     console.log('watcher started')
  //     watcher.on('all', function(status, filepath) {
  //       var expect = expected.shift();
  //       watcher.relative(expect[0], true, function(err, result) {
  //         var one = sortobj(result)
  //         var two = sortobj(expect.slice(1))
  //         test.deepEqual(sortobj(result), sortobj(expect.slice(1)));
  //         debugger;
  //         if (expected.length < 1) { watcher.close(); }
  //       });
  //     });
  //     grunt.file.write(path.join(fixtures, 'newfolder', 'added.js'), 'var added = true;');
  //     setTimeout(function() {
  //       grunt.file.write(path.join(fixtures, 'newfolder', 'addedAnother.js'), 'var added = true;');
  //     }, 1000);
  //     setTimeout(function() {
  //       grunt.file.write(path.join(fixtures, 'newfolder', 'sub', 'lastone.js'), 'var added = true;');
  //     }, 2000);
  //     watcher.on('end', test.done);
  //   });
  // },
};

// Ignore these tests if node v0.8
var version = process.versions.node.split('.');
if (version[0] === '0' && version[1] === '8') {
  // gaze v0.4 returns watched but unmatched folders
  // where gaze v0.5 does not
  delete exports.matching.globArray;
  delete exports.matching.addedLater;
}
