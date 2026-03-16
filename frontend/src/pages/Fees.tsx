import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Grid, MenuItem, Snackbar, Alert, Autocomplete, FormControl, InputLabel, Select
} from '@mui/material';
import { Add as AddIcon, Send as SendIcon, Visibility as ViewIcon, Group as GroupIcon, Search as SearchIcon, FilterList as FilterIcon, Clear as ClearIcon } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchFees, fetchDashboardStats, payFee, createFee } from '../store/slices/feesSlice';
import { fetchStudents } from '../store/slices/studentsSlice';
import { feesAPI } from '../services/api';

// ========================================================================
// Interface for filter state
// ========================================================================
interface FeeFilters {
  search: string;
  status: string;
  fee_type: string;
  course: string;
  start_date: string;
  end_date: string;
  sort_by: string;
  sort_order: 'asc' | 'desc';
}

const Fees = () => {
  const dispatch = useAppDispatch();
  const { fees, total, loading, dashboard } = useAppSelector((state: any) => state.fees);
  const { students } = useAppSelector((state: any) => state.students);
  
  // ========================================================================
  // Filter state - for filtering the fees table
  // ========================================================================
  const [filters, setFilters] = useState<FeeFilters>({
    search: '',
    status: '',
    fee_type: '',
    course: '',
    start_date: '',
    end_date: '',
    sort_by: 'due_date',
    sort_order: 'desc'
  });
  
  const [openDialog, setOpenDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [openBulkDialog, setOpenBulkDialog] = useState(false);
  const [selectedFee, setSelectedFee] = useState<any>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [feeForm, setFeeForm] = useState({ selectedStudent: null as any, fee_type: 'Tuition Fee', amount: '', due_date: '', description: '' });
  const [bulkForm, setBulkForm] = useState({ course_id: '', fee_type: 'Tuition Fee', amount: '', due_date: '', academic_year: '2024-2025', semester: 1, description: '' });

  // ========================================================================
  // Fetch fees and dashboard on mount - with current filters
  // ========================================================================
  useEffect(() => {
    // Build filter params - only include non-empty values
    const params: any = {};
    if (filters.search) params.search = filters.search;
    if (filters.status) params.status = filters.status;
    if (filters.fee_type) params.fee_type = filters.fee_type;
    if (filters.course) params.course = filters.course;
    if (filters.start_date) params.start_date = filters.start_date;
    if (filters.end_date) params.end_date = filters.end_date;
    if (filters.sort_by) params.sort_by = filters.sort_by;
    if (filters.sort_order) params.sort_order = filters.sort_order;
    
    dispatch(fetchFees(params));
    dispatch(fetchDashboardStats());
  }, [dispatch]);

  // ========================================================================
  // Handle filter apply - fetch fees with current filters
  // ========================================================================
  const handleApplyFilters = () => {
    const params: any = {};
    if (filters.search) params.search = filters.search;
    if (filters.status) params.status = filters.status;
    if (filters.fee_type) params.fee_type = filters.fee_type;
    if (filters.course) params.course = filters.course;
    if (filters.start_date) params.start_date = filters.start_date;
    if (filters.end_date) params.end_date = filters.end_date;
    if (filters.sort_by) params.sort_by = filters.sort_by;
    if (filters.sort_order) params.sort_order = filters.sort_order;
    
    dispatch(fetchFees(params));
  };

  // ========================================================================
  // Clear all filters
  // ========================================================================
  const handleClearFilters = () => {
    setFilters({
      search: '',
      status: '',
      fee_type: '',
      course: '',
      start_date: '',
      end_date: '',
      sort_by: 'due_date',
      sort_order: 'desc'
    });
    dispatch(fetchFees({}));
  };

  const handlePayFee = async (fee: any) => {
    try {
      await dispatch(payFee({ 
        id: fee.id, 
        data: { 
          fee_id: fee.id,
          amount: fee.amount,
          payment_method: 'cash', 
          notes: 'Paid via admin' 
        } 
      })).unwrap();
      setSnackbar({ open: true, message: 'Fee marked as paid', severity: 'success' });
      dispatch(fetchFees({}));
      dispatch(fetchDashboardStats());
    } catch (error: any) {
      setSnackbar({ open: true, message: error || 'Payment failed', severity: 'error' });
    }
  };

  const handleSendReminder = () => {
    setSnackbar({ open: true, message: 'Reminders sent to all students with pending fees', severity: 'success' });
  };

  const handleViewFee = (fee: any) => {
    setSelectedFee(fee);
    setOpenViewDialog(true);
  };

  const openAddFeeDialog = () => {
    // Fetch students when opening dialog
    dispatch(fetchStudents({}));
    setOpenDialog(true);
  };

  const handleBulkCreate = async () => {
    if (!bulkForm.course_id || !bulkForm.amount || !bulkForm.due_date) {
      setSnackbar({ open: true, message: 'Please fill all required fields', severity: 'error' });
      return;
    }
    try {
      const response = await feesAPI.bulkCreate({
        course_id: bulkForm.course_id, // Send course name directly
        fee_type: bulkForm.fee_type,
        amount: parseFloat(bulkForm.amount),
        due_date: bulkForm.due_date,
        academic_year: bulkForm.academic_year,
        semester: bulkForm.semester,
        description: bulkForm.description
      });
      setSnackbar({ open: true, message: response.data.message, severity: 'success' });
      setOpenBulkDialog(false);
      setBulkForm({ course_id: '', fee_type: 'Tuition Fee', amount: '', due_date: '', academic_year: '2024-2025', semester: 1, description: '' });
      dispatch(fetchFees({}));
      dispatch(fetchDashboardStats());
    } catch (error: any) {
      setSnackbar({ open: true, message: error?.response?.data?.detail || 'Failed to create bulk fees', severity: 'error' });
    }
  };

  const handleCreateFee = async () => {
    if (!feeForm.selectedStudent || !feeForm.amount || !feeForm.due_date) {
      setSnackbar({ open: true, message: 'Please fill all required fields', severity: 'error' });
      return;
    }
    try {
      await dispatch(createFee({
        student_id: feeForm.selectedStudent.id,
        fee_type: feeForm.fee_type,
        amount: parseFloat(feeForm.amount),
        due_date: feeForm.due_date,
        description: feeForm.description,
        semester: 1,
        academic_year: '2024-25'
      })).unwrap();
      setSnackbar({ open: true, message: 'Fee created successfully', severity: 'success' });
      setOpenDialog(false);
      setFeeForm({ selectedStudent: null, fee_type: 'Tuition Fee', amount: '', due_date: '', description: '' });
      dispatch(fetchFees({}));
      dispatch(fetchDashboardStats());
    } catch (error: any) {
      setSnackbar({ open: true, message: error || 'Failed to create fee', severity: 'error' });
    }
  };

  const formatCurrency = (amount: number) => `₹${amount?.toLocaleString() || 0}`;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">Fee Management</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<SendIcon />} onClick={handleSendReminder}>Send Reminder</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAddFeeDialog}>
            Add Fee
          </Button>
          <Button variant="outlined" startIcon={<GroupIcon />} onClick={() => setOpenBulkDialog(true)}>
            Bulk Create
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography color="text.secondary">Total Collected</Typography>
            <Typography variant="h4">{formatCurrency(dashboard?.total_fee_collected)}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography color="text.secondary">Pending</Typography>
            <Typography variant="h4">{formatCurrency(dashboard?.total_fee_pending)}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography color="text.secondary">Overdue</Typography>
            <Typography variant="h4">{dashboard?.overdue_fees || 0}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card><CardContent>
            <Typography color="text.secondary">Paid This Month</Typography>
            <Typography variant="h4">{dashboard?.payments_today || 0}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      {/* ========================================================================
        FILTER SECTION - Advanced filtering for fees table
        ======================================================================== */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          {/* Filter header with title and clear button */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterIcon color="primary" />
              <Typography variant="h6">Filter Fees</Typography>
            </Box>
            <Button 
              size="small" 
              startIcon={<ClearIcon />} 
              onClick={handleClearFilters}
              color="secondary"
            >
              Clear Filters
            </Button>
          </Box>
          
          {/* Filter controls - responsive grid */}
          <Grid container spacing={2}>
            {/* Search by student name or ID */}
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Search Student"
                placeholder="Name or Admission No."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>

            {/* Payment Status Filter */}
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="PAID">Paid</MenuItem>
                  <MenuItem value="PENDING">Pending</MenuItem>
                  <MenuItem value="OVERDUE">Overdue</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Fee Type Filter */}
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Fee Type</InputLabel>
                <Select
                  value={filters.fee_type}
                  label="Fee Type"
                  onChange={(e) => setFilters({ ...filters, fee_type: e.target.value })}
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="Tuition Fee">Tuition Fee</MenuItem>
                  <MenuItem value="Lab Fee">Lab Fee</MenuItem>
                  <MenuItem value="Library Fee">Library Fee</MenuItem>
                  <MenuItem value="Exam Fee">Exam Fee</MenuItem>
                  <MenuItem value="Hostel Fee">Hostel Fee</MenuItem>
                  <MenuItem value="Transport Fee">Transport Fee</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Course/Batch Filter */}
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Course</InputLabel>
                <Select
                  value={filters.course}
                  label="Course"
                  onChange={(e) => setFilters({ ...filters, course: e.target.value })}
                >
                  <MenuItem value="">All Courses</MenuItem>
                  <MenuItem value="B.Tech">B.Tech</MenuItem>
                  <MenuItem value="M.Tech">M.Tech</MenuItem>
                  <MenuItem value="BBA">BBA</MenuItem>
                  <MenuItem value="MBA">MBA</MenuItem>
                  <MenuItem value="B.Sc">B.Sc</MenuItem>
                  <MenuItem value="M.Sc">M.Sc</MenuItem>
                  <MenuItem value="B.Com">B.Com</MenuItem>
                  <MenuItem value="M.Com">M.Com</MenuItem>
                  <MenuItem value="BA">BA</MenuItem>
                  <MenuItem value="MA">MA</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Date Range - Start Date */}
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="From Date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* Date Range - End Date */}
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="To Date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* Sort By */}
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={filters.sort_by}
                  label="Sort By"
                  onChange={(e) => setFilters({ ...filters, sort_by: e.target.value })}
                >
                  <MenuItem value="due_date">Due Date</MenuItem>
                  <MenuItem value="amount">Amount</MenuItem>
                  <MenuItem value="status">Status</MenuItem>
                  <MenuItem value="fee_type">Fee Type</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Sort Order */}
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Order</InputLabel>
                <Select
                  value={filters.sort_order}
                  label="Order"
                  onChange={(e) => setFilters({ ...filters, sort_order: e.target.value as 'asc' | 'desc' })}
                >
                  <MenuItem value="desc">Descending</MenuItem>
                  <MenuItem value="asc">Ascending</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Apply Filters Button */}
            <Grid item xs={12} sm={12} md={4} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button 
                variant="contained" 
                onClick={handleApplyFilters}
                startIcon={<SearchIcon />}
                fullWidth
                sx={{ height: '40px' }}
              >
                Apply Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>All Student Fees</Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f9fafb' }}>
                  <TableCell>Student</TableCell>
                  <TableCell>Fee Type</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {fees.map((fee: any) => (
                  <TableRow key={fee.id} hover>
                    <TableCell>{fee.student?.name || 'N/A'}</TableCell>
                    <TableCell>{fee.fee_type}</TableCell>
                    <TableCell>{formatCurrency(fee.amount)}</TableCell>
                    <TableCell>{new Date(fee.due_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Chip
                        color={fee.status === 'paid' ? 'success' : fee.status === 'overdue' ? 'error' : 'warning'}
                        label={fee.status}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Button size="small" startIcon={<ViewIcon />} onClick={() => handleViewFee(fee)}>View</Button>
                      {fee.status !== 'paid' && (
                        <Button size="small" variant="contained" color="success" onClick={() => handlePayFee(fee)}>Mark Paid</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Fee</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Autocomplete
              options={students}
              getOptionLabel={(option: any) => option ? `${option.first_name} ${option.last_name} (${option.admission_no})` : ''}
              value={feeForm.selectedStudent}
              onChange={(_, newValue) => setFeeForm({...feeForm, selectedStudent: newValue})}
              renderInput={(params) => <TextField {...params} label="Select Student" required />}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box>
                    <Typography variant="body1">{option.first_name} {option.last_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{option.admission_no} • {option.course}</Typography>
                  </Box>
                </li>
              )}
            />
            <TextField label="Fee Type" select fullWidth value={feeForm.fee_type} onChange={(e) => setFeeForm({...feeForm, fee_type: e.target.value})}>
              <MenuItem value="Tuition Fee">Tuition Fee</MenuItem>
              <MenuItem value="Lab Fee">Lab Fee</MenuItem>
              <MenuItem value="Library Fee">Library Fee</MenuItem>
              <MenuItem value="Exam Fee">Exam Fee</MenuItem>
              <MenuItem value="Hostel Fee">Hostel Fee</MenuItem>
              <MenuItem value="Transport Fee">Transport Fee</MenuItem>
            </TextField>
            <TextField label="Amount" type="number" fullWidth value={feeForm.amount} onChange={(e) => setFeeForm({...feeForm, amount: e.target.value})} placeholder="25000" />
            <TextField label="Due Date" type="date" fullWidth value={feeForm.due_date} onChange={(e) => setFeeForm({...feeForm, due_date: e.target.value})} InputLabelProps={{ shrink: true }} />
            <TextField label="Description" multiline rows={2} fullWidth value={feeForm.description} onChange={(e) => setFeeForm({...feeForm, description: e.target.value})} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateFee}>Create Fee</Button>
        </DialogActions>
      </Dialog>

      {/* View Fee Dialog */}
      <Dialog open={openViewDialog} onClose={() => setOpenViewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Fee Details</DialogTitle>
        <DialogContent>
          {selectedFee && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Typography><strong>Student:</strong> {selectedFee.student?.name || 'N/A'}</Typography>
              <Typography><strong>Fee Type:</strong> {selectedFee.fee_type}</Typography>
              <Typography><strong>Amount:</strong> {formatCurrency(selectedFee.amount)}</Typography>
              <Typography><strong>Due Date:</strong> {new Date(selectedFee.due_date).toLocaleDateString()}</Typography>
              <Typography><strong>Status:</strong> 
                <Chip
                  color={selectedFee.status === 'paid' ? 'success' : selectedFee.status === 'overdue' ? 'error' : 'warning'}
                  label={selectedFee.status}
                  size="small"
                />
              </Typography>
              {selectedFee.semester && <Typography><strong>Semester:</strong> {selectedFee.semester}</Typography>}
              {selectedFee.academic_year && <Typography><strong>Academic Year:</strong> {selectedFee.academic_year}</Typography>}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>Close</Button>
          {selectedFee?.status !== 'paid' && (
            <Button variant="contained" color="success" onClick={() => {
              handlePayFee(selectedFee);
              setOpenViewDialog(false);
            }}>Mark as Paid</Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Bulk Create Dialog */}
      <Dialog open={openBulkDialog} onClose={() => setOpenBulkDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bulk Create Fees for Course</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              select
              label="Course"
              value={bulkForm.course_id}
              onChange={(e) => setBulkForm({ ...bulkForm, course_id: e.target.value })}
              fullWidth
              SelectProps={{ native: true }}
            >
              <option value="">Select Course</option>
              <option value="B.Tech">B.Tech</option>
              <option value="M.Tech">M.Tech</option>
              <option value="BBA">BBA</option>
              <option value="MBA">MBA</option>
              <option value="B.Sc">B.Sc</option>
              <option value="M.Sc">M.Sc</option>
              <option value="B.Com">B.Com</option>
              <option value="M.Com">M.Com</option>
              <option value="BA">BA</option>
              <option value="MA">MA</option>
            </TextField>
            <TextField
              select
              label="Fee Type"
              value={bulkForm.fee_type}
              onChange={(e) => setBulkForm({ ...bulkForm, fee_type: e.target.value })}
              fullWidth
              SelectProps={{ native: true }}
            >
              <option value="Tuition Fee">Tuition Fee</option>
              <option value="Lab Fee">Lab Fee</option>
              <option value="Library Fee">Library Fee</option>
              <option value="Exam Fee">Exam Fee</option>
              <option value="Hostel Fee">Hostel Fee</option>
              <option value="Transport Fee">Transport Fee</option>
            </TextField>
            <TextField
              label="Amount (₹)"
              type="number"
              value={bulkForm.amount}
              onChange={(e) => setBulkForm({ ...bulkForm, amount: e.target.value })}
              fullWidth
            />
            <TextField
              label="Due Date"
              type="date"
              value={bulkForm.due_date}
              onChange={(e) => setBulkForm({ ...bulkForm, due_date: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Academic Year"
              value={bulkForm.academic_year}
              onChange={(e) => setBulkForm({ ...bulkForm, academic_year: e.target.value })}
              fullWidth
            />
            <TextField
              label="Semester"
              type="number"
              value={bulkForm.semester}
              onChange={(e) => setBulkForm({ ...bulkForm, semester: parseInt(e.target.value) })}
              fullWidth
            />
            <TextField
              label="Description (optional)"
              value={bulkForm.description}
              onChange={(e) => setBulkForm({ ...bulkForm, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBulkDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleBulkCreate}>Create Fees for All Students</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default Fees;
