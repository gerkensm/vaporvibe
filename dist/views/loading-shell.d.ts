interface LoadingShellOptions {
    message?: string;
    accent?: string;
    originalPath?: string;
    resultRoutePrefix?: string;
}
export declare function renderLoadingShell(options?: LoadingShellOptions): string;
export declare function renderResultHydrationScript(token: string, path: string): string;
export declare function renderLoaderErrorScript(message: string): string;
export {};
