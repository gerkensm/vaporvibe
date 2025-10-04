declare module "@anthropic-ai/sdk" {
  export interface AnthropicMessageContent {
    type?: string;
    text?: string;
  }

  export interface AnthropicMessage {
    role: "user" | "assistant";
    content: AnthropicMessageContent[];
  }

  export interface AnthropicMessageResponse {
    content?: AnthropicMessageContent[];
  }

  export interface AnthropicStreamEvent {
    type?: string;
    delta?: { type?: string; text?: string };
    content_block_delta?: { delta?: { type?: string; text?: string } };
  }

  export interface AnthropicStream extends AsyncIterable<AnthropicStreamEvent> {
    finalMessage(): Promise<AnthropicMessageResponse | null>;
    close?(): Promise<void>;
  }

  export default class Anthropic {
    constructor(options: { apiKey: string });
    messages: {
      create(params: {
        model: string;
        max_output_tokens: number;
        system?: string;
        messages: AnthropicMessage[];
      }): Promise<AnthropicMessageResponse>;
      stream(params: {
        model: string;
        max_output_tokens: number;
        system?: string;
        messages: AnthropicMessage[];
        thinking?: { type: "thinking"; budget_tokens: number };
      }): Promise<AnthropicStream>;
    };
  }
}
