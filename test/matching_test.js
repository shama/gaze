'use strict';

var gaze = require('../lib/gaze.js');
var grunt = require('grunt');
var path = require('path');
var helper = require('./helper');

var fixtures = path.resolve(__dirname, 'fixtures');
var sortobj = helper.sortobj;

function cleanUp (done) {
  [
    'newfolder',
  ].forEach(function (d) {
    var p = path.join(fixtures, d);
    if (grunt.file.exists(p)) {
      grunt.file.delete(p);
    }
  });
  done();
}

exports.matching = {
  setUp: function (done) {
    process.chdir(fixtures);
    cleanUp(done);
  },
  tearDown: cleanUp,
  globAll: function (test) {
    test.expect(2);
    gaze('**/*', {nosort:true}, function () {
      var result = this.relative(null, true);
      helper.deepEqual(test, result['.'], ['Project (LO)/', 'nested/', 'one.js', 'sub/']);
      helper.deepEqual(test, result['sub/'], ['one.js', 'two.js']);
      this.on('end', test.done);
      this.close();
    });
  },
  relativeDir: function (test) {
    test.expect(1);
    gaze('**/*', function () {
      test.deepEqual(this.relative('sub', true), ['one.js', 'two.js']);
      this.on('end', test.done);
      this.close();
    });
  },
  globArray: function (test) {
    test.expect(2);
    gaze(['*.js', 'sub/*.js'], function () {
      var result = this.relative(null, true);
      test.deepEqual(sortobj(result['.']), sortobj(['one.js', 'Project (LO)/', 'nested/', 'sub/']));
      test.deepEqual(sortobj(result['sub/']), sortobj(['one.js', 'two.js']));
      this.on('end', test.done);
      this.close();
    });
  },
  globArrayDot: function (test) {
    test.expect(1);
    gaze(['./sub/*.js'], function () {
      var result = this.relative(null, true);
      test.deepEqual(result['sub/'], ['one.js', 'two.js']);
      this.on('end', test.done);
      this.close();
    });
  },
  oddName: function (test) {
    test.expect(1);
    gaze(['Project (LO)/*.js'], function () {
      var result = this.relative(null, true);
      test.deepEqual(result['Project (LO)/'], ['one.js']);
      this.on('end', test.done);
      this.close();
    });
  },
  addedLater: function (test) {
    test.expect(2);
    var times = 0;
    gaze('**/*.js', function (err, watcher) {
      watcher.on('all', function (status, filepath) {
        times++;
        var result = watcher.relative(null, true);
        test.deepEqual(result['newfolder/'], ['added.js']);
        if (times > 1) { watcher.close(); }
      });
      grunt.file.write(path.join(fixtures, 'newfolder', 'added.js'), 'var added = true;');
      setTimeout(function () {
        grunt.file.write(path.join(fixtures, 'newfolder', 'added.js'), 'var added = true;');
      }, 1000);
      watcher.on('end', function () {
        // TODO: Figure out why this test is finicky leaking it's newfolder into the other tests
        setTimeout(test.done, 2000);
      });
    });
  },
};
