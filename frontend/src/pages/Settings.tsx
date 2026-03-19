import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid,
  Switch, FormControlLabel, Divider, Snackbar, Alert, MenuItem, FormControl, InputLabel, Select
} from '@mui/material';
import { Settings as SettingsIcon, Save as SaveIcon, Notifications as NotificationsIcon } from '@mui/icons-material';
import { useAppSelector } from '../store/hooks';
import { notificationsAPI } from '../services/api';

const Settings = () => {
  const { user } = useAppSelector((state: any) => state.auth);
  const isAdmin = user?.role === 'admin';
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
    // Reminder Schedule (Admin)
    feeRemindersEnabled: true,
    feeReminderFrequency: 'daily',
    feeReminderTime: '09:00',
    feeReminderDaysBefore: 3,
    documentRemindersEnabled: true,
    documentReminderFrequency: 'weekly',
    documentReminderTime: '10:00',
  });
  
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [saving, setSaving] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);

  // Fetch settings on mount for admin users
  useEffect(() => {
    const fetchSettings = async () => {
      if (!isAdmin) return;
      setLoadingSettings(true);
      try {
        const response = await notificationsAPI.getSettings();
        const data = response.data;
        setSettings(prev => ({
          ...prev,
          feeRemindersEnabled: data.fee_reminders_enabled ?? prev.feeRemindersEnabled,
          feeReminderFrequency: data.fee_reminder_frequency ?? prev.feeReminderFrequency,
          feeReminderTime: data.fee_reminder_time ?? prev.feeReminderTime,
          feeReminderDaysBefore: data.fee_reminder_days_before ?? prev.feeReminderDaysBefore,
          documentRemindersEnabled: data.document_reminders_enabled ?? prev.documentRemindersEnabled,
          documentReminderFrequency: data.document_reminder_frequency ?? prev.documentReminderFrequency,
          documentReminderTime: data.document_reminder_time ?? prev.documentReminderTime,
        }));
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoadingSettings(false);
      }
    };
    fetchSettings();
  }, [isAdmin]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked, type } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save notification settings to backend
      if (isAdmin) {
        await notificationsAPI.updateSettings({
          fee_reminders_enabled: settings.feeRemindersEnabled,
          fee_reminder_frequency: settings.feeReminderFrequency,
          fee_reminder_time: settings.feeReminderTime,
          fee_reminder_days_before: settings.feeReminderDaysBefore,
          document_reminders_enabled: settings.documentRemindersEnabled,
          document_reminder_frequency: settings.documentReminderFrequency,
          document_reminder_time: settings.documentReminderTime,
        });
      }
      setSnackbar({ open: true, message: 'Settings saved successfully', severity: 'success' });
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      setSnackbar({ open: true, message: error.response?.data?.detail || 'Failed to save settings', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">Settings</Typography>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
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
                <NotificationsIcon /> Notifications
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

        {/* Reminder Schedule - Admin Only */}
        {isAdmin && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <NotificationsIcon /> Reminder Schedule
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Configure automated reminders for pending fees and documents.
                </Typography>
                
                {/* Fee Reminders */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" fontWeight="600" sx={{ mb: 1 }}>
                    Fee Reminders
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.feeRemindersEnabled}
                            onChange={(e) => setSettings({ ...settings, feeRemindersEnabled: e.target.checked })}
                          />
                        }
                        label="Enable Fee Reminders"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Frequency</InputLabel>
                        <Select
                          value={settings.feeReminderFrequency}
                          label="Frequency"
                          onChange={(e) => setSettings({ ...settings, feeReminderFrequency: e.target.value })}
                        >
                          <MenuItem value="daily">Daily</MenuItem>
                          <MenuItem value="weekly">Weekly</MenuItem>
                          <MenuItem value="monthly">Monthly</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="time"
                        label="Time"
                        value={settings.feeReminderTime}
                        onChange={(e) => setSettings({ ...settings, feeReminderTime: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label="Days before due date"
                        value={settings.feeReminderDaysBefore}
                        onChange={(e) => setSettings({ ...settings, feeReminderDaysBefore: parseInt(e.target.value) || 3 })}
                        inputProps={{ min: 1, max: 30 }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* Document Reminders */}
                <Box>
                  <Typography variant="subtitle1" fontWeight="600" sx={{ mb: 1 }}>
                    Document Reminders
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.documentRemindersEnabled}
                            onChange={(e) => setSettings({ ...settings, documentRemindersEnabled: e.target.checked })}
                          />
                        }
                        label="Enable Document Reminders"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Frequency</InputLabel>
                        <Select
                          value={settings.documentReminderFrequency}
                          label="Frequency"
                          onChange={(e) => setSettings({ ...settings, documentReminderFrequency: e.target.value })}
                        >
                          <MenuItem value="daily">Daily</MenuItem>
                          <MenuItem value="weekly">Weekly</MenuItem>
                          <MenuItem value="monthly">Monthly</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="time"
                        label="Time"
                        value={settings.documentReminderTime}
                        onChange={(e) => setSettings({ ...settings, documentReminderTime: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

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
