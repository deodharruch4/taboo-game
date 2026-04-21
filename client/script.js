const socket = io("https://taboo-game-l02a.onrender.com");

let roomId = "";
let myRole = null;
let currentRoundId = null;

let timerInterval = null;
let soundEnabled = true;
window.gameEnded = false;

// ================= SOUND UNLOCK (IMPORTANT FIX) =================
// Unlocks audio on first user interaction (fixes Chrome autoplay issue)
document.addEventListener("click", () => {
  const unlock = new Audio();
  unlock.play().catch(() => {});
}, { once: true });

// ================= CONNECTION =================
socket.on("connect", () => {
  console.log("✅ Connected");
  document.body.style.borderTop = "3px solid #4CAF50";
});

socket.on("disconnect", () => {
  console.log("❌ Disconnected");
  document.body.style.borderTop = "3px solid #f44336";
});

// ================= JOIN =================
function joinRoom() {
  roomId = document.getElementById("room").value;
  const name = document.getElementById("name").value;

  if (!roomId || !name) return alert("Enter name + room");

  socket.emit("join-room", { roomId, name });
}

// ================= START =================
function startGame() {
  if (!roomId) return alert("Join room first");
  socket.emit("start-game", roomId);
}

// ================= SOUND TOGGLE =================
function toggleSound() {
  soundEnabled = !soundEnabled;
  document.getElementById("soundBtn").innerText =
    soundEnabled ? "🔊 Sound ON" : "🔇 Sound OFF";
}

// 🔥 FIXED SOUND FUNCTION
function playSound(url) {
  if (!soundEnabled) return;

  const audio = new Audio(url);
  audio.volume = 1;

  audio.play().catch(err => {
    console.log("🔇 Sound blocked or failed:", err);
  });
}

// ================= ROOM UPDATE =================
socket.on("room-update", ({ count }) => {
  const el = document.getElementById("playerCount");
  if (el) el.innerText = "Players: " + count;
});

// ================= GAME START =================
socket.on("game-start", ({ word, role, startTime, roundId }) => {

  if (currentRoundId === roundId) return;
  currentRoundId = roundId;

  window.gameEnded = false;
  myRole = role;

  document.getElementById("chat").innerHTML = "";
  document.getElementById("currentClue").innerText = "No clue yet";

  document.getElementById("status").innerText = role.toUpperCase();

  if (role === "speaker") {
    document.getElementById("word").innerText = word.word;
    document.getElementById("taboo").innerText =
      "❌ " + word.taboo.join(" | ");
  } else {
    document.getElementById("word").innerText = "???";
    document.getElementById("taboo").innerText = "Guess the word!";
  }

  const clueBox = document.getElementById("clueBox");
  const guessBox = document.getElementById("guessBox");

  if (clueBox) clueBox.style.display = role === "speaker" ? "flex" : "none";
  if (guessBox) guessBox.style.display = role === "guesser" ? "flex" : "none";

  startTimer(startTime);
});

// ================= TIMER =================
function startTimer(startTime) {

  clearInterval(timerInterval);

  let ended = false;

  timerInterval = setInterval(() => {

    if (window.gameEnded || ended) {
      clearInterval(timerInterval);
      return;
    }

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    let remaining = 60 - elapsed;

    if (remaining <= 0) {
      remaining = 0;

      document.getElementById("timer").innerText = "⏱️ 0";

      clearInterval(timerInterval);
      ended = true;
      window.gameEnded = true;

      socket.emit("timer-end", { roomId });

      return;
    }

    document.getElementById("timer").innerText = "⏱️ " + remaining;

  }, 1000);
}

// ================= CLUE =================
function sendClue() {
  if (myRole !== "speaker") return;

  const input = document.getElementById("clue");
  const clue = input.value.trim();
  if (!clue) return;

  socket.emit("clue", { roomId, clue });
  input.value = "";
}

// ================= GUESS =================
function sendGuess() {
  if (myRole !== "guesser") return;

  const input = document.getElementById("guess");
  const guess = input.value.trim();
  if (!guess) return;

  socket.emit("guess", { roomId, guess });
  input.value = "";
}

// ================= EVENTS =================
socket.on("clue", ({ clue, by }) => {
  document.getElementById("currentClue").innerText = clue;

  document.getElementById("chat").innerHTML +=
    `<li>💡 ${by}: ${clue}</li>`;
});

socket.on("guess", ({ guess, by }) => {
  document.getElementById("chat").innerHTML +=
    `<li>🤔 ${by}: ${guess}</li>`;
});

socket.on("system", ({ message }) => {
  document.getElementById("chat").innerHTML +=
    `<li style="color:#d97706;font-weight:bold">⚠️ ${message}</li>`;
});

socket.on("timer-stop", () => {
  clearInterval(timerInterval);
  window.gameEnded = true;
});

// ================= WIN =================
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

// ================= RESTART =================
function restartGame() {

  socket.emit("reset-game", roomId);

  setTimeout(() => {
    socket.emit("start-game", roomId);
  }, 300);
}

// ================= RESET =================
socket.on("reset-game", () => {

  window.gameEnded = false;
  currentRoundId = null;
  myRole = null;

  clearInterval(timerInterval);

  document.getElementById("chat").innerHTML = "";
  document.getElementById("currentClue").innerText = "No clue yet";

  document.getElementById("word").innerText = "Word";
  document.getElementById("taboo").innerText = "Taboo";
  document.getElementById("status").innerText = "Waiting...";
  document.getElementById("timer").innerText = "⏱️ 60";

  document.getElementById("restartBtn").style.display = "none";
});

// ================= ENTER KEY =================
document.addEventListener("keydown", e => {

  if (e.key !== "Enter") return;

  if (document.activeElement.id === "clue") sendClue();
  if (document.activeElement.id === "guess") sendGuess();
});