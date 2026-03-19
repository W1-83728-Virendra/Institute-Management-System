# Notification System Implementation Plan

## Overview
This document outlines the implementation plan for adding a comprehensive notification system to the Institute Management System. The system will support email reminders, SMS alerts (via Twilio), and in-app notifications with scheduling capabilities.

---

## 1. Current State Analysis

### What's Already Implemented:

| Component | Status | Details |
|-----------|--------|---------|
| Email Infrastructure | ✅ Ready | `backend/app/core/email_utils.py` - SMTP-based email with templates |
| Settings UI | ⚠️ Partial | `frontend/src/pages/Settings.tsx` - Notification toggles (not connected to backend) |
| Notification Bell | ⚠️ Stub | `frontend/src/components/Layout.tsx` - Hardcoded badge (not functional) |
| Redis | ✅ Configured | Already in `backend/app/core/config.py` |
| Data Models | ⚠️ Partial | Student has phone field; Fee/Document models exist |

### What's Missing:

1. **Backend:**
   - No notification database models
   - No notification API endpoints
   - No SMS integration (Twilio)
   - No scheduler for automated reminders
   - No in-app notification system
   - Settings not persisted to database

2. **Frontend:**
   - Notification dropdown/panel doesn't work
   - No notification Redux slice
   - No notification API service
   - Settings not connected to backend

---

## 2. Architecture Design

### Database Models (New)

```python
# backend/app/models/models.py - New models to add

class NotificationType(str, Enum):
    FEE_DUE = "fee_due"
    FEE_OVERDUE = "fee_overdue"
    DOCUMENT_PENDING = "document_pending"
    DOCUMENT_VERIFIED = "document_verified"
    DOCUMENT_REJECTED = "document_rejected"
    DOCUMENT_REQUEST = "document_request"
    GENERAL = "general"

class NotificationChannel(str, Enum):
    EMAIL = "email"
    SMS = "sms"
    IN_APP = "in_app"
    ALL = "all"

class Notification(Base):
    """In-app notifications for users"""
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(SQLEnum(NotificationType))
    is_read = Column(Boolean, default=False)
    link = Column(String(500))  # Optional link to related entity
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ScheduledReminder(Base):
    """Scheduled reminder jobs"""
    __tablename__ = "scheduled_reminders"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    notification_type = Column(SQLEnum(NotificationType), nullable=False)
    channel = Column(SQLEnum(NotificationChannel), default=NotificationChannel.ALL)
    schedule_type = Column(String(20))  # daily, weekly, monthly, custom
    schedule_cron = Column(String(100))  # Cron expression for custom
    filters = Column(JSON)  # {"status": "PENDING", "days_before_due": 3}
    is_active = Column(Boolean, default=True)
    last_run = Column(DateTime(timezone=True))
    next_run = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class UserNotificationPreferences(Base):
    """User preferences for notifications"""
    __tablename__ = "user_notification_preferences"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    email_enabled = Column(Boolean, default=True)
    sms_enabled = Column(Boolean, default=False)
    in_app_enabled = Column(Boolean, default=True)
    fee_reminders = Column(Boolean, default=True)
    document_alerts = Column(Boolean, default=True)
    reminder_days_before = Column(Integer, default=3)  # Days before due date
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

### API Endpoints (New)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get user's notifications |
| PUT | `/api/notifications/{id}/read` | Mark notification as read |
| PUT | `/api/notifications/read-all` | Mark all as read |
| GET | `/api/notifications/unread-count` | Get unread count |
| GET | `/api/reminders` | Get scheduled reminders |
| POST | `/api/reminders` | Create scheduled reminder |
| PUT | `/api/reminders/{id}` | Update reminder |
| DELETE | `/api/reminders/{id}` | Delete reminder |
| POST | `/api/reminders/{id}/run` | Manually trigger reminder |
| GET | `/api/settings/notifications` | Get notification preferences |
| PUT | `/api/settings/notifications` | Update notification preferences |
| POST | `/api/notifications/send-test` | Send test notification (admin) |

### New Dependencies

```txt
# backend/requirements.txt - Add
twilio>=8.10.0
APScheduler>=3.10.0  # For scheduling
```

---

## 3. Implementation Phases

### Phase 1: Backend Foundation (Priority: HIGH)
- [ ] Add notification models to `models.py`
- [ ] Create notification schemas in `schemas.py`
- [ ] Create notification router with CRUD endpoints
- [ ] Implement email notification service enhancements
- [ ] Add Twilio SMS service module

### Phase 2: Scheduler System (Priority: HIGH)
- [ ] Implement APScheduler integration
- [ ] Create reminder job for pending fees (daily check)
- [ ] Create reminder job for pending documents (daily check)
- [ ] Add manual trigger functionality

### Phase 3: Frontend - Notifications (Priority: HIGH)
- [ ] Create notification Redux slice
- [ ] Create notification API service
- [ ] Implement notification dropdown panel in Layout
- [ ] Add real-time notification badge updates

### Phase 4: Frontend - Settings Integration (Priority: MEDIUM)
- [ ] Connect Settings page to backend API
- [ ] Add more notification preference options
- [ ] Add per-notification-type toggles

---

## 4. Detailed Implementation Steps

### Step 4.1: Add New Dependencies
```bash
pip install twilio APScheduler
```

### Step 4.2: Create SMS Service
```python
# backend/app/core/sms_utils.py
from twilio.rest import Client
import os

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")

def send_sms(to_number: str, message: str) -> bool:
    """Send SMS via Twilio"""
    if not TWILIO_ACCOUNT_SID:
        print(f"[SMS Mock] To: {to_number}, Message: {message}")
        return True
    # ... Twilio implementation
```

### Step 4.3: Create Notification Router
```python
# backend/app/routers/notifications.py
@router.get("", response_model=List[NotificationResponse])
async def get_notifications(
    skip: int = 0,
    limit: int = 20,
    unread_only: bool = False,
    current_user: User = Depends(get_current_user)
):
    # Query notifications for current user

@router.post("/send-test")
async def send_test_notification(
    channel: NotificationChannel,
    current_user: User = Depends(get_admin_user)
):
    # Send test email/SMS
```

### Step 4.4: Scheduler Setup
```python
# backend/app/core/scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

scheduler = AsyncIOScheduler()

def check_pending_fees():
    """Daily job to check and notify about pending fees"""
    # Query fees due in next N days
    # Send notifications based on user preferences

def check_pending_documents():
    """Daily job to check and notify about pending documents"""
    # Query document requests with upcoming due dates
    # Send notifications

# Register jobs
scheduler.add_job(check_pending_fees, 'cron', hour=9, minute=0)  # 9 AM daily
scheduler.add_job(check_pending_documents, 'cron', hour=10, minute=0)  # 10 AM daily
```

### Step 4.5: Frontend Notification Panel
```typescript
// frontend/src/components/NotificationPanel.tsx
// - Dropdown panel showing recent notifications
// - Mark as read functionality
// - Link to detailed view
// - Real-time updates via polling or WebSocket
```

---

## 5. Email Templates (Enhancements Needed)

Add these templates to `backend/app/core/email_utils.py`:

1. **Fee Due Reminder** - Days before due date
2. **Fee Overdue Alert** - After due date passes
3. **Document Submission Reminder** - Days before due date
4. **Welcome/Account Created** - New user notification

---

## 6. Configuration Variables

```env
# Backend Environment Variables

# Twilio (SMS)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Email (already exists)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
FROM_EMAIL=noreply@institute.edu

# Scheduler
SCHEDULER_ENABLED=true
REMINDER_CHECK_TIME=09:00  # Daily check time
```

---

## 7. Testing Plan

| Feature | Test Cases |
|---------|-----------|
| Email | Send test email, verify delivery, check templates |
| SMS | Send test SMS (Twilio sandbox), verify delivery |
| In-App | Create notification, verify display, mark as read |
| Scheduler | Verify daily jobs run, check edge cases |
| Settings | Save preferences, verify persistence |

---

## 8. Estimated Timeline

| Phase | Effort | Description |
|-------|--------|-------------|
| Phase 1 | 2-3 days | Backend foundation, models, API |
| Phase 2 | 2 days | Scheduler, reminder jobs |
| Phase 3 | 2-3 days | Frontend notification panel |
| Phase 4 | 1-2 days | Settings integration |
| **Total** | **7-10 days** | Full implementation |

---

## 9. Files to Modify/Create

### Backend (New Files)
- `backend/app/core/sms_utils.py` - Twilio SMS service
- `backend/app/core/scheduler.py` - APScheduler setup
- `backend/app/routers/notifications.py` - Notification API

### Backend (Modify)
- `backend/app/models/models.py` - Add Notification, ScheduledReminder, UserNotificationPreferences models
- `backend/app/schemas/schemas.py` - Add notification schemas
- `backend/app/main.py` - Register scheduler
- `backend/requirements.txt` - Add dependencies
- `backend/app/core/email_utils.py` - Add new email templates

### Frontend (New Files)
- `frontend/src/store/slices/notificationsSlice.ts` - Notification state management
- `frontend/src/services/notificationsApi.ts` - Notification API calls
- `frontend/src/components/NotificationPanel.tsx` - Notification dropdown

### Frontend (Modify)
- `frontend/src/components/Layout.tsx` - Connect notification panel
- `frontend/src/pages/Settings.tsx` - Connect to backend
- `frontend/src/services/api.ts` - Add notification endpoints

---

## 10. Backward Compatibility

- All existing email templates remain functional
- Settings page toggles will work after connecting to backend
- Existing Fee and Document functionality unchanged
- Notification bell will become functional but maintain existing look
