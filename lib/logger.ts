type LogFields = Record<string, unknown>;

function emit(level: 'info' | 'warn' | 'error', message: string, fields?: LogFields) {
    const entry = {
        level,
        message,
        time: new Date().toISOString(),
        ...fields,
    };
    const line = JSON.stringify(entry);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
}

// Minimal structured logger: no third-party error-monitoring service is
// wired up (deliberate scope cut), but every call site at least produces a
// consistent, greppable shape instead of ad-hoc console.log/console.error
// strings, so Vercel's log viewer can be filtered by level/message.
export const log = {
    info: (message: string, fields?: LogFields) => emit('info', message, fields),
    warn: (message: string, fields?: LogFields) => emit('warn', message, fields),
    error: (message: string, fields?: LogFields) => emit('error', message, fields),
};
