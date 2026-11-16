import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError, cleanServer, login, loginWithCode, sendLoginCode, Session, ssoExchange, ssoName } from '../api';
import { openSso, SsoGrant } from '../sso';
import { colors } from '../ui';

export default function LoginScreen({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [server, setServer] = useState('http://192.168.1.10:5000');
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<'email' | 'code' | 'password'>('email');
  const [password, setPassword] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [grant, setGrant] = useState<SsoGrant | null>(null);

  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      ssoName(server)
        .then((name) => current && setProvider(name))
        .catch(() => current && setProvider(null));
    }, 500);

    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [server]);

  const signInWithSso = async () => {
    setBusy(true);
    setError(null);
    let next: SsoGrant | null = null;
    try {
      next = await openSso(cleanServer(server));
      if (next) onSignedIn(await ssoExchange(server, next.code, next.verifier));
      else setBusy(false);
    } catch (e) {
      if ((e as ApiError).twoFactorRequired) {
        setGrant(next);
        setNeedsCode(true);
      }
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (grant) onSignedIn(await ssoExchange(server, grant.code, grant.verifier, code));
      else if (mode === 'email') {
        await sendLoginCode(server, email);
        setMode('code');
        setBusy(false);
      } else if (mode === 'code') onSignedIn(await loginWithCode(server, email, emailCode, code));
      else onSignedIn(await login(server, email, password, code));
    } catch (e) {
      if ((e as ApiError).twoFactorRequired) setNeedsCode(true);
      setCode('');
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const switchTo = (next: 'email' | 'password') => {
    setMode(next);
    setError(null);
    setNeedsCode(false);
    setEmailCode('');
    setCode('');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Ping Chat</Text>

        <Text style={styles.label}>Server address</Text>
        <TextInput
          accessibilityLabel="Server address"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={setServer}
          style={styles.input}
          value={server}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          style={styles.input}
          value={email}
        />

        {mode === 'code' && (
          <>
            <Text style={styles.hint}>If this address has been invited, a 6-digit code is on its way.</Text>
            <Text style={styles.label}>Code from your email</Text>
            <TextInput
              accessibilityLabel="Email code"
              autoComplete="one-time-code"
              keyboardType="number-pad"
              onChangeText={setEmailCode}
              onSubmitEditing={submit}
              style={styles.input}
              value={emailCode}
            />
          </>
        )}

        {mode === 'password' && (
          <>
            <Text style={styles.label}>Password</Text>
            <TextInput
              accessibilityLabel="Password"
              onChangeText={setPassword}
              onSubmitEditing={submit}
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </>
        )}

        {needsCode && (
          <>
            <Text style={styles.label}>Code from your authenticator app</Text>
            <TextInput
              accessibilityLabel="Authenticator code"
              autoCapitalize="none"
              autoComplete="one-time-code"
              onChangeText={setCode}
              onSubmitEditing={submit}
              style={styles.input}
              value={code}
            />
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable accessibilityRole="button" disabled={busy} onPress={submit} style={styles.button}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{mode === 'email' && !grant ? 'Continue' : 'Sign in'}</Text>}
        </Pressable>

        {!grant && (
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => switchTo(mode === 'email' ? 'password' : 'email')} style={styles.link}>
            <Text style={styles.linkText}>{mode === 'email' ? 'Use a password instead' : mode === 'code' ? 'Use a different email' : 'Email me a code instead'}</Text>
          </Pressable>
        )}

        {provider && !grant && (
          <Pressable accessibilityRole="button" disabled={busy} onPress={signInWithSso} style={styles.ssoButton}>
            <Text style={styles.ssoText}>Sign in with {provider}</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.dark, flex: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 20 },
  title: { color: colors.dark, fontSize: 26, fontWeight: '800', marginBottom: 12 },
  label: { color: colors.muted, fontSize: 13, marginBottom: 4, marginTop: 10 },
  input: { borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.text, fontSize: 16, padding: 10 },
  error: { color: colors.danger, marginTop: 10 },
  hint: { color: colors.muted, fontSize: 14, marginTop: 12 },
  link: { alignItems: 'center', marginTop: 12, padding: 6 },
  linkText: { color: colors.brand, fontSize: 14, fontWeight: '600' },
  button: { alignItems: 'center', backgroundColor: colors.brand, borderRadius: 8, marginTop: 16, padding: 13 },
  ssoButton: { alignItems: 'center', borderColor: colors.line, borderRadius: 8, borderWidth: 1, marginTop: 10, padding: 12 },
  ssoText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
