
import asyncio
from sqlalchemy import select
from app.core.database import SessionLocal
from app.models.models import Student, User, DocumentRequest

async def check():
    async with SessionLocal() as session:
        # Check students
        s_res = await session.execute(select(Student))
        students = s_res.scalars().all()
        print("--- STUDENTS ---")
        for s in students:
            u_res = await session.execute(select(User).where(User.id == s.user_id))
            u = u_res.scalar_one_or_none()
            print(f"ID: {s.id}, Name: {s.first_name} {s.last_name}, Email: {u.email if u else 'N/A'}")
        
        # Check requests
        r_res = await session.execute(select(DocumentRequest))
        reqs = r_res.scalars().all()
        print("\n--- DOCUMENT REQUESTS ---")
        for r in reqs:
            print(f"ID: {r.id}, StudentID: {r.student_id}, Type: {r.document_type}, Status: {r.status}")

if __name__ == "__main__":
    asyncio.run(check())
