const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: { origin: "*" }
});

// WORD DATA
const words = require("../client/words.json");

// ROOMS STORE
let rooms = {};

io.on("connection", socket => {

  console.log("User connected:", socket.id);

  // JOIN ROOM
  socket.on("join-room", roomId => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = { players: [] };
    }

    rooms[roomId].players.push(socket.id);

    socket.to(roomId).emit("peer-joined", socket.id);
  });

  // START GAME (SERVER AUTHORITATIVE)
  socket.on("start-game", roomId => {
    const room = rooms[roomId];
    if (!room || room.players.length < 2) return;

    const word =
      words[Math.floor(Math.random() * words.length)];

    const speaker =
      room.players[Math.floor(Math.random() * room.players.length)];

    const startTime = Date.now();

    room.players.forEach(playerId => {
      io.to(playerId).emit("game-start", {
        word,
        speaker,
        startTime
      });
    });
  });

  // CLUE
  socket.on("clue", ({ roomId, clue }) => {
    io.to(roomId).emit("clue", clue);
  });

  // GUESS
  socket.on("guess", ({ roomId, guess }) => {
    io.to(roomId).emit("guess", guess);
  });

  // WIN
  socket.on("win", roomId => {
    io.to(roomId).emit("win");
  });

  // SIGNAL (WEBRTC)
  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", { from: socket.id, data });
  });

});

server.listen(3000, () =>
  console.log("Server running on port 3000")
);