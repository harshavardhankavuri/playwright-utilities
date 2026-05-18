import type { Logger } from '../types';

const PREFIX = '[xray]';

/**
 * Creates a prefixed console logger.
 * Debug messages are only emitted when verbose is true.
 */
export function createLogger(verbose: boolean): Logger {
  return {
    info(msg: string): void {
      console.log(`${PREFIX} ${msg}`);
    },
    success(msg: string): void {
      console.log(`${PREFIX} ✔ ${msg}`);
    },
    warn(msg: string): void {
      console.error(`${PREFIX} ⚠ ${msg}`);
    },
    error(msg: string): void {
      console.error(`${PREFIX} ✖ ${msg}`);
    },
    debug(msg: string): void {
      if (verbose) {
        console.log(`${PREFIX} [debug] ${msg}`);
      }
    },
  };
}
