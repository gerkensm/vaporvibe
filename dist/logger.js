import pino from "pino";
const level = normalizeLevel(process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"));
const prettyEnabled = parsePrettyFlag(process.env.PINO_PRETTY);
export const logger = prettyEnabled
    ? pino({
        level,
        base: undefined,
        transport: {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "HH:MM:ss",
                ignore: "pid,hostname",
            },
        },
    })
    : pino({
        level,
        base: undefined,
    });
function normalizeLevel(value) {
    const normalized = value.trim().toLowerCase();
    if (normalized === "trace" || normalized === "debug" || normalized === "info" || normalized === "warn" || normalized === "error" || normalized === "fatal") {
        return normalized;
    }
    return "info";
}
function parsePrettyFlag(value) {
    if (value === undefined || value === null) {
        return true;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "false" || normalized === "0" || normalized === "off") {
        return false;
    }
    if (normalized === "true" || normalized === "1" || normalized === "on") {
        return true;
    }
    return true;
}
