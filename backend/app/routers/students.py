from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional, List

from app.core.database import get_db
from app.core.security import get_current_user, get_password_hash
from app.models.models import User, Student, UserRole, Fee, Document, FeeStatus, DocumentStatus
from app.schemas.schemas import (
    StudentCreate,
    StudentUpdate,
    StudentResponse,
    StudentListResponse,
    PaginatedResponse
)

router = APIRouter(prefix="/students", tags=["Students"])


@router.get("", response_model=PaginatedResponse)
async def get_students(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=1000),
    search: str = Query(""),
    course: str = Query(""),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all students with pagination."""
    offset = (page - 1) * page_size
    
    # Base query
    base_query = select(Student)
    count_query = select(func.count(Student.id))
    
    # Apply filters
    if search:
        search_filter = or_(
            Student.first_name.ilike(f"%{search}%"),
            Student.last_name.ilike(f"%{search}%"),
            Student.admission_no.ilike(f"%{search}%"),
            Student.phone.ilike(f"%{search}%"),
            Student.guardian_name.ilike(f"%{search}%"),
            Student.guardian_phone.ilike(f"%{search}%")
        )
        base_query = base_query.where(search_filter)
        count_query = count_query.where(search_filter)
    
    if course:
        base_query = base_query.where(Student.course == course)
        count_query = count_query.where(Student.course == course)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Get students with pagination
    base_query = base_query.order_by(Student.created_at.desc())
    base_query = base_query.offset(offset).limit(page_size)
    
    result = await db.execute(base_query)
    students = result.scalars().all()
    
    # Get fee status for each student
    student_list = []
    for student in students:
        # Check fee status
        fee_result = await db.execute(
            select(func.count(Fee.id)).where(
                Fee.student_id == student.id,
                Fee.status == FeeStatus.PENDING
            )
        )
        pending_fees = fee_result.scalar() or 0
        
        # Check document status
        doc_result = await db.execute(
            select(func.count(Document.id)).where(
                Document.student_id == student.id,
                Document.status == DocumentStatus.VERIFIED
            )
        )
        verified_docs = doc_result.scalar() or 0
        
        student_dict = {
            "id": student.id,
            "admission_no": student.admission_no,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "phone": student.phone,
            "course": student.course,
            "semester": student.semester,
            "fee_status": "Paid" if pending_fees == 0 else "Pending",
            "document_status": "Complete" if verified_docs > 0 else "Pending"
        }
        student_list.append(student_dict)
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "items": student_list
    }


@router.get("/courses/list")
async def get_courses_list(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of all courses."""
    result = await db.execute(
        select(Student.course).distinct().where(Student.course.isnot(None))
    )
    courses = [row[0] for row in result.all()]
    return courses


@router.get("/overview")
async def get_students_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get overview of students by course."""
    result = await db.execute(
        select(
            Student.course,
            func.count(Student.id).label('total_students')
        ).group_by(Student.course)
    )
    
    overview = []
    for row in result.all():
        course = row[0]
        total_students = row[1]
        
        # Get fee statistics for this course
        course_students = await db.execute(
            select(Student.id).where(Student.course == course)
        )
        student_ids = [s[0] for s in course_students.all()]
        
        if student_ids:
            from sqlalchemy import and_
            fees_result = await db.execute(
                select(func.sum(Fee.amount)).where(
                    and_(
                        Fee.student_id.in_(student_ids),
                        Fee.status == FeeStatus.PENDING
                    )
                )
            )
            pending_amount = float(fees_result.scalar() or 0)
            
            collected_result = await db.execute(
                select(func.sum(Fee.amount)).where(
                    and_(
                        Fee.student_id.in_(student_ids),
                        Fee.status == FeeStatus.PAID
                    )
                )
            )
            collected_amount = float(collected_result.scalar() or 0)
        else:
            pending_amount = 0
            collected_amount = 0
        
        overview.append({
            "course": course,
            "total_students": total_students,
            "pending_fees": pending_amount,
            "collected_fees": collected_amount
        })
    
    return overview


@router.get("/{student_id}")
async def get_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get student by ID."""
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Get user email
    user_result = await db.execute(select(User).where(User.id == student.user_id))
    user = user_result.scalar_one_or_none()
    
    # Get fees
    fees_result = await db.execute(
        select(Fee).where(Fee.student_id == student_id)
    )
    fees = fees_result.scalars().all()
    
    # Get documents
    docs_result = await db.execute(
        select(Document).where(Document.student_id == student_id)
    )
    documents = docs_result.scalars().all()
    
    return {
        "id": student.id,
        "admission_no": student.admission_no,
        "first_name": student.first_name,
        "last_name": student.last_name,
        "email": user.email if user else None,
        "phone": student.phone,
        "address": student.address,
        "course": student.course,
        "semester": student.semester,
        "guardian_name": student.guardian_name,
        "guardian_phone": student.guardian_phone,
        "fees": [
            {
                "id": f.id,
                "fee_type": f.fee_type,
                "amount": f.amount,
                "due_date": f.due_date.isoformat() if f.due_date else None,
                "status": f.status.value if f.status else None,
                "academic_year": f.academic_year,
                "semester": f.semester
            }
            for f in fees
        ],
        "documents": [
            {
                "id": d.id,
                "document_type": d.document_type,
                "status": d.status.value if d.status else None,
                "file_name": d.file_name
            }
            for d in documents
        ]
    }


@router.put("/{student_id}")
async def update_student(
    student_id: int,
    student_data: StudentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a student."""
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Update student fields
    if student_data.first_name is not None:
        student.first_name = student_data.first_name
    if student_data.last_name is not None:
        student.last_name = student_data.last_name
    if student_data.phone is not None:
        student.phone = student_data.phone
    if student_data.address is not None:
        student.address = student_data.address
    if student_data.course is not None:
        student.course = student_data.course
    if student_data.semester is not None:
        student.semester = student_data.semester
    if student_data.gender is not None:
        student.gender = student_data.gender
    if student_data.caste_category is not None:
        student.caste_category = student_data.caste_category
    if student_data.academic_year is not None:
        student.academic_year = student_data.academic_year
    if student_data.admission_quota is not None:
        student.admission_quota = student_data.admission_quota
    if student_data.guardian_name is not None:
        student.guardian_name = student_data.guardian_name
    if student_data.guardian_phone is not None:
        student.guardian_phone = student_data.guardian_phone
    
    await db.commit()
    await db.refresh(student)
    
    return {
        "id": student.id,
        "admission_no": student.admission_no,
        "first_name": student.first_name,
        "last_name": student.last_name,
        "phone": student.phone,
        "course": student.course,
        "semester": student.semester,
        "message": "Student updated successfully"
    }


@router.delete("/{student_id}")
async def delete_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a student."""
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Delete associated user
    if student.user_id:
        user_result = await db.execute(select(User).where(User.id == student.user_id))
        user = user_result.scalar_one_or_none()
        if user:
            db.delete(user)
    
    db.delete(student)
    await db.commit()
    
    return {"message": "Student deleted successfully"}


@router.post("", status_code=status.HTTP_201_CREATED, response_model=dict)
async def create_student(
    student_data: StudentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new student."""
    # Validate required fields
    if not student_data.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required"
        )
    
    # Validate email format
    import re
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, student_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email format"
        )
    
    if not student_data.first_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="First name is required"
        )
    if not student_data.last_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Last name is required"
        )
    if not student_data.course:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Course is required"
        )
    if not student_data.password:
        # Generate a temporary password
        import secrets
        import string
        alphabet = string.ascii_letters + string.digits
        temp_password = ''.join(secrets.choice(alphabet) for _ in range(8))
        student_data.password = temp_password
    
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == student_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Auto-generate admission number if not provided
    admission_no = student_data.admission_no
    if not admission_no:
        # Generate unique admission number: ADM-YYYY-XXXX
        from datetime import datetime
        year = datetime.now().year
        # Get count of existing students
        count_result = await db.execute(select(func.count(Student.id)))
        student_count = count_result.scalar() or 0
        admission_no = f"ADM-{year}-{str(student_count + 1).zfill(3)}"
    
    # Check if admission number exists
    result = await db.execute(select(Student).where(Student.admission_no == admission_no))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admission number already exists"
        )
    
    # Create user
    user = User(
        email=student_data.email,
        password_hash=get_password_hash(student_data.password),
        role=UserRole.STUDENT
    )
    db.add(user)
    await db.flush()
    
    # Create student
    student = Student(
        user_id=user.id,
        admission_no=admission_no,
        first_name=student_data.first_name,
        last_name=student_data.last_name,
        phone=student_data.phone,
        address=student_data.address,
        course=student_data.course,
        semester=student_data.semester,
        gender=student_data.gender,
        caste_category=student_data.caste_category,
        academic_year=student_data.academic_year,
        admission_quota=student_data.admission_quota,
        guardian_name=student_data.guardian_name,
        guardian_phone=student_data.guardian_phone
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)
    
    return {
        "id": student.id,
        "admission_no": student.admission_no,
        "first_name": student.first_name,
        "last_name": student.last_name,
        "email": student_data.email,
        "message": "Student created successfully"
    }
