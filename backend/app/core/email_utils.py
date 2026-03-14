"""
Email utility for sending notifications.
"""
import os
from typing import Optional

# Email configuration - can be set via environment variables
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@institute.edu")
FROM_NAME = os.getenv("FROM_NAME", "Institute Management System")

# If no SMTP is configured, emails will be logged but not sent
EMAIL_ENABLED = bool(SMTP_HOST and SMTP_USER)


def send_email(
    to_email: str,
    subject: str,
    body: str,
    html: Optional[str] = None
) -> bool:
    """
    Send an email to the specified address.
    
    Returns True if email was sent successfully, False otherwise.
    If SMTP is not configured, logs the email instead.
    """
    if not EMAIL_ENABLED:
        # Log email instead of sending (for development)
        print(f"\n========== EMAIL NOTIFICATION ==========")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(f"Body: {body}")
        print(f"========================================\n")
        return True
    
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['From'] = f"{FROM_NAME} <{FROM_EMAIL}>"
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # Attach plain text and HTML versions
        text_part = MIMEText(body, 'plain')
        msg.attach(text_part)
        
        if html:
            html_part = MIMEText(html, 'html')
            msg.attach(html_part)
        
        # Send email
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False


def send_document_verified_email(student_email: str, student_name: str, document_type: str) -> bool:
    """Send notification when a document is verified."""
    subject = f"Your {document_type} has been verified"
    body = f"""Dear {student_name},

Good news! Your document "{document_type}" has been verified and approved by the administration.

You can now view your verified documents in the student portal.

Best regards,
Institute Management System"""
    
    return send_email(student_email, subject, body)


def send_document_rejected_email(student_email: str, student_name: str, document_type: str, reason: str = "") -> bool:
    """Send notification when a document is rejected."""
    subject = f"Your {document_type} needs to be resubmitted"
    body = f"""Dear {student_name},

Your document "{document_type}" has been reviewed and requires resubmission.
"""
    if reason:
        body += f"\nReason: {reason}\n"
    
    body += """
Please log in to the student portal to view the details and upload a new document.

Best regards,
Institute Management System"""
    
    return send_email(student_email, subject, body)


def send_document_request_email(student_email: str, student_name: str, document_type: str, due_date: str = "", message: str = "") -> bool:
    """Send notification when admin requests a document from student."""
    subject = f"Document Request: {document_type}"
    body = f"""Dear {student_name},

The administration has requested you to submit the following document:
- Document Type: {document_type}
"""
    if due_date:
        body += f"- Due Date: {due_date}\n"
    if message:
        body += f"\nMessage: {message}\n"
    
    body += """
Please log in to the student portal to upload the required document.

Best regards,
Institute Management System"""
    
    return send_email(student_email, subject, body)


def send_fee_notification_email(student_email: str, student_name: str, fee_type: str, amount: float, due_date: str) -> bool:
    """Send notification about new fee assignment."""
    subject = f"New Fee Assigned: {fee_type}"
    body = f"""Dear {student_name},

A new fee has been assigned to your account:
- Fee Type: {fee_type}
- Amount: ₹{amount:,.2f}
- Due Date: {due_date}

Please log in to the student portal to view and pay your fees.

Best regards,
Institute Management System"""
    
    return send_email(student_email, subject, body)
