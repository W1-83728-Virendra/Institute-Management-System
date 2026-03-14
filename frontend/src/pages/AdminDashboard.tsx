import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Button, Grid
} from '@mui/material';
import { People as PeopleIcon, AttachMoney as MoneyIcon, Description as DocIcon, Warning as WarningIcon } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchDashboardStats, fetchFeeOverview } from '../store/slices/feesSlice';
import { fetchDocuments } from '../store/slices/documentsSlice';
import { feesAPI } from '../services/api';

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

const AdminDashboard = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const { dashboard, overview } = useAppSelector((state: any) => state.fees);
  const { stats: docStats } = useAppSelector((state: any) => state.documents);

  useEffect(() => {
    dispatch(fetchDashboardStats());
    dispatch(fetchFeeOverview());
    dispatch(fetchDocuments({}));
  }, [dispatch]);

  const formatCurrency = (amount: number) => {
    if (!amount) return '₹0';
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return `₹${amount.toLocaleString()}`;
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>Dashboard</Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<PeopleIcon sx={{ fontSize: 28 }} />} value={dashboard?.total_students || 0} label="Total Students" color="primary" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<MoneyIcon sx={{ fontSize: 28 }} />} value={formatCurrency(dashboard?.total_fee_collected)} label="Fee Collected" color="success" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<WarningIcon sx={{ fontSize: 28 }} />} value={formatCurrency(dashboard?.total_fee_pending)} label="Pending Fees" color="warning" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<DocIcon sx={{ fontSize: 28 }} />} value={dashboard?.pending_documents || 0} label="Pending Docs" color="secondary" />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Recent Alerts</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Chip color="error" label={`${dashboard?.overdue_fees || 0} students have fees overdue by 15+ days`} sx={{ justifyContent: 'flex-start' }} />
                <Chip color="warning" label={`${docStats?.pending || 0} documents pending verification`} sx={{ justifyContent: 'flex-start' }} />
                <Chip color="success" label={`${dashboard?.payments_today || 0} fee payments received today`} sx={{ justifyContent: 'flex-start' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Quick Actions</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}><Button variant="contained" fullWidth onClick={() => navigate('/admin/fees')}>Add Fee</Button></Grid>
                <Grid item xs={6}><Button variant="outlined" fullWidth onClick={() => navigate('/admin/documents')}>Upload Doc</Button></Grid>
                <Grid item xs={6}><Button variant="outlined" fullWidth onClick={() => navigate('/admin/students')}>Add Student</Button></Grid>
                <Grid item xs={6}><Button variant="outlined" fullWidth onClick={async () => {
                  setExporting(true);
                  try {
                    const response = await feesAPI.exportReport();
                    const { filename, data } = response.data;
                    const blob = new Blob([data], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    window.URL.revokeObjectURL(url);
                  } catch (error) {
                    alert('Failed to export report');
                  } finally {
                    setExporting(false);
                  }
                }} disabled={exporting}>{exporting ? 'Exporting...' : 'Export Report'}</Button></Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Fee Overview by Course</Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f9fafb' }}>
                  <TableCell>Course</TableCell>
                  <TableCell>Students</TableCell>
                  <TableCell>Total Fee</TableCell>
                  <TableCell>Collected</TableCell>
                  <TableCell>Pending</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {overview.map((item: any) => (
                  <TableRow key={item.course} hover>
                    <TableCell>{item.course}</TableCell>
                    <TableCell>{item.total_students}</TableCell>
                    <TableCell>{formatCurrency(item.total_fee)}</TableCell>
                    <TableCell>{formatCurrency(item.collected)}</TableCell>
                    <TableCell>{formatCurrency(item.pending)}</TableCell>
                    <TableCell>
                      <Chip color={item.collection_rate >= 90 ? 'success' : item.collection_rate >= 80 ? 'warning' : 'error'} label={`${item.collection_rate}%`} size="small" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AdminDashboard;
