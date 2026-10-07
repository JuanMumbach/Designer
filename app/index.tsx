import { Redirect } from 'expo-router';
import React from 'react';
import { useAuth } from '../services/AuthContext';

export default function Index() {
  const { user } = useAuth();

  if (!user) return null;

  return <Redirect href="/projectManager" />;
}
