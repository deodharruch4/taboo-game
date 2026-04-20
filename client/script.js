const socket = io("https://taboo-game-l02a.onrender.com"); 

let peers = {};
let channels = {};
let roomId = "";

let words = [];
let usedWords = [];
let currentWord = null;

let players = [];
let scores = {};
let myRole = "guesser"; // default
let time = 60;
let timerInterval;

// LOAD WORDS
fetch("words.json")
  .then(res => res.json())
  .then(data => words = data);

// JOIN
function joinRoom() {
  roomId = document.getElementById("room").value;
  if (!roomId) return alert("Enter room ID");

  socket.emit("join-room", roomId);

  const name = "Player-" + Math.floor(Math.random()*1000);
  updatePlayers(name);
}

// START GAME
function startGame() {
  if (words.length === 0) return alert("Words not loaded");

  if (usedWords.length === words.length) usedWords = [];

  let available = words.filter(w => !usedWords.includes(w.word));
  currentWord = available[Math.floor(Math.random() * available.length)];

  usedWords.push(currentWord.word);

  // randomly assign speaker
  myRole = Math.random() > 0.5 ? "speaker" : "guesser";

  broadcast({
    type: "start",
    data: currentWord,
    role: myRole
  });

  applyStart(currentWord, myRole);
  startTimer();
}

// APPLY START (role-based UI)
function applyStart(word, role) {
  if (role === "speaker") {
    document.getElementById("word").innerText = word.word;
    document.getElementById("taboo").innerText =
      "❌ " + word.taboo.join(" | ");
  } else {
    document.getElementById("word").innerText = "???";
    document.getElementById("taboo").innerText = "Guess the word!";
  }

  document.getElementById("status").innerText = role.toUpperCase();
}

// TIMER
function startTimer() {
  time = 60;
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    time--;
    document.getElementById("timer").innerText = "⏱️ " + time;

    if (time <= 0) {
      clearInterval(timerInterval);
      alert("⏰ Time up!");
    }
  }, 1000);
}

// CLUE
function sendClue() {
  if (myRole !== "speaker") return alert("Only speaker can give clue");

  const clue = document.getElementById("clue").value;

  if (currentWord.taboo.some(t => clue.toLowerCase().includes(t))) {
    alert("❌ Taboo word!");
    return;
  }

  broadcast({ type: "clue", data: clue });
  document.getElementById("currentClue").innerText = clue;
}

// GUESS
function sendGuess() {
  if (myRole !== "guesser") return alert("Only guesser can guess");

  const guess = document.getElementById("guess").value;
  broadcast({ type: "guess", data: guess });
}

// BROADCAST
function broadcast(msg) {
  Object.values(channels).forEach(c => {
    if (c.readyState === "open") c.send(JSON.stringify(msg));
  });
}

// RECEIVE
function handleMessage(msg) {
  const chat = document.getElementById("chat");

  if (msg.type === "start") {
    currentWord = msg.data;
    myRole = msg.role === "speaker" ? "guesser" : "speaker"; // reverse role

    applyStart(currentWord, myRole);
    startTimer();
  }

  if (msg.type === "clue") {
    document.getElementById("currentClue").innerText = msg.data;
    chat.innerHTML += `<li>💡 ${msg.data}</li>`;
  }

  if (msg.type === "guess") {
    chat.innerHTML += `<li>🤔 ${msg.data}</li>`;

    if (msg.data.toLowerCase() === currentWord.word.toLowerCase()) {
      broadcast({ type: "win" });
      celebrate();
      updateScore("Player");
    }
  }

  if (msg.type === "win") {
    celebrate();
  }
}

// PLAYERS
function updatePlayers(name) {
  players.push(name);
  document.getElementById("players").innerHTML =
    players.map(p => `<li>${p}</li>`).join("");
}

// SCORES
function updateScore(player) {
  if (!scores[player]) scores[player] = 0;
  scores[player]++;

  document.getElementById("scores").innerHTML =
    Object.entries(scores)
      .map(([p,s]) => `<li>${p}: ${s}</li>`).join("");
}

// EFFECTS
function celebrate() {
  confetti();
  const audio = new Audio("https://www.soundjay.com/buttons/sounds/button-3.mp3");
  audio.play().catch(() => {}); // avoids browser block
}

// ================= WEBRTC =================
function createPeer(id, initiator) {
  const peer = new RTCPeerConnection();
  const channel = peer.createDataChannel("game");

  setupChannel(id, channel);

  peer.ondatachannel = e => setupChannel(id, e.channel);

  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", { to: id, data: { candidate: e.candidate } });
    }
  };

  if (initiator) {
    peer.createOffer().then(o => {
      peer.setLocalDescription(o);
      socket.emit("signal", { to: id, data: o });
    });
  }

  peers[id] = peer;
}

function setupChannel(id, channel) {
  channels[id] = channel;
  channel.onmessage = e => handleMessage(JSON.parse(e.data));
}

socket.on("peer-joined", id => createPeer(id, true));

socket.on("signal", async ({ from, data }) => {
  if (!peers[from]) createPeer(from, false);

  const peer = peers[from];

  if (data.type === "offer") {
    await peer.setRemoteDescription(data);
    const ans = await peer.createAnswer();
    await peer.setLocalDescription(ans);
    socket.emit("signal", { to: from, data: ans });
  } else if (data.type === "answer") {
    await peer.setRemoteDescription(data);
  } else if (data.candidate) {
    await peer.addIceCandidate(data.candidate);
  }
});