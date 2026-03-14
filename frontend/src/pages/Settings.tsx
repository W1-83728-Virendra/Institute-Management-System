import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid,
  Switch, FormControlLabel, Divider, Snackbar, Alert
} from '@mui/material';
import { Settings as SettingsIcon, Save as SaveIcon } from '@mui/icons-material';

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
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon /> System
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  System Version: 1.0.0
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Last Updated: March 2024
                </Typography>
                <Divider />
                <Button variant="outlined" color="error" fullWidth>
                  Reset to Default Settings
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default Settings;
