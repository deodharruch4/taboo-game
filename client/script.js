const socket = io("https://taboo-game-l02a.onrender.com"); 


let peers = {};
let channels = {};
let roomId = "";

let currentWord = null;
let myRole = "guesser";

let time = 60;
let timerInterval;

// JOIN ROOM
function joinRoom() {
  roomId = document.getElementById("room").value;
  if (!roomId) return alert("Enter room ID");

  socket.emit("join-room", roomId);
}

// START GAME (server decides everything)
function startGame() {
  socket.emit("start-game", roomId);
}

// RECEIVE GAME START
socket.on("game-start", ({ word, isSpeaker, startTime }) => {

  currentWord = word;
  myRole = isSpeaker ? "speaker" : "guesser";

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

// 🔥 PERFECT TIMER SYNC
function syncTimer(startTime) {
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = 60 - elapsed;

    document.getElementById("timer").innerText = "⏱️ " + remaining;

    if (remaining <= 10) {
      document.getElementById("timer").style.color = "#ef4444";
    }

    if (remaining <= 0) {
      clearInterval(timerInterval);
      alert("⏰ Time up!");
    }
  }, 1000);
}

// SEND CLUE
function sendClue() {
  if (myRole !== "speaker") return alert("Only speaker can give clue");

  const clue = document.getElementById("clue").value;

  socket.emit("clue", { roomId, clue });
}

// SEND GUESS
function sendGuess() {
  if (myRole !== "guesser") return alert("Only guesser can guess");

  const guess = document.getElementById("guess").value;

  socket.emit("guess", { roomId, guess });
}

// RECEIVE CLUE
socket.on("clue", data => {
  document.getElementById("currentClue").innerText = data;

  const chat = document.getElementById("chat");
  chat.innerHTML += `<li>💡 ${data}</li>`;
});

// RECEIVE GUESS
socket.on("guess", guess => {
  const chat = document.getElementById("chat");
  chat.innerHTML += `<li>🤔 ${guess}</li>`;

  if (currentWord && guess.toLowerCase() === currentWord.word.toLowerCase()) {
    socket.emit("win", roomId);
  }
});

// WIN EVENT
socket.on("win", () => {
  celebrate();
});

// 🎉 EFFECTS
function celebrate() {
  confetti();

  const audio = new Audio(
    "https://www.soundjay.com/buttons/sounds/button-3.mp3"
  );
  audio.play().catch(() => {});
}