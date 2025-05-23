import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
const api = axios.create({
  baseURL: API_URL,
});

export interface FileItem {
  id: string;
  file: string;
  original_filename: string;
  file_type: string;
  size: number;
  uploaded_at: string;
  is_duplicate: boolean;
  reference_count: number;
  original_file: string | null;
  storage_saved: number;
  version: number;
  duplicate_detected?: boolean;
}

export interface FileStats {
  total_files: number;
  unique_files: number;
  duplicate_files: number;
  total_storage: number;
  storage_saved: number;
  storage_efficiency: string;
}

export interface FileFilters {
  searchQuery?: string;
  fileTypes?: string[];
  minSize?: number | null;
  maxSize?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  unique_only?: boolean;
}

export interface DownloadParams {
  fileUrl: string;
  filename: string;
}

export interface UploadResponse extends FileItem {
  duplicate_detected?: boolean;
}

export interface DuplicatesResponse {
  original_file: FileItem;
  duplicate_count: number;
  duplicates: FileItem[];
}

export const fileService = {
  getFiles: async (filters: FileFilters): Promise<FileItem[]> => {
    const params: Record<string, any> = {};
    if (filters?.searchQuery) {
      params.search = filters.searchQuery;
    }
    if (filters?.fileTypes && filters.fileTypes.length > 0) {
      params.file_type = filters.fileTypes;
    }
    if (filters?.minSize !== null && filters?.minSize !== undefined) {
      params.min_size = filters.minSize;
    }
    if (filters?.maxSize !== null && filters?.maxSize !== undefined) {
      params.max_size = filters.maxSize;
    }
    if (filters?.startDate) {
      params.start_date = filters.startDate;
    }
    if (filters?.endDate) {
      params.end_date = filters.endDate;
    }
    if (filters?.unique_only !== undefined) {
      params.unique_only = filters.unique_only;
    }
    const response = await api.get('/files/', {
      params,
      paramsSerializer: {
        indexes: null
      }
    });
    return response.data;
  },
  
  getFileDuplicates: async (fileId: string): Promise<DuplicatesResponse> => {
    const response = await api.get(`/files/${fileId}/duplicates/`);
    return response.data;
  },
  
  uploadFile: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/files/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  deleteFile: async (id: string): Promise<string> => {
    await api.delete(`/files/${id}/`);
    return id;
  },
  
  downloadFile: async (fileUrl: string, filename: string): Promise<DownloadParams> => {
    const response = await axios.get(fileUrl, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return { fileUrl, filename };
  },
  
  getFileStats: async (): Promise<FileStats> => {
    const response = await api.get('/files/stats/');
    return response.data;
  },
};