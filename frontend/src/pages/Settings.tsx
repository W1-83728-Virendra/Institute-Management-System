import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid,
  Switch, FormControlLabel, Divider, Snackbar, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem
} from '@mui/material';
import { Settings as SettingsIcon, Save as SaveIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Description as DocIcon } from '@mui/icons-material';
import { documentsAPI } from '../services/api';

const Settings = () => {
  const [settings, setSettings] = useState({
    instituteName: 'Institute Management System',
    instituteAddress: '123 Education Lane, City, State 123456',
    instituteEmail: 'admin@institute.com',
    institutePhone: '+91 9876543210',
    academicYear: '2024-2025',
    semester1Start: '2024-06-01',
    semester1End: '2024-11-30',
    semester2Start: '2024-12-01',
    semester2End: '2025-05-31',
    emailNotifications: true,
    smsNotifications: true,
    feeReminders: true,
    documentAlerts: true,
  });
  
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Document Types State
  const [documentTypes, setDocumentTypes] = useState<any[]>([]);
  const [docTypeDialog, setDocTypeDialog] = useState<{ open: boolean; mode: 'add' | 'edit'; data: any }>({ open: false, mode: 'add', data: null });
  const [docTypeForm, setDocTypeForm] = useState({
    value: '',
    label: '',
    category: 'other',
    description: '',
    is_required: false,
    is_active: true,
    display_order: 0
  });

  const docCategories = [
    { value: 'academic', label: 'Academic' },
    { value: 'id_proof', label: 'ID Proof' },
    { value: 'certificate', label: 'Certificate' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    fetchDocumentTypes();
  }, []);

  const fetchDocumentTypes = async () => {
    try {
      const res = await documentsAPI.getAllTypes();
      setDocumentTypes(res.data?.document_types || []);
    } catch (error) {
      console.error('Error fetching document types:', error);
    }
  };

  const handleDocTypeSubmit = async () => {
    try {
      if (docTypeDialog.mode === 'add') {
        await documentsAPI.createType(docTypeForm);
        setSnackbar({ open: true, message: 'Document type created successfully', severity: 'success' });
      } else if (docTypeDialog.data) {
        await documentsAPI.updateType(docTypeDialog.data.id, docTypeForm);
        setSnackbar({ open: true, message: 'Document type updated successfully', severity: 'success' });
      }
      setDocTypeDialog({ open: false, mode: 'add', data: null });
      setDocTypeForm({ value: '', label: '', category: 'other', description: '', is_required: false, is_active: true, display_order: 0 });
      fetchDocumentTypes();
    } catch (error: any) {
      setSnackbar({ open: true, message: error.response?.data?.detail || 'Error saving document type', severity: 'error' });
    }
  };

  const handleDeleteDocType = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this document type?')) return;
    try {
      await documentsAPI.deleteType(id);
      setSnackbar({ open: true, message: 'Document type deleted successfully', severity: 'success' });
      fetchDocumentTypes();
    } catch (error) {
      setSnackbar({ open: true, message: 'Error deleting document type', severity: 'error' });
    }
  };

  const openEditDocType = (docType: any) => {
    setDocTypeForm({
      value: docType.value,
      label: docType.label,
      category: docType.category,
      description: docType.description || '',
      is_required: docType.is_required,
      is_active: docType.is_active,
      display_order: docType.display_order
    });
    setDocTypeDialog({ open: true, mode: 'edit', data: docType });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked, type } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = () => {
    // In a real app, this would save to backend
    console.log('Saving settings:', settings);
    setSnackbar({ open: true, message: 'Settings saved successfully', severity: 'success' });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">Settings</Typography>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>
          Save Changes
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Institute Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon /> Institute Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Institute Name"
                  name="instituteName"
                  value={settings.instituteName}
                  onChange={handleChange}
                  fullWidth
                />
                <TextField
                  label="Address"
                  name="instituteAddress"
                  value={settings.instituteAddress}
                  onChange={handleChange}
                  fullWidth
                  multiline
                  rows={2}
                />
                <TextField
                  label="Email"
                  name="instituteEmail"
                  value={settings.instituteEmail}
                  onChange={handleChange}
                  fullWidth
                  type="email"
                />
                <TextField
                  label="Phone"
                  name="institutePhone"
                  value={settings.institutePhone}
                  onChange={handleChange}
                  fullWidth
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Academic Calendar */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon /> Academic Calendar
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Academic Year"
                  name="academicYear"
                  value={settings.academicYear}
                  onChange={handleChange}
                  fullWidth
                />
                <Typography variant="subtitle2" color="text.secondary">Semester 1</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      label="Start Date"
                      name="semester1Start"
                      value={settings.semester1Start}
                      onChange={handleChange}
                      fullWidth
                      type="date"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="End Date"
                      name="semester1End"
                      value={settings.semester1End}
                      onChange={handleChange}
                      fullWidth
                      type="date"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>
                <Typography variant="subtitle2" color="text.secondary">Semester 2</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      label="Start Date"
                      name="semester2Start"
                      value={settings.semester2Start}
                      onChange={handleChange}
                      fullWidth
                      type="date"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      label="End Date"
                      name="semester2End"
                      value={settings.semester2End}
                      onChange={handleChange}
                      fullWidth
                      type="date"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Notification Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon /> Notifications
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.emailNotifications}
                      onChange={handleChange}
                      name="emailNotifications"
                    />
                  }
                  label="Email Notifications"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.smsNotifications}
                      onChange={handleChange}
                      name="smsNotifications"
                    />
                  }
                  label="SMS Notifications"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.feeReminders}
                      onChange={handleChange}
                      name="feeReminders"
                    />
                  }
                  label="Fee Payment Reminders"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.documentAlerts}
                      onChange={handleChange}
                      name="documentAlerts"
                    />
                  }
                  label="Document Verification Alerts"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* System Settings */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DocIcon /> Document Types Management
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button 
                  variant="contained" 
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setDocTypeForm({ value: '', label: '', category: 'other', description: '', is_required: false, is_active: true, display_order: 0 });
                    setDocTypeDialog({ open: true, mode: 'add', data: null });
                  }}
                >
                  Add Document Type
                </Button>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Value</TableCell>
                      <TableCell>Label</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Required</TableCell>
                      <TableCell>Active</TableCell>
                      <TableCell>Order</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {documentTypes.map((docType) => (
                      <TableRow key={docType.id}>
                        <TableCell>{docType.value}</TableCell>
                        <TableCell>{docType.label}</TableCell>
                        <TableCell>{docType.category}</TableCell>
                        <TableCell>{docType.is_required ? 'Yes' : 'No'}</TableCell>
                        <TableCell>{docType.is_active ? 'Yes' : 'No'}</TableCell>
                        <TableCell>{docType.display_order}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => openEditDocType(docType)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteDocType(docType.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Document Type Dialog */}
      <Dialog open={docTypeDialog.open} onClose={() => setDocTypeDialog({ open: false, mode: 'add', data: null })} maxWidth="sm" fullWidth>
        <DialogTitle>{docTypeDialog.mode === 'add' ? 'Add' : 'Edit'} Document Type</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Value (unique identifier)"
              value={docTypeForm.value}
              onChange={(e) => setDocTypeForm({ ...docTypeForm, value: e.target.value })}
              fullWidth
              placeholder="e.g., 10th_marksheet"
              disabled={docTypeDialog.mode === 'edit'}
            />
            <TextField
              label="Label (display name)"
              value={docTypeForm.label}
              onChange={(e) => setDocTypeForm({ ...docTypeForm, label: e.target.value })}
              fullWidth
              placeholder="e.g., 10th Marksheet"
            />
            <TextField
              label="Category"
              select
              value={docTypeForm.category}
              onChange={(e) => setDocTypeForm({ ...docTypeForm, category: e.target.value })}
              fullWidth
            >
              {docCategories.map((cat) => (
                <MenuItem key={cat.value} value={cat.value}>{cat.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Description"
              value={docTypeForm.description}
              onChange={(e) => setDocTypeForm({ ...docTypeForm, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Display Order"
              type="number"
              value={docTypeForm.display_order}
              onChange={(e) => setDocTypeForm({ ...docTypeForm, display_order: parseInt(e.target.value) || 0 })}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={docTypeForm.is_required}
                  onChange={(e) => setDocTypeForm({ ...docTypeForm, is_required: e.target.checked })}
                />
              }
              label="Required Document"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={docTypeForm.is_active}
                  onChange={(e) => setDocTypeForm({ ...docTypeForm, is_active: e.target.checked })}
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDocTypeDialog({ open: false, mode: 'add', data: null })}>Cancel</Button>
          <Button variant="contained" onClick={handleDocTypeSubmit}>
            {docTypeDialog.mode === 'add' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
      
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default Settings;
