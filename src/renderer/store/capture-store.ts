import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

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

  // Actions
  setCapturedData: (data: CapturedRequest[]) => void;
  addCapturedRequest: (request: CapturedRequest) => void;
  setSelectedRequest: (request: CapturedRequest | null) => void;
  setFilters: (filters: Partial<CaptureFilters>) => void;
  clearData: () => void;

  // Computed
  getFilteredData: () => CapturedRequest[];
}

const initialFilters: CaptureFilters = {
  search: '',
  method: '',
  protocol: '',
  status: '',
};

export const useCaptureStore = create<CaptureStore>()(
  devtools(
    (set, get) => ({
      capturedData: [],
      selectedRequest: null,
      filters: initialFilters,

      setCapturedData: (data) => {
        console.log('📥 Setting captured data:', data.length, 'requests');
        set({ capturedData: data });
      },

      addCapturedRequest: (request) => {
        console.log('➕ Adding captured request:', request.method, request.url);
        set((state) => ({
          capturedData: [request, ...state.capturedData],
        }));
      },

      setSelectedRequest: (request) => set({ selectedRequest: request }),

      setFilters: (newFilters) =>
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        })),

      clearData: () => set({ capturedData: [], selectedRequest: null }),

      getFilteredData: () => {
        const { capturedData, filters } = get();
        console.log('capturedData1', capturedData);
        const filtered = capturedData.filter((request) => {
          // 搜索过滤
          if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            const searchable = [request.url, request.host, request.method].join(' ').toLowerCase();

            if (!searchable.includes(searchLower)) {
              return false;
            }
          }

          // 方法过滤
          if (filters.method && request.method !== filters.method) {
            return false;
          }

          // 协议过滤
          if (filters.protocol && request.protocol !== filters.protocol) {
            return false;
          }

          // 状态码过滤
          if (filters.status) {
            const statusCode = request.statusCode;
            if (!statusCode) return false;

            switch (filters.status) {
              case '2xx':
                return statusCode >= 200 && statusCode < 300;
              case '3xx':
                return statusCode >= 300 && statusCode < 400;
              case '4xx':
                return statusCode >= 400 && statusCode < 500;
              case '5xx':
                return statusCode >= 500;
              default:
                return true;
            }
          }

          return true;
        });
        // 最新的排在最前面
        return filtered.sort((a, b) => {
          const ta = new Date(a.timestamp).getTime();
          const tb = new Date(b.timestamp).getTime();
          return tb - ta;
        });
      },
    }),
    {
      name: 'capture-store',
    }
  )
);
