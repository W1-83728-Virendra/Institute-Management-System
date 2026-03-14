import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { feesAPI } from '../../services/api';

interface DashboardStats {
  total_students: number;
  total_fee_collected: number;
  total_fee_pending: number;
  total_documents: number;
  pending_documents: number;
  overdue_fees: number;
  payments_today: number;
}

interface FeeOverview {
  course: string;
  total_students: number;
  total_fee: number;
  collected: number;
  pending: number;
  collection_rate: number;
}

interface Fee {
  id: number;
  student: any;
  fee_type: string;
  amount: number;
  due_date: string;
  status: string;
  semester: number;
  academic_year: string;
}

interface FeesState {
  dashboard: DashboardStats | null;
  overview: FeeOverview[];
  fees: Fee[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  loading: boolean;
  error: string | null;
}

const initialState: FeesState = {
  dashboard: null,
  overview: [],
  fees: [],
  total: 0,
  page: 1,
  page_size: 10,
  total_pages: 0,
  loading: false,
  error: null,
};

export const fetchDashboardStats = createAsyncThunk(
  'fees/fetchDashboard',
  async (_, { rejectWithValue }) => {
    try {
      const response = await feesAPI.getDashboard();
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch dashboard');
    }
  }
);

export const fetchFeeOverview = createAsyncThunk(
  'fees/fetchOverview',
  async (_, { rejectWithValue }) => {
    try {
      const response = await feesAPI.getOverviewByCourse();
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch overview');
    }
  }
);

export const fetchFees = createAsyncThunk(
  'fees/fetchAll',
  async (params: { page?: number; status?: string; course?: string } = {}, { rejectWithValue }) => {
    try {
      const response = await feesAPI.getAll(params);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch fees');
    }
  }
);

export const createFee = createAsyncThunk(
  'fees/create',
  async (data: any, { rejectWithValue }) => {
    try {
      const response = await feesAPI.create(data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to create fee');
    }
  }
);

export const payFee = createAsyncThunk(
  'fees/pay',
  async ({ id, data }: { id: number; data: any }, { rejectWithValue }) => {
    try {
      const response = await feesAPI.pay(id, data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Payment failed');
    }
  }
);

const feesSlice = createSlice({
  name: 'fees',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardStats.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.loading = false;
        state.dashboard = action.payload;
      })
      .addCase(fetchDashboardStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchFeeOverview.fulfilled, (state, action) => {
        state.overview = action.payload;
      })
      .addCase(fetchFees.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchFees.fulfilled, (state, action) => {
        state.loading = false;
        state.fees = action.payload.items;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.page_size = action.payload.page_size;
        state.total_pages = action.payload.total_pages;
      })
      .addCase(fetchFees.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createFee.fulfilled, (state, action) => {
        state.fees.unshift(action.payload);
      });
  },
});

export const { clearError } = feesSlice.actions;
export default feesSlice.reducer;
