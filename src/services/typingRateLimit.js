import { redis } from "../config/redis.js";

export async function isTypingRateLimited(userId) {
  const key = `rate:typing:${userId}`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 3);
  }

  return count > 2; // max 2 typing events/sec
}
