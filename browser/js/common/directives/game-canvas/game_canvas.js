// testing for phaser

window.createGame = function (ele, scope, players, mapId, injector) {

  var game = new Phaser.Game(960, 600, Phaser.CANVAS, 'gameCanvas', { preload: preload, create: create, update: update, render: render })
  // The walk through: Make new pseudo-iframe object. The world and camera have a width, height of 960, 600
  // My parent div is phaser-example
  // My preload function is titled preload, create: create, update: update, and render: render

  function preload () {
    game.stage.backgroundColor = '#76bcbb'
    // game.load.image('mushroom', 'pimages/star.png')
    game.load.tilemap('map', 'pmaps/bunkerv1.json', null, Phaser.Tilemap.TILED_JSON)
    game.load.image('tiles', 'pmaps/tmw_desert_spacing.png')
    game.load.image('tiles2', 'pmaps/sewer_tileset.png')
    game.load.spritesheet('player', 'pimages/dude.png', 32, 48)
  }
  // Set bg color behind all elements in this frame
  // Load my tilemap - a json that can be found in assets - that is essentially a matrix of png elements
  // load the sheets of png's that this map uses
  // Now load the 'spritesheet' the image that is the character - it has nine frames - 4 right, 4 left, 1 standing still

  var cursors
  var o_camera
  var cameraDrag = 5
  var cameraAccel = 3
  var camVelX = 0
  var camVelY = 0
  var camMaxSpeed = 80
  var map
  var layer, layer2, layer3, layer4
  var tile
  var log
  var tileUp = false
  var player
  var marker
  var leftKey, rightKey
  // declare semi globals - figure it out

  function create () {
    game.physics.startSystem(Phaser.Physics.ARCADE)
    // Multiple systems of physics, this is the simplest.

    map = game.add.tilemap('map')
    map.addTilesetImage('bunkerv2', 'tiles')
    map.addTilesetImage('sewer_tileset', 'tiles2')
    layer3 = map.createLayer('Bounds')
    layer = map.createLayer('Ground')
    layer2 = map.createLayer('Bunker')
	  layer2
    layer4 = map.createLayer('Interactive')
    // Add all the elements we preloaded.
    // The tilemap has layers - the bunker, its bg, and what the player collides with - check out Tiled
    game.world.setBounds(0, 0, 960, 3040)
    game.world.resize(960, 3040)
    // Sets the physics bounds of the world - startx, starty, maxx, maxy

    marker = game.add.graphics()
    marker.lineStyle(2, 0xffffff, 1)
    marker.drawRect(0, 0, 32, 32)
    // Create the things that allow us to select tiles

    game.input.addMoveCallback(updateMarker, this)
    // What happens when i move the mouse? Add a listener and bind this

    map.setCollision(55, true, layer3)
    map.setCollision(64, false, layer4)
    map.setTileIndexCallback(64, moveDown, this, layer4)
    map.setTileIndexCallback(65, moveUp, this, layer4)
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
    var g = game.add.group()
    g.x = 500
    // Disregard - may be used later.

    cursors = game.input.keyboard.createCursorKeys()
    // Create input keys - aka ASCII abstraction - removes their ability to be used by DOM
    game.inputEnabled = true
    game.input.onDown.add(logTile, this)
    // OKAY - input enabled is 1/2 things for touch enabled. May not work yet.
    // game.input = mouse
    // onDown = event
    // add = addListener function
    // logTile - the listener function
    // bind this

    player = game.add.sprite(32, 280, 'player')
    // Add the player spritesheet - it has 32, 32 dimensions

    game.physics.enable(player)
    // Physics apply to this element

    game.physics.arcade.gravity.y = 250
    // This is how intensely y grid physics apply

    player.body.linearDamping = 1
    // Damp the effects of physics misc functions 100%
    player.body.collideWorldBounds = true
    // I cannot escape world boundaries
    player.body.checkCollision.right = true
    // I follow the rules of walls to the right
    player.body.checkCollision.left = true
    // I follow the rules of walls to the left

    player.animations.add('left', [0, 1, 2, 3], 10, true)
    player.animations.add('right', [5, 6, 7, 8], 10, true)
    // Name animation, what frames is this animation, at what FPS, do I idle otherwise?

    leftKey = game.input.keyboard.addKey(Phaser.Keyboard.LEFT)
    rightKey = game.input.keyboard.addKey(Phaser.Keyboard.RIGHT)
  // Alias keys - didnt work otherwise, dont ask.
  }

  function update () {
    game.physics.arcade.collide(player, layer3)
    game.physics.arcade.collide(player, layer4)
    // The only layer of the map i collide with is layer 3 - and based on above - tile 55 of layer 3
    player.body.velocity.x = 0
    // Every 1/60 frame, reset x velocity

    if (leftKey.isDown) {
      //  Move to the left
      player.body.velocity.x = -150
      // by this much

      player.animations.play('left')
    // animate this
    } else {
      if (rightKey.isDown) {
        //  Move to the right
        player.body.velocity.x = 150
        // by this much

        player.animations.play('right')
      // animate this
      } else {
        player.animations.stop()
        // otherwise, standstill

        player.frame = 4
      // at this frame
      }
    }
    if (cursors.up.isDown) {
      // Move world up
      game.camera.y -= 4
    // by this much
    } else {
      if (cursors.down.isDown) {
        // move world down
        game.camera.y += 4
      // by this much
      }
    }
    drag_camera(game.input.mousePointer)
    drag_camera(game.input.pointer1)
    update_camera()
  // Monitor mouse/touch world movement
  }

  function render () {
    game.debug.cameraInfo(game.camera, 32, 32)
    // Show camera info
    game.debug.text('Tile Info: ' + log, 32, 570)
  // Show selected tile
  }

  // Experimental staircase function
  function moveDown () {
    console.log('Attempting to teleport down!')
    if (player.body.x > (game.world.width / 2)) {
      player.body.x = player.body.x - 32
    } else {
      player.body.x = player.body.x + 32
    }
    player.body.y = player.body.y + (32 * 7)
    if (player.body.y > (game.camera.y + game.camera.height - 96)) {
      game.camera.y += game.camera.height / 2
    }
  }

  //
  function moveUp () {
    console.log('Attempting to teleport!')
    if (player.body.x > (game.world.width / 2)) {
      player.body.x = player.body.x - 32
    } else {
      player.body.x = player.body.x + 32
    }
    player.body.y = player.body.y - (32 * 7)
    if (player.body.y < (game.camera.y + 96)) {
      game.camera.y -= game.camera.height / 2
    }
  }

  function logTile () {
    let tileR = getTileProperties()
    // Grab selected tile info
    console.log('Tile R: ')
    console.log(tileR)
    if (Number(tileR.index) > 63) {
      tileUp = false
    // Arbitrary #, but start counting down if above this - needs work
    } else {
      if (Number(tileR.index) < 1) {
        tileUp = true
      // Arbitrary #, but start counting up if below this - needs work
      }
    }
    let nextTile
    if (tileUp) {
      nextTile = Number(tileR.index) + 1
    } else {
      nextTile = Number(tileR.index) - 1
    }
    // Move in x direction
    map.removeTile(tileR.x, tileR.y, layer3).destroy()
    map.putTile(nextTile, tileR.x, tileR.y, layer3)
  // Self-explanatory - remove selected tile - move in decided direction
  }

  function drag_camera (o_pointer) {
    if (!o_pointer.timeDown) {
      // If click isnt longer than a click
      return
    }
    if (o_pointer.isDown && !o_pointer.targetObject) {
      // If ive stayed down, and this isnt one of my target objects ala exception cases
      if (o_camera) {
        camVelX = (o_camera.x - o_pointer.position.x) * cameraAccel
        camVelY = (o_camera.y - o_pointer.position.y) * cameraAccel
      // Figure out diff - multiply by accel
      }
      o_camera = o_pointer.position.clone()
    // else were the same mofucka
    }

    if (o_pointer.isUp) {
      o_camera = null
    }
  // If nothings going on, no deal
  }

  function getTileProperties () {
    var x = layer3.getTileX(game.input.activePointer.worldX)
    var y = layer3.getTileY(game.input.activePointer.worldY)
    // find the tile location based on mouse location (diff x, y vals)

    tile = map.getTile(x, y, layer3)
    // Grab tile objects based on these
    console.log(tile)
    log = tile.index
    // Set semi-glob to this
    console.log({x: x, y: y, index: tile.index})
    // Return object with pertinent data
    return {x: x, y: y, index: tile.index}
  }

  // Not worth getting too into - essentially the physics of moving camera via mouse.
  // Mix of old games ive made and online stuff. Live with other peoples work. it works.
  // May need some work for touch enabled.
  function update_camera () {
    camVelX = clamp(camVelX, camMaxSpeed, -camMaxSpeed)
    camVelY = clamp(camVelY, camMaxSpeed, -camMaxSpeed)

    game.camera.x += camVelX
    game.camera.y += camVelY

    // Set Camera Velocity X Drag
    if (camVelX > cameraDrag) {
      camVelX -= cameraDrag
    } else if (camVelX < -cameraDrag) {
      camVelX += cameraDrag
    } else {
      camVelX = 0
    }

    // Set Camera Velocity Y Drag
    if (camVelY > cameraDrag) {
      camVelY -= cameraDrag
    } else if (camVelY < -cameraDrag) {
      camVelY += cameraDrag
    } else {
      camVelY = 0
    }
  }

  function updateMarker () {
    marker.x = layer.getTileX(game.input.activePointer.worldX) * 32
    marker.y = layer.getTileY(game.input.activePointer.worldY) * 32
  }

  function clamp (val, max, min) {
    var value = val

    if (value > max) value = max
    else if (value < min) value = min

    return value
  }
}

// custom directive to link phaser object to angular

app.directive('gameCanvas', function ($injector, GameFactory) {
  let linkFn = function (scope, ele, attrs) {
    scope.scream = function () {
      console.log('SCREEEEAAAAAAMING!')
      console.log(scope.players.name)
    }
    createGame(ele, scope, scope.players, scope.mapId, $injector)
    console.log('INSIDE PARENT DIRECTIVE: ', scope.players.name)
    console.log('INSIDE PARENT DIRECTIVE: ', scope)
  }

  return {
    scope: {
      players: '=',
      mapId: '='
    },
    template: '<div id="gameCanvas"></div>',
    link: linkFn
  }
})
