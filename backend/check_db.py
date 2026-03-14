
import asyncio
from sqlalchemy import select
from app.core.database import SessionLocal, engine
from app.models.models import DocumentRequest, Student, User

async def check_requests():
    async with SessionLocal() as session:
        # Get all requests
        result = await session.execute(select(DocumentRequest))
        requests = result.scalars().all()
        print(f"Total Requests: {len(requests)}")
        for req in requests:
            print(f"ID: {req.id}, StudentID: {req.student_id}, Type: {req.document_type}, Status: {req.status}")
        
        # Get students
        result = await session.execute(select(Student))
        students = result.scalars().all()
        print(f"\nStudents in DB: {len(students)}")
        for s in students:
            print(f"ID: {s.id}, Name: {s.first_name} {s.last_name}, UserID: {s.user_id}")

if __name__ == "__main__":
    asyncio.run(check_requests())
