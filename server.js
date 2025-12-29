import { WebSocketServer } from "ws";
import http from "http";

// Create HTTP server (required for upgrade)
const server = http.createServer();
// Attach WebSocket server
const wss = new WebSocketServer({ server });

function send(socket, type, payload = {}) {
  socket.send(JSON.stringify({ type, payload }));
}

const rooms = new Map(); // roomId -> Set<socket>

wss.on("connection", (socket, request) => {
  console.log("Client connected");

  // ---- Socket State ----
  socket.rooms = new Set();

  socket.on("message", (data) => {

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
            return send(socket, "ERROR", {
                message: "SEND_MESSAGE not implemented yet",
            });
        }

        default:
          send(socket, "ERROR", { message: "Unknown event type" });
    }

  })

    socket.on("close", () => {
        console.log("Client disconnected");

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

server.listen(3000, () => {
  console.log("WebSocket server running on ws://localhost:3000");
});
