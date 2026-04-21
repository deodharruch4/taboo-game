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

  // 👤 JOIN ROOM
  socket.on("join-room", ({ roomId, name }) => {

    socket.join(roomId);
    socket.data.name = name;

    if (!rooms[roomId]) {
      rooms[roomId] = { players: [] };
    }

    // avoid duplicate entries
    rooms[roomId].players =
      rooms[roomId].players.filter(p => p.id !== socket.id);

    rooms[roomId].players.push({
      id: socket.id,
      name
    });

    emitRoomUpdate(roomId);
  });

  // 🎮 START GAME (FIXED)
  socket.on("start-game", roomId => {

    const room = rooms[roomId];
    if (!room || room.players.length < 2) return;

    // 🚫 prevent start ONLY if active game exists
    const game = gameState[roomId];
    if (game && !game.won) return;

    const roundId = Date.now();

    const word = words[Math.floor(Math.random() * words.length)];

    // 🎯 stable speaker selection
    const speakerIndex = roundId % room.players.length;
    const speaker = room.players[speakerIndex];

    gameState[roomId] = {
      word,
      speakerId: speaker.id,
      roundId,
      won: false
    };

    room.players.forEach(player => {
      io.to(player.id).emit("game-start", {
        word,
        role: player.id === speaker.id ? "speaker" : "guesser",
        startTime: Date.now(),
        roundId
      });
    });
  });

  // 💡 CLUE (TABOO SAFE)
  socket.on("clue", ({ roomId, clue }) => {

    const game = gameState[roomId];
    if (!game || game.won) return;

    const normalizedClue = clue.toLowerCase();
    const tabooWords = game.word.taboo.map(w => w.toLowerCase());

    const violated = tabooWords.find(taboo =>
      normalizedClue.includes(taboo)
    );

    if (violated) {

      io.to(roomId).emit("system", {
        message: `🚫 TABOO WORD USED: "${violated}" by ${socket.data.name}`
      });

      return; // ❌ DO NOT END GAME
    }

    io.to(roomId).emit("clue", {
      clue,
      by: socket.data.name
    });
  });

  // 🤔 GUESS (SAFE)
  socket.on("guess", ({ roomId, guess }) => {

    const game = gameState[roomId];
    if (!game || game.won) return;

    if (socket.id === game.speakerId) {
      io.to(socket.id).emit("system", {
        message: "🚫 Speaker cannot guess!"
      });
      return;
    }

    const normalizedGuess = guess.toLowerCase().trim();
    const word = game.word.word.toLowerCase();
    const tabooWords = game.word.taboo.map(w => w.toLowerCase());

    if (tabooWords.includes(normalizedGuess)) {
      io.to(roomId).emit("system", {
        message: `🚫 Taboo word guessed: "${guess}"`
      });
      return;
    }

    io.to(roomId).emit("guess", {
      guess,
      by: socket.data.name
    });

    if (normalizedGuess === word) {

      game.won = true;

      io.to(roomId).emit("win", {
        winner: socket.data.name,
        roundId: game.roundId
      });

      io.to(roomId).emit("system", {
        message: `🎉 ${socket.data.name} guessed correctly!`
      });
    }
  });

  // 🔁 RESET GAME (FIXED CLEAN RESET)
  socket.on("reset-game", roomId => {

    gameState[roomId] = null;

    io.to(roomId).emit("reset-game");
  });

  // 👋 DISCONNECT CLEANUP
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