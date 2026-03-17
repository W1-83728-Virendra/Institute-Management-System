import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Button, Grid } from '@mui/material';
import { AttachMoney, Description, CheckCircle, Receipt, Warning } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { studentFeesAPI, documentsAPI, authAPI } from '../services/api';

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

interface FeeSummary {
  total_paid: number;
  total_pending: number;
  total_overdue: number;
  total_fees: number;
}

interface DocStats {
  total: number;
  verified: number;
  pending: number;
  rejected: number;
  requests_pending: number;
}

interface Activity {
  id: number;
  type: string;
  title: string;
  description: string;
  time: string;
}

const StudentPortal = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector((state: any) => state.auth);
  const [feeSummary, setFeeSummary] = useState<FeeSummary | null>(null);
  const [docStats, setDocStats] = useState<DocStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentProfile, setStudentProfile] = useState<{first_name: string; last_name: string; course: string; semester: number} | null>(null);

  // Fetch student profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await authAPI.getMe();
        if (response.data.student_profile) {
          setStudentProfile(response.data.student_profile);
        }
      } catch (error) {
        console.error('Error fetching student profile:', error);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [feesRes, docsRes] = await Promise.all([
          studentFeesAPI.getMySummary(),
          documentsAPI.getMyStats()
        ]);
        if (feesRes.data) setFeeSummary(feesRes.data);
        if (docsRes.data) setDocStats(docsRes.data);
      } catch (error) {
        console.log('Error fetching student portal data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Build recent activity from actual data
  const recentActivity: Activity[] = [];

  if (feeSummary) {
    if (feeSummary.total_pending > 0) {
      recentActivity.push({
        id: 1,
        type: 'payment',
        title: 'Pending Fees',
        description: `You have ${feeSummary.total_pending > 0 ? '₹' + feeSummary.total_pending.toLocaleString() : 'no'} pending fees`,
        time: 'Due soon'
      });
    }
    if (feeSummary.total_paid > 0) {
      recentActivity.push({
        id: 2,
        type: 'receipt',
        title: 'Payment History',
        description: `Total ₹${feeSummary.total_paid.toLocaleString()} paid in fees`,
        time: 'Available'
      });
    }
  }

  if (docStats) {
    if (docStats.verified > 0) {
      recentActivity.push({
        id: 3,
        type: 'document',
        title: 'Documents Verified',
        description: `${docStats.verified} of your documents have been verified`,
        time: 'Verified'
      });
    }
    if (docStats.pending > 0) {
      recentActivity.push({
        id: 4,
        type: 'document',
        title: 'Documents Pending',
        description: `${docStats.pending} documents waiting for verification`,
        time: 'Pending'
      });
    }
    if (docStats.requests_pending > 0) {
      recentActivity.push({
        id: 5,
        type: 'request',
        title: 'Action Required',
        description: `You have ${docStats.requests_pending} document requests to fulfill`,
        time: 'Urgent'
      });
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'payment': return <CheckCircle sx={{ color: 'success.main' }} />;
      case 'document': return <CheckCircle sx={{ color: 'warning.main' }} />;
      case 'receipt': return <Receipt sx={{ color: 'primary.main' }} />;
      case 'request': return <Warning sx={{ color: 'error.main' }} />;
      default: return <Description />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'payment': return 'success.light';
      case 'document': return 'warning.light';
      case 'receipt': return 'primary.light';
      case 'request': return '#fee2e2'; // Light red
      default: return 'grey.100';
    }
  };

  const studentName = user?.name || (studentProfile 
    ? `${studentProfile.first_name} ${studentProfile.last_name}` 
    : user?.email?.split('@')[0]) || 'Student';
  const pendingAmount = feeSummary?.total_pending || 0;

  if (loading) {
    return <Box p={3}><Typography>Loading...</Typography></Box>;
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        👨‍🎓 Welcome, {studentName}!
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<CheckCircle sx={{ fontSize: 28 }} />} value={`₹${(feeSummary?.total_paid || 0).toLocaleString()}`} label="Total Paid" color="success" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<Warning sx={{ fontSize: 28 }} />} value={`₹${pendingAmount.toLocaleString()}`} label="Pending" color="warning" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<Description sx={{ fontSize: 28 }} />} value={docStats?.total || 0} label="Documents" color="primary" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<CheckCircle sx={{ fontSize: 28 }} />} value={docStats?.verified || 0} label="Verified" color="secondary" />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 6 } }} onClick={() => navigate('/student/fees')}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Box sx={{ fontSize: 48, mb: 2 }}>💳</Box>
              <Typography variant="h5" gutterBottom>Pay Fees</Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {pendingAmount > 0 ? `₹${pendingAmount.toLocaleString()} pending` : 'No pending fees'}
              </Typography>
              <Button variant="contained">{pendingAmount > 0 ? 'Pay Now' : 'View Details'}</Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 6 } }} onClick={() => navigate('/student/documents')}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Box sx={{ fontSize: 48, mb: 2 }}>📁</Box>
              <Typography variant="h5" gutterBottom>My Documents</Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {docStats?.verified || 0} documents verified
              </Typography>
              <Button variant="contained">View Documents</Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Activity Section */}
      {recentActivity.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>📋 Recent Activity</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recentActivity.map((activity) => (
                <Box
                  key={activity.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    bgcolor: getActivityColor(activity.type),
                    borderRadius: 2
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      bgcolor: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {getActivityIcon(activity.type)}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight="600">{activity.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{activity.description}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">{activity.time}</Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default StudentPortal;
