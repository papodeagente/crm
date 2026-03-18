import { describe, it, expect } from "vitest";
import IORedis from "ioredis";

describe("Redis Connection", () => {
  it("should connect to Redis and respond to PING", async () => {
    const redisUrl = process.env.REDIS_URL;
    expect(redisUrl).toBeDefined();
    expect(redisUrl).toBeTruthy();

    const redis = new IORedis(redisUrl!, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      lazyConnect: true,
    });

    try {
      await redis.connect();
      const pong = await redis.ping();
      expect(pong).toBe("PONG");
    } finally {
      await redis.quit();
    }
  });

  it("should be able to set and get a value", async () => {
    const redis = new IORedis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      lazyConnect: true,
    });

    try {
      await redis.connect();
      await redis.set("test:queue:validation", "ok", "EX", 10);
      const val = await redis.get("test:queue:validation");
      expect(val).toBe("ok");
      await redis.del("test:queue:validation");
    } finally {
      await redis.quit();
    }
  });
});
