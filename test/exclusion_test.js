var Gaze = require('../lib/gaze.js').Gaze;
var path = require('path');
var fs = require('fs');

exports.exclusion = {
  setUp: function(done) {
    process.chdir(path.resolve(__dirname, 'fixtures'));
    done();
  },
  tearDown: function(done) {
    fs.unlinkSync(path.resolve(__dirname, 'fixtures', 'two.txt'));
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
      //Write a file that shouldn't ever match a pattern, but is in the same directory as one that does.
      console.log('Write TXT');
      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'two.txt'), 'Will I be watched?');

      //Write a file that is part of the exclusion.
      console.log('Write Excluded File');
      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'nested', 'sub', 'two.js'), 'var two = true;');

      //Give time for watcher to respond and see if it responds to either file that shouldn't be watched.
      setTimeout(function() {
        console.log('WATCH ME!');
        fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'one.js'), 'var one = true;');
      }, 2000);
    })
  }
}