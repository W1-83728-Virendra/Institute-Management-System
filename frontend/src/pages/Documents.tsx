import { useEffect, useState, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Grid, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Snackbar, Alert, IconButton, InputAdornment,
  FormControl, InputLabel, Select, OutlinedInput, TableSortLabel
} from '@mui/material';
import { CloudUpload as UploadIcon, CheckCircle, Cancel, Download, Visibility, Close, Mail, Search, FilterList, Clear } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchDocuments, fetchDocumentStats, uploadDocument, verifyDocument, rejectDocument, setFilters, clearFilters } from '../store/slices/documentsSlice';
import { fetchStudents } from '../store/slices/studentsSlice';
import { documentsAPI, studentsAPI } from '../services/api';

const Documents = () => {
  const dispatch = useAppDispatch();
  // Get documents, filters, and loading state from Redux store
  const { documents, total, loading, filters: reduxFilters, page, total_pages } = useAppSelector((state: any) => state.documents);
  const { stats } = useAppSelector((state: any) => state.documents);
  const { students: studentList } = useAppSelector((state: any) => state.students);

  // Local state for UI dialogs
  const [openUpload, setOpenUpload] = useState(false);
  const [openVerify, setOpenVerify] = useState(false);
  const [openPreview, setOpenPreview] = useState(false);
  const [openRequest, setOpenRequest] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [settingsData, setSettingsData] = useState({ expiry_date: '', is_required: false });
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [verifyNotes, setVerifyNotes] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadData, setUploadData] = useState({ student_id: '', document_type: '', description: '' });
  const [requestData, setRequestData] = useState({ student_id: '', document_type: '', description: '', due_date: '' });
  const [documentTypes, setDocumentTypes] = useState<{ value: string; label: string }[]>([]);

  // Local state for search input (debounced)
  const [searchInput, setSearchInput] = useState(reduxFilters.search);

  // --------------------------------------------------------------------------
  // Fetch documents when filters change
  // Use case: Refresh document list when user applies or changes filters
  // --------------------------------------------------------------------------
  useEffect(() => {
    // Fetch documents with current filters from Redux store
    dispatch(fetchDocuments(reduxFilters));
    dispatch(fetchDocumentStats());
    dispatch(fetchStudents({ page_size: 1000 }));

    // Fetch document types for filter dropdown
    const fetchTypes = async () => {
      try {
        const res = await documentsAPI.getTypes();
        setDocumentTypes(res.data?.document_types || []);
      } catch (err) {
        console.error('Failed to fetch document types', err);
      }
    };
    fetchTypes();
  }, [dispatch, reduxFilters]); // Include reduxFilters in dependency array

  // --------------------------------------------------------------------------
  // Handle filter changes
  // Use case: Update Redux filter state when user changes filter options
  // --------------------------------------------------------------------------
  const handleFilterChange = (filterName: string, value: string) => {
    dispatch(setFilters({ [filterName]: value }));
  };

  // --------------------------------------------------------------------------
  // Handle search input with debounce
  // Use case: Search by student name or admission number
  // --------------------------------------------------------------------------
  // const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const value = e.target.value;
  //   setSearchInput(value);
  //   // Debounce search - update filter after user stops typing
  //   const timeoutId = setTimeout(() => {
  //     dispatch(setFilters({ search: value }));
  //   }, 500);
  //   return () => clearTimeout(timeoutId);
  // };

  // Fix: Move debounce to useEffect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      dispatch(setFilters({ search: searchInput }));
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Simplify handler to just update local state
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };


  // --------------------------------------------------------------------------
  // Handle sort change
  // Use case: Change sort field and order
  // --------------------------------------------------------------------------
  const handleSortChange = (field: string) => {
    // If clicking the same field, toggle order; otherwise set to descending
    if (reduxFilters.sort_by === field) {
      dispatch(setFilters({ sort_order: reduxFilters.sort_order === 'asc' ? 'desc' : 'asc' }));
    } else {
      dispatch(setFilters({ sort_by: field, sort_order: 'desc' }));
    }
  };

  // --------------------------------------------------------------------------
  // Clear all filters
  // Use case: Reset all filters to default values
  // --------------------------------------------------------------------------
  const handleClearFilters = () => {
    dispatch(clearFilters());
    setSearchInput('');
  };

  const handleCategoryChange = (e: any) => {
    dispatch(setFilters({ category: e.target.value }));
  };

  const handleDownloadAll = async (studentId: number, studentName: string) => {
    try {
      const response = await documentsAPI.downloadAllDocuments(studentId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${studentName}_all_documents.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      setSnackbar({ open: true, message: 'Failed to download ZIP', severity: 'error' });
    }
  };

  const handleUpload = async () => {
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0 || !uploadData.student_id || !uploadData.document_type) {
      setSnackbar({ open: true, message: 'Please fill all required fields', severity: 'error' });
      return;
    }

    const formData = new FormData();
    if (files.length > 1) {
      // Bulk upload
      const ids = Array(files.length).fill(uploadData.student_id).join(',');
      formData.append('student_ids', ids);
      formData.append('document_type', uploadData.document_type);
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      try {
        await documentsAPI.bulkUpload(formData);
        setSnackbar({ open: true, message: 'Bulk documents uploaded successfully', severity: 'success' });
        setOpenUpload(false);
        setUploadData({ student_id: '', document_type: '', description: '' });
        dispatch(fetchDocuments(reduxFilters));
      } catch (error: any) {
        setSnackbar({ open: true, message: error.response?.data?.detail || 'Bulk upload failed', severity: 'error' });
      }
    } else {
      // Single upload
      formData.append('file', files[0]);
      formData.append('student_id', uploadData.student_id);
      formData.append('document_type', uploadData.document_type);
      formData.append('description', uploadData.description);

      try {
        await dispatch(uploadDocument(formData)).unwrap();
        setSnackbar({ open: true, message: 'Document uploaded successfully', severity: 'success' });
        setOpenUpload(false);
        setUploadData({ student_id: '', document_type: '', description: '' });
        if (fileInputRef.current) fileInputRef.current.value = '';
        dispatch(fetchDocuments(reduxFilters)); 
        dispatch(fetchDocumentStats());
      } catch (error: any) {
        const errorMsg = typeof error === 'string' ? error : (error.response?.data?.detail || error.message || 'Upload failed');
        setSnackbar({ open: true, message: errorMsg, severity: 'error' });
      }
    }
  };

  const handleVerify = async () => {
    if (!selectedDoc) return;
    try {
      await dispatch(verifyDocument({ id: selectedDoc.id, notes: verifyNotes })).unwrap();
      setSnackbar({ open: true, message: 'Document verified successfully', severity: 'success' });
      setOpenVerify(false);
      setSelectedDoc(null);
      setVerifyNotes('');
      dispatch(fetchDocuments({}));
      dispatch(fetchDocumentStats());
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'Verification failed';
      setSnackbar({ open: true, message: errorMsg, severity: 'error' });
    }
  };

  const handleReject = async () => {
    if (!selectedDoc) return;
    try {
      await dispatch(rejectDocument({ id: selectedDoc.id, notes: verifyNotes })).unwrap();
      setSnackbar({ open: true, message: 'Document rejected', severity: 'success' });
      setOpenVerify(false);
      setSelectedDoc(null);
      setVerifyNotes('');
      dispatch(fetchDocuments({}));
      dispatch(fetchDocumentStats());
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'Action failed';
      setSnackbar({ open: true, message: errorMsg, severity: 'error' });
    }
  };

  const handleRequestSubmit = async () => {
    if (!requestData.student_id || !requestData.document_type) {
      setSnackbar({ open: true, message: 'Please fill required fields', severity: 'error' });
      return;
    }

    try {
      const payload = {
        student_id: Number(requestData.student_id),
        document_type: requestData.document_type,
        description: requestData.description || null,
        due_date: requestData.due_date ? new Date(requestData.due_date).toISOString() : null
      };

      await documentsAPI.createDocumentRequest(payload);
      setSnackbar({ open: true, message: 'Document request sent to student', severity: 'success' });
      setOpenRequest(false);
      setRequestData({ student_id: '', document_type: '', description: '', due_date: '' });
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to create request';
      setSnackbar({ open: true, message: errorMsg, severity: 'error' });
    }
  };

  const openSettingsDialog = (doc: any) => {
    setSelectedDoc(doc);
    setSettingsData({
      expiry_date: doc.expiry_date ? new Date(doc.expiry_date).toISOString().split('T')[0] : '',
      is_required: doc.is_required || false
    });
    setOpenSettings(true);
  };

  const handleSaveSettings = async () => {
    if (!selectedDoc) return;

    try {
      await documentsAPI.update(selectedDoc.id, {
        expiry_date: settingsData.expiry_date || null,
        is_required: settingsData.is_required
      });
      setSnackbar({ open: true, message: 'Document settings updated', severity: 'success' });
      setOpenSettings(false);
      setSelectedDoc(null);
      dispatch(fetchDocuments({}));
    } catch (error: any) {
      setSnackbar({ open: true, message: error || 'Failed to update settings', severity: 'error' });
    }
  };

  const openVerifyDialog = async (doc: any) => {
    setSelectedDoc(doc);
    setVerifyNotes('');
    setOpenVerify(true);
    try {
      const res = await documentsAPI.getHistory(doc.id);
      setHistory(res.data.history);
    } catch (e) {
      setHistory([]);
    }
  };

  const openViewDialog = (doc: any) => {
    setSelectedDoc(doc);
    setOpenVerify(true); // Reuse the dialog for viewing
  };

  const handlePreview = async (doc: any) => {
    setSelectedDoc(doc);
    setPreviewLoading(true);
    setOpenPreview(true);

    try {
      const response = await documentsAPI.download(doc.id);
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (error: any) {
      setSnackbar({ open: true, message: 'Failed to load document', severity: 'error' });
      setOpenPreview(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    setOpenPreview(false);
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
  };

  const handleDownload = async (doc: any) => {
    try {
      const response = await documentsAPI.download(doc.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.file_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      setSnackbar({ open: true, message: 'Failed to download document', severity: 'error' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">Document Management</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<Mail />} onClick={() => setOpenRequest(true)}>
            Request Document
          </Button>
          <Button variant="contained" startIcon={<UploadIcon />} onClick={() => setOpenUpload(true)}>
            Upload Document
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[
          { label: 'Total Documents', value: stats?.total || 0, color: '#667eea' },
          { label: 'Verified', value: stats?.verified || 0, color: '#10b981' },
          { label: 'Pending', value: stats?.pending || 0, color: '#f59e0b' },
          { label: 'Issued This Month', value: stats?.issued_this_month || 0, color: '#8b5cf6' },
        ].map((stat) => (
          <Grid item xs={12} sm={6} md={3} key={stat.label}>
            <Card>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: `${stat.color}20`, color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  📄
                </Box>
                <Box>
                  <Typography variant="h4">{stat.value}</Typography>
                  <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          {/* --------------------------------------------------------------------------
          Enhanced Filter Section
          Use case: Admin can filter documents by multiple criteria including:
          - Search by student name or admission number
          - Status (pending, verified, rejected)
          - Document type
          - Category
          - Date range (from/to)
          - Sort by various fields
          -------------------------------------------------------------------------- */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="subtitle1" fontWeight="bold">Filters:</Typography>
            
            {/* Search Input - Search by student name or admission number */}
            <TextField
              size="small"
              placeholder="Search student name or ID..."
              value={searchInput}
              onChange={handleSearchChange}
              sx={{ minWidth: 220 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            
            {/* Status Filter */}
            <TextField
              select
              size="small"
              label="Status"
              value={reduxFilters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="verified">Verified</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
            </TextField>
            
            {/* Document Type Filter */}
            <TextField
              select
              size="small"
              label="Document Type"
              value={reduxFilters.document_type}
              onChange={(e) => handleFilterChange('document_type', e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">All Types</MenuItem>
              {documentTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
              ))}
            </TextField>
            
            {/* Category Filter */}
            <TextField
              select
              size="small"
              label="Category"
              value={reduxFilters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="">All Categories</MenuItem>
              <MenuItem value="academic">Academic</MenuItem>
              <MenuItem value="id_proof">ID Proof</MenuItem>
              <MenuItem value="certificate">Certificate</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>
          </Box>
          
          {/* Date Range and Sort Row */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mt: 2 }}>
            {/* Date From */}
            <TextField
              size="small"
              label="Date From"
              type="date"
              value={reduxFilters.date_from}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            
            {/* Date To */}
            <TextField
              size="small"
              label="Date To"
              type="date"
              value={reduxFilters.date_to}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            
            {/* Sort By */}
            <TextField
              select
              size="small"
              label="Sort By"
              value={reduxFilters.sort_by}
              onChange={(e) => handleFilterChange('sort_by', e.target.value)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="issued_date">Date</MenuItem>
              <MenuItem value="student_name">Student Name</MenuItem>
              <MenuItem value="status">Status</MenuItem>
              <MenuItem value="document_type">Document Type</MenuItem>
            </TextField>
            
            {/* Sort Order */}
            <TextField
              select
              size="small"
              label="Order"
              value={reduxFilters.sort_order}
              onChange={(e) => handleFilterChange('sort_order', e.target.value)}
              sx={{ minWidth: 100 }}
            >
              <MenuItem value="desc">↓ Desc</MenuItem>
              <MenuItem value="asc">↑ Asc</MenuItem>
            </TextField>
            
            {/* Clear Filters Button */}
            <Button
              variant="outlined"
              size="small"
              startIcon={<Clear />}
              onClick={handleClearFilters}
              sx={{ ml: 'auto' }}
            >
              Clear Filters
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Recently Issued Documents</Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f9fafb' }}>
                  {/* Sortable Student Column */}
                  <TableCell>
                    <TableSortLabel
                      active={reduxFilters.sort_by === 'student_name'}
                      direction={reduxFilters.sort_by === 'student_name' ? reduxFilters.sort_order as 'asc' | 'desc' : 'desc'}
                      onClick={() => handleSortChange('student_name')}
                    >
                      Student
                    </TableSortLabel>
                  </TableCell>
                  {/* Sortable Document Type Column */}
                  <TableCell>
                    <TableSortLabel
                      active={reduxFilters.sort_by === 'document_type'}
                      direction={reduxFilters.sort_by === 'document_type' ? reduxFilters.sort_order as 'asc' | 'desc' : 'desc'}
                      onClick={() => handleSortChange('document_type')}
                    >
                      Document Type
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>File</TableCell>
                  {/* Sortable Issued Date Column */}
                  <TableCell>
                    <TableSortLabel
                      active={reduxFilters.sort_by === 'issued_date'}
                      direction={reduxFilters.sort_by === 'issued_date' ? reduxFilters.sort_order as 'asc' | 'desc' : 'desc'}
                      onClick={() => handleSortChange('issued_date')}
                    >
                      Issued Date
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Expiry Date</TableCell>
                  <TableCell>Required</TableCell>
                  {/* Sortable Status Column */}
                  <TableCell>
                    <TableSortLabel
                      active={reduxFilters.sort_by === 'status'}
                      direction={reduxFilters.sort_by === 'status' ? reduxFilters.sort_order as 'asc' | 'desc' : 'desc'}
                      onClick={() => handleSortChange('status')}
                    >
                      Status
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {documents.map((doc: any) => (
                  <TableRow key={doc.id} hover>
                    <TableCell>{doc.student?.name || 'N/A'}</TableCell>
                    <TableCell><Chip label={doc.document_type} size="small" /></TableCell>
                    <TableCell>{doc.file_name}</TableCell>
                    <TableCell>{new Date(doc.issued_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {doc.expiry_date ? (
                        new Date(doc.expiry_date) < new Date() ?
                          <Chip label="Expired" color="error" size="small" /> :
                          <Chip label={new Date(doc.expiry_date).toLocaleDateString()} color="warning" size="small" />
                      ) : (
                        <Typography variant="body2" color="text.secondary">No expiry</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {doc.is_required ? <Chip label="Required" color="error" size="small" /> : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        color={doc.status === 'verified' ? 'success' : 'warning'}
                        label={doc.status}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Button size="small" startIcon={<Visibility />} onClick={() => handlePreview(doc)}>View</Button>
                        <Button size="small" startIcon={<Download />} onClick={() => handleDownload(doc)}>File</Button>
                        <Button size="small" variant="outlined" startIcon={<Download />} onClick={() => handleDownloadAll(doc.student?.id, doc.student?.name)}>All ZIP</Button>
                        <Button size="small" onClick={() => openSettingsDialog(doc)}>Settings</Button>
                        {doc.status === 'pending' && (
                          <>
                            <Button size="small" color="success" startIcon={<CheckCircle />} onClick={() => openVerifyDialog(doc)}>Verify</Button>
                            <Button size="small" color="error" startIcon={<Cancel />} onClick={() => openVerifyDialog(doc)}>Reject</Button>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={openUpload} onClose={() => setOpenUpload(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Document</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Select Student"
              select
              fullWidth
              value={uploadData.student_id}
              onChange={(e) => setUploadData({ ...uploadData, student_id: e.target.value })}
            >
              {studentList.map((student: any) => (
                <MenuItem key={student.id} value={student.id}>
                  {student.first_name} {student.last_name} ({student.admission_no})
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Document Type" select fullWidth value={uploadData.document_type} onChange={(e) => setUploadData({ ...uploadData, document_type: e.target.value })}>
              {documentTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
              ))}
            </TextField>
            <TextField label="Description" multiline rows={2} fullWidth value={uploadData.description} onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })} />
            <Button variant="outlined" component="label">
              Select File(s)
              <input type="file" ref={fileInputRef} hidden accept=".pdf,.jpg,.jpeg,.png" multiple />
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenUpload(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpload}>Upload</Button>
        </DialogActions>
      </Dialog>

      {/* Request Document Dialog */}
      <Dialog open={openRequest} onClose={() => setOpenRequest(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Request Document from Student</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Select Student"
              select
              fullWidth
              value={requestData.student_id}
              onChange={(e) => setRequestData({ ...requestData, student_id: e.target.value })}
            >
              {studentList.map((student: any) => (
                <MenuItem key={student.id} value={student.id}>
                  {student.first_name} {student.last_name} ({student.admission_no})
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Document Type" select fullWidth value={requestData.document_type} onChange={(e) => setRequestData({ ...requestData, document_type: e.target.value })}>
              {documentTypes.map((type) => (
                <MenuItem key={type.value} value={type.label}>{type.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Due Date (optional)"
              type="date"
              fullWidth
              value={requestData.due_date}
              onChange={(e) => setRequestData({ ...requestData, due_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Message to Student (optional)"
              multiline
              rows={2}
              fullWidth
              value={requestData.description}
              onChange={(e) => setRequestData({ ...requestData, description: e.target.value })}
              placeholder="e.g., Please upload your 12th marksheet for admission verification"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRequest(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRequestSubmit}>Send Request</Button>
        </DialogActions>
      </Dialog>

      {/* Document Settings Dialog */}
      <Dialog open={openSettings} onClose={() => setOpenSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Document Settings - {selectedDoc?.file_name}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Expiry Date"
              type="date"
              fullWidth
              value={settingsData.expiry_date}
              onChange={(e) => setSettingsData({ ...settingsData, expiry_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              helperText="Set if document has validity period (e.g., ID card, certificate)"
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <input
                type="checkbox"
                id="is_required"
                checked={settingsData.is_required}
                onChange={(e) => setSettingsData({ ...settingsData, is_required: e.target.checked })}
              />
              <label htmlFor="is_required">Mark as Required Document</label>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Required documents must be submitted by students before they can proceed with admission.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSettings(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveSettings}>Save Settings</Button>
        </DialogActions>
      </Dialog>

      {/* Verify/Reject Dialog */}
      <Dialog open={openVerify} onClose={() => setOpenVerify(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedDoc?.status === 'pending' ? 'Verify or Reject Document' : 'Document Details'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography><strong>Student:</strong> {selectedDoc?.student?.name || 'N/A'}</Typography>
            <Typography><strong>Type:</strong> {selectedDoc?.document_type}</Typography>
            <Typography><strong>File:</strong> {selectedDoc?.file_name}</Typography>
            <Typography><strong>Status:</strong> {selectedDoc?.status}</Typography>
            {selectedDoc?.verified_date && <Typography><strong>Verified Date:</strong> {selectedDoc.verified_date}</Typography>}
            {selectedDoc?.notes && <Typography><strong>Notes:</strong> {selectedDoc.notes}</Typography>}
          </Box>

          <Box sx={{ mt: 3, p: 2, bgcolor: '#f9fafb', borderRadius: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>📜 Audit Log</Typography>
            {history.length > 0 ? (
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                {history.map((h, i) => (
                  <Box key={h.id} sx={{ mb: 1, pb: 1, borderBottom: i < history.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" fontWeight="bold" sx={{ color: 'primary.main', textTransform: 'uppercase' }}>{h.action}</Typography>
                      <Typography variant="caption" color="text.secondary">{new Date(h.timestamp).toLocaleString()}</Typography>
                    </Box>
                    <Typography variant="caption" display="block">By: {h.user}</Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary">No history available</Typography>
            )}
          </Box>

          {selectedDoc?.status === 'pending' && (
            <TextField label="Notes (optional)" multiline rows={3} fullWidth value={verifyNotes} onChange={(e) => setVerifyNotes(e.target.value)} placeholder="Add notes about verification..." sx={{ mt: 2 }} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenVerify(false); setVerifyNotes(''); }}>
            {selectedDoc?.status === 'pending' ? 'Cancel' : 'Close'}
          </Button>
          {selectedDoc?.status === 'pending' && (
            <>
              <Button color="error" variant="outlined" onClick={handleReject}>Reject</Button>
              <Button color="success" variant="contained" onClick={handleVerify}>Verify</Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Document Preview Dialog */}
      <Dialog open={openPreview} onClose={handleClosePreview} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Document Preview - {selectedDoc?.file_name}</span>
          <IconButton onClick={handleClosePreview} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {previewLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
              <Typography>Loading document...</Typography>
            </Box>
          ) : previewUrl ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
              {selectedDoc?.file_name?.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                <img
                  src={previewUrl}
                  alt={selectedDoc?.file_name}
                  style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                />
              ) : selectedDoc?.file_name?.match(/\.pdf$/i) ? (
                <iframe
                  src={previewUrl}
                  style={{ width: '100%', height: '70vh', border: 'none' }}
                  title="PDF Preview"
                />
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h6" gutterBottom>
                    Preview not available for this file type
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Download />}
                    onClick={() => handleDownload(selectedDoc)}
                  >
                    Download File
                  </Button>
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
              <Typography>Failed to load document</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button startIcon={<Download />} onClick={() => handleDownload(selectedDoc)}>
            Download
          </Button>
          <Button onClick={handleClosePreview}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default Documents;
