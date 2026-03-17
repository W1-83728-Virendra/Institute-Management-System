from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from typing import Optional
import razorpay
import hashlib
import hmac
import os
import uuid
from pathlib import Path

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.models import User, Student, Fee, Payment, FeeStatus

router = APIRouter(prefix="/payments", tags=["Payments"])

# Initialize Razorpay client
razorpay_client = None
if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )


# Pydantic schemas
class PaymentOrderCreate(BaseModel):
    fee_id: int


class PaymentOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str


class PaymentVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    fee_id: int


class PaymentResponse(BaseModel):
    id: int
    fee_id: int
    amount: float
    status: str
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None


@router.post("/create-order", response_model=PaymentOrderResponse)
async def create_payment_order(
    payment_data: PaymentOrderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a Razorpay order for fee payment."""
    if not razorpay_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment gateway not configured"
        )
    
    # Get student for current user
    student_result = await db.execute(
        select(Student).where(Student.user_id == current_user.id)
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found"
        )
    
    # Get fee details
    fee_result = await db.execute(
        select(Fee).where(
            Fee.id == payment_data.fee_id,
            Fee.student_id == student.id
        )
    )
    fee = fee_result.scalar_one_or_none()
    
    if not fee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee record not found"
        )
    
    if fee.status == FeeStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fee is already paid"
        )
    
    # Convert amount to paise (Razorpay uses paise)
    amount_paise = int(fee.amount * 100)
    
    # Create Razorpay order
    try:
        razorpay_order = razorpay_client.order.create({
            'amount': amount_paise,
            'currency': 'INR',
            'payment_capture': 1,
            'notes': {
                'student_id': str(student.id),
                'fee_id': str(fee.id),
                'fee_type': fee.fee_type
            }
        })
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create payment order: {str(e)}"
        )
    
    # Create payment record
    payment = Payment(
        student_id=student.id,
        fee_id=fee.id,
        amount=fee.amount,
        razorpay_order_id=razorpay_order['id'],
        payment_method='Razorpay',
        status='pending'
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)
    
    return PaymentOrderResponse(
        order_id=razorpay_order['id'],
        amount=amount_paise,
        currency='INR',
        key_id=settings.RAZORPAY_KEY_ID
    )


@router.post("/verify")
async def verify_payment(
    payment_data: PaymentVerify,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Verify Razorpay payment signature."""
    if not razorpay_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment gateway not configured"
        )
    
    # Get student for current user
    student_result = await db.execute(
        select(Student).where(Student.user_id == current_user.id)
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found"
        )
    
    # Find payment record
    payment_result = await db.execute(
        select(Payment).where(
            Payment.razorpay_order_id == payment_data.razorpay_order_id,
            Payment.student_id == student.id
        )
    )
    payment = payment_result.scalar_one_or_none()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment record not found"
        )
    
    # Verify signature
    try:
        # Create signature verification
        payload = f"{payment_data.razorpay_order_id}|{payment_data.razorpay_payment_id}"
        expected_signature = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
        
        if expected_signature != payment_data.razorpay_signature:
            payment.status = 'failed'
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid payment signature"
            )
    except HTTPException:
        raise
    except Exception as e:
        payment.status = 'failed'
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment verification failed: {str(e)}"
        )
    
    # Update payment status
    payment.razorpay_payment_id = payment_data.razorpay_payment_id
    payment.razorpay_signature = payment_data.razorpay_signature
    payment.transaction_id = payment_data.razorpay_payment_id
    payment.status = 'completed'
    
    # Update fee status
    fee_result = await db.execute(
        select(Fee).where(Fee.id == payment_data.fee_id)
    )
    fee = fee_result.scalar_one_or_none()
    if fee:
        fee.status = FeeStatus.PAID
    
    await db.commit()
    await db.refresh(payment)
    
    return {
        "success": True,
        "message": "Payment verified successfully",
        "payment_id": payment.id,
        "fee_id": payment.fee_id
    }


@router.get("/fee/{fee_id}", response_model=PaymentResponse)
async def get_payment_by_fee(
    fee_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get payment details for a specific fee."""
    # Get student for current user
    student_result = await db.execute(
        select(Student).where(Student.user_id == current_user.id)
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found"
        )
    
    # Get payment
    payment_result = await db.execute(
        select(Payment).where(
            Payment.fee_id == fee_id,
            Payment.student_id == student.id
        )
    )
    payment = payment_result.scalar_one_or_none()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    return PaymentResponse(
        id=payment.id,
        fee_id=payment.fee_id,
        amount=payment.amount,
        status=payment.status,
        payment_method=payment.payment_method,
        transaction_id=payment.transaction_id,
        razorpay_payment_id=payment.razorpay_payment_id
    )


@router.get("/history")
async def get_payment_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get payment history for the current student."""
    # Get student for current user
    student_result = await db.execute(
        select(Student).where(Student.user_id == current_user.id)
    )
    student = student_result.scalar_one_or_none()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found"
        )
    
    # Get all payments
    payments_result = await db.execute(
        select(Payment)
        .where(Payment.student_id == student.id)
        .order_by(Payment.payment_date.desc())
    )
    payments = payments_result.scalars().all()
    
    return [
        PaymentResponse(
            id=p.id,
            fee_id=p.fee_id,
            amount=p.amount,
            status=p.status,
            payment_method=p.payment_method,
            transaction_id=p.transaction_id,
            razorpay_payment_id=p.razorpay_payment_id
        )
        for p in payments
    ]


# Receipt upload directory
RECEIPTS_DIR = Path("backend/uploads/receipts")
RECEIPTS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@router.post("/{payment_id}/upload-receipt")
async def upload_receipt(
    payment_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload a receipt for a payment (admin only)."""
    # Check if user is admin
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can upload receipts"
        )
    
    # Validate file
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided"
        )
    
    if not allowed_file(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF, PNG, JPG, and JPEG files are allowed"
        )
    
    # Get payment
    payment_result = await db.execute(
        select(Payment).where(Payment.id == payment_id)
    )
    payment = payment_result.scalar_one_or_none()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Generate unique filename
    file_ext = file.filename.rsplit(".", 1)[1].lower()
    unique_filename = f"receipt_{payment_id}_{uuid.uuid4().hex}.{file_ext}"
    file_path = RECEIPTS_DIR / unique_filename
    
    # Save file
    content = await file.read()
    await file.seek(0)
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Update payment record
    payment.receipt_url = f"/uploads/receipts/{unique_filename}"
    payment.receipt_filename = file.filename
    
    await db.commit()
    await db.refresh(payment)
    
    return {
        "success": True,
        "message": "Receipt uploaded successfully",
        "receipt_url": payment.receipt_url,
        "receipt_filename": payment.receipt_filename
    }


@router.get("/{payment_id}/receipt")
async def download_receipt(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Download receipt for a payment."""
    # Get payment
    payment_result = await db.execute(
        select(Payment).where(Payment.id == payment_id)
    )
    payment = payment_result.scalar_one_or_none()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Check access - admin or the student who made the payment
    if current_user.role != "admin":
        student_result = await db.execute(
            select(Student).where(Student.user_id == current_user.id)
        )
        student = student_result.scalar_one_or_none()
        
        if not student or payment.student_id != student.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    if not payment.receipt_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )
    
    # Get file path
    file_path = Path("backend") / payment.receipt_url.lstrip("/")
    
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt file not found"
        )
    
    # Determine media type based on file extension
    media_type = "application/octet-stream"
    if payment.receipt_filename:
        ext = payment.receipt_filename.lower().split('.')[-1] if '.' in payment.receipt_filename else ''
        if ext in ['jpg', 'jpeg']:
            media_type = "image/jpeg"
        elif ext == 'png':
            media_type = "image/png"
        elif ext == 'pdf':
            media_type = "application/pdf"
    
    return FileResponse(
        path=file_path,
        filename=payment.receipt_filename,
        media_type=media_type
    )
