/**
 * sharts.angular.js - D3 charting library made by UserVoice
 * @version v1.0.0
 * @link https://github.com/uservoice/shart
 * @license MIT
 */
!function(undefined) {

if (angular) {
  /* globals angular, Shart */

  angular.module('shart', []).directive('shartLegend', function () {
    return {
      restrict: 'E',

      scope: {
        data: '='
      },

      link: function link($scope, $element) {
        $scope.$shart = Shart.Legend($element[0], $scope.data, {});
        $scope.$watch('data', function (data) {
          return $scope.$shart.update(data, true);
        });
        $scope.$on('$destroy', function () {
          return $scope.$shart.destroy();
        });
      }
    };
  }).directive('shartSeries', function () {
    return {
      restrict: 'E',

      scope: {
        data: '=',
        width: '=',
        height: '=',
        startTime: '=',
        endTime: '=',
        dateAxis: '=',
        yAxis: '=',
        xAxis: '='
      },

      link: function link($scope, $element) {
        // TODO: More options!
        $scope.$shart = Shart.Series($element[0], $scope.data, {
          startTime: $scope.startTime,
          endTime: $scope.endTime,
          dateAxis: $scope.dateAxis || 'none',
          yAxis: $scope.yAxis,
          xAxis: $scope.xAxis
        });

        function update() {
          return function (data, old) {
            if (data !== old) {
              $scope.$shart.update(data, true);
            }
          };
        }
        function setOption(key) {
          return function (value, old) {
            if (value !== old) {
              $scope.$shart.setOption(key, value, true);
            }
          };
        }

        $scope.$watchCollection('data', update());

        $scope.$watch('width', setOption('width'));
        $scope.$watch('height', setOption('height'));
        $scope.$watch('startTime', setOption('startTime'));
        $scope.$watch('endTime', setOption('endTime'));
        $scope.$watch('dateAxis', setOption('dateAxis'));
        $scope.$watch('yAxis', setOption('yAxis'));
        $scope.$watch('xAxis', setOption('xAxis'));

        $scope.$on('$destroy', function () {
          return $scope.$shart.destroy();
        });
      }
    };
  }).directive('shartSparkline', function () {
    return {
      restrict: 'E',

      scope: {
        data: '=',
        width: '=',
        height: '=',
        color: '@',
        strokeColor: '@',
        strokeWidth: '=',
        yGuide: '=',
        yGuides: '='
      },

      link: function link($scope, $element) {
        $scope.$shart = Shart.Sparkline($element[0], $scope.data, {
          width: $scope.width,
          height: $scope.height,
          color: $scope.color,
          stroke_color: $scope.strokeColor,
          stroke_width: $scope.strokeWidth,
          y_guide: $scope.yGuide,
          y_guides: $scope.yGuides
        });
        $scope.$on('$destroy', function () {
          return $scope.$shart.destroy();
        });
      }
    };
  }).directive('shartPie', function () {
    return {
      restrict: 'E',

      scope: {
        data: '=',
        size: '='
      },

      link: function link($scope, $element) {
        $scope.$shart = Shart.Pie($element[0], $scope.data, {
          size: $scope.size
        });
        $scope.$on('$destroy', function () {
          return $scope.$shart.destroy();
        });
      }
    };
  }).directive('shartDonut', function () {
    return {
      restrict: 'E',

      scope: {
        data: '=',
        label: '@',
        labelPosition: '@',
        value: '=',
        size: '=',
        type: '@'
      },

      link: function link($scope, $element) {
        $scope.$shart = Shart.Donut($element[0], $scope.data, {
          type: $scope.type || false,
          label: $scope.label,
          label_position: $scope.labelPosition,
          value: $scope.value,
          size: $scope.size
        });
        $scope.$on('$destroy', function () {
          return $scope.$shart.destroy();
        });
      }
    };
  }).directive('shartDonutStack', function () {
    return {
      restrict: 'E',

      scope: {
        data: '=',
        total: '=',
        labelSubtext: '@',
        thickness: '='
      },

      link: function link($scope, $element) {
        $scope.$shart = Shart.DonutStack($element[0], $scope.data, {
          total: $scope.total,
          label_subtext: $scope.labelSubtext,
          thickness: $scope.thickness
        });
        $scope.$on('$destroy', function () {
          return $scope.$shart.destroy();
        });
      }
    };
  }).directive('shartHorizontalBar', function () {
    return {
      restrict: 'E',

      scope: {
        data: '=',
        percentages: '='
      },

      link: function link($scope, $element) {
        $scope.$shart = Shart.HorizontalBar($element[0], $scope.data, {
          percentages: $scope.percentages
        });
        $scope.$on('$destroy', function () {
          return $scope.$shart.destroy();
        });
      }
    };
  }).directive('shartPipeline', function () {
    return {
      restrict: 'E',

      scope: {
        data: '='
      },

      link: function link($scope, $element) {
        // TODO: opts { colors, tooltip, formatter }
        $scope.shart = Shart.Pipeline($element[0], $scope.data, {});
        $scope.$on('$destroy', function () {
          return $scope.$shart.destroy();
        });
      }
    };
  });
}

}();