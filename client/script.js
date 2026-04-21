const socket = io("https://taboo-game-l02a.onrender.com");

let roomId = "";
let myRole = null;
let currentRoundId = null;

let timerInterval = null;
let soundEnabled = true;
window.gameEnded = false;

// ---------------- SOUND UNLOCK ----------------
document.addEventListener("click", () => {
  const unlock = new Audio();
  unlock.play().catch(() => {});
}, { once: true });

// ---------------- CONNECTION ----------------
socket.on("connect", () => {
  document.body.style.borderTop = "3px solid #4CAF50";
});

socket.on("disconnect", () => {
  document.body.style.borderTop = "3px solid #f44336";
});

// ---------------- JOIN ----------------
function joinRoom() {
  roomId = document.getElementById("room").value;
  const name = document.getElementById("name").value;

  if (!roomId || !name) return alert("Enter name + room");

  socket.emit("join-room", { roomId, name });
}

// ---------------- START ----------------
function startGame() {
  if (!roomId) return alert("Join room first");
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
  const audio = new Audio(url);
  audio.play().catch(() => {});
}

// ---------------- ROOM ----------------
socket.on("room-update", ({ count }) => {
  document.getElementById("playerCount").innerText = "Players: " + count;
});

// ---------------- GAME START ----------------
socket.on("game-start", ({ word, role, startTime, roundId }) => {

  if (currentRoundId === roundId) return;
  currentRoundId = roundId;

  window.gameEnded = false;
  myRole = role;

  document.getElementById("restartBtn").style.display = "none";
  document.getElementById("chat").innerHTML = "";

  document.getElementById("status").innerText = role.toUpperCase();

  if (role === "speaker") {
    document.getElementById("word").innerText = word.word;
    document.getElementById("taboo").innerText =
      "❌ " + word.taboo.join(" | ");
  } else {
    document.getElementById("word").innerText = "???";
    document.getElementById("taboo").innerText = "Guess the word!";
  }

  document.getElementById("clueBox").style.display =
    role === "speaker" ? "flex" : "none";

  document.getElementById("guessBox").style.display =
    role === "guesser" ? "flex" : "none";

  startTimer(startTime);
});

// ---------------- TIMER ----------------
function startTimer(startTime) {

  clearInterval(timerInterval);

  timerInterval = setInterval(() => {

    if (window.gameEnded) {
      clearInterval(timerInterval);
      return;
    }

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    let remaining = 60 - elapsed;

    if (remaining <= 0) {
      clearInterval(timerInterval);
      window.gameEnded = true;
      socket.emit("timer-end", { roomId });
      return;
    }

    document.getElementById("timer").innerText = "⏱️ " + remaining;

  }, 1000);
}

// ---------------- CLUE ----------------
function sendClue() {
  if (myRole !== "speaker") return;

  const input = document.getElementById("clue");
  const clue = input.value.trim();
  if (!clue) return;

  socket.emit("clue", { roomId, clue });
  input.value = "";
}

// ---------------- GUESS ----------------
function sendGuess() {
  if (myRole !== "guesser") return;

  const input = document.getElementById("guess");
  const guess = input.value.trim();
  if (!guess) return;

  socket.emit("guess", { roomId, guess });
  input.value = "";
}

// ---------------- EVENTS ----------------
socket.on("clue", ({ clue, by }) => {
  document.getElementById("chat").innerHTML += `<li>💡 ${by}: ${clue}</li>`;
});

socket.on("guess", ({ guess, by }) => {
  document.getElementById("chat").innerHTML += `<li>🤔 ${by}: ${guess}</li>`;
});

socket.on("system", ({ message }) => {
  document.getElementById("chat").innerHTML +=
    `<li style="color:#d97706;font-weight:bold">⚠️ ${message}</li>`;
});

// ---------------- WIN (🔥 CONFETTI FIXED) ----------------
socket.on("win", ({ winner }) => {

  window.gameEnded = true;
  clearInterval(timerInterval);

  document.getElementById("status").innerText = "🎉 WIN by " + winner;
  document.getElementById("restartBtn").style.display = "block";

  // ✅ RESTORED CONFETTI
  if (typeof confetti === "function") {
    confetti();
  }

  playSound("https://www.soundjay.com/buttons/sounds/button-3.mp3");
});

// ---------------- LOSE ----------------
socket.on("lose", ({ word }) => {

  window.gameEnded = true;
  clearInterval(timerInterval);

  document.getElementById("word").innerText = word.word;
  document.getElementById("taboo").innerText =
    "❌ " + word.taboo.join(" | ");

  document.getElementById("status").innerText = "❌ LOST";
  document.getElementById("restartBtn").style.display = "block";

  playSound("https://www.soundjay.com/buttons/sounds/button-10.mp3");
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

  clearInterval(timerInterval);

  document.getElementById("chat").innerHTML = "";
  document.getElementById("word").innerText = "Word";
  document.getElementById("taboo").innerText = "Taboo";
  document.getElementById("status").innerText = "Waiting...";
  document.getElementById("timer").innerText = "⏱️ 60";

  document.getElementById("restartBtn").style.display = "none";
});

// ---------------- ENTER ----------------
document.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;

  if (document.activeElement.id === "clue") sendClue();
  if (document.activeElement.id === "guess") sendGuess();
});