from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Course, Student
from app.schemas.schemas import CourseCreate, CourseResponse, CourseUpdate

router = APIRouter(prefix="/courses", tags=["Courses"])


@router.get("", response_model=dict)
async def get_courses(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all courses with pagination and optional search."""
    query = select(Course)
    
    if search:
        query = query.where(
            (Course.name.ilike(f"%{search}%")) | 
            (Course.code.ilike(f"%{search}%"))
        )
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Course.name)
    
    result = await db.execute(query)
    courses = result.scalars().all()
    
    # Get student count for each course
    items = []
    for course in courses:
        # Count students in this course
        student_count_result = await db.execute(
            select(func.count()).select_from(Student).where(Student.course == course.name)
        )
        student_count = student_count_result.scalar()
        
        items.append({
            "id": course.id,
            "name": course.name,
            "code": course.code,
            "description": course.description,
            "duration_years": course.duration_years,
            "is_active": course.is_active,
            "created_at": course.created_at.isoformat() if course.created_at else None,
            "student_count": student_count
        })
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total else 0,
        "items": items
    }


@router.get("/list", response_model=list)
async def get_courses_list(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of all active courses (for dropdowns)."""
    result = await db.execute(
        select(Course).where(Course.is_active == True).order_by(Course.name)
    )
    courses = result.scalars().all()
    
    return [
        {
            "id": course.id,
            "name": course.name,
            "code": course.code
        }
        for course in courses
    ]


@router.get("/{course_id}", response_model=dict)
async def get_course(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific course by ID."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    # Get student count
    student_count_result = await db.execute(
        select(func.count()).select_from(Student).where(Student.course == course.name)
    )
    student_count = student_count_result.scalar()
    
    return {
        "id": course.id,
        "name": course.name,
        "code": course.code,
        "description": course.description,
        "duration_years": course.duration_years,
        "is_active": course.is_active,
        "created_at": course.created_at.isoformat() if course.created_at else None,
        "student_count": student_count
    }


@router.post("", status_code=status.HTTP_201_CREATED, response_model=dict)
async def create_course(
    course_data: CourseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new course."""
    # Check if course with same name or code exists
    result = await db.execute(
        select(Course).where(
            (Course.name == course_data.name) | 
            (Course.code == course_data.code)
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        if existing.name == course_data.name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Course with this name already exists"
            )
        if existing.code == course_data.code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Course with this code already exists"
            )
    
    course = Course(
        name=course_data.name,
        code=course_data.code,
        description=course_data.description,
        duration_years=course_data.duration_years or 3
    )
    
    db.add(course)
    await db.commit()
    await db.refresh(course)
    
    return {
        "id": course.id,
        "name": course.name,
        "code": course.code,
        "message": "Course created successfully"
    }


@router.put("/{course_id}", response_model=dict)
async def update_course(
    course_id: int,
    course_data: CourseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a course."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    # Check for duplicate name/code (excluding current course)
    if course_data.name and course_data.name != course.name:
        check_result = await db.execute(
            select(Course).where(Course.name == course_data.name, Course.id != course_id)
        )
        if check_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Course with this name already exists"
            )
    
    if course_data.code and course_data.code != course.code:
        check_result = await db.execute(
            select(Course).where(Course.code == course_data.code, Course.id != course_id)
        )
        if check_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Course with this code already exists"
            )
    
    # Update fields
    if course_data.name:
        course.name = course_data.name
    if course_data.code:
        course.code = course_data.code
    if course_data.description is not None:
        course.description = course_data.description
    if course_data.duration_years:
        course.duration_years = course_data.duration_years
    if course_data.is_active is not None:
        course.is_active = course_data.is_active
    
    await db.commit()
    await db.refresh(course)
    
    return {
        "id": course.id,
        "name": course.name,
        "code": course.code,
        "message": "Course updated successfully"
    }


@router.delete("/{course_id}", response_model=dict)
async def delete_course(
    course_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a course (or deactivate if students exist)."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found"
        )
    
    # Check if students exist for this course
    student_count_result = await db.execute(
        select(func.count()).select_from(Student).where(Student.course == course.name)
    )
    student_count = student_count_result.scalar()
    
    if student_count > 0:
        # Deactivate instead of delete
        course.is_active = False
        await db.commit()
        return {
            "message": f"Course deactivated. {student_count} student(s) are enrolled in this course."
        }
    
    # Delete if no students
    await db.delete(course)
    await db.commit()
    
    return {
        "message": "Course deleted successfully"
    }
