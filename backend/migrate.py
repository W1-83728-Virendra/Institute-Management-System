"""
Database Migration Script - Fixed Version
Adds missing columns to existing tables for the new document features
"""
import asyncio
from sqlalchemy import text
from app.core.database import get_db

async def migrate():
    async for db in get_db():
        try:
            # Add category column
            await db.execute(text("""
                ALTER TABLE documents 
                ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'other'
            """))
            await db.commit()
            print('✅ Added category column')
        except Exception as e:
            await db.rollback()
            print(f'Category column: {e}')

        try:
            # Add expiry_date column
            await db.execute(text("""
                ALTER TABLE documents 
                ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP WITH TIME ZONE
            """))
            await db.commit()
            print('✅ Added expiry_date column')
        except Exception as e:
            await db.rollback()
            print(f'Expiry_date column: {e}')

        try:
            # Add is_required column
            await db.execute(text("""
                ALTER TABLE documents 
                ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT FALSE
            """))
            await db.commit()
            print('✅ Added is_required column')
        except Exception as e:
            await db.rollback()
            print(f'Is_required column: {e}')

        try:
            # Create document_requests table
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS document_requests (
                    id SERIAL PRIMARY KEY,
                    student_id INTEGER NOT NULL,
                    document_type VARCHAR(100) NOT NULL,
                    description TEXT,
                    due_date TIMESTAMP WITH TIME ZONE,
                    status VARCHAR(20) DEFAULT 'pending',
                    created_by INTEGER NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
                )
            """))
            await db.commit()
            print('✅ Created document_requests table')
        except Exception as e:
            await db.rollback()
            print(f'Document requests table: {e}')

        try:
            # Create document_audit_logs table
            await db.execute(text("""
                CREATE TABLE IF NOT EXISTS document_audit_logs (
                    id SERIAL PRIMARY KEY,
                    document_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    action VARCHAR(50) NOT NULL,
                    ip_address VARCHAR(50),
                    user_agent VARCHAR(255),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
                )
            """))
            await db.commit()
            print('✅ Created document_audit_logs table')
        except Exception as e:
            await db.rollback()
            print(f'Document audit logs table: {e}')
            
        print('✅ All migrations completed!')
        break

if __name__ == "__main__":
    asyncio.run(migrate())
