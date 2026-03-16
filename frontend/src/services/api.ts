// // import axios from 'axios';

// // const API_URL = 'http://localhost:8004/api';
// // // const API_URL = 'http://192.168.1.102:8004/api';


// import axios from 'axios';

// // Auto-detect API URL based on hostname
// // - Use localhost when on laptop browser
// // - Use IP address when accessed from other devices (mobile/tablet)
// const getApiUrl = () => {
//   const hostname = window.location.hostname;
  
//   // If hostname is localhost or 127.0.0.1, use localhost
//   if (hostname === 'localhost' || hostname === '127.0.0.1') {
//     return 'http://localhost:8004/api';
//   }
  
//   // Otherwise (mobile or other device), use IP address
//   return 'http://192.168.1.5:8004/api';
// };

// const API_URL = getApiUrl();


// const getAuthHeader = () => {
//   const token = localStorage.getItem('access_token');
//   console.log('getAuthHeader - Token found:', !!token);
//   if (token) {
//     return { Authorization: `Bearer ${token}` };
//   }
//   return {};
// };

// const api = axios.create({
//   baseURL: API_URL,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// // Log all requests
// api.interceptors.request.use((config) => {
//   const authHeader = getAuthHeader();
//   console.log(`Request: ${config.method?.toUpperCase()} ${config.url}`,
//     authHeader.Authorization ? 'WITH auth' : 'NO auth');
//   return config;
// });

// // Auth API
// export const authAPI = {
//   login: (email: string, password: string) =>
//     api.post('/auth/login', { email, password }),

//   registerStudent: (data: any) =>
//     api.post('/auth/register/student', data, { headers: getAuthHeader() }),

//   getMe: () =>
//     api.get('/auth/me', { headers: getAuthHeader() }),
// };

// // Students API
// export const studentsAPI = {
//   getAll: (params?: any) =>
//     api.get('/students', { params, headers: getAuthHeader() }),

//   getById: (id: number) =>
//     api.get(`/students/${id}`, { headers: getAuthHeader() }),

//   create: (data: any) =>
//     api.post('/students', data, { headers: getAuthHeader() }),

//   update: (id: number, data: any) =>
//     api.put(`/students/${id}`, data, { headers: getAuthHeader() }),

//   delete: (id: number) =>
//     api.delete(`/students/${id}`, { headers: getAuthHeader() }),

//   getCourses: () =>
//     api.get('/students/courses/list', { headers: getAuthHeader() }),
// };

// // Fees API
// export const feesAPI = {
//   getDashboard: () =>
//     api.get('/fees/dashboard', { headers: getAuthHeader() }),

//   getOverviewByCourse: () =>
//     api.get('/fees/overview-by-course', { headers: getAuthHeader() }),

//   getAll: (params?: any) =>
//     api.get('/fees', { params, headers: getAuthHeader() }),

//   getById: (id: number) =>
//     api.get(`/fees/${id}`, { headers: getAuthHeader() }),

//   create: (data: any) =>
//     api.post('/fees', data, { headers: getAuthHeader() }),

//   update: (id: number, data: any) =>
//     api.put(`/fees/${id}`, data, { headers: getAuthHeader() }),

//   pay: (id: number, data: any) =>
//     api.post(`/fees/${id}/pay`, data, { headers: getAuthHeader() }),

//   bulkCreate: (data: any) => {
//     const formData = new FormData();
//     formData.append('course_id', data.course_id.toString());
//     formData.append('fee_type', data.fee_type);
//     formData.append('amount', data.amount.toString());
//     formData.append('due_date', data.due_date);
//     formData.append('academic_year', data.academic_year);
//     formData.append('semester', data.semester.toString());
//     if (data.description) formData.append('description', data.description);
//     return api.post('/fees/bulk-create', formData, {
//       headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' },
//     });
//   },

//   exportReport: (params?: any) =>
//     api.get('/fees/export', { params, headers: getAuthHeader() }),

//   getReceipt: (feeId: number) =>
//     api.get(`/fees/${feeId}/receipt`, { headers: getAuthHeader() }),
// };

// // Documents API
// // Extended interface to include all filter and sort parameters
// // Use case: Admin needs to filter and sort documents by various criteria
// export interface DocumentFilters {
//   page?: number;
//   page_size?: number;
//   search?: string;              // Search by student name or admission number
//   status?: string;               // Filter by status: pending, verified, rejected
//   document_type?: string;        // Filter by document type
//   // category?: string;          // COMMENTED - not needed
//   date_from?: string;           // Filter documents from this date (ISO string)
//   date_to?: string;             // Filter documents until this date (ISO string)
//   sort_by?: 'issued_date' | 'student_name' | 'status' | 'document_type';  // Field to sort by
//   sort_order?: 'asc' | 'desc';  // Sort direction
// }

// export const documentsAPI = {
//   // Get all documents with advanced filtering and sorting
//   // Use case: Admin views document list with applied filters
//   getAll: (params?: DocumentFilters) =>
//     api.get('/documents', { params, headers: getAuthHeader() }),

//   // Get document statistics for dashboard
//   // Use case: Admin views document stats on dashboard
//   getStats: () =>
//     api.get('/documents/stats', { headers: getAuthHeader() }),

//   getById: (id: number) =>
//     api.get(`/documents/${id}`, { headers: getAuthHeader() }),

//   getHistory: (id: number) =>
//     api.get(`/documents/${id}/history`, { headers: getAuthHeader() }),

//   getTypes: () =>
//     api.get('/documents/types', { headers: getAuthHeader() }),

//   upload: (formData: FormData) =>
//     api.post('/documents', formData, {
//       headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' },
//     }),

//   bulkUpload: (formData: FormData) =>
//     api.post('/documents/bulk-upload', formData, {
//       headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' },
//     }),

//   update: (id: number, data: any) =>
//     api.put(`/documents/${id}`, data, { headers: getAuthHeader() }),

//   verify: (id: number, notes?: string) =>
//     api.put(`/documents/${id}/verify`, { notes }, { headers: getAuthHeader() }),

//   reject: (id: number, notes?: string) =>
//     api.put(`/documents/${id}/reject`, { notes }, { headers: getAuthHeader() }),

//   delete: (id: number) =>
//     api.delete(`/documents/${id}`, { headers: getAuthHeader() }),

//   // Student-specific
//   getMyDocuments: () =>
//     api.get('/documents/my-documents', { headers: getAuthHeader() }),

//   getMyStats: () =>
//     api.get('/documents/my-stats', { headers: getAuthHeader() }),

//   download: (id: number) =>
//     api.get(`/documents/${id}/download`, {
//       headers: getAuthHeader(),
//       responseType: 'blob' as const,
//     }),

//   uploadMyDocument: (documentType: string, file: File, documentId?: number) => {
//     const formData = new FormData();
//     formData.append('document_type', documentType);
//     formData.append('file', file);
//     if (documentId) {
//       formData.append('document_id', documentId.toString());
//     }
//     return api.post('/documents/upload', formData, {
//       headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' },
//     });
//   },

//   deleteMyDocument: (documentId: number) =>
//     api.delete(`/documents/${documentId}`, { headers: getAuthHeader() }),

//   // Document Requests
//   getDocumentRequests: (params?: any) =>
//     api.get('/documents/requests', { params, headers: getAuthHeader() }),

//   createDocumentRequest: (data: any) =>
//     api.post('/documents/requests', data, { headers: getAuthHeader() }),

//   cancelDocumentRequest: (requestId: number) =>
//     api.put(`/documents/requests/${requestId}/cancel`, {}, { headers: getAuthHeader() }),

//   downloadAllDocuments: (studentId: number) =>
//     api.get(`/documents/student/${studentId}/download-all`, {
//       headers: getAuthHeader(),
//       responseType: 'blob' as const
//     }),
// };

// // Student Fees API
// export const studentFeesAPI = {
//   getMyFees: () =>
//     api.get('/fees/my-fees', { headers: getAuthHeader() }),

//   getMySummary: () =>
//     api.get('/fees/my-summary', { headers: getAuthHeader() }),
// };

// export default api;








// ------------------------------- New API Service with React Query ------------------


import axios from 'axios';

// Dynamically detect API URL based on the current network
const getApiUrl = () => {
  const hostname = window.location.hostname;
  
  // If accessing from localhost, use localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8004/api';
  }
  
  // If accessing from mobile/tablet (using IP), use that IP
  return `http://${hostname}:8004/api`;
};

const API_URL = getApiUrl();

// Get auth token from localStorage
const getAuthHeader = () => {
  const token = localStorage.getItem('access_token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
};

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token in ALL requests
api.interceptors.request.use(
  (config) => {
    const authHeader = getAuthHeader();
    if (authHeader.Authorization) {
      config.headers.Authorization = authHeader.Authorization;
    }
    console.log(`Request: ${config.method?.toUpperCase()} ${config.url}`, 
      authHeader.Authorization ? 'WITH auth' : 'NO auth');
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage and redirect to login
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==================== Auth API ====================
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
};

// ==================== Students API ====================
export const studentsAPI = {
  getAll: (params?: any) => api.get('/students', { params }),
  getById: (id: number) => api.get(`/students/${id}`),
  create: (data: any) => api.post('/students', data),
  update: (id: number, data: any) => api.put(`/students/${id}`, data),
  delete: (id: number) => api.delete(`/students/${id}`),
};

// ==================== Fees API ====================
export const feesAPI = {
  getAll: (params?: any) => api.get('/fees', { params }),
  getById: (id: number) => api.get(`/fees/${id}`),
  create: (data: any) => api.post('/fees', data),
  update: (id: number, data: any) => api.put(`/fees/${id}`, data),
  delete: (id: number) => api.delete(`/fees/${id}`),
};

// ==================== Student Fees API ====================
export const studentFeesAPI = {
  getMyFees: () => api.get('/fees/my-fees'),
  getMySummary: () => api.get('/fees/my-summary'),
};

// ==================== Documents API ====================
export const documentsAPI = {
  // Admin documents
  getAll: (params?: any) => api.get('/documents', { params }),
  getById: (id: number) => api.get(`/documents/${id}`),
  getTypes: () => api.get('/documents/types'),
  create: (data: any) => api.post('/documents', data),
  createDocumentRequest: (data: any) => api.post('/documents/request', data),
  update: (id: number, data: any) => api.put(`/documents/${id}`, data),
  delete: (id: number) => api.delete(`/documents/${id}`),
  
  // Download
  download: (id: number) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
  downloadAllDocuments: (studentId: number) => 
    api.get(`/documents/student/${studentId}/download-all`, { responseType: 'blob' }),
  
  // Upload
  upload: (formData: FormData) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  bulkUpload: (formData: FormData) => api.post('/documents/bulk-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  
  // History
  getHistory: (id: number) => api.get(`/documents/${id}/history`),
  
  // Student documents
  getMyDocuments: () => api.get('/documents/my-documents'),
  getMyStats: () => api.get('/documents/my-stats'),
  getDocumentRequests: (params?: any) => api.get('/documents/requests', { params }),
  uploadMyDocument: (documentType: string, file: File, reuploadId?: number) => {
    const formData = new FormData();
    formData.append('document_type', documentType);
    formData.append('file', file);
    if (reuploadId) {
      formData.append('reupload_id', reuploadId.toString());
    }
    return api.post('/documents/upload-my-document', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default api;
