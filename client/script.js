const socket = io("https://taboo-game-l02a.onrender.com");

let roomId = "";
let myRole = null;
let currentRoundId = null;

let timerInterval;
let soundEnabled = true;
window.gameEnded = false;

// ---------------- JOIN ----------------
function joinRoom() {
  roomId = document.getElementById("room").value;
  const name = document.getElementById("name").value;

  socket.emit("join-room", { roomId, name });
}

// ---------------- START ----------------
function startGame() {
  socket.emit("start-game", roomId);
}

// ---------------- SOUND ----------------
function toggleSound() {
  soundEnabled = !soundEnabled;
  document.getElementById("soundBtn").innerText =
    soundEnabled ? "🔊 Sound ON" : "🔇 Sound OFF";
}

function playSound(url) {
  if (!soundEnabled) return;
  new Audio(url).play().catch(() => {});
}

// ---------------- ROOM UPDATE ----------------
socket.on("room-update", ({ count, players }) => {
  document.getElementById("playerCount").innerText =
    "Players: " + count;
});

// ---------------- GAME START ----------------
socket.on("game-start", ({ word, role, startTime, roundId }) => {

  if (currentRoundId === roundId) return;
  currentRoundId = roundId;

  window.gameEnded = false;
  document.getElementById("restartBtn").style.display = "none";

  myRole = role; // 🔥 SERVER DECIDES ROLE

  document.getElementById("chat").innerHTML = "";
  document.getElementById("currentClue").innerText = "---";

  document.getElementById("status").innerText =
    role.toUpperCase();

  if (role === "speaker") {
    document.getElementById("word").innerText = word.word;
    document.getElementById("taboo").innerText =
      "❌ " + word.taboo.join(" | ");
  } else {
    document.getElementById("word").innerText = "???";
    document.getElementById("taboo").innerText = "Guess the word!";
  }

  // ROLE UI FIX
  document.getElementById("clueBox").style.display =
    role === "speaker" ? "flex" : "none";

  document.getElementById("guessBox").style.display =
    role === "guesser" ? "flex" : "none";

  syncTimer(startTime);
});

// ---------------- TIMER ----------------
function syncTimer(startTime) {
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {

    if (window.gameEnded) {
      clearInterval(timerInterval);
      return;
    }

    const remaining = 60 - Math.floor((Date.now() - startTime) / 1000);

    document.getElementById("timer").innerText = "⏱️ " + remaining;

    if (remaining <= 0) clearInterval(timerInterval);

  }, 1000);
}

// ---------------- CLUE ----------------
function sendClue() {
  if (myRole !== "speaker") return;

  const clue = document.getElementById("clue").value.trim();
  if (!clue) return;

  socket.emit("clue", { roomId, clue });
}

// ---------------- GUESS ----------------
function sendGuess() {
  if (myRole !== "guesser") return;

  const guess = document.getElementById("guess").value.trim();
  if (!guess) return;

  socket.emit("guess", { roomId, guess });
}

// ---------------- WIN ----------------
socket.on("win", ({ winner, roundId }) => {

  if (window.gameEnded || roundId !== currentRoundId) return;

  window.gameEnded = true;
  clearInterval(timerInterval);

  confetti();
  playSound("https://www.soundjay.com/buttons/sounds/button-3.mp3");

  document.getElementById("status").innerText =
    "🎉 WIN by " + winner;

  document.getElementById("restartBtn").style.display = "block";
});

// ---------------- RESTART ----------------
function restartGame() {
  socket.emit("reset-game", roomId);

  setTimeout(() => {
    socket.emit("start-game", roomId);
  }, 300);
}

// ---------------- RESET ----------------
socket.on("reset-game", () => {

  window.gameEnded = false;
  currentRoundId = null;
  myRole = null;

  document.getElementById("chat").innerHTML = "";
  document.getElementById("currentClue").innerText = "---";

  document.getElementById("word").innerText = "Word";
  document.getElementById("taboo").innerText = "Taboo";
  document.getElementById("status").innerText = "Waiting...";
  document.getElementById("timer").innerText = "⏱️ 60";

  document.getElementById("restartBtn").style.display = "none";

  document.getElementById("clueBox").style.display = "none";
  document.getElementById("guessBox").style.display = "none";
});