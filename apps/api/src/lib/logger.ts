import { randomUUID } from 'node:crypto';
import type { Params } from 'nestjs-pino';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Structured logging (pino). In production each line is one JSON object, which
 * Dozzle shows as searchable fields; locally it's pretty, single-line output.
 * Every request gets an id (returned in the `x-request-id` header) that's also
 * attached to any log written while handling it.
 */
export const loggerParams: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
    transport: isProduction
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },

    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id = typeof incoming === 'string' && incoming ? incoming : randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },

    // 5xx are errors, 4xx warnings (bad links, validation, rate limits), the rest info.
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res, responseTime) =>
      `${req.method} ${req.url} ${res.statusCode} ${Math.round(responseTime)}ms`,
    customErrorMessage: (req, res, error) =>
      `${req.method} ${req.url} ${res.statusCode} ${error.message}`,

    // Keep request logs small and free of secrets: no headers, cookies or bodies.
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        // Behind Cloudflare + Traefik, the socket address is Traefik's.
        ip: req.headers?.['cf-connecting-ip'] ?? req.remoteAddress,
      }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  },
};
