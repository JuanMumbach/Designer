import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  linkWithCredential,
  AuthCredential,
} from 'firebase/auth';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import Ionicons from '@expo/vector-icons/Ionicons';
import { auth } from '../services/firebaseConfig';
import { COLORS, RADII } from '../constants/theme';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState<AuthCredential | null>(null);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');

  const redirectUri = makeRedirectUri({ scheme: 'design', path: 'login' });

  const [, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    redirectUri,
  });

  React.useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { id_token, access_token } = googleResponse.params;
      const credential = GoogleAuthProvider.credential(id_token ?? null, access_token ?? null);
      setIsSubmitting(true);
      signInWithCredential(auth, credential)
        .catch((e: unknown) => {
          const code = (e as { code?: string }).code;
          if (
            code === 'auth/credential-already-in-use' ||
            code === 'auth/account-exists-with-different-credential'
          ) {
            const email =
              (e as { customData?: { email?: string } }).customData?.email ??
              (e as { email?: string }).email ??
              '';
            setTab('signin');
            setLinkEmail(email);
            setPendingGoogleCredential(credential);
            setError('');
          } else {
            setError(friendlyError(code));
          }
        })
        .finally(() => setIsSubmitting(false));
    }
  }, [googleResponse]);

  const handleEmailAuth = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    if (tab === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (tab === 'signup') {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      setError(friendlyError(code));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkGoogle = async () => {
    if (!pendingGoogleCredential || !linkEmail.trim() || !linkPassword) {
      setError('Enter your existing password to link your Google account.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const { user: existingFirebaseUser } = await signInWithEmailAndPassword(auth, linkEmail.trim(), linkPassword);
      await linkWithCredential(existingFirebaseUser, pendingGoogleCredential);
      setPendingGoogleCredential(null);
      setLinkPassword('');
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      setError(friendlyError(code));
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearPendingLink = () => {
    setPendingGoogleCredential(null);
    setLinkEmail('');
    setLinkPassword('');
    setError('');
  };

  const friendlyError = (code?: string): string => {
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/credential-already-in-use':
      case 'auth/account-exists-with-different-credential':
        return 'An account with this email already exists. Link your Google sign-in below.';
      case 'auth/provider-already-linked':
        return 'Google is already linked to this account.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';
      default:
        return 'Something went wrong. Please try again.';
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.logoArea}>
              <View style={styles.logoIcon}>
                <Ionicons name="cube-outline" size={40} color={COLORS.primary} />
              </View>
              <Text style={styles.brandTitle}>DESIGNER</Text>
              <Text style={styles.brandSubtitle}>Modular 3D Furniture Studio</Text>
            </View>

            <View style={styles.card}>
            <View style={styles.tabRow}>
              <Pressable
                style={[styles.tab, tab === 'signin' && styles.tabActive]}
                onPress={() => { setTab('signin'); setError(''); clearPendingLink(); }}
              >
                <Text style={[styles.tabText, tab === 'signin' && styles.tabTextActive]}>
                  Sign In
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, tab === 'signup' && styles.tabActive]}
                onPress={() => { setTab('signup'); setError(''); clearPendingLink(); }}
              >
                <Text style={[styles.tabText, tab === 'signup' && styles.tabTextActive]}>
                  Create Account
                </Text>
              </Pressable>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textFaint}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
placeholder="••••••••"
                    placeholderTextColor={COLORS.textFaint}
                    secureTextEntry
                  />

              {tab === 'signup' && (
                <>
                  <Text style={styles.label}>Confirm Password</Text>
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.textFaint}
                    secureTextEntry
                  />
                </>
              )}

              {error !== '' && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {pendingGoogleCredential && linkEmail !== '' && (
                <View style={styles.linkBox}>
                  <View style={styles.linkBoxHeader}>
                    <Ionicons name="link-outline" size={16} color={COLORS.gold} />
                    <Text style={styles.linkBoxTitle}>Link Google account</Text>
                  </View>
                  <Text style={styles.linkBoxText}>
                    There is already a Designer account for {linkEmail}. Enter its
                    password to connect your Google sign-in.
                  </Text>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    style={styles.input}
                    value={linkPassword}
                    onChangeText={setLinkPassword}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.textFaint}
                    secureTextEntry
                  />
                  <Pressable
                    style={[styles.primaryBtn, isSubmitting && styles.btnDisabled]}
                    onPress={handleLinkGoogle}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <Text style={styles.primaryBtnText}>Link Google Account</Text>
                    )}
                  </Pressable>
                  <Pressable style={styles.cancelLinkBtn} onPress={clearPendingLink}>
                    <Text style={styles.cancelLinkText}>Cancel</Text>
                  </Pressable>
                </View>
              )}

              <Pressable
                style={[styles.primaryBtn, isSubmitting && styles.btnDisabled]}
                onPress={handleEmailAuth}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {tab === 'signin' ? 'Sign In' : 'Create Account'}
                  </Text>
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                style={[styles.googleBtn, isSubmitting && styles.btnDisabled]}
                onPress={() => { clearPendingLink(); promptGoogleAsync(); }}
                disabled={isSubmitting}
              >
                <Ionicons name="logo-google" size={20} color={COLORS.textHeading} style={styles.googleIcon} />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </Pressable>
            </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bgAlt,
  },
  flex: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: RADII.lg,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 6,
  },
  brandSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 6,
    letterSpacing: 1.2,
  },
  card: {
    backgroundColor: COLORS.bg,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  form: {
    padding: 24,
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textHeading,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: COLORS.bgAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.errorSoft,
    borderWidth: 1,
    borderColor: COLORS.errorBorder,
    borderRadius: RADII.md,
    padding: 10,
    marginTop: 12,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    flex: 1,
  },
  linkBox: {
    marginTop: 12,
    backgroundColor: COLORS.goldSoft,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    borderRadius: RADII.md,
    padding: 12,
  },
  linkBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  linkBoxTitle: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  linkBoxText: {
    color: COLORS.textBody,
    fontSize: 13,
    marginBottom: 4,
  },
  cancelLinkBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  cancelLinkText: {
    color: COLORS.textMuted,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADII.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: RADII.lg,
    paddingVertical: 13,
    gap: 10,
  },
  googleIcon: {
    marginRight: 4,
  },
  googleBtnText: {
    color: COLORS.textBody,
    fontSize: 15,
    fontWeight: '600',
  },
});
