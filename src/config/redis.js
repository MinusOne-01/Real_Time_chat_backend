import Redis from "ioredis";

export const redis = new Redis({
  host: "localhost",
  port: 6379,
});

export const pub = new Redis({
  host: "localhost",
  port: 6379,
});

export const sub = new Redis({
  host: "localhost",
  port: 6379,
});
