import React, { useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

type ToastConfig = {
  title: string;
  sub?: string;
  emoji?: string;
  color?: string;
};

export function useToast() {
  const [config, setConfig] = useState<ToastConfig | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.7)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (toast: ToastConfig) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    opacity.stopAnimation();
    translateY.stopAnimation();
    scale.stopAnimation();

    // Reset to start position
    translateY.setValue(20);
    scale.setValue(0.7);
    opacity.setValue(0);

    setConfig(toast);

    // ── Enter: pop up + fade in ─────────────────────────────────
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    // ── Exit: float up + dissolve ───────────────────────────────
    timerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 600,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -40,
          duration: 600,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.85,
          duration: 600,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => setConfig(null));
    }, 2400);
  };

  function ToastComponent() {
    if (!config) return null;

    const accentColor = config.color ?? '#22c55e';

    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.wrap,
          {
            opacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        {/* Glow ring */}
        <View style={[styles.glowRing, { borderColor: accentColor + '40' }]} />

        <View style={styles.card}>
          {/* Top accent line */}
          <View style={[styles.topBar, { backgroundColor: accentColor }]} />

          <View style={styles.inner}>
            {config.emoji ? (
              <Text style={styles.emoji}>{config.emoji}</Text>
            ) : null}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.title}>{config.title}</Text>
              {config.sub ? (
                <Text style={styles.sub}>{config.sub}</Text>
              ) : null}
            </View>
          </View>
        </View>
      </Animated.View>
    );
  }

  return { show, ToastComponent };
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    zIndex: 9999,
    alignItems: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 280,
    height: 110,
    borderRadius: 28,
    borderWidth: 1,
    transform: [{ scale: 1.08 }],
  },
  card: {
    width: 260,
    backgroundColor: '#161616',
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  topBar: {
    height: 3,
    width: '100%',
  },
  inner: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  emoji: {
    fontSize: 38,
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#f0f0f0',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  sub: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
});
