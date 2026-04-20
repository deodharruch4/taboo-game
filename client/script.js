const socket = io("https://taboo-game-l02a.onrender.com");

let roomId = "";
let currentWord = null;
let myRole = "guesser";

let timerInterval;
let soundEnabled = true;

// JOIN
function joinRoom() {
  roomId = document.getElementById("room").value;
  socket.emit("join-room", roomId);
}

// START
function startGame() {
  document.getElementById("restartBtn").style.display = "none";
  socket.emit("start-game", roomId);
}

// SOUND TOGGLE
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

// GAME START
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
    document.getElementById("taboo").innerText = "Guess!";
  }

  document.getElementById("status").innerText =
    isSpeaker ? "SPEAKER" : "GUESSER";

  syncTimer(startTime);
});

// TIMER
function syncTimer(startTime) {
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = 60 - elapsed;

    document.getElementById("timer").innerText = "⏱️ " + remaining;

    if (remaining <= 0) clearInterval(timerInterval);
  }, 1000);
}

// CLUE
function sendClue() {
  socket.emit("clue", { roomId, clue: document.getElementById("clue").value });
}

// GUESS
function sendGuess() {
  socket.emit("guess", { roomId, guess: document.getElementById("guess").value });
}

// CLUE RECEIVE
socket.on("clue", clue => {
  document.getElementById("chat").innerHTML += `<li>💡 ${clue}</li>`;
  document.getElementById("currentClue").innerText = clue;
});

// GUESS RECEIVE
socket.on("guess", guess => {
  document.getElementById("chat").innerHTML += `<li>🤔 ${guess}</li>`;

  if (currentWord && guess.toLowerCase() === currentWord.word.toLowerCase()) {
    socket.emit("win", roomId);
  }
});

// WIN
socket.on("win", () => {

  confetti();
  playSound("https://www.soundjay.com/buttons/sounds/button-3.mp3");

  document.getElementById("status").innerText = "🎉 WIN!";
  document.getElementById("restartBtn").style.display = "block";
});