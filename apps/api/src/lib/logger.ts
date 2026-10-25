import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import type { Params } from 'nestjs-pino';
import { stdSerializers } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

// Nest's startup chatter: one line per module and per route. Only shown at debug level.
const STARTUP_CONTEXTS = new Set([
  'InstanceLoader',
  'RoutesResolver',
  'RouterExplorer',
]);

/** The reason a client sees: "File not found", or the validation messages joined. */
function describeError(error: Error): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    const message =
      typeof response === 'object' && response !== null && 'message' in response
        ? (response as { message: unknown }).message
        : response;
    return Array.isArray(message) ? message.join('; ') : String(message);
  }
  return error.message;
}

/**
 * Structured logging (pino). In production each line is one JSON object, which
 * Dozzle shows as fields; locally it's pretty, single-line output. Every request
 * gets an id (returned in the `x-request-id` header) that's also attached to any
 * log written while handling it.
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

    // pid and hostname mean nothing inside a container, and Docker already timestamps
    // every line, so production lines carry only what's useful.
    base: undefined,
    timestamp: !isProduction,
    // "info" rather than 30.
    formatters: isProduction
      ? { level: (label) => ({ level: label }) }
      : undefined,
    hooks: {
      logMethod(args, method, level) {
        const first: unknown = args[0];
        const context =
          typeof first === 'object' && first !== null
            ? (first as { context?: unknown }).context
            : undefined;
        if (
          level <= 30 &&
          typeof context === 'string' &&
          STARTUP_CONTEXTS.has(context) &&
          !this.isLevelEnabled('debug')
        ) {
          return;
        }
        method.apply(this, args);
      },
    },

    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id =
        typeof incoming === 'string' && incoming ? incoming : randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },

    // 5xx are errors, 4xx warnings (bad links, validation, rate limits). Successful
    // reads are frequent (the share page polls while a file is checked), so they're
    // debug; the services log the reads that matter, like downloads.
    customLogLevel: (req, res, error) => {
      if (res.statusCode >= 500 || (error && !(error instanceof HttpException)))
        return 'error';
      if (res.statusCode >= 400) return 'warn';
      if (req.method === 'GET' || req.method === 'HEAD') return 'debug';
      return 'info';
    },
    customSuccessMessage: (req, res, responseTime) =>
      `${req.method} ${req.url} → ${res.statusCode} in ${Math.round(responseTime)} ms`,
    // LoggerErrorInterceptor (main.ts) hands the thrown error over, so even a 404 says why.
    customErrorMessage: (req, res, error) =>
      `${req.method} ${req.url} → ${res.statusCode} ${describeError(error)}`,

    // The serializers below get the raw request, response and error. With wrapping
    // on, pino-http would pass them already converted, and the error one couldn't tell
    // a 404 from a crash.
    wrapSerializers: false,
    // Keep request logs small and free of secrets: no headers, cookies or bodies.
    // The method, URL and status are already in the message.
    serializers: {
      req: (req) => ({
        id: req.id,
        // Behind Cloudflare + Traefik, the socket address is Traefik's.
        ip: req.headers?.['cf-connecting-ip'] ?? req.socket?.remoteAddress,
      }),
      res: (res) => ({ statusCode: res.statusCode }),
      // Expected 4xx (not found, validation…) don't need a stack trace; real errors keep one.
      err: (error) =>
        error instanceof HttpException && error.getStatus() < 500
          ? { type: error.name, message: describeError(error) }
          : stdSerializers.err(error),
    },
  },
};
