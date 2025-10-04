export interface Prompter {
    ask(question: string): Promise<string>;
    askHidden(question: string): Promise<string>;
    close(): Promise<void>;
}
export declare function createPrompter(): Prompter | null;
