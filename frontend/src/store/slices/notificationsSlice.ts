import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { notificationsAPI } from '../../services/api';

// Types
export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  link?: string;
  related_id?: number;
  related_type?: string;
  created_at: string;
}

export interface NotificationPreferences {
  id: number;
  user_id: number;
  in_app_enabled: boolean;
  fee_notifications: boolean;
  document_notifications: boolean;
  updated_at?: string;
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  total: number;
  loading: boolean;
  error: string | null;
  preferences: NotificationPreferences | null;
}

const initialState: NotificationsState = {
  notifications: [],
  unreadCount: 0,
  total: 0,
  loading: false,
  error: null,
  preferences: null,
};

// Async Thunks
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchAll',
  async (params: { page?: number; page_size?: number; unread_only?: boolean } = {}, { rejectWithValue }) => {
    try {
      const response = await notificationsAPI.getAll(params);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch notifications');
    }
  }
);

export const fetchUnreadCount = createAsyncThunk(
  'notifications/fetchUnreadCount',
  async (_, { rejectWithValue }) => {
    try {
      const response = await notificationsAPI.getUnreadCount();
      return response.data.unread_count;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch unread count');
    }
  }
);

export const markAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationId: number, { rejectWithValue }) => {
    try {
      await notificationsAPI.markAsRead(notificationId);
      return notificationId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to mark as read');
    }
  }
);

export const markAllAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (_, { rejectWithValue }) => {
    try {
      await notificationsAPI.markAllAsRead();
      return true;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to mark all as read');
    }
  }
);

export const fetchPreferences = createAsyncThunk(
  'notifications/fetchPreferences',
  async (_, { rejectWithValue }) => {
    try {
      const response = await notificationsAPI.getPreferences();
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to fetch preferences');
    }
  }
);

export const updatePreferences = createAsyncThunk(
  'notifications/updatePreferences',
  async (preferences: Partial<NotificationPreferences>, { rejectWithValue }) => {
    try {
      const response = await notificationsAPI.updatePreferences(preferences);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || 'Failed to update preferences');
    }
  }
);

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    incrementUnread: (state) => {
      state.unreadCount += 1;
    },
    decrementUnread: (state) => {
      if (state.unreadCount > 0) {
        state.unreadCount -= 1;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Notifications
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload.items;
        state.unreadCount = action.payload.unread_count;
        state.total = action.payload.total;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Fetch Unread Count
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      })
      
      // Mark as Read
      .addCase(markAsRead.fulfilled, (state, action) => {
        const notification = state.notifications.find(n => n.id === action.payload);
        if (notification && !notification.is_read) {
          notification.is_read = true;
          if (state.unreadCount > 0) {
            state.unreadCount -= 1;
          }
        }
      })
      
      // Mark All as Read
      .addCase(markAllAsRead.fulfilled, (state) => {
        state.notifications.forEach(n => n.is_read = true);
        state.unreadCount = 0;
      })
      
      // Fetch Preferences
      .addCase(fetchPreferences.fulfilled, (state, action) => {
        state.preferences = action.payload;
      })
      
      // Update Preferences
      .addCase(updatePreferences.fulfilled, (state, action) => {
        state.preferences = action.payload;
      });
  },
});

export const { clearError, incrementUnread, decrementUnread } = notificationsSlice.actions;
export default notificationsSlice.reducer;
