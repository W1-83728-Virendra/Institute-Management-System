from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta

from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    get_current_user
)
from app.core.config import settings
from app.models.models import User, Student, Admin, UserRole
from app.schemas.schemas import (
    LoginRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
    StudentCreate,
    StudentResponse
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Authenticate user and return JWT tokens."""
    # Find user by email
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Create tokens - convert user.id to string for JWT
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role.value}
    )
    refresh_token = create_refresh_token(
        data={"sub": str(user.id), "email": user.email}
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={
            "id": user.id,
            "email": user.email,
            "role": user.role.value,
            "is_active": user.is_active
        }
    )


@router.post("/register/student", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
async def register_student(
    request: StudentCreate,
    db: AsyncSession = Depends(get_db)
):
    """Register a new student."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if admission number already exists
    result = await db.execute(select(Student).where(Student.admission_no == request.admission_no))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admission number already exists"
        )
    
    # Create user
    user = User(
        email=request.email,
        password_hash=get_password_hash(request.password),
        role=UserRole.STUDENT
    )
    db.add(user)
    await db.flush()
    
    # Create student
    student = Student(
        user_id=user.id,
        admission_no=request.admission_no,
        first_name=request.first_name,
        last_name=request.last_name,
        phone=request.phone,
        address=request.address,
        course=request.course,
        semester=request.semester,
        guardian_name=request.guardian_name,
        guardian_phone=request.guardian_phone
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)
    
    return student


@router.post("/register/admin", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_admin(
    request: UserCreate,
    first_name: str,
    last_name: str,
    phone: str = None,
    db: AsyncSession = Depends(get_db)
):
    """Register a new admin (for initial setup)."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    user = User(
        email=request.email,
        password_hash=get_password_hash(request.password),
        role=UserRole.ADMIN
    )
    db.add(user)
    await db.flush()
    
    # Create admin profile
    admin = Admin(
        user_id=user.id,
        first_name=first_name,
        last_name=last_name,
        phone=phone
    )
    db.add(admin)
    await db.commit()
    await db.refresh(user)
    
    return user


@router.get("/me", response_model=dict)
async def get_me(
    current_user: User = Depends(get_current_user)
):
    """Get current user information."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role.value,
        "is_active": current_user.is_active
    }
