'use strict';

var statpoll = require('../lib/statpoll.js');
var globule = require('globule');
var path = require('path');
var grunt = require('grunt');

var fixturesbase = path.resolve(__dirname, 'fixtures');
function clean() {
  [
    path.join(fixturesbase, 'add.js')
  ].forEach(grunt.file.delete);
}

exports.statpoll = {
  setUp: function(done) {
    clean();
    done();
  },
  tearDown: function(done) {
    statpoll.closeAll();
    clean();
    done();
  },
  change: function(test) {
    test.expect(2);

    var filepath = path.resolve(fixturesbase, 'one.js');
    statpoll(filepath, function(event, filepath) {
      test.equal(event, 'change');
      test.equal(path.basename(filepath), 'one.js');
      test.done();
    });

    grunt.file.write(filepath, grunt.file.read(filepath));
    statpoll.tick();
  },
  delete: function(test) {
    test.expect(2);

    var filepath = path.resolve(fixturesbase, 'add.js');
    grunt.file.write(filepath, 'var added = true;');

    statpoll(filepath, function(event, filepath) {
      test.equal(event, 'delete');
      test.equal(path.basename(filepath), 'add.js');
      test.done();
    });

    grunt.file.delete(filepath);
    statpoll.tick();
  },
};
