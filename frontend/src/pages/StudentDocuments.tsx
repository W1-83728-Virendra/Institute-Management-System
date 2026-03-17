import { useEffect, useState, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, Chip, Grid, Container, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Snackbar, Alert
} from '@mui/material';
import { Description, CheckCircle, Pending, Cancel, Download, School, CardMembership, Badge, FactCheck, Receipt, CloudUpload, Replay, Warning } from '@mui/icons-material';
import { useAppSelector } from '../store/hooks';
import { documentsAPI } from '../services/api';

// StatCard component matching admin dashboard style
const StatCard = ({ icon, value, label, color }: { icon: React.ReactNode; value: string | number; label: string; color: string }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box sx={{ width: 56, height: 56, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}Light`, color: `${color}.main` }}>
        {icon}
      </Box>
      <Box>
        <Typography variant="h4" fontWeight="bold">{value}</Typography>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </Box>
    </CardContent>
  </Card>
);

interface Document {
  id: number;
  document_type: string;
  file_name: string;
  status: string;
  issued_date: string;
  verified_date: string;
  is_college_issued: boolean;
}

interface Stats {
  total: number;
  verified: number;
  pending: number;
  rejected: number;
}

// Sample college documents that would be available in real app
interface CollegeDocument {
  id: string;
  name: string;
  type: string;
  description: string;
  status: 'active' | 'available' | 'pending';
  issuedDate: string;
  validUntil?: string;
  icon: React.ReactNode;
  color: string;
}

const StudentDocuments = () => {
  const { user } = useAppSelector((state: any) => state.auth);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [openUpload, setOpenUpload] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState('');
  const [reuploadId, setReuploadId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documentTypes, setDocumentTypes] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const [docsRes, statsRes, requestsRes, typesRes] = await Promise.all([
        documentsAPI.getMyDocuments(),
        documentsAPI.getMyStats(),
        documentsAPI.getDocumentRequests({ status: 'pending' }),
        documentsAPI.getTypes()
      ]);
      // Handle potential 422 errors
      const docsData = docsRes.data?.documents || [];
      const statsData = statsRes.data || {};
      const requestsData = requestsRes.data?.requests || [];
      const typesData = typesRes.data?.document_types || [];

      setDocuments(docsData);
      setRequests(requestsData);
      setDocumentTypes(typesData);
      setStats({
        total: statsData.total || 0,
        verified: statsData.verified || 0,
        pending: statsData.pending || 0,
        rejected: statsData.rejected || 0
      });
      console.log('Student Portal - Fetched Requests:', requestsData);
      console.log('Student Portal - Fetched Stats:', statsData);
    } catch (error: any) {
      console.error('Error fetching documents:', error.response?.data?.detail || error.message);
      setDocuments([]);
      setRequests([]);
      setStats({
        total: 0,
        verified: 0,
        pending: 0,
        rejected: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const handleDownload = async (docId: number, docName: string) => {
    try {
      const response = await documentsAPI.download(docId);
      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', docName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Download error:', error);
      alert('Failed to download document. Please try again.');
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !documentType) {
      setSnackbar({ open: true, message: 'Please select document type and at least one file', severity: 'error' });
      return;
    }

    setUploading(true);
    try {
      // If there's a reuploadId, use single file upload
      if (reuploadId && selectedFiles.length === 1) {
        await documentsAPI.uploadMyDocument(documentType, selectedFiles[0], reuploadId);
        setSnackbar({ open: true, message: 'Document replaced successfully!', severity: 'success' });
      } else if (selectedFiles.length > 1) {
        // Multiple files - use bulk upload
        await documentsAPI.uploadMultipleDocuments(documentType, selectedFiles);
        setSnackbar({ open: true, message: `${selectedFiles.length} documents uploaded successfully!`, severity: 'success' });
      } else {
        // Single file
        await documentsAPI.uploadMyDocument(documentType, selectedFiles[0], undefined);
        setSnackbar({ open: true, message: 'Document uploaded successfully!', severity: 'success' });
      }
      handleCloseDialog();
      fetchDocuments(); // Refresh documents list
    } catch (error: any) {
      console.error('Upload error:', error);
      setSnackbar({ open: true, message: error?.response?.data?.detail || 'Failed to upload document', severity: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleCloseDialog = () => {
    setOpenUpload(false);
    setSelectedFiles([]);
    setDocumentType('');
    setReuploadId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleReupload = async (docId: number, docType: string) => {
    // Set reuploadId to replace existing doc
    setReuploadId(docId);
    setDocumentType(docType);
    setOpenUpload(true);
  };



  if (loading) {
    return <Box p={3}><Typography>Loading...</Typography></Box>;
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" fontWeight="bold">
        📁 My Documents
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Student: <strong>{user?.email}</strong>
      </Typography>

      {/* Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<Description sx={{ fontSize: 28 }} />} value={stats?.total || 0} label="Total Documents" color="primary" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<CheckCircle sx={{ fontSize: 28 }} />} value={stats?.verified || 0} label="Verified" color="success" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<Pending sx={{ fontSize: 28 }} />} value={stats?.pending || 0} label="Pending" color="warning" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<Cancel sx={{ fontSize: 28 }} />} value={stats?.rejected || 0} label="Rejected" color="error" />
        </Grid>
      </Grid>

      {/* Upload Button */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={<CloudUpload />}
          onClick={() => setOpenUpload(true)}
        >
          Upload Document
        </Button>
      </Box>

      {/* Document Requests Section */}
      <Card sx={{ mb: 3, borderLeft: '4px solid', borderColor: requests.length > 0 ? '#f59e0b' : 'success.main', bgcolor: requests.length > 0 ? '#fffbeb' : '#f0fdf4' }}>
        <CardContent>
          <Typography variant="h6" color={requests.length > 0 ? "warning.dark" : "success.dark"} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {requests.length > 0 ? <Pending /> : <CheckCircle />} {requests.length > 0 ? 'Pending Document Requests' : 'No Pending Requests'}
          </Typography>

          {requests.length > 0 ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                The administration has requested the following documents from you.
              </Typography>
              <Grid container spacing={2}>
                {requests.map((req) => (
                  <Grid item xs={12} key={req.id}>
                    <Box sx={{
                      p: 2,
                      bgcolor: 'white',
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'warning.light',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 2
                    }}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">{req.document_type}</Typography>
                        {req.description && <Typography variant="body2">{req.description}</Typography>}
                        {req.due_date && (
                          <Typography variant="caption" color="error" sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                            <Warning sx={{ fontSize: 14, mr: 0.5 }} /> Due by: {new Date(req.due_date).toLocaleDateString()}
                          </Typography>
                        )}
                      </Box>
                      <Button
                        variant="contained"
                        color="warning"
                        size="small"
                        startIcon={<CloudUpload />}
                        onClick={() => {
                          const matchingType = documentTypes.find(t =>
                            t.label.toLowerCase() === req.document_type.toLowerCase() ||
                            t.value === req.document_type.toLowerCase().replace(/ /g, '_')
                          );
                          setDocumentType(matchingType ? matchingType.value : 'other');
                          setOpenUpload(true);
                        }}
                      >
                        Upload Now
                      </Button>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Everything is up to date! There are no active document requests from the office.
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* All Documents from College - Card Layout */}
      <Card sx={{ mb: 3, borderLeft: '4px solid success.main' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>🏫 All Documents from College</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            <Description sx={{ mr: 1, verticalAlign: 'middle' }} />
            Your personal shared folder - all documents issued by the college are here.
          </Typography>

          <Grid container spacing={2}>
            {documents.filter((d: Document) => d.is_college_issued).map((doc: Document) => (
              <Grid item xs={12} sm={6} md={4} key={doc.id}>
                <Card sx={{ height: '100%', border: '1px solid', borderColor: 'success.light', bgcolor: 'success.50' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <School color="success" />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold">{doc.document_type}</Typography>
                        <Typography variant="caption" color="text.secondary">{doc.file_name}</Typography>
                      </Box>
                      <Chip label="Official" color="success" size="small" />
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                      Issued: {new Date(doc.issued_date).toLocaleDateString()}
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      fullWidth
                      startIcon={<Download />}
                      onClick={() => handleDownload(doc.id, doc.file_name)}
                    >
                      Download Official Copy
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
            {documents.filter(d => d.is_college_issued).length === 0 && (
              <Grid item xs={12}>
                <Box sx={{ py: 3, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">No official documents issued yet.</Typography>
                </Box>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Real API Documents */}
      <Card sx={{ mt: 3, borderLeft: '4px solid primary.main' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>📄 My Uploaded Documents</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Documents you have uploaded to your portal.
          </Typography>

          <Grid container spacing={2}>
            {documents.filter((d: Document) => !d.is_college_issued).map((doc: Document) => (
              <Grid item xs={12} sm={6} md={4} key={doc.id}>
                <Card sx={{ height: '100%', border: '1px solid grey.200' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Description color="primary" />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {doc.document_type}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {doc.file_name}
                        </Typography>
                      </Box>
                      <Chip
                        label={doc.status}
                        color={doc.status === 'verified' ? 'success' : doc.status === 'pending' ? 'warning' : 'error'}
                        size="small"
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                      Uploaded: {new Date(doc.issued_date).toLocaleDateString()}
                    </Typography>
                    {doc.status === 'rejected' ? (
                      <Button
                        variant="contained"
                        color="error"
                        size="small"
                        fullWidth
                        startIcon={<Replay />}
                        onClick={() => handleReupload(doc.id, doc.document_type)}
                      >
                        Re-upload
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        size="small"
                        fullWidth
                        startIcon={<Download />}
                        onClick={() => handleDownload(doc.id, doc.file_name)}
                      >
                        Download
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
            {documents.filter(d => !d.is_college_issued).length === 0 && (
              <Grid item xs={12}>
                <Box sx={{ py: 3, textAlign: 'center', bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">You haven't uploaded any documents yet.</Typography>
                </Box>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={openUpload} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{reuploadId ? 'Replace Document' : 'Upload Document'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              select
              label="Document Type"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              fullWidth
              SelectProps={{ native: true }}
            >
              <option value="">Select document type</option>
              {documentTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </TextField>

            <Box sx={{ border: '2px dashed grey.300', borderRadius: 1, p: 3, textAlign: 'center', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
              />
              {selectedFiles.length > 0 ? (
                <Box>
                  <Typography fontWeight="bold">{selectedFiles.length} file(s) selected</Typography>
                  {selectedFiles.map((file, index) => (
                    <Typography key={index} variant="body2" color="text.secondary">
                      {file.name}
                    </Typography>
                  ))}
                </Box>
              ) : (
                <>
                  <CloudUpload sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                  <Typography>Click to select files</Typography>
                  <Typography variant="caption" color="text.secondary">PDF, JPG, PNG (max 10MB each)</Typography>
                </>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleUpload} 
            disabled={uploading || selectedFiles.length === 0 || !documentType}
          >
            {uploading ? 'Uploading...' : (reuploadId ? 'Replace' : (selectedFiles.length > 1 ? `Upload ${selectedFiles.length} Files` : 'Upload'))}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Container>
  );
};

export default StudentDocuments;
