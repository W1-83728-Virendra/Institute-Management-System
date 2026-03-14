import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { documentsAPI } from '../../services/api';

interface DocumentStats {
  total: number;
  verified: number;
  pending: number;
  issued_this_month: number;
}

interface Document {
  id: number;
  student: any;
  document_type: string;
  file_name: string;
  status: string;
  issued_date: string;
  verified_date?: string;
}

interface DocumentsState {
  stats: DocumentStats | null;
  documents: Document[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  loading: boolean;
  error: string | null;
}

const initialState: DocumentsState = {
  stats: null,
  documents: [],
  total: 0,
  page: 1,
  page_size: 10,
  total_pages: 0,
  loading: false,
  error: null,
};

export const fetchDocumentStats = createAsyncThunk(
  'documents/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await documentsAPI.getStats();
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch stats');
    }
  }
);

export const fetchDocuments = createAsyncThunk(
  'documents/fetchAll',
  async (params: { page?: number; status?: string; document_type?: string } = {}, { rejectWithValue }) => {
    try {
      const response = await documentsAPI.getAll(params);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch documents');
    }
  }
);

export const uploadDocument = createAsyncThunk(
  'documents/upload',
  async (formData: FormData, { rejectWithValue }) => {
    try {
      const response = await documentsAPI.upload(formData);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to upload document');
    }
  }
);

export const verifyDocument = createAsyncThunk(
  'documents/verify',
  async ({ id, notes }: { id: number; notes?: string }, { rejectWithValue }) => {
    try {
      const response = await documentsAPI.verify(id, notes);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to verify document');
    }
  }
);

export const rejectDocument = createAsyncThunk(
  'documents/reject',
  async ({ id, notes }: { id: number; notes?: string }, { rejectWithValue }) => {
    try {
      const response = await documentsAPI.reject(id, notes);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to reject document');
    }
  }
);

const documentsSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDocumentStats.fulfilled, (state, action) => {
        state.stats = action.payload;
      })
      .addCase(fetchDocuments.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.loading = false;
        state.documents = action.payload.items;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.page_size = action.payload.page_size;
        state.total_pages = action.payload.total_pages;
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(uploadDocument.fulfilled, (state, action) => {
        state.documents.unshift(action.payload);
      })
      .addCase(verifyDocument.fulfilled, (state, action) => {
        const index = state.documents.findIndex(d => d.id === action.payload.id);
        if (index !== -1) {
          state.documents[index] = action.payload;
        }
      })
      .addCase(rejectDocument.fulfilled, (state, action) => {
        const index = state.documents.findIndex(d => d.id === action.payload.id);
        if (index !== -1) {
          state.documents[index] = action.payload;
        }
      });
  },
});

export const { clearError } = documentsSlice.actions;
export default documentsSlice.reducer;
