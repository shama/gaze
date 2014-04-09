'use strict';

var helper = require('../lib/helper.js');
var globule = require('globule');

exports.helper = {
  setUp: function(done) {
    done();
  },
  tearDown: function(done) {
    done();
  },
  flatToTree: function(test) {
    test.expect(1);
    var cwd = '/Users/dude/www/';
    var files = [
      '/Users/dude/www/',
      '/Users/dude/www/one.js',
      '/Users/dude/www/two.js',
      '/Users/dude/www/sub/',
      '/Users/dude/www/sub/one.js',
      '/Users/dude/www/sub/nested/',
      '/Users/dude/www/sub/nested/one.js',
    ];
    var expected = {
      '/Users/dude/www/': ['/Users/dude/www/one.js', '/Users/dude/www/two.js', '/Users/dude/www/sub/'],
      '/Users/dude/www/sub/': ['/Users/dude/www/sub/one.js', '/Users/dude/www/sub/nested/'],
      '/Users/dude/www/sub/nested/': ['/Users/dude/www/sub/nested/one.js'],
    };
    helper.flatToTree(files, cwd, false, true, function(err, actual) {
      test.deepEqual(actual, expected);
      test.done();
    });
  },
  flatToTreeRelative: function(test) {
    test.expect(1);
    var cwd = '/Users/dude/www/';
    var files = [
      '/Users/dude/www/',
      '/Users/dude/www/one.js',
      '/Users/dude/www/two.js',
      '/Users/dude/www/sub/',
      '/Users/dude/www/sub/one.js',
      '/Users/dude/www/sub/nested/',
      '/Users/dude/www/sub/nested/one.js',
    ];
    var expected = {
      '.': ['one.js', 'two.js', 'sub/'],
      'sub/': ['one.js', 'nested/'],
      'sub/nested/': ['one.js'],
    };
    helper.flatToTree(files, cwd, true, true, function(err, actual) {
      test.deepEqual(actual, expected);
      test.done();
    });
  },
};
