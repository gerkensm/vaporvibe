import readline from "node:readline/promises";
import { Writable } from "node:stream";
import { stdin as input, stdout as output } from "node:process";
export function createPrompter() {
    if (!input.isTTY || !output.isTTY) {
        return null;
    }
    async function ask(question) {
        const rl = readline.createInterface({ input, output, terminal: true });
        try {
            const answer = await rl.question(question);
            return answer.trim();
        }
        finally {
            await rl.close();
        }
    }
    async function askHidden(question) {
        const masked = createMaskedOutput();
        const rl = readline.createInterface({ input, output: masked.stream, terminal: true });
        const abortController = new AbortController();
        const handleSigint = () => {
            if (!abortController.signal.aborted) {
                abortController.abort(new Error("Input cancelled"));
            }
        };
        rl.once("SIGINT", handleSigint);
        try {
            masked.setMasked(false);
            const prompt = question.endsWith("\n") ? question : `${question}\n`;
            output.write(prompt);
            masked.setMasked(true);
            const answer = await rl.question("", { signal: abortController.signal });
            output.write("\n");
            return answer.trim();
        }
        catch (error) {
            if (isAbortError(error)) {
                output.write("\n");
                throw new Error("Input cancelled");
            }
            throw error;
        }
        finally {
            rl.off("SIGINT", handleSigint);
            masked.setMasked(false);
            await rl.close();
            masked.dispose();
        }
    }
    async function close() {
        // Interfaces are created per question, so nothing to tear down.
    }
    return { ask, askHidden, close };
}
function createMaskedOutput() {
    let masked = false;
    const stream = new Writable({
        write(chunk, encoding, callback) {
            const value = typeof chunk === "string"
                ? chunk
                : Buffer.isBuffer(chunk)
                    ? chunk.toString()
                    : String(chunk);
            output.write(masked ? maskPrintableCharacters(value) : value);
            callback();
        },
    });
    return {
        stream,
        setMasked(next) {
            masked = next;
        },
        dispose() {
            stream.end();
        },
    };
}
function maskPrintableCharacters(value) {
    let result = "";
    for (let index = 0; index < value.length; index += 1) {
        const codePoint = value.codePointAt(index);
        if (codePoint === undefined) {
            continue;
        }
        if (codePoint === 0x1b) {
            const match = matchCsiSequence(value, index);
            if (match) {
                result += match.sequence;
                index += match.length - 1;
                continue;
            }
        }
        if (codePoint === 0x0d || codePoint === 0x0a || codePoint === 0x09 || codePoint === 0x08) {
            result += String.fromCodePoint(codePoint);
            continue;
        }
        if (codePoint < 32 || codePoint === 127) {
            result += String.fromCodePoint(codePoint);
            continue;
        }
        result += "*";
        if (codePoint > 0xffff) {
            index += 1;
        }
    }
    return result;
}
function matchCsiSequence(value, index) {
    const rest = value.slice(index);
    const match = /^\u001b\[[0-9;?]*[@-~]/.exec(rest);
    if (!match) {
        return null;
    }
    return {
        sequence: match[0],
        length: match[0].length,
    };
}
function isAbortError(error) {
    return error instanceof Error && error.name === "AbortError";
}
