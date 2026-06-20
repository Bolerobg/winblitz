import React, { useState } from 'react';
import { StyleSheet, View, Text, Modal, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

export default function AdminAuthModal({ visible, onClose, onAuthSuccess }) {
  const { setAdminPassword, updateState } = useApp();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = () => {
    if (password === 'admin1234') {
      setAdminPassword(password);
      updateState({ role: 'admin' });
      setPassword('');
      Alert.alert("Успех", "Администраторският достъп е активиран!");
      onAuthSuccess();
      onClose();
    } else {
      Alert.alert("Грешка", "Невалидна парола!");
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#71717a" />
          </TouchableOpacity>

          <Text style={styles.modalTitle}>🔑 Администраторски Вход</Text>
          <Text style={styles.modalSubtitle}>Въведете парола за достъп до панела</Text>

          {/* Password Input container */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Парола..."
              placeholderTextColor="#52525b"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity 
              style={styles.eyeBtn} 
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons 
                name={showPassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color="#71717a" 
              />
            </TouchableOpacity>
          </View>

          {/* Action button */}
          <TouchableOpacity 
            style={styles.submitBtn} 
            activeOpacity={0.8}
            onPress={handleSubmit}
          >
            <Text style={styles.submitBtnText}>ВХОД</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 2, 15, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#0f0a24',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    padding: 20,
    alignItems: 'center',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 10,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 10,
  },
  modalSubtitle: {
    color: '#a1a1aa',
    fontSize: 11,
    marginTop: 5,
    marginBottom: 20,
  },
  inputContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  input: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 14,
  },
  eyeBtn: {
    padding: 5,
  },
  submitBtn: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  }
});
