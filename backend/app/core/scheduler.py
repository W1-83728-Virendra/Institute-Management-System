"""
Notification Scheduler Module
Handles automated scheduled reminders for fees and documents
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    ScheduledReminder, NotificationSettings, Notification,
    Fee, Student, DocumentRequest, NotificationType, ReminderFrequency
)

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler: Optional[AsyncIOScheduler] = None


def init_scheduler() -> AsyncIOScheduler:
    """Initialize and return the scheduler"""
    global scheduler
    if scheduler is None:
        scheduler = AsyncIOScheduler()
    return scheduler


async def check_pending_fees_reminder(db: AsyncSession, days_before: int = 3):
    """
    Check for pending fees that are due soon and create notifications
    This is the main job that runs on schedule
    """
    logger.info("Running pending fees reminder check...")
    
    target_date = datetime.utcnow() + timedelta(days=days_before)
    
    # Get pending fees due within the target date range
    result = await db.execute(
        select(Fee).where(
            and_(
                Fee.status == "pending",
                Fee.due_date <= target_date,
                Fee.due_date >= datetime.utcnow() - timedelta(days=1)  # Only fees due in last 24h to today
            )
        )
    )
    fees = result.scalars().all()
    
    created_count = 0
    for fee in fees:
        # Get student
        student_result = await db.execute(
            select(Student).where(Student.id == fee.student_id)
        )
        student = student_result.scalar_one_or_none()
        
        if not student or not student.user_id:
            continue
        
        # Check if notification already exists for this fee today
        check_result = await db.execute(
            select(Notification).where(
                and_(
                    Notification.user_id == student.user_id,
                    Notification.related_id == fee.id,
                    Notification.related_type == "fee",
                    Notification.notification_type == NotificationType.FEE_REMINDER,
                    Notification.created_at >= datetime.utcnow() - timedelta(hours=12)
                )
            )
        )
        existing = check_result.scalar_one_or_none()
        
        if existing:
            continue
        
        # Calculate days until due
        days_until_due = (fee.due_date - datetime.utcnow()).days
        
        if days_until_due < 0:
            notification_type = NotificationType.FEE_OVERDUE
            title = "Fee Payment Overdue"
            message = f"Your {fee.fee_type} of ₹{fee.amount:,.2f} is overdue by {abs(days_until_due)} days"
        elif days_until_due == 0:
            notification_type = NotificationType.FEE_DUE
            title = "Fee Payment Due Today"
            message = f"Your {fee.fee_type} of ₹{fee.amount:,.2f} is due today"
        else:
            notification_type = NotificationType.FEE_REMINDER
            title = "Fee Payment Reminder"
            message = f"Your {fee.fee_type} of ₹{fee.amount:,.2f} is due in {days_until_due} days"
        
        # Create notification
        notification = Notification(
            user_id=student.user_id,
            title=title,
            message=message,
            notification_type=notification_type,
            link=f"/student/fees/{fee.id}",
            related_id=fee.id,
            related_type="fee"
        )
        db.add(notification)
        created_count += 1
    
    if created_count > 0:
        await db.commit()
        logger.info(f"Created {created_count} fee reminder notifications")
    
    return created_count


async def check_document_requests_reminder(db: AsyncSession):
    """
    Check for pending document requests and create notifications
    """
    logger.info("Running document requests reminder check...")
    
    # Get pending document requests due within 7 days
    result = await db.execute(
        select(DocumentRequest).where(
            and_(
                DocumentRequest.status == "pending",
                DocumentRequest.due_date <= datetime.utcnow() + timedelta(days=7),
                DocumentRequest.due_date >= datetime.utcnow()
            )
        )
    )
    requests = result.scalars().all()
    
    created_count = 0
    for doc_request in requests:
        student_result = await db.execute(
            select(Student).where(Student.id == doc_request.student_id)
        )
        student = student_result.scalar_one_or_none()
        
        if not student or not student.user_id:
            continue
        
        # Check if notification already exists
        check_result = await db.execute(
            select(Notification).where(
                and_(
                    Notification.user_id == student.user_id,
                    Notification.related_id == doc_request.id,
                    Notification.related_type == "document_request",
                    Notification.created_at >= datetime.utcnow() - timedelta(days=1)
                )
            )
        )
        existing = check_result.scalar_one_or_none()
        
        if existing:
            continue
        
        # Calculate days until due
        days_until_due = (doc_request.due_date - datetime.utcnow()).days if doc_request.due_date else 0
        
        # Create notification
        notification = Notification(
            user_id=student.user_id,
            title=f"Document Request: {doc_request.document_type}",
            message=f"Please submit your {doc_request.document_type} document" + 
                   (f" by {doc_request.due_date.strftime('%Y-%m-%d')}" if doc_request.due_date else "") +
                   (f" ({days_until_due} days remaining)" if days_until_due > 0 else ""),
            notification_type=NotificationType.DOCUMENT_REQUEST,
            link=f"/student/documents",
            related_id=doc_request.id,
            related_type="document_request"
        )
        db.add(notification)
        created_count += 1
    
    if created_count > 0:
        await db.commit()
        logger.info(f"Created {created_count} document reminder notifications")
    
    return created_count


async def setup_default_jobs(scheduler: AsyncIOScheduler, db: AsyncSession):
    """
    Set up default scheduled jobs based on notification settings
    """
    # Get notification settings
    result = await db.execute(select(NotificationSettings))
    settings = result.scalar_one_or_none()
    
    # Default values
    fee_enabled = settings.fee_reminders_enabled if settings else True
    fee_days = settings.fee_reminder_days_before if settings else 3
    fee_time = settings.fee_reminder_time if settings else "09:00"
    fee_freq = settings.fee_reminder_frequency if settings else ReminderFrequency.DAILY
    
    doc_enabled = settings.document_reminders_enabled if settings else True
    doc_time = settings.document_reminder_time if settings else "10:00"
    doc_day = settings.document_reminder_day if settings else 0
    doc_freq = settings.document_reminder_frequency if settings else ReminderFrequency.WEEKLY
    
    # Parse time
    fee_hour, fee_minute = map(int, fee_time.split(":")) if fee_time else (9, 0)
    doc_hour, doc_minute = map(int, doc_time.split(":")) if doc_time else (10, 0)
    
    # Add fee reminder job
    if fee_enabled:
        if fee_freq == ReminderFrequency.DAILY:
            scheduler.add_job(
                check_pending_fees_reminder,
                CronTrigger(hour=fee_hour, minute=fee_minute),
                args=[db, fee_days],
                id="fee_reminder_daily",
                name="Daily Fee Reminder",
                replace_existing=True
            )
        elif fee_freq == ReminderFrequency.WEEKLY:
            scheduler.add_job(
                check_pending_fees_reminder,
                CronTrigger(day_of_week=doc_day, hour=fee_hour, minute=fee_minute),
                args=[db, fee_days],
                id="fee_reminder_weekly",
                name="Weekly Fee Reminder",
                replace_existing=True
            )
    
    # Add document reminder job
    if doc_enabled:
        if doc_freq == ReminderFrequency.DAILY:
            scheduler.add_job(
                check_document_requests_reminder,
                CronTrigger(hour=doc_hour, minute=doc_minute),
                args=[db],
                id="document_reminder_daily",
                name="Daily Document Reminder",
                replace_existing=True
            )
        elif doc_freq == ReminderFrequency.WEEKLY:
            scheduler.add_job(
                check_document_requests_reminder,
                CronTrigger(day_of_week=doc_day, hour=doc_hour, minute=doc_minute),
                args=[db],
                id="document_reminder_weekly",
                name="Weekly Document Reminder",
                replace_existing=True
            )
    
    logger.info("Default scheduled jobs configured")


def start_scheduler(db_session_factory):
    """
    Start the scheduler with the given database session factory
    This should be called during app startup
    """
    global scheduler
    scheduler = init_scheduler()
    
    # Import here to avoid circular imports
    from app.core.database import AsyncSessionLocal
    from app.models.models import ReminderFrequency
    
    async def run_fee_reminder_job():
        """Async job wrapper for fee reminders"""
        async with AsyncSessionLocal() as session:
            await check_pending_fees_reminder(session, 3)
    
    async def run_document_reminder_job():
        """Async job wrapper for document reminders"""
        async with AsyncSessionLocal() as session:
            await check_document_requests_reminder(session)
    
    async def setup_jobs_from_settings():
        """Load settings from DB and schedule jobs accordingly"""
        async with AsyncSessionLocal() as session:
            # Get notification settings
            result = await session.execute(select(NotificationSettings))
            settings = result.scalar_one_or_none()
            
            # Fee reminder settings
            fee_enabled = settings.fee_reminders_enabled if settings else True
            fee_days = settings.fee_reminder_days_before if settings else 3
            fee_time = settings.fee_reminder_time if settings else "09:00"
            fee_freq = settings.fee_reminder_frequency if settings else ReminderFrequency.DAILY
            
            # Document reminder settings
            doc_enabled = settings.document_reminders_enabled if settings else True
            doc_time = settings.document_reminder_time if settings else "10:00"
            doc_freq = settings.document_reminder_frequency if settings else ReminderFrequency.WEEKLY
            
            # Parse times
            fee_hour, fee_minute = map(int, fee_time.split(":")) if fee_time else (9, 0)
            doc_hour, doc_minute = map(int, doc_time.split(":")) if doc_time else (10, 0)
            
            # Remove any existing jobs first
            for job_id in ["fee_reminder_daily", "fee_reminder_weekly", 
                           "document_reminder_daily", "document_reminder_weekly",
                           "fee_reminder_default", "document_reminder_default"]:
                try:
                    scheduler.remove_job(job_id)
                except Exception:
                    pass
            
            # Schedule fee reminder
            if fee_enabled:
                if fee_freq == ReminderFrequency.DAILY:
                    scheduler.add_job(
                        run_fee_reminder_job,
                        CronTrigger(hour=fee_hour, minute=fee_minute),
                        id="fee_reminder_daily",
                        name="Daily Fee Reminder",
                        replace_existing=True
                    )
                    logger.info(f"Scheduled daily fee reminder at {fee_hour}:{fee_minute:02d}")
                elif fee_freq == ReminderFrequency.WEEKLY:
                    scheduler.add_job(
                        run_fee_reminder_job,
                        CronTrigger(day_of_week=0, hour=fee_hour, minute=fee_minute),
                        id="fee_reminder_weekly",
                        name="Weekly Fee Reminder",
                        replace_existing=True
                    )
                    logger.info(f"Scheduled weekly fee reminder at {fee_hour}:{fee_minute:02d}")
            
            # Schedule document reminder
            if doc_enabled:
                if doc_freq == ReminderFrequency.DAILY:
                    scheduler.add_job(
                        run_document_reminder_job,
                        CronTrigger(hour=doc_hour, minute=doc_minute),
                        id="document_reminder_daily",
                        name="Daily Document Reminder",
                        replace_existing=True
                    )
                    logger.info(f"Scheduled daily document reminder at {doc_hour}:{doc_minute:02d}")
                elif doc_freq == ReminderFrequency.WEEKLY:
                    scheduler.add_job(
                        run_document_reminder_job,
                        CronTrigger(day_of_week=0, hour=doc_hour, minute=doc_minute),
                        id="document_reminder_weekly",
                        name="Weekly Document Reminder",
                        replace_existing=True
                    )
                    logger.info(f"Scheduled weekly document reminder at {doc_hour}:{doc_minute:02d}")
    
    # Run the async setup function using asyncio.run (for first-time setup)
    # This runs once at startup
    try:
        import asyncio
        asyncio.run(setup_jobs_from_settings())
    except Exception as e:
        logger.warning(f"Could not load settings from DB during startup: {e}. Using defaults.")
        # Fallback: add default jobs
        scheduler.add_job(
            run_fee_reminder_job,
            CronTrigger(hour=9, minute=0),
            id="fee_reminder_default",
            name="Daily Fee Reminder (Default)",
            replace_existing=True
        )
    
    scheduler.start()
    logger.info("Notification scheduler started")
    
    return scheduler


def stop_scheduler():
    """Stop the scheduler"""
    global scheduler
    if scheduler:
        scheduler.shutdown()
        scheduler = None
        logger.info("Notification scheduler stopped")


def reschedule_jobs_from_db():
    """
    Reschedule jobs based on current settings in database.
    Called when settings are updated via API.
    """
    global scheduler
    if not scheduler:
        logger.warning("Scheduler not initialized, cannot reschedule jobs")
        return False
    
    try:
        import asyncio
        from app.core.database import AsyncSessionLocal
        from app.models.models import ReminderFrequency
        
        async def _reschedule():
            async with AsyncSessionLocal() as session:
                # Get notification settings
                result = await session.execute(select(NotificationSettings))
                settings = result.scalar_one_or_none()
                
                # Fee reminder settings
                fee_enabled = settings.fee_reminders_enabled if settings else True
                fee_days = settings.fee_reminder_days_before if settings else 3
                fee_time = settings.fee_reminder_time if settings else "09:00"
                fee_freq = settings.fee_reminder_frequency if settings else ReminderFrequency.DAILY
                
                # Document reminder settings
                doc_enabled = settings.document_reminders_enabled if settings else True
                doc_time = settings.document_reminder_time if settings else "10:00"
                doc_freq = settings.document_reminder_frequency if settings else ReminderFrequency.WEEKLY
                
                # Parse times
                fee_hour, fee_minute = map(int, fee_time.split(":")) if fee_time else (9, 0)
                doc_hour, doc_minute = map(int, doc_time.split(":")) if doc_time else (10, 0)
                
                # Define job wrappers
                async def run_fee_reminder_job():
                    async with AsyncSessionLocal() as db:
                        await check_pending_fees_reminder(db, fee_days)
                
                async def run_document_reminder_job():
                    async with AsyncSessionLocal() as db:
                        await check_document_requests_reminder(db)
                
                # Remove existing jobs
                for job_id in ["fee_reminder_daily", "fee_reminder_weekly", 
                               "document_reminder_daily", "document_reminder_weekly",
                               "fee_reminder_default", "document_reminder_default"]:
                    try:
                        scheduler.remove_job(job_id)
                    except Exception:
                        pass
                
                # Schedule fee reminder based on settings
                if fee_enabled:
                    if fee_freq == ReminderFrequency.DAILY:
                        scheduler.add_job(
                            run_fee_reminder_job,
                            CronTrigger(hour=fee_hour, minute=fee_minute),
                            id="fee_reminder_daily",
                            name="Daily Fee Reminder",
                            replace_existing=True
                        )
                        logger.info(f"Rescheduled daily fee reminder at {fee_hour}:{fee_minute:02d}")
                    elif fee_freq == ReminderFrequency.WEEKLY:
                        scheduler.add_job(
                            run_fee_reminder_job,
                            CronTrigger(day_of_week=0, hour=fee_hour, minute=fee_minute),
                            id="fee_reminder_weekly",
                            name="Weekly Fee Reminder",
                            replace_existing=True
                        )
                        logger.info(f"Rescheduled weekly fee reminder at {fee_hour}:{fee_minute:02d}")
                
                # Schedule document reminder based on settings
                if doc_enabled:
                    if doc_freq == ReminderFrequency.DAILY:
                        scheduler.add_job(
                            run_document_reminder_job,
                            CronTrigger(hour=doc_hour, minute=doc_minute),
                            id="document_reminder_daily",
                            name="Daily Document Reminder",
                            replace_existing=True
                        )
                        logger.info(f"Rescheduled daily document reminder at {doc_hour}:{doc_minute:02d}")
                    elif doc_freq == ReminderFrequency.WEEKLY:
                        scheduler.add_job(
                            run_document_reminder_job,
                            CronTrigger(day_of_week=0, hour=doc_hour, minute=doc_minute),
                            id="document_reminder_weekly",
                            name="Weekly Document Reminder",
                            replace_existing=True
                        )
                        logger.info(f"Rescheduled weekly document reminder at {doc_hour}:{doc_minute:02d}")
        
        asyncio.run(_reschedule())
        logger.info("Jobs rescheduled successfully from database settings")
        return True
    except Exception as e:
        logger.error(f"Error rescheduling jobs: {e}")
        return False


def schedule_reminder_job(reminder_id: int, notification_type: str, frequency: str, hour: int, minute: int, days_before: int = 3):
    """
    Schedule a specific reminder job.
    """
    global scheduler
    if not scheduler:
        logger.warning("Scheduler not initialized")
        return False
    
    from app.core.database import AsyncSessionLocal
    
    async def run_job():
        async with AsyncSessionLocal() as session:
            # Get the reminder from DB
            result = await session.execute(
                select(ScheduledReminder).where(ScheduledReminder.id == reminder_id)
            )
            reminder = result.scalar_one_or_none()
            if reminder:
                from app.routers.notifications import _execute_reminder
                await _execute_reminder(session, reminder)
    
    job_id = f"reminder_{reminder_id}"
    
    try:
        scheduler.remove_job(job_id)
    except Exception:
        pass
    
    # Determine trigger based on frequency
    if frequency == "daily":
        trigger = CronTrigger(hour=hour, minute=minute)
    elif frequency == "weekly":
        trigger = CronTrigger(day_of_week=0, hour=hour, minute=minute)  # Monday
    else:
        trigger = CronTrigger(hour=hour, minute=minute)
    
    scheduler.add_job(run_job, trigger, id=job_id, name=f"Reminder {reminder_id}")
    logger.info(f"Scheduled reminder {reminder_id} with {frequency} frequency at {hour}:{minute}")
    return True


def remove_reminder_job(reminder_id: int):
    """Remove a specific reminder job"""
    global scheduler
    if not scheduler:
        return False
    
    job_id = f"reminder_{reminder_id}"
    try:
        scheduler.remove_job(job_id)
        logger.info(f"Removed reminder job {reminder_id}")
        return True
    except Exception:
        return False
