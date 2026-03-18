import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth';

const DATA   = [18, 26, 22, 34, 30, 44, 40, 58, 54, 72, 68, 88];
const CHART_H = 72;

function LineChart() {
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const n = DATA.length;
  const points = width > 0
    ? DATA.map((v, i) => ({
        x: (i / (n - 1)) * width,
        y: CHART_H - (v / 100) * CHART_H,
      }))
    : [];

  const segments = points.slice(0, -1).map((p, i) => {
    const q   = points[i + 1];
    const dx  = q.x - p.x;
    const dy  = q.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ang = Math.atan2(dy, dx) * (180 / Math.PI);
    const isRecent = i >= n - 4;
    return { cx: (p.x + q.x) / 2, cy: (p.y + q.y) / 2, len, ang, isRecent };
  });

  return (
    <View style={{ height: CHART_H, width: '100%' }} onLayout={onLayout}>
      {segments.map((seg, i) => (
        <View
          key={i}
          style={[
            s.segment,
            {
              width:  seg.len,
              left:   seg.cx - seg.len / 2,
              top:    seg.cy - 1.5,
              transform: [{ rotate: `${seg.ang}deg` }],
              backgroundColor: seg.isRecent ? '#9333ea' : '#2a2a2a',
            },
          ]}
        />
      ))}
      {/* Dots at each data point */}
      {points.map((p, i) => {
        const isLast   = i === n - 1;
        const isRecent = i >= n - 3;
        return (
          <View
            key={`dot-${i}`}
            style={[
              s.dot,
              {
                left: p.x - (isLast ? 5 : 3),
                top:  p.y - (isLast ? 5 : 3),
                width:  isLast ? 10 : 6,
                height: isLast ? 10 : 6,
                borderRadius: isLast ? 5 : 3,
                backgroundColor: isLast   ? '#a855f7' :
                                 isRecent ? '#7c3aed' :
                                            '#2a2a2a',
                ...(isLast && {
                  shadowColor: '#a855f7',
                  shadowOpacity: 0.8,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 0 },
                }),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export default function LandingScreen() {
  const { user, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  const logoOpacity = useRef(new Animated.Value(1)).current;
  const logoScale   = useRef(new Animated.Value(0.85)).current;
  const chartOp     = useRef(new Animated.Value(0)).current;
  const chartY      = useRef(new Animated.Value(20)).current;
  const textOp      = useRef(new Animated.Value(0)).current;
  const textY       = useRef(new Animated.Value(20)).current;
  const btnsOp      = useRef(new Animated.Value(0)).current;
  const btnsY       = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, tension: 55, friction: 8 }).start();
    setTimeout(() => Animated.parallel([
      Animated.spring(chartY,  { toValue: 0, useNativeDriver: true, tension: 55, friction: 9 }),
      Animated.timing(chartOp, { toValue: 1, useNativeDriver: true, duration: 400 }),
    ]).start(), 150);
    setTimeout(() => Animated.parallel([
      Animated.spring(textY,  { toValue: 0, useNativeDriver: true, tension: 55, friction: 9 }),
      Animated.timing(textOp, { toValue: 1, useNativeDriver: true, duration: 400 }),
    ]).start(), 300);
    setTimeout(() => Animated.parallel([
      Animated.spring(btnsY,  { toValue: 0, useNativeDriver: true, tension: 55, friction: 9 }),
      Animated.timing(btnsOp, { toValue: 1, useNativeDriver: true, duration: 380 }),
    ]).start(), 450);
  }, []);

  useEffect(() => {
    if (!isLoading && user) router.replace('/(tabs)/dashboard');
  }, [isLoading, user]);

  if (isLoading) {
    return (
      <View style={s.splash}>
        <Image source={require('../assets/images/topload-logo.png')} style={s.splashLogo} resizeMode="contain" />
        <ActivityIndicator size="small" color="#9333ea" style={{ marginTop: 32 }} />
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 40 }]}>

      {/* ── Logo ────────────────────────────────────────────── */}
      <Animated.View style={[s.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <Image source={require('../assets/images/topload-logo.png')} style={s.logo} resizeMode="contain" />
      </Animated.View>

      {/* ── Collection value card ────────────────────────────── */}
      <Animated.View style={[s.chartCard, { opacity: chartOp, transform: [{ translateY: chartY }] }]}>
        <View style={s.chartHeader}>
          <View>
            <Text style={s.chartLabel}>COLLECTION VALUE</Text>
            <Text style={s.chartValue}>$12,400</Text>
          </View>
          <View style={s.gainPill}>
            <Text style={s.gainText}>↑ +$3,200</Text>
          </View>
        </View>
        <LineChart />
        <View style={s.chartAxis}>
          {['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'].map(m => (
            <Text key={m} style={s.axisLabel}>{m}</Text>
          ))}
        </View>
      </Animated.View>

      {/* ── Tagline + subtitle ───────────────────────────────── */}
      <Animated.View style={[s.textBlock, { opacity: textOp, transform: [{ translateY: textY }] }]}>
        <Text style={s.tagline}>Every card.</Text>
        <Text style={[s.tagline, s.taglinePurple]}>Every dollar.</Text>
        <Text style={s.tagline}>One place.</Text>
        <Text style={s.subtitle}>Your entire collection, organized{'\n'}and valued in one place.</Text>
      </Animated.View>

      <View style={{ flex: 1 }} />

      {/* ── Buttons ─────────────────────────────────────────── */}
      <Animated.View style={[s.ctas, { paddingBottom: insets.bottom + 32 }, { opacity: btnsOp, transform: [{ translateY: btnsY }] }]}>
        <TouchableOpacity style={s.btnPrimary} onPress={() => router.push('/signup')} activeOpacity={0.85}>
          <Text style={s.btnPrimaryText}>Create Account</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnSecondary} onPress={() => router.push('/login')} activeOpacity={0.85}>
          <Text style={s.btnSecondaryText}>Sign In</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  splashLogo: { width: 200, height: 52 },

  root: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center' },

  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 300, height: 78 },

  // ── Chart card ────────────────────────────────────────────
  chartCard: {
    width: '88%',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1e1e1e',
    borderRadius: 20,
    padding: 20,
    marginBottom: 32,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  chartLabel: { fontSize: 10, fontWeight: '700', color: '#555', letterSpacing: 1.5, marginBottom: 4 },
  chartValue: { fontSize: 28, fontWeight: '900', color: '#f0f0f0', letterSpacing: -1 },
  gainPill: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 4,
  },
  gainText: { fontSize: 12, fontWeight: '800', color: '#22c55e' },

  // Line chart elements
  segment: { position: 'absolute', height: 3, borderRadius: 2 },
  dot:     { position: 'absolute' },

  // X axis
  chartAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  axisLabel: { fontSize: 10, color: '#333', fontWeight: '600' },

  // ── Text ──────────────────────────────────────────────────
  textBlock: { alignItems: 'center', paddingHorizontal: 24 },
  tagline: {
    fontSize: 46, fontWeight: '900', color: '#f0f0f0',
    letterSpacing: -1.5, textAlign: 'center', lineHeight: 54,
  },
  taglinePurple: { color: '#a855f7' },
  subtitle: {
    fontSize: 15, color: '#555', fontWeight: '500',
    textAlign: 'center', lineHeight: 22, marginTop: 16,
  },

  // ── Buttons ───────────────────────────────────────────────
  ctas: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, width: '100%' },
  btnPrimary: {
    flex: 1, paddingVertical: 17, borderRadius: 18,
    backgroundColor: '#9333ea', alignItems: 'center',
    shadowColor: '#9333ea', shadowOpacity: 0.45,
    shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
  },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  btnSecondary: {
    flex: 1, paddingVertical: 17, borderRadius: 18,
    backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center',
  },
  btnSecondaryText: { color: '#888', fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
});
