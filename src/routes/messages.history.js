import express from "express";
import { prisma } from "../config/prisma.js";
import { redis } from "../config/redis.js";

const app = express();

app.use(express.json());

app.get("/rooms/:roomId/messages", async (req, res) => {
  
  console.log("fetching msg history...");
  const { roomId } = req.params;
  const limit = Number(req.query.limit ?? 50);
  const cursor = req.query.cursor;

  const messages = await prisma.message.findMany({
    where: {
      room_id: roomId,
      ...(cursor && {
        createdAt: {
          lt: new Date(cursor),
        },
      }),
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
  console.log("done!");

  res.json({
    messages,
    nextCursor:
      messages.length > 0
        ? messages[messages.length - 1].createdAt
        : null,
  });
});

app.get("/online", async (_,res) => {
  const users = await redis.smembers("online_users");
  res.json({ onlineUsers: users });
});


export default app;