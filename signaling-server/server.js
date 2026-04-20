const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: { origin: "*" }
});

const words = require("../client/words.json");

// ---------------- STATE ----------------
let rooms = {};
let gameState = {};

// ---------------- HELPERS ----------------
function emitRoomUpdate(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  io.to(roomId).emit("room-update", {
    players: room.players,
    count: room.players.length
  });
}

// ---------------- CONNECTION ----------------
io.on("connection", socket => {

  // 👤 JOIN
  socket.on("join-room", ({ roomId, name }) => {

    socket.join(roomId);
    socket.data.name = name;

    if (!rooms[roomId]) {
      rooms[roomId] = { players: [] };
    }

    // avoid duplicates (IMPORTANT FIX)
    rooms[roomId].players =
      rooms[roomId].players.filter(p => p.id !== socket.id);

    rooms[roomId].players.push({
      id: socket.id,
      name
    });

    emitRoomUpdate(roomId);
  });

  // 🎮 START GAME (ONLY IF 2+ PLAYERS)
  socket.on("start-game", roomId => {

    const room = rooms[roomId];
    if (!room || room.players.length < 2) return;

    const roundId = Date.now();

    const word = words[Math.floor(Math.random() * words.length)];

    // FIXED ROLE ASSIGNMENT (SERVER ONLY DECIDES)
    const speakerIndex = Math.floor(Math.random() * room.players.length);
    const speaker = room.players[speakerIndex];

    gameState[roomId] = {
      word,
      speakerId: speaker.id,
      roundId,
      won: false
    };

    // send ROLE PER PLAYER (CRITICAL FIX)
    room.players.forEach(player => {
      io.to(player.id).emit("game-start", {
        word,
        role: player.id === speaker.id ? "speaker" : "guesser",
        speaker: speaker.id,
        startTime: Date.now(),
        roundId
      });
    });
  });

  // 💡 CLUE
  socket.on("clue", ({ roomId, clue }) => {
    io.to(roomId).emit("clue", {
      clue,
      by: socket.data.name
    });
  });

  // 🤔 GUESS + WIN LOCK
  socket.on("guess", ({ roomId, guess }) => {

    const game = gameState[roomId];
    if (!game || game.won) return;

    io.to(roomId).emit("guess", {
      guess,
      by: socket.data.name
    });

    if (guess.toLowerCase() === game.word.word.toLowerCase()) {

      game.won = true;

      io.to(roomId).emit("win", {
        winner: socket.data.name,
        roundId: game.roundId
      });
    }
  });

  // 🔁 RESET
  socket.on("reset-game", roomId => {
    gameState[roomId] = null;
    io.to(roomId).emit("reset-game");
  });

  // 👋 DISCONNECT
  socket.on("disconnect", () => {

    for (let roomId in rooms) {

      rooms[roomId].players =
        rooms[roomId].players.filter(p => p.id !== socket.id);

      emitRoomUpdate(roomId);
    }
  });
});

server.listen(3000, () =>
  console.log("Server running on port 3000")
);