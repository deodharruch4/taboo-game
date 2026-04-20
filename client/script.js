const socket = io("https://taboo-game-l02a.onrender.com");

let roomId = "";
let currentWord = null;
let myRole = "guesser";

let timerInterval;
let soundEnabled = true;
window.gameEnded = false;

// 🏠 JOIN
function joinRoom() {
  roomId = document.getElementById("room").value;
  socket.emit("join-room", roomId);
}

// 🎮 START
function startGame() {
  window.gameEnded = false;
  document.getElementById("restartBtn").style.display = "none";
  socket.emit("start-game", roomId);
}

// 🔊 SOUND
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

// 🎮 GAME START
socket.on("game-start", ({ word, speaker, startTime }) => {

  const isSpeaker = socket.id === speaker;
  myRole = isSpeaker ? "speaker" : "guesser";
  currentWord = word;

  if (isSpeaker) {
    document.getElementById("word").innerText = word.word;
    document.getElementById("taboo").innerText =
      "❌ " + word.taboo.join(" | ");
  } else {
    document.getElementById("word").innerText = "???";
    document.getElementById("taboo").innerText = "Guess the word!";
  }

  document.getElementById("status").innerText =
    isSpeaker ? "SPEAKER" : "GUESSER";

  syncTimer(startTime);
});

// ⏱ TIMER
function syncTimer(startTime) {
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {

    if (window.gameEnded) {
      clearInterval(timerInterval);
      return;
    }

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = 60 - elapsed;

    document.getElementById("timer").innerText = "⏱️ " + remaining;

    if (remaining <= 0) {
      clearInterval(timerInterval);
    }
  }, 1000);
}

// 💡 CLUE
function sendClue() {
  const input = document.getElementById("clue");
  const clue = input.value.trim();
  if (!clue) return;

  socket.emit("clue", { roomId, clue });
  input.value = "";
}

// 🤔 GUESS
function sendGuess() {
  if (myRole !== "guesser") return;

  const input = document.getElementById("guess");
  const guess = input.value.trim();
  if (!guess) return;

  socket.emit("guess", { roomId, guess });
  input.value = "";
}

// 💬 RECEIVE CLUE
socket.on("clue", clue => {
  document.getElementById("chat").innerHTML += `<li>💡 ${clue}</li>`;
  document.getElementById("currentClue").innerText = clue;
});

// 💬 RECEIVE GUESS
socket.on("guess", guess => {
  document.getElementById("chat").innerHTML += `<li>🤔 ${guess}</li>`;
});

// 🎉 WIN
socket.on("win", ({ winner }) => {

  if (window.gameEnded) return;
  window.gameEnded = true;

  clearInterval(timerInterval);

  confetti();
  playSound("https://www.soundjay.com/buttons/sounds/button-3.mp3");

  document.getElementById("status").innerText =
    "🎉 WIN by " + winner;

  document.getElementById("restartBtn").style.display = "block";
});

// 🔁 RESET
socket.on("reset-game", () => {

  window.gameEnded = false;

  document.getElementById("chat").innerHTML = "";
  document.getElementById("currentClue").innerText = "---";
  document.getElementById("word").innerText = "Word";
  document.getElementById("taboo").innerText = "Taboo";
  document.getElementById("status").innerText = "Waiting...";
  document.getElementById("timer").innerText = "⏱️ 60";
});

// 🔁 RESTART
function restartGame() {
  socket.emit("reset-game", roomId);
  socket.emit("start-game", roomId);
}

// ⌨️ ENTER SUPPORT
document.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    const clueInput = document.getElementById("clue");
    const guessInput = document.getElementById("guess");

    if (document.activeElement === clueInput) sendClue();
    if (document.activeElement === guessInput) sendGuess();
  }
});