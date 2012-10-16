# gaze [![Build Status](https://secure.travis-ci.org/shama/gaze.png?branch=master)](http://travis-ci.org/shama/gaze)

A globbing fs.watch wrapper built from the best parts of other fine watch libs. 
Compatible with NodeJS v0.8/0.6, Windows, OSX and Linux.

## Usage
Install the module with: `npm install gaze` or place into your `package.json`
and run `npm install`.

```javascript
var gaze = require('gaze');

// Watch all .js files/dirs in process.cwd()
gaze('**/*.js', function(err, watcher) {
  // Files have all started watching
  // watcher === this

  // Get all watched files
  console.log(this.watched());

  // On file changed
  this.on('changed', function(filepath) {
    console.log(filepath + ' was changed');
  });

  // On file added
  this.on('added', function(filepath) {
    console.log(filepath + ' was added');
  });

  // On file deleted
  this.on('deleted', function(filepath) {
    console.log(filepath + ' was deleted');
  });

  // On changed/added/deleted
  this.on('all', function(event, filepath) {
    console.log(filepath + ' was ' + event);
  });

  // Get watched files with relative paths
  console.log(this.relative());
});

// Also accepts an array of patterns
gaze(['stylesheets/*.css', 'images/**/*.png'], function() {
  // Add more patterns later to be watched
  this.add(['js/*.js']);
});
```

### Alternate Interface

```javascript
var Gaze = require('gaze').Gaze;

var gaze = new Gaze('**/*');

// Files have all started watching
gaze.on('ready', function(watcher) { });

// A file has been added/changed/deleted has occurred
gaze.on('all', function(event, filepath) { });
```

### Errors

```javascript
gaze('**/*', function() {
  this.on('error', function(err) {
    // Handle error here
  });
});
```

### Minimatch / Glob

See [isaacs's minimatch](https://github.com/isaacs/minimatch) for more
information on glob patterns.

## Documentation

### gaze(patterns, [options], callback)

* `patterns` {String|Array} File patterns to be matched
* `options` {Object}
* `callback` {Function}
  * `err` {Error | null}
  * `watcher` {Object} Instance of the Gaze watcher

### Class: gaze.Gaze

Create a Gaze object by instanting the `gaze.Gaze` class.

```javascript
var Gaze = require('gaze').Gaze;
var gaze = new Gaze(pattern, options, callback);
```

#### Properties

* `options` The options object passed in.

#### Events

* `ready(watcher)` When files have been globbed and watching has begun.
* `all(event, filepath)` When an `added`, `changed` or `deleted` event occurs.
* `added(filepath)` When a file has been added to a watch directory.
* `changed(filepath)` When a file or directory has been changed.
* `deleted(filepath)` When a file or directory has been deleted.
* `end()` When the watcher is closed and watches have been removed.
* `error(err)` When an error occurs.

#### Methods

* `emit(event, [...])` Wrapper for the EventEmitter.emit.
  `added`|`changed`|`deleted` events will also trigger the `all` event.
* `close()` Unwatch all files and reset the watch instance.
* `add(patterns, callback)` Adds file(s) patterns to be watched.
* `remove(filepath)` removes a file or directory from being watched. Does not
  recurse directories.
* `watched()` Returns the currently watched files.
* `relative()` Returns the currently watched files with relative paths.


## Why Another `fs.watch` Wrapper?
I liked parts of other `fs.watch` wrappers but none had all the features I
needed. This lib combines the features I needed from other fine watch libs:
Speedy data behavior from
[paulmillr's chokidar](https://github.com/paulmillr/chokidar), API interface
from [mikeal's watch](https://github.com/mikeal/watch) and file globbing using
[isaacs's glob](https://github.com/isaacs/node-glob) which is also used by
[cowboy's Grunt](https://github.com/gruntjs/grunt).

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style.
Add unit tests for any new or changed functionality. Lint and test your code
using [grunt](http://gruntjs.com/).

## Release History
* 0.1.6 - Recognize the `cwd` option properly
* 0.1.5 - Catch too many open file errors
* 0.1.4 - Really fix the race condition with 2 watches
* 0.1.3 - Fix race condition with 2 watches
* 0.1.2 - Read triggering changed event fix
* 0.1.1 - Minor fixes
* 0.1.0 - Initial release

## License
Copyright (c) 2012 Kyle Robinson Young  
Licensed under the MIT license.
