const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const crypto = require("crypto");
const { join } = require("path");

const names = [
  "Sophia",
  "Liam",
  "Olivia",
  "Noah",
  "Ava",
  "Emma",
  "Mason",
  "Isabella",
  "Elijah",
  "Charlotte",
  "Lucas",
  "Amelia",
  "Benjamin",
  "Mia",
  "Henry",
  "Harper",
  "Sebastian",
  "Ella",
  "Jack",
  "Luna",
  "Alexander",
  "Grace",
  "Oliver",
  "Chloe",
  "Ethan",
  "Aurora",
  "James",
  "Victoria",
  "Logan",
  "Zoe"
];

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
      isBot: false
    });
    socket.join(lobbyId);
    callback({
      lobbyId: lobbyId,
      host: lobbies[lobbyId].host,
      player: {
        id: socket.id,
        name: playername,
        isBot: false
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
        isBot: false
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
          isBot: false
        },
        players: lobbies[lobbyId].players,
      });
    }
  });

  socket.on('addbot', (lobbyId) => {
    lobbies[lobbyId].players.push({
      id: uuidv4(),
      name: `${names[Math.floor(Math.random() * names.length)]} (bot)`,
      isBot: true
    });
    io.to(lobbyId).emit('playerjoined', {
      players: lobbies[lobbyId].players,
    });
  })

  socket.on("deletebot", (lobbyId, botId) => {
    lobbies[lobbyId].players = lobbies[lobbyId].players.filter(player => player.id !== botId);
    io.to(lobbyId).emit('playerleft', {
      players: lobbies[lobbyId].players,
    });
  })


  const checkCards = (cards,lastCard) => {
    const commonIndex = cards.findIndex((c) => c.type === "common");
    const cardIndex = cards.findIndex((c) => c.card === lastCard.card);
    const typeIndex = cards.findIndex((c) => c.type === lastCard.type);

    if (typeIndex != -1) {
      if (lastCard?.type == cards[typeIndex].type) return typeIndex;
    }
    if (cardIndex != -1) {
      if (lastCard?.card == cards[cardIndex].card) return cardIndex;
    }
    if (commonIndex != -1) {
      return commonIndex;
    }
    return -1;
  }

  socket.on('checkcardsbot', (lobbyId, cards, lastCard, playerNo) => {
    const cardIndex = checkCards(cards, lastCard);
    console.log(cardIndex);
    io.to(lobbyId).emit('checkcardsbotnotification', {
      cardIndex: cardIndex,
      playerNo: playerNo
    })
  })

  socket.on('reverse', (lobbyId, reversed) => {
    socket.to(lobbyId).emit('reversenotification', {
      reversed: !reversed
    })
  })

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
              idx: i,
              isBot: player.isBot
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

  socket.on('deckchanged', (lobbyId, deck) => {
    socket.to(lobbyId).emit('deckchangednotification', {
      deck: deck
    })
  })

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
    io.to(lobbyId).emit('changeplayernotification', {
      player: player
    })
  })

  socket.on('cardpulled', (lobbyId, newCards, player) => {
    socket.to(lobbyId).emit('cardpullednotification', {
      newCards: newCards,
      player: player
    })
  })

  socket.on('attack', (lobbyId, newCards, player, amount) => {
    io.to(lobbyId).emit('attacknotification', {
      newCards: newCards,
      player: player,
      amount: amount
    })
  })

  socket.on('attackpulled', (lobbyId, newCards, player) => {
    io.to(lobbyId).emit('attackpullednotification', {
      newCards: newCards,
      player: player
    })
  })

  socket.on('block', (lobbyId, player) => {
    io.to(lobbyId).emit('blocknotification', {
      player: player
    })
  })

  socket.on('lastcard', (lobbyId,name,player) => {
    console.log("lastcard")
    io.to(lobbyId).emit('lastcardnotification', {
      name: name,
      player: player
    })
  })

  socket.on('lastcardattack', (lobbyId,attackedPlayer,attacker) => {
    if (attackedPlayer == attacker) {
      io.to(lobbyId).emit('lastcardattacknotification', {
        attack: false,
      })
    } else {
      io.to(lobbyId).emit('lastcardattacknotification', {
        attack: true,
      })
    }
  })

  socket.on('playerdisconnected', (lobbyId) => {
    console.log("disconnect");
    io.to(lobbyId).emit('playerdisconnectednotification')
  })
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
