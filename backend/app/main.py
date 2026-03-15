from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import engine, AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.models import Base, User, Student, Course, Fee, Document, FeeStatus, DocumentStatus
from app.routers import auth, students, fees, documents
from datetime import datetime, timedelta


async def seed_admin_user():
    """Create default admin and student users if not exists"""
    from sqlalchemy import select
    async with AsyncSessionLocal() as session:
        # Create admin user
        result = await session.execute(
            select(User).where(User.email == "admin@edu.com")
        )
        admin = result.scalar_one_or_none()
        if not admin:
            admin_user = User(
                email="admin@edu.com",
                password_hash=get_password_hash("admin123"),
                role="admin",
                is_active=True
            )
            session.add(admin_user)
            await session.commit()
            print("Created default admin user: admin@edu.com / admin123")
        
        # Create default student user with profile
        result = await session.execute(
            select(User).where(User.email == "student@edu.com")
        )
        student_user = result.scalar_one_or_none()
        
        if not student_user:
            student_user = User(
                email="student@edu.com",
                password_hash=get_password_hash("student123"),
                role="student",
                is_active=True
            )
            session.add(student_user)
            await session.commit()
            await session.refresh(student_user)
            print("Created default student user: student@edu.com / student123")
        
        # Check if student profile exists
        result = await session.execute(
            select(Student).where(Student.user_id == student_user.id)
        )
        student_profile = result.scalar_one_or_none()
        
        if not student_profile:
            # Create student profile
            student_profile = Student(
                user_id=student_user.id,
                admission_no="ADM-2024-001",
                first_name="Rahul",
                last_name="Sharma",
                phone="9876543210",
                course="BCom",
                semester=3
            )
            session.add(student_profile)
            await session.commit()
            await session.refresh(student_profile)
            print("Created student profile for Rahul Sharma")
        
        # Create a course if not exists
        result = await session.execute(
            select(Course).where(Course.code == "BCOM")
        )
        course = result.scalar_one_or_none()
        
        if not course:
            course = Course(
                name="Bachelor of Commerce",
                code="BCOM",
                description="3-year Commerce degree",
                duration_years=3
            )
            session.add(course)
            await session.commit()
            await session.refresh(course)
            print("Created BCom course")
        
        # Create sample fees for the student
        result = await session.execute(
            select(Fee).where(Fee.student_id == student_profile.id)
        )
        existing_fees = result.scalars().all()
        
        if len(existing_fees) == 0:
            # Create fees for Semester 1, 2, 3
            for sem in [1, 2, 3]:
                fee = Fee(
                    student_id=student_profile.id,
                    # course_id=course.id,
                    course=course.name,
                    fee_type="Tuition Fee",
                    amount=25000,
                    due_date=datetime(2024 if sem == 1 or sem == 2 else 2025, 6 if sem % 2 == 1 else 12, 15),
                    status=FeeStatus.PAID if sem <= 3 else FeeStatus.PENDING,
                    academic_year="2024-25" if sem <= 2 else "2025-26",
                    semester=sem
                )
                session.add(fee)
            
            # Add one pending fee for demo
            pending_fee = Fee(
                student_id=student_profile.id,
                # course_id=course.id,
                course=course.name,
                fee_type="Exam Fee",
                amount=5000,
                due_date=datetime(2025, 6, 15),
                status=FeeStatus.PENDING,
                academic_year="2025-26",
                semester=4
            )
            session.add(pending_fee)
            
            await session.commit()
            print("Created sample fees for student")
        
        # Create sample documents
        result = await session.execute(
            select(Document).where(Document.student_id == student_profile.id)
        )
        existing_docs = result.scalars().all()
        
        if len(existing_docs) == 0:
            doc_types = [
                ("10th Marksheet", "10th_marksheet.pdf", DocumentStatus.VERIFIED),
                ("12th Marksheet", "12th_marksheet.pdf", DocumentStatus.VERIFIED),
                ("Transfer Certificate", "tc.pdf", DocumentStatus.VERIFIED),
                ("Photo", "photo.jpg", DocumentStatus.VERIFIED),
                ("Aadhar Card", "aadhar.pdf", DocumentStatus.VERIFIED),
            ]
            
            for doc_type, filename, status in doc_types:
                doc = Document(
                    student_id=student_profile.id,
                    document_type=doc_type,
                    file_name=filename,
                    file_path=f"uploads/documents/{filename}",
                    status=status,
                    issued_date=datetime.utcnow(),
                    is_college_issued=True
                )
                session.add(doc)
            
            await session.commit()
            print("Created sample documents for student")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Seed admin user
    await seed_admin_user()
    yield
    # Shutdown: Close database connections
    await engine.dispose()


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Institute Management System API",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(students.router, prefix="/api")
app.include_router(fees.router, prefix="/api")
app.include_router(documents.router, prefix="/api")


@app.get("/")
async def root():
    return {
        "message": "Welcome to Institute Management System API",
        "version": settings.APP_VERSION,
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
