
import type { AdminStateResponse } from "../../api/types";

export type AsyncStatus = "idle" | "loading" | "success" | "error";

export type StatusMessage = { tone: "info" | "error"; message: string };

export type NullableStatus = StatusMessage | null;

export type QueuedAttachment = {
    id: string;
    file: File;
    name: string;
    size: number;
    mimeType: string;
    isImage: boolean;
    previewUrl: string | null;
};

export type ProviderKey = keyof AdminStateResponse["providerKeyStatuses"];

export type TabKey = "provider" | "brief" | "runtime" | "history";

export interface AdminDashboardProps {
    mode?: "setup" | "auto" | "admin";
}

export interface AdminLocationState {
    showLaunchPad?: boolean;
}
