import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import studentsReducer from './slices/studentsSlice';
import feesReducer from './slices/feesSlice';
import documentsReducer from './slices/documentsSlice';
import notificationsReducer from './slices/notificationsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    students: studentsReducer,
    fees: feesReducer,
    documents: documentsReducer,
    notifications: notificationsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
