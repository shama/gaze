'use strict';

var Gaze = require('../lib/gaze.js');
var grunt = require('grunt');
var path = require('path');
var fs = require('fs');
var gaze;

// Node v0.6 compat
fs.existsSync = fs.existsSync || path.existsSync;

// Clean up helper to call in setUp and tearDown
function deleteFiles(done) {
  [
    'sub/tmp.js',
    'sub/tmp',
    'sub/renamed.js',
    'sub/added.js',
    'added.js',
    'nested/added.js',
    'nested/sub/added.js'
  ].forEach(function(d) {
    var p = path.resolve(__dirname, 'fixtures', d);
    if (fs.existsSync(p)) { fs.unlinkSync(p); }
  });
  done();
}

exports.watch = {
  setUp: function(done) {
    process.chdir(path.resolve(__dirname, 'fixtures'));
    deleteFiles(done);
  },
  tearDown: function(done) {
    gaze.close();
    gaze = null;
    deleteFiles(done);
  },
  remove: function(test) {
    test.expect(2);
    gaze = Gaze('**/*.js', function(err, watcher) {
      watcher.remove(path.resolve(__dirname, 'fixtures', 'sub', 'two.js'));
      //Two options here, require the user to add a seperator as done below to remove
      //a directory.
      //Or, we could do stat checks in the remove function to test if it is a directory.
      watcher.remove(path.resolve(__dirname, 'fixtures') + path.sep);
      var result = watcher.relative(null, true);
      test.deepEqual(result['sub/'], ['one.js']);
      test.notDeepEqual(result['.'], ['one.js']);
      test.done();
    });
  },
  changed: function(test) {
    test.expect(1);
  
    gaze = Gaze('**/*.js', function(err, watcher) {
      watcher.on('changed', function(filepath) {
        var expected = path.relative(process.cwd(), filepath);
        test.equal(path.join('sub', 'one.js'), expected);
        test.done();
      });
      watcher.on('added', function() { test.ok(false, 'added event should not have emitted.'); });
      watcher.on('deleted', function() { test.ok(false, 'deleted event should not have emitted.'); });
      
      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'one.js'), 'var one = true;');
    });
  },
  added: function(test) {
    test.expect(1);
    
    gaze = Gaze('**/*.js', function(err, watcher) {
      watcher.on('added', function(filepath) {
        var expected = path.relative(process.cwd(), filepath);
        test.equal(path.join('sub', 'tmp.js'), expected);
      });
      watcher.on('changed', function() { test.ok(false, 'changed event should not have emitted.'); });
      watcher.on('deleted', function() { test.ok(false, 'deleted event should not have emitted.'); });

      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'tmp.js'), 'var tmp = true;');  

      setTimeout(function() {
        //are two events firing for this add?
        //as well gives the file system a break to ensure accurate tests.
        test.done();
      }, 2000)
    });
  },
  dontAddUnmatchedFiles: function(test) {
    test.expect(2);
    gaze = Gaze('**/*.js', function(err, watcher) {
      this.on('added', function(filepath) {
        test.equal(path.relative(process.cwd(), filepath), path.join('sub', 'tmp.js'));
      });
      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'tmp'), 'Dont add me!');
      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'tmp.js'), 'add me!');

      setTimeout(function() {
        test.ok(true, 'Ended without adding the non.js file.');
        test.done();
      }, 1000);
    });
  },
  deleted: function(test) {
    test.expect(1);
    var tmpfile = path.resolve(__dirname, 'fixtures', 'sub', 'deleted.js');
    fs.writeFileSync(tmpfile, 'var tmp = true;');
    gaze = Gaze('**/*.js', function(err, watcher) {
      watcher.on('deleted', function(filepath) {
        test.equal(path.join('sub', 'deleted.js'), path.relative(process.cwd(), filepath));
        test.done();
      });
      this.on('changed', function() { test.ok(false, 'changed event should not have emitted.'); });
      this.on('added', function() { test.ok(false, 'added event should not have emitted.'); });
      fs.unlinkSync(tmpfile);
    });
  },
  nomark: function(test) {
    test.expect(1);

    gaze = Gaze('**/*.js', {mark:false}, function(err, watcher) {
      watcher.on('changed', function(filepath) {
        var expected = path.relative(process.cwd(), filepath);
        test.equal(path.join('sub', 'one.js'), expected);
        test.done();
      });

      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'one.js'), 'var one = true;');
    });
  },
  dontEmitTwice: function(test) {
    test.expect(2);
    gaze = Gaze('**/*.js', function(err, watcher) {
      
      watcher.on('all', function(status, filepath) {
        var expected = path.relative(process.cwd(), filepath);
        
        test.equal(path.join('sub', 'one.js'), expected);
        test.equal(status, 'changed');
        
        fs.readFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'one.js'));
        
        setTimeout(function() {
          fs.readFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'one.js'));
        }, 1000);
        
        // Give some time to accidentally emit before we close
        setTimeout(function() { test.done() }, 3000);

      });

      setTimeout(function() {
        fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'one.js'), 'var one = true;');
      }, 1000);

    });
  },
  emitTwice: function(test) {
    test.expect(2);
    var times = 0;
    
    gaze = Gaze('**/*.js', function(err, watcher) {
      watcher.on('all', function(status, filepath) {
        test.equal(status, 'changed');
        times++;
        setTimeout(function() {
          if (times < 2) {
            fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'one.js'), 'var one = true;');
          } else {
            test.done();
          }
        }, 1000);
      });
      
      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'one.js'), 'var one = true;');
    });
  },
  nonExistent: function(test) {
    test.expect(1);
    gaze = Gaze('non/existent/**/*', function(err, watcher) {
      test.ok(true);
      test.done();
    });
  },
  differentCWD: function(test) {
    test.expect(1);
    var cwd = path.resolve(__dirname, 'fixtures', 'sub');

    gaze = Gaze('two.js', {
      cwd: cwd
    }, function(err, watcher) {
      watcher.on('changed', function(filepath) {
        test.deepEqual(this.relative(), {'.':['two.js']});
        test.done();
      });

      fs.writeFileSync(path.resolve(cwd, 'two.js'), 'var two = true;');
    });
  },
  dontEmitInSpecificSubFolders: function(test) {
    test.expect(3);
    
    gaze = Gaze(['**/*.js', 'nested/**/*.js', '!nested/sub/*.js'], function(err, watcher) {
      watcher.on('added', function(filepath) {
        test.equal('added.js', path.basename(filepath));
      });
      watcher.on('changed', function() { test.ok(false, 'changed event should not have emitted.'); });   

      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'nested', 'sub', 'added.js'), 'var added = true;');
      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'nested', 'added.js'), 'var added = true;');
      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'sub', 'added.js'), 'var added = true;');
      fs.writeFileSync(path.resolve(__dirname, 'fixtures', 'added.js'), 'var added = true;');

      setTimeout(function() {
        test.done();
      }, 2000);
    });
  },
};
