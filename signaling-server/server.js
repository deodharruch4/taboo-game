const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: { origin: "*" }
});

const words = require("../client/words.json");

let rooms = {};
let gameState = {};

io.on("connection", socket => {

  socket.on("join-room", roomId => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = { players: [] };
    }

    if (!rooms[roomId].players.includes(socket.id)) {
      rooms[roomId].players.push(socket.id);
    }

    socket.to(roomId).emit("peer-joined", socket.id);
  });

  // 🎮 START GAME (NEW ROUND SYSTEM)
  socket.on("start-game", roomId => {
    const room = rooms[roomId];
    if (!room || room.players.length < 2) return;

    const word = words[Math.floor(Math.random() * words.length)];

    const speaker =
      room.players[Math.floor(Math.random() * room.players.length)];

    const roundId = Date.now();

    gameState[roomId] = {
      word,
      speaker,
      won: false,
      roundId
    };

    room.players.forEach(playerId => {
      io.to(playerId).emit("game-start", {
        word,
        speaker,
        startTime: Date.now(),
        roundId
      });
    });
  });

  // 💡 CLUE
  socket.on("clue", ({ roomId, clue }) => {
    io.to(roomId).emit("clue", clue);
  });

  // 🤔 GUESS + WIN LOCK
  socket.on("guess", ({ roomId, guess }) => {
    const game = gameState[roomId];
    if (!game || game.won) return;

    io.to(roomId).emit("guess", guess);

    if (guess.toLowerCase() === game.word.word.toLowerCase()) {
      game.won = true;

      io.to(roomId).emit("win", {
        winner: socket.id,
        roundId: game.roundId
      });
    }
  });

  // 🔁 RESET GAME
  socket.on("reset-game", roomId => {
    gameState[roomId] = null;
    io.to(roomId).emit("reset-game");
  });

});
server.listen(3000, () =>
  console.log("Server running on port 3000")
);