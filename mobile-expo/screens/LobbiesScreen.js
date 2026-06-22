import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Switch, Image, Share } from 'react-native';
import { useApp } from '../context/AppContext';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';

export default function LobbiesScreen({ navigation, onOpenLuckyWheel, onOpenFriendDuel }) {
  const { state, updateState, joinLobby } = useApp();

  const handleTogglePractice = (value) => {
    updateState({ practiceModeActive: value });
  };

  const handleJoinLobby = async (lobby) => {
    if (lobby.status === 'finished') return;
    
    // Check if email verification is required (only for real tournament mode)
    if (!state.practiceModeActive && !state.user.verified) {
      alert("Моля, първо верифицирайте профила си от таб 'Профил'!");
      return;
    }

    const res = await joinLobby(lobby.id, state.practiceModeActive);
    if (res.success) {
      navigation.navigate('Game', { lobbyId: lobby.id });
    } else {
      alert(res.error || "Грешка при присъединяване.");
    }
  };

  const handleShare = async (lobby) => {
    try {
      const isFree = state.practiceModeActive || lobby.ticketPrice === 0;
      const feeText = isFree ? "НАПЪЛНО БЕЗПЛАТНО" : `само за €${lobby.ticketPrice.toFixed(2)}`;
      
      const message = `Ей, включи се в WinBlitz! ⚡\nИма турнир за ${lobby.prizeName} (на стойност €${lobby.prizeValue.toFixed(2)}). Участието е ${feeText}!\nЕла да покажеш колко си бърз и спечели наградата! 🏆\n\nИзтегли приложението: https://winblitz.app`;
      
      await Share.share({
        message,
        title: 'Покана за турнир в WinBlitz',
      });
    } catch (error) {
      console.log("Error sharing:", error.message);
    }
  };

  // Filter out completed/private duels for this list (only show active public tournaments)
  const publicTournaments = (state.lobbies || []).filter(l => !l.isFriendDuel);
  
  const freerollTournaments = publicTournaments.filter(l => l.ticketPrice === 0);
  const regularTournaments = publicTournaments.filter(l => l.ticketPrice > 0);

  const renderLobbyCard = (lobby, isFreeroll = false) => {
    const players = lobby.players || [];
    const playersCount = players.length;
    
    return (
      <View key={lobby.id} style={[styles.lobbyCard, isFreeroll && !state.practiceModeActive ? styles.freerollCard : null]}>
        {isFreeroll && !state.practiceModeActive && (
          <View style={styles.freerollBadgeContainer}>
            <Text style={styles.freerollBadgeText}>🎁 БЕЗПЛАТЕН ТУРНИР (FREEROLL)</Text>
          </View>
        )}
        
        {/* Product Image placeholder if null */}
        <View style={styles.imageContainer}>
          {lobby.image ? (
            <Image source={{ uri: lobby.image }} style={styles.lobbyImage} />
          ) : (
            <View style={[styles.lobbyImage, styles.imagePlaceholder]}>
              <Ionicons name="gift" size={40} color="rgba(255,255,255,0.2)" />
            </View>
          )}
          <View style={[styles.productTypeBadge, isFreeroll && !state.practiceModeActive && { backgroundColor: '#ef4444' }]}>
            <Text style={styles.productTypeText}>
              {lobby.productType === 'wallpaper' ? "🖼️ Тапет" : 
               lobby.productType === 'guide' ? "📚 Гайд" : "🎫 Ваучер"}
            </Text>
          </View>
        </View>

        <View style={styles.lobbyInfo}>
          <Text style={[styles.prizeName, isFreeroll && !state.practiceModeActive && { color: '#ef4444' }]}>
            {lobby.prizeName}
          </Text>
          
          {/* Entry fee and prize value */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Награда</Text>
              <Text style={[styles.statValPrize, isFreeroll && !state.practiceModeActive && { color: '#ef4444' }]}>
                €{lobby.prizeValue.toFixed(2)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Вход</Text>
              <Text style={styles.statValFee}>
                {state.practiceModeActive ? "БЕЗПЛАТНО" : (isFreeroll ? "БЕЗПЛАТНО" : `€${lobby.ticketPrice.toFixed(2)}`)}
              </Text>
            </View>
          </View>

          {/* Progress bar / Player count */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${(playersCount / lobby.maxPlayers) * 100}%` },
                  isFreeroll && !state.practiceModeActive && { backgroundColor: '#ef4444' }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              Играчи: <Text style={styles.boldText}>{playersCount}/{lobby.maxPlayers}</Text>
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity 
              style={[
                styles.joinButton, 
                state.practiceModeActive ? styles.joinButtonPractice : (isFreeroll ? styles.joinButtonFreeroll : styles.joinButtonReal)
              ]}
              activeOpacity={0.8}
              onPress={() => handleJoinLobby(lobby)}
            >
              <Text style={styles.joinButtonText}>
                {state.practiceModeActive ? "Започни тренировка" : (isFreeroll ? "Влез БЕЗПЛАТНО" : "Купи билет & Играй")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.shareButton, isFreeroll && !state.practiceModeActive && { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.4)' }]}
              activeOpacity={0.8}
              onPress={() => handleShare(lobby)}
            >
              <Ionicons name="share-social" size={20} color={isFreeroll && !state.practiceModeActive ? "#ef4444" : "#fff"} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Practice Toggle Header */}
      <View style={[styles.toggleCard, state.practiceModeActive && styles.toggleCardActive]}>
        <View style={styles.toggleTextContainer}>
          <Text style={styles.toggleTitle}>
            {state.practiceModeActive ? "🏋️ ТРЕНИРОВЪЧЕН РЕЖИМ" : "🏆 РЕАЛНИ ТУРНИРИ"}
          </Text>
          <Text style={styles.toggleSub}>
            {state.practiceModeActive 
              ? "Безплатни игри без залог, трупане на 10 XP за тренировка." 
              : "Игри с реална такса вход и материални/парични награди."
            }
          </Text>
        </View>
        <Switch
          value={state.practiceModeActive}
          onValueChange={handleTogglePractice}
          trackColor={{ false: "#2e2b3e", true: "#8b5cf6" }}
          thumbColor={state.practiceModeActive ? "#fbbf24" : "#a1a1aa"}
        />
      </View>

      {/* Lucky Wheel Banner */}
      <TouchableOpacity 
        style={styles.wheelBanner} 
        activeOpacity={0.8}
        onPress={onOpenLuckyWheel}
      >
        <Text style={styles.wheelIcon}>🎡</Text>
        <View style={styles.wheelBannerText}>
          <Text style={styles.wheelTitle}>Ежедневен Бонус</Text>
          <Text style={styles.wheelDesc}>Завъртете колелото за гарантиран баланс или HD тапети!</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#fbbf24" />
      </TouchableOpacity>

      {/* Friend Duel Button */}
      <TouchableOpacity 
        style={styles.duelButton} 
        activeOpacity={0.8}
        onPress={onOpenFriendDuel}
      >
        <Ionicons name="people" size={20} color="#fff" />
        <Text style={styles.duelButtonText}>👥 Частен дуел с приятел</Text>
      </TouchableOpacity>

      {/* Lobbies Feed Title */}
      <Text style={styles.feedTitle}>Активни турнири за награди</Text>

      {/* Tournaments List */}
      {publicTournaments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Няма активни турнири в момента.</Text>
        </View>
      ) : (
        <>
          {freerollTournaments.map(lobby => renderLobbyCard(lobby, true))}
          {regularTournaments.map(lobby => renderLobbyCard(lobby, false))}
        </>
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
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 15,
  },
  toggleCardActive: {
    borderColor: 'rgba(139, 92, 246, 0.3)',
    backgroundColor: 'rgba(139, 92, 246, 0.04)',
  },
  toggleTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  toggleTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  toggleSub: {
    color: '#a1a1aa',
    fontSize: 10,
    marginTop: 4,
    lineHeight: 14,
  },
  wheelBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    marginBottom: 12,
  },
  wheelIcon: {
    fontSize: 30,
    marginRight: 12,
  },
  wheelBannerText: {
    flex: 1,
  },
  wheelTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  wheelDesc: {
    color: '#d4d4d8',
    fontSize: 10,
    marginTop: 3,
    lineHeight: 14,
  },
  duelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(217, 70, 239, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217, 70, 239, 0.25)',
    gap: 8,
    marginBottom: 20,
  },
  duelButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  feedTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lobbyCard: {
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
    marginBottom: 15,
  },
  freerollCard: {
    borderColor: '#ef4444',
    borderWidth: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    shadowColor: '#ef4444',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  freerollBadgeContainer: {
    backgroundColor: '#ef4444',
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freerollBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  imageContainer: {
    width: '100%',
    height: 140,
    position: 'relative',
  },
  lobbyImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productTypeBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(10, 5, 27, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  productTypeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  lobbyInfo: {
    padding: 15,
  },
  prizeName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 20,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    color: '#71717a',
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  statValPrize: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  statValFee: {
    color: '#a855f7',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#8b5cf6',
  },
  progressText: {
    color: '#a1a1aa',
    fontSize: 10,
  },
  boldText: {
    fontWeight: '700',
    color: '#fff',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: 15,
    alignItems: 'center',
    gap: 10,
  },
  joinButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  joinButtonReal: {
    backgroundColor: '#8b5cf6',
  },
  joinButtonPractice: {
    backgroundColor: '#10b981',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#71717a',
    fontSize: 12,
  }
});
