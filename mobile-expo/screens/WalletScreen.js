import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';

export default function WalletScreen() {
  const { state, updateState, apiFetch, triggerSync, createPaymentIntent, confirmDeposit, requestWithdrawal } = useApp();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  
  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [iban, setIban] = useState('');
  const [withdrawals, setWithdrawals] = useState([]);

  // Fetch withdrawals history
  useEffect(() => {
    const fetchWithdrawals = async () => {
      try {
        const res = await apiFetch('/api/user/withdrawals');
        if (res.ok) {
          const data = await res.json();
          setWithdrawals(data.withdrawals || []);
        }
      } catch (err) {}
    };
    fetchWithdrawals();
  }, [state.balance]);

  const handleStripeDeposit = async (amount) => {
    if (!state.user.verified) {
      Alert.alert("Верификация", "Моля, първо верифицирайте профила си от меню 'Профил'!");
      return;
    }
    setLoading(true);
    const { success, data } = await createPaymentIntent(amount);
    
    if (!success || !data.clientSecret) {
      Alert.alert("Грешка", "Неуспешно свързване със Stripe.");
      setLoading(false);
      return;
    }

    const initRes = await initPaymentSheet({
      merchantDisplayName: 'WinBlitz',
      paymentIntentClientSecret: data.clientSecret,
      returnURL: 'tombola://stripe-redirect',
    });

    if (initRes.error) {
      Alert.alert("Грешка", initRes.error.message);
      setLoading(false);
      return;
    }

    const paymentRes = await presentPaymentSheet();

    if (paymentRes.error) {
      Alert.alert("Отказано", "Плащането беше отказано или прекъснато.");
      setLoading(false);
      return;
    }

    const confirmRes = await confirmDeposit(amount, data.paymentIntentId);
    if (confirmRes.success) {
      Alert.alert("Успех", `Успешно депозирахте €${amount.toFixed(2)}!`);
    } else {
      Alert.alert("Грешка", "Плащането мина, но възникна грешка при запазването.");
    }
    setLoading(false);
  };

  const handleWithdraw = async () => {
    const amountNum = parseFloat(withdrawAmount);
    if (!amountNum || amountNum < 20) {
      Alert.alert("Грешка", "Минималната сума за теглене е €20.00");
      return;
    }
    if (amountNum > state.balance) {
      Alert.alert("Грешка", "Нямате достатъчно наличен баланс.");
      return;
    }
    if (!iban || iban.length < 10) {
      Alert.alert("Грешка", "Въведете валиден IBAN.");
      return;
    }

    setLoading(true);
    const res = await requestWithdrawal(amountNum, iban);
    setLoading(false);

    if (res.success) {
      Alert.alert("Заявката е изпратена", "Тегленето ще бъде обработено от администратор скоро.");
      setWithdrawAmount('');
      setIban('');
    } else {
      Alert.alert("Грешка", res.error || "Възникна грешка при тегленето.");
    }
  };

  const getStatusColor = (status) => {
    if (status === 'approved') return '#10b981';
    if (status === 'rejected') return '#ef4444';
    return '#f59e0b';
  };
  
  const getStatusLabel = (status) => {
    if (status === 'approved') return 'ОДОБРЕНА';
    if (status === 'rejected') return 'ОТХВЪРЛЕНА';
    return 'ЧАКАЩА';
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

      {/* Stripe Deposit */}
      <Text style={styles.sectionHeader}>💳 Депозит (Stripe Test)</Text>
      <View style={styles.fundingCard}>
        <Text style={styles.fundingDesc}>
          Използвайте тестова карта (напр. 4242 4242...) за да захраните акаунта си сигурно чрез Stripe.
        </Text>
        <View style={styles.btnGrid}>
          <TouchableOpacity 
            style={styles.fundBtn} 
            onPress={() => handleStripeDeposit(10)}
            disabled={loading}
          >
            <Text style={styles.fundBtnText}>+ €10</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.fundBtn} 
            onPress={() => handleStripeDeposit(20)}
            disabled={loading}
          >
            <Text style={styles.fundBtnText}>+ €20</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.fundBtn} 
            onPress={() => handleStripeDeposit(50)}
            disabled={loading}
          >
            <Text style={styles.fundBtnText}>+ €50</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Withdrawal Form */}
      <Text style={styles.sectionHeader}>🏦 Изтегли Печалба</Text>
      <View style={styles.withdrawCard}>
        <Text style={styles.withdrawDesc}>Минимална сума за теглене: €20.00. Всяка транзакция се одобрява ръчно от екипа ни.</Text>
        <TextInput
          style={styles.input}
          placeholder="Сума (напр. 25.00)"
          placeholderTextColor="#52525b"
          keyboardType="numeric"
          value={withdrawAmount}
          onChangeText={setWithdrawAmount}
        />
        <TextInput
          style={styles.input}
          placeholder="Вашият IBAN"
          placeholderTextColor="#52525b"
          autoCapitalize="characters"
          value={iban}
          onChangeText={setIban}
        />
        <TouchableOpacity 
          style={styles.withdrawBtn}
          onPress={handleWithdraw}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.withdrawBtnText}>Заяви Теглене</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Withdrawal History */}
      {withdrawals.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>⏳ Заявки за теглене</Text>
          {withdrawals.map((w, idx) => (
            <View key={w.id || idx} style={styles.transactionItem}>
              <View style={styles.txInfo}>
                <Text style={styles.txDesc}>Теглене към IBAN</Text>
                <Text style={styles.txDate}>{new Date(w.created_at).toLocaleString('bg-BG')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.txAmount, styles.txWithdrawal]}>
                  - €{parseFloat(w.amount).toFixed(2)}
                </Text>
                <Text style={[styles.wStatusText, { color: getStatusColor(w.status) }]}>
                  {getStatusLabel(w.status)}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* General History */}
      <Text style={styles.sectionHeader}>📈 История на транзакциите</Text>
      {state.walletHistory.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Няма регистрирани транзакции.</Text>
        </View>
      ) : (
        state.walletHistory.slice(0, 10).map((item, idx) => {
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
  withdrawCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    marginBottom: 15,
  },
  withdrawDesc: {
    color: '#a1a1aa',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 15,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    color: '#fff',
    paddingHorizontal: 15,
    height: 45,
    marginBottom: 10,
  },
  withdrawBtn: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 5,
  },
  withdrawBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
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
  },
  wStatusText: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
  }
});
