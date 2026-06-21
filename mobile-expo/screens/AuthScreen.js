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
  const { checkEmail, registerEmail, verifyEmailCode } = useApp();

  // Step state: 'email' | 'register' | 'verify'
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  
  // Registration form fields
  const [fullname, setFullname] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  
  // Verification code fields
  const [code, setCode] = useState('');
  const [simulatedCode, setSimulatedCode] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);

  // Email format validation
  const validateEmail = (text) => {
    const reg = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w\w+)+$/;
    return reg.test(text);
  };

  const handleNextStep = async () => {
    if (!email || !validateEmail(email)) {
      Alert.alert("Грешка", "Моля въведете валиден имейл адрес!");
      return;
    }

    setLoading(true);
    const checkRes = await checkEmail(email);
    setLoading(false);

    if (checkRes.offline) {
      // Offline mode registration path
      setIsNewUser(true);
      setStep('register');
      return;
    }

    if (checkRes.registered) {
      // Login flow: existing user
      setIsNewUser(false);
      setLoading(true);
      const regRes = await registerEmail(email);
      setLoading(false);
      
      if (regRes.success) {
        setSimulatedCode(regRes.code);
        setStep('verify');
      } else {
        Alert.alert("Грешка", regRes.error || "Грешка при изпращане на код.");
      }
    } else {
      // Register flow: new user
      setIsNewUser(true);
      setStep('register');
    }
  };

  const handleRegister = async () => {
    if (!fullname || !city || !address) {
      Alert.alert("Грешка", "Моля попълнете всички полета за доставка!");
      return;
    }

    setLoading(true);
    const regRes = await registerEmail(email, fullname, city, address);
    setLoading(false);

    if (regRes.success) {
      setSimulatedCode(regRes.code);
      setStep('verify');
    } else {
      Alert.alert("Грешка", regRes.error || "Грешка при регистрация.");
    }
  };

  const handleVerify = async () => {
    if (!code || code.length !== 4) {
      Alert.alert("Грешка", "Моля въведете 4-цифрения код!");
      return;
    }

    setLoading(true);
    const tempDetails = { fullname, city, address };
    const verRes = await verifyEmailCode(email, code, simulatedCode, tempDetails);
    setLoading(false);

    if (verRes.success) {
      Alert.alert("Успешна идентификация", "Добре дошли в WinBlitz!");
    } else {
      Alert.alert("Грешка", verRes.error || "Невалиден код.");
    }
  };

  const handleGoBack = () => {
    if (step === 'register') {
      setStep('email');
    } else if (step === 'verify') {
      if (isNewUser) {
        setStep('register');
      } else {
        setStep('email');
      }
      setCode('');
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
          {step === 'email' && (
            <View>
              <Text style={styles.cardTitle}>Вход / Регистрация</Text>
              <Text style={styles.cardDesc}>Въведете имейл, за да влезете или да създадете безплатен профил.</Text>
              
              <TextInput 
                style={styles.input}
                placeholder="Имейл адрес (напр. user@mail.com)..."
                placeholderTextColor="#52525b"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />

              <TouchableOpacity 
                style={styles.actionBtn} 
                onPress={handleNextStep}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionBtnText}>Продължи</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {step === 'register' && (
            <View>
              <View style={styles.cardHeaderRow}>
                <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={20} color="#a1a1aa" />
                </TouchableOpacity>
                <Text style={styles.cardTitle}>Нов профил</Text>
              </View>
              <Text style={styles.cardDesc}>
                Въведете реалните си данни за получаване на спечелените награди от Спиди/Еконт.
              </Text>

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

          {step === 'verify' && (
            <View>
              <View style={styles.cardHeaderRow}>
                <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={20} color="#a1a1aa" />
                </TouchableOpacity>
                <Text style={styles.cardTitle}>Верификация</Text>
              </View>
              <Text style={styles.cardDesc}>
                Изпратихме 4-цифрен код на имейл: <Text style={styles.boldText}>{email}</Text>
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

              <TouchableOpacity 
                style={styles.actionBtn} 
                onPress={handleVerify}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionBtnText}>Потвърди код</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Mock Email Simulator Drawer removed as requested */}
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
  cardDesc: {
    fontSize: 14,
    color: '#a1a1aa',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 20,
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
  codeInput: {
    fontSize: 26,
    textAlign: 'center',
    letterSpacing: 10,
    fontWeight: 'bold',
    color: '#fbbf24',
    borderColor: '#fbbf24',
  },
  boldText: {
    color: '#fff',
    fontWeight: '600',
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
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  simulatorDrawer: {
    marginTop: 25,
    backgroundColor: '#1b1242',
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 12,
    padding: 16,
  },
  simulatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  simulatorTitle: {
    fontSize: 14,
    color: '#fbbf24',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  simulatorBody: {
    backgroundColor: '#0d0726',
    borderRadius: 8,
    padding: 12,
  },
  simulatorText: {
    fontSize: 12,
    color: '#a1a1aa',
    marginBottom: 3,
  },
  simulatorLabel: {
    color: '#e4e4e7',
    fontWeight: '500',
  },
  simulatorDivider: {
    height: 1,
    backgroundColor: '#2e2b3e',
    marginVertical: 8,
  },
  simulatorMessage: {
    fontSize: 12,
    color: '#d4d4d8',
    lineHeight: 18,
  },
  simulatorCodeText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fbbf24',
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 3,
  }
});
