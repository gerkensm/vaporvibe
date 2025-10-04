import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
export function createPrompter() {
    if (!input.isTTY || !output.isTTY) {
        return null;
    }
    const rl = readline.createInterface({ input, output, terminal: true });
    async function ask(question) {
        const answer = await rl.question(question);
        return answer.trim();
    }
    async function askHidden(question) {
        output.write(question);
        const wasRaw = input.isRaw ?? false;
        input.setRawMode?.(true);
        return new Promise((resolve, reject) => {
            const chars = [];
            const onData = (chunk) => {
                const str = chunk.toString("utf8");
                for (const ch of str) {
                    if (ch === "\n" || ch === "\r") {
                        cleanup();
                        output.write("\n");
                        resolve(chars.join("").trim());
                        return;
                    }
                    if (ch === "\u0003") {
                        cleanup();
                        reject(new Error("Input cancelled"));
                        return;
                    }
                    if (ch === "\u0008" || ch === "\u007f") {
                        if (chars.length > 0) {
                            chars.pop();
                            output.write("\b \b");
                        }
                        continue;
                    }
                    if (ch < " " || ch === "\u007f") {
                        continue;
                    }
                    chars.push(ch);
                    output.write("*");
                }
            };
            const cleanup = () => {
                input.off("data", onData);
                input.setRawMode?.(wasRaw);
            };
            input.on("data", onData);
        });
    }
    async function close() {
        rl.close();
    }
    return { ask, askHidden, close };
}
