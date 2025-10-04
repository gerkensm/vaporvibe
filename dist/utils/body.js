import querystring from "node:querystring";
export async function readBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    const type = (req.headers["content-type"] || "").split(";")[0]?.trim().toLowerCase();
    if (!raw) {
        return { raw: "", data: {} };
    }
    if (type === "application/json") {
        return { raw, data: safeJson(raw) };
    }
    if (type === "application/x-www-form-urlencoded") {
        return { raw, data: querystring.parse(raw) };
    }
    return { raw, data: { _raw: raw } };
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
