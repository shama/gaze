module.exports = function (grunt) {
  'use strict';
  grunt.option('stack', true);
  grunt.initConfig({
    benchmark: {
      all: {
        src: ['benchmarks/*.js'],
        options: { times: 10 }
      }
    },
    nodeunit: {
      files: ['test/*_test.js']
    },
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      gruntfile: {
        src: 'Gruntfile.js'
      },
      lib: {
        src: ['lib/**/*.js']
      },
      test: {
        src: ['test/**/*_test.js']
      }
    }
  });

  // Dynamic alias task to nodeunit. Run individual tests with: grunt test:events
  grunt.registerTask('test', function (file) {
    grunt.config('nodeunit.files', String(grunt.config('nodeunit.files')).replace('*', file || '*'));
    grunt.task.run('nodeunit');
  });

  grunt.loadNpmTasks('grunt-benchmark');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');
  grunt.registerTask('default', ['jshint', 'nodeunit']);
};
