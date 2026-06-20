import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

export default function Header({ onOpenAdminAuth }) {
  const { state } = useApp();
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);

  const handleLogoClick = () => {
    const now = Date.now();
    if (now - lastClickTime < 800) {
      const newCount = clickCount + 1;
      setClickCount(newCount);
      if (newCount >= 5) {
        setClickCount(0);
        onOpenAdminAuth();
      }
    } else {
      setClickCount(1);
    }
    setLastClickTime(now);
  };

  return (
    <View style={styles.header}>
      {/* Logo Wrapper */}
      <TouchableOpacity 
        activeOpacity={0.8} 
        onPress={handleLogoClick}
        style={styles.logoContainer}
      >
        <Text style={styles.logoEmoji}>⚡</Text>
        <Text style={styles.logoText}>
          WIN<Text style={styles.logoPurple}>BLITZ</Text>
        </Text>
      </TouchableOpacity>

      {/* Balance Wrapper */}
      <View style={styles.balanceContainer}>
        {state.practiceModeActive ? (
          <View style={styles.practiceBadge}>
            <Text style={styles.practiceText}>🏋️ ДЕМО</Text>
          </View>
        ) : (
          <View style={styles.realBalanceCard}>
            <Ionicons name="wallet-outline" size={14} color="#fbbf24" style={styles.walletIcon} />
            <Text style={styles.balanceValue}>€{state.balance.toFixed(2)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 60,
    backgroundColor: '#0f0a24',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoEmoji: {
    fontSize: 20,
    marginRight: 6,
    textShadowColor: 'rgba(168, 85, 247, 0.75)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  logoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  logoPurple: {
    color: '#a855f7',
    textShadowColor: 'rgba(168, 85, 247, 0.75)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  practiceBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  practiceText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
  },
  realBalanceCard: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
  },
  walletIcon: {
    marginRight: 6,
  },
  balanceValue: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '800',
  },
});
