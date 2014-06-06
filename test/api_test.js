'use strict';

var gaze = require('../index.js');
var path = require('path');
var fs = require('fs');
var helper = require('./helper.js');

var fixtures = path.resolve(__dirname, 'fixtures');

exports.api = {
  setUp: function(done) {
    process.chdir(fixtures);
    done();
  },
  newGaze: function(test) {
    test.expect(2);
    new gaze.Gaze('**/*', {}, function() {
      this.relative(null, true, function(err, result) {
        result = helper.sortobj(result);
        test.deepEqual(result['./'], ['Project (LO)/', 'nested/', 'one.js', 'sub/']);
        test.deepEqual(result['sub/'], ['one.js', 'two.js']);
        this.on('end', test.done);
        this.close();
      }.bind(this));
    });
  },
  multipleInstances: function(test) {
    test.expect(2);
    var nested = new gaze.Gaze('nested/**/*');
    var sub = new gaze.Gaze('sub/**/*');
    nested.on('end', sub.close.bind(sub));
    sub.on('end', test.done);

    var expected = [
      ['changed', 'nested/sub/two.js'],
      ['changed', 'sub/one.js']
    ];

    function hasTriggered(actual) {
      var expect = expected.shift();
      test.deepEqual(actual, expect);
      if (expected.length < 1) nested.close();
    }

    nested.on('all', function(status, filepath) {
      hasTriggered([status, path.relative(fixtures, filepath)]);
      fs.writeFile(path.join(fixtures, 'sub', 'one.js'), 'var one = true;');
    });
    sub.on('all', function(status, filepath) {
      hasTriggered([status, path.relative(fixtures, filepath)]);
    });

    setTimeout(function() {
      fs.writeFile(path.join(fixtures, 'nested', 'sub', 'two.js'), 'var two = true;');
    }, 10);
  },
  func: function(test) {
    test.expect(1);
    var g = gaze('**/*', function(err, watcher) {
      watcher.relative('sub', true, function(err, result) {
        test.deepEqual(result, ['one.js', 'two.js']);
        g.on('end', test.done);
        g.close();
      }.bind(this));
    });
  },
  ready: function(test) {
    test.expect(1);
    var g = new gaze.Gaze('**/*');
    g.on('ready', function(watcher) {
      watcher.relative('sub', true, function(err, result) {
        test.deepEqual(result, ['one.js', 'two.js']);
        this.on('end', test.done);
        this.close();
      }.bind(this));
    });
  },
  nomatch: function(test) {
    test.expect(1);
    gaze('nomatch.js', function(err, watcher) {
      watcher.on('nomatch', function() {
        test.ok(true, 'nomatch was emitted.');
        watcher.close();
      });
      watcher.on('end', test.done);
    });
  },
  cwd: function(test) {
    test.expect(2);
    var cwd = path.resolve(__dirname, 'fixtures', 'sub');
    gaze('two.js', { cwd: cwd }, function(err, watcher) {
      watcher.on('all', function(event, filepath) {
        test.equal(path.relative(cwd, filepath), 'two.js');
        test.equal(event, 'changed');
        watcher.close();
      });
      fs.writeFile(path.join(cwd, 'two.js'), 'var two = true;');
      watcher.on('end', test.done);
    });
  },
  watched: function(test) {
    test.expect(1);
    var expected = ['Project (LO)', 'nested', 'one.js', 'sub'];
    gaze('**/*', function(err, watcher) {
      this.watched(function(err, result) {
        result = helper.sortobj(helper.unixifyobj(result[process.cwd() + path.sep].map(function(file) {
          return path.relative(process.cwd(), file);
        })));
        test.deepEqual(result, expected);
        watcher.close();
      });
      watcher.on('end', test.done);
    });
  },
};
