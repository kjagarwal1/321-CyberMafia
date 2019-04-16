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
    self.status = 1;
    //self.characterType = 0;

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
        //player.id = i;
    }
    return pack;
}
Player.updateID = function (id) {
    Player.list[id].id = id;
}
Player.getUsername = function (id) {
    return Player.list[id].username;
}
Player.kill = function (id) {
    Player.list[id].status = 0;
}
Player.save = function (id) {
    Player.list[id].status = 1;
}
Player.getStatus = function (id) {
    return Player.list[id].status;
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
            assignCharacters();
            for (var i in SOCKET_LIST) {
                SOCKET_LIST[i].id = i;
                Player.updateID(i);
            }
            console.log('characters assigned');
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
            if (Player.getStatus(i) === 1)
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

function beginGame() {
    console.log("begin new game");
    // socket 0 = mafia
    // socket 1 = doctor
    // socket 2 = dective
    // socket 3 = civilian
    playersAlive = playerNum; //count to keep track of how many players are alive 
    intro(); //introduce the characters to the game
    //cycle through day and night cycle until the mafia is dead
    //or there is equal mafia to townspeople
    var cycleNum = 1;
    while (Player.getStatus(0) === 1 && playersAlive > 2) {
         if (cycleNum % 2 === 0) {
            dayCycle();
            console.log("day cycle complete");
        }
        //else {
          //  nightCycle();
            //console.log("night cycle complete");
        //}

        console.log('cycle ' + cycleNum);
        cycleNum++;
        playersAlive--;
    }

    console.log('loop end');

    if (Player.getStatus(0) === 1)
        outro(1);
    else
        outro(2);

    //reset variables
    playerNum = 0;
    mafiaAlive = true;
}

function dayCycle() {
    var v = [0, 0, 0, 0, 0];
    var maxVotes = 0;
    var maxPlayer = 5;

    for (var i in SOCKET_LIST) {
        SOCKET_LIST[i].emit('addToChat', "Good morning Masonville, I'm so glad to see you survived!");
        SOCKET_LIST[i].emit('addToChat', "But now you must choose who you think is the Mafia.");
        SOCKET_LIST[i].emit('addToChat', "Feel free to discuss with the other players.");
        SOCKET_LIST[i].emit('addToChat', '-----');
    }

    for (var i in SOCKET_LIST) {
        //var id = SOCKET_LIST[i].emit('buttonPressed', Player.list[i]);
        var id = 1;
        if (id === 0)      { v[0]++; }
        else if (id === 1) { v[1]++; }
        else if (id === 2) { v[2]++; }
        else if (id === 3) { v[3]++; }
        else               { v[4]++; }
    }

    for (var i = 0; i < 4; i++) {
        if (v[i] > maxVotes) {
            maxVotes = v[i];
            maxPlayer = i;
        }
    }

    //highest voted player is already dead
    if (Player.getStatus(maxPlayer) === 0) {
        for(var i in SOCKET_LIST) {
            SOCKET_LIST[i].emit('addToChat', "You tried to kill someone who is already dead!");
            SOCKET_LIST[i].emit('addToChat', "Oh well...");
            SOCKET_LIST[i].emit('addToChat', "-----");
        }
        console.log('voted to kill dead player');
    }
    //hightest voted player is still alive
    else {
        //highest voted player is mafia
        if (maxPlayer == 0) {
            for (var i in SOCKET_LIST) {
                SOCKET_LIST[i].emit('addToChat', "Good work everyone! You've rooted out the Mafia!");
                SOCKET_LIST[i].emit('addToChat', "THE MAFIA IS DEAD!");
                SOCKET_LIST[i].emit('addToChat', "-----");
            }

            SOCKET_LIST[maxPlayer].emit('addToChat', "You have been killed by the townspeople.");
            SOCKET_LIST[maxPlayer].emit('addToChat', "-----");

            SOCKET_LIST[maxPlayer].emit('roleWrite', "Status: Dead");

            Player.kill(maxPlayer);
            console.log('mafia killed');
        }
        //highest voted player is non-mafia
        else {
            for (var i in SOCKET_LIST) {
                SOCKET_LIST[i].emit('addToChat', "Unfortunately, that was not the right person.");
                SOCKET_LIST[i].emit('addToChat', Player.getUsername(maxPlayer) + ", an inosent townperson, has now been killed.");
                SOCKET_LIST[i].emit('addToChat', "-----");
            }

            SOCKET_LIST[maxPlayer].emit('addToChat', "You have been killed by your fellow townspeople.");
            SOCKET_LIST[maxPlayer].emit('addToChat', "-----");

            SOCKET_LIST[maxPlayer].emit('roleWrite', "Status: Dead");

            Player.kill(id);
            playersAlive--;
            console.log('townperson killed')
        }
    }
}


//shuffle the player list to assign characters to the players
function assignCharacters() {
    //randomly shuffle the player and socket lists
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
        //print the users name into their role box
        SOCKET_LIST[i].emit('roleWrite', 'Username: ' + Player.getUsername(i));

        //print the users character type into their own role box
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
    //intro message is printed to everyone
    for (var i in SOCKET_LIST) {
        SOCKET_LIST[i].emit('addToChat', 'I wish you could have visted our town under better circumstances.');
        SOCKET_LIST[i].emit('addToChat', 'Unfortunately, we have had a recent run in with the Mafia');
        SOCKET_LIST[i].emit('addToChat', 'Every night when the sun sets, the Mafia go out and kill someone.');
        SOCKET_LIST[i].emit('addToChat', 'We live in a small town and we only have one doctor and one detective.');
        SOCKET_LIST[i].emit('addToChat', "So, we can't always save the people who are attacked.");
        SOCKET_LIST[i].emit('addToChat', "Well, I hope I didn't scare you too much, just get some rest,");
        SOCKET_LIST[i].emit('addToChat', 'hopefully we see you in the morning.');
        SOCKET_LIST[i].emit('addToChat', '-----');
    }
} 

function outro(x) {
    //messages are printed to everyone
    //Mafia wins the game
    if (x === 1) {
        for (var i in SOCKET_LIST) {
            var socket = SOCKET_LIST[i];
            socket.emit('addToChat', "It is a dark day in Masonville.");
            socket.emit('addToChat', "Our town has officially been taken over by the Mafia!");
            socket.emit('addToChat', "-----");
            socket.emit('addToChat', "GAME OVER");
        }
    }

    //Mafia loses the game
    else {
        for (var i in SOCKET_LIST) {
            var socket = SOCKET_LIST[i];
            socket.emit('addToChat', "Congradulations people of Masonville.");
            socket.emit('addToChat', "Our town has finally driven off the Mafia!");
            socket.emit('addToChat', "------");
            socket.emit('addToChat', "GAME OVER");
        }
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