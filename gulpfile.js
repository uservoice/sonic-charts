var gulp = require('gulp')
,   shell = require('gulp-shell')
,   uglify = require('gulp-uglify')
,   concat = require('gulp-concat')
,   webserver = require('gulp-webserver')
;

gulp.task('clean', function(done) {
  gulp.src('')
    .pipe(shell('rm -Rf ./dist/*'))
  ;
  done();
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

gulp.task('build', ['clean', 'scripts']);

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
