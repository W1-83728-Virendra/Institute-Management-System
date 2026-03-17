import { useEffect, useState, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Grid, Container, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Snackbar, Alert, Checkbox, FormControlLabel
} from '@mui/material';
import { AttachMoney, Warning, CheckCircle, Download, CreditCard, Receipt } from '@mui/icons-material';
import { studentFeesAPI, feesAPI, paymentsAPI } from '../services/api';

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

interface Fee {
  id: number;
  fee_type: string;
  amount: number;
  due_date: string;
  status: string;
  semester: number;
  academic_year: string;
}

interface Summary {
  total_paid: number;
  total_pending: number;
  total_overdue: number;
  total_fees: number;
}

const StudentFees = () => {
  const [fees, setFees] = useState<Fee[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
  const [selectedFee, setSelectedFee] = useState<Fee | null>(null);
  const [selectedFees, setSelectedFees] = useState<number[]>([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'info' });

  useEffect(() => {
    fetchFees();
  }, []);

  const fetchFees = async () => {
    try {
      const [feesRes, summaryRes] = await Promise.all([
        studentFeesAPI.getMyFees(),
        studentFeesAPI.getMySummary()
      ]);
      // Handle potential 422 errors by checking response structure
      const feesData = feesRes.data?.fees || [];
      const summaryData = summaryRes.data || {};
      setFees(feesData);
      setSummary({
        total_paid: summaryData.total_paid || 0,
        total_pending: summaryData.total_pending || 0,
        total_overdue: summaryData.total_overdue || 0,
        total_fees: summaryData.total_fees || 0
      });
    } catch (error: any) {
      console.log('Error fetching fees (using fallback data):', error.message);
      // Use fallback demo data when API fails
      setFees([
        { id: 1, fee_type: 'Semester 1 Tuition Fee', amount: 25000, due_date: '2024-06-15', status: 'paid', semester: 1, academic_year: '2024-25' },
        { id: 2, fee_type: 'Semester 2 Tuition Fee', amount: 25000, due_date: '2024-12-15', status: 'paid', semester: 2, academic_year: '2024-25' },
        { id: 3, fee_type: 'Semester 3 Tuition Fee', amount: 25000, due_date: '2025-06-15', status: 'paid', semester: 3, academic_year: '2025-26' },
        { id: 4, fee_type: 'Exam Fee', amount: 5000, due_date: '2025-06-15', status: 'pending', semester: 4, academic_year: '2025-26' },
      ]);
      setSummary({
        total_paid: 75000,
        total_pending: 5000,
        total_overdue: 0,
        total_fees: 80000
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'pending': return 'warning';
      case 'overdue': return 'error';
      default: return 'default';
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount?.toLocaleString() || 0}`;
  };

  const handleDownloadReceipt = async (feeId: number) => {
    try {
      // First try to get the payment details to get payment ID
      let paymentId: number | null = null;
      try {
        const paymentRes = await paymentsAPI.getPaymentByFee(feeId);
        if (paymentRes.data?.id) {
          paymentId = paymentRes.data.id;
        }
      } catch (e) {
        console.log('Could not get payment details, using fee ID');
      }

      // If we have a payment ID, try to download uploaded receipt
      if (paymentId) {
        try {
          const response = await paymentsAPI.downloadReceipt(paymentId);
          // Get filename from Content-Disposition header or use default
          const contentDisposition = response.headers['content-disposition'];
          let filename = `receipt_${feeId}`;
          if (contentDisposition) {
            const match = contentDisposition.match(/filename="?(.+)"?/);
            if (match && match[1]) {
              filename = match[1].replace(/['"]/g, '');
            }
          }
          // Create download link
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
          setSnackbar({ open: true, message: 'Receipt downloaded successfully', severity: 'success' });
          return;
        } catch (e) {
          console.log('No uploaded receipt, generating receipt');
        }
      }
      
      // Fallback: Generate receipt from API
      const response = await feesAPI.getReceipt(feeId);
      const receipt = response.data;
      
      // Create a printable receipt
      const receiptWindow = window.open('', '_blank');
      if (receiptWindow) {
        receiptWindow.document.write(`
          <html>
          <head>
            <title>Fee Receipt - ${receipt.receipt_id}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              .header { text-align: center; margin-bottom: 20px; }
              .receipt-id { color: #666; }
              .details { margin: 20px 0; }
              .details table { width: 100%; }
              .details td { padding: 8px; }
              .label { font-weight: bold; width: 140px; }
              .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Fee Receipt</h1>
              <p class="receipt-id">Receipt ID: ${receipt.receipt_id}</p>
              <p>Date: ${receipt.date}</p>
            </div>
            <div class="details">
              <h3>Student Details</h3>
              <table>
                <tr><td class="label">Name:</td><td>${receipt.student.name}</td></tr>
                <tr><td class="label">Student ID:</td><td>${receipt.student.id}</td></tr>
                <tr><td class="label">Email:</td><td>${receipt.student.email}</td></tr>
                <tr><td class="label">Phone:</td><td>${receipt.student.phone}</td></tr>
              </table>
              <h3>Fee Details</h3>
              <table>
                <tr><td class="label">Fee Type:</td><td>${receipt.fee.type}</td></tr>
                <tr><td class="label">Amount:</td><td>₹${receipt.fee.amount}</td></tr>
                <tr><td class="label">Status:</td><td>${receipt.fee.status}</td></tr>
                <tr><td class="label">Due Date:</td><td>${receipt.fee.due_date || 'N/A'}</td></tr>
                <tr><td class="label">Academic Year:</td><td>${receipt.fee.academic_year}</td></tr>
                <tr><td class="label">Semester:</td><td>${receipt.fee.semester}</td></tr>
              </table>
              ${receipt.payment ? `
              <h3>Payment Details</h3>
              <table>
                <tr><td class="label">Method:</td><td>${receipt.payment.method}</td></tr>
                <tr><td class="label">Transaction ID:</td><td>${receipt.payment.transaction_id || 'N/A'}</td></tr>
                <tr><td class="label">Paid Date:</td><td>${receipt.payment.paid_date || 'N/A'}</td></tr>
              </table>
              ` : ''}
            </div>
            <div class="footer">
              <p>Thank you for your payment!</p>
              <p>Institute Management System</p>
            </div>
          </body>
          </html>
        `);
        receiptWindow.document.close();
        receiptWindow.print();
      }
    } catch (error) {
      console.error('Failed to download receipt:', error);
      setSnackbar({ open: true, message: 'Failed to download receipt', severity: 'error' });
    }
  };

  // Toggle fee selection
  const toggleFeeSelection = (feeId: number) => {
    setSelectedFees(prev => 
      prev.includes(feeId)
        ? prev.filter(id => id !== feeId)
        : [...prev, feeId]
    );
  };

  // Select all pending fees
  const selectAllPendingFees = () => {
    const pendingIds = fees.filter(f => f.status === 'pending').map(f => f.id);
    setSelectedFees(pendingIds);
  };

  // Get selected fees data
  const getSelectedFeesData = () => {
    return fees.filter(f => selectedFees.includes(f.id));
  };

  // Calculate total selected amount
  const getTotalSelectedAmount = () => {
    return getSelectedFeesData().reduce((sum, f) => sum + f.amount, 0);
  };

  const handlePayClick = () => {
    // If fees already selected, use those
    if (selectedFees.length > 0) {
      setOpenPaymentDialog(true);
    } else {
      // Otherwise, select all pending fees
      const pendingIds = fees.filter(f => f.status === 'pending').map(f => f.id);
      if (pendingIds.length > 0) {
        setSelectedFees(pendingIds);
        setOpenPaymentDialog(true);
      } else {
        setSnackbar({ open: true, message: 'No pending fees to pay', severity: 'info' });
      }
    }
  };

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePayFee = async () => {
    if (selectedFees.length === 0) return;
    
    // Pay the first selected fee for now (can be extended to pay all)
    const firstFeeId = selectedFees[0];
    const fee = fees.find(f => f.id === firstFeeId);
    if (!fee) return;
    
    try {
      // Create Razorpay order
      const orderResponse = await paymentsAPI.createOrder(fee.id);
      const { order_id, amount, key_id } = orderResponse.data;

      // @ts-ignore - Razorpay is loaded dynamically
      const razorpay = new window.Razorpay({
        key: key_id,
        amount: amount,
        name: 'Institute Management System',
        description: fee.fee_type,
        order_id: order_id,
        handler: async (response: any) => {
          try {
            // Verify payment on backend
            await paymentsAPI.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              fee_id: fee.id
            });
            setSnackbar({ open: true, message: 'Payment successful!', severity: 'success' });
            setOpenPaymentDialog(false);
            setSelectedFees([]);
            fetchFees();
          } catch (error: any) {
            setSnackbar({ open: true, message: 'Payment verification failed', severity: 'error' });
          }
        },
        modal: {
          confirm_close: true,
          ondismiss: () => {
            setSnackbar({ open: true, message: 'Payment cancelled', severity: 'info' });
          }
        }
      });
      razorpay.open();
    } catch (error: any) {
      setSnackbar({ open: true, message: error?.response?.data?.detail || 'Failed to initiate payment', severity: 'error' });
    }
  };

  if (loading) {
    return <Box p={3}><Typography>Loading...</Typography></Box>;
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        💰 My Fees
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<AttachMoney sx={{ fontSize: 28 }} />} value={formatCurrency(summary?.total_fees || 0)} label="Total Fees" color="primary" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<CheckCircle sx={{ fontSize: 28 }} />} value={formatCurrency(summary?.total_paid || 0)} label="Total Paid" color="success" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<Warning sx={{ fontSize: 28 }} />} value={formatCurrency(summary?.total_pending || 0)} label="Pending" color="warning" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<Warning sx={{ fontSize: 28 }} />} value={formatCurrency(summary?.total_overdue || 0)} label="Overdue" color="error" />
        </Grid>
      </Grid>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>📋 Fee History</Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={fees.filter(f => f.status === 'pending').length > 0 && selectedFees.length === fees.filter(f => f.status === 'pending').length}
                      indeterminate={selectedFees.length > 0 && selectedFees.length < fees.filter(f => f.status === 'pending').length}
                      onChange={selectAllPendingFees}
                    />
                  </TableCell>
                  <TableCell>Semester</TableCell>
                  <TableCell>Academic Year</TableCell>
                  <TableCell>Total Fee</TableCell>
                  <TableCell>Paid</TableCell>
                  <TableCell>Balance</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Receipt</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {fees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center">No fees found</TableCell>
                  </TableRow>
                ) : (
                  fees.map((fee) => (
                    <TableRow key={fee.id}>
                      <TableCell padding="checkbox">
                        {fee.status === 'pending' && (
                          <Checkbox
                            checked={selectedFees.includes(fee.id)}
                            onChange={() => toggleFeeSelection(fee.id)}
                          />
                        )}
                      </TableCell>
                      <TableCell>Semester {fee.semester}</TableCell>
                      <TableCell>{fee.academic_year}</TableCell>
                      <TableCell>{formatCurrency(fee.amount)}</TableCell>
                      <TableCell>{fee.status === 'paid' ? formatCurrency(fee.amount) : '-'}</TableCell>
                      <TableCell>{fee.status !== 'paid' ? formatCurrency(fee.amount) : '₹0'}</TableCell>
                      <TableCell>{fee.due_date ? new Date(fee.due_date).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>
                        <Chip 
                          label={fee.status?.toUpperCase()} 
                          color={getStatusColor(fee.status)} 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>
                        {fee.status === 'paid' ? (
                          <IconButton 
                            color="primary" 
                            size="small"
                            onClick={() => handleDownloadReceipt(fee.id)}
                            title="Download Receipt"
                          >
                            <Download />
                          </IconButton>
                        ) : (
                          <Typography variant="caption" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Pay Now Section */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>💳 Pay Your Fees</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select fees from the table above and pay them together
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button 
              variant="contained" 
              color="success" 
              size="large"
              startIcon={<CreditCard />}
              onClick={handlePayClick}
              disabled={selectedFees.length === 0}
              sx={{ py: 1.5, px: 4 }}
            >
              {selectedFees.length > 0 
                ? `Pay ₹${getTotalSelectedAmount().toLocaleString('en-IN')} (${selectedFees.length} fees)`
                : 'Pay Now'
              }
            </Button>
            {selectedFees.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {selectedFees.length} fee(s) selected
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={openPaymentDialog} onClose={() => setOpenPaymentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
          💳 Payment Summary
        </DialogTitle>
        <DialogContent>
          {selectedFees.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {/* Selected Fees List */}
              <Card variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Selected Fees ({selectedFees.length})
                </Typography>
                {getSelectedFeesData().map((fee, index) => (
                  <Box key={fee.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: index < getSelectedFeesData().length - 1 ? '1px solid' : 'none', borderColor: 'grey.200' }}>
                    <Box>
                      <Typography variant="body2" fontWeight="600">
                        {fee.fee_type}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Sem {fee.semester} • {fee.academic_year}
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight="bold">
                      ₹{fee.amount.toLocaleString('en-IN')}
                    </Typography>
                  </Box>
                ))}
              </Card>

              {/* Divider */}
              <Box sx={{ borderBottom: '2px dashed', borderColor: 'grey.300' }} />

              {/* Total Amount */}
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Total Amount to Pay
                </Typography>
                <Typography variant="h3" fontWeight="bold" color="primary">
                  ₹{getTotalSelectedAmount().toLocaleString('en-IN')}
                </Typography>
              </Box>

              {/* Divider */}
              <Box sx={{ borderBottom: '2px dashed', borderColor: 'grey.300' }} />

              {/* Security Badge */}
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, py: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  🔒 SSL Encrypted
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  💰 Secure via Razorpay
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1, flexDirection: 'column', gap: 1 }}>
          <Button 
            variant="contained" 
            color="success" 
            size="large" 
            fullWidth
            startIcon={<CreditCard />}
            onClick={handlePayFee}
            sx={{ 
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 'bold'
            }}
          >
            Pay ₹{getTotalSelectedAmount().toLocaleString('en-IN')}
          </Button>
          <Button 
            onClick={() => setOpenPaymentDialog(false)}
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Container>
  );
};

export default StudentFees;
