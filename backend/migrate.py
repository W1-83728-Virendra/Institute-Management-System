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
            # Add gender column to students
            await db.execute(text("""
                ALTER TABLE students 
                ADD COLUMN IF NOT EXISTS gender VARCHAR(20)
            """))
            await db.commit()
            print('✅ Added gender column to students')
        except Exception as e:
            await db.rollback()
            print(f'Gender column: {e}')

        try:
            # Add caste_category column to students
            await db.execute(text("""
                ALTER TABLE students 
                ADD COLUMN IF NOT EXISTS caste_category VARCHAR(50)
            """))
            await db.commit()
            print('✅ Added caste_category column to students')
        except Exception as e:
            await db.rollback()
            print(f'Caste_category column: {e}')

        try:
            # Add academic_year column to students
            await db.execute(text("""
                ALTER TABLE students 
                ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20)
            """))
            await db.commit()
            print('✅ Added academic_year column to students')
        except Exception as e:
            await db.rollback()
            print(f'Academic_year column: {e}')

        try:
            # Add admission_quota column to students
            await db.execute(text("""
                ALTER TABLE students 
                ADD COLUMN IF NOT EXISTS admission_quota VARCHAR(50)
            """))
            await db.commit()
            print('✅ Added admission_quota column to students')
        except Exception as e:
            await db.rollback()
            print(f'Admission_quota column: {e}')

        try:
            # Add razorpay columns to payments
            await db.execute(text("""
                ALTER TABLE payments 
                ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100)
            """))
            await db.commit()
            print('✅ Added razorpay_order_id column to payments')
        except Exception as e:
            await db.rollback()
            print(f'Razorpay order_id column: {e}')

        try:
            await db.execute(text("""
                ALTER TABLE payments 
                ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100)
            """))
            await db.commit()
            print('✅ Added razorpay_payment_id column to payments')
        except Exception as e:
            await db.rollback()
            print(f'Razorpay payment_id column: {e}')

        try:
            await db.execute(text("""
                ALTER TABLE payments 
                ADD COLUMN IF NOT EXISTS razorpay_signature VARCHAR(200)
            """))
            await db.commit()
            print('✅ Added razorpay_signature column to payments')
        except Exception as e:
            await db.rollback()
            print(f'Razorpay signature column: {e}')

        try:
            await db.execute(text("""
                ALTER TABLE payments 
                ADD COLUMN IF NOT EXISTS receipt_url VARCHAR(500)
            """))
            await db.commit()
            print('✅ Added receipt_url column to payments')
        except Exception as e:
            await db.rollback()
            print(f'Receipt_url column: {e}')

        try:
            await db.execute(text("""
                ALTER TABLE payments 
                ADD COLUMN IF NOT EXISTS receipt_filename VARCHAR(255)
            """))
            await db.commit()
            print('✅ Added receipt_filename column to payments')
        except Exception as e:
            await db.rollback()
            print(f'Receipt_filename column: {e}')

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
