import { WebSocketServer } from "ws";
import http from "http";
import crypto from "crypto";
import { saveMessage } from "./services/message.service.js";
import { prisma } from "./config/prisma.js"
import app from "./routes/messages.history.js";
import { redis, pub, sub } from "./config/redis.js";
import { isRateLimited } from "../src/services/rateLimit.js";
import { isTypingRateLimited } from "../src/services/typingRateLimit.js";


// Create HTTP server (required for upgrade)
const server = http.createServer( app );
// Attach WebSocket server
const wss = new WebSocketServer({ server });

 sub.on("pmessage", (pattern, channel, message) => {
    console.log("Sub P msg!");
    const { type, payload } = JSON.parse(message);

    if (channel.startsWith("room:")) {
      const roomId = channel.split(":")[1];
      broadcastToRoom(roomId, type, payload);
    }

    if (channel.startsWith("typing:")) {
      const roomId = channel.split(":")[1];
      broadcastToRoom(roomId, type, payload);
    }
  });

  sub.on("message", (channel, message) => {
    if (channel === "presence"){
      const { type, payload } = JSON.parse(message);
      broadcastGlobal(type, payload);
    }
  });

  await sub.psubscribe("room:*", "typing:*");
  await sub.subscribe("presence");


const PORT = process.env.PORT || 3000;

function generateId() {
  return crypto.randomUUID();
}

function broadcastGlobal(type, payload) {
  for (const socket of allSockets) {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify({ type, payload }));
    }
  }
}


function broadcastToRoom(roomId, type, payload) {
  const sockets = rooms.get(roomId);
  if (!sockets) return;

  for (const client of sockets) {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({ type, payload }));
    }
  }
}

function send(socket, type, payload = {}) {
  socket.send(JSON.stringify({ type, payload }));
}

const rooms = new Map(); // roomId -> Set<socket>

const allSockets = new Set();



wss.on("connection", async (socket, request) => {
  console.log("Client connected");
  allSockets.add(socket);

  socket.socketId = generateId();
  socket.userId = socket.socketId;

  // ---- Socket State ----
  socket.rooms = new Set();

  await redis.sadd(`user:${socket.userId}:sockets`, socket.socketId);
  await redis.sadd("online_users", socket.userId);
  await pub.publish(
    "presence",
    JSON.stringify({
      type: "USER_ONLINE",
      payload: { userId: socket.userId },
    })
  );


  console.log(`User ${socket.userId} is online`);


  socket.on("message", async (data) => {

    let message;

    try{
        message = JSON.parse(data.toString());
    }
    catch{
        return send(socket, "ERROR", { message: "Invalid JSON" });
    }

    const { type, payload } = message;

    if (!type) {
      return send(socket, "ERROR", { message: "Missing event type" });
    }

    switch (type){

        case "JOIN_ROOM": {
            const { roomId } = payload;

            if (!roomId) {
            return send(socket, "ERROR", { message: "roomId required" });
            }

            if (socket.rooms.has(roomId)) {
                return send(socket, "ERROR", { message: "Already in room" });
            }

            if (!rooms.has(roomId)) {
                rooms.set(roomId, new Set());
            }

            rooms.get(roomId).add(socket);
            socket.rooms.add(roomId);

            console.log(`Joined room ${roomId}`);
            send(socket, "ROOM_JOINED", { roomId });
            break;
        }

        case "LEAVE_ROOM": {
            const { roomId } = payload;

            if (!roomId || !socket.rooms.has(roomId)) {
                return send(socket, "ERROR", { message: "Not in room" });
            }

            rooms.get(roomId)?.delete(socket);
            socket.rooms.delete(roomId);

            // Optional cleanup
            if (rooms.get(roomId)?.size === 0) {
                rooms.delete(roomId);
            }

            console.log(`Left room ${roomId}`);
            send(socket, "ROOM_LEFT", { roomId });
            break;
        }

        case "SEND_MESSAGE": {

            const { roomId, content } = payload;

            if (!roomId || !content) {
              return send(socket, "ERROR", {
                message: "roomId and content required",
              });
            }

            if (!socket.rooms.has(roomId)) {
              return send(socket, "ERROR", {
                message: "You are not in this room",
              });
            }

            if (await isRateLimited(socket.userId)) {
              return send(socket, "ERROR", {
                message: "Too many messages. Slow down.",
              });
            }
            
            try {
              const message = await saveMessage(prisma, {
                roomId,
                senderId: socket.socketId,
                content,
              });

              const pmsg = await pub.publish(
                `room:${roomId}`,
                JSON.stringify({
                  type: "NEW_MESSAGE",
                  payload: message,
                })
              );
              console.log("Pub res -> ", pmsg);
              break;
            }
            catch (err) {
              console.error(err);
              send(socket, "ERROR", { message: "Failed to save message" });
            }
        }

        case "TYPING_START": {
          const { roomId } = payload;

          if (!roomId) {
            return send(socket, "ERROR", { message: "roomId required" });
          }

          if (!socket.rooms.has(roomId)) {
            return send(socket, "ERROR", { message: "Not in room" });
          }

          if (await isTypingRateLimited(socket.userId)) {
            return;
          }

          // Set ephemeral typing state
          await redis.set(
            `typing:${roomId}:${socket.userId}`,
            1,
            "EX",
            3
          );

          await pub.publish(
            `typing:${roomId}`,
            JSON.stringify({
              type: "USER_TYPING",
              payload: { userId: socket.userId },
            })
          );

          break;
        }

        default:
          send(socket, "ERROR", { message: "Unknown event type" });
    }

  })

  socket.on("close", async () => {
      console.log("Client disconnected");
      allSockets.delete(socket);

      await redis.srem(`user:${socket.userId}:sockets`, socket.socketId);

      const remaining = await redis.scard(`user:${socket.userId}:sockets`);

      if(remaining === 0) {
        await redis.srem("online_users", socket.userId);
        await pub.publish(
          "presence",
          JSON.stringify({
            type: "USER_OFFLINE",
            payload: { userId: socket.userId },
          })
        );
        console.log(`User ${socket.userId} went offline`);
      }

      for (const roomId of socket.rooms) {
          rooms.get(roomId)?.delete(socket);
          if (rooms.get(roomId)?.size === 0) {
              rooms.delete(roomId);
          }
      }

      socket.rooms.clear();
  });


  socket.on("error", (err) => {
    console.error("Socket error:", err);
  });
});

server.listen(PORT, () => {
  console.log(`HTTP + WS server running on ws://localhost:${PORT}`);
});
