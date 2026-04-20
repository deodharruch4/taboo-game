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

    rooms[roomId].players.push(socket.id);

    socket.to(roomId).emit("peer-joined", socket.id);
  });

  // 🎮 START GAME
  socket.on("start-game", roomId => {
    const room = rooms[roomId];
    if (!room || room.players.length < 2) return;

    const word = words[Math.floor(Math.random() * words.length)];

    const speaker =
      room.players[Math.floor(Math.random() * room.players.length)];

    const startTime = Date.now();

    gameState[roomId] = {
      word,
      speaker,
      won: false,
      startTime
    };

    room.players.forEach(playerId => {
      io.to(playerId).emit("game-start", {
        word,
        speaker,
        startTime
      });
    });
  });

  // 💡 CLUE
  socket.on("clue", ({ roomId, clue }) => {
    io.to(roomId).emit("clue", clue);
  });

  // 🤔 GUESS + WIN LOGIC
  socket.on("guess", ({ roomId, guess }) => {
    const game = gameState[roomId];
    if (!game || game.won) return;

    io.to(roomId).emit("guess", guess);

    if (
      guess.toLowerCase() === game.word.word.toLowerCase()
    ) {
      game.won = true; // 🔒 LOCK GAME

      io.to(roomId).emit("win", {
        winner: socket.id
      });
    }
  });

  // 🔁 RESET GAME
  socket.on("reset-game", roomId => {
    gameState[roomId] = null;
    io.to(roomId).emit("reset-game");
  });

  // 🌐 WEBRTC SIGNAL
  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", { from: socket.id, data });
  });

});

server.listen(3000, () =>
  console.log("Server running on port 3000")
);