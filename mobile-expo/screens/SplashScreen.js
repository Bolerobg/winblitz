import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

export default function SplashScreen({ onFinish }) {
  // Animation values
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.4)).current;
  
  const glowScale = useRef(new Animated.Value(0.9)).current;
  const glowOpacity = useRef(new Animated.Value(0.15)).current;
  
  const sloganOpacity = useRef(new Animated.Value(0)).current;
  const sloganTranslateY = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    // Logo entrance animation
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();

    // Slogan slide-up after a slight delay
    Animated.sequence([
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(sloganOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(sloganTranslateY, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        })
      ])
    ]).start();

    // Loop pulsing neon background glow
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 1.1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.25,
            duration: 1200,
            useNativeDriver: true,
          })
        ]),
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 0.9,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.15,
            duration: 1200,
            useNativeDriver: true,
          })
        ])
      ])
    ).start();

    // Transition to Auth or Lobbies after 2.7s
    const timer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 2700);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      
      {/* Decorative Cyberpunk Background Glow Elements */}
      <Animated.View style={[
        styles.glowCircle, 
        { 
          transform: [{ scale: glowScale }],
          opacity: glowOpacity
        }
      ]} />
      
      <View style={styles.gridLinesContainer}>
        {/* Simple decorative grid lines overlay */}
        <View style={styles.gridLineH} />
        <View style={[styles.gridLineH, { top: '30%' }]} />
        <View style={[styles.gridLineH, { top: '70%' }]} />
      </View>

      {/* Animated Logo Container */}
      <Animated.View style={[
        styles.logoContainer,
        {
          opacity: logoOpacity,
          transform: [{ scale: logoScale }]
        }
      ]}>
        <View style={styles.boltCircle}>
          <Ionicons name="flash" size={64} color="#fbbf24" style={styles.boltIcon} />
        </View>
        <Text style={styles.appName}>WIN<Text style={styles.appNameHighlight}>BLITZ</Text></Text>
      </Animated.View>

      {/* Animated Slogan Container */}
      <Animated.View style={[
        styles.sloganContainer,
        {
          opacity: sloganOpacity,
          transform: [{ translateY: sloganTranslateY }]
        }
      ]}>
        <Text style={styles.sloganText}>Където уменията носят победи!</Text>
        <View style={styles.sloganBar} />
      </Animated.View>

      <Text style={styles.footerText}>v1.0 • Google DeepMind Design</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a051b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowCircle: {
    position: 'absolute',
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: (width * 0.7) / 2,
    backgroundColor: '#8b5cf6',
    filter: Platform.OS === 'web' ? 'blur(80px)' : undefined, // Works on web directly
    // On native devices, overlapping opacity layers simulate blur
  },
  gridLinesContainer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#fff',
    top: '50%',
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  boltCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#d946ef',
    shadowColor: '#d946ef',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 8,
    marginBottom: 20,
  },
  boltIcon: {
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  appName: {
    fontSize: 48,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 4,
    textTransform: 'uppercase',
    textShadowColor: '#8b5cf6',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  appNameHighlight: {
    color: '#d946ef',
    textShadowColor: '#d946ef',
  },
  sloganContainer: {
    marginTop: 40,
    alignItems: 'center',
    zIndex: 2,
  },
  sloganText: {
    fontSize: 16,
    color: '#fbbf24',
    fontWeight: '600',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    textShadowColor: 'rgba(251, 191, 36, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  sloganBar: {
    marginTop: 10,
    width: 60,
    height: 3,
    backgroundColor: '#fbbf24',
    borderRadius: 1.5,
  },
  footerText: {
    position: 'absolute',
    bottom: 30,
    fontSize: 12,
    color: '#3f3f46',
    letterSpacing: 1,
  }
});
