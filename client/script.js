const socket = io("https://taboo-game-l02a.onrender.com");

let roomId = "";
let currentWord = null;
let myRole = "guesser";

let timerInterval;
let soundEnabled = true;
let gameActive = false;

// ---------------- JOIN ----------------
function joinRoom() {
  roomId = document.getElementById("room").value;
  socket.emit("join-room", roomId);
}

// ---------------- START ----------------
function startGame() {
  document.getElementById("restartBtn").style.display = "none";
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

// ---------------- GAME START ----------------
socket.on("game-start", ({ word, speaker, startTime }) => {

  gameActive = true;

  const isSpeaker = socket.id === speaker;
  myRole = isSpeaker ? "speaker" : "guesser";
  currentWord = word;

  if (isSpeaker) {
    document.getElementById("word").innerText = word.word;
    document.getElementById("taboo").innerText =
      "❌ " + word.taboo.join(" | ");
  } else {
    document.getElementById("word").innerText = "???";
    document.getElementById("taboo").innerText = "Guess!";
  }

  document.getElementById("status").innerText =
    isSpeaker ? "SPEAKER" : "GUESSER";

  syncTimer(startTime);
});

// ---------------- TIMER (FIXED STOP ON WIN) ----------------
function syncTimer(startTime) {
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {

    if (!gameActive) return clearInterval(timerInterval);

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = 60 - elapsed;

    document.getElementById("timer").innerText = "⏱️ " + remaining;

    if (remaining <= 0) {
      gameActive = false;
      clearInterval(timerInterval);
      alert("⏰ Time up!");
    }
  }, 1000);
}

// ---------------- CLUE ----------------
function sendClue() {
  const input = document.getElementById("clue");
  const clue = input.value.trim();

  if (!clue) return;

  socket.emit("clue", { roomId, clue });

  input.value = ""; // 🔥 CLEAR INPUT
}

// ---------------- GUESS ----------------
function sendGuess() {
  const input = document.getElementById("guess");
  const guess = input.value.trim();

  if (!guess) return;

  socket.emit("guess", { roomId, guess });

  input.value = ""; // 🔥 CLEAR INPUT
}

// ---------------- ENTER KEY SUPPORT ----------------
document.addEventListener("keydown", (e) => {

  if (e.key === "Enter") {

    const clueInput = document.getElementById("clue");
    const guessInput = document.getElementById("guess");

    if (document.activeElement === clueInput) {
      sendClue();
    }

    if (document.activeElement === guessInput) {
      sendGuess();
    }
  }
});

// ---------------- RECEIVE CLUE ----------------
socket.on("clue", clue => {
  document.getElementById("chat").innerHTML += `<li>💡 ${clue}</li>`;
  document.getElementById("currentClue").innerText = clue;
});

// ---------------- RECEIVE GUESS ----------------
socket.on("guess", guess => {
  document.getElementById("chat").innerHTML += `<li>🤔 ${guess}</li>`;

  if (
    currentWord &&
    guess.toLowerCase() === currentWord.word.toLowerCase()
  ) {
    socket.emit("win", roomId);
  }
});

// ---------------- WIN (FIX TIMER STOP) ----------------
socket.on("win", () => {

  gameActive = false; // 🔥 STOP TIMER

  clearInterval(timerInterval);

  confetti();
  playSound("https://www.soundjay.com/buttons/sounds/button-3.mp3");

  document.getElementById("status").innerText = "🎉 WIN!";
  document.getElementById("restartBtn").style.display = "block";
});