/**
 * Ensure Redis on REDIS_URL (default 127.0.0.1:6379) for local mprocs.
 * If nothing listens — start redis-memory-server and keep it alive.
 * If Redis already exists — stay UP with a heartbeat (do not start a second instance).
 */
import net from 'net';
import dotenv from 'dotenv';
import { RedisMemoryServer } from 'redis-memory-server';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.development' });
dotenv.config({ path: '.env' });

const DEFAULT_URL = 'redis://127.0.0.1:6379';

function parseRedisUrl(raw: string): { host: string; port: number } {
  try {
    const u = new URL(raw);
    return {
      host: u.hostname || '127.0.0.1',
      port: u.port ? Number(u.port) : 6379,
    };
  } catch {
    return { host: '127.0.0.1', port: 6379 };
  }
}

function tcpOpen(host: string, port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (ok: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

async function heartbeat(host: string, port: number): Promise<never> {
  console.log(`[dev-redis] using existing Redis at ${host}:${port}`);
  for (;;) {
    const ok = await tcpOpen(host, port, 1500);
    if (!ok) {
      console.error(`[dev-redis] lost connection to ${host}:${port}`);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

async function main(): Promise<void> {
  const url = process.env.REDIS_URL || DEFAULT_URL;
  const { host, port } = parseRedisUrl(url);

  if (await tcpOpen(host, port)) {
    await heartbeat(host, port);
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
