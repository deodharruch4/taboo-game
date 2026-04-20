const socket = io("https://taboo-game-l02a.onrender.com"); 

let peers = {};
let channels = {};
let roomId = "";

let words = [];
let usedWords = [];
let currentWord = null;

let myRole = "guesser";
let players = [];
let scores = {};

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

// START GAME (only initiator triggers timer)
function startGame() {
  if (words.length === 0) return alert("Words not loaded");

  if (usedWords.length === words.length) usedWords = [];

  let available = words.filter(w => !usedWords.includes(w.word));
  currentWord = available[Math.floor(Math.random() * available.length)];

  usedWords.push(currentWord.word);

  // assign role
  myRole = Math.random() > 0.5 ? "speaker" : "guesser";

  broadcast({
    type: "start",
    data: currentWord,
    role: myRole,
    startTime: Date.now() // 🔥 sync timer
  });

  applyStart(currentWord, myRole);
  syncTimer(Date.now());
}

// APPLY ROLE UI
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

// 🔥 SYNC TIMER (same for all)
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

// CLUE (everyone sees)
function sendClue() {
  if (myRole !== "speaker") return alert("Only speaker can give clue");

  const clue = document.getElementById("clue").value;

  if (currentWord.taboo.some(t => clue.toLowerCase().includes(t))) {
    alert("❌ Taboo word!");
    return;
  }

  broadcast({ type: "clue", data: clue });
}

// GUESS (everyone sees)
function sendGuess() {
  if (myRole !== "guesser") return alert("Only guesser can guess");

  const guess = document.getElementById("guess").value;
  broadcast({ type: "guess", data: guess });
}

// BROADCAST
function broadcast(msg) {
  Object.values(channels).forEach(c => {
    if (c.readyState === "open") {
      c.send(JSON.stringify(msg));
    }
  });
}

// RECEIVE
function handleMessage(msg) {
  const chat = document.getElementById("chat");

  if (msg.type === "start") {
    currentWord = msg.data;

    // reverse role for others
    myRole = msg.role === "speaker" ? "guesser" : "speaker";

    applyStart(currentWord, myRole);
    syncTimer(msg.startTime); // 🔥 FIXED TIMER
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

// EFFECTS (now synced)
function celebrate() {
  confetti();

  const audio = new Audio(
    "https://www.soundjay.com/buttons/sounds/button-3.mp3"
  );
  audio.play().catch(() => {});
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