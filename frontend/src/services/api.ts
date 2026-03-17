import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('access_token');
  console.log('getAuthHeader - Token found:', !!token);
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
};

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Log all requests
api.interceptors.request.use((config) => {
  const authHeader = getAuthHeader();
  console.log(`Request: ${config.method?.toUpperCase()} ${config.url}`,
    authHeader.Authorization ? 'WITH auth' : 'NO auth');
  return config;
});

// Auth API
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  registerStudent: (data: any) =>
    api.post('/auth/register/student', data, { headers: getAuthHeader() }),

  getMe: () =>
    api.get('/auth/me', { headers: getAuthHeader() }),
};

// Students API
export const studentsAPI = {
  getAll: (params?: any) =>
    api.get('/students', { params, headers: getAuthHeader() }),

  getById: (id: number) =>
    api.get(`/students/${id}`, { headers: getAuthHeader() }),

  create: (data: any) =>
    api.post('/students', data, { headers: getAuthHeader() }),

  update: (id: number, data: any) =>
    api.put(`/students/${id}`, data, { headers: getAuthHeader() }),

  delete: (id: number) =>
    api.delete(`/students/${id}`, { headers: getAuthHeader() }),

  getCourses: () =>
    api.get('/students/courses/list', { headers: getAuthHeader() }),
};

// Courses API
export const coursesAPI = {
  getAll: (params?: any) =>
    api.get('/courses', { params, headers: getAuthHeader() }),

  getById: (id: number) =>
    api.get(`/courses/${id}`, { headers: getAuthHeader() }),

  create: (data: any) =>
    api.post('/courses', data, { headers: getAuthHeader() }),

  update: (id: number, data: any) =>
    api.put(`/courses/${id}`, data, { headers: getAuthHeader() }),

  delete: (id: number) =>
    api.delete(`/courses/${id}`, { headers: getAuthHeader() }),

  getList: () =>
    api.get('/courses/list', { headers: getAuthHeader() }),
};

// Fees API
export const feesAPI = {
  getDashboard: () =>
    api.get('/fees/dashboard', { headers: getAuthHeader() }),

  getOverviewByCourse: () =>
    api.get('/fees/overview-by-course', { headers: getAuthHeader() }),

  getAll: (params?: any) =>
    api.get('/fees', { params, headers: getAuthHeader() }),

  getById: (id: number) =>
    api.get(`/fees/${id}`, { headers: getAuthHeader() }),

  create: (data: any) =>
    api.post('/fees', data, { headers: getAuthHeader() }),

  update: (id: number, data: any) =>
    api.put(`/fees/${id}`, data, { headers: getAuthHeader() }),

  pay: (id: number, data: any) =>
    api.post(`/fees/${id}/pay`, data, { headers: getAuthHeader() }),

  bulkCreate: (data: any) => {
    const formData = new FormData();
    formData.append('course_id', data.course_id.toString());
    formData.append('fee_type', data.fee_type);
    formData.append('amount', data.amount.toString());
    formData.append('due_date', data.due_date);
    formData.append('academic_year', data.academic_year);
    formData.append('semester', data.semester.toString());
    if (data.description) formData.append('description', data.description);
    return api.post('/fees/bulk-create', formData, {
      headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' },
    });
  },

  exportReport: (params?: any) =>
    api.get('/fees/export', { params, headers: getAuthHeader() }),

  getReceipt: (feeId: number) =>
    api.get(`/fees/${feeId}/receipt`, { headers: getAuthHeader() }),
};

// Documents API
export const documentsAPI = {
  getStats: () =>
    api.get('/documents/stats', { headers: getAuthHeader() }),

  getAll: (params?: any) =>
    api.get('/documents', { params, headers: getAuthHeader() }),

  getById: (id: number) =>
    api.get(`/documents/${id}`, { headers: getAuthHeader() }),

  getHistory: (id: number) =>
    api.get(`/documents/${id}/history`, { headers: getAuthHeader() }),

  getTypes: () =>
    api.get('/documents/types', { headers: getAuthHeader() }),

  // Admin document type management
  getAllTypes: () =>
    api.get('/documents/types/all', { headers: getAuthHeader() }),

  createType: (data: any) =>
    api.post('/documents/types', data, { headers: getAuthHeader() }),

  updateType: (id: number, data: any) =>
    api.put(`/documents/types/${id}`, data, { headers: getAuthHeader() }),

  deleteType: (id: number) =>
    api.delete(`/documents/types/${id}`, { headers: getAuthHeader() }),

  upload: (formData: FormData) =>
    api.post('/documents', formData, {
      headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' },
    }),

  bulkUpload: (formData: FormData) =>
    api.post('/documents/bulk-upload', formData, {
      headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' },
    }),

  update: (id: number, data: any) =>
    api.put(`/documents/${id}`, data, { headers: getAuthHeader() }),

  verify: (id: number, notes?: string) =>
    api.put(`/documents/${id}/verify`, { notes }, { headers: getAuthHeader() }),

  reject: (id: number, notes?: string) =>
    api.put(`/documents/${id}/reject`, { notes }, { headers: getAuthHeader() }),

  delete: (id: number) =>
    api.delete(`/documents/${id}`, { headers: getAuthHeader() }),

  // Student-specific
  getMyDocuments: () =>
    api.get('/documents/my-documents', { headers: getAuthHeader() }),

  getMyStats: () =>
    api.get('/documents/my-stats', { headers: getAuthHeader() }),

  download: (id: number) =>
    api.get(`/documents/${id}/download`, {
      headers: getAuthHeader(),
      responseType: 'blob' as const,
    }),

  uploadMyDocument: (documentType: string, file: File, documentId?: number) => {
    const formData = new FormData();
    formData.append('document_type', documentType);
    formData.append('file', file);
    if (documentId) {
      formData.append('document_id', documentId.toString());
    }
    return api.post('/documents/upload', formData, {
      headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' },
    });
  },

  uploadMultipleDocuments: (documentType: string, files: File[]) => {
    const formData = new FormData();
    formData.append('document_type', documentType);
    files.forEach((file) => {
      formData.append('files', file);
    });
    return api.post('/documents/upload-multiple', formData, {
      headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteMyDocument: (documentId: number) =>
    api.delete(`/documents/${documentId}`, { headers: getAuthHeader() }),

  // Document Requests
  getDocumentRequests: (params?: any) =>
    api.get('/documents/requests', { params, headers: getAuthHeader() }),

  createDocumentRequest: (data: any) =>
    api.post('/documents/requests', data, { headers: getAuthHeader() }),

  createBulkDocumentRequest: (data: any) =>
    api.post('/documents/requests/bulk', data, { headers: getAuthHeader() }),

  cancelDocumentRequest: (requestId: number) =>
    api.put(`/documents/requests/${requestId}/cancel`, {}, { headers: getAuthHeader() }),

  downloadAllDocuments: (studentId: number) =>
    api.get(`/documents/student/${studentId}/download-all`, {
      headers: getAuthHeader(),
      responseType: 'blob' as const
    }),
};

// Student Fees API
export const studentFeesAPI = {
  getMyFees: () =>
    api.get('/fees/my-fees', { headers: getAuthHeader() }),

  getMySummary: () =>
    api.get('/fees/my-summary', { headers: getAuthHeader() }),
};

// Payments API (Razorpay)
export const paymentsAPI = {
  createOrder: (feeId: number) =>
    api.post('/payments/create-order', { fee_id: feeId }, { headers: getAuthHeader() }),

  verifyPayment: (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    fee_id: number;
  }) =>
    api.post('/payments/verify', data, { headers: getAuthHeader() }),

  getPaymentByFee: (feeId: number) =>
    api.get(`/payments/fee/${feeId}`, { headers: getAuthHeader() }),

  getPaymentHistory: () =>
    api.get('/payments/history', { headers: getAuthHeader() }),

  // Upload receipt (admin only)
  uploadReceipt: (paymentId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/payments/${paymentId}/upload-receipt`, formData, {
      headers: { ...getAuthHeader(), 'Content-Type': 'multipart/form-data' },
    });
  },

  // Download receipt - returns full response with headers
  downloadReceipt: async (paymentId: number) => {
    const response = await api.get(`/payments/${paymentId}/receipt`, {
      headers: getAuthHeader(),
      responseType: 'blob',
    });
    return response;
  },
};

export default api;
