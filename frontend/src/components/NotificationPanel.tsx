import React, { useEffect, useState } from 'react';
import {
  Box,
  IconButton,
  Badge,
  Popover,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Divider,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Warning as WarningIcon,
  Description as DocumentIcon,
  Payment as PaymentIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead,
  markAllAsRead,
  type Notification
} from '../store/slices/notificationsSlice';
import { useNavigate } from 'react-router-dom';

interface NotificationPanelProps {
  anchorEl?: HTMLElement | null;
  open: boolean;
  onClose: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ anchorEl, open, onClose }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, total } = useAppSelector(
    (state: any) => state.notifications
  );

  useEffect(() => {
    if (open) {
      dispatch(fetchNotifications({ page: 1, page_size: 10 }));
    }
  }, [open, dispatch]);

  useEffect(() => {
    dispatch(fetchUnreadCount());
  }, [dispatch]);

  // Poll for new notifications every 30 seconds when panel is open
  useEffect(() => {
    if (!open) return;
    
    const interval = setInterval(() => {
      dispatch(fetchUnreadCount());
    }, 30000);
    return () => clearInterval(interval);
  }, [open, dispatch]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'fee_due':
      case 'fee_overdue':
      case 'fee_reminder':
        return <PaymentIcon color="warning" />;
      case 'document_pending':
      case 'document_request':
        return <DocumentIcon color="info" />;
      case 'document_verified':
        return <CheckCircleIcon color="success" />;
      case 'document_rejected':
        return <WarningIcon color="error" />;
      default:
        return <InfoIcon color="primary" />;
    }
  };

  const getNotificationColor = (type: string): 'default' | 'warning' | 'info' | 'success' | 'error' => {
    switch (type) {
      case 'fee_due':
      case 'fee_overdue':
      case 'fee_reminder':
        return 'warning';
      case 'document_pending':
      case 'document_request':
        return 'info';
      case 'document_verified':
        return 'success';
      case 'document_rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already
    if (!notification.is_read) {
      await dispatch(markAsRead(notification.id));
    }

    // Navigate if link exists
    if (notification.link) {
      navigate(notification.link);
    }

    onClose();
  };

  const handleMarkAllRead = async () => {
    await dispatch(markAllAsRead());
  };

  return (
    <Popover
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      PaperProps={{
        sx: {
          width: 380,
          maxHeight: 500,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Notifications
          {unreadCount > 0 && (
            <Chip
              label={unreadCount}
              color="error"
              size="small"
              sx={{ ml: 1, height: 20 }}
            />
          )}
        </Typography>
        {unreadCount > 0 && (
          <Button size="small" onClick={handleMarkAllRead}>
            Mark all read
          </Button>
        )}
      </Box>

      {/* Notification List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : notifications.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">No notifications</Typography>
        </Box>
      ) : (
        <List sx={{ p: 0, maxHeight: 380, overflow: 'auto' }}>
          {notifications.map((notification: Notification, index: number) => (
            <React.Fragment key={notification.id}>
              <ListItem
                alignItems="flex-start"
                onClick={() => handleNotificationClick(notification)}
                sx={{
                  cursor: 'pointer',
                  backgroundColor: notification.is_read ? 'transparent' : 'action.hover',
                  '&:hover': {
                    backgroundColor: 'action.selected',
                  },
                  py: 1.5,
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>
                  {getNotificationIcon(notification.notification_type)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: notification.is_read ? 400 : 600,
                        }}
                      >
                        {notification.title}
                      </Typography>
                      {!notification.is_read && (
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                          }}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          mb: 0.5,
                        }}
                      >
                        {notification.message}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {formatTimeAgo(notification.created_at)}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
              {index < notifications.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      )}

      {/* Footer */}
      {total > 10 && (
        <Box
          sx={{
            p: 1,
            borderTop: '1px solid',
            borderColor: 'divider',
            textAlign: 'center',
          }}
        >
          <Button
            size="small"
            onClick={() => {
              navigate('/notifications');
              onClose();
            }}
          >
            View All {total} Notifications
          </Button>
        </Box>
      )}
    </Popover>
  );
};

export default NotificationPanel;
