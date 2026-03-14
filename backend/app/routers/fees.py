from fastapi import APIRouter, Depends, HTTPException, status, Query, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
from datetime import datetime, timedelta
import uuid

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Student, Fee, Payment, FeeStatus, UserRole
from app.schemas.schemas import (
    FeeCreate,
    FeeUpdate,
    FeeResponse,
    PaymentCreate,
    PaymentResponse,
    DashboardStats,
    FeeOverviewByCourse
)

router = APIRouter(prefix="/fees", tags=["Fees"])


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get dashboard statistics."""
    # Total students
    students_result = await db.execute(select(func.count(Student.id)))
    total_students = students_result.scalar() or 0
    
    # Total fees collected
    collected_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0))
        .where(Payment.status == "completed")
    )
    total_fee_collected = float(collected_result.scalar() or 0)
    
    # Total pending fees
    pending_result = await db.execute(
        select(func.coalesce(func.sum(Fee.amount), 0))
        .where(Fee.status == FeeStatus.PENDING)
    )
    total_fee_pending = float(pending_result.scalar() or 0)
    
    # Overdue fees
    overdue_result = await db.execute(
        select(func.count(Fee.id))
        .where(and_(Fee.status == FeeStatus.PENDING, Fee.due_date < datetime.utcnow()))
    )
    overdue_fees = overdue_result.scalar() or 0
    
    # Total documents
    from app.models.models import Document
    docs_result = await db.execute(select(func.count(Document.id)))
    total_documents = docs_result.scalar() or 0
    
    # Pending documents
    pending_docs_result = await db.execute(
        select(func.count(Document.id))
        .where(Document.status == "pending")
    )
    pending_documents = pending_docs_result.scalar() or 0
    
    # Payments today
    start_of_today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    payments_today_result = await db.execute(
        select(func.count(Payment.id))
        .where(and_(Payment.payment_date >= start_of_today, Payment.status == "completed"))
    )
    payments_today = payments_today_result.scalar() or 0
    
    return DashboardStats(
        total_students=total_students,
        total_fee_collected=total_fee_collected,
        total_fee_pending=total_fee_pending,
        total_documents=total_documents,
        pending_documents=pending_documents,
        overdue_fees=overdue_fees,
        payments_today=payments_today
    )


@router.get("/overview-by-course")
async def get_fee_overview_by_course(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get fee overview grouped by course."""
    # Get all courses
    courses_result = await db.execute(
        select(Student.course, func.count(Student.id))
        .group_by(Student.course)
    )
    courses_data = courses_result.all()
    
    overview = []
    for course, student_count in courses_data:
        # Get total fee for this course
        fees_result = await db.execute(
            select(func.coalesce(func.sum(Fee.amount), 0))
            .join(Student).where(Student.course == course)
        )
        total_fee = float(fees_result.scalar() or 0)
        
        # Get collected fee
        collected_result = await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0))
            .join(Fee).join(Student)
            .where(Student.course == course, Payment.status == "completed")
        )
        collected = float(collected_result.scalar() or 0)
        
        pending = total_fee - collected
        collection_rate = (collected / total_fee * 100) if total_fee > 0 else 0
        
        overview.append(FeeOverviewByCourse(
            course=course,
            total_students=student_count,
            total_fee=total_fee,
            collected=collected,
            pending=pending,
            collection_rate=round(collection_rate, 1)
        ))
    
    return overview


@router.get("", response_model=dict)
async def get_fees(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    student_id: Optional[int] = None,
    status: Optional[str] = None,
    course: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all fees with pagination and filters."""
    query = select(Fee).join(Student)
    
    # Apply filters
    if student_id:
        query = query.where(Fee.student_id == student_id)
    if status:
        query = query.where(Fee.status == status)
    if course:
        # Filter by Fee.course (stored course name) or Student.course
        query = query.where((Fee.course == course) | (Student.course == course))
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Fee.due_date.desc())
    
    result = await db.execute(query)
    fees = result.scalars().all()
    
    # Build response items
    items = []
    for fee in fees:
        student_result = await db.execute(
            select(Student).where(Student.id == fee.student_id)
        )
        student = student_result.scalar_one_or_none()
        
        items.append({
            "id": fee.id,
            "student": {
                "id": student.id,
                "name": f"{student.first_name} {student.last_name}",
                "admission_no": student.admission_no
            } if student else None,
            "fee_type": fee.fee_type,
            "amount": fee.amount,
            "due_date": fee.due_date,
            "status": fee.status.value,
            "semester": fee.semester,
            "academic_year": fee.academic_year,
            "course": fee.course  # Include course name
        })
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "items": items
    }


# Student-specific endpoints - MUST come BEFORE /{fee_id} route
@router.get("/my-fees")
async def get_my_fees(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get fees for the current student user."""
    result = await db.execute(
        select(Student).where(Student.user_id == current_user.id)
    )
    student = result.scalar_one_or_none()
    
    if not student:
        return {"fees": [], "message": "No student profile found"}
    
    fees_result = await db.execute(
        select(Fee).where(Fee.student_id == student.id)
    )
    fees = fees_result.scalars().all()
    
    return {
        "fees": [
            {
                "id": fee.id,
                "fee_type": fee.fee_type,
                "amount": fee.amount,
                "due_date": fee.due_date.isoformat() if fee.due_date else None,
                "status": fee.status.value if fee.status else None,
                "semester": fee.semester,
                "academic_year": fee.academic_year
            }
            for fee in fees
        ]
    }

@router.get("/my-summary")
async def get_my_fee_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get fee summary for the current student."""
    result = await db.execute(
        select(Student).where(Student.user_id == current_user.id)
    )
    student = result.scalar_one_or_none()
    
    if not student:
        return {
            "total_paid": 0,
            "total_pending": 0,
            "total_overdue": 0,
            "total_fees": 0
        }
    
    fees_result = await db.execute(
        select(Fee).where(Fee.student_id == student.id)
    )
    fees = fees_result.scalars().all()
    
    total_paid = sum(fee.amount for fee in fees if fee.status == FeeStatus.PAID)
    total_pending = sum(fee.amount for fee in fees if fee.status == FeeStatus.PENDING)
    total_overdue = sum(fee.amount for fee in fees if fee.status == FeeStatus.OVERDUE)
    
    return {
        "total_paid": total_paid,
        "total_pending": total_pending,
        "total_overdue": total_overdue,
        "total_fees": total_paid + total_pending + total_overdue
    }


@router.get("/{fee_id}", response_model=dict)
async def get_fee(
    fee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific fee by ID."""
    result = await db.execute(select(Fee).where(Fee.id == fee_id))
    fee = result.scalar_one_or_none()
    
    if not fee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee not found"
        )
    
    # Get student
    student_result = await db.execute(
        select(Student).where(Student.id == fee.student_id)
    )
    student = student_result.scalar_one_or_none()
    
    # Get payments
    payments_result = await db.execute(
        select(Payment).where(Payment.fee_id == fee.id)
    )
    payments = payments_result.scalars().all()
    
    return {
        "id": fee.id,
        "student": {
            "id": student.id,
            "name": f"{student.first_name} {student.last_name}",
            "admission_no": student.admission_no,
            "course": student.course
        } if student else None,
        "fee_type": fee.fee_type,
        "amount": fee.amount,
        "due_date": fee.due_date,
        "status": fee.status.value,
        "description": fee.description,
        "academic_year": fee.academic_year,
        "semester": fee.semester,
        "payments": [
            {
                "id": p.id,
                "amount": p.amount,
                "payment_method": p.payment_method,
                "transaction_id": p.transaction_id,
                "payment_date": p.payment_date,
                "status": p.status
            }
            for p in payments
        ]
    }


@router.post("", status_code=status.HTTP_201_CREATED, response_model=dict)
async def create_fee(
    fee_data: FeeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new fee for a student."""
    # Get course from student
    course_name = None
    if fee_data.student_id:
        student_result = await db.execute(
            select(Student).where(Student.id == fee_data.student_id)
        )
        student = student_result.scalar_one_or_none()
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found"
            )
        # Use student's course name directly
        course_name = getattr(student, 'course', None) or "General"
    
    fee = Fee(
        student_id=fee_data.student_id,
        course=course_name,  # Store course name directly
        fee_type=fee_data.fee_type,
        amount=fee_data.amount,
        due_date=fee_data.due_date,
        description=fee_data.description,
        academic_year=fee_data.academic_year,
        semester=fee_data.semester,
        status=FeeStatus.PENDING
    )
    db.add(fee)
    await db.commit()
    await db.refresh(fee)
    
    return {
        "id": fee.id,
        "fee_type": fee.fee_type,
        "amount": fee.amount,
        "due_date": fee.due_date,
        "message": "Fee created successfully"
    }


@router.post("/{fee_id}/pay", response_model=dict)
async def pay_fee(
    fee_id: int,
    payment_data: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Record a payment for a fee."""
    # Get fee
    fee_result = await db.execute(select(Fee).where(Fee.id == fee_id))
    fee = fee_result.scalar_one_or_none()
    
    if not fee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee not found"
        )
    
    # Generate transaction ID
    transaction_id = f"TXN-{uuid.uuid4().hex[:12].upper()}"
    
    # Create payment - use provided amount or get from fee
    payment_amount = payment_data.amount if payment_data.amount else fee.amount
    
    payment = Payment(
        student_id=current_user.id if current_user.role == UserRole.STUDENT else fee.student_id,
        fee_id=fee_id,
        amount=payment_amount,
        payment_method=payment_data.payment_method,
        transaction_id=transaction_id,
        status="completed",
        notes=payment_data.notes
    )
    db.add(payment)
    
    # Update fee status
    fee.status = FeeStatus.PAID
    
    await db.commit()
    await db.refresh(payment)
    
    return {
        "id": payment.id,
        "transaction_id": transaction_id,
        "amount": payment.amount,
        "payment_method": payment.payment_method,
        "payment_date": payment.payment_date,
        "status": "Payment successful"
    }


@router.put("/{fee_id}", response_model=dict)
async def update_fee(
    fee_id: int,
    fee_data: FeeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a fee."""
    result = await db.execute(select(Fee).where(Fee.id == fee_id))
    fee = result.scalar_one_or_none()
    
    if not fee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee not found"
        )
    
    update_data = fee_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(fee, field, value)
    
    await db.commit()
    await db.refresh(fee)
    
    return {
        "id": fee.id,
        "fee_type": fee.fee_type,
        "amount": fee.amount,
        "status": fee.status.value,
        "message": "Fee updated successfully"
    }


@router.post("/bulk-create", response_model=dict)
async def bulk_create_fees(
    course_id: str = Form(...),  # Now receives course name directly
    fee_type: str = Form(...),
    amount: float = Form(...),
    due_date: str = Form(...),
    academic_year: str = Form(...),
    semester: int = Form(...),
    description: str = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create fees for all students in a course."""
    # Parse date
    try:
        due_date_obj = datetime.strptime(due_date, "%Y-%m-%d")
    except ValueError:
        due_date_obj = datetime.strptime(due_date, "%Y-%m-%dT%H:%M:%S")
    
    # Use course name directly (frontend now sends course name)
    course_name = course_id
    
    # Get all students in that course by course name
    students_result = await db.execute(
        select(Student).where(Student.course == course_name)
    )
    students = students_result.scalars().all()
    
    created_count = 0
    for student in students:
        # Check if fee already exists
        existing = await db.execute(
            select(Fee).where(
                and_(
                    Fee.student_id == student.id,
                    Fee.academic_year == academic_year,
                    Fee.semester == semester,
                    Fee.fee_type == fee_type
                )
            )
        )
        if not existing.scalar_one_or_none():
            fee = Fee(
                student_id=student.id,
                course=course_name,  # Store course name directly
                fee_type=fee_type,
                amount=amount,
                due_date=due_date_obj,
                description=description,
                academic_year=academic_year,
                semester=semester,
                status=FeeStatus.PENDING
            )
            db.add(fee)
            created_count += 1
    
    await db.commit()
    
    return {
        "message": f"Fees created for {created_count} students",
        "created_count": created_count
    }


@router.get("/export")
async def export_fees_report(
    academic_year: str = None,
    course: str = None,  # Now uses course name directly
    status: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export fees report as CSV data."""
    query = select(Fee).join(Student)
    
    if academic_year:
        query = query.where(Fee.academic_year == academic_year)
    if course:
        query = query.where(Fee.course == course)  # Filter by Fee.course
    if status:
        query = query.where(Fee.status == status)
    
    result = await db.execute(query)
    fees = result.scalars().all()
    
    # Build CSV data
    csv_lines = ["Student ID,Name,Fee Type,Amount,Status,Due Date,Academic Year,Semester"]
    for fee in fees:
        student_result = await db.execute(
            select(Student).where(Student.id == fee.student_id)
        )
        student = student_result.scalar_one_or_none()
        if student:
            csv_lines.append(
                f"{student.id},{student.name},{fee.fee_type},{fee.amount},{fee.status.value},{fee.due_date},{fee.academic_year},{fee.semester}"
            )
    
    return {
        "filename": f"fees_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
        "data": "\n".join(csv_lines)
    }


@router.get("/{fee_id}/receipt")
async def download_fee_receipt(
    fee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate and download fee receipt."""
    result = await db.execute(select(Fee).where(Fee.id == fee_id))
    fee = result.scalar_one_or_none()
    
    if not fee:
        raise HTTPException(status_code=404, detail="Fee not found")
    
    # Get student details
    student_result = await db.execute(
        select(Student).where(Student.id == fee.student_id)
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    receipt_data = {
        "receipt_id": f"RCP-{fee.id:06d}",
        "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "student": {
            "id": student.id,
            "name": student.name,
            "email": student.email,
            "phone": student.phone
        },
        "fee": {
            "id": fee.id,
            "type": fee.fee_type,
            "amount": fee.amount,
            "status": fee.status.value,
            "due_date": fee.due_date.strftime("%Y-%m-%d") if fee.due_date else None,
            "academic_year": fee.academic_year,
            "semester": fee.semester
        },
        "payment": {
            "method": fee.payment_method,
            "transaction_id": fee.transaction_id,
            "paid_date": fee.paid_date.strftime("%Y-%m-%d") if fee.paid_date else None
        } if fee.payment_method else None
    }
    
    return receipt_data
