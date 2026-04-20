const socket = io("https://taboo-game-l02a.onrender.com");

let peers = {};
let channels = {};
let roomId = "";
let currentWord = null;

const words = [
  { word: "Apple", taboo: ["fruit","red","tree","iphone","eat"] },
  { word: "Car", taboo: ["drive","engine","road","vehicle","wheel"] }
];

// JOIN
function joinRoom() {
  roomId = document.getElementById("room").value;
  socket.emit("join-room", roomId);
}

// CREATE PEER
function createPeer(id, initiator) {
  const peer = new RTCPeerConnection();

  let channel = peer.createDataChannel("game");
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

// CHANNEL
function setupChannel(id, channel) {
  channels[id] = channel;

  channel.onmessage = e => {
    const msg = JSON.parse(e.data);
    handleMessage(msg);
  };
}

// SIGNAL EVENTS
socket.on("peer-joined", id => {
  createPeer(id, true);
});

socket.on("signal", async ({ from, data }) => {
  if (!peers[from]) createPeer(from, false);

  const peer = peers[from];

  if (data.type === "offer") {
    await peer.setRemoteDescription(data);
    const ans = await peer.createAnswer();
    await peer.setLocalDescription(ans);
    socket.emit("signal", { to: from, data: ans });
  } 
  else if (data.type === "answer") {
    await peer.setRemoteDescription(data);
  } 
  else if (data.candidate) {
    await peer.addIceCandidate(data.candidate);
  }
});

// GAME
function startGame() {
  currentWord = words[Math.floor(Math.random()*words.length)];
  broadcast({ type: "start", data: currentWord });
}

function sendClue() {
  const clue = document.getElementById("clue").value;

  if (currentWord.taboo.some(t => clue.toLowerCase().includes(t))) {
    alert("Taboo word used!");
    return;
  }

  broadcast({ type: "clue", data: clue });
}

function sendGuess() {
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
    document.getElementById("word").innerText =
      `Word: ${msg.data.word} | Taboo: ${msg.data.taboo.join(", ")}`;
  }

  if (msg.type === "clue") {
    chat.innerHTML += `<li>Clue: ${msg.data}</li>`;
  }

  if (msg.type === "guess") {
    chat.innerHTML += `<li>Guess: ${msg.data}</li>`;

    if (msg.data.toLowerCase() === currentWord.word.toLowerCase()) {
      alert("Correct!");
    }
  }
}