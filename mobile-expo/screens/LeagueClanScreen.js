import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useApp } from '../context/AppContext';
import { Ionicons } from '@expo/vector-icons';

const CLANS_DATA = {
  1: { name: "БГ Нинджи", icon: "🛡️", xp: 12500, members: ["Никола В.", "Борис П.", "Явор К.", "Даниел С."] },
  2: { name: "Блиц Шампиони", icon: "⚡", xp: 9800, members: ["Мартин С.", "Иван П.", "Христо В.", "Теодора А."] },
  3: { name: "Томбола Мастърс", icon: "🏆", xp: 15400, members: ["Елена Г.", "Стефан Р.", "Мария Г.", "Лилия Б."] }
};

const getLeagueInfo = (xp) => {
    if (xp >= 15000) return { name: "Диамант", badge: "💎", color: "#67e8f9", bg: "rgba(103, 232, 249, 0.1)" };
    if (xp >= 5000) return { name: "Злато", badge: "🥇", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)" };
    if (xp >= 1000) return { name: "Сребро", badge: "🥈", color: "#9ca3af", bg: "rgba(156, 163, 175, 0.1)" };
    return { name: "Бронз", badge: "🥉", color: "#d4d4d8", bg: "transparent" };
};

export default function LeagueClanScreen() {
  const { state, updateState, apiFetch, triggerSync } = useApp();
  const [tab, setTab] = useState('league'); // 'league' or 'clan'
  const [loading, setLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [timeLeft, setTimeLeft] = useState('...');

  useEffect(() => {
    fetchLeaderboard();
    const timer = setInterval(() => {
      setTimeLeft(getRemainingTime());
    }, 60000);
    setTimeLeft(getRemainingTime());
    return () => clearInterval(timer);
  }, []);

  const getRemainingTime = () => {
    const now = new Date();
    const daysUntilSunday = now.getDay() === 0 ? 0 : 7 - now.getDay();
    const target = new Date();
    target.setDate(now.getDate() + daysUntilSunday);
    target.setHours(23, 55, 0, 0);
    
    if (now > target) target.setDate(target.getDate() + 7);
    
    const diff = target - now;
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / 1000 / 60) % 60);
    return `${d}д ${h}ч ${m}м`;
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await apiFetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard);
      }
    } catch (e) {
      console.log("Failed to fetch leaderboard");
    }
  };

  // --- League Tab Calculations ---
  // --- League Tab Calculations ---
  // Ensure "me" is in the list if not already there, or just mark me
  let displayPlayers = [...leaderboard];
  const myIndex = displayPlayers.findIndex(p => p.id === state.user?.id);
  
  if (myIndex === -1 && state.user) {
    displayPlayers.push({
      id: state.user.id,
      fullname: state.user.fullname || "Вие",
      xp: state.xp,
      active_avatar: state.activeAvatar || "👤",
      isMe: true
    });
  } else if (myIndex !== -1) {
    displayPlayers[myIndex].isMe = true;
    displayPlayers[myIndex].fullname = displayPlayers[myIndex].fullname ? `${displayPlayers[myIndex].fullname} (Вие)` : "Вие";
  }
  
  displayPlayers.sort((a, b) => b.xp - a.xp);

  // --- Clan Join / Leave Actions ---
  const handleJoinClan = async (clanId) => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/user/join-clan', {
        method: 'POST',
        body: JSON.stringify({ clanId })
      });

      if (res.ok) {
        const data = await res.json();
        updateState({ clanId: data.user.clan_id });
        triggerSync();
        const clanName = CLANS_DATA[clanId].name;
        Alert.alert("Успех", `🛡️ Присъединихте се към клана "${clanName}"!`);
      } else {
        throw new Error("Join clan API failed");
      }
    } catch (e) {
      // Offline fallback
      updateState({ clanId });
      const clanName = CLANS_DATA[clanId].name;
      Alert.alert("Офлайн режим", `🛡️ Присъединихте се към клана "${clanName}"!`);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveClan = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/user/leave-clan', {
        method: 'POST'
      });

      if (res.ok) {
        const data = await res.json();
        updateState({ clanId: null });
        triggerSync();
        Alert.alert("Готово", "🛡️ Напуснахте клана.");
      } else {
        throw new Error("Leave clan API failed");
      }
    } catch (e) {
      // Offline fallback
      updateState({ clanId: null });
      Alert.alert("Офлайн режим", "🛡️ Напуснахте клана.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Tab Switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity 
          style={[styles.tabBtn, tab === 'league' && styles.tabBtnActive]} 
          onPress={() => setTab('league')}
        >
          <Ionicons 
            name="trophy-outline" 
            size={16} 
            color={tab === 'league' ? '#a855f7' : '#71717a'} 
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, tab === 'league' && styles.tabBtnTextActive]}>Лига Ранк</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabBtn, tab === 'clan' && styles.tabBtnActive]} 
          onPress={() => setTab('clan')}
        >
          <Ionicons 
            name="shield-outline" 
            size={16} 
            color={tab === 'clan' ? '#a855f7' : '#71717a'} 
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.tabBtnText, tab === 'clan' && styles.tabBtnTextActive]}>Клан (Отбор)</Text>
        </TouchableOpacity>
      </View>

      {/* --- LEAGUE VIEW --- */}
      {tab === 'league' && (
        <View style={styles.section}>
          <View style={styles.seasonHeader}>
            <View style={{flex: 1}}>
              <Text style={styles.sectionTitle}>🏆 Седмично класиране</Text>
              <Text style={styles.sectionDesc}>Печелете XP, за да вземете награди.</Text>
            </View>
            <View style={styles.timerBadge}>
              <Ionicons name="time-outline" size={14} color="#fca5a5" style={{marginRight: 4}} />
              <Text style={styles.timerText}>{timeLeft}</Text>
            </View>
          </View>

          <View style={styles.listCard}>
            {displayPlayers.map((player, index) => {
              const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
              const league = getLeagueInfo(player.xp);
              return (
                <View 
                  key={player.id || player.name} 
                  style={[
                    styles.rankItem, 
                    player.isMe && styles.rankItemMe,
                    index === 0 && styles.rankItemGold
                  ]}
                >
                  <Text style={styles.rankIndex}>{medal}</Text>
                  <Text style={styles.rankAvatar}>{player.active_avatar || player.avatar || "👤"}</Text>
                  
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rankName, player.isMe && styles.rankNameMe]}>{player.fullname || player.name}</Text>
                    <View style={[styles.leaguePill, { backgroundColor: league.bg }]}>
                      <Text style={[styles.leaguePillText, { color: league.color }]}>{league.badge} {league.name}</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.rankXp}>{player.xp} XP</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* --- CLAN VIEW --- */}
      {tab === 'clan' && (
        <View style={styles.section}>
          {state.clanId ? (
            // Joined Clan View
            <View>
              <View style={styles.myClanCard}>
                <View style={styles.myClanHeader}>
                  <Text style={styles.myClanIcon}>{CLANS_DATA[state.clanId].icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.myClanName}>{CLANS_DATA[state.clanId].name}</Text>
                    <Text style={styles.myClanStats}>
                      {CLANS_DATA[state.clanId].members.length + 1}/5 членове • {CLANS_DATA[state.clanId].xp + state.xp} XP
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.clanMembersTitle}>📋 Членове на клана</Text>
                
                {/* Member Roster */}
                <View style={styles.membersList}>
                  {/* Me first */}
                  <View style={styles.memberItem}>
                    <Text style={styles.memberAvatar}>{state.activeAvatar || "👤"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberNameMe}>Вие (Член)</Text>
                      <Text style={styles.memberRole}>Асистент</Text>
                    </View>
                    <Text style={styles.memberXp}>{state.xp} XP</Text>
                  </View>

                  {/* Rest of simulated members */}
                  {CLANS_DATA[state.clanId].members.map((name, i) => {
                    const botXp = Math.round(CLANS_DATA[state.clanId].xp / 4 - (i * 200) + Math.sin(i) * 50);
                    const botAv = ["🛡️", "🦊", "🐯", "🐼"][i % 4];
                    return (
                      <View key={name} style={styles.memberItem}>
                        <Text style={styles.memberAvatar}>{botAv}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberName}>{name}</Text>
                          <Text style={styles.memberRole}>{i === 0 ? "Лидер" : "Войн"}</Text>
                        </View>
                        <Text style={styles.memberXp}>{botXp} XP</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Leave Clan Action */}
                <TouchableOpacity 
                  style={styles.leaveClanBtn} 
                  onPress={handleLeaveClan}
                  disabled={loading}
                >
                  <Ionicons name="exit-outline" size={16} color="#ef4444" />
                  <Text style={styles.leaveClanBtnText}>Напусни Клана</Text>
                </TouchableOpacity>
              </View>
              
              {/* Clans Leaderboard in joined mode */}
              <Text style={styles.sectionHeader}>📈 Класация на клановете</Text>
              <View style={styles.listCard}>
                {Object.keys(CLANS_DATA).map((id) => {
                  const c = CLANS_DATA[id];
                  const isMyClan = parseInt(id) === state.clanId;
                  const totalClanXp = isMyClan ? c.xp + state.xp : c.xp;
                  return (
                    <View key={id} style={[styles.rankItem, isMyClan && styles.rankItemMe]}>
                      <Text style={styles.rankIndex}>{c.icon}</Text>
                      <Text style={[styles.rankName, isMyClan && styles.rankNameMe]}>
                        {c.name} {isMyClan && "(Моят)"}
                      </Text>
                      <Text style={styles.rankXp}>{totalClanXp} XP</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : (
            // Unjoined View - Join list
            <View>
              <Text style={styles.sectionTitle}>🛡️ Присъединете се към Клан</Text>
              <Text style={styles.sectionDesc}>Обединете сили с други играчи, за да трупате общ XP резултат и да печелите кланови войни.</Text>

              {Object.keys(CLANS_DATA).map((id) => {
                const c = CLANS_DATA[id];
                return (
                  <View key={id} style={styles.clanJoinCard}>
                    <View style={styles.clanJoinHeader}>
                      <Text style={styles.clanJoinIcon}>{c.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.clanJoinName}>{c.name}</Text>
                        <Text style={styles.clanJoinStats}>{c.members.length}/5 членове • {c.xp} XP</Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.joinBtn} 
                        onPress={() => handleJoinClan(parseInt(id))}
                        disabled={loading}
                      >
                        <Text style={styles.joinBtnText}>Влез</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#a855f7" />
        </View>
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
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 5,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  tabBtnText: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '800',
  },
  tabBtnTextActive: {
    color: '#fff',
  },
  section: {
    flexDirection: 'column',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '850',
    marginBottom: 6,
  },
  sectionDesc: {
    color: '#71717a',
    fontSize: 10,
    lineHeight: 14,
    marginBottom: 15,
  },
  listCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  rankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  rankItemMe: {
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
  },
  rankItemGold: {
    backgroundColor: 'rgba(251, 191, 36, 0.02)',
  },
  rankIndex: {
    fontSize: 12,
    color: '#a1a1aa',
    width: 25,
    fontWeight: '700',
  },
  rankAvatar: {
    fontSize: 16,
    marginRight: 10,
  },
  rankName: {
    color: '#d4d4d8',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  rankNameMe: {
    color: '#fff',
    fontWeight: '800',
  },
  rankXp: {
    color: '#a855f7',
    fontSize: 11,
    fontWeight: '800',
  },
  myClanCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    marginBottom: 20,
  },
  myClanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  myClanIcon: {
    fontSize: 34,
    marginRight: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    width: 50,
    height: 50,
    borderRadius: 25,
    textAlign: 'center',
    lineHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  myClanName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  myClanStats: {
    color: '#a1a1aa',
    fontSize: 10,
    marginTop: 4,
  },
  clanMembersTitle: {
    color: '#a855f7',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  membersList: {
    gap: 8,
    marginBottom: 20,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  memberAvatar: {
    fontSize: 18,
    marginRight: 10,
  },
  memberName: {
    color: '#d4d4d8',
    fontSize: 11,
    fontWeight: '700',
  },
  memberNameMe: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  memberRole: {
    color: '#71717a',
    fontSize: 9,
    marginTop: 2,
  },
  memberXp: {
    color: '#8b5cf6',
    fontSize: 10,
    fontWeight: '800',
  },
  leaveClanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 5,
  },
  leaveClanBtnText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeader: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 15,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  clanJoinCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    marginBottom: 10,
  },
  clanJoinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clanJoinIcon: {
    fontSize: 26,
    marginRight: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    textAlign: 'center',
    lineHeight: 38,
  },
  clanJoinName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  clanJoinStats: {
    color: '#71717a',
    fontSize: 9,
    marginTop: 3,
  },
  joinBtn: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 8,
  },
  joinBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 2, 15, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  seasonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(252, 165, 165, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.3)',
  },
  timerText: {
    color: '#fca5a5',
    fontSize: 10,
    fontWeight: '800',
  },
  leaguePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  leaguePillText: {
    fontSize: 9,
    fontWeight: '800',
  }
});
