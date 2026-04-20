const socket = io("https://taboo-game.onrender.com");

let roomId = "";
let myRole = null;
let currentRoundId = null;

let timerInterval;
let soundEnabled = true;
window.gameEnded = false;

// ============ CONNECTION STATUS ============
socket.on("connect", () => {
  console.log("✅ Connected to server");
  document.body.style.borderTop = "3px solid #4CAF50";
});

socket.on("disconnect", () => {
  console.log("❌ Disconnected from server");
  document.body.style.borderTop = "3px solid #f44336";
  alert("⚠️ Connection lost. Please refresh the page.");
});

socket.on("connect_error", (error) => {
  console.error("❌ Connection error:", error);
  alert("⚠️ Failed to connect to server. Check console for details.");
});

// ============ DEBUG LOGGING ============
function logDebug(message) {
  console.log(`[TABOO] ${message}`);
}

// ============ JOIN ROOM ============
function joinRoom() {
  roomId = document.getElementById("room").value;
  const name = document.getElementById("name").value;

  if (!roomId || !name) {
    alert("Please enter both name and room ID");
    return;
  }

  logDebug(`Attempting to join room: ${roomId} as ${name}`);
  socket.emit("join-room", { roomId, name });
}

// ============ START GAME ============
function startGame() {
  if (!roomId) {
    alert("Please join a room first");
    return;
  }

  logDebug(`Starting game in room: ${roomId}`);
  socket.emit("start-game", roomId);
}

// ============ SOUND ============
function toggleSound() {
  soundEnabled = !soundEnabled;
  document.getElementById("soundBtn").innerText =
    soundEnabled ? "🔊 Sound ON" : "🔇 Sound OFF";
}

function playSound(url) {
  if (!soundEnabled) return;
  new Audio(url).play().catch(() => {});
}

// ============ ROOM UPDATE ============
socket.on("room-update", ({ count }) => {
  logDebug(`Room updated: ${count} players`);
  document.getElementById("playerCount").innerText =
    "Players: " + count;
});

// ============ GAME START ============
socket.on("game-start", ({ word, role, startTime, roundId }) => {

  if (currentRoundId === roundId) return;
  currentRoundId = roundId;

  logDebug(`Game started! Role: ${role}`);

  window.gameEnded = false;
  document.getElementById("restartBtn").style.display = "none";

  myRole = role;

  // 🔥 RESET UI EVERY ROUND
  document.getElementById("chat").innerHTML = "";
  document.getElementById("currentClue").innerText = "No clue yet";

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

  // ROLE UI CONTROL
  document.getElementById("clueBox").style.display =
    role === "speaker" ? "flex" : "none";

  document.getElementById("guessBox").style.display =
    role === "guesser" ? "flex" : "none";

  syncTimer(startTime);
});

// ============ TIMER ============
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

// ============ CLUE ============
function sendClue() {
  if (myRole !== "speaker") return;

  const input = document.getElementById("clue");
  const clue = input.value.trim();
  if (!clue) return;

  logDebug(`Sending clue: ${clue}`);
  socket.emit("clue", { roomId, clue });
  input.value = "";
}

// ============ GUESS ============
function sendGuess() {
  if (myRole !== "guesser") return;

  const input = document.getElementById("guess");
  const guess = input.value.trim();
  if (!guess) return;

  logDebug(`Sending guess: ${guess}`);
  socket.emit("guess", { roomId, guess });
  input.value = "";
}

// ============ RECEIVE CLUE ============
socket.on("clue", ({ clue, by }) => {

  document.getElementById("currentClue").innerText = clue;

  document.getElementById("chat").innerHTML +=
    `<li>💡 ${by}: ${clue}</li>`;
});

// ============ RECEIVE GUESS ============
socket.on("guess", ({ guess, by }) => {

  document.getElementById("chat").innerHTML +=
    `<li>🤔 ${by}: ${guess}</li>`;
});

// ============ WIN ============
socket.on("win", ({ winner, roundId }) => {

  if (window.gameEnded || roundId !== currentRoundId) return;

  window.gameEnded = true;
  clearInterval(timerInterval);

  logDebug(`Game won by: ${winner}`);

  confetti();
  playSound("https://www.soundjay.com/buttons/sounds/button-3.mp3");

  document.getElementById("status").innerText =
    "🎉 WIN by " + winner;

  document.getElementById("restartBtn").style.display = "block";
});

// ============ RESTART ============
function restartGame() {
  logDebug(`Restarting game in room: ${roomId}`);
  socket.emit("reset-game", roomId);

  setTimeout(() => {
    socket.emit("start-game", roomId);
  }, 300);
}

// ============ RESET GAME ============
socket.on("reset-game", () => {

  window.gameEnded = false;
  currentRoundId = null;
  myRole = null;

  logDebug("Game reset");

  document.getElementById("chat").innerHTML = "";
  document.getElementById("currentClue").innerText = "No clue yet";

  document.getElementById("word").innerText = "Word";
  document.getElementById("taboo").innerText = "Taboo";
  document.getElementById("status").innerText = "Waiting...";
  document.getElementById("timer").innerText = "⏱️ 60";

  document.getElementById("restartBtn").style.display = "none";

  document.getElementById("clueBox").style.display = "none";
  document.getElementById("guessBox").style.display = "none";
});

// ============ ENTER KEY ============
document.addEventListener("keydown", e => {

  if (e.key !== "Enter") return;

  if (document.activeElement.id === "clue") sendClue();
  if (document.activeElement.id === "guess") sendGuess();
});
