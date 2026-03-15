# Implementation Plan: Comprehensive Document Filters

## 1. Current State Analysis

### Backend (`backend/app/routers/documents.py`)
- **Current Filters**: `student_id`, `status`, `document_type`, `category`
- **Missing**: Search by student name/admission number, date range, sorting

### Frontend (`frontend/src/pages/Documents.tsx`)
- **Current Filters**: Only `category`, `status`, `document_type` (partial)
- **Missing**: Search input, date range pickers, sort dropdown

---

## 2. Proposed Solution

### 2.1 Backend Changes

#### File: `backend/app/routers/documents.py`

**New Query Parameters for `GET /documents`:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | No | Search by student name or admission number |
| `date_from` | datetime | No | Filter documents from this date |
| `date_to` | datetime | No | Filter documents until this date |
| `sort_by` | string | No | Field to sort by: `issued_date`, `student_name`, `status`, `document_type` |
| `sort_order` | string | No | Sort direction: `asc` or `desc` (default: `desc`) |

**Implementation Approach:**
- Use SQLAlchemy's `or_` for search functionality
- Use Python's `and_` for date range filtering
- Use SQLAlchemy's `order_by` with dynamic field selection

---

### 2.2 Frontend Changes

#### File: `frontend/src/services/api.ts`

**Updated `documentsAPI.getAll()` to accept new params:**
```typescript
getAll: (params?: {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
  document_type?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: 'issued_date' | 'student_name' | 'status' | 'document_type';
  sort_order?: 'asc' | 'desc';
}) => api.get('/documents', { params, headers: getAuthHeader() });
```

#### File: `frontend/src/store/slices/documentsSlice.ts`

**Extend State Interface:**
```typescript
interface DocumentsState {
  // ... existing fields
  filters: {
    search: string;
    status: string;
    document_type: string;
    category: string;
    date_from: string;
    date_to: string;
    sort_by: string;
    sort_order: string;
  };
}
```

**New Async Thunks:**
- Update `fetchDocuments` to accept filter params

#### File: `frontend/src/pages/Documents.tsx`

**New Filter UI Components:**
1. **Search Input** - Text field for student name/admission number
2. **Status Filter** - Dropdown (All, Pending, Verified, Rejected)
3. **Document Type Filter** - Dropdown from available types
4. **Category Filter** - Dropdown (All, Academic, ID Proof, Certificate, Other)
5. **Date Range** - Two date pickers (From, To)
6. **Sort Options** - Dropdown with fields and order toggle

---

## 3. Implementation Steps (Sequential)

### Step 1: Backend - Update Router
- [ ] Add new query parameters to `get_documents` endpoint
- [ ] Implement search logic (student name, admission number)
- [ ] Implement date range filtering
- [ ] Implement sorting logic
- [ ] Ensure proper error handling

### Step 2: Frontend - Update API Service
- [ ] Update TypeScript interface for params
- [ ] Add new parameters to API call

### Step 3: Frontend - Update Redux Slice
- [ ] Add filter state to documents slice
- [ ] Update fetchDocuments thunk to pass filters

### Step 4: Frontend - Update UI
- [ ] Add search input component
- [ ] Add date range picker components
- [ ] Add sort dropdown component
- [ ] Wire up all filter state changes
- [ ] Add clear filters button

---

## 4. SOLID Principles Applied

### Single Responsibility Principle (SRP)
- Router handles only API logic
- API service handles only HTTP calls
- Redux slice handles only state management
- UI components handle only presentation

### Open/Closed Principle (OCP)
- Adding new filters won't require modifying existing code structure
- Filter configuration can be extended without changing core logic

### Dependency Inversion Principle (DIP)
- Frontend depends on API abstraction, not concrete implementation
- Redux middleware handles async operations cleanly

---

## 5. API Contract

### Request
```
GET /api/documents?page=1&page_size=10&search=rahul&status=verified&document_type=marksheet&date_from=2024-01-01&date_to=2024-12-31&sort_by=issued_date&sort_order=desc
```

### Response
```json
{
  "total": 50,
  "page": 1,
  "page_size": 10,
  "total_pages": 5,
  "items": [
    {
      "id": 1,
      "student": {
        "id": 1,
        "name": "Rahul Sharma",
        "admission_no": "ADM-2024-001"
      },
      "document_type": "10th_marksheet",
      "file_name": "marksheet.pdf",
      "status": "verified",
      "issued_date": "2024-06-15T10:30:00",
      "verified_date": "2024-06-16T14:20:00"
    }
  ]
}
```

---

## 6. UI Mockup (Text Description)

```
┌─────────────────────────────────────────────────────────────────┐
│  Documents                                    [Upload] [Request]│
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌─────────┐ ┌────────────┐ ┌──────────────┐  │
│  │ 🔍 Search    │ │ Status  │ │ Doc Type   │ │   Category   │  │
│  │ Student name │ │ All ▼   │ │ All ▼      │ │ All ▼        │  │
│  └──────────────┘ └─────────┘ └────────────┘ └──────────────┘  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌────────┐ ┌───────┐ │
│  │ 📅 Date From    │ │ 📅 Date To      │ │ Sort   │ │ Clear │ │
│  │ 2024-01-01     │ │ 2024-12-31      │ │ Date▼  │ │ Filters│ │
│  └─────────────────┘ └─────────────────┘ └────────┘ └───────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ID    Student        Document Type      Status    Date       │
│  1     Rahul Sharma   10th Marksheet     ✓ Verified 2024-06-15│
│  2     Priya Singh    ID Proof           ⏳ Pending  2024-06-20 │
│  ...                                                           │
├─────────────────────────────────────────────────────────────────┤
│  Showing 1-10 of 50    < 1 2 3 4 5 >                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Testing Checklist

- [ ] Search by student name returns correct results
- [ ] Search by admission number returns correct results
- [ ] Status filter shows only matching documents
- [ ] Document type filter works correctly
- [ ] Category filter works correctly
- [ ] Date range filter shows documents within range
- [ ] Sort by date (ascending/descending) works
- [ ] Sort by student name works
- [ ] Sort by status works
- [ ] Combined filters work together
- [ ] Clear filters resets all
- [ ] Pagination works with filters applied
