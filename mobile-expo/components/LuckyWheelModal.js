import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, Animated, Easing, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

const { width } = Dimensions.get('window');
const WHEEL_SIZE = width * 0.75;

export default function LuckyWheelModal({ visible, onClose }) {
  const { state, updateState, apiFetch, triggerSync } = useApp();
  const [spinning, setSpinning] = useState(false);
  const [resultText, setResultText] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [hasSpunToday, setHasSpunToday] = useState(false);

  const spinAnimation = useRef(new Animated.Value(0)).current;

  const rewards = [
    { type: "cash", val: 0.20, name: "€0.20 Бонус" },
    { type: "wallpaper", val: 0, name: "Premium Тапет (HD)" },
    { type: "cash", val: 1.00, name: "€1.00 Бонус" },
    { type: "cash", val: 5.00, name: "Пакет Тапети (€5.00)" },
    { type: "spin", val: 0, name: "Безплатно Завъртане 🎡" },
    { type: "cash", val: 0.50, name: "€0.50 Бонус" }
  ];

  const colors = [
    '#6366f1', // Indigo
    '#a855f7', // Purple
    '#ec4899', // Pink
    '#fbbf24', // Amber
    '#10b981', // Emerald
    '#3b82f6'  // Blue
  ];

  useEffect(() => {
    if (visible) {
      const today = new Date().toDateString();
      setHasSpunToday(state.lastSpinDate === today);
      setShowResult(false);
      setResultText('');
      spinAnimation.setValue(0);
    }
  }, [visible, state.lastSpinDate]);

  const handleSpin = async () => {
    if (spinning || hasSpunToday) return;

    setSpinning(true);
    setShowResult(false);

    // Pick random segment (0 to 5)
    const targetSegment = Math.floor(Math.random() * 6);
    const reward = rewards[targetSegment];
    const spinDate = new Date().toDateString();

    // 5 full rotations (1800 degrees) + landing angle
    // segment is located every 60 degrees. To bring segment i to top pointer (0 deg):
    // we want target angle to be 360 - (i * 60 + 30)
    const targetAngle = 360 - (targetSegment * 60 + 30);
    const totalRotation = 1800 + targetAngle;

    Animated.timing(spinAnimation, {
      toValue: totalRotation,
      duration: 4500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }).start(async () => {
      setSpinning(false);
      
      // Update state online/offline
      try {
        const response = await apiFetch('/api/user/lucky-spin', {
          method: 'POST',
          body: JSON.stringify({
            rewardType: reward.type,
            rewardVal: reward.val,
            rewardName: reward.name,
            spinDate: spinDate
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            updateState({
              balance: parseFloat(data.user.balance),
              lastSpinDate: data.user.last_spin_date,
              dailyQuests: typeof data.user.daily_quests === 'string' ? JSON.parse(data.user.daily_quests) : data.user.daily_quests,
              unlockedAchievements: data.user.unlocked_achievements
            });
            triggerSync();
          }
        } else {
          throw new Error("API call failed");
        }
      } catch (e) {
        // Offline fallback
        const today = new Date().toDateString();
        updateState(prev => {
          let newBalance = prev.balance;
          const newHistory = [...prev.walletHistory];

          if (reward.type === "cash") {
            newBalance += reward.val;
            newHistory.unshift({
              id: Date.now(),
              desc: `Ежедневен бонус колело: ${reward.name}`,
              amount: reward.val,
              type: "deposit",
              date: "Днес"
            });
          } else if (reward.type === "wallpaper") {
            newHistory.unshift({
              id: Date.now(),
              desc: `Ежедневен бонус колело: Premium Тапет (HD) [Изтегли]`,
              amount: 0,
              type: "deposit",
              date: "Днес"
            });
          }

          // If the reward is 'spin', we do NOT update lastSpinDate, so user spins again!
          const nextSpinDate = reward.type === 'spin' ? prev.lastSpinDate : today;

          return {
            ...prev,
            balance: newBalance,
            lastSpinDate: nextSpinDate,
            walletHistory: newHistory
          };
        });
      }

      // Show result message
      if (reward.type === 'spin') {
        setResultText(`🎉 Спечелихте: ${reward.name}!\nВъртете колелото отново веднага!`);
        setHasSpunToday(false);
      } else {
        setResultText(`🎉 Спечелихте: ${reward.name}!\nНаградата е начислена във Вашия акаунт.`);
        setHasSpunToday(true);
      }
      setShowResult(true);
    });
  };

  const spinInterpolation = spinAnimation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg']
  });

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Close Button */}
          <TouchableOpacity 
            style={styles.closeBtn} 
            onPress={onClose}
            disabled={spinning}
          >
            <Ionicons name="close" size={24} color="#71717a" />
          </TouchableOpacity>

          <Text style={styles.modalTitle}>🎡 Колело на Късмета</Text>
          <Text style={styles.modalSubtitle}>Завъртете за безплатен ежедневен бонус</Text>

          {/* Wheel Visual Container */}
          <View style={styles.wheelWrapper}>
            {/* Top Pointer */}
            <View style={styles.pointer} />

            <Animated.View style={[styles.wheel, { transform: [{ rotate: spinInterpolation }] }]}>
              {rewards.map((r, i) => {
                const angle = i * 60;
                return (
                  <View 
                    key={i} 
                    style={[
                      styles.wheelSegment, 
                      { 
                        transform: [
                          { rotate: `${angle}deg` }, 
                          { translateY: -WHEEL_SIZE / 4 }
                        ],
                        backgroundColor: colors[i]
                      }
                    ]}
                  >
                    <Text style={styles.segmentText}>{r.name.replace(" Бонус", "")}</Text>
                  </View>
                );
              })}
              {/* Inner Center Circle */}
              <View style={styles.innerCircle} />
            </Animated.View>
          </View>

          {/* Spin Trigger Button */}
          {!showResult ? (
            <TouchableOpacity 
              style={[styles.spinButton, (spinning || hasSpunToday) && styles.spinButtonDisabled]}
              activeOpacity={0.8}
              onPress={handleSpin}
              disabled={spinning || hasSpunToday}
            >
              <Text style={styles.spinButtonText}>
                {spinning ? "Завъртане..." : hasSpunToday ? "Елате отново утре!" : "ЗАВЪРТИ СЕГА"}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.resultContainer}>
              <Text style={styles.resultText}>{resultText}</Text>
              <TouchableOpacity 
                style={styles.okButton} 
                onPress={() => {
                  setShowResult(false);
                  if (resultText.includes("отново")) {
                    // spin again setup
                    spinAnimation.setValue(0);
                  } else {
                    onClose();
                  }
                }}
              >
                <Text style={styles.okButtonText}>ОК</Text>
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
    width: '90%',
    backgroundColor: '#0f0a24',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
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
  wheelWrapper: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
    position: 'relative',
  },
  pointer: {
    position: 'absolute',
    top: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderLeftColor: 'transparent',
    borderRightWidth: 12,
    borderRightColor: 'transparent',
    borderTopWidth: 20,
    borderTopColor: '#fbbf24',
    zIndex: 5,
    shadowColor: '#fbbf24',
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 5,
  },
  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    borderWidth: 6,
    borderColor: '#0f0a24',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1b1236',
  },
  wheelSegment: {
    position: 'absolute',
    width: WHEEL_SIZE,
    height: WHEEL_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    top: 0,
    left: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#0f0a24',
    borderRightWidth: 1,
    borderRightColor: '#0f0a24',
    // Rotate relative to top center
    transformOrigin: '50% 100%',
  },
  segmentText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    transform: [{ rotate: '90deg' }],
    width: 80,
    textAlign: 'center',
    // Light text shadow
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  innerCircle: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0a051b',
    borderWidth: 3,
    borderColor: '#fbbf24',
    zIndex: 4,
  },
  spinButton: {
    width: '100%',
    padding: 15,
    borderRadius: 14,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  spinButtonDisabled: {
    backgroundColor: '#2e2b3e',
    shadowOpacity: 0,
    elevation: 0,
  },
  spinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  resultContainer: {
    width: '100%',
    alignItems: 'center',
    padding: 10,
  },
  resultText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 15,
  },
  okButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#10b981',
  },
  okButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  }
});
