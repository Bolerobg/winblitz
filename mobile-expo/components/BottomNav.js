import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function BottomNav({ currentScreen, onSelectScreen }) {
  const tabs = [
    { key: 'Lobbies', name: 'Турнири', icon: 'trophy-outline', iconActive: 'trophy' },
    { key: 'History', name: 'История', icon: 'time-outline', iconActive: 'time' },
    { key: 'Wallet', name: 'Портфейл', icon: 'card-outline', iconActive: 'card' },
    { key: 'LeagueClan', name: 'Лиги', icon: 'shield-outline', iconActive: 'shield' },
    { key: 'Profile', name: 'Профил', icon: 'person-outline', iconActive: 'person' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navBar}>
        {tabs.map((tab) => {
          const isActive = currentScreen === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              activeOpacity={0.8}
              onPress={() => onSelectScreen(tab.key)}
            >
              <Ionicons 
                name={isActive ? tab.iconActive : tab.icon} 
                size={20} 
                color={isActive ? '#a855f7' : '#71717a'} 
                style={isActive ? styles.activeIconGlow : null}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#0f0a24',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.15)',
  },
  navBar: {
    height: 55,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 5,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#71717a',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#a855f7',
    textShadowColor: 'rgba(168, 85, 247, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  activeIconGlow: {
    textShadowColor: 'rgba(168, 85, 247, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  }
});
