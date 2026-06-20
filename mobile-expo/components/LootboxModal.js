import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

export default function LootboxModal({ visible, onClose }) {
  const { state, updateState, apiFetch, triggerSync } = useApp();
  const [opening, setOpening] = useState(false);
  const [rewardText, setRewardText] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleOpenLootbox = async () => {
    if (opening || state.lootBoxesOwned <= 0) return;

    setOpening(true);
    setRewardText('');
    setIsOpen(false);

    // 1. Shake animation sequence
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start(async () => {
      // 2. Open chest + Scale animation
      setIsOpen(true);
      
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.3, duration: 200, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();

      try {
        const response = await apiFetch('/api/user/open-lootbox', {
          method: 'POST'
        });

        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            updateState({
              balance: parseFloat(data.user.balance),
              unlockedAvatars: data.user.unlocked_avatars || ['👤'],
              lootBoxesOwned: data.user.loot_boxes_owned || 0,
              unlockedAchievements: data.user.unlocked_achievements || []
            });
            triggerSync();
          }
          // Remove HTML tags from rewardText since we are rendering native Text
          const cleanText = data.rewardText.replace(/<\/?[^>]+(>|$)/g, "");
          setRewardText(cleanText);
        } else {
          throw new Error("Lootbox server error");
        }
      } catch (err) {
        // Offline Fallback
        const rand = Math.random();
        let localReward = "";
        let newBalance = state.balance;
        const newHistory = [...state.walletHistory];
        const newAvatars = [...state.unlockedAvatars];
        const newAchievements = [...state.unlockedAchievements];

        if (rand < 0.60) {
          const amounts = [0.50, 1.00, 2.00, 5.00];
          const amount = amounts[Math.floor(Math.random() * amounts.length)];
          newBalance += amount;
          newHistory.unshift({
            id: Date.now(),
            desc: "Награда от Мистериозна Кутия 🎁",
            amount: amount,
            type: "deposit",
            date: "Днес"
          });
          localReward = `🎉 Спечелихте допълнителен баланс от €${amount.toFixed(2)}!`;

          if (newBalance >= 50.00 && !newAchievements.includes('millionaire')) {
            newAchievements.push('millionaire');
          }
        } else {
          const avs = ["🦊", "🐯", "🐼", "👾", "🚀", "💎", "🐉"];
          const possibleAvs = avs.filter(a => !newAvatars.includes(a));

          if (possibleAvs.length > 0) {
            const newAv = possibleAvs[Math.floor(Math.random() * possibleAvs.length)];
            newAvatars.push(newAv);
            localReward = `🎉 Отключихте нов уникален аватар: ${newAv}! Можете да го сложите от профила си.`;
            
            if (newAvatars.length >= 3 && !newAchievements.includes('collector')) {
              newAchievements.push('collector');
            }
          } else {
            const amount = 3.00;
            newBalance += amount;
            newHistory.unshift({
              id: Date.now(),
              desc: "Награда от Мистериозна Кутия 🎁",
              amount: amount,
              type: "deposit",
              date: "Днес"
            });
            localReward = `🎉 Тъй като имате всички аватари, получихте €${amount.toFixed(2)} баланс!`;

            if (newBalance >= 50.00 && !newAchievements.includes('millionaire')) {
              newAchievements.push('millionaire');
            }
          }
        }

        const newLootboxes = Math.max(0, state.lootBoxesOwned - 1);

        updateState({
          balance: newBalance,
          lootBoxesOwned: newLootboxes,
          unlockedAvatars: newAvatars,
          unlockedAchievements: newAchievements,
          walletHistory: newHistory
        });

        setRewardText(localReward);
      }
      setOpening(false);
    });
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Close Button */}
          <TouchableOpacity 
            style={styles.closeBtn} 
            onPress={onClose}
            disabled={opening}
          >
            <Ionicons name="close" size={24} color="#71717a" />
          </TouchableOpacity>

          <Text style={styles.modalTitle}>🎁 Мистериозна Кутия</Text>
          <Text style={styles.modalSubtitle}>Имате {state.lootBoxesOwned} кутии за отваряне</Text>

          {/* Animated Chest Box */}
          <View style={styles.chestContainer}>
            <Animated.Text 
              style={[
                styles.chestEmoji,
                { 
                  transform: [
                    { translateX: shakeAnim },
                    { scale: scaleAnim }
                  ] 
                }
              ]}
            >
              {isOpen ? "🔓" : "📦"}
            </Animated.Text>
          </View>

          {/* Reward text */}
          {rewardText !== '' && (
            <View style={styles.rewardContainer}>
              <Text style={styles.rewardTitle}>Награда!</Text>
              <Text style={styles.rewardText}>{rewardText}</Text>
            </View>
          )}

          {/* Action button */}
          {state.lootBoxesOwned > 0 ? (
            <TouchableOpacity 
              style={[styles.openButton, opening && styles.openButtonDisabled]}
              activeOpacity={0.8}
              onPress={handleOpenLootbox}
              disabled={opening}
            >
              <Text style={styles.openButtonText}>
                {opening ? "ОТВАРЯНЕ..." : "ОТВОРИ КУТИЯТА"}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.noBoxContainer}>
              <Text style={styles.noBoxText}>Нямате налични кутии.</Text>
              <Text style={styles.noBoxSub}>Играйте реални турнири за да печелите кутии!</Text>
              <TouchableOpacity style={styles.okBtn} onPress={onClose}>
                <Text style={styles.okBtnText}>Затвори</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
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
    fontSize: 12,
    marginTop: 5,
    marginBottom: 20,
  },
  chestContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  chestEmoji: {
    fontSize: 70,
    textShadowColor: 'rgba(217, 70, 239, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  rewardContainer: {
    backgroundColor: 'rgba(217, 70, 239, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(217, 70, 239, 0.25)',
    borderRadius: 14,
    padding: 15,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  rewardTitle: {
    color: '#d946ef',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 5,
  },
  rewardText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  openButton: {
    width: '100%',
    padding: 15,
    borderRadius: 14,
    backgroundColor: '#d946ef',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d946ef',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  openButtonDisabled: {
    backgroundColor: '#2e2b3e',
    shadowOpacity: 0,
    elevation: 0,
  },
  openButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  noBoxContainer: {
    alignItems: 'center',
    width: '100%',
  },
  noBoxText: {
    color: '#71717a',
    fontSize: 13,
    fontWeight: '700',
  },
  noBoxSub: {
    color: '#52525b',
    fontSize: 10,
    marginTop: 5,
    marginBottom: 15,
    textAlign: 'center',
  },
  okBtn: {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  okBtnText: {
    color: '#d4d4d8',
    fontSize: 12,
    fontWeight: '700',
  }
});
