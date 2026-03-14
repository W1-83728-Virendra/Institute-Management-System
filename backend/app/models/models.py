from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Enum as SQLEnum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    STUDENT = "student"
    STAFF = "staff"


class FeeStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"
    PARTIAL = "partial"


class DocumentStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.STUDENT)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    student = relationship("Student", back_populates="user", uselist=False)
    admin_profile = relationship("Admin", back_populates="user", uselist=False)


class Admin(Base):
    __tablename__ = "admins"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="admin_profile")


class Student(Base):
    __tablename__ = "students"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    admission_no = Column(String(50), unique=True, index=True, nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20))
    address = Column(Text)
    course = Column(String(100))
    semester = Column(Integer, default=1)
    guardian_name = Column(String(100))
    guardian_phone = Column(String(20))
    admission_date = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="student")
    fees = relationship("Fee", back_populates="student")
    documents = relationship("Document", back_populates="student")
    payments = relationship("Payment", back_populates="student")


class Course(Base):
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    description = Column(Text)
    duration_years = Column(Integer, default=3)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Note: Fees now use course name directly, no foreign key relationship


class Fee(Base):
    __tablename__ = "fees"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    course = Column(String(100), nullable=False)  # Store course name directly
    fee_type = Column(String(100), nullable=False)  # e.g., "Tuition Fee", "Exam Fee"
    amount = Column(Float, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(SQLEnum(FeeStatus), default=FeeStatus.PENDING)
    description = Column(Text)
    academic_year = Column(String(20))
    semester = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    student = relationship("Student", back_populates="fees")
    payments = relationship("Payment", back_populates="fee")


class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    fee_id = Column(Integer, ForeignKey("fees.id"), nullable=False)
    amount = Column(Float, nullable=False)
    payment_method = Column(String(50))  # UPI, Card, Cash, Bank Transfer
    transaction_id = Column(String(100), unique=True)
    payment_date = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String(20), default="completed")  # completed, failed, pending
    notes = Column(Text)
    
    # Relationships
    student = relationship("Student", back_populates="payments")
    fee = relationship("Fee", back_populates="payments")


class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    document_type = Column(String(100), nullable=False)  # marksheet, id_card, bonafide, etc.
    category = Column(String(50), default="other")  # academic, id_proof, certificate, other
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    status = Column(SQLEnum(DocumentStatus), default=DocumentStatus.PENDING)
    issued_date = Column(DateTime(timezone=True), server_default=func.now())
    verified_date = Column(DateTime(timezone=True))
    expiry_date = Column(DateTime(timezone=True), nullable=True)  # For documents with validity period
    is_required = Column(Boolean, default=False)  # Required vs optional
    is_college_issued = Column(Boolean, default=False)
    notes = Column(Text)
    
    # Relationships
    student = relationship("Student", back_populates="documents")


class DocumentRequest(Base):
    """Document requests - admin requests specific documents from students"""
    __tablename__ = "document_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    document_type = Column(String(100), nullable=False)  # marksheet, id_card, etc.
    description = Column(Text, nullable=True)  # Optional note for student
    due_date = Column(DateTime(timezone=True), nullable=True)  # When student should submit
    status = Column(String(50), default="pending")  # pending, submitted, rejected
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    student = relationship("Student", foreign_keys=[student_id])
    creator = relationship("User")


class DocumentAuditLog(Base):
    """Audit trail for document actions - view, download, verify, etc."""
    __tablename__ = "document_audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(50), nullable=False)  # view, download, verify, reject, upload
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    document = relationship("Document")
    user = relationship("User")


# NOTE: Course-Fee relationship removed - fees now use course name directly
