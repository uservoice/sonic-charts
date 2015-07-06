var gulp = require('gulp')
,   shell = require('gulp-shell')
,   uglify = require('gulp-uglify')
,   concat = require('gulp-concat')
,   jshint = require('gulp-jshint')
,   jstylish = require('jshint-stylish')
,   runSequence = require('run-sequence')
,   webserver = require('gulp-webserver')
;

gulp.task('clean', function(done) {
  gulp.src('')
    .pipe(shell('rm -Rf ./dist/*'))
  ;
  done();
});

gulp.task('lint', function() {
  return gulp.src('./src/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter(jstylish))
    .pipe(jshint.reporter('fail'))
  ;
});

gulp.task('scripts', function () {
  return gulp.src('./src/*.js')
    .pipe(concat('sharts.js'))
      .pipe(gulp.dest('./dist'))
    .pipe(concat('sharts.min.js'))
      .pipe(uglify())
      .pipe(gulp.dest('./dist'))
  ;
});

gulp.task('build', function() {
   runSequence('clean', 'lint', 'scripts');
});

gulp.task('watch', ['build'], function() {
  gulp.watch('./src/*.js', ['scripts']);
});

gulp.task('server', ['watch'], function() {
  return gulp.src('./')
    .pipe(webserver({
      livereload: true,
      directoryListing: true,
      open: false,
      port: 5000
    }))
  ;
});

gulp.task('default', ['build']);
