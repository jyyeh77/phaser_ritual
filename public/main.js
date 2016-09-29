'use strict';

window.app = angular.module('Ritual', ['fsaPreBuilt', 'ui.router', 'ui.bootstrap', 'ngAnimate']);

app.config(function ($urlRouterProvider, $locationProvider) {
  // This turns off hashbang urls (/#about) and changes it to something normal (/about)
  $locationProvider.html5Mode(true);
  // If we go to a URL that ui-router doesn't have registered, go to the "/" url.
  $urlRouterProvider.otherwise('/');
  // Trigger page refresh when accessing an OAuth route
  $urlRouterProvider.when('/auth/:provider', function () {
    window.location.reload();
  });
});

// This app.run is for controlling access to specific states.
app.run(function ($rootScope, AuthService, $state) {
  // The given state requires an authenticated user.
  var destinationStateRequiresAuth = function destinationStateRequiresAuth(state) {
    return state.data && state.data.authenticate;
  };

  // $stateChangeStart is an event fired
  // whenever the process of changing a state begins.
  $rootScope.$on('$stateChangeStart', function (event, toState, toParams) {
    if (!destinationStateRequiresAuth(toState)) {
      // The destination state does not require authentication
      // Short circuit with return.
      return;
    }

    if (AuthService.isAuthenticated()) {
      // The user is authenticated.
      // Short circuit with return.
      return;
    }

    // Cancel navigating to new state.
    event.preventDefault();

    AuthService.getLoggedInUser().then(function (user) {
      // If a user is retrieved, then renavigate to the destination
      // (the second time, AuthService.isAuthenticated() will work)
      // otherwise, if no user is logged in, go to "login" state.
      if (user) {
        $state.go(toState.name, toParams);
      } else {
        $state.go('login');
      }
    });
  });
});

app.config(function ($stateProvider) {
  $stateProvider.state('master.navbar.docs', {
    url: '/docs',
    templateUrl: 'js/docs/docs.html'
  });
});(function () {
  'use strict';

  // Hope you didn't forget Angular! Duh-doy.

  if (!window.angular) throw new Error("I can't find Angular!");

  var app = angular.module('fsaPreBuilt', []);

  app.factory('Socket', function () {
    if (!window.io) throw new Error('socket.io not found!');
    return window.io(window.location.origin);
  });

  // AUTH_EVENTS is used throughout our app to
  // broadcast and listen from and to the $rootScope
  // for important events about authentication flow.
  app.constant('AUTH_EVENTS', {
    loginSuccess: 'auth-login-success',
    loginFailed: 'auth-login-failed',
    logoutSuccess: 'auth-logout-success',
    sessionTimeout: 'auth-session-timeout',
    notAuthenticated: 'auth-not-authenticated',
    notAuthorized: 'auth-not-authorized'
  });

  app.factory('AuthInterceptor', function ($rootScope, $q, AUTH_EVENTS) {
    var statusDict = {
      401: AUTH_EVENTS.notAuthenticated,
      403: AUTH_EVENTS.notAuthorized,
      419: AUTH_EVENTS.sessionTimeout,
      440: AUTH_EVENTS.sessionTimeout
    };
    return {
      responseError: function responseError(response) {
        $rootScope.$broadcast(statusDict[response.status], response);
        return $q.reject(response);
      }
    };
  });

  app.config(function ($httpProvider) {
    $httpProvider.interceptors.push(['$injector', function ($injector) {
      return $injector.get('AuthInterceptor');
    }]);
  });

  app.service('AuthService', function ($http, Session, $rootScope, AUTH_EVENTS, $q) {
    function onSuccessfulLogin(response) {
      var data = response.data;
      Session.create(data.id, data.user);
      $rootScope.$broadcast(AUTH_EVENTS.loginSuccess);
      return data.user;
    }

    // Uses the session factory to see if an
    // authenticated user is currently registered.
    this.isAuthenticated = function () {
      return !!Session.user;
    };

    this.getLoggedInUser = function (fromServer) {
      // If an authenticated session exists, we
      // return the user attached to that session
      // with a promise. This ensures that we can
      // always interface with this method asynchronously.

      // Optionally, if true is given as the fromServer parameter,
      // then this cached value will not be used.

      if (this.isAuthenticated() && fromServer !== true) {
        return $q.when(Session.user);
      }

      // Make request GET /session.
      // If it returns a user, call onSuccessfulLogin with the response.
      // If it returns a 401 response, we catch it and instead resolve to null.
      return $http.get('/session').then(onSuccessfulLogin).catch(function () {
        return null;
      });
    };

    this.login = function (credentials) {
      return $http.post('/login', credentials).then(onSuccessfulLogin).catch(function () {
        return $q.reject({ message: 'Invalid login credentials.' });
      });
    };

    this.logout = function () {
      return $http.get('/logout').then(function () {
        Session.destroy();
        $rootScope.$broadcast(AUTH_EVENTS.logoutSuccess);
      });
    };
  });

  app.service('Session', function ($rootScope, AUTH_EVENTS) {
    var self = this;

    $rootScope.$on(AUTH_EVENTS.notAuthenticated, function () {
      self.destroy();
    });

    $rootScope.$on(AUTH_EVENTS.sessionTimeout, function () {
      self.destroy();
    });

    this.id = null;
    this.user = null;

    this.create = function (sessionId, user) {
      this.id = sessionId;
      this.user = user;
    };

    this.destroy = function () {
      this.id = null;
      this.user = null;
    };
  });
})();

app.config(function ($stateProvider) {
  $stateProvider.state('master.navbar.home', {
    url: '/',
    templateUrl: 'js/home/home.html'
  });
});

app.controller('LoginCtrl', function ($scope, AuthService, $state) {
  $scope.login = {};
  $scope.error = null;

  $scope.sendLogin = function (loginInfo) {
    $scope.error = null;

    AuthService.login(loginInfo).then(function () {
      $state.go('master.navbar.tasks');
    }).catch(function () {
      $scope.error = 'Invalid login credentials.';
    });
  };
});

app.config(function ($stateProvider) {
  $stateProvider.state('master.navbar.login', {
    url: '/login',
    templateUrl: 'js/login/login.html',
    controller: 'LoginCtrl'
  });
});

app.config(function ($stateProvider) {
  $stateProvider.state('master', {
    templateUrl: 'js/master/master.html',
    controller: function controller($scope, $state) {
      $state.go('master.navbar.home');
    }
  });
});

app.config(function ($stateProvider) {
  $stateProvider.state('membersOnly', {
    url: '/members-area',
    template: '<img ng-repeat="item in stash" width="300" ng-src="{{ item }}" />',
    controller: function controller($scope, SecretStash) {
      SecretStash.getStash().then(function (stash) {
        $scope.stash = stash;
      });
    },
    // The following data.authenticate is read by an event listener
    // that controls access to this state. Refer to app.js.
    data: {
      authenticate: true
    }
  });
});

app.factory('SecretStash', function ($http) {
  var getStash = function getStash() {
    return $http.get('/api/members/secret-stash').then(function (response) {
      return response.data;
    });
  };

  return {
    getStash: getStash
  };
});

app.controller('SignupCtrl', function ($scope, AuthService, $state, SignupFactory) {
  $scope.createUser = function (signupInfo) {
    $scope.error = null;

    SignupFactory.createUser(signupInfo).then(function () {
      AuthService.login(signupInfo).then(function () {
        $state.go('master.navbar.signup-settings');
      }).catch(function () {
        $scope.error = 'Invalid login credentials.';
      });
    }).catch(function () {
      $scope.error = 'Could not create account.';
    });
  };
});

'use strict';

app.directive('equals', function () {
  return {
    restrict: 'A', // only activate on element attribute
    require: '?ngModel', // get a hold of NgModelController
    link: function link(scope, elem, attrs, ngModel) {
      if (!ngModel) return; // do nothing if no ng-model

      // watch own value and re-validate on change
      scope.$watch(attrs.ngModel, function () {
        validate();
      });

      // observe the other value and re-validate on change
      attrs.$observe('equals', function (val) {
        validate();
      });

      var validate = function validate() {
        // values
        var val1 = ngModel.$viewValue;
        var val2 = attrs.equals;

        // set validity
        ngModel.$setValidity('equals', !val1 || !val2 || val1 === val2);
      };
    }
  };
});

app.factory('SignupFactory', function ($http, $log, $q) {
  return {
    createUser: function createUser(signupInfo) {
      return $http.post('/api/signup', signupInfo).then(function () {
        return $q.resolve({ message: 'User created!' });
      }).catch(function () {
        return $q.resolve({ message: 'Unable to create user.' });
      });
    }
  };
});

app.config(function ($stateProvider) {
  $stateProvider.state('master.navbar.signup', {
    url: '/signup',
    templateUrl: 'js/signup/signup.html',
    controller: 'SignupCtrl'
  });
});

app.controller('SignupSettingsCtrl', function ($scope, AuthService, $state, SignupSettingsFactory) {
  $scope.week = [{ selected: false, name: 'Mo', number: 0 }, { selected: false, name: 'Tu', number: 1 }, { selected: false, name: 'We', number: 2 }, { selected: false, name: 'Th', number: 3 }, { selected: false, name: 'Fr', number: 4 }, { selected: false, name: 'Sa', number: 5 }, { selected: false, name: 'Su', number: 6 }];

  $scope.isOptionsRequired = function () {
    return $scope.week.some(function (options) {
      return options.selected;
    });
  };

  $scope.createSettings = function (settingsInfo) {
    var myWorkdays = [];

    $scope.week.forEach(function (elem) {
      if (elem.selected === true) {
        myWorkdays.push(elem.number);
      }
    });

    var toBeSent = {
      waketime: settingsInfo.waketime + ' AM',
      workdays: myWorkdays
    };

    SignupSettingsFactory.createSettings(toBeSent).then(function (createdSettings) {
      $state.go('master.navbar.tasks');
    }).catch(function () {
      $scope.error = 'Could not create settings.';
      console.log('Error creating task.');
    });
  };
});

app.factory('SignupSettingsFactory', function ($http, $log, $q) {
  return {
    createSettings: function createSettings(settingsInfo) {
      return $http.post('/api/settings', settingsInfo).then(function () {
        return $q.resolve({ message: 'Settings created!' });
      }).catch(function () {
        return $q.resolve({ message: 'Unable to create settings.' });
      });
    }
  };
});

app.config(function ($stateProvider) {
  $stateProvider.state('master.navbar.signup-settings', {
    url: '/signup-settings',
    templateUrl: 'js/signup-settings/signup-settings.html',
    controller: 'SignupSettingsCtrl'
  });
});

app.directive('footer', function ($rootScope, AuthService, AUTH_EVENTS, $state) {
  return {
    restrict: 'E',
    scope: {},
    templateUrl: 'js/common/directives/footer/footer.html',
    link: function link(scope) {}
  };
});

// testing for phaser

var createGame = function createGame(ele, scope, players, mapId, injector) {
  var game = new Phaser.Game(960, 600, Phaser.CANVAS, 'gameCanvas', { preload: preload, create: create, update: update, render: render });
  // The walk through: Make new pseudo-iframe object. The world and camera have a width, height of 960, 600
  // My parent div is phaser-example
  // My preload function is titled preload, create: create, update: update, and render: render

  function preload() {
    game.stage.backgroundColor = '#76bcbb';
    // game.load.image('mushroom', 'pimages/star.png')
    game.load.tilemap('map', 'pmaps/bunkerv1.json', null, Phaser.Tilemap.TILED_JSON);
    game.load.image('tiles', 'pmaps/tmw_desert_spacing.png');
    game.load.image('tiles2', 'pmaps/sewer_tileset.png');
    game.load.spritesheet('player', 'pimages/dude.png', 32, 48);
  }
  // Set bg color behind all elements in this frame
  // Load my tilemap - a json that can be found in assets - that is essentially a matrix of png elements
  // load the sheets of png's that this map uses
  // Now load the 'spritesheet' the image that is the character - it has nine frames - 4 right, 4 left, 1 standing still

  var cursors;
  var o_camera;
  var cameraDrag = 5;
  var cameraAccel = 3;
  var camVelX = 0;
  var camVelY = 0;
  var camMaxSpeed = 80;
  var map;
  var layer, layer2, layer3, layer4;
  var tile;
  var log;
  var tileUp = false;
  var player;
  var marker;
  var leftKey, rightKey;
  // declare semi globals - figure it out

  function create() {
    game.physics.startSystem(Phaser.Physics.ARCADE);
    // Multiple systems of physics, this is the simplest.

    map = game.add.tilemap('map');
    map.addTilesetImage('bunkerv2', 'tiles');
    map.addTilesetImage('sewer_tileset', 'tiles2');
    layer3 = map.createLayer('Bounds');
    layer = map.createLayer('Ground');
    layer2 = map.createLayer('Bunker');
    layer2;
    layer4 = map.createLayer('Interactive');
    // Add all the elements we preloaded.
    // The tilemap has layers - the bunker, its bg, and what the player collides with - check out Tiled
    game.world.setBounds(0, 0, 960, 3040);
    game.world.resize(960, 3040);
    // Sets the physics bounds of the world - startx, starty, maxx, maxy

    marker = game.add.graphics();
    marker.lineStyle(2, 0xffffff, 1);
    marker.drawRect(0, 0, 32, 32);
    // Create the things that allow us to select tiles

    game.input.addMoveCallback(updateMarker, this);
    // What happens when i move the mouse? Add a listener and bind this

    map.setCollision(55, true, layer3);
    map.setCollision(64, false, layer4);
    map.setTileIndexCallback(64, moveDown, this, layer4);
    map.setTileIndexCallback(65, moveUp, this, layer4);
    // OKAY understandably confusing if you are not familiar with game design.
    // The engine is running a collision engine. The TLDR is that velocity is set to 0 upon interaction with above.
    // 55 is the EXACT tile this applies to.
    // TRUE is STOP MOVING - FALSE is RECORD COLLISION BUT DO NOT STOP MOVING - IT ONLY APPLIES TO THE COLLISION LAYER
    // the last two lines, implement staircase functionality.

    /*
     for (var i = 0; i < 100; i++)
     {
     game.add.sprite(game.world.randomX, game.world.randomY, 'mushroom')
     }
     //Bullshit
      game.add.text(300, 300, "- Bunker Test -", { font: "32px Arial", fill: "#330088", align: "center" })
     game.add.text(300, 350, "Up Arrow, Down Arrow", { font: "32px Arial", fill: "#330088", align: "center" })
     game.add.text(300, 400, "Mouse Drag/Touch", { font: "32px Arial", fill: "#330088", align: "center" })
     //Early testing stuff
     */
    var g = game.add.group();
    g.x = 500;
    // Disregard - may be used later.

    cursors = game.input.keyboard.createCursorKeys();
    // Create input keys - aka ASCII abstraction - removes their ability to be used by DOM
    game.inputEnabled = true;
    game.input.onDown.add(logTile, this);
    // OKAY - input enabled is 1/2 things for touch enabled. May not work yet.
    // game.input = mouse
    // onDown = event
    // add = addListener function
    // logTile - the listener function
    // bind this

    player = game.add.sprite(32, 280, 'player');
    // Add the player spritesheet - it has 32, 32 dimensions

    game.physics.enable(player);
    // Physics apply to this element

    game.physics.arcade.gravity.y = 250;
    // This is how intensely y grid physics apply

    player.body.linearDamping = 1;
    // Damp the effects of physics misc functions 100%
    player.body.collideWorldBounds = true;
    // I cannot escape world boundaries
    player.body.checkCollision.right = true;
    // I follow the rules of walls to the right
    player.body.checkCollision.left = true;
    // I follow the rules of walls to the left

    player.animations.add('left', [0, 1, 2, 3], 10, true);
    player.animations.add('right', [5, 6, 7, 8], 10, true);
    // Name animation, what frames is this animation, at what FPS, do I idle otherwise?

    leftKey = game.input.keyboard.addKey(Phaser.Keyboard.LEFT);
    rightKey = game.input.keyboard.addKey(Phaser.Keyboard.RIGHT);
    // Alias keys - didnt work otherwise, dont ask.
  }

  function update() {
    game.physics.arcade.collide(player, layer3);
    game.physics.arcade.collide(player, layer4);
    // The only layer of the map i collide with is layer 3 - and based on above - tile 55 of layer 3
    player.body.velocity.x = 0;
    // Every 1/60 frame, reset x velocity

    if (leftKey.isDown) {
      //  Move to the left
      player.body.velocity.x = -150;
      // by this much

      player.animations.play('left');
      // animate this
    } else {
      if (rightKey.isDown) {
        //  Move to the right
        player.body.velocity.x = 150;
        // by this much

        player.animations.play('right');
        // animate this
      } else {
        player.animations.stop();
        // otherwise, standstill

        player.frame = 4;
        // at this frame
      }
    }
    if (cursors.up.isDown) {
      // Move world up
      game.camera.y -= 4;
      // by this much
    } else {
      if (cursors.down.isDown) {
        // move world down
        game.camera.y += 4;
        // by this much
      }
    }
    drag_camera(game.input.mousePointer);
    drag_camera(game.input.pointer1);
    update_camera();
    // Monitor mouse/touch world movement
  }

  function render() {
    game.debug.cameraInfo(game.camera, 32, 32);
    // Show camera info
    game.debug.text('Tile Info: ' + log, 32, 570);
    // Show selected tile
  }

  // Experimental staircase function
  function moveDown() {
    console.log('Attempting to teleport down!');
    if (player.body.x > game.world.width / 2) {
      player.body.x = player.body.x - 32;
    } else {
      player.body.x = player.body.x + 32;
    }
    player.body.y = player.body.y + 32 * 7;
    if (player.body.y > game.camera.y + game.camera.height - 96) {
      game.camera.y += game.camera.height / 2;
    }
  }

  //
  function moveUp() {
    console.log('Attempting to teleport!');
    if (player.body.x > game.world.width / 2) {
      player.body.x = player.body.x - 32;
    } else {
      player.body.x = player.body.x + 32;
    }
    player.body.y = player.body.y - 32 * 7;
    if (player.body.y < game.camera.y + 96) {
      game.camera.y -= game.camera.height / 2;
    }
  }

  function logTile() {
    var tileR = getTileProperties();
    // Grab selected tile info
    console.log('Tile R: ');
    console.log(tileR);
    if (Number(tileR.index) > 63) {
      tileUp = false;
      // Arbitrary #, but start counting down if above this - needs work
    } else {
      if (Number(tileR.index) < 1) {
        tileUp = true;
        // Arbitrary #, but start counting up if below this - needs work
      }
    }
    var nextTile = void 0;
    if (tileUp) {
      nextTile = Number(tileR.index) + 1;
    } else {
      nextTile = Number(tileR.index) - 1;
    }
    // Move in x direction
    map.removeTile(tileR.x, tileR.y, layer3).destroy();
    map.putTile(nextTile, tileR.x, tileR.y, layer3);
    // Self-explanatory - remove selected tile - move in decided direction
  }

  function drag_camera(o_pointer) {
    if (!o_pointer.timeDown) {
      // If click isnt longer than a click
      return;
    }
    if (o_pointer.isDown && !o_pointer.targetObject) {
      // If ive stayed down, and this isnt one of my target objects ala exception cases
      if (o_camera) {
        camVelX = (o_camera.x - o_pointer.position.x) * cameraAccel;
        camVelY = (o_camera.y - o_pointer.position.y) * cameraAccel;
        // Figure out diff - multiply by accel
      }
      o_camera = o_pointer.position.clone();
      // else were the same mofucka
    }

    if (o_pointer.isUp) {
      o_camera = null;
    }
    // If nothings going on, no deal
  }

  function getTileProperties() {
    var x = layer3.getTileX(game.input.activePointer.worldX);
    var y = layer3.getTileY(game.input.activePointer.worldY);
    // find the tile location based on mouse location (diff x, y vals)

    tile = map.getTile(x, y, layer3);
    // Grab tile objects based on these
    console.log(tile);
    log = tile.index;
    // Set semi-glob to this
    console.log({ x: x, y: y, index: tile.index });
    // Return object with pertinent data
    return { x: x, y: y, index: tile.index };
  }

  // Not worth getting too into - essentially the physics of moving camera via mouse.
  // Mix of old games ive made and online stuff. Live with other peoples work. it works.
  // May need some work for touch enabled.
  function update_camera() {
    camVelX = clamp(camVelX, camMaxSpeed, -camMaxSpeed);
    camVelY = clamp(camVelY, camMaxSpeed, -camMaxSpeed);

    game.camera.x += camVelX;
    game.camera.y += camVelY;

    // Set Camera Velocity X Drag
    if (camVelX > cameraDrag) {
      camVelX -= cameraDrag;
    } else if (camVelX < -cameraDrag) {
      camVelX += cameraDrag;
    } else {
      camVelX = 0;
    }

    // Set Camera Velocity Y Drag
    if (camVelY > cameraDrag) {
      camVelY -= cameraDrag;
    } else if (camVelY < -cameraDrag) {
      camVelY += cameraDrag;
    } else {
      camVelY = 0;
    }
  }

  function updateMarker() {
    marker.x = layer.getTileX(game.input.activePointer.worldX) * 32;
    marker.y = layer.getTileY(game.input.activePointer.worldY) * 32;
  }

  function clamp(val, max, min) {
    var value = val;

    if (value > max) value = max;else if (value < min) value = min;

    return value;
  }
};

// custom directive to link phaser object to angular

app.directive('gameCanvas', function ($injector, GameFactory) {
  var linkFn = function linkFn(scope, ele, attrs) {
    scope.scream = function () {
      console.log('SCREEEEAAAAAAMING!');
      console.log(scope.players.name);
    };
    createGame(ele, scope, scope.players, scope.mapId, $injector);
    console.log('INSIDE PARENT DIRECTIVE: ', scope.players.name);
    console.log('INSIDE PARENT DIRECTIVE: ', scope);
  };

  return {
    scope: {
      players: '=',
      mapId: '='
    },
    template: '<div id="gameCanvas"></div>',
    link: linkFn
  };
});

app.directive('navbar', function ($rootScope, Socket, AuthService, AUTH_EVENTS, $state) {
  return {
    restrict: 'E',
    scope: {},
    templateUrl: 'js/common/directives/navbar/navbar.html',
    link: function link(scope) {
      scope.items = [{ label: 'Account Settings', state: 'master.navbar.signup-settings', auth: true }, { label: 'Tasks', state: 'master.navbar.tasks', auth: true }];

      scope.user = null;

      $rootScope.socket = Socket;

      scope.isLoggedIn = function () {
        return AuthService.isAuthenticated();
      };

      scope.logout = function () {
        AuthService.logout().then(function () {
          $state.go('master.navbar.home');
        });
      };

      var setUser = function setUser() {
        AuthService.getLoggedInUser().then(function (user) {
          scope.user = user;
          if (user) $state.go('master.navbar.tasks');
        });
      };

      var removeUser = function removeUser() {
        scope.user = null;
      };

      setUser();

      $rootScope.$on(AUTH_EVENTS.loginSuccess, setUser);
      $rootScope.$on(AUTH_EVENTS.logoutSuccess, removeUser);
      $rootScope.$on(AUTH_EVENTS.sessionTimeout, removeUser);
    }

  };
});

app.config(function ($stateProvider) {
  $stateProvider.state('master.navbar', {
    templateUrl: 'js/common/directives/navbar/navbar-state.html',
    controller: function controller($state, $scope) {
      $state.go('master.navbar.home');
    }
  });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImRvY3MvZG9jcy5zdGF0ZS5qcyIsImZzYS9mc2EtcHJlLWJ1aWx0LmpzIiwiaG9tZS9ob21lLnN0YXRlLmpzIiwibG9naW4vbG9naW4uY29udHJvbGxlci5qcyIsImxvZ2luL2xvZ2luLnN0YXRlLmpzIiwibWFzdGVyL21hc3Rlci5zdGF0ZS5qcyIsIm1lbWJlcnMtb25seS9tZW1iZXJzLW9ubHkuanMiLCJzaWdudXAvc2lnbnVwLmNvbnRyb2xsZXIuanMiLCJzaWdudXAvc2lnbnVwLmRpcmVjdGl2ZS5qcyIsInNpZ251cC9zaWdudXAuZmFjdG9yeS5qcyIsInNpZ251cC9zaWdudXAuc3RhdGUuanMiLCJzaWdudXAtc2V0dGluZ3Mvc2lnbnVwLnNldHRpbmdzLmNvbnRyb2xsZXIuanMiLCJzaWdudXAtc2V0dGluZ3Mvc2lnbnVwLnNldHRpbmdzLmZhY3RvcnkuanMiLCJzaWdudXAtc2V0dGluZ3Mvc2lnbnVwLnNldHRpbmdzLnN0YXRlLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvZm9vdGVyL2Zvb3Rlci5kaXJlY3RpdmUuanMiLCJjb21tb24vZGlyZWN0aXZlcy9nYW1lLWNhbnZhcy9nYW1lX2NhbnZhcy5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuZGlyZWN0aXZlLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvbmF2YmFyL25hdmJhci5zdGF0ZS5qcyJdLCJuYW1lcyI6WyJ3aW5kb3ciLCJhcHAiLCJhbmd1bGFyIiwibW9kdWxlIiwiY29uZmlnIiwiJHVybFJvdXRlclByb3ZpZGVyIiwiJGxvY2F0aW9uUHJvdmlkZXIiLCJodG1sNU1vZGUiLCJvdGhlcndpc2UiLCJ3aGVuIiwibG9jYXRpb24iLCJyZWxvYWQiLCJydW4iLCIkcm9vdFNjb3BlIiwiQXV0aFNlcnZpY2UiLCIkc3RhdGUiLCJkZXN0aW5hdGlvblN0YXRlUmVxdWlyZXNBdXRoIiwic3RhdGUiLCJkYXRhIiwiYXV0aGVudGljYXRlIiwiJG9uIiwiZXZlbnQiLCJ0b1N0YXRlIiwidG9QYXJhbXMiLCJpc0F1dGhlbnRpY2F0ZWQiLCJwcmV2ZW50RGVmYXVsdCIsImdldExvZ2dlZEluVXNlciIsInRoZW4iLCJ1c2VyIiwiZ28iLCJuYW1lIiwiJHN0YXRlUHJvdmlkZXIiLCJ1cmwiLCJ0ZW1wbGF0ZVVybCIsIkVycm9yIiwiZmFjdG9yeSIsImlvIiwib3JpZ2luIiwiY29uc3RhbnQiLCJsb2dpblN1Y2Nlc3MiLCJsb2dpbkZhaWxlZCIsImxvZ291dFN1Y2Nlc3MiLCJzZXNzaW9uVGltZW91dCIsIm5vdEF1dGhlbnRpY2F0ZWQiLCJub3RBdXRob3JpemVkIiwiJHEiLCJBVVRIX0VWRU5UUyIsInN0YXR1c0RpY3QiLCJyZXNwb25zZUVycm9yIiwicmVzcG9uc2UiLCIkYnJvYWRjYXN0Iiwic3RhdHVzIiwicmVqZWN0IiwiJGh0dHBQcm92aWRlciIsImludGVyY2VwdG9ycyIsInB1c2giLCIkaW5qZWN0b3IiLCJnZXQiLCJzZXJ2aWNlIiwiJGh0dHAiLCJTZXNzaW9uIiwib25TdWNjZXNzZnVsTG9naW4iLCJjcmVhdGUiLCJpZCIsImZyb21TZXJ2ZXIiLCJjYXRjaCIsImxvZ2luIiwiY3JlZGVudGlhbHMiLCJwb3N0IiwibWVzc2FnZSIsImxvZ291dCIsImRlc3Ryb3kiLCJzZWxmIiwic2Vzc2lvbklkIiwiY29udHJvbGxlciIsIiRzY29wZSIsImVycm9yIiwic2VuZExvZ2luIiwibG9naW5JbmZvIiwidGVtcGxhdGUiLCJTZWNyZXRTdGFzaCIsImdldFN0YXNoIiwic3Rhc2giLCJTaWdudXBGYWN0b3J5IiwiY3JlYXRlVXNlciIsInNpZ251cEluZm8iLCJkaXJlY3RpdmUiLCJyZXN0cmljdCIsInJlcXVpcmUiLCJsaW5rIiwic2NvcGUiLCJlbGVtIiwiYXR0cnMiLCJuZ01vZGVsIiwiJHdhdGNoIiwidmFsaWRhdGUiLCIkb2JzZXJ2ZSIsInZhbCIsInZhbDEiLCIkdmlld1ZhbHVlIiwidmFsMiIsImVxdWFscyIsIiRzZXRWYWxpZGl0eSIsIiRsb2ciLCJyZXNvbHZlIiwiU2lnbnVwU2V0dGluZ3NGYWN0b3J5Iiwid2VlayIsInNlbGVjdGVkIiwibnVtYmVyIiwiaXNPcHRpb25zUmVxdWlyZWQiLCJzb21lIiwib3B0aW9ucyIsImNyZWF0ZVNldHRpbmdzIiwic2V0dGluZ3NJbmZvIiwibXlXb3JrZGF5cyIsImZvckVhY2giLCJ0b0JlU2VudCIsIndha2V0aW1lIiwid29ya2RheXMiLCJjcmVhdGVkU2V0dGluZ3MiLCJjb25zb2xlIiwibG9nIiwiY3JlYXRlR2FtZSIsImVsZSIsInBsYXllcnMiLCJtYXBJZCIsImluamVjdG9yIiwiZ2FtZSIsIlBoYXNlciIsIkdhbWUiLCJDQU5WQVMiLCJwcmVsb2FkIiwidXBkYXRlIiwicmVuZGVyIiwic3RhZ2UiLCJiYWNrZ3JvdW5kQ29sb3IiLCJsb2FkIiwidGlsZW1hcCIsIlRpbGVtYXAiLCJUSUxFRF9KU09OIiwiaW1hZ2UiLCJzcHJpdGVzaGVldCIsImN1cnNvcnMiLCJvX2NhbWVyYSIsImNhbWVyYURyYWciLCJjYW1lcmFBY2NlbCIsImNhbVZlbFgiLCJjYW1WZWxZIiwiY2FtTWF4U3BlZWQiLCJtYXAiLCJsYXllciIsImxheWVyMiIsImxheWVyMyIsImxheWVyNCIsInRpbGUiLCJ0aWxlVXAiLCJwbGF5ZXIiLCJtYXJrZXIiLCJsZWZ0S2V5IiwicmlnaHRLZXkiLCJwaHlzaWNzIiwic3RhcnRTeXN0ZW0iLCJQaHlzaWNzIiwiQVJDQURFIiwiYWRkIiwiYWRkVGlsZXNldEltYWdlIiwiY3JlYXRlTGF5ZXIiLCJ3b3JsZCIsInNldEJvdW5kcyIsInJlc2l6ZSIsImdyYXBoaWNzIiwibGluZVN0eWxlIiwiZHJhd1JlY3QiLCJpbnB1dCIsImFkZE1vdmVDYWxsYmFjayIsInVwZGF0ZU1hcmtlciIsInNldENvbGxpc2lvbiIsInNldFRpbGVJbmRleENhbGxiYWNrIiwibW92ZURvd24iLCJtb3ZlVXAiLCJnIiwiZ3JvdXAiLCJ4Iiwia2V5Ym9hcmQiLCJjcmVhdGVDdXJzb3JLZXlzIiwiaW5wdXRFbmFibGVkIiwib25Eb3duIiwibG9nVGlsZSIsInNwcml0ZSIsImVuYWJsZSIsImFyY2FkZSIsImdyYXZpdHkiLCJ5IiwiYm9keSIsImxpbmVhckRhbXBpbmciLCJjb2xsaWRlV29ybGRCb3VuZHMiLCJjaGVja0NvbGxpc2lvbiIsInJpZ2h0IiwibGVmdCIsImFuaW1hdGlvbnMiLCJhZGRLZXkiLCJLZXlib2FyZCIsIkxFRlQiLCJSSUdIVCIsImNvbGxpZGUiLCJ2ZWxvY2l0eSIsImlzRG93biIsInBsYXkiLCJzdG9wIiwiZnJhbWUiLCJ1cCIsImNhbWVyYSIsImRvd24iLCJkcmFnX2NhbWVyYSIsIm1vdXNlUG9pbnRlciIsInBvaW50ZXIxIiwidXBkYXRlX2NhbWVyYSIsImRlYnVnIiwiY2FtZXJhSW5mbyIsInRleHQiLCJ3aWR0aCIsImhlaWdodCIsInRpbGVSIiwiZ2V0VGlsZVByb3BlcnRpZXMiLCJOdW1iZXIiLCJpbmRleCIsIm5leHRUaWxlIiwicmVtb3ZlVGlsZSIsInB1dFRpbGUiLCJvX3BvaW50ZXIiLCJ0aW1lRG93biIsInRhcmdldE9iamVjdCIsInBvc2l0aW9uIiwiY2xvbmUiLCJpc1VwIiwiZ2V0VGlsZVgiLCJhY3RpdmVQb2ludGVyIiwid29ybGRYIiwiZ2V0VGlsZVkiLCJ3b3JsZFkiLCJnZXRUaWxlIiwiY2xhbXAiLCJtYXgiLCJtaW4iLCJ2YWx1ZSIsIkdhbWVGYWN0b3J5IiwibGlua0ZuIiwic2NyZWFtIiwiU29ja2V0IiwiaXRlbXMiLCJsYWJlbCIsImF1dGgiLCJzb2NrZXQiLCJpc0xvZ2dlZEluIiwic2V0VXNlciIsInJlbW92ZVVzZXIiXSwibWFwcGluZ3MiOiJBQUFBOztBQUNBQSxPQUFBQyxHQUFBLEdBQUFDLFFBQUFDLE1BQUEsQ0FBQSxRQUFBLEVBQUEsQ0FBQSxhQUFBLEVBQUEsV0FBQSxFQUFBLGNBQUEsRUFBQSxXQUFBLENBQUEsQ0FBQTs7QUFFQUYsSUFBQUcsTUFBQSxDQUFBLFVBQUFDLGtCQUFBLEVBQUFDLGlCQUFBLEVBQUE7QUFDQTtBQUNBQSxvQkFBQUMsU0FBQSxDQUFBLElBQUE7QUFDQTtB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QUFDQSxTQUhBO0FBSUEsT0FMQTs7QUFPQSxVQUFBa08sYUFBQSxTQUFBQSxVQUFBLEdBQUE7QUFDQXJLLGNBQUE5RCxJQUFBLEdBQUEsSUFBQTtBQUNBLE9BRkE7O0FBSUFrTzs7QUFFQWpQLGlCQUFBTyxHQUFBLENBQUEwQixZQUFBUCxZQUFBLEVBQUF1TixPQUFBO0FBQ0FqUCxpQkFBQU8sR0FBQSxDQUFBMEIsWUFBQUwsYUFBQSxFQUFBc04sVUFBQTtBQUNBbFAsaUJBQUFPLEdBQUEsQ0FBQTBCLFlBQUFKLGNBQUEsRUFBQXFOLFVBQUE7QUFDQTs7QUF4Q0EsR0FBQTtBQTJDQSxDQTVDQTs7QUNBQTlQLElBQUFHLE1BQUEsQ0FBQSxVQUFBMkIsY0FBQSxFQUFBO0FBQ0FBLGlCQUFBZCxLQUFBLENBQUEsZUFBQSxFQUFBO0FBQ0FnQixpQkFBQSwrQ0FEQTtBQUVBeUMsZ0JBQUEsb0JBQUEzRCxNQUFBLEVBQUE0RCxNQUFBLEVBQUE7QUFDQTVELGFBQUFjLEVBQUEsQ0FBQSxvQkFBQTtBQUNBO0FBSkEsR0FBQTtBQU1BLENBUEEiLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0J1xud2luZG93LmFwcCA9IGFuZ3VsYXIubW9kdWxlKCdSaXR1YWwnLCBbJ2ZzYVByZUJ1aWx0JywgJ3VpLnJvdXRlcicsICd1aS5ib290c3RyYXAnLCAnbmdBbmltYXRlJ10pXG5cbmFwcC5jb25maWcoZnVuY3Rpb24gKCR1cmxSb3V0ZXJQcm92aWRlciwgJGxvY2F0aW9uUHJvdmlkZXIpIHtcbiAgLy8gVGhpcyB0dXJucyBvZmYgaGFzaGJhbmcgdXJscyAoLyNhYm91dCkgYW5kIGNoYW5nZXMgaXQgdG8gc29tZXRoaW5nIG5vcm1hbCAoL2Fib3V0KVxuICAkbG9jYXRpb25Qcm92aWRlci5odG1sNU1vZGUodHJ1ZSlcbiAgLy8gSWYgd2UgZ28gdG8gYSBVUkwgdGhhdCB1aS1yb3V0ZXIgZG9lc24ndCBoYXZlIHJlZ2lzdGVyZWQsIGdvIHRvIHRoZSBcIi9cIiB1cmwuXG4gICR1cmxSb3V0ZXJQcm92aWRlci5vdGhlcndpc2UoJy8nKVxuICAvLyBUcmlnZ2VyIHBhZ2UgcmVmcmVzaCB3aGVuIGFjY2Vzc2luZyBhbiBPQXV0aCByb3V0ZVxuICAkdXJsUm91dGVyUHJvdmlkZXIud2hlbignL2F1dGgvOnByb3ZpZGVyJywgZnVuY3Rpb24gKCkge1xuICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKVxuICB9KVxufSlcblxuLy8gVGhpcyBhcHAucnVuIGlzIGZvciBjb250cm9sbGluZyBhY2Nlc3MgdG8gc3BlY2lmaWMgc3RhdGVzLlxuYXBwLnJ1bihmdW5jdGlvbiAoJHJvb3RTY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSkge1xuICAvLyBUaGUgZ2l2ZW4gc3RhdGUgcmVxdWlyZXMgYW4gYXV0aGVudGljYXRlZCB1c2VyLlxuICB2YXIgZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgIHJldHVybiBzdGF0ZS5kYXRhICYmIHN0YXRlLmRhdGEuYXV0aGVudGljYXRlXG4gIH1cblxuICAvLyAkc3RhdGVDaGFuZ2VTdGFydCBpcyBhbiBldmVudCBmaXJlZFxuICAvLyB3aGVuZXZlciB0aGUgcHJvY2VzcyBvZiBjaGFuZ2luZyBhIHN0YXRlIGJlZ2lucy5cbiAgJHJvb3RTY29wZS4kb24oJyRzdGF0ZUNoYW5nZVN0YXJ0JywgZnVuY3Rpb24gKGV2ZW50LCB0b1N0YXRlLCB0b1BhcmFtcykge1xuICAgIGlmICghZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCh0b1N0YXRlKSkge1xuICAgICAgLy8gVGhlIGRlc3RpbmF0aW9uIHN0YXRlIGRvZXMgbm90IHJlcXVpcmUgYXV0aGVudGljYXRpb25cbiAgICAgIC8vIFNob3J0IGNpcmN1aXQgd2l0aCByZXR1cm4uXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAoQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCkpIHtcbiAgICAgIC8vIFRoZSB1c2VyIGlzIGF1dGhlbnRpY2F0ZWQuXG4gICAgICAvLyBTaG9ydCBjaXJjdWl0IHdpdGggcmV0dXJuLlxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgLy8gQ2FuY2VsIG5hdmlnYXRpbmcgdG8gbmV3IHN0YXRlLlxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcblxuICAgIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgIC8vIElmIGEgdXNlciBpcyByZXRyaWV2ZWQsIHRoZW4gcmVuYXZpZ2F0ZSB0byB0aGUgZGVzdGluYXRpb25cbiAgICAgIC8vICh0aGUgc2Vjb25kIHRpbWUsIEF1dGhTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpIHdpbGwgd29yaylcbiAgICAgIC8vIG90aGVyd2lzZSwgaWYgbm8gdXNlciBpcyBsb2dnZWQgaW4sIGdvIHRvIFwibG9naW5cIiBzdGF0ZS5cbiAgICAgIGlmICh1c2VyKSB7XG4gICAgICAgICRzdGF0ZS5nbyh0b1N0YXRlLm5hbWUsIHRvUGFyYW1zKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgJHN0YXRlLmdvKCdsb2dpbicpXG4gICAgICB9XG4gICAgfSlcbiAgfSlcbn0pXG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbWFzdGVyLm5hdmJhci5kb2NzJywge1xuICAgIHVybDogJy9kb2NzJyxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL2RvY3MvZG9jcy5odG1sJ1xuICB9KVxufSlcbiIsIjsoZnVuY3Rpb24gKCkge1xuICAndXNlIHN0cmljdCdcblxuICAvLyBIb3BlIHlvdSBkaWRuJ3QgZm9yZ2V0IEFuZ3VsYXIhIER1aC1kb3kuXG4gIGlmICghd2luZG93LmFuZ3VsYXIpIHRocm93IG5ldyBFcnJvcihcIkkgY2FuJ3QgZmluZCBBbmd1bGFyIVwiKVxuXG4gIHZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZSgnZnNhUHJlQnVpbHQnLCBbXSlcblxuICBhcHAuZmFjdG9yeSgnU29ja2V0JywgZnVuY3Rpb24gKCkge1xuICAgIGlmICghd2luZG93LmlvKSB0aHJvdyBuZXcgRXJyb3IoJ3NvY2tldC5pbyBub3QgZm91bmQhJylcbiAgICByZXR1cm4gd2luZG93LmlvKHdpbmRvdy5sb2NhdGlvbi5vcmlnaW4pXG4gIH0pXG5cbiAgLy8gQVVUSF9FVkVOVFMgaXMgdXNlZCB0aHJvdWdob3V0IG91ciBhcHAgdG9cbiAgLy8gYnJvYWRjYXN0IGFuZCBsaXN0ZW4gZnJvbSBhbmQgdG8gdGhlICRyb290U2NvcGVcbiAgLy8gZm9yIGltcG9ydGFudCBldmVudHMgYWJvdXQgYXV0aGVudGljYXRpb24gZmxvdy5cbiAgYXBwLmNvbnN0YW50KCdBVVRIX0VWRU5UUycsIHtcbiAgICBsb2dpblN1Y2Nlc3M6ICdhdXRoLWxvZ2luLXN1Y2Nlc3MnLFxuICAgIGxvZ2luRmFpbGVkOiAnYXV0aC1sb2dpbi1mYWlsZWQnLFxuICAgIGxvZ291dFN1Y2Nlc3M6ICdhdXRoLWxvZ291dC1zdWNjZXNzJyxcbiAgICBzZXNzaW9uVGltZW91dDogJ2F1dGgtc2Vzc2lvbi10aW1lb3V0JyxcbiAgICBub3RBdXRoZW50aWNhdGVkOiAnYXV0aC1ub3QtYXV0aGVudGljYXRlZCcsXG4gICAgbm90QXV0aG9yaXplZDogJ2F1dGgtbm90LWF1dGhvcml6ZWQnXG4gIH0pXG5cbiAgYXBwLmZhY3RvcnkoJ0F1dGhJbnRlcmNlcHRvcicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCAkcSwgQVVUSF9FVkVOVFMpIHtcbiAgICB2YXIgc3RhdHVzRGljdCA9IHtcbiAgICAgIDQwMTogQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCxcbiAgICAgIDQwMzogQVVUSF9FVkVOVFMubm90QXV0aG9yaXplZCxcbiAgICAgIDQxOTogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsXG4gICAgICA0NDA6IEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICByZXNwb25zZUVycm9yOiBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KHN0YXR1c0RpY3RbcmVzcG9uc2Uuc3RhdHVzXSwgcmVzcG9uc2UpXG4gICAgICAgIHJldHVybiAkcS5yZWplY3QocmVzcG9uc2UpXG4gICAgICB9XG4gICAgfVxuICB9KVxuXG4gIGFwcC5jb25maWcoZnVuY3Rpb24gKCRodHRwUHJvdmlkZXIpIHtcbiAgICAkaHR0cFByb3ZpZGVyLmludGVyY2VwdG9ycy5wdXNoKFtcbiAgICAgICckaW5qZWN0b3InLFxuICAgICAgZnVuY3Rpb24gKCRpbmplY3Rvcikge1xuICAgICAgICByZXR1cm4gJGluamVjdG9yLmdldCgnQXV0aEludGVyY2VwdG9yJylcbiAgICAgIH1cbiAgICBdKVxuICB9KVxuXG4gIGFwcC5zZXJ2aWNlKCdBdXRoU2VydmljZScsIGZ1bmN0aW9uICgkaHR0cCwgU2Vzc2lvbiwgJHJvb3RTY29wZSwgQVVUSF9FVkVOVFMsICRxKSB7XG4gICAgZnVuY3Rpb24gb25TdWNjZXNzZnVsTG9naW4gKHJlc3BvbnNlKSB7XG4gICAgICB2YXIgZGF0YSA9IHJlc3BvbnNlLmRhdGFcbiAgICAgIFNlc3Npb24uY3JlYXRlKGRhdGEuaWQsIGRhdGEudXNlcilcbiAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChBVVRIX0VWRU5UUy5sb2dpblN1Y2Nlc3MpXG4gICAgICByZXR1cm4gZGF0YS51c2VyXG4gICAgfVxuXG4gICAgLy8gVXNlcyB0aGUgc2Vzc2lvbiBmYWN0b3J5IHRvIHNlZSBpZiBhblxuICAgIC8vIGF1dGhlbnRpY2F0ZWQgdXNlciBpcyBjdXJyZW50bHkgcmVnaXN0ZXJlZC5cbiAgICB0aGlzLmlzQXV0aGVudGljYXRlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiAhIVNlc3Npb24udXNlclxuICAgIH1cblxuICAgIHRoaXMuZ2V0TG9nZ2VkSW5Vc2VyID0gZnVuY3Rpb24gKGZyb21TZXJ2ZXIpIHtcbiAgICAgIC8vIElmIGFuIGF1dGhlbnRpY2F0ZWQgc2Vzc2lvbiBleGlzdHMsIHdlXG4gICAgICAvLyByZXR1cm4gdGhlIHVzZXIgYXR0YWNoZWQgdG8gdGhhdCBzZXNzaW9uXG4gICAgICAvLyB3aXRoIGEgcHJvbWlzZS4gVGhpcyBlbnN1cmVzIHRoYXQgd2UgY2FuXG4gICAgICAvLyBhbHdheXMgaW50ZXJmYWNlIHdpdGggdGhpcyBtZXRob2QgYXN5bmNocm9ub3VzbHkuXG5cbiAgICAgIC8vIE9wdGlvbmFsbHksIGlmIHRydWUgaXMgZ2l2ZW4gYXMgdGhlIGZyb21TZXJ2ZXIgcGFyYW1ldGVyLFxuICAgICAgLy8gdGhlbiB0aGlzIGNhY2hlZCB2YWx1ZSB3aWxsIG5vdCBiZSB1c2VkLlxuXG4gICAgICBpZiAodGhpcy5pc0F1dGhlbnRpY2F0ZWQoKSAmJiBmcm9tU2VydmVyICE9PSB0cnVlKSB7XG4gICAgICAgIHJldHVybiAkcS53aGVuKFNlc3Npb24udXNlcilcbiAgICAgIH1cblxuICAgICAgLy8gTWFrZSByZXF1ZXN0IEdFVCAvc2Vzc2lvbi5cbiAgICAgIC8vIElmIGl0IHJldHVybnMgYSB1c2VyLCBjYWxsIG9uU3VjY2Vzc2Z1bExvZ2luIHdpdGggdGhlIHJlc3BvbnNlLlxuICAgICAgLy8gSWYgaXQgcmV0dXJucyBhIDQwMSByZXNwb25zZSwgd2UgY2F0Y2ggaXQgYW5kIGluc3RlYWQgcmVzb2x2ZSB0byBudWxsLlxuICAgICAgcmV0dXJuICRodHRwLmdldCgnL3Nlc3Npb24nKS50aGVuKG9uU3VjY2Vzc2Z1bExvZ2luKS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBudWxsXG4gICAgICB9KVxuICAgIH1cblxuICAgIHRoaXMubG9naW4gPSBmdW5jdGlvbiAoY3JlZGVudGlhbHMpIHtcbiAgICAgIHJldHVybiAkaHR0cC5wb3N0KCcvbG9naW4nLCBjcmVkZW50aWFscylcbiAgICAgICAgLnRoZW4ob25TdWNjZXNzZnVsTG9naW4pXG4gICAgICAgIC5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgcmV0dXJuICRxLnJlamVjdCh7IG1lc3NhZ2U6ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLicgfSlcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICB0aGlzLmxvZ291dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9sb2dvdXQnKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgU2Vzc2lvbi5kZXN0cm95KClcbiAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KEFVVEhfRVZFTlRTLmxvZ291dFN1Y2Nlc3MpXG4gICAgICB9KVxuICAgIH1cbiAgfSlcblxuICBhcHAuc2VydmljZSgnU2Vzc2lvbicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUykge1xuICAgIHZhciBzZWxmID0gdGhpc1xuXG4gICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCwgZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5kZXN0cm95KClcbiAgICB9KVxuXG4gICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuZGVzdHJveSgpXG4gICAgfSlcblxuICAgIHRoaXMuaWQgPSBudWxsXG4gICAgdGhpcy51c2VyID0gbnVsbFxuXG4gICAgdGhpcy5jcmVhdGUgPSBmdW5jdGlvbiAoc2Vzc2lvbklkLCB1c2VyKSB7XG4gICAgICB0aGlzLmlkID0gc2Vzc2lvbklkXG4gICAgICB0aGlzLnVzZXIgPSB1c2VyXG4gICAgfVxuXG4gICAgdGhpcy5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgICAgdGhpcy5pZCA9IG51bGxcbiAgICAgIHRoaXMudXNlciA9IG51bGxcbiAgICB9XG4gIH0pXG59KSgpXG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbWFzdGVyLm5hdmJhci5ob21lJywge1xuICAgIHVybDogJy8nLFxuICAgIHRlbXBsYXRlVXJsOiAnanMvaG9tZS9ob21lLmh0bWwnXG4gIH0pXG59KVxuIiwiYXBwLmNvbnRyb2xsZXIoJ0xvZ2luQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsIEF1dGhTZXJ2aWNlLCAkc3RhdGUpIHtcbiAgJHNjb3BlLmxvZ2luID0ge31cbiAgJHNjb3BlLmVycm9yID0gbnVsbFxuXG4gICRzY29wZS5zZW5kTG9naW4gPSBmdW5jdGlvbiAobG9naW5JbmZvKSB7XG4gICAgJHNjb3BlLmVycm9yID0gbnVsbFxuXG4gICAgQXV0aFNlcnZpY2UubG9naW4obG9naW5JbmZvKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICRzdGF0ZS5nbygnbWFzdGVyLm5hdmJhci50YXNrcycpXG4gICAgfSkuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgJHNjb3BlLmVycm9yID0gJ0ludmFsaWQgbG9naW4gY3JlZGVudGlhbHMuJ1xuICAgIH0pXG4gIH1cbn0pXG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbWFzdGVyLm5hdmJhci5sb2dpbicsIHtcbiAgICB1cmw6ICcvbG9naW4nLFxuICAgIHRlbXBsYXRlVXJsOiAnanMvbG9naW4vbG9naW4uaHRtbCcsXG4gICAgY29udHJvbGxlcjogJ0xvZ2luQ3RybCdcbiAgfSlcbn0pXG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbWFzdGVyJywge1xuICAgIHRlbXBsYXRlVXJsOiAnanMvbWFzdGVyL21hc3Rlci5odG1sJyxcbiAgICBjb250cm9sbGVyOiBmdW5jdGlvbiAoJHNjb3BlLCAkc3RhdGUpIHtcbiAgICAgICRzdGF0ZS5nbygnbWFzdGVyLm5hdmJhci5ob21lJylcbiAgICB9XG4gIH0pXG59KVxuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ21lbWJlcnNPbmx5Jywge1xuICAgIHVybDogJy9tZW1iZXJzLWFyZWEnLFxuICAgIHRlbXBsYXRlOiAnPGltZyBuZy1yZXBlYXQ9XCJpdGVtIGluIHN0YXNoXCIgd2lkdGg9XCIzMDBcIiBuZy1zcmM9XCJ7eyBpdGVtIH19XCIgLz4nLFxuICAgIGNvbnRyb2xsZXI6IGZ1bmN0aW9uICgkc2NvcGUsIFNlY3JldFN0YXNoKSB7XG4gICAgICBTZWNyZXRTdGFzaC5nZXRTdGFzaCgpLnRoZW4oZnVuY3Rpb24gKHN0YXNoKSB7XG4gICAgICAgICRzY29wZS5zdGFzaCA9IHN0YXNoXG4gICAgICB9KVxuICAgIH0sXG4gICAgLy8gVGhlIGZvbGxvd2luZyBkYXRhLmF1dGhlbnRpY2F0ZSBpcyByZWFkIGJ5IGFuIGV2ZW50IGxpc3RlbmVyXG4gICAgLy8gdGhhdCBjb250cm9scyBhY2Nlc3MgdG8gdGhpcyBzdGF0ZS4gUmVmZXIgdG8gYXBwLmpzLlxuICAgIGRhdGE6IHtcbiAgICAgIGF1dGhlbnRpY2F0ZTogdHJ1ZVxuICAgIH1cbiAgfSlcbn0pXG5cbmFwcC5mYWN0b3J5KCdTZWNyZXRTdGFzaCcsIGZ1bmN0aW9uICgkaHR0cCkge1xuICB2YXIgZ2V0U3Rhc2ggPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICRodHRwLmdldCgnL2FwaS9tZW1iZXJzL3NlY3JldC1zdGFzaCcpLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICByZXR1cm4gcmVzcG9uc2UuZGF0YVxuICAgIH0pXG4gIH1cblxuICByZXR1cm4ge1xuICAgIGdldFN0YXNoOiBnZXRTdGFzaFxuICB9XG59KVxuIiwiYXBwLmNvbnRyb2xsZXIoJ1NpZ251cEN0cmwnLCBmdW5jdGlvbiAoJHNjb3BlLCBBdXRoU2VydmljZSwgJHN0YXRlLCBTaWdudXBGYWN0b3J5KSB7XG4gICRzY29wZS5jcmVhdGVVc2VyID0gZnVuY3Rpb24gKHNpZ251cEluZm8pIHtcbiAgICAkc2NvcGUuZXJyb3IgPSBudWxsXG5cbiAgICBTaWdudXBGYWN0b3J5LmNyZWF0ZVVzZXIoc2lnbnVwSW5mbykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICBBdXRoU2VydmljZS5sb2dpbihzaWdudXBJbmZvKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgJHN0YXRlLmdvKCdtYXN0ZXIubmF2YmFyLnNpZ251cC1zZXR0aW5ncycpXG4gICAgICB9KS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICRzY29wZS5lcnJvciA9ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLidcbiAgICAgIH0pXG4gICAgfSkuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgJHNjb3BlLmVycm9yID0gJ0NvdWxkIG5vdCBjcmVhdGUgYWNjb3VudC4nXG4gICAgfSlcbiAgfVxufSlcbiIsIid1c2Ugc3RyaWN0J1xuXG5hcHAuZGlyZWN0aXZlKCdlcXVhbHMnLCBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB7XG4gICAgcmVzdHJpY3Q6ICdBJywgLy8gb25seSBhY3RpdmF0ZSBvbiBlbGVtZW50IGF0dHJpYnV0ZVxuICAgIHJlcXVpcmU6ICc/bmdNb2RlbCcsIC8vIGdldCBhIGhvbGQgb2YgTmdNb2RlbENvbnRyb2xsZXJcbiAgICBsaW5rOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW0sIGF0dHJzLCBuZ01vZGVsKSB7XG4gICAgICBpZiAoIW5nTW9kZWwpIHJldHVybiAvLyBkbyBub3RoaW5nIGlmIG5vIG5nLW1vZGVsXG5cbiAgICAgIC8vIHdhdGNoIG93biB2YWx1ZSBhbmQgcmUtdmFsaWRhdGUgb24gY2hhbmdlXG4gICAgICBzY29wZS4kd2F0Y2goYXR0cnMubmdNb2RlbCwgZnVuY3Rpb24gKCkge1xuICAgICAgICB2YWxpZGF0ZSgpXG4gICAgICB9KVxuXG4gICAgICAvLyBvYnNlcnZlIHRoZSBvdGhlciB2YWx1ZSBhbmQgcmUtdmFsaWRhdGUgb24gY2hhbmdlXG4gICAgICBhdHRycy4kb2JzZXJ2ZSgnZXF1YWxzJywgZnVuY3Rpb24gKHZhbCkge1xuICAgICAgICB2YWxpZGF0ZSgpXG4gICAgICB9KVxuXG4gICAgICB2YXIgdmFsaWRhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIHZhbHVlc1xuICAgICAgICB2YXIgdmFsMSA9IG5nTW9kZWwuJHZpZXdWYWx1ZVxuICAgICAgICB2YXIgdmFsMiA9IGF0dHJzLmVxdWFsc1xuXG4gICAgICAgIC8vIHNldCB2YWxpZGl0eVxuICAgICAgICBuZ01vZGVsLiRzZXRWYWxpZGl0eSgnZXF1YWxzJywgIXZhbDEgfHwgIXZhbDIgfHwgdmFsMSA9PT0gdmFsMilcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pXG4iLCJhcHAuZmFjdG9yeSgnU2lnbnVwRmFjdG9yeScsIGZ1bmN0aW9uICgkaHR0cCwgJGxvZywgJHEpIHtcbiAgcmV0dXJuIHtcbiAgICBjcmVhdGVVc2VyOiBmdW5jdGlvbiAoc2lnbnVwSW5mbykge1xuICAgICAgcmV0dXJuICRodHRwLnBvc3QoJy9hcGkvc2lnbnVwJywgc2lnbnVwSW5mbylcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiAkcS5yZXNvbHZlKHttZXNzYWdlOiAnVXNlciBjcmVhdGVkISd9KVxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiAkcS5yZXNvbHZlKHsgbWVzc2FnZTogJ1VuYWJsZSB0byBjcmVhdGUgdXNlci4nIH0pXG4gICAgICAgIH0pXG4gICAgfVxuICB9XG59KVxuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ21hc3Rlci5uYXZiYXIuc2lnbnVwJywge1xuICAgIHVybDogJy9zaWdudXAnLFxuICAgIHRlbXBsYXRlVXJsOiAnanMvc2lnbnVwL3NpZ251cC5odG1sJyxcbiAgICBjb250cm9sbGVyOiAnU2lnbnVwQ3RybCdcbiAgfSlcbn0pXG4iLCJhcHAuY29udHJvbGxlcignU2lnbnVwU2V0dGluZ3NDdHJsJywgZnVuY3Rpb24gKCRzY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSwgU2lnbnVwU2V0dGluZ3NGYWN0b3J5KSB7XG4gICRzY29wZS53ZWVrID0gW1xuICAgIHtzZWxlY3RlZDogZmFsc2UsIG5hbWU6ICdNbycsIG51bWJlcjogMH0sXG4gICAge3NlbGVjdGVkOiBmYWxzZSwgbmFtZTogJ1R1JywgbnVtYmVyOiAxfSxcbiAgICB7c2VsZWN0ZWQ6IGZhbHNlLCBuYW1lOiAnV2UnLCBudW1iZXI6IDJ9LFxuICAgIHtzZWxlY3RlZDogZmFsc2UsIG5hbWU6ICdUaCcsIG51bWJlcjogM30sXG4gICAge3NlbGVjdGVkOiBmYWxzZSwgbmFtZTogJ0ZyJywgbnVtYmVyOiA0fSxcbiAgICB7c2VsZWN0ZWQ6IGZhbHNlLCBuYW1lOiAnU2EnLCBudW1iZXI6IDV9LFxuICAgIHtzZWxlY3RlZDogZmFsc2UsIG5hbWU6ICdTdScsIG51bWJlcjogNn1cbiAgXVxuXG4gICRzY29wZS5pc09wdGlvbnNSZXF1aXJlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gJHNjb3BlLndlZWsuc29tZShmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgcmV0dXJuIG9wdGlvbnMuc2VsZWN0ZWRcbiAgICB9KVxuICB9XG5cbiAgJHNjb3BlLmNyZWF0ZVNldHRpbmdzID0gZnVuY3Rpb24gKHNldHRpbmdzSW5mbykge1xuICAgIGxldCBteVdvcmtkYXlzID0gW11cblxuICAgICRzY29wZS53ZWVrLmZvckVhY2goZnVuY3Rpb24gKGVsZW0pIHtcbiAgICAgIGlmIChlbGVtLnNlbGVjdGVkID09PSB0cnVlKSB7XG4gICAgICAgIG15V29ya2RheXMucHVzaChlbGVtLm51bWJlcilcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgbGV0IHRvQmVTZW50ID0ge1xuICAgICAgd2FrZXRpbWU6IHNldHRpbmdzSW5mby53YWtldGltZSArICcgQU0nLFxuICAgICAgd29ya2RheXM6IG15V29ya2RheXNcbiAgICB9XG5cbiAgICBTaWdudXBTZXR0aW5nc0ZhY3RvcnkuY3JlYXRlU2V0dGluZ3ModG9CZVNlbnQpXG4gICAgICAudGhlbihmdW5jdGlvbiAoY3JlYXRlZFNldHRpbmdzKSB7XG4gICAgICAgICRzdGF0ZS5nbygnbWFzdGVyLm5hdmJhci50YXNrcycpXG4gICAgICB9KVxuICAgICAgLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgJHNjb3BlLmVycm9yID0gJ0NvdWxkIG5vdCBjcmVhdGUgc2V0dGluZ3MuJ1xuICAgICAgICBjb25zb2xlLmxvZygnRXJyb3IgY3JlYXRpbmcgdGFzay4nKVxuICAgICAgfSlcbiAgfVxufSlcbiIsImFwcC5mYWN0b3J5KCdTaWdudXBTZXR0aW5nc0ZhY3RvcnknLCBmdW5jdGlvbiAoJGh0dHAsICRsb2csICRxKSB7XG4gIHJldHVybiB7XG4gICAgY3JlYXRlU2V0dGluZ3M6IGZ1bmN0aW9uIChzZXR0aW5nc0luZm8pIHtcbiAgICAgIHJldHVybiAkaHR0cC5wb3N0KCcvYXBpL3NldHRpbmdzJywgc2V0dGluZ3NJbmZvKVxuICAgICAgICAudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgcmV0dXJuICRxLnJlc29sdmUoe21lc3NhZ2U6ICdTZXR0aW5ncyBjcmVhdGVkISd9KVxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiAkcS5yZXNvbHZlKHsgbWVzc2FnZTogJ1VuYWJsZSB0byBjcmVhdGUgc2V0dGluZ3MuJyB9KVxuICAgICAgICB9KVxuICAgIH1cbiAgfVxufSlcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdtYXN0ZXIubmF2YmFyLnNpZ251cC1zZXR0aW5ncycsIHtcbiAgICB1cmw6ICcvc2lnbnVwLXNldHRpbmdzJyxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL3NpZ251cC1zZXR0aW5ncy9zaWdudXAtc2V0dGluZ3MuaHRtbCcsXG4gICAgY29udHJvbGxlcjogJ1NpZ251cFNldHRpbmdzQ3RybCdcbiAgfSlcbn0pXG4iLCJhcHAuZGlyZWN0aXZlKCdmb290ZXInLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgQXV0aFNlcnZpY2UsIEFVVEhfRVZFTlRTLCAkc3RhdGUpIHtcbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0UnLFxuICAgIHNjb3BlOiB7fSxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL2Zvb3Rlci9mb290ZXIuaHRtbCcsXG4gICAgbGluazogZnVuY3Rpb24gKHNjb3BlKSB7fVxuICB9XG59KVxuIiwiLy8gdGVzdGluZyBmb3IgcGhhc2VyXG5cbmxldCBjcmVhdGVHYW1lID0gZnVuY3Rpb24gKGVsZSwgc2NvcGUsIHBsYXllcnMsIG1hcElkLCBpbmplY3Rvcikge1xuICB2YXIgZ2FtZSA9IG5ldyBQaGFzZXIuR2FtZSg5NjAsIDYwMCwgUGhhc2VyLkNBTlZBUywgJ2dhbWVDYW52YXMnLCB7IHByZWxvYWQ6IHByZWxvYWQsIGNyZWF0ZTogY3JlYXRlLCB1cGRhdGU6IHVwZGF0ZSwgcmVuZGVyOiByZW5kZXIgfSlcbiAgLy8gVGhlIHdhbGsgdGhyb3VnaDogTWFrZSBuZXcgcHNldWRvLWlmcmFtZSBvYmplY3QuIFRoZSB3b3JsZCBhbmQgY2FtZXJhIGhhdmUgYSB3aWR0aCwgaGVpZ2h0IG9mIDk2MCwgNjAwXG4gIC8vIE15IHBhcmVudCBkaXYgaXMgcGhhc2VyLWV4YW1wbGVcbiAgLy8gTXkgcHJlbG9hZCBmdW5jdGlvbiBpcyB0aXRsZWQgcHJlbG9hZCwgY3JlYXRlOiBjcmVhdGUsIHVwZGF0ZTogdXBkYXRlLCBhbmQgcmVuZGVyOiByZW5kZXJcblxuICBmdW5jdGlvbiBwcmVsb2FkICgpIHtcbiAgICBnYW1lLnN0YWdlLmJhY2tncm91bmRDb2xvciA9ICcjNzZiY2JiJ1xuICAgIC8vIGdhbWUubG9hZC5pbWFnZSgnbXVzaHJvb20nLCAncGltYWdlcy9zdGFyLnBuZycpXG4gICAgZ2FtZS5sb2FkLnRpbGVtYXAoJ21hcCcsICdwbWFwcy9idW5rZXJ2MS5qc29uJywgbnVsbCwgUGhhc2VyLlRpbGVtYXAuVElMRURfSlNPTilcbiAgICBnYW1lLmxvYWQuaW1hZ2UoJ3RpbGVzJywgJ3BtYXBzL3Rtd19kZXNlcnRfc3BhY2luZy5wbmcnKVxuICAgIGdhbWUubG9hZC5pbWFnZSgndGlsZXMyJywgJ3BtYXBzL3Nld2VyX3RpbGVzZXQucG5nJylcbiAgICBnYW1lLmxvYWQuc3ByaXRlc2hlZXQoJ3BsYXllcicsICdwaW1hZ2VzL2R1ZGUucG5nJywgMzIsIDQ4KVxuICB9XG4gIC8vIFNldCBiZyBjb2xvciBiZWhpbmQgYWxsIGVsZW1lbnRzIGluIHRoaXMgZnJhbWVcbiAgLy8gTG9hZCBteSB0aWxlbWFwIC0gYSBqc29uIHRoYXQgY2FuIGJlIGZvdW5kIGluIGFzc2V0cyAtIHRoYXQgaXMgZXNzZW50aWFsbHkgYSBtYXRyaXggb2YgcG5nIGVsZW1lbnRzXG4gIC8vIGxvYWQgdGhlIHNoZWV0cyBvZiBwbmcncyB0aGF0IHRoaXMgbWFwIHVzZXNcbiAgLy8gTm93IGxvYWQgdGhlICdzcHJpdGVzaGVldCcgdGhlIGltYWdlIHRoYXQgaXMgdGhlIGNoYXJhY3RlciAtIGl0IGhhcyBuaW5lIGZyYW1lcyAtIDQgcmlnaHQsIDQgbGVmdCwgMSBzdGFuZGluZyBzdGlsbFxuXG4gIHZhciBjdXJzb3JzXG4gIHZhciBvX2NhbWVyYVxuICB2YXIgY2FtZXJhRHJhZyA9IDVcbiAgdmFyIGNhbWVyYUFjY2VsID0gM1xuICB2YXIgY2FtVmVsWCA9IDBcbiAgdmFyIGNhbVZlbFkgPSAwXG4gIHZhciBjYW1NYXhTcGVlZCA9IDgwXG4gIHZhciBtYXBcbiAgdmFyIGxheWVyLCBsYXllcjIsIGxheWVyMywgbGF5ZXI0XG4gIHZhciB0aWxlXG4gIHZhciBsb2dcbiAgdmFyIHRpbGVVcCA9IGZhbHNlXG4gIHZhciBwbGF5ZXJcbiAgdmFyIG1hcmtlclxuICB2YXIgbGVmdEtleSwgcmlnaHRLZXlcbiAgLy8gZGVjbGFyZSBzZW1pIGdsb2JhbHMgLSBmaWd1cmUgaXQgb3V0XG5cbiAgZnVuY3Rpb24gY3JlYXRlICgpIHtcbiAgICBnYW1lLnBoeXNpY3Muc3RhcnRTeXN0ZW0oUGhhc2VyLlBoeXNpY3MuQVJDQURFKVxuICAgIC8vIE11bHRpcGxlIHN5c3RlbXMgb2YgcGh5c2ljcywgdGhpcyBpcyB0aGUgc2ltcGxlc3QuXG5cbiAgICBtYXAgPSBnYW1lLmFkZC50aWxlbWFwKCdtYXAnKVxuICAgIG1hcC5hZGRUaWxlc2V0SW1hZ2UoJ2J1bmtlcnYyJywgJ3RpbGVzJylcbiAgICBtYXAuYWRkVGlsZXNldEltYWdlKCdzZXdlcl90aWxlc2V0JywgJ3RpbGVzMicpXG4gICAgbGF5ZXIzID0gbWFwLmNyZWF0ZUxheWVyKCdCb3VuZHMnKVxuICAgIGxheWVyID0gbWFwLmNyZWF0ZUxheWVyKCdHcm91bmQnKVxuICAgIGxheWVyMiA9IG1hcC5jcmVhdGVMYXllcignQnVua2VyJylcbiAgICBsYXllcjJcbiAgICBsYXllcjQgPSBtYXAuY3JlYXRlTGF5ZXIoJ0ludGVyYWN0aXZlJylcbiAgICAvLyBBZGQgYWxsIHRoZSBlbGVtZW50cyB3ZSBwcmVsb2FkZWQuXG4gICAgLy8gVGhlIHRpbGVtYXAgaGFzIGxheWVycyAtIHRoZSBidW5rZXIsIGl0cyBiZywgYW5kIHdoYXQgdGhlIHBsYXllciBjb2xsaWRlcyB3aXRoIC0gY2hlY2sgb3V0IFRpbGVkXG4gICAgZ2FtZS53b3JsZC5zZXRCb3VuZHMoMCwgMCwgOTYwLCAzMDQwKVxuICAgIGdhbWUud29ybGQucmVzaXplKDk2MCwgMzA0MClcbiAgICAvLyBTZXRzIHRoZSBwaHlzaWNzIGJvdW5kcyBvZiB0aGUgd29ybGQgLSBzdGFydHgsIHN0YXJ0eSwgbWF4eCwgbWF4eVxuXG4gICAgbWFya2VyID0gZ2FtZS5hZGQuZ3JhcGhpY3MoKVxuICAgIG1hcmtlci5saW5lU3R5bGUoMiwgMHhmZmZmZmYsIDEpXG4gICAgbWFya2VyLmRyYXdSZWN0KDAsIDAsIDMyLCAzMilcbiAgICAvLyBDcmVhdGUgdGhlIHRoaW5ncyB0aGF0IGFsbG93IHVzIHRvIHNlbGVjdCB0aWxlc1xuXG4gICAgZ2FtZS5pbnB1dC5hZGRNb3ZlQ2FsbGJhY2sodXBkYXRlTWFya2VyLCB0aGlzKVxuICAgIC8vIFdoYXQgaGFwcGVucyB3aGVuIGkgbW92ZSB0aGUgbW91c2U/IEFkZCBhIGxpc3RlbmVyIGFuZCBiaW5kIHRoaXNcblxuICAgIG1hcC5zZXRDb2xsaXNpb24oNTUsIHRydWUsIGxheWVyMylcbiAgICBtYXAuc2V0Q29sbGlzaW9uKDY0LCBmYWxzZSwgbGF5ZXI0KVxuICAgIG1hcC5zZXRUaWxlSW5kZXhDYWxsYmFjayg2NCwgbW92ZURvd24sIHRoaXMsIGxheWVyNClcbiAgICBtYXAuc2V0VGlsZUluZGV4Q2FsbGJhY2soNjUsIG1vdmVVcCwgdGhpcywgbGF5ZXI0KVxuICAgIC8vIE9LQVkgdW5kZXJzdGFuZGFibHkgY29uZnVzaW5nIGlmIHlvdSBhcmUgbm90IGZhbWlsaWFyIHdpdGggZ2FtZSBkZXNpZ24uXG4gICAgLy8gVGhlIGVuZ2luZSBpcyBydW5uaW5nIGEgY29sbGlzaW9uIGVuZ2luZS4gVGhlIFRMRFIgaXMgdGhhdCB2ZWxvY2l0eSBpcyBzZXQgdG8gMCB1cG9uIGludGVyYWN0aW9uIHdpdGggYWJvdmUuXG4gICAgLy8gNTUgaXMgdGhlIEVYQUNUIHRpbGUgdGhpcyBhcHBsaWVzIHRvLlxuICAgIC8vIFRSVUUgaXMgU1RPUCBNT1ZJTkcgLSBGQUxTRSBpcyBSRUNPUkQgQ09MTElTSU9OIEJVVCBETyBOT1QgU1RPUCBNT1ZJTkcgLSBJVCBPTkxZIEFQUExJRVMgVE8gVEhFIENPTExJU0lPTiBMQVlFUlxuICAgIC8vIHRoZSBsYXN0IHR3byBsaW5lcywgaW1wbGVtZW50IHN0YWlyY2FzZSBmdW5jdGlvbmFsaXR5LlxuXG4gICAgLypcbiAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCAxMDA7IGkrKylcbiAgICAge1xuICAgICBnYW1lLmFkZC5zcHJpdGUoZ2FtZS53b3JsZC5yYW5kb21YLCBnYW1lLndvcmxkLnJhbmRvbVksICdtdXNocm9vbScpXG4gICAgIH1cbiAgICAgLy9CdWxsc2hpdFxuXG4gICAgIGdhbWUuYWRkLnRleHQoMzAwLCAzMDAsIFwiLSBCdW5rZXIgVGVzdCAtXCIsIHsgZm9udDogXCIzMnB4IEFyaWFsXCIsIGZpbGw6IFwiIzMzMDA4OFwiLCBhbGlnbjogXCJjZW50ZXJcIiB9KVxuICAgICBnYW1lLmFkZC50ZXh0KDMwMCwgMzUwLCBcIlVwIEFycm93LCBEb3duIEFycm93XCIsIHsgZm9udDogXCIzMnB4IEFyaWFsXCIsIGZpbGw6IFwiIzMzMDA4OFwiLCBhbGlnbjogXCJjZW50ZXJcIiB9KVxuICAgICBnYW1lLmFkZC50ZXh0KDMwMCwgNDAwLCBcIk1vdXNlIERyYWcvVG91Y2hcIiwgeyBmb250OiBcIjMycHggQXJpYWxcIiwgZmlsbDogXCIjMzMwMDg4XCIsIGFsaWduOiBcImNlbnRlclwiIH0pXG4gICAgIC8vRWFybHkgdGVzdGluZyBzdHVmZlxuICAgICAqL1xuICAgIHZhciBnID0gZ2FtZS5hZGQuZ3JvdXAoKVxuICAgIGcueCA9IDUwMFxuICAgIC8vIERpc3JlZ2FyZCAtIG1heSBiZSB1c2VkIGxhdGVyLlxuXG4gICAgY3Vyc29ycyA9IGdhbWUuaW5wdXQua2V5Ym9hcmQuY3JlYXRlQ3Vyc29yS2V5cygpXG4gICAgLy8gQ3JlYXRlIGlucHV0IGtleXMgLSBha2EgQVNDSUkgYWJzdHJhY3Rpb24gLSByZW1vdmVzIHRoZWlyIGFiaWxpdHkgdG8gYmUgdXNlZCBieSBET01cbiAgICBnYW1lLmlucHV0RW5hYmxlZCA9IHRydWVcbiAgICBnYW1lLmlucHV0Lm9uRG93bi5hZGQobG9nVGlsZSwgdGhpcylcbiAgICAvLyBPS0FZIC0gaW5wdXQgZW5hYmxlZCBpcyAxLzIgdGhpbmdzIGZvciB0b3VjaCBlbmFibGVkLiBNYXkgbm90IHdvcmsgeWV0LlxuICAgIC8vIGdhbWUuaW5wdXQgPSBtb3VzZVxuICAgIC8vIG9uRG93biA9IGV2ZW50XG4gICAgLy8gYWRkID0gYWRkTGlzdGVuZXIgZnVuY3Rpb25cbiAgICAvLyBsb2dUaWxlIC0gdGhlIGxpc3RlbmVyIGZ1bmN0aW9uXG4gICAgLy8gYmluZCB0aGlzXG5cbiAgICBwbGF5ZXIgPSBnYW1lLmFkZC5zcHJpdGUoMzIsIDI4MCwgJ3BsYXllcicpXG4gICAgLy8gQWRkIHRoZSBwbGF5ZXIgc3ByaXRlc2hlZXQgLSBpdCBoYXMgMzIsIDMyIGRpbWVuc2lvbnNcblxuICAgIGdhbWUucGh5c2ljcy5lbmFibGUocGxheWVyKVxuICAgIC8vIFBoeXNpY3MgYXBwbHkgdG8gdGhpcyBlbGVtZW50XG5cbiAgICBnYW1lLnBoeXNpY3MuYXJjYWRlLmdyYXZpdHkueSA9IDI1MFxuICAgIC8vIFRoaXMgaXMgaG93IGludGVuc2VseSB5IGdyaWQgcGh5c2ljcyBhcHBseVxuXG4gICAgcGxheWVyLmJvZHkubGluZWFyRGFtcGluZyA9IDFcbiAgICAvLyBEYW1wIHRoZSBlZmZlY3RzIG9mIHBoeXNpY3MgbWlzYyBmdW5jdGlvbnMgMTAwJVxuICAgIHBsYXllci5ib2R5LmNvbGxpZGVXb3JsZEJvdW5kcyA9IHRydWVcbiAgICAvLyBJIGNhbm5vdCBlc2NhcGUgd29ybGQgYm91bmRhcmllc1xuICAgIHBsYXllci5ib2R5LmNoZWNrQ29sbGlzaW9uLnJpZ2h0ID0gdHJ1ZVxuICAgIC8vIEkgZm9sbG93IHRoZSBydWxlcyBvZiB3YWxscyB0byB0aGUgcmlnaHRcbiAgICBwbGF5ZXIuYm9keS5jaGVja0NvbGxpc2lvbi5sZWZ0ID0gdHJ1ZVxuICAgIC8vIEkgZm9sbG93IHRoZSBydWxlcyBvZiB3YWxscyB0byB0aGUgbGVmdFxuXG4gICAgcGxheWVyLmFuaW1hdGlvbnMuYWRkKCdsZWZ0JywgWzAsIDEsIDIsIDNdLCAxMCwgdHJ1ZSlcbiAgICBwbGF5ZXIuYW5pbWF0aW9ucy5hZGQoJ3JpZ2h0JywgWzUsIDYsIDcsIDhdLCAxMCwgdHJ1ZSlcbiAgICAvLyBOYW1lIGFuaW1hdGlvbiwgd2hhdCBmcmFtZXMgaXMgdGhpcyBhbmltYXRpb24sIGF0IHdoYXQgRlBTLCBkbyBJIGlkbGUgb3RoZXJ3aXNlP1xuXG4gICAgbGVmdEtleSA9IGdhbWUuaW5wdXQua2V5Ym9hcmQuYWRkS2V5KFBoYXNlci5LZXlib2FyZC5MRUZUKVxuICAgIHJpZ2h0S2V5ID0gZ2FtZS5pbnB1dC5rZXlib2FyZC5hZGRLZXkoUGhhc2VyLktleWJvYXJkLlJJR0hUKVxuICAvLyBBbGlhcyBrZXlzIC0gZGlkbnQgd29yayBvdGhlcndpc2UsIGRvbnQgYXNrLlxuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlICgpIHtcbiAgICBnYW1lLnBoeXNpY3MuYXJjYWRlLmNvbGxpZGUocGxheWVyLCBsYXllcjMpXG4gICAgZ2FtZS5waHlzaWNzLmFyY2FkZS5jb2xsaWRlKHBsYXllciwgbGF5ZXI0KVxuICAgIC8vIFRoZSBvbmx5IGxheWVyIG9mIHRoZSBtYXAgaSBjb2xsaWRlIHdpdGggaXMgbGF5ZXIgMyAtIGFuZCBiYXNlZCBvbiBhYm92ZSAtIHRpbGUgNTUgb2YgbGF5ZXIgM1xuICAgIHBsYXllci5ib2R5LnZlbG9jaXR5LnggPSAwXG4gICAgLy8gRXZlcnkgMS82MCBmcmFtZSwgcmVzZXQgeCB2ZWxvY2l0eVxuXG4gICAgaWYgKGxlZnRLZXkuaXNEb3duKSB7XG4gICAgICAvLyAgTW92ZSB0byB0aGUgbGVmdFxuICAgICAgcGxheWVyLmJvZHkudmVsb2NpdHkueCA9IC0xNTBcbiAgICAgIC8vIGJ5IHRoaXMgbXVjaFxuXG4gICAgICBwbGF5ZXIuYW5pbWF0aW9ucy5wbGF5KCdsZWZ0JylcbiAgICAvLyBhbmltYXRlIHRoaXNcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHJpZ2h0S2V5LmlzRG93bikge1xuICAgICAgICAvLyAgTW92ZSB0byB0aGUgcmlnaHRcbiAgICAgICAgcGxheWVyLmJvZHkudmVsb2NpdHkueCA9IDE1MFxuICAgICAgICAvLyBieSB0aGlzIG11Y2hcblxuICAgICAgICBwbGF5ZXIuYW5pbWF0aW9ucy5wbGF5KCdyaWdodCcpXG4gICAgICAvLyBhbmltYXRlIHRoaXNcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBsYXllci5hbmltYXRpb25zLnN0b3AoKVxuICAgICAgICAvLyBvdGhlcndpc2UsIHN0YW5kc3RpbGxcblxuICAgICAgICBwbGF5ZXIuZnJhbWUgPSA0XG4gICAgICAvLyBhdCB0aGlzIGZyYW1lXG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjdXJzb3JzLnVwLmlzRG93bikge1xuICAgICAgLy8gTW92ZSB3b3JsZCB1cFxuICAgICAgZ2FtZS5jYW1lcmEueSAtPSA0XG4gICAgLy8gYnkgdGhpcyBtdWNoXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChjdXJzb3JzLmRvd24uaXNEb3duKSB7XG4gICAgICAgIC8vIG1vdmUgd29ybGQgZG93blxuICAgICAgICBnYW1lLmNhbWVyYS55ICs9IDRcbiAgICAgIC8vIGJ5IHRoaXMgbXVjaFxuICAgICAgfVxuICAgIH1cbiAgICBkcmFnX2NhbWVyYShnYW1lLmlucHV0Lm1vdXNlUG9pbnRlcilcbiAgICBkcmFnX2NhbWVyYShnYW1lLmlucHV0LnBvaW50ZXIxKVxuICAgIHVwZGF0ZV9jYW1lcmEoKVxuICAvLyBNb25pdG9yIG1vdXNlL3RvdWNoIHdvcmxkIG1vdmVtZW50XG4gIH1cblxuICBmdW5jdGlvbiByZW5kZXIgKCkge1xuICAgIGdhbWUuZGVidWcuY2FtZXJhSW5mbyhnYW1lLmNhbWVyYSwgMzIsIDMyKVxuICAgIC8vIFNob3cgY2FtZXJhIGluZm9cbiAgICBnYW1lLmRlYnVnLnRleHQoJ1RpbGUgSW5mbzogJyArIGxvZywgMzIsIDU3MClcbiAgLy8gU2hvdyBzZWxlY3RlZCB0aWxlXG4gIH1cblxuICAvLyBFeHBlcmltZW50YWwgc3RhaXJjYXNlIGZ1bmN0aW9uXG4gIGZ1bmN0aW9uIG1vdmVEb3duICgpIHtcbiAgICBjb25zb2xlLmxvZygnQXR0ZW1wdGluZyB0byB0ZWxlcG9ydCBkb3duIScpXG4gICAgaWYgKHBsYXllci5ib2R5LnggPiAoZ2FtZS53b3JsZC53aWR0aCAvIDIpKSB7XG4gICAgICBwbGF5ZXIuYm9keS54ID0gcGxheWVyLmJvZHkueCAtIDMyXG4gICAgfSBlbHNlIHtcbiAgICAgIHBsYXllci5ib2R5LnggPSBwbGF5ZXIuYm9keS54ICsgMzJcbiAgICB9XG4gICAgcGxheWVyLmJvZHkueSA9IHBsYXllci5ib2R5LnkgKyAoMzIgKiA3KVxuICAgIGlmIChwbGF5ZXIuYm9keS55ID4gKGdhbWUuY2FtZXJhLnkgKyBnYW1lLmNhbWVyYS5oZWlnaHQgLSA5NikpIHtcbiAgICAgIGdhbWUuY2FtZXJhLnkgKz0gZ2FtZS5jYW1lcmEuaGVpZ2h0IC8gMlxuICAgIH1cbiAgfVxuXG4gIC8vXG4gIGZ1bmN0aW9uIG1vdmVVcCAoKSB7XG4gICAgY29uc29sZS5sb2coJ0F0dGVtcHRpbmcgdG8gdGVsZXBvcnQhJylcbiAgICBpZiAocGxheWVyLmJvZHkueCA+IChnYW1lLndvcmxkLndpZHRoIC8gMikpIHtcbiAgICAgIHBsYXllci5ib2R5LnggPSBwbGF5ZXIuYm9keS54IC0gMzJcbiAgICB9IGVsc2Uge1xuICAgICAgcGxheWVyLmJvZHkueCA9IHBsYXllci5ib2R5LnggKyAzMlxuICAgIH1cbiAgICBwbGF5ZXIuYm9keS55ID0gcGxheWVyLmJvZHkueSAtICgzMiAqIDcpXG4gICAgaWYgKHBsYXllci5ib2R5LnkgPCAoZ2FtZS5jYW1lcmEueSArIDk2KSkge1xuICAgICAgZ2FtZS5jYW1lcmEueSAtPSBnYW1lLmNhbWVyYS5oZWlnaHQgLyAyXG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gbG9nVGlsZSAoKSB7XG4gICAgbGV0IHRpbGVSID0gZ2V0VGlsZVByb3BlcnRpZXMoKVxuICAgIC8vIEdyYWIgc2VsZWN0ZWQgdGlsZSBpbmZvXG4gICAgY29uc29sZS5sb2coJ1RpbGUgUjogJylcbiAgICBjb25zb2xlLmxvZyh0aWxlUilcbiAgICBpZiAoTnVtYmVyKHRpbGVSLmluZGV4KSA+IDYzKSB7XG4gICAgICB0aWxlVXAgPSBmYWxzZVxuICAgIC8vIEFyYml0cmFyeSAjLCBidXQgc3RhcnQgY291bnRpbmcgZG93biBpZiBhYm92ZSB0aGlzIC0gbmVlZHMgd29ya1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoTnVtYmVyKHRpbGVSLmluZGV4KSA8IDEpIHtcbiAgICAgICAgdGlsZVVwID0gdHJ1ZVxuICAgICAgLy8gQXJiaXRyYXJ5ICMsIGJ1dCBzdGFydCBjb3VudGluZyB1cCBpZiBiZWxvdyB0aGlzIC0gbmVlZHMgd29ya1xuICAgICAgfVxuICAgIH1cbiAgICBsZXQgbmV4dFRpbGVcbiAgICBpZiAodGlsZVVwKSB7XG4gICAgICBuZXh0VGlsZSA9IE51bWJlcih0aWxlUi5pbmRleCkgKyAxXG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHRUaWxlID0gTnVtYmVyKHRpbGVSLmluZGV4KSAtIDFcbiAgICB9XG4gICAgLy8gTW92ZSBpbiB4IGRpcmVjdGlvblxuICAgIG1hcC5yZW1vdmVUaWxlKHRpbGVSLngsIHRpbGVSLnksIGxheWVyMykuZGVzdHJveSgpXG4gICAgbWFwLnB1dFRpbGUobmV4dFRpbGUsIHRpbGVSLngsIHRpbGVSLnksIGxheWVyMylcbiAgLy8gU2VsZi1leHBsYW5hdG9yeSAtIHJlbW92ZSBzZWxlY3RlZCB0aWxlIC0gbW92ZSBpbiBkZWNpZGVkIGRpcmVjdGlvblxuICB9XG5cbiAgZnVuY3Rpb24gZHJhZ19jYW1lcmEgKG9fcG9pbnRlcikge1xuICAgIGlmICghb19wb2ludGVyLnRpbWVEb3duKSB7XG4gICAgICAvLyBJZiBjbGljayBpc250IGxvbmdlciB0aGFuIGEgY2xpY2tcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBpZiAob19wb2ludGVyLmlzRG93biAmJiAhb19wb2ludGVyLnRhcmdldE9iamVjdCkge1xuICAgICAgLy8gSWYgaXZlIHN0YXllZCBkb3duLCBhbmQgdGhpcyBpc250IG9uZSBvZiBteSB0YXJnZXQgb2JqZWN0cyBhbGEgZXhjZXB0aW9uIGNhc2VzXG4gICAgICBpZiAob19jYW1lcmEpIHtcbiAgICAgICAgY2FtVmVsWCA9IChvX2NhbWVyYS54IC0gb19wb2ludGVyLnBvc2l0aW9uLngpICogY2FtZXJhQWNjZWxcbiAgICAgICAgY2FtVmVsWSA9IChvX2NhbWVyYS55IC0gb19wb2ludGVyLnBvc2l0aW9uLnkpICogY2FtZXJhQWNjZWxcbiAgICAgIC8vIEZpZ3VyZSBvdXQgZGlmZiAtIG11bHRpcGx5IGJ5IGFjY2VsXG4gICAgICB9XG4gICAgICBvX2NhbWVyYSA9IG9fcG9pbnRlci5wb3NpdGlvbi5jbG9uZSgpXG4gICAgLy8gZWxzZSB3ZXJlIHRoZSBzYW1lIG1vZnVja2FcbiAgICB9XG5cbiAgICBpZiAob19wb2ludGVyLmlzVXApIHtcbiAgICAgIG9fY2FtZXJhID0gbnVsbFxuICAgIH1cbiAgLy8gSWYgbm90aGluZ3MgZ29pbmcgb24sIG5vIGRlYWxcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFRpbGVQcm9wZXJ0aWVzICgpIHtcbiAgICB2YXIgeCA9IGxheWVyMy5nZXRUaWxlWChnYW1lLmlucHV0LmFjdGl2ZVBvaW50ZXIud29ybGRYKVxuICAgIHZhciB5ID0gbGF5ZXIzLmdldFRpbGVZKGdhbWUuaW5wdXQuYWN0aXZlUG9pbnRlci53b3JsZFkpXG4gICAgLy8gZmluZCB0aGUgdGlsZSBsb2NhdGlvbiBiYXNlZCBvbiBtb3VzZSBsb2NhdGlvbiAoZGlmZiB4LCB5IHZhbHMpXG5cbiAgICB0aWxlID0gbWFwLmdldFRpbGUoeCwgeSwgbGF5ZXIzKVxuICAgIC8vIEdyYWIgdGlsZSBvYmplY3RzIGJhc2VkIG9uIHRoZXNlXG4gICAgY29uc29sZS5sb2codGlsZSlcbiAgICBsb2cgPSB0aWxlLmluZGV4XG4gICAgLy8gU2V0IHNlbWktZ2xvYiB0byB0aGlzXG4gICAgY29uc29sZS5sb2coe3g6IHgsIHk6IHksIGluZGV4OiB0aWxlLmluZGV4fSlcbiAgICAvLyBSZXR1cm4gb2JqZWN0IHdpdGggcGVydGluZW50IGRhdGFcbiAgICByZXR1cm4ge3g6IHgsIHk6IHksIGluZGV4OiB0aWxlLmluZGV4fVxuICB9XG5cbiAgLy8gTm90IHdvcnRoIGdldHRpbmcgdG9vIGludG8gLSBlc3NlbnRpYWxseSB0aGUgcGh5c2ljcyBvZiBtb3ZpbmcgY2FtZXJhIHZpYSBtb3VzZS5cbiAgLy8gTWl4IG9mIG9sZCBnYW1lcyBpdmUgbWFkZSBhbmQgb25saW5lIHN0dWZmLiBMaXZlIHdpdGggb3RoZXIgcGVvcGxlcyB3b3JrLiBpdCB3b3Jrcy5cbiAgLy8gTWF5IG5lZWQgc29tZSB3b3JrIGZvciB0b3VjaCBlbmFibGVkLlxuICBmdW5jdGlvbiB1cGRhdGVfY2FtZXJhICgpIHtcbiAgICBjYW1WZWxYID0gY2xhbXAoY2FtVmVsWCwgY2FtTWF4U3BlZWQsIC1jYW1NYXhTcGVlZClcbiAgICBjYW1WZWxZID0gY2xhbXAoY2FtVmVsWSwgY2FtTWF4U3BlZWQsIC1jYW1NYXhTcGVlZClcblxuICAgIGdhbWUuY2FtZXJhLnggKz0gY2FtVmVsWFxuICAgIGdhbWUuY2FtZXJhLnkgKz0gY2FtVmVsWVxuXG4gICAgLy8gU2V0IENhbWVyYSBWZWxvY2l0eSBYIERyYWdcbiAgICBpZiAoY2FtVmVsWCA+IGNhbWVyYURyYWcpIHtcbiAgICAgIGNhbVZlbFggLT0gY2FtZXJhRHJhZ1xuICAgIH0gZWxzZSBpZiAoY2FtVmVsWCA8IC1jYW1lcmFEcmFnKSB7XG4gICAgICBjYW1WZWxYICs9IGNhbWVyYURyYWdcbiAgICB9IGVsc2Uge1xuICAgICAgY2FtVmVsWCA9IDBcbiAgICB9XG5cbiAgICAvLyBTZXQgQ2FtZXJhIFZlbG9jaXR5IFkgRHJhZ1xuICAgIGlmIChjYW1WZWxZID4gY2FtZXJhRHJhZykge1xuICAgICAgY2FtVmVsWSAtPSBjYW1lcmFEcmFnXG4gICAgfSBlbHNlIGlmIChjYW1WZWxZIDwgLWNhbWVyYURyYWcpIHtcbiAgICAgIGNhbVZlbFkgKz0gY2FtZXJhRHJhZ1xuICAgIH0gZWxzZSB7XG4gICAgICBjYW1WZWxZID0gMFxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHVwZGF0ZU1hcmtlciAoKSB7XG4gICAgbWFya2VyLnggPSBsYXllci5nZXRUaWxlWChnYW1lLmlucHV0LmFjdGl2ZVBvaW50ZXIud29ybGRYKSAqIDMyXG4gICAgbWFya2VyLnkgPSBsYXllci5nZXRUaWxlWShnYW1lLmlucHV0LmFjdGl2ZVBvaW50ZXIud29ybGRZKSAqIDMyXG4gIH1cblxuICBmdW5jdGlvbiBjbGFtcCAodmFsLCBtYXgsIG1pbikge1xuICAgIHZhciB2YWx1ZSA9IHZhbFxuXG4gICAgaWYgKHZhbHVlID4gbWF4KSB2YWx1ZSA9IG1heFxuICAgIGVsc2UgaWYgKHZhbHVlIDwgbWluKSB2YWx1ZSA9IG1pblxuXG4gICAgcmV0dXJuIHZhbHVlXG4gIH1cbn1cblxuLy8gY3VzdG9tIGRpcmVjdGl2ZSB0byBsaW5rIHBoYXNlciBvYmplY3QgdG8gYW5ndWxhclxuXG5hcHAuZGlyZWN0aXZlKCdnYW1lQ2FudmFzJywgZnVuY3Rpb24gKCRpbmplY3RvciwgR2FtZUZhY3RvcnkpIHtcbiAgbGV0IGxpbmtGbiA9IGZ1bmN0aW9uIChzY29wZSwgZWxlLCBhdHRycykge1xuICAgIHNjb3BlLnNjcmVhbSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdTQ1JFRUVFQUFBQUFBTUlORyEnKVxuICAgICAgY29uc29sZS5sb2coc2NvcGUucGxheWVycy5uYW1lKVxuICAgIH1cbiAgICBjcmVhdGVHYW1lKGVsZSwgc2NvcGUsIHNjb3BlLnBsYXllcnMsIHNjb3BlLm1hcElkLCAkaW5qZWN0b3IpXG4gICAgY29uc29sZS5sb2coJ0lOU0lERSBQQVJFTlQgRElSRUNUSVZFOiAnLCBzY29wZS5wbGF5ZXJzLm5hbWUpXG4gICAgY29uc29sZS5sb2coJ0lOU0lERSBQQVJFTlQgRElSRUNUSVZFOiAnLCBzY29wZSlcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgc2NvcGU6IHtcbiAgICAgIHBsYXllcnM6ICc9JyxcbiAgICAgIG1hcElkOiAnPSdcbiAgICB9LFxuICAgIHRlbXBsYXRlOiAnPGRpdiBpZD1cImdhbWVDYW52YXNcIj48L2Rpdj4nLFxuICAgIGxpbms6IGxpbmtGblxuICB9XG59KVxuIiwiYXBwLmRpcmVjdGl2ZSgnbmF2YmFyJywgZnVuY3Rpb24gKCRyb290U2NvcGUsIFNvY2tldCwgQXV0aFNlcnZpY2UsIEFVVEhfRVZFTlRTLCAkc3RhdGUpIHtcbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0UnLFxuICAgIHNjb3BlOiB7fSxcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuaHRtbCcsXG4gICAgbGluazogZnVuY3Rpb24gKHNjb3BlKSB7XG4gICAgICBzY29wZS5pdGVtcyA9IFtcbiAgICAgICAge2xhYmVsOiAnQWNjb3VudCBTZXR0aW5ncycsIHN0YXRlOiAnbWFzdGVyLm5hdmJhci5zaWdudXAtc2V0dGluZ3MnLCBhdXRoOiB0cnVlfSxcbiAgICAgICAge2xhYmVsOiAnVGFza3MnLCBzdGF0ZTogJ21hc3Rlci5uYXZiYXIudGFza3MnLCBhdXRoOiB0cnVlfVxuICAgICAgXVxuXG4gICAgICBzY29wZS51c2VyID0gbnVsbFxuXG4gICAgICAkcm9vdFNjb3BlLnNvY2tldCA9IFNvY2tldFxuXG4gICAgICBzY29wZS5pc0xvZ2dlZEluID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKClcbiAgICAgIH1cblxuICAgICAgc2NvcGUubG9nb3V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBBdXRoU2VydmljZS5sb2dvdXQoKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAkc3RhdGUuZ28oJ21hc3Rlci5uYXZiYXIuaG9tZScpXG4gICAgICAgIH0pXG4gICAgICB9XG5cbiAgICAgIHZhciBzZXRVc2VyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgICAgc2NvcGUudXNlciA9IHVzZXJcbiAgICAgICAgICBpZiAodXNlcikgJHN0YXRlLmdvKCdtYXN0ZXIubmF2YmFyLnRhc2tzJylcbiAgICAgICAgfSlcbiAgICAgIH1cblxuICAgICAgdmFyIHJlbW92ZVVzZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNjb3BlLnVzZXIgPSBudWxsXG4gICAgICB9XG5cbiAgICAgIHNldFVzZXIoKVxuXG4gICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5sb2dpblN1Y2Nlc3MsIHNldFVzZXIpXG4gICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5sb2dvdXRTdWNjZXNzLCByZW1vdmVVc2VyKVxuICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsIHJlbW92ZVVzZXIpXG4gICAgfVxuXG4gIH1cbn0pXG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbWFzdGVyLm5hdmJhcicsIHtcbiAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXItc3RhdGUuaHRtbCcsXG4gICAgY29udHJvbGxlcjogZnVuY3Rpb24gKCRzdGF0ZSwgJHNjb3BlKSB7XG4gICAgICAkc3RhdGUuZ28oJ21hc3Rlci5uYXZiYXIuaG9tZScpXG4gICAgfVxuICB9KVxufSlcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
