import { randomUUID } from "node:crypto";
import { supportsImageInput } from "../llm/capabilities.js";
import { buildMessages } from "../llm/messages.js";
import { parseCookies } from "../utils/cookies.js";
import { readBody } from "../utils/body.js";
import { selectHistoryForPrompt } from "./history-utils.js";
const REST_PROMPT_LIMIT = 10;
function normalizeJsonResponse(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        return trimmed;
    const fencedMatch = trimmed.match(/^```[\w-]*\s*\n([\s\S]*?)\n?```$/i);
    if (fencedMatch) {
        return fencedMatch[1].trim();
    }
    const inlineFence = trimmed.match(/```[\w-]*\s*\n([\s\S]*?)\n?```/i);
    if (inlineFence) {
        return inlineFence[1].trim();
    }
    return trimmed;
}
export class RestApiController {
    sessionStore;
    adminPath;
    getEnvironment;
    constructor(options) {
        this.sessionStore = options.sessionStore;
        this.adminPath = options.adminPath;
        this.getEnvironment = options.getEnvironment;
    }
    async handle(context, reqLogger) {
        const { path } = context;
        if (!path.startsWith("/rest_api/")) {
            return false;
        }
        if (path.startsWith("/rest_api/mutation/")) {
            await this.handleMutation(context, reqLogger);
            return true;
        }
        if (path.startsWith("/rest_api/query/")) {
            await this.handleQuery(context, reqLogger);
            return true;
        }
        context.res.statusCode = 404;
        context.res.setHeader("Content-Type", "application/json; charset=utf-8");
        context.res.end(JSON.stringify({ success: false, error: "Unknown REST endpoint" }));
        return true;
    }
    async handleMutation(context, reqLogger) {
        const { req, res, url, method, path } = context;
        const requestStart = Date.now();
        if (method !== "POST" && method !== "PUT" && method !== "PATCH") {
            res.statusCode = 405;
            res.setHeader("Allow", "POST, PUT, PATCH");
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ success: false, error: "Method Not Allowed" }));
            return;
        }
        const env = this.getEnvironment();
        if (!env.providerReady || env.providerSelectionRequired || !env.brief) {
            res.statusCode = 503;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ success: false, error: "Model not ready" }));
            return;
        }
        const cookies = parseCookies(req.headers.cookie);
        const sid = this.sessionStore.getOrCreateSessionId(cookies, res);
        const query = sanitizeQuery(url);
        const parsedBody = await readBody(req);
        const body = sanitizeBody(parsedBody.data ?? {});
        const record = {
            id: randomUUID(),
            path,
            method,
            query,
            body,
            createdAt: new Date().toISOString(),
        };
        this.sessionStore.appendMutationRecord(sid, record);
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify({ success: true }));
        reqLogger.debug({ path, method }, "Recorded REST mutation");
        this.sessionStore.appendRestHistoryEntry(sid, {
            type: "mutation",
            record,
            response: { success: true },
            durationMs: Date.now() - requestStart,
        });
    }
    async handleQuery(context, reqLogger) {
        const { req, res, url, method, path } = context;
        const requestStart = Date.now();
        if (method !== "GET" && method !== "POST") {
            res.statusCode = 405;
            res.setHeader("Allow", "GET, POST");
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ success: false, error: "Method Not Allowed" }));
            return;
        }
        const env = this.getEnvironment();
        if (!env.providerReady ||
            env.providerSelectionRequired ||
            !env.brief ||
            !env.llmClient) {
            res.statusCode = 503;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ success: false, error: "Model not ready" }));
            return;
        }
        const cookies = parseCookies(req.headers.cookie);
        const sid = this.sessionStore.getOrCreateSessionId(cookies, res);
        const query = sanitizeQuery(url);
        let bodyData = {};
        if (method === "POST") {
            const parsedBody = await readBody(req);
            bodyData = sanitizeBody(parsedBody.data ?? {});
        }
        const promptContext = this.preparePromptContext(sid, env.runtime, env.briefAttachments, env.llmClient);
        const restState = this.sessionStore.getRestState(sid, REST_PROMPT_LIMIT);
        const messages = buildMessages({
            brief: env.brief ?? "",
            briefAttachments: promptContext.attachments,
            omittedAttachmentCount: promptContext.omittedAttachmentCount,
            method,
            path,
            query,
            body: bodyData,
            prevHtml: promptContext.prevHtml,
            timestamp: new Date(),
            includeInstructionPanel: env.runtime.includeInstructionPanel,
            history: promptContext.historyForPrompt,
            historyTotal: promptContext.historyTotal,
            historyLimit: promptContext.historyLimit,
            historyMaxBytes: env.runtime.historyMaxBytes,
            historyBytesUsed: promptContext.historyBytesUsed,
            historyLimitOmitted: promptContext.historyLimitOmitted,
            historyByteOmitted: promptContext.historyByteOmitted,
            adminPath: this.adminPath,
            restMutations: restState.mutations,
            restQueries: restState.queries,
            mode: "json-query",
        });
        try {
            const result = await env.llmClient.generateHtml(messages);
            const raw = result.html?.trim() ?? "";
            const normalized = normalizeJsonResponse(raw);
            let parsed;
            try {
                parsed = normalized.length > 0 ? JSON.parse(normalized) : {};
            }
            catch (error) {
                const failureRecord = {
                    id: randomUUID(),
                    path,
                    method,
                    query,
                    body: bodyData,
                    createdAt: new Date().toISOString(),
                    ok: false,
                    response: null,
                    rawResponse: raw,
                    error: error instanceof Error
                        ? error.message
                        : "Invalid JSON from model",
                };
                this.sessionStore.appendQueryRecord(sid, failureRecord);
                reqLogger.warn({ path }, "Model returned invalid JSON for query");
                res.statusCode = 502;
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.setHeader("Cache-Control", "no-store");
                res.end(JSON.stringify({
                    success: false,
                    error: "Model response was not valid JSON",
                }));
                this.sessionStore.appendRestHistoryEntry(sid, {
                    type: "query",
                    record: failureRecord,
                    rawResponse: raw,
                    ok: false,
                    error: error instanceof Error ? error.message : "Invalid JSON from model",
                    durationMs: Date.now() - requestStart,
                });
                return;
            }
            const successRecord = {
                id: randomUUID(),
                path,
                method,
                query,
                body: bodyData,
                createdAt: new Date().toISOString(),
                ok: true,
                response: parsed,
                rawResponse: raw,
            };
            this.sessionStore.appendQueryRecord(sid, successRecord);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify(parsed));
            reqLogger.debug({ path, method }, "Served REST query response");
            this.sessionStore.appendRestHistoryEntry(sid, {
                type: "query",
                record: successRecord,
                response: parsed,
                rawResponse: raw,
                ok: true,
                durationMs: Date.now() - requestStart,
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error from model";
            reqLogger.error({ err: error }, "REST query failed");
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({ success: false, error: message }));
            const failureRecord = {
                id: randomUUID(),
                path,
                method,
                query,
                body: bodyData,
                createdAt: new Date().toISOString(),
                ok: false,
                response: null,
                rawResponse: "",
                error: message,
            };
            this.sessionStore.appendQueryRecord(sid, failureRecord);
            this.sessionStore.appendRestHistoryEntry(sid, {
                type: "query",
                record: failureRecord,
                ok: false,
                error: message,
                durationMs: Date.now() - requestStart,
            });
        }
    }
    preparePromptContext(sid, runtime, attachments, llmClient) {
        const fullHistory = this.sessionStore.getHistory(sid);
        const historyLimit = Math.max(1, runtime.historyLimit);
        const limitedHistory = historyLimit >= fullHistory.length
            ? fullHistory
            : fullHistory.slice(-historyLimit);
        const limitOmitted = fullHistory.length - limitedHistory.length;
        const selection = selectHistoryForPrompt(limitedHistory, runtime.historyMaxBytes);
        const historyForPrompt = selection.entries;
        const byteOmitted = limitedHistory.length - historyForPrompt.length;
        const prevHtml = historyForPrompt.at(-1)?.response.html ??
            limitedHistory.at(-1)?.response.html ??
            this.sessionStore.getPrevHtml(sid);
        const includeAttachments = supportsImageInput(llmClient.settings.provider, llmClient.settings.model);
        const promptAttachments = includeAttachments
            ? attachments.map((attachment) => ({ ...attachment }))
            : [];
        const omittedAttachmentCount = includeAttachments
            ? 0
            : attachments.length;
        return {
            historyForPrompt,
            historyTotal: fullHistory.length,
            historyLimit,
            historyBytesUsed: selection.bytes,
            historyLimitOmitted: limitOmitted,
            historyByteOmitted: byteOmitted,
            prevHtml,
            attachments: promptAttachments,
            omittedAttachmentCount,
        };
    }
}
function sanitizeQuery(url) {
    const entries = Array.from(url.searchParams.entries());
    const filtered = entries.filter(([key]) => key !== "__serve-llm");
    return Object.fromEntries(filtered);
}
function sanitizeBody(body) {
    const result = {};
    for (const [key, value] of Object.entries(body ?? {})) {
        if (key === "__serve-llm") {
            continue;
        }
        if (Array.isArray(value)) {
            const filtered = value.filter((item) => !(typeof item === "string" && item === "interceptor"));
            if (filtered.length === 1) {
                result[key] = filtered[0];
            }
            else if (filtered.length > 1) {
                result[key] = filtered;
            }
            continue;
        }
        if (value === "interceptor") {
            continue;
        }
        result[key] = value;
    }
    return result;
}
