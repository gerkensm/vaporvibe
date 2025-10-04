import type { ServerResponse } from "node:http";
export interface CookieOptions {
    maxAge?: number;
    domain?: string;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
}
export declare function parseCookies(header: string | undefined): Record<string, string>;
export declare function setCookie(res: ServerResponse, name: string, value: string, options?: CookieOptions): void;
