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

// ---------------- HELPERS ----------------
function emitRoomUpdate(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  io.to(roomId).emit("room-update", {
    players: room.players,
    count: room.players.length
  });
}

// ---------------- SOCKET ----------------
io.on("connection", socket => {

  socket.on("join-room", ({ roomId, name }) => {
    socket.join(roomId);
    socket.data.name = name;

    if (!rooms[roomId]) rooms[roomId] = { players: [] };

    rooms[roomId].players =
      rooms[roomId].players.filter(p => p.id !== socket.id);

    rooms[roomId].players.push({ id: socket.id, name });

    emitRoomUpdate(roomId);
  });

  // ---------------- START GAME ----------------
  socket.on("start-game", roomId => {
    const room = rooms[roomId];
    if (!room || room.players.length < 2) return;

    const game = gameState[roomId];
    if (game && !game.ended && !game.won) return;

    const roundId = Date.now();
    const word = words[Math.floor(Math.random() * words.length)];

    const speakerIndex = roundId % room.players.length;
    const speaker = room.players[speakerIndex];

    gameState[roomId] = {
      word,
      speakerId: speaker.id,
      roundId,
      won: false,
      ended: false
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

  // ---------------- CLUE ----------------
  socket.on("clue", ({ roomId, clue }) => {

  const game = gameState[roomId];
  if (!game || game.won || game.ended) return;

  const normalizedClue = clue.toLowerCase().trim();

  const tabooWords = game.word.taboo.map(w => w.toLowerCase());
  const actualWord = game.word.word.toLowerCase();

  // ❌ CHECK: actual word used
  if (normalizedClue.includes(actualWord)) {
    io.to(roomId).emit("system", {
      message: `🚫 You cannot use the actual word in clues!`
    });
    return;
  }

  // ❌ CHECK: taboo words used
  const violated = tabooWords.find(taboo =>
    normalizedClue.includes(taboo)
  );

  if (violated) {
    io.to(roomId).emit("system", {
      message: `🚫 TABOO WORD USED by ${socket.data.name}`
    });
    return;
  }

  io.to(roomId).emit("clue", {
    clue,
    by: socket.data.name
  });
});

  // ---------------- GUESS ----------------
  socket.on("guess", ({ roomId, guess }) => {
    const game = gameState[roomId];
    if (!game || game.won || game.ended) return;

    if (socket.id === game.speakerId) {
      io.to(socket.id).emit("system", {
        message: "🚫 Speaker cannot guess!"
      });
      return;
    }

    const normalizedGuess = guess.toLowerCase().trim();
    const word = game.word.word.toLowerCase();

    io.to(roomId).emit("guess", {
      guess,
      by: socket.data.name
    });

    if (normalizedGuess === word) {
      game.won = true;
      game.ended = true;

      io.to(roomId).emit("win", {
        winner: socket.data.name,
        roundId: game.roundId
      });
    }
  });

  // ---------------- TIMER END (LOSS FIX) ----------------
  socket.on("timer-end", ({ roomId }) => {
    const game = gameState[roomId];
    if (!game || game.won || game.ended) return;

    game.ended = true;

    io.to(roomId).emit("lose", {
      word: game.word,
      roundId: game.roundId
    });

    io.to(roomId).emit("system", {
      message: `⏱️ Time's up! Word was "${game.word.word}"`
    });
  });

  // ---------------- RESET ----------------
  socket.on("reset-game", roomId => {
    gameState[roomId] = null;
    io.to(roomId).emit("reset-game");
  });

  // ---------------- DISCONNECT ----------------
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