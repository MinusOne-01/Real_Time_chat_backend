import { redis } from "../config/redis.js";

export async function isRateLimited(userId) {
  const key = `rate:chat:${userId}`;

  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 1); // 1-second window
  }

  return count > 4;
}
