
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface Logger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

const createLogger = (context?: string): Logger => {
  const prefix = context ? `[${context}]` : '';

  const log = (level: LogLevel, args: unknown[]) => {
    // Always log errors in production
    if (level === 'error') {
      console.error(new Date().toISOString(), prefix, ...args);
      return;
    }

    // In production, only log if DEBUG is enabled
    if (process.env.NODE_ENV === 'production') {
      if (level === 'warn' && process.env.DEBUG) {
        console.warn(new Date().toISOString(), prefix, ...args);
      }
      // Info and debug are suppressed in production unless explicitly enabled
      return;
    }

    // In development, log everything
    switch (level) {
      case 'info':
        console.log(new Date().toISOString(), prefix, ...args);
        break;
      case 'warn':
        console.warn(new Date().toISOString(), prefix, ...args);
        break;
      case 'debug':
        if (process.env.DEBUG) {
          console.debug(new Date().toISOString(), prefix, ...args);
        }
        break;
    }
  };

  return {
    info: (...args: unknown[]) => log('info', args),
    warn: (...args: unknown[]) => log('warn', args),
    error: (...args: unknown[]) => log('error', args),
    debug: (...args: unknown[]) => log('debug', args),
  };
};

export const logger = createLogger();

export const createScopedLogger = (context: string) => createLogger(context);
