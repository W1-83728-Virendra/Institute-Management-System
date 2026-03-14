import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { studentsAPI } from '../../services/api';

interface Student {
  id: number;
  admission_no: string;
  first_name: string;
  last_name: string;
  phone?: string;
  course: string;
  semester: number;
  fee_status?: string;
  document_status?: string;
}

interface StudentsState {
  students: Student[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  loading: boolean;
  error: string | null;
}

const initialState: StudentsState = {
  students: [],
  total: 0,
  page: 1,
  page_size: 10,
  total_pages: 0,
  loading: false,
  error: null,
};

export const fetchStudents = createAsyncThunk(
  'students/fetchAll',
  async (params: { page?: number; page_size?: number; search?: string; course?: string } = {}, { rejectWithValue }) => {
    try {
      const response = await studentsAPI.getAll(params);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch students');
    }
  }
);

export const createStudent = createAsyncThunk(
  'students/create',
  async (data: any, { rejectWithValue }) => {
    try {
      const response = await studentsAPI.create(data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to create student');
    }
  }
);

export const updateStudent = createAsyncThunk(
  'students/update',
  async ({ id, data }: { id: number; data: any }, { rejectWithValue }) => {
    try {
      const response = await studentsAPI.update(id, data);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to update student');
    }
  }
);

export const deleteStudent = createAsyncThunk(
  'students/delete',
  async (id: number, { rejectWithValue }) => {
    try {
      await studentsAPI.delete(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to delete student');
    }
  }
);

const studentsSlice = createSlice({
  name: 'students',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStudents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStudents.fulfilled, (state, action) => {
        state.loading = false;
        state.students = action.payload.items;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.page_size = action.payload.page_size;
        state.total_pages = action.payload.total_pages;
      })
      .addCase(fetchStudents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createStudent.fulfilled, (state, action) => {
        state.students.unshift(action.payload);
      })
      .addCase(updateStudent.fulfilled, (state, action) => {
        const index = state.students.findIndex(s => s.id === action.payload.id);
        if (index !== -1) {
          state.students[index] = action.payload;
        }
      })
      .addCase(deleteStudent.fulfilled, (state, action: PayloadAction<number>) => {
        state.students = state.students.filter(s => s.id !== action.payload);
      });
  },
});

export const { clearError } = studentsSlice.actions;
export default studentsSlice.reducer;
