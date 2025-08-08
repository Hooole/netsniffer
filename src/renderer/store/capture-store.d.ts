export interface CapturedRequest {
    id: string;
    timestamp: string;
    method: string;
    url: string;
    host: string;
    protocol: string;
    statusCode?: number;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    requestBody?: string;
    responseBody?: string;
    duration?: number;
}
export interface CaptureFilters {
    search: string;
    method: string;
    protocol: string;
    status: string;
}
interface CaptureStore {
    capturedData: CapturedRequest[];
    selectedRequest: CapturedRequest | null;
    filters: CaptureFilters;
    setCapturedData: (data: CapturedRequest[]) => void;
    addCapturedRequest: (request: CapturedRequest) => void;
    setSelectedRequest: (request: CapturedRequest | null) => void;
    setFilters: (filters: Partial<CaptureFilters>) => void;
    clearData: () => void;
    getFilteredData: () => CapturedRequest[];
}
export declare const useCaptureStore: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<CaptureStore>, "setState"> & {
    setState<A extends string | {
        type: string;
    }>(partial: CaptureStore | Partial<CaptureStore> | ((state: CaptureStore) => CaptureStore | Partial<CaptureStore>), replace?: boolean | undefined, action?: A | undefined): void;
}>;
export {};
//# sourceMappingURL=capture-store.d.ts.map