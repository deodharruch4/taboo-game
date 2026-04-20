const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: { origin: "*" }
});

// load words
const words = require("../client/words.json");

let rooms = {};

io.on("connection", socket => {

  socket.on("join-room", roomId => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = { players: [] };
    }

    rooms[roomId].players.push(socket.id);

    socket.to(roomId).emit("peer-joined", socket.id);

    console.log(`User joined room ${roomId}`);
  });

  // 🔥 START GAME (SERVER CONTROLS EVERYTHING)
  socket.on("start-game", roomId => {
    const room = rooms[roomId];
    if (!room) return;

    // pick random word
    const word = words[Math.floor(Math.random() * words.length)];

    // pick random speaker
    const speaker =
      room.players[Math.floor(Math.random() * room.players.length)];

    const startTime = Date.now();

    // send role-specific data
    room.players.forEach(playerId => {
      io.to(playerId).emit("game-start", {
        word: playerId === speaker ? word : null,
        isSpeaker: playerId === speaker,
        startTime
      });
    });
  });

  // relay signals (WebRTC)
  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", { from: socket.id, data });
  });

});
  
server.listen(3000, () => console.log("Server running on port 3000"));