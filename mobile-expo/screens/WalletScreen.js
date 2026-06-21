import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

export default function WalletScreen() {
  const { state, updateState, apiFetch, triggerSync } = useApp();
  const [fundingAmount, setFundingAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddDemoFunds = async (amount) => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/user/add-funds', {
        method: 'POST',
        body: JSON.stringify({ amount })
      });

      if (response.ok) {
        const data = await response.json();
        updateState({ balance: parseFloat(data.balance) });
        triggerSync();
        Alert.alert("Успех", `Добавени са €${amount.toFixed(2)} към баланса Ви!`);
      } else {
        // Fallback if the endpoint does not exist on the VPS yet
        // Update local state, warn user that online sync might overwrite it, 
        // and suggest profile reset if they need a permanent sync.
        updateState(prev => {
          const newBalance = prev.balance + amount;
          const newHistory = [
            {
              id: Date.now(),
              desc: "Демо захранване (Локално)",
              amount: amount,
              type: "deposit",
              date: "Днес"
            },
            ...prev.walletHistory
          ];
          return { ...prev, balance: newBalance, walletHistory: newHistory };
        });
        Alert.alert(
          "Демо баланс", 
          `Добавени са €${amount.toFixed(2)} локално. В онлайн режим балансът се синхронизира със сървъра. Ако имате нужда от нулиране, използвайте бутона в 'Профил'.`
        );
      }
    } catch (e) {
      // Offline mode
      updateState(prev => {
        const newBalance = prev.balance + amount;
        const newHistory = [
          {
            id: Date.now(),
            desc: "Демо захранване (Офлайн)",
            amount: amount,
            type: "deposit",
            date: "Днес"
          },
          ...prev.walletHistory
        ];
        return { ...prev, balance: newBalance, walletHistory: newHistory };
      });
      Alert.alert("Офлайн захранване", `Добавени са €${amount.toFixed(2)} към Вашия офлайн портфейл.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>💳 ДИГИТАЛЕН ПОРТФЕЙЛ</Text>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Текущ баланс</Text>
        <Text style={styles.balanceValue}>€{state.balance.toFixed(2)}</Text>
        <View style={styles.balanceStatusRow}>
          <Ionicons 
            name={state.user.verified ? "checkmark-circle" : "alert-circle"} 
            size={14} 
            color={state.user.verified ? "#10b981" : "#f59e0b"} 
          />
          <Text style={[styles.balanceStatusText, state.user.verified ? styles.verifiedText : styles.unverifiedText]}>
            {state.user.verified ? "Акаунтът е верифициран с имейл" : "Изисква се имейл верификация"}
          </Text>
        </View>
      </View>

      {/* Demo Funding Section */}
      <Text style={styles.sectionHeader}>🪙 Безплатно демо захранване</Text>
      <View style={styles.fundingCard}>
        <Text style={styles.fundingDesc}>
          Тъй като това е демонстрационна версия, можете да добавите безплатни демо средства за тестване на турнирите.
        </Text>
        <View style={styles.btnGrid}>
          <TouchableOpacity 
            style={styles.fundBtn} 
            onPress={() => handleAddDemoFunds(10)}
            disabled={loading}
          >
            <Text style={styles.fundBtnText}>+ €10</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.fundBtn} 
            onPress={() => handleAddDemoFunds(20)}
            disabled={loading}
          >
            <Text style={styles.fundBtnText}>+ €20</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.fundBtn} 
            onPress={() => handleAddDemoFunds(50)}
            disabled={loading}
          >
            <Text style={styles.fundBtnText}>+ €50</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Legal Info Card */}
      <View style={styles.legalCard}>
        <View style={styles.legalHeader}>
          <Ionicons name="information-circle-outline" size={18} color="#a855f7" />
          <Text style={styles.legalTitle}>Правна Информация (Чл. 11 & Чл. 36)</Text>
        </View>
        <Text style={styles.legalText}>
          Всички турнири в WinBlitz се основават изцяло на бързина и интелектуални умения. Резултатът зависи напълно от Вашите действия, а не от случайност (жребий/томбола).
        </Text>
        <Text style={styles.legalText}>
          Когато участвате, Вие купувате дигитален арт тапет на пазарна стойност от €5. Талонът за състезанието е безплатен подарък (промоция). Този модел е напълно легален и извън Закона за хазарта.
        </Text>
      </View>

      {/* Transaction History */}
      <Text style={styles.sectionHeader}>📈 История на транзакциите</Text>
      {state.walletHistory.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Няма регистрирани транзакции.</Text>
        </View>
      ) : (
        state.walletHistory.map((item, idx) => {
          const isDeposit = item.type === 'deposit';
          return (
            <View key={item.id || idx} style={styles.transactionItem}>
              <View style={styles.txInfo}>
                <Text style={styles.txDesc}>{item.desc}</Text>
                <Text style={styles.txDate}>{item.date || 'Днес'}</Text>
              </View>
              <Text style={[styles.txAmount, isDeposit ? styles.txDeposit : styles.txWithdrawal]}>
                {isDeposit ? '+' : '-'} €{Math.abs(parseFloat(item.amount)).toFixed(2)}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a051b',
  },
  content: {
    padding: 15,
    paddingBottom: 40,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  balanceCard: {
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceLabel: {
    color: '#a1a1aa',
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  balanceValue: {
    color: '#fbbf24',
    fontSize: 28,
    fontWeight: '900',
    marginVertical: 10,
    textShadowColor: 'rgba(251, 191, 36, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  balanceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  balanceStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  verifiedText: {
    color: '#10b981',
  },
  unverifiedText: {
    color: '#f59e0b',
  },
  sectionHeader: {
    color: '#a855f7',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 15,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fundingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    marginBottom: 15,
  },
  fundingDesc: {
    color: '#a1a1aa',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 15,
  },
  btnGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  fundBtn: {
    flex: 1,
    backgroundColor: '#8b5cf6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fundBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  legalCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    padding: 15,
    marginBottom: 20,
  },
  legalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  legalTitle: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '850',
    textTransform: 'uppercase',
  },
  legalText: {
    color: '#71717a',
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 8,
  },
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#52525b',
    fontSize: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  txInfo: {
    flex: 1,
    paddingRight: 10,
  },
  txDesc: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  txDate: {
    color: '#52525b',
    fontSize: 9,
    marginTop: 3,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  txDeposit: {
    color: '#10b981',
  },
  txWithdrawal: {
    color: '#ef4444',
  }
});
