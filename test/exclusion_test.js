var Gaze = require('../lib/gaze.js').Gaze;
var path = require('path');
var fs = require('fs');

exports.exclusion = {
  setUp: function(done) {
    process.chdir(path.resolve(__dirname, 'fixtures'));
    done();
  },
  exclusionTest: function(test) {
    var expected = {
      'Project (LO)/': ['one.js'],
      '.': ['one.js'],
      'sub/': ['one.js', 'two.js']
    };
    test.expect(2);
    var gaze = new Gaze(['**/*.js', '!nested/**/*.js'], function(err, watcher) {
      test.deepEqual(this.relative(null, true), expected);
      this.on('all', function(status, filepath) {
        test.equal('one.js', path.basename(filepath));
        watcher.close();
        test.done();
      });
      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'nested', 'sub', 'two.js'), 'var two = true;');
      //Give time for watcher to respond and see if it does to the excluded file.
      setTimeout(function() {
        fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'one.js'), 'var one = true;');
      }, 2000);
    })
  }
}