from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional, List, Union
from datetime import datetime, date
from enum import Enum


# Enums
class UserRoleEnum(str, Enum):
    ADMIN = "admin"
    STUDENT = "student"
    STAFF = "staff"


class FeeStatusEnum(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"
    PARTIAL = "partial"


class DocumentStatusEnum(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


# Auth Schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Optional[dict] = None


class TokenPayload(BaseModel):
    sub: int
    email: str
    role: UserRoleEnum
    exp: Optional[datetime] = None


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    role: UserRoleEnum


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Student Schemas
class StudentBase(BaseModel):
    admission_no: Optional[str] = None  # Optional - auto-generated if not provided
    first_name: str
    last_name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    course: str
    semester: int = 1
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None


class StudentCreate(StudentBase):
    email: Optional[str] = None  # Made optional - validated in router
    password: Optional[str] = None  # Optional - auto-generated if not provided


class StudentUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    course: Optional[str] = None
    semester: Optional[int] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None


class StudentResponse(StudentBase):
    id: int
    user_id: int
    admission_date: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True


class StudentListResponse(BaseModel):
    id: int
    admission_no: str
    first_name: str
    last_name: str
    phone: Optional[str]
    course: str
    semester: int
    fee_status: Optional[str] = None
    document_status: Optional[str] = None
    
    class Config:
        from_attributes = True


# Course Schemas
class CourseBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    duration_years: int = 3


class CourseCreate(CourseBase):
    pass


class CourseResponse(CourseBase):
    id: int
    is_active: bool
    
    class Config:
        from_attributes = True


# Fee Schemas
class FeeBase(BaseModel):
    fee_type: str
    amount: float
    due_date: Union[datetime, date, str]
    description: Optional[str] = None
    academic_year: str
    semester: int
    
    @model_validator(mode='before')
    @classmethod
    def parse_due_date(cls, values):
        if isinstance(values.get('due_date'), str):
            # Try to parse date string
            try:
                # Try ISO format with T
                values['due_date'] = datetime.fromisoformat(values['due_date'].replace(' ', 'T'))
            except:
                try:
                    # Try date only format
                    values['due_date'] = datetime.strptime(values['due_date'], '%Y-%m-%d')
                except:
                    pass
        return values


class FeeCreate(FeeBase):
    student_id: Optional[int] = None
    course: Optional[str] = None  # Course name (optional, auto-populated from student)


class FeeUpdate(BaseModel):
    amount: Optional[float] = None
    due_date: Optional[datetime] = None
    status: Optional[FeeStatusEnum] = None
    description: Optional[str] = None


class FeeResponse(FeeBase):
    id: int
    student_id: int
    course: str  # Course name
    status: FeeStatusEnum
    created_at: datetime
    
    class Config:
        from_attributes = True


class FeeWithStudentResponse(FeeResponse):
    student: Optional[StudentListResponse] = None
    
    class Config:
        from_attributes = True


# Payment Schemas
class PaymentBase(BaseModel):
    amount: Optional[float] = None
    payment_method: str = "cash"
    transaction_id: Optional[str] = None
    notes: Optional[str] = None


class PaymentCreate(PaymentBase):
    fee_id: Optional[int] = None


class PaymentResponse(PaymentBase):
    id: int
    student_id: int
    fee_id: int
    payment_date: datetime
    status: str
    
    class Config:
        from_attributes = True


# Document Schemas
class DocumentBase(BaseModel):
    document_type: str
    category: Optional[str] = "other"  # academic, id_proof, certificate, other
    file_name: str
    file_path: str
    file_size: Optional[int] = None


class DocumentCreate(DocumentBase):
    student_id: int


class DocumentUpdate(BaseModel):
    status: Optional[DocumentStatusEnum] = None
    notes: Optional[str] = None
    expiry_date: Optional[datetime] = None
    is_required: Optional[bool] = None
    category: Optional[str] = None


class DocumentResponse(DocumentBase):
    id: int
    student_id: int
    status: DocumentStatusEnum
    issued_date: datetime
    verified_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    is_required: bool = False
    is_college_issued: bool = False
    
    class Config:
        from_attributes = True


# Document Request Schemas
class DocumentRequestCreate(BaseModel):
    student_id: int
    document_type: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None


class DocumentRequestResponse(BaseModel):
    id: int
    student_id: int
    document_type: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    status: str
    created_by: int
    created_at: datetime
    student: Optional[dict] = None
    
    class Config:
        from_attributes = True


# Dashboard Schemas
class DashboardStats(BaseModel):
    total_students: int
    total_fee_collected: float
    total_fee_pending: float
    total_documents: int
    pending_documents: int
    overdue_fees: int
    payments_today: int = 0
    
    class Config:
        from_attributes = True


class FeeOverviewByCourse(BaseModel):
    course: str
    total_students: int
    total_fee: float
    collected: float
    pending: float
    collection_rate: float


# Pagination
class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: List


# ==================== Notification Schemas ====================

class NotificationTypeEnum(str, Enum):
    FEE_DUE = "fee_due"
    FEE_OVERDUE = "fee_overdue"
    FEE_REMINDER = "fee_reminder"
    DOCUMENT_PENDING = "document_pending"
    DOCUMENT_VERIFIED = "document_verified"
    DOCUMENT_REJECTED = "document_rejected"
    DOCUMENT_REQUEST = "document_request"
    GENERAL = "general"


class ReminderFrequencyEnum(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class NotificationBase(BaseModel):
    """Base schema for notifications"""
    title: str
    message: str
    notification_type: NotificationTypeEnum = NotificationTypeEnum.GENERAL
    link: Optional[str] = None
    related_id: Optional[int] = None
    related_type: Optional[str] = None


class NotificationCreate(NotificationBase):
    """Schema for creating a notification"""
    user_id: int


class NotificationResponse(NotificationBase):
    """Schema for notification response"""
    id: int
    user_id: int
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class NotificationUpdate(BaseModel):
    """Schema for updating notification"""
    is_read: Optional[bool] = None


class NotificationListResponse(BaseModel):
    """Schema for paginated notification list"""
    total: int
    unread_count: int
    items: List[NotificationResponse]


class ScheduledReminderBase(BaseModel):
    """Base schema for scheduled reminders"""
    name: str
    notification_type: NotificationTypeEnum
    frequency: ReminderFrequencyEnum = ReminderFrequencyEnum.DAILY
    day_of_week: Optional[int] = None  # 0-6 for weekly
    hour: int = 9
    minute: int = 0
    days_before: int = 3
    is_active: bool = True


class ScheduledReminderCreate(ScheduledReminderBase):
    """Schema for creating a scheduled reminder"""
    pass


class ScheduledReminderUpdate(BaseModel):
    """Schema for updating a scheduled reminder"""
    name: Optional[str] = None
    frequency: Optional[ReminderFrequencyEnum] = None
    day_of_week: Optional[int] = None
    hour: Optional[int] = None
    minute: Optional[int] = None
    days_before: Optional[int] = None
    is_active: Optional[bool] = None


class ScheduledReminderResponse(ScheduledReminderBase):
    """Schema for scheduled reminder response"""
    id: int
    last_run: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class NotificationSettingsBase(BaseModel):
    """Base schema for notification settings"""
    fee_reminders_enabled: bool = True
    fee_reminder_days_before: int = 3
    fee_reminder_frequency: ReminderFrequencyEnum = ReminderFrequencyEnum.DAILY
    fee_reminder_time: str = "09:00"
    document_reminders_enabled: bool = True
    document_reminder_frequency: ReminderFrequencyEnum = ReminderFrequencyEnum.WEEKLY
    document_reminder_day: int = 0
    document_reminder_time: str = "10:00"


class NotificationSettingsUpdate(BaseModel):
    """Schema for updating notification settings"""
    fee_reminders_enabled: Optional[bool] = None
    fee_reminder_days_before: Optional[int] = None
    fee_reminder_frequency: Optional[ReminderFrequencyEnum] = None
    fee_reminder_time: Optional[str] = None
    document_reminders_enabled: Optional[bool] = None
    document_reminder_frequency: Optional[ReminderFrequencyEnum] = None
    document_reminder_day: Optional[int] = None
    document_reminder_time: Optional[str] = None


class NotificationSettingsResponse(NotificationSettingsBase):
    """Schema for notification settings response"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class UserNotificationPreferencesBase(BaseModel):
    """Base schema for user notification preferences"""
    in_app_enabled: bool = True
    fee_notifications: bool = True
    document_notifications: bool = True


class UserNotificationPreferencesUpdate(BaseModel):
    """Schema for updating user notification preferences"""
    in_app_enabled: Optional[bool] = None
    fee_notifications: Optional[bool] = None
    document_notifications: Optional[bool] = None


class UserNotificationPreferencesResponse(UserNotificationPreferencesBase):
    """Schema for user notification preferences response"""
    id: int
    user_id: int
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
