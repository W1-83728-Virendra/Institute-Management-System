import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, InputAdornment, Snackbar, Alert, MenuItem
} from '@mui/material';
import { Search as SearchIcon, Add as AddIcon, Visibility as ViewIcon, Edit as EditIcon } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchStudents, createStudent, updateStudent } from '../store/slices/studentsSlice';
import { coursesAPI } from '../services/api';

interface StudentFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  course: string;
  semester: number;
  gender: string;
  caste_category: string;
  academic_year: string;
  admission_quota: string;
  password: string;
}

// Static options
const casteOptions = ['General', 'OBC', 'SC', 'ST', 'Other'];
const quotaOptions = ['Management', 'Government', 'NRI', 'Sports', 'Defense', 'Other'];
const genderOptions = ['Male', 'Female', 'Other'];
const academicYears = ['2024-2025', '2025-2026', '2026-2027', '2027-2028', '2028-2029', '2029-2030'];

const getAcademicYears = () => {
  const years = [];
  const currentYear = new Date().getFullYear();
  for (let i = -1; i <= 2; i++) {
    const year = currentYear + i;
    years.push(`${year}-${year + 1}`);
  }
  return years;
};

const Students = () => {
  const dispatch = useAppDispatch();
  const { students, total, loading } = useAppSelector((state: any) => state.students);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openDialog, setOpenDialog] = useState(false);
  const [viewStudent, setViewStudent] = useState<any>(null);
  const [editStudent, setEditStudent] = useState<any>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [courses, setCourses] = useState<{id: number, name: string, code: string}[]>([]);
  const [formData, setFormData] = useState<StudentFormData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    course: '',
    semester: 1,
    gender: '',
    caste_category: '',
    academic_year: '',
    admission_quota: '',
    password: ''
  });

  useEffect(() => {
    dispatch(fetchStudents({ page, search }));
    // Fetch courses for dropdown
    coursesAPI.getList()
      .then(res => setCourses(res.data || []))
      .catch(err => console.error('Failed to fetch courses', err));
  }, [dispatch, page, search]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.password || !formData.course) {
      setSnackbar({ open: true, message: 'Please fill all required fields', severity: 'error' });
      return;
    }
    
    try {
      await dispatch(createStudent({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone,
        course: formData.course,
        semester: formData.semester,
        gender: formData.gender,
        caste_category: formData.caste_category,
        academic_year: formData.academic_year,
        admission_quota: formData.admission_quota,
        password: formData.password
      })).unwrap();
      
      setSnackbar({ open: true, message: 'Student created successfully', severity: 'success' });
      setOpenDialog(false);
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        course: '',
        semester: 1,
        gender: '',
        caste_category: '',
        academic_year: '',
        admission_quota: '',
        password: ''
      });
      dispatch(fetchStudents({ page, search }));
    } catch (error: any) {
      setSnackbar({ open: true, message: error || 'Failed to create student', severity: 'error' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">Students</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenDialog(true)}>
          Add Student
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ display: 'flex', gap: 2 }}>
          <TextField
            placeholder="Search by name, admission no, phone, guardian name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                dispatch(fetchStudents({ page: 1, search }));
                setPage(1);
              }
            }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
            }}
            sx={{ flex: 1 }}
          />
          <Button variant="contained" onClick={() => {
            dispatch(fetchStudents({ page: 1, search }));
            setPage(1);
          }}>
            Search
          </Button>
        </CardContent>
      </Card>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f9fafb' }}>
                <TableCell>Admission No</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Course</TableCell>
                <TableCell>Sem</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Fee Status</TableCell>
                <TableCell>Docs</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {students.map((student: any) => (
                <TableRow key={student.id} hover>
                  <TableCell>{student.admission_no}</TableCell>
                  <TableCell>{student.first_name} {student.last_name}</TableCell>
                  <TableCell>{student.course}</TableCell>
                  <TableCell>{student.semester}</TableCell>
                  <TableCell>{student.phone}</TableCell>
                  <TableCell>
                    <Chip
                      color={student.fee_status === 'Paid' ? 'success' : 'error'}
                      label={student.fee_status || 'Pending'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      color={student.document_status === 'Complete' ? 'success' : 'warning'}
                      label={student.document_status || 'Pending'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => setViewStudent(student)}><ViewIcon /></IconButton>
                    <IconButton size="small" onClick={() => setEditStudent(student)}><EditIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Student</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField 
              label="First Name" 
              fullWidth 
              name="first_name"
              value={formData.first_name}
              onChange={handleInputChange}
              required
            />
            <TextField 
              label="Last Name" 
              fullWidth 
              name="last_name"
              value={formData.last_name}
              onChange={handleInputChange}
              required
            />
            <TextField 
              label="Email" 
              type="email" 
              fullWidth 
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
            <TextField 
              label="Password" 
              type="password" 
              fullWidth 
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              helperText="Temporary password for student login"
            />
            <TextField 
              label="Phone" 
              fullWidth 
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
            />
            <TextField 
              label="Course" 
              fullWidth 
              name="course"
              value={formData.course}
              onChange={handleInputChange}
              required
              select
              SelectProps={{ native: true }}
            >
              <option value="">Select Course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </TextField>
            <TextField 
              label="Semester" 
              type="number" 
              fullWidth 
              name="semester"
              value={formData.semester}
              onChange={handleInputChange}
            />
            <TextField 
              label="Gender" 
              fullWidth 
              name="gender"
              value={formData.gender || ''}
              onChange={handleInputChange}
              select
              SelectProps={{ native: true }}
            >
              <option value="">Select Gender</option>
              {genderOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </TextField>
            <TextField 
              label="Caste Category" 
              fullWidth 
              name="caste_category"
              value={formData.caste_category || ''}
              onChange={handleInputChange}
              select
              SelectProps={{ native: true }}
            >
              <option value="">Select Category</option>
              {casteOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </TextField>
            <TextField 
              label="Academic Year" 
              fullWidth 
              name="academic_year"
              value={formData.academic_year || ''}
              onChange={handleInputChange}
              select
              SelectProps={{ native: true }}
            >
              <option value="">Select Academic Year</option>
              {academicYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </TextField>
            <TextField 
              label="Admission Quota" 
              fullWidth 
              name="admission_quota"
              value={formData.admission_quota || ''}
              onChange={handleInputChange}
              select
              SelectProps={{ native: true }}
            >
              <option value="">Select Quota</option>
              {quotaOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* View Student Dialog */}
      <Dialog open={!!viewStudent} onClose={() => setViewStudent(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Student Details</DialogTitle>
        <DialogContent>
          {viewStudent && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Typography><strong>Admission No:</strong> {viewStudent.admission_no}</Typography>
              <Typography><strong>Name:</strong> {viewStudent.first_name} {viewStudent.last_name}</Typography>
              <Typography><strong>Email:</strong> {viewStudent.email}</Typography>
              <Typography><strong>Phone:</strong> {viewStudent.phone}</Typography>
              <Typography><strong>Course:</strong> {viewStudent.course}</Typography>
              <Typography><strong>Semester:</strong> {viewStudent.semester}</Typography>
              <Typography><strong>Gender:</strong> {viewStudent.gender || '-'}</Typography>
              <Typography><strong>Caste Category:</strong> {viewStudent.caste_category || '-'}</Typography>
              <Typography><strong>Academic Year:</strong> {viewStudent.academic_year || '-'}</Typography>
              <Typography><strong>Admission Quota:</strong> {viewStudent.admission_quota || '-'}</Typography>
              <Typography><strong>Fee Status:</strong> {viewStudent.fee_status || 'Pending'}</Typography>
              <Typography><strong>Document Status:</strong> {viewStudent.document_status || 'Pending'}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewStudent(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={!!editStudent} onClose={() => setEditStudent(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Student</DialogTitle>
        <DialogContent>
          {editStudent && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField 
                label="First Name" 
                fullWidth 
                defaultValue={editStudent.first_name}
                id="edit_first_name"
              />
              <TextField 
                label="Last Name" 
                fullWidth 
                defaultValue={editStudent.last_name}
                id="edit_last_name"
              />
              <TextField 
                label="Email" 
                fullWidth 
                defaultValue={editStudent.email}
                id="edit_email"
              />
              <TextField 
                label="Phone" 
                fullWidth 
                defaultValue={editStudent.phone}
                id="edit_phone"
              />
              <TextField 
                label="Course" 
                fullWidth 
                defaultValue={editStudent.course}
                id="edit_course"
                select
                SelectProps={{ native: true }}
              >
                <option value="">Select Course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </TextField>
              <TextField 
                label="Semester" 
                type="number" 
                fullWidth 
                defaultValue={editStudent.semester}
                id="edit_semester"
              />
              <TextField 
                label="Gender" 
                fullWidth 
                defaultValue={editStudent.gender || ''}
                id="edit_gender"
                select
                SelectProps={{ native: true }}
              >
                <option value="">Select Gender</option>
                {genderOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </TextField>
              <TextField 
                label="Caste Category" 
                fullWidth 
                defaultValue={editStudent.caste_category || ''}
                id="edit_caste_category"
                select
                SelectProps={{ native: true }}
              >
                <option value="">Select Category</option>
                {casteOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </TextField>
              <TextField 
                label="Academic Year" 
                fullWidth 
                defaultValue={editStudent.academic_year || ''}
                id="edit_academic_year"
                select
                SelectProps={{ native: true }}
              >
                <option value="">Select Academic Year</option>
                {academicYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </TextField>
              <TextField 
                label="Admission Quota" 
                fullWidth 
                defaultValue={editStudent.admission_quota || ''}
                id="edit_admission_quota"
                select
                SelectProps={{ native: true }}
              >
                <option value="">Select Quota</option>
                {quotaOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </TextField>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditStudent(null)}>Cancel</Button>
          <Button variant="contained" onClick={async () => {
            if (!editStudent) return;
            const first_name = (document.getElementById('edit_first_name') as HTMLInputElement)?.value;
            const last_name = (document.getElementById('edit_last_name') as HTMLInputElement)?.value;
            const email = (document.getElementById('edit_email') as HTMLInputElement)?.value;
            const phone = (document.getElementById('edit_phone') as HTMLInputElement)?.value;
            const course = (document.getElementById('edit_course') as HTMLInputElement)?.value;
            const semester = parseInt((document.getElementById('edit_semester') as HTMLInputElement)?.value || '1');
            const gender = (document.getElementById('edit_gender') as HTMLInputElement)?.value;
            const caste_category = (document.getElementById('edit_caste_category') as HTMLInputElement)?.value;
            const academic_year = (document.getElementById('edit_academic_year') as HTMLInputElement)?.value;
            const admission_quota = (document.getElementById('edit_admission_quota') as HTMLInputElement)?.value;
            
            try {
              await dispatch(updateStudent({
                id: editStudent.id,
                data: {
                  first_name,
                  last_name,
                  phone,
                  course,
                  semester,
                  gender: gender || null,
                  caste_category: caste_category || null,
                  academic_year: academic_year || null,
                  admission_quota: admission_quota || null
                }
              })).unwrap();
              setSnackbar({ open: true, message: 'Student updated successfully', severity: 'success' });
              setEditStudent(null);
              dispatch(fetchStudents({ page, search }));
            } catch (error: any) {
              setSnackbar({ open: true, message: error || 'Failed to update student', severity: 'error' });
            }
          }}>Save</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default Students;
