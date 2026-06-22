import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

export default function AdminScreen({ navigation }) {
  const { state, updateState, apiFetch, triggerSync } = useApp();
  const [loading, setLoading] = useState(false);

  // Form states for creating lobby
  const [prizeName, setPrizeName] = useState('');
  const [prizeValue, setPrizeValue] = useState('');
  const [ticketPrice, setTicketPrice] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('5');
  const [productType, setProductType] = useState('voucher'); 
  const [gameType, setGameType] = useState('math'); 
  const [productUrl, setProductUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Withdrawals
  const [withdrawals, setWithdrawals] = useState([]);

  const fetchWithdrawals = async () => {
    try {
      const res = await apiFetch('/api/admin/withdrawals');
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(data.withdrawals || []);
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchWithdrawals();
  }, [state.balance]);

  // Calculate statistics from completed games
  const nonPracticeGames = (state.completedTournaments || []).filter(g => !g.isPractice);
  const totalVolume = nonPracticeGames.reduce((sum, g) => sum + (g.players.length * g.ticketPrice), 0);
  const totalPayout = nonPracticeGames.reduce((sum, g) => g.winner === 'Вие' ? sum + g.prizeValue : sum, 0);
  const totalMargin = totalVolume - totalPayout;

  const handleCreateLobby = async () => {
    if (!prizeName || !prizeValue || !ticketPrice || !maxPlayers) {
      Alert.alert("Грешка", "Моля попълнете всички задължителни полета!");
      return;
    }

    setLoading(true);
    let resolvedImage = imageUrl.trim();
    if (!resolvedImage) {
      resolvedImage = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop';
    }

    let prodUrl = productUrl.trim();
    if (prodUrl && !/^https?:\/\//i.test(prodUrl)) {
      prodUrl = "https://" + prodUrl;
    }

    try {
      const response = await apiFetch('/api/admin/create-lobby', {
        method: 'POST',
        body: JSON.stringify({
          prizeName,
          prizeValue: parseFloat(prizeValue),
          ticketPrice: parseFloat(ticketPrice),
          maxPlayers: parseInt(maxPlayers),
          productType,
          gameType,
          image: resolvedImage,
          productUrl: prodUrl || null
        })
      });

      if (response.ok) {
        Alert.alert("Успех", `Турнирът за "${prizeName}" беше създаден успешно!`);
        // Reset form
        setPrizeName('');
        setPrizeValue('');
        setTicketPrice('');
        setProductUrl('');
        setImageUrl('');
        triggerSync();
      } else {
        throw new Error("Lobby creation failed");
      }
    } catch (e) {
      // Offline fallback
      updateState(prev => {
        const newLobby = {
          id: prev.lobbies.length + 10,
          prizeName,
          prizeValue: parseFloat(prizeValue),
          ticketPrice: parseFloat(ticketPrice),
          maxPlayers: parseInt(maxPlayers),
          productType,
          gameType,
          image: resolvedImage,
          productUrl: prodUrl || null,
          status: 'waiting',
          players: [],
          winner: null,
          isFriendDuel: false,
          isPractice: false
        };
        return {
          ...prev,
          lobbies: [...prev.lobbies, newLobby]
        };
      });
      Alert.alert("Създаване (Офлайн)", `Турнирът за "${prizeName}" беше добавен локално.`);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkShipped = async (archiveId) => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/admin/mark-shipped', {
        method: 'POST',
        body: JSON.stringify({ archiveId })
      });

      if (response.ok) {
        Alert.alert("Успех", "Поръчката е отбелязана като изпратена!");
        triggerSync();
      } else {
        throw new Error("Mark shipped failed");
      }
    } catch (e) {
      // Offline fallback
      updateState(prev => {
        const completedTournaments = prev.completedTournaments.map(g => 
          g.archiveId === archiveId ? { ...g, deliveryStatus: 'shipped' } : g
        );
        const wonPrizesList = prev.user.wonPrizesList.map(p => 
          p.archiveId === archiveId ? { ...p, delivery_status: 'shipped', deliveryStatus: 'shipped' } : p
        );
        return {
          ...prev,
          completedTournaments,
          user: { ...prev.user, wonPrizesList }
        };
      });
      Alert.alert("Успех (Офлайн)", "Поръчката е отбелязана като изпратена локално.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetAll = () => {
    Alert.alert(
      "Рестартиране на база данни",
      "ВНИМАНИЕ: Това действие ще изтрие всички потребители, история и игри от сървъра! Сигурни ли сте?",
      [
        { text: "Отказ", style: "cancel" },
        {
          text: "ИЗТРИЙ ВСИЧКО",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const res = await apiFetch('/api/admin/reset-all', { method: 'POST' });
              if (res.ok) {
                updateState({ role: 'user', balance: 100.00, lobbies: [], completedTournaments: [] });
                Alert.alert("Базата данни е нулирана!", "Акаунтът Ви бе превключен на обикновен потребител.");
                navigation.navigate('Lobbies');
              } else {
                throw new Error("DB reset failed");
              }
            } catch (e) {
              Alert.alert("Грешка", "Неуспешно свързване със сървъра за нулиране.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleProcessWithdrawal = async (id, action) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/withdrawal/${action}`, {
        method: 'POST',
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        Alert.alert("Успех", "Заявката е обработена.");
        fetchWithdrawals();
      } else {
        const err = await res.json();
        Alert.alert("Грешка", err.error || "Неуспешно обработване.");
      }
    } catch (e) {
      Alert.alert("Грешка", "Сървърна грешка.");
    } finally {
      setLoading(false);
    }
  };

  // Find all pending order deliveries
  const pendingOrders = nonPracticeGames.filter(g => g.deliveryStatus === 'pending' || !g.deliveryStatus);
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>⚙️ АДМИНИСТРАТОРСКИ ПАНЕЛ</Text>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Общ оборот</Text>
          <Text style={styles.statValue}>€{totalVolume.toFixed(2)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Изплатени</Text>
          <Text style={styles.statValue}>€{totalPayout.toFixed(2)}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#10b981', borderLeftWidth: 3 }]}>
          <Text style={styles.statLabel}>Марж къща</Text>
          <Text style={[styles.statValue, { color: '#10b981' }]}>€{totalMargin.toFixed(2)}</Text>
        </View>
      </View>

      {/* Withdrawals */}
      <Text style={styles.sectionHeader}>💳 ЧАКАЩИ ТЕГЛЕНИЯ ({pendingWithdrawals.length})</Text>
      {pendingWithdrawals.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Няма чакащи тегления.</Text>
        </View>
      ) : (
        pendingWithdrawals.map(w => (
          <View key={w.id} style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <Text style={styles.orderTitle}>€{parseFloat(w.amount).toFixed(2)} ({w.fullname})</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>Чака одобрение</Text>
              </View>
            </View>
            <View style={styles.orderMeta}>
              <Text style={styles.metaText}><Text style={styles.boldText}>IBAN: </Text>{w.iban}</Text>
              <Text style={styles.metaText}><Text style={styles.boldText}>Имейл: </Text>{w.email}</Text>
              {w.phone && <Text style={styles.metaText}><Text style={styles.boldText}>Телефон: </Text>{w.phone}</Text>}
              <Text style={styles.metaText}><Text style={styles.boldText}>Заявено: </Text>{new Date(w.created_at).toLocaleString('bg-BG')}</Text>
            </View>
            <View style={[styles.orderActions, { gap: 10 }]}>
              <TouchableOpacity 
                style={[styles.shipBtn, { flex: 1, justifyContent: 'center' }]} 
                onPress={() => handleProcessWithdrawal(w.id, 'approve')}
                disabled={loading}
              >
                <Ionicons name="checkmark" size={14} color="#fff" style={{ marginRight: 5 }} />
                <Text style={styles.shipBtnText}>ОДОБРИ ПЛАЩАНЕ</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.shipBtn, { flex: 1, justifyContent: 'center', backgroundColor: '#ef4444' }]} 
                onPress={() => handleProcessWithdrawal(w.id, 'reject')}
                disabled={loading}
              >
                <Ionicons name="close" size={14} color="#fff" style={{ marginRight: 5 }} />
                <Text style={styles.shipBtnText}>ОТКАЖИ</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* Form: Create Lobby */}
      <Text style={styles.sectionHeader}>➕ СЪЗДАЙ ТУРНИР ЗА НАГРАДА</Text>
      <View style={styles.formCard}>
        <TextInput 
          style={styles.input} 
          placeholder="Име на наградата (напр. Комплект чаши)..." 
          placeholderTextColor="#52525b"
          value={prizeName}
          onChangeText={setPrizeName}
        />
        <TextInput 
          style={styles.input} 
          placeholder="Стойност на наградата (€)..." 
          placeholderTextColor="#52525b"
          keyboardType="numeric"
          value={prizeValue}
          onChangeText={setPrizeValue}
        />
        <TextInput 
          style={styles.input} 
          placeholder="Цена на билет за участие (€)..." 
          placeholderTextColor="#52525b"
          keyboardType="numeric"
          value={ticketPrice}
          onChangeText={setTicketPrice}
        />
        <TextInput 
          style={styles.input} 
          placeholder="Максимум играчи (напр. 5)..." 
          placeholderTextColor="#52525b"
          keyboardType="numeric"
          value={maxPlayers}
          onChangeText={setMaxPlayers}
        />
        
        {/* Product Type Selector */}
        <Text style={styles.fieldLabel}>Тип дигитален продукт</Text>
        <View style={styles.radioGroup}>
          {['voucher', 'wallpaper', 'guide'].map((t) => (
            <TouchableOpacity 
              key={t}
              style={[styles.radioBtn, productType === t && styles.radioBtnActive]}
              onPress={() => setProductType(t)}
            >
              <Text style={[styles.radioText, productType === t && styles.radioTextActive]}>
                {t === 'voucher' ? '🎫 Ваучер' : t === 'wallpaper' ? '🖼️ Тапет' : '📚 Гайд'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Game Type Selector */}
        <Text style={styles.fieldLabel}>Тип игра</Text>
        <View style={styles.radioGroupGrid}>
          {['math', 'memory', 'reflex', 'scramble', 'numbers'].map((gt) => (
            <TouchableOpacity 
              key={gt}
              style={[styles.radioBtnCell, gameType === gt && styles.radioBtnCellActive]}
              onPress={() => setGameType(gt)}
            >
              <Text style={[styles.radioText, gameType === gt && styles.radioTextActive]}>
                {gt === 'math' ? '🧮 Математика' : 
                 gt === 'memory' ? '🃏 Памет' : 
                 gt === 'reflex' ? '⚡ Рефлекс' :
                 gt === 'scramble' ? '🔤 Думи' : '🔢 Числа'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput 
          style={styles.input} 
          placeholder="Линк към продукта в магазина..." 
          placeholderTextColor="#52525b"
          value={productUrl}
          onChangeText={setProductUrl}
        />
        <TextInput 
          style={styles.input} 
          placeholder="Линк към изображение (незадължително)..." 
          placeholderTextColor="#52525b"
          value={imageUrl}
          onChangeText={setImageUrl}
        />

        <TouchableOpacity 
          style={styles.createBtn} 
          onPress={handleCreateLobby}
          disabled={loading}
        >
          <Text style={styles.createBtnText}>СЪЗДАЙ ТУРНИР</Text>
        </TouchableOpacity>
      </View>

      {/* Orders Deliveries */}
      <Text style={styles.sectionHeader}>📦 УПРАВЛЕНИЕ НА ДОСТАВКИТЕ ({pendingOrders.length})</Text>
      {pendingOrders.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Няма чакащи доставки за изпращане.</Text>
        </View>
      ) : (
        pendingOrders.map((order) => {
          // Check if winner details are inside player list
          const winnerPlayer = order.players.find(p => p.isMe && order.winner === 'Вие');
          return (
            <View key={order.archiveId || order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderTitle}>{order.prizeName} (#{order.archiveId})</Text>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>Чака доставка</Text>
                </View>
              </View>

              <View style={styles.orderMeta}>
                <Text style={styles.metaText}><Text style={styles.boldText}>Победител: </Text>{order.winner}</Text>
                {order.winner === 'Вие' && state.user.verified ? (
                  <View style={styles.winnerAddressCard}>
                    <Text style={styles.addressText}><Text style={styles.boldText}>Име: </Text>{state.user.fullname}</Text>
                    <Text style={styles.addressText}><Text style={styles.boldText}>Град: </Text>{state.user.city}</Text>
                    <Text style={styles.addressText}><Text style={styles.boldText}>Адрес: </Text>{state.user.address}</Text>
                    <Text style={styles.addressText}><Text style={styles.boldText}>Имейл: </Text>{state.user.email}</Text>
                    {state.user.phone ? <Text style={styles.addressText}><Text style={styles.boldText}>Тел: </Text>{state.user.phone}</Text> : null}
                  </View>
                ) : (
                  <Text style={styles.metaText}>• Данни за доставка: Симулиран бот адрес</Text>
                )}
                <Text style={styles.metaText}><Text style={styles.boldText}>Оборот такси: </Text>€{(order.players.length * order.ticketPrice).toFixed(2)}</Text>
              </View>

              <View style={styles.orderActions}>
                <TouchableOpacity 
                  style={styles.shipBtn} 
                  onPress={() => handleMarkShipped(order.archiveId)}
                  disabled={loading}
                >
                  <Ionicons name="airplane-outline" size={14} color="#fff" style={{ marginRight: 5 }} />
                  <Text style={styles.shipBtnText}>Маркирай като изпратено</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* Dangerous Operations */}
      <Text style={[styles.sectionHeader, { color: '#ef4444' }]}>⚠️ ОПАСНИ ОПЕРАЦИИ</Text>
      <TouchableOpacity 
        style={styles.dangerResetBtn} 
        onPress={handleResetAll}
        disabled={loading}
      >
        <Ionicons name="nuclear-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.dangerResetBtnText}>ИЗЧИСТИ ЦЯЛАТА БАЗА ДАННИ (СЪРВЪР)</Text>
      </TouchableOpacity>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#a855f7" />
        </View>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
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
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
  },
  statLabel: {
    color: '#71717a',
    fontSize: 9,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  statValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
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
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 12,
    marginBottom: 10,
  },
  fieldLabel: {
    color: '#a1a1aa',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 5,
    marginBottom: 8,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 15,
  },
  radioGroupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 15,
  },
  radioBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  radioBtnActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderColor: '#a855f7',
  },
  radioBtnCell: {
    width: '31%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 4,
  },
  radioBtnCellActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderColor: '#a855f7',
  },
  radioText: {
    color: '#71717a',
    fontSize: 9,
    fontWeight: '800',
  },
  radioTextActive: {
    color: '#fff',
  },
  createBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    color: '#52525b',
    fontSize: 12,
  },
  orderCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 15,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  pendingBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pendingBadgeText: {
    color: '#fbbf24',
    fontSize: 8,
    fontWeight: '800',
  },
  orderMeta: {
    gap: 5,
    marginBottom: 15,
  },
  metaText: {
    color: '#d4d4d8',
    fontSize: 11,
  },
  boldText: {
    color: '#71717a',
    fontWeight: '700',
  },
  winnerAddressCard: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 8,
    padding: 10,
    gap: 4,
    marginVertical: 5,
  },
  addressText: {
    color: '#fff',
    fontSize: 11,
  },
  orderActions: {
    flexDirection: 'row',
  },
  shipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  shipBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  dangerResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 14,
    marginTop: 5,
    marginBottom: 30,
  },
  dangerResetBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 2, 15, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  }
});
