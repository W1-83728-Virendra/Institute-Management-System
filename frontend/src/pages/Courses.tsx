import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Grid, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Snackbar, Alert, IconButton, Switch, FormControlLabel
} from '@mui/material';
import { Add, Edit, Delete, School } from '@mui/icons-material';
import { coursesAPI } from '../services/api';

interface Course {
  id: number;
  name: string;
  code: string;
  description: string;
  duration_years: number;
  is_active: boolean;
  student_count: number;
  created_at: string;
}

const Courses = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    duration_years: 3,
    is_active: true
  });

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await coursesAPI.getAll({ page_size: 100 });
      setCourses(response.data.items || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (course?: Course) => {
    if (course) {
      setEditingCourse(course);
      setFormData({
        name: course.name,
        code: course.code,
        description: course.description || '',
        duration_years: course.duration_years,
        is_active: course.is_active
      });
    } else {
      setEditingCourse(null);
      setFormData({
        name: '',
        code: '',
        description: '',
        duration_years: 3,
        is_active: true
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCourse(null);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.code) {
      setSnackbar({ open: true, message: 'Name and Code are required', severity: 'error' });
      return;
    }

    try {
      if (editingCourse) {
        await coursesAPI.update(editingCourse.id, formData);
        setSnackbar({ open: true, message: 'Course updated successfully', severity: 'success' });
      } else {
        await coursesAPI.create(formData);
        setSnackbar({ open: true, message: 'Course created successfully', severity: 'success' });
      }
      handleCloseDialog();
      fetchCourses();
    } catch (error: any) {
      setSnackbar({ open: true, message: error.response?.data?.detail || 'Operation failed', severity: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this course?')) return;

    try {
      const response = await coursesAPI.delete(id);
      setSnackbar({ open: true, message: response.data?.message || 'Course deleted', severity: 'success' });
      fetchCourses();
    } catch (error: any) {
      setSnackbar({ open: true, message: error.response?.data?.detail || 'Delete failed', severity: 'error' });
    }
  };

  const handleToggleActive = async (course: Course) => {
    try {
      await coursesAPI.update(course.id, { is_active: !course.is_active });
      fetchCourses();
    } catch (error: any) {
      setSnackbar({ open: true, message: error.response?.data?.detail || 'Update failed', severity: 'error' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          📚 Course Management
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()}>
          Add Course
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: '#667eea20', color: '#667eea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <School />
              </Box>
              <Box>
                <Typography variant="h4">{total}</Typography>
                <Typography variant="body2" color="text.secondary">Total Courses</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: '#10b98120', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <School />
              </Box>
              <Box>
                <Typography variant="h4">{courses.filter(c => c.is_active).length}</Typography>
                <Typography variant="body2" color="text.secondary">Active Courses</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f9fafb' }}>
                  <TableCell>Course Name</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Students</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.id} hover>
                    <TableCell>
                      <Typography fontWeight="bold">{course.name}</Typography>
                      {course.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {course.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={course.code} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{course.duration_years} Years</TableCell>
                    <TableCell>{course.student_count}</TableCell>
                    <TableCell>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={course.is_active}
                            onChange={() => handleToggleActive(course)}
                            color="primary"
                          />
                        }
                        label={course.is_active ? 'Active' : 'Inactive'}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton size="small" color="primary" onClick={() => handleOpenDialog(course)}>
                          <Edit />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(course.id)}>
                          <Delete />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {courses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No courses found. Add your first course!</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCourse ? 'Edit Course' : 'Add New Course'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Course Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Bachelor of Commerce"
            />
            <TextField
              label="Course Code"
              fullWidth
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g., BCOM"
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the course"
            />
            <TextField
              label="Duration (Years)"
              type="number"
              fullWidth
              value={formData.duration_years}
              onChange={(e) => setFormData({ ...formData, duration_years: parseInt(e.target.value) || 3 })}
              inputProps={{ min: 1, max: 6 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {editingCourse ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Courses;
