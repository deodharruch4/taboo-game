const socket = io("https://taboo-game-l02a.onrender.com");

let roomId = "";
let currentRoundId = null;
let myRole = null;

let timerInterval;
let soundEnabled = true;
window.gameEnded = false;

// ---------------- JOIN ROOM ----------------
function joinRoom() {
  roomId = document.getElementById("room").value;
  socket.emit("join-room", roomId);
}

// ---------------- START GAME ----------------
function startGame() {
  socket.emit("start-game", roomId);
}

// ---------------- SOUND TOGGLE ----------------
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

// ---------------- GAME START ----------------
socket.on("game-start", ({ word, speaker, startTime, roundId }) => {

  // prevent stale rounds
  if (currentRoundId === roundId) return;
  currentRoundId = roundId;

  window.gameEnded = false;
  document.getElementById("restartBtn").style.display = "none";

  const isSpeaker = socket.id === speaker;
  myRole = isSpeaker ? "speaker" : "guesser";

  // reset UI
  document.getElementById("chat").innerHTML = "";
  document.getElementById("currentClue").innerText = "---";

  // word display
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

  // ---------------- ROLE UI FIX (IMPORTANT) ----------------
  document.getElementById("clueBox").style.display =
    myRole === "speaker" ? "flex" : "none";

  document.getElementById("guessBox").style.display =
    myRole === "guesser" ? "flex" : "none";

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

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = 60 - elapsed;

    document.getElementById("timer").innerText = "⏱️ " + remaining;

    if (remaining <= 0) {
      clearInterval(timerInterval);
    }

  }, 1000);
}

// ---------------- SEND CLUE ----------------
function sendClue() {
  if (myRole !== "speaker") return;

  const input = document.getElementById("clue");
  const clue = input.value.trim();
  if (!clue) return;

  socket.emit("clue", { roomId, clue });
  input.value = "";
}

// ---------------- SEND GUESS ----------------
function sendGuess() {
  if (myRole !== "guesser") return;

  const input = document.getElementById("guess");
  const guess = input.value.trim();
  if (!guess) return;

  socket.emit("guess", { roomId, guess });
  input.value = "";
}

// ---------------- RECEIVE CLUE ----------------
socket.on("clue", clue => {
  document.getElementById("chat").innerHTML += `<li>💡 ${clue}</li>`;
  document.getElementById("currentClue").innerText = clue;
});

// ---------------- RECEIVE GUESS ----------------
socket.on("guess", guess => {
  document.getElementById("chat").innerHTML += `<li>🤔 ${guess}</li>`;
});

// ---------------- WIN EVENT ----------------
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

// ---------------- RESTART GAME ----------------
function restartGame() {
  socket.emit("reset-game", roomId);
  socket.emit("start-game", roomId);
}

// ---------------- RESET GAME ----------------
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

  // hide inputs until new role assigned
  document.getElementById("clueBox").style.display = "none";
  document.getElementById("guessBox").style.display = "none";
});

// ---------------- ENTER KEY SUPPORT ----------------
document.addEventListener("keydown", e => {
  if (e.key === "Enter") {

    const clueInput = document.getElementById("clue");
    const guessInput = document.getElementById("guess");

    if (document.activeElement === clueInput) sendClue();
    if (document.activeElement === guessInput) sendGuess();
  }
});