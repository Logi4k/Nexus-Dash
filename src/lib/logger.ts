/**
 * Lightweight logger with dev/prod gating.
 *
 * - `logger.debug(...)` / `logger.info(...)` / `logger.log(...)` are silenced
 *   in production builds to keep the browser console clean for end users.
 * - `logger.warn(...)` / `logger.error(...)` always go through so real problems
 *   are visible in shipped builds.
 *
 * Use this in place of raw `console.*` calls for anything that's diagnostic
 * rather than a user-facing error.
 */

const isDev =
  typeof import.meta !== "undefined" &&
  (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;

type LogArgs = Parameters<typeof console.log>;

function debug(...args: LogArgs) {
  if (isDev) console.debug(...args);
}

function info(...args: LogArgs) {
  if (isDev) console.info(...args);
}

function log(...args: LogArgs) {
  if (isDev) console.log(...args);
}

function warn(...args: LogArgs) {
  console.warn(...args);
}

function error(...args: LogArgs) {
  console.error(...args);
}

export const logger = { debug, info, log, warn, error, isDev };
