import React, { useState } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, TextInput, Alert, Clipboard, Share, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

export default function FriendDuelModal({ visible, onClose, onStartGame }) {
  const { state, updateState, apiFetch, triggerSync } = useApp();
  const [gameType, setGameType] = useState('math');
  const [entryFee, setEntryFee] = useState('2.00');
  const [createdLobby, setCreatedLobby] = useState(null);
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateDuel = async () => {
    const fee = parseFloat(entryFee);
    if (isNaN(fee) || fee < 0.5) {
      Alert.alert("Грешка", "Моля въведете залог от минимум €0.50!");
      return;
    }

    if (!state.practiceModeActive) {
      if (!state.user.verified) {
        Alert.alert("Грешка", "Моля първо верифицирайте профила си с SMS от таб 'Профил'!");
        onClose();
        return;
      }
      if (state.balance < fee) {
        Alert.alert("Грешка", "Нямате достатъчно баланс за този залог!");
        return;
      }
    }

    setLoading(true);

    try {
      const response = await apiFetch('/api/lobbies/create-duel', {
        method: 'POST',
        body: JSON.stringify({
          gameType,
          entryFee: fee,
          isPractice: state.practiceModeActive
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Mapped lobby
        const newLobby = {
          id: data.lobby.id,
          prizeName: data.lobby.prize_name || data.lobby.prizeName,
          prizeValue: parseFloat(data.lobby.prize_value || data.lobby.prizeValue),
          ticketPrice: parseFloat(data.lobby.ticket_price || data.lobby.ticketPrice),
          maxPlayers: data.lobby.max_players || data.lobby.maxPlayers,
          productType: data.lobby.product_type || data.lobby.productType,
          gameType: data.lobby.game_type || data.lobby.gameType,
          image: data.lobby.image || null,
          status: data.lobby.status || 'waiting',
          players: typeof data.lobby.players === 'string' ? JSON.parse(data.lobby.players) : data.lobby.players || [],
          winner: data.lobby.winner || null,
          isFriendDuel: true,
          isPractice: state.practiceModeActive
        };

        updateState(prev => {
          const nextLobbies = [...prev.lobbies];
          // Remove if already exists, then push
          const idx = nextLobbies.findIndex(l => l.id === newLobby.id);
          if (idx > -1) nextLobbies[idx] = newLobby;
          else nextLobbies.push(newLobby);

          return {
            ...prev,
            balance: data.user ? parseFloat(data.user.balance) : prev.balance,
            lobbies: nextLobbies
          };
        });

        const link = `https://winblitz.bg/join-duel?room=WB-${newLobby.id}-${Math.floor(1000 + Math.random() * 9000)}`;
        setInviteLink(link);
        setCreatedLobby(newLobby);
        triggerSync();
      } else {
        const err = await response.json();
        throw new Error(err.error || "Duel creation API failed");
      }
    } catch (e) {
      // Offline fallback
      const prizeValue = fee * 1.8;
      const fakeId = Date.now();

      const newLobby = {
        id: fakeId,
        prizeName: `Частен дуел (${gameType === 'math' ? 'Математика' : gameType === 'memory' ? 'Памет' : 'Рефлекс'})`,
        prizeValue,
        ticketPrice: fee,
        maxPlayers: 2,
        productType: 'duel',
        gameType,
        image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&auto=format&fit=crop',
        status: 'waiting',
        players: [{ name: "Вие (Участник)", isMe: true, time: null, errors: 0, finished: false }],
        winner: null,
        isFriendDuel: true,
        isPractice: state.practiceModeActive
      };

      updateState(prev => {
        const nextBalance = state.practiceModeActive ? prev.balance : prev.balance - fee;
        const nextHistory = state.practiceModeActive ? prev.walletHistory : [
          {
            id: Date.now(),
            desc: `Създаване на Частен дуел (${gameType})`,
            amount: -fee,
            type: "withdrawal",
            date: "Днес"
          },
          ...prev.walletHistory
        ];
        return {
          ...prev,
          balance: nextBalance,
          walletHistory: nextHistory,
          lobbies: [...prev.lobbies, newLobby]
        };
      });

      const link = `https://winblitz.bg/join-duel?room=WB-${fakeId}-${Math.floor(1000 + Math.random() * 9000)}`;
      setInviteLink(link);
      setCreatedLobby(newLobby);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Хей! Ела да се състезаваме в WinBlitz! Влез в дуела от този линк: ${inviteLink}`,
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  const handleStart = () => {
    if (!createdLobby) return;
    onStartGame(createdLobby.id);
    setCreatedLobby(null);
    setInviteLink('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* Close button */}
          <TouchableOpacity 
            style={styles.closeBtn} 
            onPress={() => {
              setCreatedLobby(null);
              setInviteLink('');
              onClose();
            }}
            disabled={loading}
          >
            <Ionicons name="close" size={24} color="#71717a" />
          </TouchableOpacity>

          <Text style={styles.modalTitle}>⚔️ Частен Дуел</Text>
          <Text style={styles.modalSubtitle}>Създайте стая за състезание с приятел</Text>

          {!inviteLink ? (
            // Creation form
            <View style={styles.form}>
              <Text style={styles.label}>Изберете състезателна игра</Text>
              <View style={styles.radioGroup}>
                {['math', 'memory', 'reflex', 'scramble', 'numbers'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.radioBtn, gameType === t && styles.radioBtnActive]}
                    onPress={() => setGameType(t)}
                  >
                    <Text style={[styles.radioText, gameType === t && styles.radioTextActive]}>
                      {t === 'math' ? '🧮 Математика' : 
                       t === 'memory' ? '🃏 Памет' : 
                       t === 'reflex' ? '⚡ Рефлекс' :
                       t === 'scramble' ? '🔤 Думи' : '🔢 Числа'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Залог за игра (€)</Text>
              <TextInput
                style={styles.input}
                placeholder="Въведете залог (мин. €0.50)..."
                placeholderTextColor="#52525b"
                keyboardType="numeric"
                value={entryFee}
                onChangeText={setEntryFee}
              />

              <TouchableOpacity
                style={styles.submitBtn}
                activeOpacity={0.8}
                onPress={handleCreateDuel}
                disabled={loading}
              >
                <Text style={styles.submitBtnText}>СЪЗДАЙ СТАЯ</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Invite details
            <View style={styles.inviteBox}>
              <Text style={styles.inviteTitle}>Стаята е готова!</Text>
              <Text style={styles.inviteDesc}>
                Пратете тази покана на Ваш приятел. Когато той влезе, играта ще стартира.
              </Text>
              
              <View style={styles.linkContainer}>
                <Text style={styles.linkText} numberOfLines={1}>{inviteLink}</Text>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                  <Ionicons name="share-social-outline" size={16} color="#fff" />
                  <Text style={styles.shareBtnText}>Сподели линк</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.playBtn} onPress={handleStart}>
                  <Ionicons name="play-outline" size={16} color="#fff" />
                  <Text style={styles.playBtnText}>Играй сега</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
    width: '90%',
    backgroundColor: '#0f0a24',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(217, 70, 239, 0.3)',
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
    fontSize: 20,
    fontWeight: '900',
    marginTop: 10,
  },
  modalSubtitle: {
    color: '#a1a1aa',
    fontSize: 11,
    marginTop: 5,
    marginBottom: 20,
  },
  form: {
    width: '100%',
  },
  label: {
    color: '#a1a1aa',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 20,
  },
  radioBtn: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  radioBtnActive: {
    backgroundColor: 'rgba(217, 70, 239, 0.12)',
    borderColor: '#d946ef',
  },
  radioText: {
    color: '#71717a',
    fontSize: 10,
    fontWeight: '800',
  },
  radioTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 13,
    marginBottom: 20,
  },
  submitBtn: {
    width: '100%',
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#d946ef',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d946ef',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  inviteBox: {
    width: '100%',
    alignItems: 'center',
  },
  inviteTitle: {
    color: '#d946ef',
    fontSize: 16,
    fontWeight: '850',
    marginBottom: 8,
  },
  inviteDesc: {
    color: '#a1a1aa',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
  },
  linkContainer: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  linkText: {
    color: '#fbbf24',
    fontSize: 11,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  shareBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  playBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d946ef',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  playBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  }
});
