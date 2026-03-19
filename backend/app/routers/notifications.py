"""
Notification API Router
Handles in-app notifications, scheduled reminders, and notification settings
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, timedelta
import logging

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.scheduler import reschedule_jobs_from_db, schedule_reminder_job, remove_reminder_job
from app.models.models import (
    User, Student, Fee, Document, DocumentRequest,
    Notification, NotificationSettings, ScheduledReminder,
    UserNotificationPreferences, NotificationType, UserRole
)
from app.schemas.schemas import (
    NotificationResponse,
    NotificationCreate,
    NotificationUpdate,
    NotificationListResponse,
    ScheduledReminderCreate,
    ScheduledReminderUpdate,
    ScheduledReminderResponse,
    NotificationSettingsResponse,
    NotificationSettingsUpdate,
    UserNotificationPreferencesResponse,
    UserNotificationPreferencesUpdate
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ==================== Notification CRUD ====================

@router.get("", response_model=NotificationListResponse)
async def get_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get notifications for the current user"""
    # Build query
    query = select(Notification).where(Notification.user_id == current_user.id)
    count_query = select(func.count(Notification.id)).where(Notification.user_id == current_user.id)
    
    # Filter unread only
    if unread_only:
        query = query.where(Notification.is_read == False)
        count_query = count_query.where(Notification.is_read == False)
    
    # Get unread count
    unread_result = await db.execute(
        select(func.count(Notification.id)).where(
            and_(
                Notification.user_id == current_user.id,
                Notification.is_read == False
            )
        )
    )
    unread_count = unread_result.scalar() or 0
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply pagination and ordering
    offset = (page - 1) * page_size
    query = query.order_by(Notification.created_at.desc()).offset(offset).limit(page_size)
    
    # Execute
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    return {
        "total": total,
        "unread_count": unread_count,
        "items": notifications
    }


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get count of unread notifications"""
    result = await db.execute(
        select(func.count(Notification.id)).where(
            and_(
                Notification.user_id == current_user.id,
                Notification.is_read == False
            )
        )
    )
    count = result.scalar() or 0
    return {"unread_count": count}


@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a notification as read"""
    result = await db.execute(
        select(Notification).where(
            and_(
                Notification.id == notification_id,
                Notification.user_id == current_user.id
            )
        )
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    notification.is_read = True
    await db.commit()
    
    return {"message": "Notification marked as read"}


@router.put("/read-all")
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark all notifications as read"""
    result = await db.execute(
        select(Notification).where(
            and_(
                Notification.user_id == current_user.id,
                Notification.is_read == False
            )
        )
    )
    notifications = result.scalars().all()
    
    for notification in notifications:
        notification.is_read = True
    
    await db.commit()
    
    return {"message": f"Marked {len(notifications)} notifications as read"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a notification"""
    result = await db.execute(
        select(Notification).where(
            and_(
                Notification.id == notification_id,
                Notification.user_id == current_user.id
            )
        )
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    await db.delete(notification)
    await db.commit()
    
    return {"message": "Notification deleted"}


# ==================== Create Notifications (Internal/Admin) ====================

@router.post("", response_model=NotificationResponse)
async def create_notification(
    notification: NotificationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new notification (for internal use)"""
    db_notification = Notification(
        user_id=notification.user_id,
        title=notification.title,
        message=notification.message,
        notification_type=notification.notification_type,
        link=notification.link,
        related_id=notification.related_id,
        related_type=notification.related_type
    )
    
    db.add(db_notification)
    await db.commit()
    await db.refresh(db_notification)
    
    return db_notification


# ==================== Scheduled Reminders ====================

@router.get("/reminders", response_model=List[ScheduledReminderResponse])
async def get_scheduled_reminders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all scheduled reminders (admin only)"""
    # Check if admin
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manage scheduled reminders"
        )
    
    result = await db.execute(
        select(ScheduledReminder).order_by(ScheduledReminder.created_at.desc())
    )
    reminders = result.scalars().all()
    
    return reminders


@router.post("/reminders", response_model=ScheduledReminderResponse)
async def create_scheduled_reminder(
    reminder: ScheduledReminderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new scheduled reminder (admin only)"""
    # Check if admin
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create scheduled reminders"
        )
    
    db_reminder = ScheduledReminder(
        name=reminder.name,
        notification_type=reminder.notification_type,
        frequency=reminder.frequency,
        day_of_week=reminder.day_of_week,
        hour=reminder.hour,
        minute=reminder.minute,
        days_before=reminder.days_before,
        is_active=reminder.is_active
    )
    
    db.add(db_reminder)
    await db.commit()
    await db.refresh(db_reminder)
    
    # Schedule the job in APScheduler
    if db_reminder.is_active:
        schedule_reminder_job(
            db_reminder.id,
            db_reminder.notification_type.value,
            db_reminder.frequency.value,
            db_reminder.hour,
            db_reminder.minute,
            db_reminder.days_before
        )
    
    return db_reminder


@router.put("/reminders/{reminder_id}", response_model=ScheduledReminderResponse)
async def update_scheduled_reminder(
    reminder_id: int,
    reminder_update: ScheduledReminderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a scheduled reminder (admin only)"""
    # Check if admin
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update scheduled reminders"
        )
    
    result = await db.execute(
        select(ScheduledReminder).where(ScheduledReminder.id == reminder_id)
    )
    reminder = result.scalar_one_or_none()
    
    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheduled reminder not found"
        )
    
    # Update fields
    update_data = reminder_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(reminder, field, value)
    
    await db.commit()
    await db.refresh(reminder)
    
    # Reschedule the job in APScheduler
    if reminder.is_active:
        schedule_reminder_job(
            reminder.id,
            reminder.notification_type.value,
            reminder.frequency.value,
            reminder.hour,
            reminder.minute,
            reminder.days_before
        )
    else:
        remove_reminder_job(reminder.id)
    
    return reminder


@router.delete("/reminders/{reminder_id}")
async def delete_scheduled_reminder(
    reminder_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a scheduled reminder (admin only)"""
    # Check if admin
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete scheduled reminders"
        )
    
    result = await db.execute(
        select(ScheduledReminder).where(ScheduledReminder.id == reminder_id)
    )
    reminder = result.scalar_one_or_none()
    
    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheduled reminder not found"
        )
    
    await db.delete(reminder)
    await db.commit()
    
    # Remove the job from APScheduler
    remove_reminder_job(reminder_id)
    
    return {"message": "Scheduled reminder deleted"}


@router.post("/reminders/{reminder_id}/run")
async def trigger_reminder(
    reminder_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually trigger a scheduled reminder (admin only)"""
    # Check if admin
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can trigger reminders"
        )
    
    result = await db.execute(
        select(ScheduledReminder).where(ScheduledReminder.id == reminder_id)
    )
    reminder = result.scalar_one_or_none()
    
    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheduled reminder not found"
        )
    
    # Execute the reminder logic
    created_count = await _execute_reminder(db, reminder)
    
    # Update last run time
    reminder.last_run = datetime.utcnow()
    await db.commit()
    
    return {"message": f"Reminder executed, created {created_count} notifications"}


async def _execute_reminder(db: AsyncSession, reminder: ScheduledReminder) -> int:
    """Execute a reminder and create notifications"""
    created_count = 0
    
    if reminder.notification_type == NotificationType.FEE_REMINDER:
        # Find pending fees due within the specified days
        target_date = datetime.utcnow() + timedelta(days=reminder.days_before)
        
        result = await db.execute(
            select(Fee).where(
                and_(
                    Fee.status == "pending",
                    Fee.due_date <= target_date,
                    Fee.due_date >= datetime.utcnow()
                )
            )
        )
        fees = result.scalars().all()
        
        for fee in fees:
            # Get student
            student_result = await db.execute(
                select(Student).where(Student.id == fee.student_id)
            )
            student = student_result.scalar_one_or_none()
            
            if student and student.user_id:
                # Check if notification already exists
                check_result = await db.execute(
                    select(Notification).where(
                        and_(
                            Notification.user_id == student.user_id,
                            Notification.related_id == fee.id,
                            Notification.related_type == "fee",
                            Notification.notification_type == NotificationType.FEE_REMINDER,
                            Notification.created_at >= datetime.utcnow() - timedelta(days=1)
                        )
                    )
                )
                existing = check_result.scalar_one_or_none()
                
                if not existing:
                    # Create notification
                    days_until_due = (fee.due_date - datetime.utcnow()).days
                    notification = Notification(
                        user_id=student.user_id,
                        title=f"Fee Payment Reminder",
                        message=f"Your {fee.fee_type} of ₹{fee.amount:,.2f} is due in {days_until_due} days",
                        notification_type=NotificationType.FEE_REMINDER,
                        link=f"/student/fees/{fee.id}",
                        related_id=fee.id,
                        related_type="fee"
                    )
                    db.add(notification)
                    created_count += 1
        
        await db.commit()
    
    elif reminder.notification_type == NotificationType.DOCUMENT_REQUEST:
        # Find pending document requests
        result = await db.execute(
            select(DocumentRequest).where(
                and_(
                    DocumentRequest.status == "pending",
                    DocumentRequest.due_date >= datetime.utcnow()
                )
            )
        )
        requests = result.scalars().all()
        
        for doc_request in requests:
            student_result = await db.execute(
                select(Student).where(Student.id == doc_request.student_id)
            )
            student = student_result.scalar_one_or_none()
            
            if student and student.user_id:
                # Create notification
                notification = Notification(
                    user_id=student.user_id,
                    title=f"Document Request: {doc_request.document_type}",
                    message=f"Please submit your {doc_request.document_type} document",
                    notification_type=NotificationType.DOCUMENT_REQUEST,
                    link=f"/student/documents",
                    related_id=doc_request.id,
                    related_type="document_request"
                )
                db.add(notification)
                created_count += 1
        
        await db.commit()
    
    return created_count


# ==================== Notification Settings ====================

@router.get("/settings", response_model=NotificationSettingsResponse)
async def get_notification_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get global notification settings (admin only)"""
    # Check if admin
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view notification settings"
        )
    
    result = await db.execute(select(NotificationSettings))
    settings = result.scalar_one_or_none()
    
    # Create default settings if not exists
    if not settings:
        settings = NotificationSettings()
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    
    return settings


@router.put("/settings", response_model=NotificationSettingsResponse)
async def update_notification_settings(
    settings_update: NotificationSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update global notification settings (admin only)"""
    # Check if admin
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update notification settings"
        )
    
    result = await db.execute(select(NotificationSettings))
    settings = result.scalar_one_or_none()
    
    # Create default settings if not exists
    if not settings:
        settings = NotificationSettings()
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    
    # Update fields
    update_data = settings_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)
    
    await db.commit()
    await db.refresh(settings)
    
    # Reschedule jobs based on new settings (run in thread pool to avoid blocking)
    import asyncio
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, reschedule_jobs_from_db)
    
    return settings


# ==================== User Preferences ====================

@router.get("/preferences", response_model=UserNotificationPreferencesResponse)
async def get_user_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's notification preferences"""
    result = await db.execute(
        select(UserNotificationPreferences).where(
            UserNotificationPreferences.user_id == current_user.id
        )
    )
    preferences = result.scalar_one_or_none()
    
    # Create default preferences if not exists
    if not preferences:
        preferences = UserNotificationPreferences(
            user_id=current_user.id,
            in_app_enabled=True,
            fee_notifications=True,
            document_notifications=True
        )
        db.add(preferences)
        await db.commit()
        await db.refresh(preferences)
    
    return preferences


@router.put("/preferences", response_model=UserNotificationPreferencesResponse)
async def update_user_preferences(
    preferences_update: UserNotificationPreferencesUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update current user's notification preferences"""
    result = await db.execute(
        select(UserNotificationPreferences).where(
            UserNotificationPreferences.user_id == current_user.id
        )
    )
    preferences = result.scalar_one_or_none()
    
    # Create default preferences if not exists
    if not preferences:
        preferences = UserNotificationPreferences(
            user_id=current_user.id,
            in_app_enabled=True,
            fee_notifications=True,
            document_notifications=True
        )
        db.add(preferences)
        await db.commit()
        await db.refresh(preferences)
    
    # Update fields
    update_data = preferences_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(preferences, field, value)
    
    await db.commit()
    await db.refresh(preferences)
    
    return preferences
