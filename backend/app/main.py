from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import engine, AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.models import Base, User, Student, Course, Fee, Document, FeeStatus, DocumentStatus, DocumentType
from app.routers import auth, students, fees, documents, courses, payments
from datetime import datetime, timedelta
from sqlalchemy import select


async def seed_admin_user():
    """Create default admin and student users if not exists"""
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


async def seed_document_types():
    """Seed default document types if not exists"""
    async with AsyncSessionLocal() as session:
        # Check if document types already exist
        result = await session.execute(select(DocumentType))
        existing_types = result.scalars().all()
        
        if not existing_types:
            default_types = [
                {"value": "10th_marksheet", "label": "10th Marksheet", "category": "academic", "is_required": True, "display_order": 1},
                {"value": "12th_marksheet", "label": "12th Marksheet", "category": "academic", "is_required": True, "display_order": 2},
                {"value": "semester_marksheet", "label": "Semester Marksheet", "category": "academic", "is_required": True, "display_order": 3},
                {"value": "id_proof", "label": "ID Proof (Aadhar/PAN)", "category": "id_proof", "is_required": True, "display_order": 4},
                {"value": "photo", "label": "Passport Photo", "category": "id_proof", "is_required": True, "display_order": 5},
                {"value": "transfer_certificate", "label": "Transfer Certificate", "category": "certificate", "is_required": False, "display_order": 6},
                {"value": "leaving_certificate", "label": "Leaving Certificate", "category": "certificate", "is_required": False, "display_order": 7},
                {"value": "character_certificate", "label": "Character Certificate", "category": "certificate", "is_required": False, "display_order": 8},
                {"value": "bonafide_certificate", "label": "Bonafide Certificate", "category": "certificate", "is_required": False, "display_order": 9},
                {"value": "income_certificate", "label": "Income Certificate", "category": "certificate", "is_required": False, "display_order": 10},
                {"value": "caste_certificate", "label": "Caste Certificate", "category": "certificate", "is_required": False, "display_order": 11},
                {"value": "domicile_certificate", "label": "Domicile Certificate", "category": "certificate", "is_required": False, "display_order": 12},
                {"value": "library_card", "label": "Library Card", "category": "other", "is_required": False, "display_order": 13},
                {"value": "other", "label": "Other Document", "category": "other", "is_required": False, "display_order": 14},
            ]
            
            for doc_type in default_types:
                new_type = DocumentType(**doc_type)
                session.add(new_type)
            
            await session.commit()
            print(f"Seeded {len(default_types)} document types")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Seed admin user
    await seed_admin_user()
    # Seed document types
    await seed_document_types()
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
app.include_router(courses.router, prefix="/api")
app.include_router(payments.router, prefix="/api")

# Serve uploaded files
import os
os.makedirs("backend/uploads/receipts", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="backend/uploads"), name="uploads")


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
