import querystring from "node:querystring";
export async function readBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const buffer = Buffer.concat(chunks);
    const raw = buffer.toString("utf8");
    const type = (req.headers["content-type"] || "").split(";")[0]?.trim().toLowerCase();
    if (!raw) {
        return { raw: "", data: {}, files: [] };
    }
    if (type === "multipart/form-data") {
        const boundary = extractBoundary(req.headers["content-type"]);
        if (!boundary) {
            return { raw, data: {}, files: [] };
        }
        const parsed = parseMultipartFormData(buffer, boundary);
        return { raw, data: parsed.fields, files: parsed.files };
    }
    if (type === "application/json") {
        return { raw, data: safeJson(raw), files: [] };
    }
    if (type === "application/x-www-form-urlencoded") {
        return {
            raw,
            data: querystring.parse(raw),
            files: [],
        };
    }
    return { raw, data: { _raw: raw }, files: [] };
}
function safeJson(value) {
    try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === "object") {
            return parsed;
        }
        return { value: parsed };
    }
    catch {
        return { _raw: value };
    }
}
function extractBoundary(contentType) {
    if (!contentType) {
        return undefined;
    }
    const value = Array.isArray(contentType) ? contentType[0] : contentType;
    if (!value) {
        return undefined;
    }
    const match = /boundary=(?:"?)([^";]+)(?:"?)/i.exec(value);
    return match ? match[1] : undefined;
}
function parseMultipartFormData(buffer, boundary) {
    const boundaryMarker = `--${boundary}`;
    const segments = buffer.toString("latin1").split(boundaryMarker);
    const fields = {};
    const files = [];
    for (const segment of segments) {
        if (!segment || segment === "--" || segment === "--\r\n") {
            continue;
        }
        let trimmed = segment;
        if (trimmed.startsWith("\r\n")) {
            trimmed = trimmed.slice(2);
        }
        if (trimmed.endsWith("\r\n")) {
            trimmed = trimmed.slice(0, -2);
        }
        if (!trimmed || trimmed === "--") {
            continue;
        }
        const separatorIndex = trimmed.indexOf("\r\n\r\n");
        if (separatorIndex === -1) {
            continue;
        }
        const headerText = trimmed.slice(0, separatorIndex);
        let contentText = trimmed.slice(separatorIndex + 4);
        if (contentText.endsWith("\r\n")) {
            contentText = contentText.slice(0, -2);
        }
        const headers = headerText.split("\r\n");
        let fieldName;
        let filename;
        let mimeType = "application/octet-stream";
        for (const header of headers) {
            const [rawKey, ...rawValue] = header.split(":");
            if (!rawKey || rawValue.length === 0) {
                continue;
            }
            const key = rawKey.trim().toLowerCase();
            const value = rawValue.join(":").trim();
            if (key === "content-disposition") {
                const nameMatch = /name="([^"]+)"/.exec(value);
                if (nameMatch) {
                    fieldName = nameMatch[1];
                }
                const filenameMatch = /filename="([^"]*)"/.exec(value);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }
            else if (key === "content-type") {
                if (value) {
                    mimeType = value;
                }
            }
        }
        if (!fieldName) {
            continue;
        }
        const contentBuffer = Buffer.from(contentText, "latin1");
        if (filename) {
            files.push({
                fieldName,
                filename,
                mimeType,
                size: contentBuffer.length,
                data: contentBuffer,
            });
        }
        else {
            appendFieldValue(fields, fieldName, contentBuffer.toString("utf8"));
        }
    }
    return { fields, files };
}
function appendFieldValue(fields, name, value) {
    if (Object.prototype.hasOwnProperty.call(fields, name)) {
        const existing = fields[name];
        if (Array.isArray(existing)) {
            existing.push(value);
        }
        else {
            fields[name] = [existing, value];
        }
    }
    else {
        fields[name] = value;
    }
}
