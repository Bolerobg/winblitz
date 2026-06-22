import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  ScrollView, 
  Platform, 
  Alert 
} from 'react-native';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

export default function AuthScreen() {
  const { loginPassword, registerPassword, forgotPassword, resetPassword } = useApp();

  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  
  // Registration form fields
  const [fullname, setFullname] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  
  const [loading, setLoading] = useState(false);

  const validateEmail = (text) => {
    const reg = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w\w+)+$/;
    return reg.test(text);
  };

  const handleLogin = async () => {
    if (!email || !validateEmail(email)) {
      Alert.alert("Грешка", "Моля въведете валиден имейл адрес!");
      return;
    }
    if (!password) {
      Alert.alert("Грешка", "Моля въведете парола!");
      return;
    }

    setLoading(true);
    const res = await loginPassword(email, password);
    setLoading(false);

    if (res.success) {
      // successful login is handled by AppContext state change
    } else {
      Alert.alert("Грешка", res.error || "Грешка при влизане.");
    }
  };

  const handleRegister = async () => {
    if (!email || !validateEmail(email)) {
      Alert.alert("Грешка", "Моля въведете валиден имейл адрес!");
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert("Грешка", "Моля въведете парола (поне 6 символа)!");
      return;
    }
    if (!fullname || !city || !address) {
      Alert.alert("Грешка", "Моля попълнете всички полета за доставка!");
      return;
    }

    setLoading(true);
    const res = await registerPassword(email, password, fullname, city, address);
    setLoading(false);

    if (res.success) {
      // successful register is handled by AppContext state change
    } else {
      Alert.alert("Грешка", res.error || "Грешка при регистрация.");
    }
  };

  const handleForgotPassword = async () => {
    if (!email || !validateEmail(email)) {
      Alert.alert("Грешка", "Моля въведете валиден имейл адрес!");
      return;
    }

    setLoading(true);
    const res = await forgotPassword(email);
    setLoading(false);

    if (res.success) {
      setMode('reset');
    } else {
      Alert.alert("Грешка", res.error || "Възникна грешка.");
    }
  };

  const handleResetPassword = async () => {
    if (!code || code.length !== 4) {
      Alert.alert("Грешка", "Моля въведете валиден 4-цифрен код!");
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert("Грешка", "Моля въведете нова парола (поне 6 символа)!");
      return;
    }

    setLoading(true);
    const res = await resetPassword(email, code, password);
    setLoading(false);

    if (res.success) {
      Alert.alert("Успех", "Паролата е успешно променена!");
      setMode('login');
      setPassword('');
      setCode('');
    } else {
      Alert.alert("Грешка", res.error || "Грешка при възстановяване на паролата.");
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <StatusBar style="light" backgroundColor="#0a051b" />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={styles.boltCircle}>
            <Ionicons name="flash" size={40} color="#fbbf24" />
          </View>
          <Text style={styles.logoText}>WIN<Text style={styles.logoHighlight}>BLITZ</Text></Text>
          <Text style={styles.logoSubtext}>Блиц турнири за истински награди</Text>
        </View>

        {/* Dynamic Card Container */}
        <View style={styles.card}>
          
          {(mode === 'login' || mode === 'register') && (
            <View style={styles.tabsContainer}>
              <TouchableOpacity 
                style={[styles.tab, mode === 'login' && styles.activeTab]} 
                onPress={() => setMode('login')}
              >
                <Text style={[styles.tabText, mode === 'login' && styles.activeTabText]}>Вход</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, mode === 'register' && styles.activeTab]} 
                onPress={() => setMode('register')}
              >
                <Text style={[styles.tabText, mode === 'register' && styles.activeTabText]}>Регистрация</Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'login' && (
            <View>
              <Text style={styles.cardDesc}>Въведете вашия имейл и парола, за да влезете.</Text>
              
              <TextInput 
                style={styles.input}
                placeholder="Имейл адрес..."
                placeholderTextColor="#52525b"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
              <TextInput 
                style={styles.input}
                placeholder="Парола..."
                placeholderTextColor="#52525b"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <TouchableOpacity 
                style={styles.actionBtn} 
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionBtnText}>Вход</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.forgotBtn} 
                onPress={() => setMode('forgot')}
              >
                <Text style={styles.forgotBtnText}>Забравена парола?</Text>
              </TouchableOpacity>
            </View>
          )}

          {mode === 'register' && (
            <View>
              <Text style={styles.cardDesc}>
                Въведете реалните си данни за получаване на спечелените награди от Спиди/Еконт.
              </Text>

              <TextInput 
                style={styles.input}
                placeholder="Имейл адрес..."
                placeholderTextColor="#52525b"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
              <TextInput 
                style={styles.input}
                placeholder="Парола (минимум 6 символа)..."
                placeholderTextColor="#52525b"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <TextInput 
                style={styles.input}
                placeholder="Три имена (за куриер)..."
                placeholderTextColor="#52525b"
                value={fullname}
                onChangeText={setFullname}
              />
              
              <TextInput 
                style={styles.input}
                placeholder="Град..."
                placeholderTextColor="#52525b"
                value={city}
                onChangeText={setCity}
              />
              
              <TextInput 
                style={styles.input}
                placeholder="Адрес (личен или офис на куриер)..."
                placeholderTextColor="#52525b"
                value={address}
                onChangeText={setAddress}
              />

              <TouchableOpacity 
                style={styles.actionBtn} 
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionBtnText}>Създай профил</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {mode === 'forgot' && (
            <View>
              <View style={styles.cardHeaderRow}>
                <TouchableOpacity onPress={() => setMode('login')} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={20} color="#a1a1aa" />
                </TouchableOpacity>
                <Text style={styles.cardTitle}>Забравена парола</Text>
              </View>
              <Text style={styles.cardDesc}>
                Въведете вашия имейл и ние ще ви изпратим 4-цифрен код за възстановяване.
              </Text>

              <TextInput 
                style={styles.input}
                placeholder="Имейл адрес..."
                placeholderTextColor="#52525b"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />

              <TouchableOpacity 
                style={styles.actionBtn} 
                onPress={handleForgotPassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionBtnText}>Изпрати код</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {mode === 'reset' && (
            <View>
              <View style={styles.cardHeaderRow}>
                <TouchableOpacity onPress={() => setMode('forgot')} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={20} color="#a1a1aa" />
                </TouchableOpacity>
                <Text style={styles.cardTitle}>Нова парола</Text>
              </View>
              <Text style={styles.cardDesc}>
                Въведете кода от имейла и новата си парола.
              </Text>

              <TextInput 
                style={[styles.input, styles.codeInput]}
                placeholder="0 0 0 0"
                placeholderTextColor="#52525b"
                keyboardType="number-pad"
                maxLength={4}
                value={code}
                onChangeText={setCode}
              />

              <TextInput 
                style={styles.input}
                placeholder="Нова парола..."
                placeholderTextColor="#52525b"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <TouchableOpacity 
                style={styles.actionBtn} 
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionBtnText}>Запази паролата</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a051b',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  boltCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d946ef',
    shadowColor: '#d946ef',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 15,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  logoHighlight: {
    color: '#d946ef',
  },
  logoSubtext: {
    fontSize: 14,
    color: '#a1a1aa',
    marginTop: 5,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#140e34',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2e2b3e',
    padding: 24,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#0a051b',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#8b5cf6',
  },
  tabText: {
    color: '#a1a1aa',
    fontWeight: '600',
    fontSize: 16,
  },
  activeTabText: {
    color: '#fff',
  },
  cardDesc: {
    fontSize: 14,
    color: '#a1a1aa',
    marginBottom: 20,
    lineHeight: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#0a051b',
    borderWidth: 1,
    borderColor: '#2e2b3e',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  actionBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
    marginTop: 10,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  forgotBtn: {
    marginTop: 15,
    alignItems: 'center',
    padding: 10,
  },
  forgotBtnText: {
    color: '#8b5cf6',
    fontSize: 14,
    fontWeight: '600',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backBtn: {
    marginRight: 10,
    padding: 4,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  codeInput: {
    fontSize: 26,
    textAlign: 'center',
    letterSpacing: 10,
    fontWeight: 'bold',
    color: '#fbbf24',
    borderColor: '#fbbf24',
  }
});
