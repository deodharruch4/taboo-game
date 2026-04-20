const socket = io("https://taboo-game-l02a.onrender.com"); 

let roomId = "";
let currentWord = null;
let myRole = "guesser";

let peers = {};
let channels = {};

let time = 60;
let timerInterval;

// JOIN ROOM
function joinRoom() {
  roomId = document.getElementById("room").value;
  if (!roomId) return alert("Enter room ID");

  socket.emit("join-room", roomId);
}

// START GAME (ONLY TRIGGERS SERVER)
function startGame() {
  socket.emit("start-game", roomId);
}

// GAME START (SERVER CONTROLLED)
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

// 🔥 SYNCED TIMER
function syncTimer(startTime) {
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = 60 - elapsed;

    document.getElementById("timer").innerText =
      "⏱️ " + remaining;

    if (remaining <= 10) {
      document.getElementById("timer").style.color = "#ef4444";
    }

    if (remaining <= 0) {
      clearInterval(timerInterval);
      alert("⏰ Time up!");
    }
  }, 1000);
}

// CLUE
function sendClue() {
  if (myRole !== "speaker")
    return alert("Only speaker can give clue");

  const clue = document.getElementById("clue").value;

  socket.emit("clue", { roomId, clue });
}

// GUESS
function sendGuess() {
  if (myRole !== "guesser")
    return alert("Only guesser can guess");

  const guess = document.getElementById("guess").value;

  socket.emit("guess", { roomId, guess });
}

// RECEIVE CLUE
socket.on("clue", clue => {
  document.getElementById("currentClue").innerText = clue;

  document.getElementById("chat").innerHTML +=
    `<li>💡 ${clue}</li>`;
});

// RECEIVE GUESS
socket.on("guess", guess => {
  document.getElementById("chat").innerHTML +=
    `<li>🤔 ${guess}</li>`;

  if (
    currentWord &&
    guess.toLowerCase() === currentWord.word.toLowerCase()
  ) {
    socket.emit("win", roomId);
  }
});

// WIN
socket.on("win", () => {
  confetti();

  const audio = new Audio(
    "https://www.soundjay.com/buttons/sounds/button-3.mp3"
  );
  audio.play().catch(() => {});
});