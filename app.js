var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(2000);
console.log("Server started.");
//setting up the local host server

var SOCKET_LIST = {};
var playerNum = 0; 

var Entity = function () {
    var self = {
        x: 250,
        y: 250,
        spdX: 0,
        spdY: 0,
        id: "",
    }
    self.update = function () {
        self.updatePosition();
    }
    self.updatePosition = function () {
        self.x += self.spdX;
        self.y += self.spdY;
    }
    return self;
}

var Player = function (id, user) {
    var self = Entity();
    self.id = id;
    self.number = "" + Math.floor(10 * Math.random());
    self.username = user;
    self.pressingRight = false;
    self.pressingLeft = false;
    self.pressingUp = false;
    self.pressingDown = false;
    self.maxSpd = 10;
    //self.status = 1;
    self.characterType = 0;

    var super_update = self.update;
    self.update = function () {
        self.updateSpd();
        super_update();
    }


    self.updateSpd = function () {
        if (self.pressingRight)
            self.spdX = self.maxSpd;
        else if (self.pressingLeft)
            self.spdX = -self.maxSpd;
        else
            self.spdX = 0;

        if (self.pressingUp)
            self.spdY = -self.maxSpd;
        else if (self.pressingDown)
            self.spdY = self.maxSpd;
        else
            self.spdY = 0;
    }
    Player.list[id] = self;
    return self;
}
Player.list = {};
Player.onConnect = function (socket, username) {
    var player = Player(socket.id, username);
    socket.on('keyPress', function (data) {
        if (data.inputId === 'left')
            player.pressingLeft = data.state;
        else if (data.inputId === 'right')
            player.pressingRight = data.state;
        else if (data.inputId === 'up')
            player.pressingUp = data.state;
        else if (data.inputId === 'down')
            player.pressingDown = data.state;
    });

}
Player.onDisconnect = function (socket) {
    delete Player.list[socket.id];
}
Player.update = function () {
    var pack = [];
    for (var i in Player.list) {
        var player = Player.list[i];
        player.update();
        pack.push({
            x: player.x,
            y: player.y,
            number: player.number,
            username: player.username
        });
    }
    return pack;
}
var DEBUG = true;

//var role = 0;
var io = require('socket.io')(serv, {});
io.sockets.on('connection', function (socket) {
    socket.id = playerNum;
    //role++;
    SOCKET_LIST[socket.id] = socket;
    var username;
    socket.on('signIn', function (data) {
        username = data.username;
        Player.onConnect(socket, data.username);
        socket.emit('signInResponse');
        playerNum++;
        if (playerNum === 4) {
            console.log("4 players reached");
            for (var i in SOCKET_LIST) {
                SOCKET_LIST[i].emit('addToChat', 'Four people have joined. The game will now begin!');
            }
            beginGame();
        }
    });
    socket.on('disconnect', function () {
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket);
        playerNum--;
    });
    socket.on('sendMsgToServer',function(data){
        for (var i in SOCKET_LIST) {
            SOCKET_LIST[i].emit('addToChat', username + ': ' + data);
		}
	});

    socket.on('evalServer', function (data) {
        if (!DEBUG)
            return;
        var res = eval(data);
        socket.emit('evalAnswer', res);
    });

    
});

var playersAlive = 0;
var mafiaAlive = true;

function beginGame() {
    console.log("begin new game");
    assignCharacters(); //shuffle the list to assign the character types to the players
    // socket 0 = mafia
    // socket 1 = doctor
    // socket 2 = dective
    // socket 3 = civilian
    console.log('characters assigned');
    playersAlive = playerNum; //count to keep track of how many players are alive 
    intro(); //introduce the characters to the game
    //cycle through day and night cycle until the mafia is dead
    //or there is equal mafia to townspeople
    var cycleNum = 1;
    while (mafiaAlive && playersAlive >= 3) {
        // if (cycleNum % 2 === 0) {
         //   dayCycle();
           // console.log("day cycle complete");
      //  }
        //else {
          //  nightCycle();
            //console.log("night cycle complete");
        //}

        console.log('cycle ' + cycleNum);
        cycleNum++;
        playersAlive--;
    }

    console.log('loop end')

   // if (mafiaAlive)
     //   outro(1);
   // else
    //   outro(2);
    playerNum = 0;
    mafiaAlive = true;
}
/*
function dayCycle() {
    var v = [0, 0, 0, 0, 0];
    var maxVotes = 0;
    var maxPlayer = 5;

    for (var i in SOCKET_LIST) {
        SOCKET_LIST[i].emit('addToChat', "Good morning Masonville, I'm so glad to see you survived!");
        SOCKET_LIST[i].emit('addToChat', "But now you must choose who you think is the Mafia.");
        SOCKET_LIST[i].emit('addToChat', "Feel free to discuss with the other players.");
        SOCKET_LIST[i].emit('addToChat', '');
    }

    for (var i in SOCKET_LIST) {
        var identification = SOCKET_LIST[i].emit('choosePlayer', Player.list[i]);
        if (SOCKET_LIST[0].id === identification)      { v[0]++; }
        else if (SOCKET_LIST[1].id === identification) { v[1]++; }
        else if (SOCKET_LIST[2].id === identification) { v[2]++; }
        else if (SOCKET_LIST[3].id === identification) { v[3]++; }
        else                                           { v[4]++; }
    }

    for (var i = 0; i < 4; i++) {
        if (v[i] > max) {
            maxVotes = v[i];
            maxPlayer = i;
        }
    }

    if (maxPlayer == 0) {
        for (var i in SOCKET_LIST) {
            SOCKET_LIST[i].emit('addToChat', "Good work everyone! You've done it!");
            SOCKET_LIST[i].emit('addToChat', "THE MAFIA IS DEAD!");
            SOCKET_LIST[i].emit('addToChat', "");
        }
        mafiaAlive = false;
    }
    else {
        for (var i in SOCKET_LIST) {
            SOCKET_LIST[i].emit('addToChat', "Unfortunately, that was not the right person.");
            SOCKET_LIST[i].emit('addToChat', "An inosent townsperson has now been killed.");
            SOCKET_LIST[i].emit('addToChat', "");
        }
        delete Player.list[maxPlayer];
        playersAlive--;
    }

}
*/

//shuffle the player list to assign characters to the players
function assignCharacters() {
    for (let i = 3; i >= 0; i--) {
        let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i
        [Player.list[i], Player.list[j]] = [Player.list[j], Player.list[i]]; // swap elements
        [SOCKET_LIST[i], SOCKET_LIST[j]] = [SOCKET_LIST[j], SOCKET_LIST[i]];
    }
    // 0 = mafia
    // 1 = doctor
    // 2 = dective
    // 3 = civilian
    
    for (let i = 3; i >= 0; i--) {
        SOCKET_LIST[i].emit('roleWrite', i);
        if (i == 0) {
            SOCKET_LIST[i].emit('roleWrite', "Character type: MAFIA");
        }
        else if (i == 1) {
            SOCKET_LIST[i].emit('roleWrite', "Character type: DOCTOR");
        }
        else if (i == 2) {
            SOCKET_LIST[i].emit('roleWrite', "Character type: DECTIVE");
        }
        else {
            SOCKET_LIST[i].emit('roleWrite', "Character type: CIVILIAN");
        }
    }
}

function intro() {

    for (var i in SOCKET_LIST) {
        SOCKET_LIST[i].emit('addToChat', 'I wish you could have visted our town under better circumstances.');
        SOCKET_LIST[i].emit('addToChat', 'Unfortunately, we have had a recent run in with the Mafia');
        SOCKET_LIST[i].emit('addToChat', 'Every night when the sun sets, the Mafia go out and kill someone.');
        SOCKET_LIST[i].emit('addToChat', 'We live in a small town and we only have one doctor and one detective.');
        SOCKET_LIST[i].emit('addToChat', "So, we can't always save the people who are attacked.");
        SOCKET_LIST[i].emit('addToChat', "Well, I hope I didn't scare you too much, just get some rest,");
        SOCKET_LIST[i].emit('addToChat', 'hopefully we see you in the morning.');
        SOCKET_LIST[i].emit('addToChat', '');
    }
} 

setInterval(function () {
    var pack = {
        player: Player.update(),
    }
    for (var i in SOCKET_LIST) {
        var socket = SOCKET_LIST[i];
        socket.emit('newPositions', pack);
    }
}, 1000 / 25);