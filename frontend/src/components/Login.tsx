import React, { useState, useEffect } from 'react';
import {
  Header,
  SpaceBetween,
  Input,
  Button,
  Form,
  FormField,
  Alert,
  Toggle,
  Box
} from '@cloudscape-design/components';
import { fileService } from '../services/fileService';
import './Login.css';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString());
    if (darkMode) {
      document.body.classList.add('awsui-dark-mode');
    } else {
      document.body.classList.remove('awsui-dark-mode');
    }
  }, [darkMode]);

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }
    setError('');
    try {
      await fileService.login({ username, password });
      window.location.href = '/';
    } catch (err) {
      setError('Invalid credentials. Please try again.');
    }
  };

  return (
    <div className={`login-page ${darkMode ? 'dark' : 'light'}`}>
      <div className="login-form-container">
        <div className="glowing-orb"></div>
        <div className="glass-panel">
          <Box padding={{ vertical: 'xxl', horizontal: 'xl' }}>
            <Form
              actions={
              <SpaceBetween direction="vertical" size="l" alignItems="center">
                <Button
                  variant="primary"
                  onClick={handleLogin}
                  fullWidth
                >
                  Sign In
                </Button>
                <Button formAction="none" variant="link">
                  Forgot password?
                </Button>
              </SpaceBetween>
            }
            header={<Header variant="h1">Welcome to File Vault</Header>}
          >
            <SpaceBetween direction="vertical" size="l">
              <FormField label="Username">
                <Input
                  value={username}
                  onChange={({ detail }) => setUsername(detail.value)}
                  placeholder="Enter your username"
                />
              </FormField>
              <FormField label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={({ detail }) => setPassword(detail.value)}
                  placeholder="Enter your password"
                />
              </FormField>
              {error && (
                <Alert statusIconAriaLabel="Error" type="error">
                  {error}
                </Alert>
              )}
              </SpaceBetween>
            </Form>
          </Box>
        </div>
      </div>
      <div className="dark-mode-toggle-container">
        <Toggle
          checked={darkMode}
          onChange={({ detail }) => setDarkMode(detail.checked)}
        >
          Dark Mode
        </Toggle>
      </div>
    </div>
  );
};

export default Login;
