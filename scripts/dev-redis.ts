/**
 * Ensure Redis on REDIS_URL (default 127.0.0.1:6379) for local mprocs.
 * If nothing listens — start redis-memory-server and keep it alive.
 * If Redis already exists — stay UP with a heartbeat (do not start a second instance).
 */
import dotenv from 'dotenv';
import { RedisMemoryServer } from 'redis-memory-server';
import { parseRedisUrl, tcpOpen, heartbeat } from './lib/net';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env' });

const DEFAULT_URL = 'redis://127.0.0.1:6379';

async function main(): Promise<void> {
  const url = process.env.REDIS_URL || DEFAULT_URL;
  const { host, port } = parseRedisUrl(url);

  if (await tcpOpen(host, port)) {
    console.log(`[dev-redis] using existing Redis at ${host}:${port}`);
    await heartbeat('dev-redis', () => tcpOpen(host, port, 1500));
    return;
  }

  console.log(`[dev-redis] nothing on ${host}:${port} — starting redis-memory-server…`);
  const server = await RedisMemoryServer.create({
    instance: { ip: host === 'localhost' ? '127.0.0.1' : host, port },
  });
  const actualHost = await server.getHost();
  const actualPort = await server.getPort();
  console.log(`[dev-redis] ready at redis://${actualHost}:${actualPort}`);

  const shutdown = async () => {
    console.log('[dev-redis] shutting down…');
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  // Keep process alive
  await new Promise(() => undefined);
}

main().catch((err: unknown) => {
  console.error('[dev-redis] failed:', err);
  process.exit(1);
});
