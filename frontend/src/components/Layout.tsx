import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
  Description as DocIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  AccountBalance as FeeIcon,
  Folder as FolderIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout } from '../store/slices/authSlice';

const drawerWidth = 260;

const adminMenuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/admin/dashboard' },
  { text: 'Students', icon: <PeopleIcon />, path: '/admin/students' },
  { text: 'Fees', icon: <MoneyIcon />, path: '/admin/fees' },
  { text: 'Documents', icon: <DocIcon />, path: '/admin/documents' },
];

const studentMenuItems = [
  { text: 'Portal', icon: <DashboardIcon />, path: '/student/portal' },
  { text: 'My Fees', icon: <MoneyIcon />, path: '/student/fees' },
  { text: 'My Documents', icon: <DocIcon />, path: '/student/documents' },
];

const Layout = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAppSelector((state) => state.auth);
  
  // Mobile drawer state
  const [mobileOpen, setMobileOpen] = useState(false);
  // User menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  // Use MUI's useTheme and useMediaQuery for responsive detection
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const menuItems = user?.role === 'admin' ? adminMenuItems : studentMenuItems;
  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'admin';

  // Get student name from user email or use default
  const studentName = user?.email?.split('@')[0] || 'Student';
  const studentInitials = studentName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Toggle mobile drawer open/close
  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // Close mobile drawer when navigating (mobile UX improvement)
  const handleNavClick = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const drawer = (
    <Box sx={{ bgcolor: '#1f2937', minHeight: '100vh', color: 'white', display: 'flex', flexDirection: 'column' }}>
      {/* Logo and Portal Type Header */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid #374151' }}>
        <Avatar sx={{ bgcolor: '#667eea', fontSize: 24 }}>🎓</Avatar>
        <Box>
          <Typography variant="subtitle1" fontWeight="bold">EduFee Docs</Typography>
          <Typography variant="caption" sx={{ color: '#9ca3af' }}>
            {user?.role === 'admin' ? 'Admin Portal' : 'Student Portal'}
          </Typography>
        </Box>
      </Box>
      
      {/* Navigation Menu Items */}
      <List sx={{ py: 2 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              onClick={() => handleNavClick(item.path)}
              selected={location.pathname === item.path}
              sx={{
                mx: 1,
                borderRadius: 1,
                '&.Mui-selected': {
                  bgcolor: 'rgba(102, 126, 234, 0.15)',
                  color: '#667eea',
                  borderLeft: '3px solid #667eea',
                  '& .MuiListItemIcon-root': { color: '#667eea' },
                },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
              }}
            >
              <ListItemIcon sx={{ color: '#9ca3af', minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
        {/* Settings - only for admin */}
        {isAdmin && (
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => handleNavClick('/admin/settings')}
              sx={{
                mx: 1,
                borderRadius: 1,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
              }}
            >
              <ListItemIcon sx={{ color: '#9ca3af', minWidth: 40 }}><SettingsIcon /></ListItemIcon>
              <ListItemText primary="Settings" />
            </ListItemButton>
          </ListItem>
        )}
      </List>
      
      {/* Logout Button at Bottom */}
      <Box sx={{ mt: 'auto', p: 2, borderTop: '1px solid #374151' }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{ borderRadius: 1, color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}
        >
          <ListItemIcon sx={{ color: '#ef4444', minWidth: 40 }}><LogoutIcon /></ListItemIcon>
          <ListItemText primary="Logout" />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          bgcolor: 'white',
          color: 'text.primary',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          {/* Notification Bell - only for student */}
          {isStudent && (
            <IconButton sx={{ mr: 2 }}>
              <Badge badgeContent={2} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ textAlign: 'right', display: { xs: 'none', md: 'block' } }}>
              <Typography variant="body2" fontWeight="600">
                {isStudent ? 'Rahul Sharma' : user?.email?.split('@')[0]}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {isStudent ? 'BCom Sem 3' : 'Administrator'}
              </Typography>
            </Box>
            <IconButton onClick={handleMenu}>
              <Avatar sx={{ bgcolor: '#667eea' }}>
                {isStudent ? studentInitials : user?.email?.[0]?.toUpperCase() || 'U'}
              </Avatar>
            </IconButton>
          </Box>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <MenuItem disabled>{user?.email}</MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>Logout</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { width: drawerWidth, border: 'none' },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          // Responsive padding: smaller on mobile, larger on desktop
          p: { xs: 1, sm: 2, md: 3 },
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
          bgcolor: '#f3f4f6',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;
