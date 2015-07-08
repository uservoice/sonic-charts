;(function(window, undefined) {
/* globals angular, Shart */

angular.module('shart', [])

.directive('shartPie', function() {
  return {
    restrict: 'E',

    scope: {
      data: '=',
      width: '=',
      height: '='
    },

    link: function($scope, $element) {
      Shart.Pie(
        $element[0],
        $scope.data,
        { width: $scope.width, height: $scope.height }
      );
    }
  };
})

;

})(window);
