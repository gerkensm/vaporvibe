import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export interface Prompter {
  ask(question: string): Promise<string>;
  askHidden(question: string): Promise<string>;
  close(): Promise<void>;
}

export function createPrompter(): Prompter | null {
  if (!input.isTTY || !output.isTTY) {
    return null;
  }

  const rl = readline.createInterface({ input, output, terminal: true });

  async function ask(question: string): Promise<string> {
    const answer = await rl.question(question);
    return answer.trim();
  }

  async function askHidden(question: string): Promise<string> {
    output.write(question);
    const wasRaw = input.isRaw ?? false;
    input.setRawMode?.(true);

    return new Promise<string>((resolve, reject) => {
      const chars: string[] = [];
      const onData = (chunk: Buffer) => {
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
          chars.push(ch);
        }
      };
      const cleanup = () => {
        input.off("data", onData);
        input.setRawMode?.(wasRaw);
      };
      input.on("data", onData);
    });
  }

  async function close(): Promise<void> {
    rl.close();
  }

  return { ask, askHidden, close };
}
