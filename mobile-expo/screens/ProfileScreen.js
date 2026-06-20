import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

const SHOP_AVATARS = [
  { avatar: "👑", price: 3.00, name: "Корона" },
  { avatar: "🦄", price: 2.00, name: "Еднорог" },
  { avatar: "🕵️", price: 1.50, name: "Детектив" },
  { avatar: "🤖", price: 1.50, name: "Робот" },
  { avatar: "🦁", price: 2.00, name: "Лъв" },
  { avatar: "👽", price: 2.50, name: "Извънземно" }
];

const SHOP_THEMES = [
  { id: "default", name: "Стандартна Неон", desc: "Оригинален лилав неон", price: 0 },
  { id: "cyberpunk", name: "Cyberpunk", desc: "Електриково синьо и розово", price: 5.00 },
  { id: "emerald", name: "Emerald", desc: "Дълбоко изумрудено зелено", price: 4.00 },
  { id: "gold", name: "Gold Royale", desc: "Кралско златно и черно", price: 7.00 }
];

export default function ProfileScreen({ onOpenLootbox }) {
  const { state, updateState, apiFetch, registerEmail, verifyEmailCode, resetApp, triggerSync } = useApp();

  // Verification Form State
  const [fullname, setFullname] = useState(state.user.fullname || '');
  const [city, setCity] = useState(state.user.city || '');
  const [address, setAddress] = useState(state.user.address || '');
  const [email, setEmail] = useState(state.user.email || '');
  const [emailSent, setEmailSent] = useState(false);
  const [emailCode, setEmailCode] = useState('');
  const [simulatedCode, setSimulatedCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Shop state
  const [shopTab, setShopTab] = useState('avatars'); // 'avatars' or 'themes'

  // XP details helper
  const getLeagueDetails = (xp) => {
    if (xp < 300) return { name: "Бронз", badge: "🥉", nextXp: 300 };
    if (xp < 1000) return { name: "Сребро", badge: "🥈", nextXp: 1000 };
    if (xp < 3000) return { name: "Злато", badge: "🥇", nextXp: 3000 };
    return { name: "Елит", badge: "👑", nextXp: 99999 };
  };

  const league = getLeagueDetails(state.xp);

  // Address Email code requests
  const handleRequestVerification = async () => {
    if (!fullname || !city || !address || !email) {
      Alert.alert("Грешка", "Моля попълнете всички полета за адрес!");
      return;
    }
    setLoading(true);
    const res = await registerEmail(email, fullname, city, address);
    setLoading(false);
    if (res.success) {
      setEmailSent(true);
      setSimulatedCode(res.code);
      Alert.alert("Имейл Симулатор", `Вашият код е: ${res.code}`);
    } else {
      Alert.alert("Грешка", res.error || "Грешка при изпращане на код.");
    }
  };

  const handleVerifyCode = async () => {
    if (!emailCode) return;
    setLoading(true);
    const tempDetails = { fullname, city, address };
    const res = await verifyEmailCode(email, emailCode, simulatedCode, tempDetails);
    setLoading(false);
    if (res.success) {
      Alert.alert("Успех", "Профилът Ви е успешно верифициран!");
      setEmailSent(false);
      setEmailCode('');
    } else {
      Alert.alert("Грешка", res.error || "Невалиден код.");
    }
  };

  // Quests claim
  const handleClaimQuest = async (questId, questReward, questDesc) => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/user/claim-quest', {
        method: 'POST',
        body: JSON.stringify({ questId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          updateState({
            balance: parseFloat(data.user.balance),
            dailyQuests: typeof data.user.daily_quests === 'string' ? JSON.parse(data.user.daily_quests) : data.user.daily_quests,
            unlockedAchievements: data.user.unlocked_achievements || []
          });
          triggerSync();
        }
        Alert.alert("Успех", `Прибрахте награда от €${questReward.toFixed(2)}!`);
      } else {
        throw new Error("Quest claim API error");
      }
    } catch (e) {
      // Offline quest claim
      updateState(prev => {
        const newBalance = prev.balance + questReward;
        const newHistory = [
          {
            id: Date.now(),
            desc: `Награда от куест: ${questDesc}`,
            amount: questReward,
            type: "deposit",
            date: "Днес"
          },
          ...prev.walletHistory
        ];
        const newQuests = prev.dailyQuests.map(q => q.id === questId ? { ...q, claimed: true } : q);
        return {
          ...prev,
          balance: newBalance,
          dailyQuests: newQuests,
          walletHistory: newHistory
        };
      });
      Alert.alert("Успех (Офлайн)", `Прибрахте награда от €${questReward.toFixed(2)}!`);
    } finally {
      setLoading(false);
    }
  };

  // Buy cosmetic avatar
  const handleBuyAvatar = async (avatar, price) => {
    if (state.balance < price) {
      Alert.alert("Грешка", "Недостатъчен баланс за закупуване!");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/api/user/buy-avatar', {
        method: 'POST',
        body: JSON.stringify({ avatarId: avatar, price })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          updateState({
            balance: parseFloat(data.user.balance),
            unlockedAvatars: data.user.unlocked_avatars || ['👤']
          });
          triggerSync();
        }
        Alert.alert("Успех", "Успешно закупихте новия аватар!");
      } else {
        throw new Error("Buy avatar API error");
      }
    } catch (e) {
      // Offline cosmetic buy
      updateState(prev => {
        const newBalance = prev.balance - price;
        const newHistory = [
          {
            id: Date.now(),
            desc: `Купуване на аватар ${avatar} 👤`,
            amount: -price,
            type: "withdrawal",
            date: "Днес"
          },
          ...prev.walletHistory
        ];
        return {
          ...prev,
          balance: newBalance,
          unlockedAvatars: [...prev.unlockedAvatars, avatar],
          walletHistory: newHistory
        };
      });
      Alert.alert("Успех (Офлайн)", "Успешно закупихте новия аватар!");
    } finally {
      setLoading(false);
    }
  };

  // Select avatar
  const handleSelectAvatar = async (avatar) => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/user/select-avatar', {
        method: 'POST',
        body: JSON.stringify({ avatarId: avatar })
      });
      if (res.ok) {
        const data = await res.json();
        updateState({ activeAvatar: data.user.active_avatar });
        triggerSync();
      } else {
        throw new Error("Select avatar API error");
      }
    } catch (e) {
      // Offline select
      updateState({ activeAvatar: avatar });
    } finally {
      setLoading(false);
    }
  };

  // Buy cosmetic theme
  const handleBuyTheme = async (themeId, price) => {
    if (state.balance < price) {
      Alert.alert("Грешка", "Недостатъчен баланс за закупуване!");
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/api/user/buy-theme', {
        method: 'POST',
        body: JSON.stringify({ themeId, price })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          updateState({
            balance: parseFloat(data.user.balance),
            unlockedThemes: data.user.unlocked_themes || ['default']
          });
          triggerSync();
        }
        Alert.alert("Успех", "Успешно закупихте новата тема!");
      } else {
        throw new Error("Buy theme API error");
      }
    } catch (e) {
      // Offline buy
      updateState(prev => {
        const newBalance = prev.balance - price;
        const newHistory = [
          {
            id: Date.now(),
            desc: `Закупуване на цветна тема: ${themeId}`,
            amount: -price,
            type: "withdrawal",
            date: "Днес"
          },
          ...prev.walletHistory
        ];
        return {
          ...prev,
          balance: newBalance,
          unlockedThemes: [...prev.unlockedThemes, themeId],
          walletHistory: newHistory
        };
      });
      Alert.alert("Успех (Офлайн)", "Успешно закупихте новата тема!");
    } finally {
      setLoading(false);
    }
  };

  // Select theme
  const handleSelectTheme = async (themeId) => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/user/select-theme', {
        method: 'POST',
        body: JSON.stringify({ themeId })
      });
      if (res.ok) {
        const data = await res.json();
        updateState({ activeTheme: data.user.active_theme });
        triggerSync();
      } else {
        throw new Error("Select theme API error");
      }
    } catch (e) {
      // Offline select
      updateState({ activeTheme: themeId });
    } finally {
      setLoading(false);
    }
  };

  // Reset App Data
  const handleResetData = () => {
    Alert.alert(
      "Нулиране на Профил",
      "Сигурни ли сте, че искате да изчистите всички данни и да нулирате баланса си до €100.00?",
      [
        { text: "Отказ", style: "cancel" },
        { 
          text: "Нулирай", 
          style: "destructive", 
          onPress: async () => {
            setLoading(true);
            await resetApp();
            setFullname('');
            setCity('');
            setAddress('');
            setPhone('');
            setSmsSent(false);
            setLoading(false);
            Alert.alert("Готово", "Данните бяха нулирани!");
          } 
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header Card */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarIcon}>{state.activeAvatar || "👤"}</Text>
        </View>
        <Text style={styles.userName}>
          {state.user.fullname ? state.user.fullname : "Профил (Неверифициран)"}
        </Text>
        <Text style={styles.userPhone}>
          {state.user.email ? state.user.email : "Няма имейл"}
        </Text>

        {/* XP Level bar */}
        <View style={styles.xpWrapper}>
          <View style={styles.xpLabelRow}>
            <Text style={styles.xpLabel}>Ранг: {league.badge} {league.name}</Text>
            <Text style={styles.xpValue}>{state.xp} / {league.nextXp} XP</Text>
          </View>
          <View style={styles.xpProgressBg}>
            <View style={[styles.xpProgressFill, { width: `${Math.min(100, (state.xp / league.nextXp) * 100)}%` }]} />
          </View>
        </View>
      </View>

      {/* Lootbox inventory card */}
      {state.lootBoxesOwned > 0 && (
        <TouchableOpacity 
          style={styles.lootboxCard} 
          activeOpacity={0.8}
          onPress={onOpenLootbox}
        >
          <Text style={styles.lootboxIcon}>🎁</Text>
          <View style={styles.lootboxTextContainer}>
            <Text style={styles.lootboxTitle}>Имате {state.lootBoxesOwned} кутии за отваряне!</Text>
            <Text style={styles.lootboxDesc}>Натиснете тук за да отворите и спечелите награди</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#d946ef" />
        </TouchableOpacity>
      )}

      {/* Daily Quests */}
      <Text style={styles.sectionHeader}>📅 Дневни предизвикателства</Text>
      <View style={styles.questsCard}>
        {state.dailyQuests.map((quest) => {
          const canClaim = quest.current >= quest.target && !quest.claimed;
          return (
            <View key={quest.id} style={styles.questItem}>
              <View style={styles.questInfo}>
                <Text style={[styles.questDesc, quest.claimed && styles.questCompletedText]}>
                  {quest.desc}
                </Text>
                <Text style={styles.questProgress}>
                  Прогрес: <Text style={styles.boldText}>{quest.current}/{quest.target}</Text> | Награда: €{quest.reward.toFixed(2)}
                </Text>
              </View>
              {quest.claimed ? (
                <View style={styles.claimedBadge}>
                  <Text style={styles.claimedText}>Прибрана</Text>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[styles.claimBtn, !canClaim && styles.claimBtnDisabled]}
                  disabled={!canClaim || loading}
                  onPress={() => handleClaimQuest(quest.id, quest.reward, quest.desc)}
                >
                  <Text style={styles.claimBtnText}>Вземи</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* Address Email Verification */}
      <Text style={styles.sectionHeader}>🔐 Верификация на адрес за награди</Text>
      {state.user.verified ? (
        <View style={styles.verifiedCard}>
          <View style={styles.verifiedHeader}>
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            <Text style={styles.verifiedTitle}>ВЕРИФИЦИРАН ПРОФИЛ</Text>
          </View>
          <View style={styles.verifiedDetails}>
            <Text style={styles.verifiedText}><Text style={styles.verifiedLabel}>Име: </Text>{state.user.fullname}</Text>
            <Text style={styles.verifiedText}><Text style={styles.verifiedLabel}>Град: </Text>{state.user.city}</Text>
            <Text style={styles.verifiedText}><Text style={styles.verifiedLabel}>Адрес: </Text>{state.user.address}</Text>
            <Text style={styles.verifiedText}><Text style={styles.verifiedLabel}>Имейл: </Text>{state.user.email}</Text>
            {state.user.phone && <Text style={styles.verifiedText}><Text style={styles.verifiedLabel}>Телефон: </Text>{state.user.phone}</Text>}
          </View>
          <Text style={styles.verifiedSub}>Всички материални награди от спечелените лобита ще бъдат автоматично адресирани до тези данни.</Text>
        </View>
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.formInfo}>Въведете Вашите реални данни за доставка. При победа наградите ще бъдат пратени на този адрес.</Text>
          
          <TextInput 
            style={styles.input} 
            placeholder="Три имена за доставка..." 
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
            placeholder="Адрес (офис на Спиди/Еконт или личен)..." 
            placeholderTextColor="#52525b"
            value={address}
            onChangeText={setAddress}
          />
          <TextInput 
            style={styles.input} 
            placeholder="Имейл адрес..." 
            placeholderTextColor="#52525b"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          {emailSent ? (
            <View style={styles.smsCodeRow}>
              <TextInput 
                style={[styles.input, { flex: 1, marginBottom: 0 }]} 
                placeholder="4-цифрен код от имейл..." 
                placeholderTextColor="#52525b"
                keyboardType="number-pad"
                value={emailCode}
                onChangeText={setEmailCode}
              />
              <TouchableOpacity 
                style={styles.verifyBtn} 
                onPress={handleVerifyCode}
                disabled={loading}
              >
                <Text style={styles.verifyBtnText}>Верифицирай</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.formBtn} 
              onPress={handleRequestVerification}
              disabled={loading}
            >
              <Text style={styles.formBtnText}>Изпрати код за потвърждение</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Cosmetics Shop */}
      <Text style={styles.sectionHeader}>🛍️ МАГАЗИН ЗА КОЗМЕТИКА</Text>
      <View style={styles.shopCard}>
        <View style={styles.shopTabs}>
          <TouchableOpacity 
            style={[styles.shopTabBtn, shopTab === 'avatars' && styles.shopTabBtnActive]} 
            onPress={() => setShopTab('avatars')}
          >
            <Text style={[styles.shopTabBtnText, shopTab === 'avatars' && styles.shopTabBtnTextActive]}>Аватари</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.shopTabBtn, shopTab === 'themes' && styles.shopTabBtnActive]} 
            onPress={() => setShopTab('themes')}
          >
            <Text style={[styles.shopTabBtnText, shopTab === 'themes' && styles.shopTabBtnTextActive]}>Теми</Text>
          </TouchableOpacity>
        </View>

        {shopTab === 'avatars' ? (
          <View style={styles.shopList}>
            {SHOP_AVATARS.map((item) => {
              const isUnlocked = state.unlockedAvatars.includes(item.avatar);
              const isActive = state.activeAvatar === item.avatar;
              return (
                <View key={item.avatar} style={styles.shopItem}>
                  <Text style={styles.shopEmoji}>{item.avatar}</Text>
                  <Text style={styles.shopItemName}>{item.name}</Text>
                  
                  {isActive ? (
                    <View style={styles.activeCosmeticBadge}>
                      <Text style={styles.activeCosmeticText}>Активен</Text>
                    </View>
                  ) : isUnlocked ? (
                    <TouchableOpacity 
                      style={styles.selectCosmeticBtn}
                      onPress={() => handleSelectAvatar(item.avatar)}
                    >
                      <Text style={styles.selectCosmeticText}>Избери</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={styles.buyCosmeticBtn}
                      onPress={() => handleBuyAvatar(item.avatar, item.price)}
                    >
                      <Text style={styles.buyCosmeticText}>Купи €{item.price.toFixed(2)}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.shopList}>
            {SHOP_THEMES.map((item) => {
              const isUnlocked = state.unlockedThemes.includes(item.id);
              const isActive = state.activeTheme === item.id;
              return (
                <View key={item.id} style={styles.shopItem}>
                  <Ionicons name="color-palette-outline" size={24} color="#a855f7" style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shopItemName}>{item.name}</Text>
                    <Text style={styles.shopItemDesc}>{item.desc}</Text>
                  </View>
                  
                  {isActive ? (
                    <View style={styles.activeCosmeticBadge}>
                      <Text style={styles.activeCosmeticText}>Активна</Text>
                    </View>
                  ) : isUnlocked ? (
                    <TouchableOpacity 
                      style={styles.selectCosmeticBtn}
                      onPress={() => handleSelectTheme(item.id)}
                    >
                      <Text style={styles.selectCosmeticText}>Избери</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={styles.buyCosmeticBtn}
                      onPress={() => handleBuyTheme(item.id, item.price)}
                    >
                      <Text style={styles.buyCosmeticText}>Купи €{item.price.toFixed(2)}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Control Panel / Dev Actions */}
      <Text style={styles.sectionHeader}>⚙️ КОНТРОЛЕН ПАНЕЛ</Text>
      
      <TouchableOpacity 
        style={styles.guideBtn} 
        activeOpacity={0.8}
        onPress={() => updateState({ showTutorial: true })}
      >
        <Ionicons name="school-outline" size={16} color="#a78bfa" />
        <Text style={styles.guideBtnText}>🎓 Интерактивно демо ръководство</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.resetBtn} 
        activeOpacity={0.8}
        onPress={handleResetData}
      >
        <Ionicons name="trash-outline" size={16} color="#ef4444" />
        <Text style={styles.resetBtnText}>Изчисти акаунт & Нулирай баланс до €100</Text>
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
  profileHeader: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderWidth: 2,
    borderColor: '#a855f7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarIcon: {
    fontSize: 28,
  },
  userName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  userPhone: {
    color: '#71717a',
    fontSize: 11,
    marginTop: 4,
  },
  xpWrapper: {
    width: '100%',
    marginTop: 20,
  },
  xpLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  xpLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  xpValue: {
    color: '#a855f7',
    fontSize: 10,
    fontWeight: '800',
  },
  xpProgressBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpProgressFill: {
    height: '100%',
    backgroundColor: '#a855f7',
    borderRadius: 4,
  },
  lootboxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 70, 239, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217, 70, 239, 0.25)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 20,
  },
  lootboxIcon: {
    fontSize: 26,
    marginRight: 10,
  },
  lootboxTextContainer: {
    flex: 1,
  },
  lootboxTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '850',
  },
  lootboxDesc: {
    color: '#d946ef',
    fontSize: 9,
    marginTop: 3,
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
  questsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    marginBottom: 15,
  },
  questItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  questInfo: {
    flex: 1,
    paddingRight: 10,
  },
  questDesc: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  questCompletedText: {
    color: '#71717a',
    textDecorationLine: 'line-through',
  },
  questProgress: {
    color: '#71717a',
    fontSize: 9,
    marginTop: 4,
  },
  boldText: {
    color: '#fff',
    fontWeight: '700',
  },
  claimBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  claimBtnDisabled: {
    backgroundColor: '#27272a',
    opacity: 0.4,
  },
  claimBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  claimedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  claimedText: {
    color: '#71717a',
    fontSize: 9,
    fontWeight: '700',
  },
  verifiedCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    padding: 15,
    marginBottom: 15,
  },
  verifiedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  verifiedTitle: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '900',
  },
  verifiedDetails: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 12,
  },
  verifiedLabel: {
    color: '#71717a',
    fontWeight: '700',
  },
  verifiedSub: {
    color: '#a1a1aa',
    fontSize: 9,
    marginTop: 10,
    lineHeight: 13,
  },
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    marginBottom: 15,
  },
  formInfo: {
    color: '#a1a1aa',
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 15,
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
  formBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  formBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  smsCodeRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  verifyBtn: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  shopCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
    marginBottom: 20,
  },
  shopTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  shopTabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  shopTabBtnActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    borderBottomWidth: 2,
    borderBottomColor: '#a855f7',
  },
  shopTabBtnText: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '800',
  },
  shopTabBtnTextActive: {
    color: '#fff',
  },
  shopList: {
    padding: 10,
  },
  shopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  shopEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  shopItemName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  shopItemDesc: {
    color: '#71717a',
    fontSize: 9,
    marginTop: 2,
  },
  activeCosmeticBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: '#a855f7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeCosmeticText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  selectCosmeticBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  selectCosmeticText: {
    color: '#d4d4d8',
    fontSize: 9,
    fontWeight: '700',
  },
  buyCosmeticBtn: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  buyCosmeticText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  guideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    gap: 6,
    marginTop: 10,
  },
  guideBtnText: {
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '700',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    gap: 6,
    marginTop: 10,
  },
  resetBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 2, 15, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  }
});
