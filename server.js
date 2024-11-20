const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const crypto = require("crypto");
const { join } = require("path");

const app = express();
app.use(
  cors({
    origin: "*",
  })
);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const PORT = 3000;

const lobbies = {};

const generateLobbyId = () => {
  let lobbyId;
  do {
    lobbyId = crypto.randomBytes(3).toString("hex").slice(0, 5).toUpperCase();
  } while (lobbies[lobbyId]);
  return lobbyId;
};

io.on("connection", (socket) => {
  console.log("a user connected ", socket.id);

  socket.on("createlobby", (playername, callback) => {
    const lobbyId = generateLobbyId();
    lobbies[lobbyId] = {
      id: lobbyId,
      players: [],
      host: socket.id,
      gameStarted: false,
    };
    lobbies[lobbyId].players.push({
      id: socket.id,
      name: playername,
    });
    socket.join(lobbyId);
    callback({
      lobbyId: lobbyId,
      host: lobbies[lobbyId].host,
      player: {
        id: socket.id,
        name: playername,
      },
      players: lobbies[lobbyId].players,
    });
  });

  socket.on("leavelobby", (lobbyId) => {
    if (socket.id == lobbies[lobbyId].host) {
      socket.to(lobbyId).emit("hostleft");
      delete lobbies[lobbyId];
      socket.leave(lobbyId);
    } else {
      socket.leave(lobbyId);
      lobbies[lobbyId].players = lobbies[lobbyId].players.filter(
        (player) => player.id !== socket.id
      );
      socket.to(lobbyId).emit("playerleft", {
        players: lobbies[lobbyId].players,
      });
    }
  });

  socket.on("checklobby", (lobbyId, callback) => {
    if (!lobbies[lobbyId]) {
      callback({
        status: "error",
        message: "Lobby does not exist",
      });
      return;
    }

    if (lobbies[lobbyId].gameStarted) {
      callback({
        status: "error",
        message: "Game has already started",
      });
    }

    if (lobbies[lobbyId].players.length == 8) {
      callback({
        status: "error",
        message: "Lobby is full",
      });
    }

    if (lobbies[lobbyId]) {
      callback({
        status: "success",
      });
    }
  });

  socket.on("joinlobby", (lobbyId, playername, callback) => {
    if (lobbies[lobbyId]) {
      lobbies[lobbyId].players.push({
        id: socket.id,
        name: playername,
      });
      socket.join(lobbyId);
      socket.to(lobbyId).emit("playerjoined", {
        players: lobbies[lobbyId].players,
      });
      callback({
        status: "success",
        lobbyId: lobbyId,
        host: lobbies[lobbyId].host,
        player: {
          id: socket.id,
          name: playername,
        },
        players: lobbies[lobbyId].players,
      });
    }
  });

  socket.on(
    "startgamehost",
    (lobbyId, deck, playersCards, initialType, initialCard) => {
      lobbies[lobbyId].gameStarted = true;
      const players = lobbies[lobbyId].players.sort(() => Math.random() - 0.5);
      players.forEach((player, index) => {
        console.log(player.id, player.name);
        io.to(player.id).emit("startgame", {
          player: player,
          index: index,
          players: players.map((player,i) => {
            return {
              id: player.id,
              name: player.name,
              idx: i
            }
          }),
          firstCard: {
            type: initialType,
            card: initialCard,
          },
          deck: deck,
          playersCards: playersCards,
        });
      });
    }
  );

  socket.on('cardplayed', (lobbyId, playedType, playedCard,cardIndex,playersCards, player) => {
    socket.to(lobbyId).emit('cardplayednotification', {
      playedType: playedType,
      playedCard: playedCard,
      cardIndex: cardIndex,
      playersCards: playersCards,
      player: player
    })
  })

  socket.on('changeplayer', (lobbyId, player) => {
    socket.to(lobbyId).emit('changeplayernotification', {
      player: player
    })
  })

  socket.on('cardpulled', (lobbyId, newCards,newDeck, player) => {
    socket.to(lobbyId).emit('cardpullednotification', {
      newCards: newCards,
      newDeck: newDeck,
      player: player
    })
  })

  socket.on('attack', (lobbyId, newCards,newDeck, player, amount) => {
    io.to(lobbyId).emit('attacknotification', {
      newCards: newCards,
      newDeck: newDeck,
      player: player,
      amount: amount
    })
  })

  socket.on('attackpulled', (lobbyId, newCards,newDeck, player) => {
    io.to(lobbyId).emit('attackpullednotification', {
      newCards: newCards,
      newDeck: newDeck,
      player: player
    })
  })

  socket.on('block', (lobbyId, player) => {
    io.to(lobbyId).emit('blocknotification', {
      player: player
    })
  })
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));