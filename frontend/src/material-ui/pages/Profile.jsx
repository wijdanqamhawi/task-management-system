import { useState } from 'react';
import { Avatar, Box, Button, Card, CardContent, CardHeader, Divider, Grid, Stack, TextField, Typography } from '@mui/material';
import { PageHeader, RoleChip } from '../shared.jsx';

export default function Profile({ user }) {
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);

  return (
    <>
      <PageHeader title="Profile" subtitle="Your account information" />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Avatar sx={{ width: 88, height: 88, mx: 'auto', mb: 2, fontSize: 36, bgcolor: 'primary.main' }}>{user.fullName[0]}</Avatar>
              <Typography variant="h6">{user.fullName}</Typography>
              <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                {user.email}
              </Typography>
              <RoleChip role={user.role} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader title="Edit profile" slotProps={{ title: { variant: 'h6' } }} />
            <Divider />
            <CardContent>
              <Stack spacing={2.5} component="form" onSubmit={(e) => e.preventDefault()}>
                <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} fullWidth />
                <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
                <TextField label="Role" value={user.role} fullWidth disabled helperText="Roles are managed by an administrator." />
                <Box>
                  <Button type="submit" variant="contained">
                    Save changes
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
