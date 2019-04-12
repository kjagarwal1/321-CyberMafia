var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(2000);
console.log("Server started.");

var SOCKET_LIST = {};
var playerNum = 0;
var playersAlive = 0;

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

var Player = function (id) {
    var self = Entity();
    self.id = id;
    self.number = "" + Math.floor(10 * Math.random());
    self.username = "";
    self.pressingRight = false;
    self.pressingLeft = false;
    self.pressingUp = false;
    self.pressingDown = false;
    self.maxSpd = 10;
    self.status = 1;

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
    var player = Player(socket.id);
    player.username = username;
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
    //Player.list[socket.id].status = 0;
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
            number: player.number
        });
    }
    return pack;
}
var DEBUG = true;

var io = require('socket.io')(serv, {});
io.sockets.on('connection', function (socket) {
    socket.id = Math.random();
    SOCKET_LIST[socket.id] = socket;
    var username;
    socket.on('signIn', function (data) {
        username = data.username;
        Player.onConnect(socket, data.username);
        socket.emit('signInResponse');
        playerNum++;
        console.log("player joined");
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
            if (Player.list[i].status === 1)
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

setInterval(function () {
    var pack = {
        player: Player.update(),
    }
    for (var i in SOCKET_LIST) {
        var socket = SOCKET_LIST[i];
        socket.emit('newPositions', pack);
    }
}, 1000 / 25);

function beginGame() {
    console.log("begin new game");
    assignCharacters(); //shuffel the list to assign the character types to the players
    playersAlive = playerNum; //count to keep track of how many players are alive 
    intro(); //introduce the characters to the game
    console.log("intro complete");
    //cycle through day and night cycle until the mafia is dead
    //or there is equal mafia to townspeople
    var cycleNum = 1;
    while (Player.list[0].status === 1 && playersAlive >= 3) {
        if (cycleNum % 2 === 0) {
            dayCycle();
            console.log("day cycle complete");
        }
        else {
            nightCycle();
            console.log("night cycle complete");
        }   
        cycleNum++;
    }
    //if the mafia character is dead
    if (Player.list[0].status === 0)
        outro(1);
    //if the mafia character is alive
    else
        outro(2);
}

//shuffle the player list to assign characters to the players
function assignCharacters() {
    for (let i = (Player.list).length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i
        [Player.list[i], Player.list[j]] = [Player.list[j], Player.list[i]]; // swap elements
    }
    // 0 = mafia
    // 1 = doctor
    // 2 = dective
    // 3 = civilian
}

function intro() {
    // set roles in HTML here
    SOCKET_LIST[0].emit('addToChat', "Hello MAFIA and welcome to Masonville!");
    SOCKET_LIST[1].emit('addToChat', "Hello DOCTOR and welcome to Masonville!");
    SOCKET_LIST[2].emit('addToChat', "Hello DETECTIVE and welcome to Masonville!");
    SOCKET_LIST[3].emit('addToChat', "Hello CIVILIAN and welcome to Masonville!");

    for (var i in SOCKET_LIST) {
        SOCKET_LIST[i].emit('addToChat', 'I wish you could have visted our town under better circumstances.');
        SOCKET_LIST[i].emit('addToChat', 'Unfortunately, we have had a recent run in with the Mafia');
        SOCKET_LIST[i].emit('addToChat', 'Every night when the sun sets, the Mafia go out and kill someone.');
        SOCKET_LIST[i].emit('addToChat', 'We live in a small town and we only have one doctor and one detective.');
        SOCKET_LIST[i].emit('addToChat', "So, we can't always save the people who are attacked.");
        SOCKET_LIST[i].emit('addToChat', "Well, I hope I didn't scare you too much, just get some rest,");
        SOCKET_LIST[i].emit('addToChat', 'hopefully we see you in the morning.');
    }
}


function outro(x) {
    if (x === 1) {

    }
    if (x === 2) {

    }

}

var nightCycleIntros = [
    "Dark has fallen over Masonville and the Mafia are at it again.",
    "It's night time once again and Masonville is underattack by the Mafia."
]

var dayCycleIntrosDeath = [
    "Good morning people of Masonville. Unfortunately, last night we lost one our own last night.",
    "The sun may have risen today on Masonville, but sadly one of us never will."
]

var dayCycleIntrosAlive = [
    "Good morning people of Masonville. Last night we were very lucky and everyone survived.",
    "It's a good day in Masonville. Last night, the doctor saved someone who was attacked."
]