import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { documentsAPI, type DocumentFilters } from '../../services/api';

// --------------------------------------------------------------------------
// Document Filter State Interface
// Use case: Store and manage document filter state in Redux
// --------------------------------------------------------------------------
interface DocumentFilterState {
  search: string;               // Search by student name or admission number
  status: string;                // Filter by status: pending, verified, rejected
  document_type: string;         // Filter by document type
  // category: string;          // COMMENTED - Filter by category (not needed)
  date_from: string;             // Filter documents from this date
  date_to: string;               // Filter documents until this date
  sort_by: string;              // Field to sort by
  sort_order: string;           // Sort direction: asc or desc
}

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
  category?: string;
  issued_date: string;
  verified_date?: string;
}

// --------------------------------------------------------------------------
// Documents State Interface
// Use case: Manage document list, filters, pagination, and loading state
// --------------------------------------------------------------------------
interface DocumentsState {
  stats: DocumentStats | null;
  documents: Document[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  // Filter state - tracks all active filters
  filters: DocumentFilterState;
  loading: boolean;
  error: string | null;
}

// --------------------------------------------------------------------------
// Initial Filter State
// Use case: Default filter values when page loads or when filters are cleared
// --------------------------------------------------------------------------
const initialFilterState: DocumentFilterState = {
  search: '',
  status: '',
  document_type: '',
  // category: '',  // COMMENTED - not needed
  date_from: '',
  date_to: '',
  sort_by: 'issued_date',
  sort_order: 'desc'
};

const initialState: DocumentsState = {
  stats: null,
  documents: [],
  total: 0,
  page: 1,
  page_size: 10,
  total_pages: 0,
  filters: initialFilterState,
  loading: false,
  error: null,
};

// --------------------------------------------------------------------------
// Fetch Document Stats
// Use case: Get document statistics for dashboard display
// --------------------------------------------------------------------------
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

// --------------------------------------------------------------------------
// Fetch Documents with Filters
// Use case: Get documents list with applied filters and sorting
// Params include: pagination, search, status, document_type, category,
// date range, sort field and order
// --------------------------------------------------------------------------
export const fetchDocuments = createAsyncThunk(
  'documents/fetchAll',
  async (filters: DocumentFilters = {}, { rejectWithValue }) => {
    try {
      // Include pagination parameters with filters
      const params = {
        page: filters.page || 1,
        page_size: filters.page_size || 10,
        // Only include filter params if they have values
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status: filters.status }),
        ...(filters.document_type && { document_type: filters.document_type }),
        // ...(filters.category && { category: filters.category }), // COMMENTED - category filter removed
        ...(filters.date_from && { date_from: filters.date_from }),
        ...(filters.date_to && { date_to: filters.date_to }),
        ...(filters.sort_by && { sort_by: filters.sort_by }),
        ...(filters.sort_order && { sort_order: filters.sort_order })
      };
      
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
    // Clear error state
    // Use case: Reset error message after displaying to user
    clearError: (state) => {
      state.error = null;
    },
    
    // Set filter values
    // Use case: Update specific filter(s) when user changes filter options
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    
    // Clear all filters and reset to default
    // Use case: Reset all filters when user clicks "Clear Filters" button
    clearFilters: (state) => {
      state.filters = initialFilterState;
    },
    
    // Set pagination
    // Use case: Update page number when user navigates pagination
    setPage: (state, action) => {
      state.page = action.payload;
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

export const { clearError, setFilters, clearFilters, setPage } = documentsSlice.actions;
export default documentsSlice.reducer;
