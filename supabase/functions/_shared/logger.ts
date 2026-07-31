// GENERATED FILE -- DO NOT EDIT.
// Copied from lib/logger.ts by scripts/sync-edge-shared.mjs. Edit the original.
type LogFields = Record<string, unknown>;

function emit(level: 'info' | 'warn' | 'error', message: string, fields?: LogFields) {
    const entry = {
        level,
        message,
        time: new Date().toISOString(),
        ...fields
    };
    const line = JSON.stringify(entry);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
}

// Minimal structured logger: no third-party error-monitoring service is
// wired up (deliberate scope cut), but every call site at least produces a
// consistent, greppable shape instead of ad-hoc console.log/console.error
// strings. Both runtimes this ends up in collect it: Workers Logs for the Next
// app (observability is enabled in wrangler.jsonc) and Supabase Edge Function
// logs for the ingest jobs, and both can filter on level/message.
export const log = {
    info: (message: string, fields?: LogFields) => emit('info', message, fields),
    warn: (message: string, fields?: LogFields) => emit('warn', message, fields),
    error: (message: string, fields?: LogFields) => emit('error', message, fields)
};
