const socket = io("https://taboo-game-l02a.onrender.com"); 

let peers = {};
let channels = {};
let roomId = "";

let words = [];
let usedWords = [];
let currentWord = null;

let players = [];
let scores = {};
let time = 30;
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

// WEBRTC
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
    peer.createOffer().then(offer => {
      peer.setLocalDescription(offer);
      socket.emit("signal", { to: id, data: offer });
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

// START GAME (NO REPEAT)
function startGame() {
  if (words.length === 0) return alert("Words not loaded");

  if (usedWords.length === words.length) usedWords = [];

  let available = words.filter(w => !usedWords.includes(w.word));
  currentWord = available[Math.floor(Math.random() * available.length)];

  usedWords.push(currentWord.word);

  broadcast({ type: "start", data: currentWord });
  startTimer();
}

// TIMER
function startTimer() {
  time = 30;
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
  const clue = document.getElementById("clue").value;
  if (!currentWord) return;

  if (currentWord.taboo.some(t => clue.toLowerCase().includes(t))) {
    alert("❌ Taboo word!");
    return;
  }

  broadcast({ type: "clue", data: clue });
}

// GUESS
function sendGuess() {
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

    document.getElementById("word").innerText = msg.data.word;
    document.getElementById("taboo").innerText =
      "❌ " + msg.data.taboo.join(" | ");

    document.getElementById("status").innerText = "Game Started!";
  }

  if (msg.type === "clue") {
    chat.innerHTML += `<li>💡 ${msg.data}</li>`;
  }

  if (msg.type === "guess") {
    chat.innerHTML += `<li>🤔 ${msg.data}</li>`;

    if (msg.data.toLowerCase() === currentWord.word.toLowerCase()) {
      celebrate();
      updateScore("Player");
    }
  }
}

// PLAYERS
function updatePlayers(name) {
  players.push(name);
  const ul = document.getElementById("players");
  ul.innerHTML = players.map(p => `<li>${p}</li>`).join("");
}

// SCORES
function updateScore(player) {
  if (!scores[player]) scores[player] = 0;
  scores[player]++;

  const ul = document.getElementById("scores");
  ul.innerHTML = Object.entries(scores)
    .map(([p,s]) => `<li>${p}: ${s}</li>`).join("");
}

// EFFECTS
function celebrate() {
  confetti();
  new Audio("https://www.soundjay.com/buttons/sounds/button-3.mp3").play();
}