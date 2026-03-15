from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import Optional
from datetime import datetime, timedelta
import os
import uuid
import zipfile
import io

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Student, Document, DocumentStatus, DocumentRequest, DocumentAuditLog
from app.schemas.schemas import DocumentCreate, DocumentUpdate, DocumentResponse, DocumentRequestCreate, DocumentRequestResponse
from app.core.email_utils import send_document_verified_email, send_document_rejected_email, send_document_request_email

router = APIRouter(prefix="/documents", tags=["Documents"])

# Configure upload directory
UPLOAD_DIR = "uploads/documents"
os.makedirs(UPLOAD_DIR, exist_ok=True)


async def log_audit(db: AsyncSession, document_id: int, user_id: int, action: str):
    """Helper function to log document audit trail."""
    audit_log = DocumentAuditLog(
        document_id=document_id,
        user_id=user_id,
        action=action
    )
    db.add(audit_log)
    await db.commit()


@router.get("", response_model=dict)
async def get_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    # Basic filters
    student_id: Optional[int] = None,
    status: Optional[str] = None,
    document_type: Optional[str] = None,
    category: Optional[str] = None,
    # Advanced filters - search by student name or admission number
    search: Optional[str] = None,
    # Date range filters for filtering by issued_date
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    # Sorting options - sort_by field and sort_order direction
    sort_by: Optional[str] = Query(None, regex='^(issued_date|student_name|status|document_type)$'),
    sort_order: Optional[str] = Query('desc', regex='^(asc|desc)$'),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all documents with pagination and advanced filters.
    
    Filter Parameters:
    - search: Search by student name or admission number
    - status: Filter by document status (pending, verified, rejected)
    - document_type: Filter by document type
    - category: Filter by category
    - date_from: Filter documents issued from this date
    - date_to: Filter documents issued until this date
    
    Sort Parameters:
    - sort_by: Field to sort by (issued_date, student_name, status, document_type)
    - sort_order: Sort direction (asc or desc)
    """
    # Start with base query joining Document with Student
    query = select(Document).join(Student)
    
    # Search by student name or admission number
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                Student.first_name.ilike(search_pattern),
                Student.last_name.ilike(search_pattern),
                Student.admission_no.ilike(search_pattern)
            )
        )
    
    # Apply basic filters
    if student_id:
        query = query.where(Document.student_id == student_id)
    if status:
        query = query.where(Document.status == status)
    if document_type:
        query = query.where(Document.document_type.ilike(document_type))
    if category:
        query = query.where(Document.category == category)
    
    # Date range filter
    if date_from:
        try:
            from_date = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            query = query.where(Document.issued_date >= from_date)
        except ValueError:
            pass
    
    if date_to:
        try:
            to_date = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            to_date = to_date + timedelta(days=1)
            query = query.where(Document.issued_date < to_date)
        except ValueError:
            pass
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Sorting
    if sort_by:
        if sort_by == 'student_name':
            sort_column = Student.first_name
        elif sort_by == 'status':
            sort_column = Document.status
        elif sort_by == 'document_type':
            sort_column = Document.document_type
        else:
            sort_column = Document.issued_date
        
        if sort_order == 'asc':
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(Document.issued_date.desc())
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    # Execute query
    result = await db.execute(query)
    documents = result.scalars().all()
    
    # Build response
    items = []
    for doc in documents:
        student_result = await db.execute(
            select(Student).where(Student.id == doc.student_id)
        )
        student = student_result.scalar_one_or_none()
        
        items.append({
            "id": doc.id,
            "student": {
                "id": student.id,
                "name": f"{student.first_name} {student.last_name}",
                "admission_no": student.admission_no
            } if student else None,
            "document_type": doc.document_type,
            "file_name": doc.file_name,
            "status": doc.status.value,
            "category": doc.category,
            "issued_date": doc.issued_date,
            "verified_date": doc.verified_date
        })
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "items": items
    }


@router.get("/types")
async def get_document_types(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get list of all document types."""
    document_types = [
        {"value": "10th_marksheet", "label": "10th Marksheet"},
        {"value": "12th_marksheet", "label": "12th Marksheet"},
        {"value": "semester_marksheet", "label": "Semester Marksheet"},
        {"value": "id_proof", "label": "ID Proof (Aadhar/PAN)"},
        {"value": "photo", "label": "Passport Photo"},
        {"value": "transfer_certificate", "label": "Transfer Certificate"},
        {"value": "leaving_certificate", "label": "Leaving Certificate"},
        {"value": "character_certificate", "label": "Character Certificate"},
        {"value": "bonafide_certificate", "label": "Bonafide Certificate"},
        {"value": "income_certificate", "label": "Income Certificate"},
        {"value": "caste_certificate", "label": "Caste Certificate"},
        {"value": "domicile_certificate", "label": "Domicile Certificate"},
        {"value": "library_card", "label": "Library Card"},
        {"value": "other", "label": "Other Document"}
    ]
    
    return {"document_types": document_types}


# Document Request Endpoints - MUST come BEFORE /{document_id} route
@router.get("/requests", response_model=dict)
async def get_document_requests(
    student_id: int = None,
    status: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get document requests - admin sees all, student sees their own."""
    # Base query
    query = select(DocumentRequest)
    
    # Students can only see their own requests
    if current_user.role == "student":
        student_result = await db.execute(
            select(Student).where(Student.user_id == current_user.id)
        )
        student = student_result.scalar_one_or_none()
        if student:
            query = query.where(DocumentRequest.student_id == student.id)
        else:
            return {"requests": [], "total": 0}
    elif student_id:
        query = query.where(DocumentRequest.student_id == student_id)
    
    if status:
        query = query.where(DocumentRequest.status == status)
    
    query = query.order_by(DocumentRequest.created_at.desc())
    result = await db.execute(query)
    requests = result.scalars().all()
    
    # Get total count
    count_result = await db.execute(select(func.count(DocumentRequest.id)))
    total = count_result.scalar() or 0
    
    return {"requests": requests, "total": total}


@router.post("/requests", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_document_request(
    request_data: DocumentRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a document request - admin can request documents from students."""
    # Verify student exists
    student_result = await db.execute(
        select(Student).where(Student.id == request_data.student_id)
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Create request
    doc_request = DocumentRequest(
        student_id=request_data.student_id,
        document_type=request_data.document_type,
        description=request_data.description,
        due_date=request_data.due_date,
        status="pending",
        created_by=current_user.id
    )
    
    db.add(doc_request)
    await db.commit()
    await db.refresh(doc_request)
    
    # Send email notification to student
    user_result = await db.execute(
        select(User).where(User.id == student.user_id)
    )
    user = user_result.scalar_one_or_none()
    
    if user:
        send_document_request_email(
            user.email,
            f"{student.first_name} {student.last_name}",
            request_data.document_type,
            request_data.due_date.isoformat() if request_data.due_date else "",
            request_data.description or ""
        )
    
    return {
        "id": doc_request.id,
        "message": "Document request created successfully"
    }


@router.put("/requests/{request_id}/cancel")
async def cancel_document_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancel a document request."""
    result = await db.execute(select(DocumentRequest).where(DocumentRequest.id == request_id))
    doc_request = result.scalar_one_or_none()
    
    if not doc_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document request not found"
        )
    
    doc_request.status = "cancelled"
    await db.commit()
    
    return {"message": "Document request cancelled"}


@router.post("", status_code=status.HTTP_201_CREATED, response_model=dict)
async def upload_document(
    student_id: int = Form(...),
    document_type: str = Form(...),
    category: str = Form("other"),
    description: Optional[str] = Form(None),
    due_date: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin uploads a document for a student."""
    # Validate student
    student_result = await db.execute(select(Student).where(Student.id == student_id))
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Save file
    file_extension = file.filename.split(".")[-1] if "." in file.filename else "pdf"
    unique_filename = f"{student.admission_no}_{document_type}_{uuid.uuid4().hex[:8]}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Create document
    document = Document(
        student_id=student_id,
        document_type=document_type,
        category=category,
        file_name=file.filename,
        file_path=file_path,
        file_size=len(content),
        status=DocumentStatus.VERIFIED if current_user.role == "admin" else DocumentStatus.PENDING,
        issued_date=datetime.now(),
        notes=description,
        is_college_issued=True
    )
    
    if due_date:
        try:
            document.expiry_date = datetime.fromisoformat(due_date)
        except:
            pass
            
    db.add(document)
    
    # Auto-resolve matching pending requests
    try:
        search_type = document_type.lower().replace('_', ' ').strip()
        request_query = select(DocumentRequest).where(
            and_(
                DocumentRequest.student_id == student_id,
                DocumentRequest.status == "pending"
            )
        )
        request_result = await db.execute(request_query)
        pending_requests = request_result.scalars().all()
        
        for req in pending_requests:
            req_type = req.document_type.lower().replace('_', ' ').strip()
            if req_type == search_type:
                req.status = "submitted"
    except Exception as e:
        print(f"Error resolving request: {e}")
        
    await db.commit()
    await db.refresh(document)
    
    return {
        "id": document.id,
        "message": "Document uploaded successfully"
    }


@router.get("/stats")
async def get_document_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get document statistics."""
    # Total documents
    total_result = await db.execute(select(func.count(Document.id)))
    total = total_result.scalar() or 0
    
    # Verified documents
    verified_result = await db.execute(
        select(func.count(Document.id)).where(Document.status == DocumentStatus.VERIFIED)
    )
    verified = verified_result.scalar() or 0
    
    # Pending documents
    pending_result = await db.execute(
        select(func.count(Document.id)).where(Document.status == DocumentStatus.PENDING)
    )
    pending = pending_result.scalar() or 0
    
    # Issued this month
    start_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    issued_result = await db.execute(
        select(func.count(Document.id)).where(Document.issued_date >= start_of_month)
    )
    issued_this_month = issued_result.scalar() or 0
    
    return {
        "total": total,
        "verified": verified,
        "pending": pending,
        "issued_this_month": issued_this_month
    }


@router.get("/my-documents")
async def get_my_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get documents for the current student user."""
    # Get student profile
    student_result = await db.execute(
        select(Student).where(Student.user_id == current_user.id)
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        return {"documents": [], "message": "No student profile found"}
    
    # Get documents
    docs_result = await db.execute(
        select(Document).where(Document.student_id == student.id)
    )
    documents = docs_result.scalars().all()
    
    return {
        "documents": [
            {
                "id": doc.id,
                "document_type": doc.document_type,
                "category": doc.category,
                "file_name": doc.file_name,
                "status": doc.status.value,
                "issued_date": doc.issued_date.isoformat() if doc.issued_date else None,
                "verified_date": doc.verified_date.isoformat() if doc.verified_date else None,
                "expiry_date": doc.expiry_date.isoformat() if doc.expiry_date else None,
                "is_required": doc.is_required,
                "notes": doc.notes
            }
            for doc in documents
        ]
    }


@router.get("/my-stats")
async def get_my_document_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get document statistics for current student."""
    # Get student profile
    student_result = await db.execute(
        select(Student).where(Student.user_id == current_user.id)
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        return {"total": 0, "verified": 0, "pending": 0}
    
    # Total documents
    total_result = await db.execute(
        select(func.count(Document.id)).where(Document.student_id == student.id)
    )
    total = total_result.scalar() or 0
    
    # Verified
    verified_result = await db.execute(
        select(func.count(Document.id)).where(
            and_(
                Document.student_id == student.id,
                Document.status == DocumentStatus.VERIFIED
            )
        )
    )
    verified = verified_result.scalar() or 0
    
    # Pending
    pending_result = await db.execute(
        select(func.count(Document.id)).where(
            and_(
                Document.student_id == student.id,
                Document.status == DocumentStatus.PENDING
            )
        )
    )
    pending = pending_result.scalar() or 0
    
    return {
        "total": total,
        "verified": verified,
        "pending": pending
    }


@router.put("/{document_id}/verify")
async def verify_document(
    document_id: int,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verify a document."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    document.status = DocumentStatus.VERIFIED
    document.verified_date = datetime.now()
    if notes:
        document.notes = (document.notes or "") + f"\nVerified: {notes}"
    
    await db.commit()
    
    # Log audit
    await log_audit(db, document.id, current_user.id, "verify")
    
    # Send email notification
    student_result = await db.execute(
        select(Student).where(Student.id == document.student_id)
    )
    student = student_result.scalar_one_or_none()
    
    if student:
        user_result = await db.execute(
            select(User).where(User.id == student.user_id)
        )
        user = user_result.scalar_one_or_none()
        
        if user:
            send_document_verified_email(
                user.email,
                f"{student.first_name} {student.last_name}",
                document.document_type
            )
    
    return {
        "id": document.id,
        "status": document.status.value,
        "message": "Document verified successfully"
    }


@router.put("/{document_id}/reject")
async def reject_document(
    document_id: int,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reject a document."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    document.status = DocumentStatus.REJECTED
    if notes:
        document.notes = (document.notes or "") + f"\nRejected: {notes}"
    
    await db.commit()
    
    # Log audit
    await log_audit(db, document.id, current_user.id, "reject")
    
    # Send email notification
    student_result = await db.execute(
        select(Student).where(Student.id == document.student_id)
    )
    student = student_result.scalar_one_or_none()
    
    if student:
        user_result = await db.execute(
            select(User).where(User.id == student.user_id)
        )
        user = user_result.scalar_one_or_none()
        
        if user:
            send_document_rejected_email(
                user.email,
                f"{student.first_name} {student.last_name}",
                document.document_type,
                notes or ""
            )
    
    return {
        "id": document.id,
        "status": document.status.value,
        "message": "Document rejected"
    }


@router.get("/{document_id}")
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific document."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Log audit
    await log_audit(db, document.id, current_user.id, "view")
    
    # Get student
    student_result = await db.execute(
        select(Student).where(Student.id == document.student_id)
    )
    student = student_result.scalar_one_or_none()
    
    return {
        "id": document.id,
        "student": {
            "id": student.id,
            "name": f"{student.first_name} {student.last_name}",
            "admission_no": student.admission_no
        } if student else None,
        "document_type": document.document_type,
        "category": document.category,
        "file_name": document.file_name,
        "file_path": document.file_path,
        "file_size": document.file_size,
        "status": document.status.value,
        "issued_date": document.issued_date,
        "verified_date": document.verified_date,
        "expiry_date": document.expiry_date,
        "is_required": document.is_required,
        "is_college_issued": document.is_college_issued,
        "notes": document.notes
    }


@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download a document."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Log audit
    await log_audit(db, document.id, current_user.id, "download")
    
    # Check if file exists
    if not os.path.exists(document.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on server"
        )
    
    return FileResponse(
        document.file_path,
        media_type="application/octet-stream",
        filename=document.file_name
    )


@router.put("/{document_id}")
async def update_document(
    document_id: int,
    document_data: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a document."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Update fields
    if document_data.status is not None:
        document.status = document_data.status
    if document_data.notes is not None:
        document.notes = document_data.notes
    if document_data.expiry_date is not None:
        document.expiry_date = document_data.expiry_date
    if document_data.is_required is not None:
        document.is_required = document_data.is_required
    if document_data.category is not None:
        document.category = document_data.category
    
    await db.commit()
    await db.refresh(document)
    
    return {
        "id": document.id,
        "document_type": document.document_type,
        "status": document.status.value,
        "message": "Document updated successfully"
    }


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a document."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Delete file if exists
    if document.file_path and os.path.exists(document.file_path):
        try:
            os.remove(document.file_path)
        except:
            pass
    
    # Log audit before deletion
    await log_audit(db, document.id, current_user.id, "delete")
    
    await db.delete(document)
    await db.commit()
    
    return {"message": "Document deleted successfully"}


@router.get("/{document_id}/history")
async def get_document_history(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get document audit history."""
    result = await db.execute(
        select(DocumentAuditLog)
        .where(DocumentAuditLog.document_id == document_id)
        .order_by(DocumentAuditLog.created_at.desc())
    )
    logs = result.scalars().all()
    
    history = []
    for log in logs:
        user_result = await db.execute(select(User).where(User.id == log.user_id))
        user = user_result.scalar_one_or_none()
        
        history.append({
            "id": log.id,
            "action": log.action,
            "user": user.email if user else "Unknown",
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat() if log.created_at else None
        })
    
    return {"history": history}


# Student-specific upload endpoint
@router.post("/upload")
async def upload_my_document(
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Student uploads their own document."""
    # Get student profile
    student_result = await db.execute(
        select(Student).where(Student.user_id == current_user.id)
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found"
        )
    
    # Save file
    file_extension = file.filename.split(".")[-1] if "." in file.filename else "pdf"
    unique_filename = f"{student.admission_no}_{document_type}_{uuid.uuid4().hex[:8]}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Create document
    document = Document(
        student_id=student.id,
        document_type=document_type,
        category="other",
        file_name=file.filename,
        file_path=file_path,
        file_size=len(content),
        status=DocumentStatus.PENDING,
        issued_date=datetime.now(),
        is_college_issued=False
    )
    
    db.add(document)
    await db.commit()
    await db.refresh(document)
    
    # Log audit
    await log_audit(db, document.id, current_user.id, "upload")
    
    return {
        "id": document.id,
        "message": "Document uploaded successfully"
    }


# Bulk upload endpoint
@router.post("/bulk-upload")
async def bulk_upload_documents(
    student_id: int = Form(...),
    document_type: str = Form(...),
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Bulk upload multiple documents for a student."""
    # Validate student
    student_result = await db.execute(select(Student).where(Student.id == student_id))
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    uploaded = []
    errors = []
    
    for file in files:
        try:
            # Save file
            file_extension = file.filename.split(".")[-1] if "." in file.filename else "pdf"
            unique_filename = f"{student.admission_no}_{document_type}_{uuid.uuid4().hex[:8]}.{file_extension}"
            file_path = os.path.join(UPLOAD_DIR, unique_filename)
            
            content = await file.read()
            with open(file_path, "wb") as f:
                f.write(content)
            
            # Create document
            document = Document(
                student_id=student_id,
                document_type=document_type,
                category="other",
                file_name=file.filename,
                file_path=file_path,
                file_size=len(content),
                status=DocumentStatus.VERIFIED if current_user.role == "admin" else DocumentStatus.PENDING,
                issued_date=datetime.now(),
                is_college_issued=True
            )
            
            db.add(document)
            uploaded.append(file.filename)
            
        except Exception as e:
            errors.append(f"{file.filename}: {str(e)}")
    
    await db.commit()
    
    return {
        "uploaded": uploaded,
        "errors": errors,
        "message": f"Uploaded {len(uploaded)} documents"
    }


# Download all documents for a student
@router.get("/student/{student_id}/download-all")
async def download_all_student_documents(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download all documents for a student as ZIP."""
    # Get student
    student_result = await db.execute(select(Student).where(Student.id == student_id))
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Get all documents
    docs_result = await db.execute(
        select(Document).where(Document.student_id == student_id)
    )
    documents = docs_result.scalars().all()
    
    if not documents:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No documents found for student"
        )
    
    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for doc in documents:
            if os.path.exists(doc.file_path):
                zip_file.write(doc.file_path, doc.file_name)
    
    zip_buffer.seek(0)
    
    # Log audit
    for doc in documents:
        await log_audit(db, doc.id, current_user.id, "download_all")
    
    return StreamingResponse(
        io.BytesIO(zip_buffer.read()),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename={student.admission_no}_documents.zip"
        }
    )
