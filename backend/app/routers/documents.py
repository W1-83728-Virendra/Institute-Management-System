from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
from datetime import datetime
import os
import uuid
import zipfile
import io

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Student, Document, DocumentStatus, DocumentRequest, DocumentAuditLog, DocumentType, UserRole
from app.schemas.schemas import DocumentCreate, DocumentUpdate, DocumentResponse, DocumentRequestCreate, DocumentRequestResponse, BulkDocumentRequestCreate, DocumentTypeCreate, DocumentTypeUpdate, DocumentTypeResponse
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
    student_id: Optional[int] = None,
    status: Optional[str] = None,
    document_type: Optional[str] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all documents with pagination and filters."""
    query = select(Document).join(Student)
    
    # Apply filters
    if student_id:
        query = query.where(Document.student_id == student_id)
    if status:
        query = query.where(Document.status == status)
    if document_type:
        query = query.where(Document.document_type == document_type)
    if category:
        query = query.where(Document.category == category)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Document.issued_date.desc())
    
    result = await db.execute(query)
    documents = result.scalars().all()
    
    # Build response items
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
    """Get list of all document types from database."""
    # Try to fetch from database
    result = await db.execute(
        select(DocumentType).where(DocumentType.is_active == True).order_by(DocumentType.display_order, DocumentType.label)
    )
    document_types_db = result.scalars().all()
    
    if document_types_db:
        # Return from database
        document_types = [
            {
                "value": dt.value,
                "label": dt.label,
                "category": dt.category,
                "is_required": dt.is_required,
                "id": dt.id
            }
            for dt in document_types_db
        ]
    else:
        # Fallback to hardcoded if database is empty
        document_types = [
            {"value": "10th_marksheet", "label": "10th Marksheet", "category": "academic", "is_required": False},
            {"value": "12th_marksheet", "label": "12th Marksheet", "category": "academic", "is_required": False},
            {"value": "semester_marksheet", "label": "Semester Marksheet", "category": "academic", "is_required": False},
            {"value": "id_proof", "label": "ID Proof (Aadhar/PAN)", "category": "id_proof", "is_required": False},
            {"value": "photo", "label": "Passport Photo", "category": "id_proof", "is_required": False},
            {"value": "transfer_certificate", "label": "Transfer Certificate", "category": "certificate", "is_required": False},
            {"value": "leaving_certificate", "label": "Leaving Certificate", "category": "certificate", "is_required": False},
            {"value": "character_certificate", "label": "Character Certificate", "category": "certificate", "is_required": False},
            {"value": "bonafide_certificate", "label": "Bonafide Certificate", "category": "certificate", "is_required": False},
            {"value": "income_certificate", "label": "Income Certificate", "category": "certificate", "is_required": False},
            {"value": "caste_certificate", "label": "Caste Certificate", "category": "certificate", "is_required": False},
            {"value": "domicile_certificate", "label": "Domicile Certificate", "category": "certificate", "is_required": False},
            {"value": "library_card", "label": "Library Card", "category": "other", "is_required": False},
            {"value": "other", "label": "Other Document", "category": "other", "is_required": False}
        ]
    
    return {"document_types": document_types}


# Document Type Management Endpoints (Admin only)
@router.post("/types", response_model=DocumentTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_document_type(
    document_type: DocumentTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new document type (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    # Check if value already exists
    result = await db.execute(
        select(DocumentType).where(DocumentType.value == document_type.value)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Document type with this value already exists")
    
    new_doc_type = DocumentType(**document_type.model_dump())
    db.add(new_doc_type)
    await db.commit()
    await db.refresh(new_doc_type)
    
    return new_doc_type


@router.put("/types/{type_id}", response_model=DocumentTypeResponse)
async def update_document_type(
    type_id: int,
    document_type: DocumentTypeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a document type (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    result = await db.execute(select(DocumentType).where(DocumentType.id == type_id))
    db_type = result.scalar_one_or_none()
    
    if not db_type:
        raise HTTPException(status_code=404, detail="Document type not found")
    
    # Update fields
    update_data = document_type.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_type, field, value)
    
    await db.commit()
    await db.refresh(db_type)
    
    return db_type


@router.delete("/types/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document_type(
    type_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a document type (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    result = await db.execute(select(DocumentType).where(DocumentType.id == type_id))
    db_type = result.scalar_one_or_none()
    
    if not db_type:
        raise HTTPException(status_code=404, detail="Document type not found")
    
    await db.delete(db_type)
    await db.commit()
    
    return None


@router.get("/types/all", response_model=dict)
async def get_all_document_types_for_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all document types including inactive ones (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    
    result = await db.execute(
        select(DocumentType).order_by(DocumentType.display_order, DocumentType.label)
    )
    document_types = result.scalars().all()
    
    return {
        "document_types": [
            {
                "id": dt.id,
                "value": dt.value,
                "label": dt.label,
                "category": dt.category,
                "description": dt.description,
                "is_required": dt.is_required,
                "is_active": dt.is_active,
                "display_order": dt.display_order,
                "created_at": dt.created_at
            }
            for dt in document_types
        ]
    }


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
    
    # Build response with student info
    request_list = []
    for req in requests:
        req_dict = {
            "id": req.id,
            "student_id": req.student_id,
            "document_type": req.document_type,
            "description": req.description,
            "due_date": req.due_date.isoformat() if req.due_date else None,
            "status": req.status,
            "created_at": req.created_at.isoformat()
        }
        
        # Add student info for admin
        if current_user.role == "admin":
            student_result = await db.execute(
                select(Student).where(Student.id == req.student_id)
            )
            student = student_result.scalar_one_or_none()
            if student:
                req_dict["student_name"] = f"{student.first_name} {student.last_name}"
                req_dict["admission_no"] = student.admission_no
        
        request_list.append(req_dict)
    
    return {
        "requests": request_list,
        "total": len(request_list)
    }


@router.post("/requests", status_code=status.HTTP_201_CREATED, response_model=dict)
async def create_document_request(
    request_data: DocumentRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin creates a document request for a student."""
    # Check if student exists
    student_result = await db.execute(select(Student).where(Student.id == request_data.student_id))
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Create document request
    doc_request = DocumentRequest(
        student_id=request_data.student_id,
        document_type=request_data.document_type,
        description=request_data.description,
        due_date=request_data.due_date,
        created_by=current_user.id,
        status="pending"
    )
    db.add(doc_request)
    await db.commit()
    await db.refresh(doc_request)
    
    # Send email notification to student
    try:
        user_result = await db.execute(select(User).where(User.id == student.user_id))
        user = user_result.scalar_one_or_none()
        
        if user:
            send_document_request_email(
                user.email, 
                f"{student.first_name} {student.last_name}", 
                doc_request.document_type,
                doc_request.due_date.strftime("%Y-%m-%d") if doc_request.due_date else "",
                doc_request.description or ""
            )
    except Exception as e:
        print(f"Failed to send email: {e}")
    
    return {
        "id": doc_request.id,
        "student_id": doc_request.student_id,
        "document_type": doc_request.document_type,
        "description": doc_request.description,
        "due_date": doc_request.due_date.isoformat() if doc_request.due_date else None,
        "status": doc_request.status,
        "message": "Document request created successfully"
    }


@router.put("/requests/{request_id}/cancel", response_model=dict)
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


@router.post("/requests/bulk", status_code=status.HTTP_201_CREATED, response_model=dict)
async def create_bulk_document_requests(
    request_data: BulkDocumentRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin creates multiple document requests for a student at once."""
    # Check if student exists
    student_result = await db.execute(select(Student).where(Student.id == request_data.student_id))
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    created_requests = []
    
    for document_type in request_data.document_types:
        # Create document request
        doc_request = DocumentRequest(
            student_id=request_data.student_id,
            document_type=document_type,
            description=request_data.description,
            due_date=request_data.due_date,
            created_by=current_user.id,
            status="pending"
        )
        db.add(doc_request)
        created_requests.append({
            "document_type": document_type,
            "id": None  # Will be set after commit
        })
    
    await db.commit()
    
    # Refresh to get IDs and send emails
    for i, req in enumerate(created_requests):
        # Get the recently added request
        result = await db.execute(
            select(DocumentRequest).where(
                and_(
                    DocumentRequest.student_id == request_data.student_id,
                    DocumentRequest.document_type == req["document_type"]
                )
            ).order_by(DocumentRequest.created_at.desc())
        )
        doc_req = result.scalars().first()
        if doc_req:
            req["id"] = doc_req.id
    
    # Send email notification to student
    try:
        user_result = await db.execute(select(User).where(User.id == student.user_id))
        user = user_result.scalar_one_or_none()
        
        if user:
            # Send one email with all document types
            doc_types_str = ", ".join(request_data.document_types)
            send_document_request_email(
                user.email, 
                f"{student.first_name} {student.last_name}", 
                doc_types_str,
                request_data.due_date.strftime("%Y-%m-%d") if request_data.due_date else "",
                request_data.description or ""
            )
    except Exception as e:
        print(f"Failed to send email: {e}")
    
    return {
        "message": f"Created {len(created_requests)} document requests successfully",
        "requests": created_requests,
        "created_count": len(created_requests)
    }


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
            # Case-insensitive comparison with flexible matching
            req_type = req.document_type.lower().replace('_', ' ').strip()
            
            # Check if types match (exact match or partial match)
            if (req_type == search_type or 
                search_type in req_type or 
                req_type in search_type or
                req.document_type.lower() == document_type.lower()):
                req.status = "submitted"
    except Exception as e:
        print(f"Error resolving request: {e}")
        
    await db.commit()
    await db.refresh(document)
    
    return {
        "id": document.id,
        "message": "Document uploaded successfully"
    }


# Student-specific endpoints
@router.get("/my-documents")
async def get_my_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get documents for the current student user."""
    result = await db.execute(
        select(Student).where(Student.user_id == current_user.id)
    )
    student = result.scalar_one_or_none()
    
    if not student:
        return {"documents": [], "message": "No student profile found"}
    
    docs_result = await db.execute(
        select(Document).where(Document.student_id == student.id)
    )
    documents = docs_result.scalars().all()
    
    return {
        "documents": [
            {
                "id": doc.id,
                "document_type": doc.document_type,
                "file_name": doc.file_name,
                "status": doc.status.value if doc.status else None,
                "issued_date": doc.issued_date.isoformat() if doc.issued_date else None,
                "verified_date": doc.verified_date.isoformat() if doc.verified_date else None,
                "is_college_issued": doc.is_college_issued
            }
            for doc in documents
        ]
    }


@router.post("/upload")
async def upload_my_document(
    document_type: str = Form(...),
    file: UploadFile = File(...),
    document_id: Optional[int] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a document for the current student user. If document_id is provided, update existing."""
    # Get student profile
    result = await db.execute(
        select(Student).where(Student.user_id == current_user.id)
    )
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(status_code=404, detail="No student profile found")
    
    # Save file
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'pdf'
    unique_filename = f"{student.admission_no}_{document_type}_{uuid.uuid4().hex[:8]}.{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    document = None
    if document_id:
        # Update existing document
        doc_result = await db.execute(
            select(Document).where(and_(Document.id == document_id, Document.student_id == student.id))
        )
        document = doc_result.scalar_one_or_none()
        
        if document:
            # Delete old file
            if document.file_path and os.path.exists(document.file_path):
                try:
                    os.remove(document.file_path)
                except:
                    pass
            
            # Update record
            document.document_type = document_type
            document.file_name = file.filename
            document.file_path = file_path
            document.status = DocumentStatus.PENDING
            document.issued_date = datetime.now()
            document.verified_date = None
            document.notes = None  # Clear rejection notes

    if not document:
        # Create document record
        document = Document(
            student_id=student.id,
            document_type=document_type,
            file_name=file.filename,
            file_path=file_path,
            status=DocumentStatus.PENDING,
            issued_date=datetime.now()
        )
        db.add(document)
    
    # Auto-resolve matching pending requests
    try:
        # Match case-insensitively and handle spaces/underscores
        search_type = document_type.lower().replace('_', ' ').strip()
        
        request_query = select(DocumentRequest).where(
            and_(
                DocumentRequest.student_id == student.id,
                DocumentRequest.status == "pending"
            )
        )
        request_result = await db.execute(request_query)
        pending_requests = request_result.scalars().all()
        
        for req in pending_requests:
            # Case-insensitive comparison with flexible matching
            req_type = req.document_type.lower().replace('_', ' ').strip()
            
            # Check if types match (exact match or partial match)
            if (req_type == search_type or 
                search_type in req_type or 
                req_type in search_type or
                req.document_type.lower() == document_type.lower()):
                req.status = "submitted"
    except Exception as e:
        print(f"Error resolving request: {e}")

    await db.commit()
    await db.refresh(document)
    
    return {
        "id": document.id,
        "document_type": document.document_type,
        "file_name": document.file_name,
        "status": document.status.value,
        "message": "Document uploaded successfully. Pending verification."
    }


@router.post("/upload-multiple")
async def upload_multiple_documents(
    document_type: str = Form(...),
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload multiple documents for the current student user."""
    # Get student profile
    result = await db.execute(
        select(Student).where(Student.user_id == current_user.id)
    )
    student = result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(status_code=404, detail="No student profile found")
    
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No files provided")
    
    created_documents = []
    
    for file in files:
        # Save file
        file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'pdf'
        unique_filename = f"{student.admission_no}_{document_type}_{uuid.uuid4().hex[:8]}.{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        # Create document record
        document = Document(
            student_id=student.id,
            document_type=document_type,
            file_name=file.filename,
            file_path=file_path,
            status=DocumentStatus.PENDING,
            issued_date=datetime.now()
        )
        db.add(document)
        created_documents.append(document)
    
    # Auto-resolve matching pending requests
    try:
        search_type = document_type.lower().replace('_', ' ').strip()
        
        request_query = select(DocumentRequest).where(
            and_(
                DocumentRequest.student_id == student.id,
                DocumentRequest.status == "pending"
            )
        )
        request_result = await db.execute(request_query)
        pending_requests = request_result.scalars().all()
        
        for req in pending_requests:
            # Case-insensitive comparison with flexible matching
            req_type = req.document_type.lower().replace('_', ' ').strip()
            
            # Check if types match (exact match or partial match)
            if (req_type == search_type or 
                search_type in req_type or 
                req_type in search_type or
                req.document_type.lower() == document_type.lower()):
                req.status = "submitted"
    except Exception as e:
        print(f"Error resolving request: {e}")

    await db.commit()
    
    # Refresh documents to get IDs
    for doc in created_documents:
        await db.refresh(doc)
    
    return {
        "message": f"{len(created_documents)} documents uploaded successfully. Pending verification.",
        "created_count": len(created_documents),
        "documents": [
            {
                "id": doc.id,
                "document_type": doc.document_type,
                "file_name": doc.file_name,
                "status": doc.status.value
            }
            for doc in created_documents
        ]
    }


@router.get("/my-stats")
async def get_my_document_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get document stats for the current student."""
    result = await db.execute(
        select(Student).where(Student.user_id == current_user.id)
    )
    student = result.scalar_one_or_none()
    
    if not student:
        return {
            "total": 0,
            "verified": 0,
            "pending": 0,
            "rejected": 0,
            "requests_pending": 0
        }
    
    docs_result = await db.execute(
        select(Document).where(Document.student_id == student.id)
    )
    documents = docs_result.scalars().all()
    
    # Get pending requests
    requests_result = await db.execute(
        select(func.count(DocumentRequest.id)).where(
            and_(DocumentRequest.student_id == student.id, DocumentRequest.status == "pending")
        )
    )
    requests_pending = requests_result.scalar() or 0
    
    return {
        "total": len(documents),
        "verified": sum(1 for doc in documents if doc.status.value == "verified"),
        "pending": sum(1 for doc in documents if doc.status.value == "pending"),
        "rejected": sum(1 for doc in documents if doc.status.value == "rejected"),
        "requests_pending": requests_pending
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
    start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
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


@router.get("/student/{student_id}/download-all")
async def download_all_student_documents(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download all documents for a student as a ZIP file."""
    # Get student
    student_result = await db.execute(select(Student).where(Student.id == student_id))
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Get all documents for student
    result = await db.execute(
        select(Document).where(Document.student_id == student_id)
    )
    documents = result.scalars().all()
    
    if not documents:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No documents found for this student"
        )
    
    # Create ZIP file in memory
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for doc in documents:
            if os.path.exists(doc.file_path):
                # Add file to zip with meaningful name
                file_name = f"{doc.document_type}_{doc.file_name}"
                zip_file.write(doc.file_path, file_name)
    
    zip_buffer.seek(0)
    
    # Return ZIP file
    return StreamingResponse(
        iter([zip_buffer.getvalue()]),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename={student.admission_no}_documents.zip"
        }
    )


@router.post("/bulk-upload", status_code=status.HTTP_201_CREATED, response_model=dict)
async def bulk_upload_documents(
    student_ids: str = Form(...),  # Comma-separated IDs
    document_type: str = Form(...),
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Bulk upload documents for multiple students."""
    student_id_list = [int(sid.strip()) for sid in student_ids.split(",")]
    
    created_count = 0
    for i, student_id in enumerate(student_id_list):
        if i >= len(files):
            break
            
        # Validate student
        student_result = await db.execute(select(Student).where(Student.id == student_id))
        student = student_result.scalar_one_or_none()
        if not student:
            continue
        
        # Save file
        file = files[i]
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
            file_name=file.filename,
            file_path=file_path,
            file_size=len(content),
            status=DocumentStatus.PENDING,
            issued_date=datetime.now(),
            is_college_issued=True
        )
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
                # Case-insensitive comparison with flexible matching
                req_type = req.document_type.lower().replace('_', ' ').strip()
                
                # Check if types match (exact match or partial match)
                if (req_type == search_type or 
                    search_type in req_type or 
                    req_type in search_type or
                    req.document_type.lower() == document_type.lower()):
                    req.status = "submitted"
        except Exception as e:
            print(f"Error resolving request during bulk upload: {e}")
            
        created_count += 1
    
    await db.commit()
    
    return {
        "message": f"Documents uploaded for {created_count} students",
        "created_count": created_count
    }


@router.get("/{document_id}", response_model=dict)
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific document by ID."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
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
            "admission_no": student.admission_no,
            "course": student.course
        } if student else None,
        "document_type": document.document_type,
        "file_name": document.file_name,
        "file_path": document.file_path,
        "file_size": document.file_size,
        "status": document.status.value,
        "issued_date": document.issued_date,
        "verified_date": document.verified_date,
        "notes": document.notes
    }


@router.put("/{document_id}/verify", response_model=dict)
async def verify_document(
    document_id: int,
    notes: str = None,
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
    document.verified_date = datetime.utcnow()
    if notes:
        document.notes = notes
    
    await db.commit()
    
    # Log audit trail
    await log_audit(db, document.id, current_user.id, "verify")
    
    # Send email notification to student
    try:
        # Get student email
        student_result = await db.execute(select(Student).where(Student.id == document.student_id))
        student = student_result.scalar_one_or_none()
        user_result = await db.execute(select(User).where(User.id == student.user_id))
        user = user_result.scalar_one_or_none()
        
        if user and student:
            send_document_verified_email(
                user.email, 
                f"{student.first_name} {student.last_name}", 
                document.document_type
            )
    except Exception as e:
        print(f"Failed to send email: {e}")
    
    return {
        "id": document.id,
        "status": document.status.value,
        "verified_date": document.verified_date,
        "message": "Document verified successfully"
    }


@router.put("/{document_id}/reject", response_model=dict)
async def reject_document(
    document_id: int,
    notes: str = None,
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
        document.notes = notes
    
    await db.commit()
    
    # Log audit trail
    await log_audit(db, document.id, current_user.id, "reject")
    
    # Send email notification to student
    try:
        student_result = await db.execute(select(Student).where(Student.id == document.student_id))
        student = student_result.scalar_one_or_none()
        user_result = await db.execute(select(User).where(User.id == student.user_id))
        user = user_result.scalar_one_or_none()
        
        if user and student:
            send_document_rejected_email(
                user.email, 
                f"{student.first_name} {student.last_name}", 
                document.document_type,
                notes or ""
            )
    except Exception as e:
        print(f"Failed to send email: {e}")
    
    return {
        "id": document.id,
        "status": document.status.value,
        "message": "Document rejected"
    }


@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download a document file."""
    # Get document
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check permission - admin can download any, students can only download their own
    if current_user.role == "student":
        # Get student's own document
        student_result = await db.execute(
            select(Student).where(Student.user_id == current_user.id)
        )
        student = student_result.scalar_one_or_none()
        if not student or document.student_id != student.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to download this document"
            )
    
    # Check if file exists
    if not os.path.exists(document.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on server"
        )
    
    return FileResponse(
        path=document.file_path,
        filename=document.file_name,
        media_type="application/octet-stream"
    )


@router.get("/{document_id}/history")
async def get_document_history(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get audit trail for a specific document."""
    query = select(DocumentAuditLog).where(DocumentAuditLog.document_id == document_id).order_by(DocumentAuditLog.created_at.desc())
    result = await db.execute(query)
    logs = result.scalars().all()
    
    history = []
    for log in logs:
        user_result = await db.execute(select(User).where(User.id == log.user_id))
        user = user_result.scalar_one_or_none()
        
        history.append({
            "id": log.id,
            "action": log.action,
            "user": user.email if user else "Unknown",
            "timestamp": log.created_at,
            "ip_address": log.ip_address
        })
    
    return {"history": history}


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
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
    
    # Permission check: Students can only delete their own documents
    if current_user.role == "student":
        student_result = await db.execute(select(Student).where(Student.user_id == current_user.id))
        student = student_result.scalar_one_or_none()
        if not student or document.student_id != student.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this document"
            )

    # Delete file if exists
    if document.file_path and os.path.exists(document.file_path):
        try:
            os.remove(document.file_path)
        except Exception as e:
            print(f"Error deleting file: {e}")
    
    db.delete(document)
    await db.commit()
    
    return None
