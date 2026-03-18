import React, { useState, useEffect } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as api from '@/lib/api';
import { emitDataChanged } from '@/lib/dataEvents';
import { useToast } from '@/components/Toast';

// 3 tiles visible, flush with the portfolio card (marginHorizontal: 16 each side)
// containerWidth = screenWidth - 32; tileWidth = (containerWidth - 2 gaps) / 3
const TILE_GAP = 8;
const TILE_WIDTH = (Dimensions.get('window').width - 32 - TILE_GAP * 2) / 3;

const TOP_SPORTS = [
  { label: 'Football', emoji: '🏈' },
  { label: 'Basketball', emoji: '🏀' },
  { label: 'Baseball', emoji: '⚾' },
  { label: 'Soccer', emoji: '⚽' },
];
const MORE_SPORTS = ['Hockey','F1','Golf','Tennis','Pokémon','Magic: The Gathering','Yu-Gi-Oh!','Lorcana','One Piece','Dragon Ball Super','Digimon','Other'];
const GRADES = ['10','9.5','9','8.5','8','7.5','7','6.5','6','5','4','3','2','1'];
const GRADING_COS = ['PSA','BGS','SGC','CGC','HGA','CSG','GAI','Other'];

// ── Calendar Picker (shared with collection) ──────────────────
const MONTHS_FULL_D = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEK_DAYS_D = ['S','M','T','W','T','F','S'];
function CalendarPicker({ visible, value, onSelect, onClose }: {
  visible: boolean; value: string; onSelect: (d: string) => void; onClose: () => void;
}) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const parsed = value ? new Date(value + 'T12:00:00') : today;
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());
  useEffect(() => {
    if (visible) {
      const p = value ? new Date(value + 'T12:00:00') : today;
      setViewYear(p.getFullYear()); setViewMonth(p.getMonth());
    }
  }, [visible]);
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const selParts = value ? value.split('-').map(Number) : null;
  const isSelected = (day: number) => selParts && selParts[0] === viewYear && selParts[1] === viewMonth + 1 && selParts[2] === day;
  const isTodayCell = (day: number) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };
  const pick = (day: number) => { onSelect(`${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`); onClose(); };
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={calSt.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={calSt.container} activeOpacity={1} onPress={() => {}}>
          <View style={calSt.header}>
            <TouchableOpacity onPress={prevMonth} style={calSt.navBtn} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
              <Ionicons name="chevron-back" size={22} color="#a855f7" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={calSt.monthTitle}>{MONTHS_FULL_D[viewMonth]}</Text>
              <Text style={calSt.yearTitle}>{viewYear}</Text>
            </View>
            <TouchableOpacity onPress={nextMonth} style={calSt.navBtn} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
              <Ionicons name="chevron-forward" size={22} color="#a855f7" />
            </TouchableOpacity>
          </View>
          <View style={calSt.divider} />
          <View style={calSt.weekRow}>
            {WEEK_DAYS_D.map((d, i) => (
              <View key={i} style={calSt.weekCell}><Text style={calSt.weekDay}>{d}</Text></View>
            ))}
          </View>
          <View style={calSt.grid}>
            {cells.map((day, i) => {
              const sel = day ? isSelected(day) : false;
              const tod = day ? isTodayCell(day) : false;
              return (
                <TouchableOpacity key={i} style={[calSt.cell, sel && calSt.cellSel, tod && !sel && calSt.cellToday, !day && { opacity: 0 }]} onPress={() => day && pick(day)} disabled={!day} activeOpacity={0.65}>
                  <Text style={[calSt.cellText, sel && calSt.cellTextSel, tod && !sel && calSt.cellTextToday]}>{day ?? ''}</Text>
                  {sel && <View style={calSt.selDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={calSt.footer}>
            <TouchableOpacity style={calSt.cancelBtn} onPress={onClose}>
              <Text style={calSt.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[calSt.todayBtn, isCurrentMonth && value === todayStr && calSt.todayBtnActive]} onPress={() => { onSelect(todayStr); onClose(); }}>
              <Ionicons name="today-outline" size={13} color="#a855f7" />
              <Text style={calSt.todayText}>Today</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
const calSt = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: '#111111', borderRadius: 20, borderWidth: 1, borderColor: '#2a2a2a', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16, width: 340, shadowColor: '#9333ea', shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 8 } },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  monthTitle: { color: '#f0f0f0', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  yearTitle: { color: '#666', fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 1 },
  divider: { height: 1, backgroundColor: '#2a2a2a', marginBottom: 14 },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  weekDay: { color: '#4a4a4a', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 },
  cell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, position: 'relative' },
  cellSel: { backgroundColor: '#9333ea', shadowColor: '#9333ea', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cellToday: { backgroundColor: 'rgba(147,51,234,0.1)', borderWidth: 1, borderColor: 'rgba(147,51,234,0.4)' },
  cellText: { color: '#bbbbbb', fontSize: 14, fontWeight: '500' },
  cellTextSel: { color: '#fff', fontWeight: '800', fontSize: 14 },
  cellTextToday: { color: '#c084fc', fontWeight: '700' },
  selDot: { position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
  footer: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#2a2a2a', paddingTop: 14 },
  cancelBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: '#2a2a2a', alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  cancelText: { color: '#666', fontSize: 14, fontWeight: '700' },
  todayBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: 'rgba(147,51,234,0.1)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(147,51,234,0.3)', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  todayBtnActive: { backgroundColor: 'rgba(147,51,234,0.25)', borderColor: '#9333ea' },
  todayText: { color: '#a855f7', fontSize: 14, fontWeight: '700' },
});

const EMPTY_FORM = {
  player: '', sport: '', grade: '', gradingCo: '',
  buy: '', val: '', year: '', num: '', name: '',
  brand: '', qty: '1', cond: '', notes: '', auto: false,
  purchaseDate: '',
};

import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth';
import { useData } from '@/context/data';

type Card = {
  id: string;
  player: string;
  year: number;
  sport: string;
  buy: number;
  val: number;
  grade?: string;
  gradingCo?: string;
  cond?: string;
  brand?: string;
  qty?: number;
  sold?: boolean;
  soldPrice?: number;
  soldDate?: string;
  purchaseDate?: string;
  createdAt?: string;
};

type Snapshot = {
  id: string;
  value: number;
  createdAt: string;
};

type Activity = {
  id: string;
  type: string;   // 'added' | 'sold' | 'price_update' | 'edited' | 'deleted'
  player: string;
  sport?: string;
  detail?: string;
  createdAt: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n || 0);

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatDateShort = (date: Date) => {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
};

const getSportEmoji = (sport?: string): string => {
  if (!sport) return '🃏';
  const s = sport.toLowerCase();
  if (s.includes('baseball') || s.includes('mlb')) return '⚾';
  if (s.includes('basketball') || s.includes('nba')) return '🏀';
  if (s.includes('football') || s.includes('nfl')) return '🏈';
  if (s.includes('soccer') || s.includes('mls')) return '⚽';
  if (s.includes('hockey') || s.includes('nhl')) return '🏒';
  if (s.includes('f1') || s.includes('racing') || s.includes('formula')) return '🏎️';
  if (s.includes('golf')) return '⛳';
  if (s.includes('tennis')) return '🎾';
  if (s.includes('boxing') || s.includes('mma')) return '🥊';
  if (s.includes('pokemon') || s.includes('tcg') || s.includes('trading')) return '🃏';
  return '🃏';
};

const getActivityBadgeColor = (type: string) => {
  switch (type.toLowerCase()) {
    case 'added': return '#22c55e';
    case 'sold': return '#f59e0b';
    case 'price_update': return '#a855f7';
    case 'edited': return '#3b82f6';
    case 'deleted': return '#ef4444';
    default: return '#666666';
  }
};

function getGreeting(): string {
  return 'Hello';
}

export default function DashboardScreen() {
  const { user, displayName } = useAuth();
  const insets = useSafeAreaInsets();
  const { cards: allCards, snapshots, activity, initialLoading, refresh } = useData();
  const cards = allCards.filter((c) => !c.sold);
  const { show: showToast, ToastComponent } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [spotlightSeed, setSpotlightSeed] = useState(() => Math.random());

  // Add Card modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [showSportPickerInline, setShowSportPickerInline] = useState(false);
  const [showGradePicker, setShowGradePicker] = useState(false);
  const [showGradingCoPicker, setShowGradingCoPicker] = useState(false);
  const [showPurchaseCalendar, setShowPurchaseCalendar] = useState(false);

  // View Sold modal state
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [soldSearch, setSoldSearch] = useState('');
  const [soldSort, setSoldSort] = useState<'price-high'|'price-low'|'gl-high'|'gl-low'|'name'|'date'>('date');
  const [soldSport, setSoldSport] = useState('ALL');
  const [showSoldSortSheet, setShowSoldSortSheet] = useState(false);
  const [showSoldSportDropdown, setShowSoldSportDropdown] = useState(false);

  const handleUnsell = (card: Card) => {
    Alert.alert('Restore to Collection', `Move "${card.player}" back to your active collection? The original purchase price and market value will be kept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore', style: 'default',
        onPress: async () => {
          try {
            await api.updateCard({
              id: card.id,
              player: card.player,
              sport: card.sport,
              buy: card.buy,
              val: card.val,
              grade: card.grade || null,
              gradingCo: card.gradingCo || null,
              cond: card.cond || null,
              brand: card.brand || null,
              qty: card.qty || 1,
              sold: false,
              soldPrice: null,
              soldDate: null,
            });
            emitDataChanged();
          } catch {
            Alert.alert('Error', 'Failed to restore card');
          }
        },
      },
    ]);
  };

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const handleSaveCard = async () => {
    if (!form.player.trim()) { setFormError('Player name is required'); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        player: form.player.trim(),
        sport: form.sport || null,
        grade: form.grade || null,
        gradingCo: form.gradingCo || null,
        buy: parseFloat(form.buy) || 0,
        val: parseFloat(form.val) || 0,
        year: form.year || null,
        num: form.num || null,
        name: form.name || null,
        brand: form.brand || null,
        qty: parseInt(form.qty) || 1,
        cond: form.cond || null,
        notes: form.notes || null,
        auto: form.auto,
        purchaseDate: form.purchaseDate || null,
      };
      await api.addCard(payload);
      setForm({ ...EMPTY_FORM });
      setShowMoreDetails(false);
      setShowAddModal(false);
      emitDataChanged();
      showToast({ emoji: '🎉', title: `${payload.player} added!`, sub: 'Your collection just got better 🔥', color: '#22c55e' });
    } catch (e: any) {
      setFormError(e.message || 'Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading && allCards.length === 0) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#9333ea" />
      </View>
    );
  }

  const activeCards = cards;
  const soldCards = allCards.filter(c => c.sold);
  // Use qty throughout for accurate multi-copy totals
  const realizedPL = soldCards.reduce((sum, c) => sum + ((c.soldPrice || 0) - (c.buy || 0)) * (c.qty || 1), 0);
  const totalCards = activeCards.length;
  const totalInvested = allCards.reduce((sum, c) => sum + (c.buy || 0) * (c.qty || 1), 0);
  const currentValue = activeCards.reduce((sum, c) => sum + (c.val || 0) * (c.qty || 1), 0);
  const activeInvested = activeCards.reduce((sum, c) => sum + (c.buy || 0) * (c.qty || 1), 0);
  const unrealizedGL = activeCards.reduce((sum, c) => sum + ((c.val || 0) - (c.buy || 0)) * (c.qty || 1), 0);
  const totalGL = unrealizedGL + realizedPL;
  // unrealizedGLPercent: gain on active positions relative to what was paid for them
  const unrealizedGLPercent = activeInvested > 0 ? ((unrealizedGL / activeInvested) * 100).toFixed(1) : '0.0';
  // totalReturnPercent: total return (unrealized + realized) over total ever invested
  const totalReturnPercent = totalInvested > 0 ? ((totalGL / totalInvested) * 100).toFixed(1) : '0.0';

  // Last added card (most recently created active card)
  const lastAddedCard = [...activeCards]
    .filter(c => c.createdAt)
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0] ?? null;

  // Spotlight card — random on every refresh
  const cardOfTheDay = activeCards.length > 0
    ? activeCards[Math.floor(spotlightSeed * activeCards.length)]
    : null;

  const scrollStats = [
    { label: 'ACTIVE CARDS', value: totalCards.toString(), color: '#f0f0f0' },
    { label: 'TOTAL INVESTED', value: fmt(totalInvested), color: '#f0f0f0' },
    { label: 'ACTIVE VALUE', value: fmt(currentValue), color: '#f0f0f0' },
    { label: 'UNREALIZED G/L', value: `${unrealizedGL >= 0 ? '+' : ''}${fmt(unrealizedGL)}`, color: unrealizedGL >= 0 ? '#22c55e' : '#ef4444' },
    { label: 'REALIZED P&L', value: `${realizedPL >= 0 ? '+' : ''}${fmt(realizedPL)}`, color: realizedPL >= 0 ? '#22c55e' : '#ef4444' },
    { label: 'TOTAL RETURN', value: `${totalGL >= 0 ? '+' : ''}${totalReturnPercent}%`, color: totalGL >= 0 ? '#22c55e' : '#ef4444' },
  ];

  return (
    <>
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); setSpotlightSeed(Math.random()); await refresh(); setRefreshing(false); }}
          tintColor="#9333ea"
        />
      }
    >
      {/* Greeting Header */}
      <View style={[styles.pageHeader, { paddingTop: insets.top + 14 }]}>
        <View style={styles.pageHeaderRow}>
          <Text style={styles.pageTitle}>{getGreeting()}, {displayName || user?.username || 'Collector'} 👋</Text>
        </View>
        <Text style={styles.pageDate}>{formatDateShort(new Date())}</Text>
      </View>

      {/* Portfolio Card — unified */}
      <View style={styles.portfolioCard}>
        <View style={styles.portfolioAccentBar} />

        {/* Top: big portfolio value */}
        <View style={styles.portfolioTopSection}>
          <Text style={styles.portfolioMainLabel}>TOTAL PORTFOLIO VALUE</Text>
          <Text style={styles.portfolioMainValue}>{fmt(currentValue)}</Text>
          <View style={styles.portfolioGLPill}>
            <Text style={[styles.portfolioGLPillText, { color: unrealizedGL >= 0 ? '#22c55e' : '#ef4444' }]}>
              {unrealizedGL >= 0 ? '↗' : '↘'}  {unrealizedGL >= 0 ? '+' : ''}{fmt(unrealizedGL)}  ·  {unrealizedGL >= 0 ? '+' : ''}{unrealizedGLPercent}%  UNREALIZED
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.portfolioInnerDivider} />

        {/* 2×2 stat grid */}
        <View style={styles.portfolioStatGrid}>
          <View style={styles.portfolioStatCell}>
            <Text style={styles.portfolioStatLabel}>TOTAL CURRENT INVESTED</Text>
            <Text style={styles.portfolioStatValue}>{fmt(activeInvested)}</Text>
          </View>
          <View style={[styles.portfolioStatCell, styles.portfolioStatCellLeft]}>
            <Text style={styles.portfolioStatLabel}>ACTIVE CARDS</Text>
            <Text style={styles.portfolioStatValue}>{totalCards}</Text>
          </View>
          <View style={[styles.portfolioStatCell, styles.portfolioStatCellTop]}>
            <Text style={styles.portfolioStatLabel}>LIFETIME INVESTMENT</Text>
            <Text style={styles.portfolioStatValue}>{fmt(totalInvested)}</Text>
          </View>
          <View style={[styles.portfolioStatCell, styles.portfolioStatCellLeft, styles.portfolioStatCellTop]}>
            <Text style={styles.portfolioStatLabel}>REALIZED P&L</Text>
            <Text style={[styles.portfolioStatValue, { color: realizedPL >= 0 ? '#22c55e' : '#ef4444' }]}>
              {realizedPL >= 0 ? '+' : ''}{fmt(realizedPL)}
            </Text>
          </View>
        </View>
      </View>


      {/* Spotlight */}
      {cardOfTheDay && (
        <TouchableOpacity
          style={styles.cardOfDayContainer}
          onPress={() => router.push({ pathname: '/(tabs)/collection', params: { search: cardOfTheDay.player } })}
          activeOpacity={0.85}
        >
          <View style={styles.cardOfDayAccentBar} />
          <View style={styles.cardOfDayHeader}>
            <View style={styles.cardOfDayHeaderLeft}>
              <Text style={styles.cardOfDaySparkle}>✨</Text>
              <Text style={styles.cardOfDayHeaderLabel}>SPOTLIGHT</Text>
            </View>
            <View style={styles.cardOfDayStats}>
              <View style={styles.cardOfDayStat}>
                <Text style={styles.cardOfDayStatLabel}>BUY</Text>
                <Text style={styles.cardOfDayStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{fmt(cardOfTheDay.buy)}</Text>
              </View>
              <View style={[styles.cardOfDayStat, styles.cardOfDayStatBorder]}>
                <Text style={styles.cardOfDayStatLabel}>VALUE</Text>
                <Text style={styles.cardOfDayStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{fmt(cardOfTheDay.val)}</Text>
              </View>
              <View style={styles.cardOfDayStat}>
                <Text style={styles.cardOfDayStatLabel}>G/L</Text>
                <Text style={[styles.cardOfDayStatValue, { color: cardOfTheDay.val - cardOfTheDay.buy >= 0 ? '#22c55e' : '#ef4444' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {cardOfTheDay.val - cardOfTheDay.buy >= 0 ? '+' : ''}
                  {(((cardOfTheDay.val - cardOfTheDay.buy) / (cardOfTheDay.buy || 1)) * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.cardOfDayBody}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardOfDayName} numberOfLines={1}>{cardOfTheDay.player}</Text>
<Text style={styles.cardOfDayLink}>View in collection →</Text>
            </View>
            <View style={styles.cardOfDayThumb}>
              <Text style={styles.cardOfDayThumbEmoji}>{getSportEmoji(cardOfTheDay.sport)}</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Quick Actions */}
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={styles.quickBtnAdd}
          onPress={() => { setForm({ ...EMPTY_FORM }); setFormError(''); setShowMoreDetails(false); setShowAddModal(true); }}
          activeOpacity={0.85}
        >
          <View style={styles.quickBtnAccentAdd} />
          <Text style={styles.quickBtnIcon}>🃏</Text>
          <Text style={styles.quickBtnLabel}>Topload Card</Text>
          <Text style={styles.quickBtnHint}>Log a new card</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickBtnSold}
          onPress={() => { setSoldSearch(''); setSoldSort('date'); setSoldSport('ALL'); setShowSoldSortSheet(false); setShowSoldSportDropdown(false); setShowSoldModal(true); }}
          activeOpacity={0.85}
        >
          <View style={styles.quickBtnAccentSold} />
          <Text style={styles.quickBtnIcon}>💸</Text>
          <Text style={styles.quickBtnLabel}>View Sold</Text>
          <Text style={styles.quickBtnHint}>
            {soldCards.length} {soldCards.length === 1 ? 'card' : 'cards'} sold
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recent Activity */}
      {activity.length > 0 && (
        <View style={styles.activityContainer}>
          <View style={styles.activityTitleRow}>
            <View style={styles.activityDot} />
            <Text style={styles.activityTitle}>RECENT ACTIVITY</Text>
          </View>
          {activity.slice(0, 6).map((item) => (
            <View key={item.id} style={[styles.activityItem, { borderLeftWidth: 3, borderLeftColor: getActivityBadgeColor(item.type) }]}>
              {/* Sport emoji avatar */}
              <View style={styles.activityAvatar}>
                <Text style={styles.activityAvatarEmoji}>{getSportEmoji(item.sport)}</Text>
              </View>
              {/* Info */}
              <View style={styles.activityInfo}>
                <View style={styles.activityTopRow}>
                  <Text style={[styles.activityBadgeText, { color: getActivityBadgeColor(item.type) }]}>
                    {item.type.toUpperCase().replace(/_/g, ' ')}
                  </Text>
                  <Text style={styles.activityCardName} numberOfLines={1}> {item.player}</Text>
                </View>
                {item.detail ? (
                  <Text style={styles.activityDetail} numberOfLines={1}>{item.detail}</Text>
                ) : null}
              </View>
              {/* Time */}
              <Text style={styles.activityTime}>{formatDate(item.createdAt)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.spacer} />
    </ScrollView>

    {/* ── Add Card Modal ─────────────────────────────────── */}
    <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddModal(false)}>
      <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Card</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={24} color="#888888" />
            </TouchableOpacity>
          </View>

          {formError ? (
            <View style={styles.modalErrorBox}>
              <Text style={styles.modalErrorText}>{formError}</Text>
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>PLAYER NAME *</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder="e.g. LeBron James"
            placeholderTextColor="#888888"
            value={form.player}
            onChangeText={v => set('player', v)}
          />

          <Text style={styles.fieldLabel}>SPORT / GAME</Text>
          <View style={styles.sportGrid}>
            {TOP_SPORTS.map(s => (
              <TouchableOpacity
                key={s.label}
                style={[styles.sportBtn, form.sport === s.label && styles.sportBtnActive]}
                onPress={() => set('sport', form.sport === s.label ? '' : s.label)}
              >
                <Text style={styles.sportEmoji}>{s.emoji}</Text>
                <Text style={[styles.sportLabel, form.sport === s.label && styles.sportLabelActive]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.moreSportBtn, (form.sport && !TOP_SPORTS.find(s => s.label === form.sport)) && styles.moreSportBtnActive]}
            onPress={() => { setShowSportPickerInline(v => !v); setShowGradePicker(false); setShowGradingCoPicker(false); }}
          >
            <Text style={[styles.moreSportText, (form.sport && !TOP_SPORTS.find(s => s.label === form.sport)) && { color: '#a855f7' }]}>
              {form.sport && !TOP_SPORTS.find(s => s.label === form.sport) ? `${form.sport}` : 'More sports / TCG...'}
            </Text>
            <Ionicons name={showSportPickerInline ? 'chevron-up' : 'chevron-down'} size={16} color="#888888" />
          </TouchableOpacity>
          {showSportPickerInline && (
            <View style={styles.inlinePicker}>
              {MORE_SPORTS.map(s => (
                <TouchableOpacity key={s} style={styles.inlinePickerItem} onPress={() => { set('sport', s); setShowSportPickerInline(false); }}>
                  <Text style={{ color: form.sport === s ? '#a855f7' : '#ccc', fontSize: 14 }}>{s}</Text>
                  {form.sport === s && <Ionicons name="checkmark" size={16} color="#a855f7" />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Autograph toggle */}
          <TouchableOpacity
            style={[styles.autoRow, form.auto && styles.autoRowActive]}
            onPress={() => set('auto', !form.auto)}
          >
            <View style={[styles.autoCheckbox, form.auto && styles.autoCheckboxActive]}>
              {form.auto && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.autoLabel, form.auto && { color: '#ffbe2e' }]}>Autograph ✍️</Text>
              <Text style={styles.autoSub}>This card has an autograph</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.row2}>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>BUY PRICE ($)</Text>
              <TextInput style={styles.fieldInput} placeholder="0.00" placeholderTextColor="#888888" keyboardType="decimal-pad" value={form.buy} onChangeText={v => set('buy', v)} />
            </View>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>CURRENT VALUE ($)</Text>
              <TextInput style={styles.fieldInput} placeholder="0.00" placeholderTextColor="#888888" keyboardType="decimal-pad" value={form.val} onChangeText={v => set('val', v)} />
            </View>
          </View>

          {/* Quantity + Purchase Date row */}
          <View style={styles.row2}>
            <View style={{ width: '40%' }}>
              <Text style={styles.fieldLabel}>QUANTITY</Text>
              <TextInput style={styles.fieldInput} placeholder="1" placeholderTextColor="#888888" keyboardType="number-pad" value={form.qty} onChangeText={v => set('qty', v)} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>DATE PURCHASED</Text>
              <TouchableOpacity
                style={[styles.fieldInput, styles.datePickerBtn]}
                onPress={() => setShowPurchaseCalendar(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={16} color={form.purchaseDate ? '#a855f7' : '#888888'} />
                <Text style={[styles.datePickerText, !form.purchaseDate && { color: '#888888' }]}>
                  {form.purchaseDate || 'Select'}
                </Text>
                {form.purchaseDate ? (
                  <TouchableOpacity onPress={() => set('purchaseDate', '')} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                    <Ionicons name="close-circle" size={15} color="#888888" />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </View>
          </View>
          <CalendarPicker visible={showPurchaseCalendar} value={form.purchaseDate} onSelect={v => set('purchaseDate', v)} onClose={() => setShowPurchaseCalendar(false)} />

          <TouchableOpacity style={styles.moreDetailsBtn} onPress={() => setShowMoreDetails(v => !v)}>
            <Ionicons name={showMoreDetails ? 'chevron-up' : 'chevron-down'} size={15} color="#666" />
            <Text style={styles.moreDetailsBtnText}>{showMoreDetails ? 'Less details' : 'More details (year, set, grade...)'}</Text>
          </TouchableOpacity>

          {showMoreDetails && (
            <View>
              <Text style={styles.fieldLabel}>GRADE</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => { setShowGradePicker(v => !v); setShowGradingCoPicker(false); setShowSportPickerInline(false); }}>
                <Text style={styles.dropdownBtnText}>{form.grade || 'Raw / No grade'}</Text>
                <Ionicons name={showGradePicker ? 'chevron-up' : 'chevron-down'} size={16} color="#888888" />
              </TouchableOpacity>
              {showGradePicker && (
                <View style={styles.inlinePicker}>
                  <TouchableOpacity style={styles.inlinePickerItem} onPress={() => { set('grade', ''); setShowGradePicker(false); }}>
                    <Text style={{ color: !form.grade ? '#a855f7' : '#ccc', fontSize: 14 }}>Raw / No grade</Text>
                    {!form.grade && <Ionicons name="checkmark" size={16} color="#a855f7" />}
                  </TouchableOpacity>
                  {GRADES.map(g => (
                    <TouchableOpacity key={g} style={styles.inlinePickerItem} onPress={() => { set('grade', g); setShowGradePicker(false); }}>
                      <Text style={{ color: form.grade === g ? '#a855f7' : '#ccc', fontSize: 14 }}>{g}</Text>
                      {form.grade === g && <Ionicons name="checkmark" size={16} color="#a855f7" />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>GRADING COMPANY</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => { setShowGradingCoPicker(v => !v); setShowGradePicker(false); setShowSportPickerInline(false); }}>
                <Text style={styles.dropdownBtnText}>{form.gradingCo || 'No grading co.'}</Text>
                <Ionicons name={showGradingCoPicker ? 'chevron-up' : 'chevron-down'} size={16} color="#888888" />
              </TouchableOpacity>
              {showGradingCoPicker && (
                <View style={styles.inlinePicker}>
                  <TouchableOpacity style={styles.inlinePickerItem} onPress={() => { set('gradingCo', ''); setShowGradingCoPicker(false); }}>
                    <Text style={{ color: !form.gradingCo ? '#a855f7' : '#ccc', fontSize: 14 }}>No grading co.</Text>
                    {!form.gradingCo && <Ionicons name="checkmark" size={16} color="#a855f7" />}
                  </TouchableOpacity>
                  {GRADING_COS.map(g => (
                    <TouchableOpacity key={g} style={styles.inlinePickerItem} onPress={() => { set('gradingCo', g); setShowGradingCoPicker(false); }}>
                      <Text style={{ color: form.gradingCo === g ? '#a855f7' : '#ccc', fontSize: 14 }}>{g}</Text>
                      {form.gradingCo === g && <Ionicons name="checkmark" size={16} color="#a855f7" />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.row2}>
                <View style={styles.half}>
                  <Text style={styles.fieldLabel}>YEAR</Text>
                  <TextInput style={styles.fieldInput} placeholder="e.g. 2023" placeholderTextColor="#888888" keyboardType="number-pad" value={form.year} onChangeText={v => set('year', v)} />
                </View>
                <View style={styles.half}>
                  <Text style={styles.fieldLabel}>BRAND</Text>
                  <TextInput style={styles.fieldInput} placeholder="e.g. Topps" placeholderTextColor="#888888" value={form.brand} onChangeText={v => set('brand', v)} />
                </View>
              </View>

              <Text style={styles.fieldLabel}>CARD NAME / SET</Text>
              <TextInput style={styles.fieldInput} placeholder="e.g. Chrome Prizm" placeholderTextColor="#888888" value={form.name} onChangeText={v => set('name', v)} />

              <View style={{ width: '50%' }}>
                <Text style={styles.fieldLabel}>NUMBERING</Text>
                <TextInput style={styles.fieldInput} placeholder="e.g. /25" placeholderTextColor="#888888" value={form.num} onChangeText={v => set('num', v)} />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSaveCard}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Add to Collection</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>

    {/* ── View Sold Modal ────────────────────────────────── */}
    <Modal visible={showSoldModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSoldModal(false)}>
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Sold Cards ({soldCards.length})</Text>
          <TouchableOpacity onPress={() => setShowSoldModal(false)}>
            <Ionicons name="close" size={24} color="#888888" />
          </TouchableOpacity>
        </View>

        {soldCards.length === 0 ? (
          <View style={styles.soldEmpty}>
            <Text style={styles.soldEmptyText}>No sold cards yet</Text>
          </View>
        ) : (
          <>
            {/* Search + Sport + Sort row */}
            <View style={styles.soldToolbar}>
              <View style={styles.soldSearchBox}>
                <Ionicons name="search" size={14} color="#888888" />
                <TextInput
                  style={styles.soldSearchInput}
                  placeholder="Search sold cards..."
                  placeholderTextColor="#888888"
                  value={soldSearch}
                  onChangeText={setSoldSearch}
                />
                {soldSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setSoldSearch('')}>
                    <Ionicons name="close-circle" size={16} color="#888888" />
                  </TouchableOpacity>
                )}
              </View>
              {/* Sport dropdown button */}
              <TouchableOpacity
                style={[styles.soldSortBtn, soldSport !== 'ALL' && styles.soldSortBtnActive]}
                onPress={() => setShowSoldSportDropdown(true)}
              >
                <Text style={{ fontSize: 16 }}>{soldSport === 'ALL' ? '🃏' : getSportEmoji(soldSport)}</Text>
                <Ionicons name="chevron-down" size={11} color={soldSport !== 'ALL' ? '#fff' : '#bbbbbb'} />
              </TouchableOpacity>
              {/* Sort button */}
              <TouchableOpacity
                style={[styles.soldSortBtn, showSoldSortSheet && styles.soldSortBtnActive]}
                onPress={() => setShowSoldSortSheet(v => !v)}
              >
                <Ionicons name="funnel-outline" size={16} color={showSoldSortSheet ? '#fff' : '#bbbbbb'} />
              </TouchableOpacity>
            </View>

            {/* Sort sheet */}
            {showSoldSortSheet && (
              <View style={styles.soldSortSheet}>
                {([
                  ['date',       'Date Added'],
                  ['price-high', 'Sold Price ↓'],
                  ['price-low',  'Sold Price ↑'],
                  ['gl-high',    'G/L Best'],
                  ['gl-low',     'G/L Worst'],
                  ['name',       'Name A→Z'],
                ] as [string, string][]).map(([val, label]) => (
                  <TouchableOpacity
                    key={val}
                    style={[styles.soldSortOption, soldSort === val && styles.soldSortOptionActive]}
                    onPress={() => { setSoldSort(val as any); setShowSoldSortSheet(false); }}
                  >
                    <Text style={[styles.soldSortOptionText, soldSort === val && { color: '#a855f7' }]}>{label}</Text>
                    {soldSort === val && <Ionicons name="checkmark" size={14} color="#a855f7" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Sport dropdown overlay */}
            <Modal visible={showSoldSportDropdown} transparent animationType="fade" onRequestClose={() => setShowSoldSportDropdown(false)}>
              <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} activeOpacity={1} onPress={() => setShowSoldSportDropdown(false)}>
                <View style={styles.sportDropdownModal}>
                  <View style={styles.sportDropdownHeader}>
                    <Text style={styles.sportDropdownTitle}>Filter by Sport</Text>
                    <TouchableOpacity onPress={() => setShowSoldSportDropdown(false)}>
                      <Ionicons name="close" size={20} color="#bbbbbb" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                    {['ALL', ...Array.from(new Set(soldCards.map(c => c.sport).filter(Boolean) as string[]))].map(sp => (
                      <TouchableOpacity
                        key={sp}
                        style={styles.sportDropdownItem}
                        onPress={() => { setSoldSport(sp); setShowSoldSportDropdown(false); }}
                      >
                        <Text style={styles.sportDropdownItemEmoji}>{sp === 'ALL' ? '🃏' : getSportEmoji(sp)}</Text>
                        <Text style={[styles.sportDropdownItemText, soldSport === sp && styles.sportDropdownItemTextActive]}>
                          {sp === 'ALL' ? 'All Sports' : sp}
                        </Text>
                        {soldSport === sp && <Ionicons name="checkmark" size={18} color="#9333ea" style={{ marginLeft: 'auto' as any }} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </Modal>

            {/* List */}
            <FlatList
              data={(() => {
                let result = [...soldCards];
                if (soldSearch) result = result.filter(c => c.player?.toLowerCase().includes(soldSearch.toLowerCase()));
                if (soldSport !== 'ALL') result = result.filter(c => c.sport === soldSport);
                if (soldSort === 'price-high') result.sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0));
                else if (soldSort === 'price-low') result.sort((a, b) => (a.soldPrice || 0) - (b.soldPrice || 0));
                else if (soldSort === 'gl-high') result.sort((a, b) => ((b.soldPrice||0)-(b.buy||0)) - ((a.soldPrice||0)-(a.buy||0)));
                else if (soldSort === 'gl-low') result.sort((a, b) => ((a.soldPrice||0)-(a.buy||0)) - ((b.soldPrice||0)-(b.buy||0)));
                else if (soldSort === 'name') result.sort((a, b) => a.player.localeCompare(b.player));
                else result.sort((a, b) => new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime());
                return result;
              })()}
              keyExtractor={c => c.id}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              ListEmptyComponent={<View style={styles.soldEmpty}><Text style={styles.soldEmptyText}>No results</Text></View>}
              renderItem={({ item: c }) => {
                const gl = ((c.soldPrice || 0) - (c.buy || 0)) * (c.qty || 1);
                const glColor = gl >= 0 ? '#22c55e' : '#ef4444';
                return (
                  <TouchableOpacity
                    style={styles.soldCard}
                    onLongPress={() => handleUnsell(c)}
                    delayLongPress={400}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.soldCardEmoji}>{getSportEmoji(c.sport)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.soldCardName} numberOfLines={1}>{c.player}</Text>
                      <Text style={styles.soldCardMeta}>
                        {c.sport || '—'}{c.grade ? ` · ${c.gradingCo ? c.gradingCo + ' ' : ''}${c.grade}` : ''}
                      </Text>
                      <Text style={styles.soldCardHint}>Hold to restore</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={styles.soldCardPrice} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{fmt(c.soldPrice || 0)}</Text>
                      <Text style={[styles.soldCardGL, { color: glColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{gl >= 0 ? '+' : ''}{fmt(gl)}</Text>
                      <TouchableOpacity style={styles.unsellBtn} onPress={() => handleUnsell(c)}>
                        <Text style={styles.unsellBtnText}>↩ Restore</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </>
        )}
      </View>
    </Modal>

    <ToastComponent />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Page Header */
  pageHeader: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageGreeting: {
    color: '#888888',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  pageTitle: {
    color: '#f0f0f0',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  pageDate: {
    color: '#333',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
    letterSpacing: 0.2,
  },

  /* Portfolio Card */
  portfolioCard: {
    marginHorizontal: 16,
    backgroundColor: '#0d0820',
    borderWidth: 1.5,
    borderColor: '#3b1d6e',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#9333ea',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
  },
  portfolioAccentBar: {
    height: 3,
    backgroundColor: '#9333ea',
  },
  portfolioTopSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 18,
    paddingHorizontal: 18,
  },
  portfolioMainLabel: {
    color: '#7c4daa',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  portfolioMainValue: {
    color: '#f0f0f0',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.5,
    marginBottom: 10,
  },
  portfolioGLPill: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#2a1a3e',
  },
  portfolioGLPillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  portfolioInnerDivider: {
    height: 1,
    backgroundColor: '#2a1a3e',
    marginHorizontal: 0,
  },
  portfolioStatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  portfolioStatCell: {
    width: '50%',
    padding: 14,
    alignItems: 'center',
  },
  portfolioStatCellLeft: {
    borderLeftWidth: 1,
    borderLeftColor: '#2a1a3e',
  },
  portfolioStatCellTop: {
    borderTopWidth: 1,
    borderTopColor: '#2a1a3e',
  },
  portfolioStatLabel: {
    color: '#555',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  portfolioStatValue: {
    color: '#f0f0f0',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.3,
    textAlign: 'center',
  },

  /* Horizontal stat scroll */
  statScroll: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  statScrollContent: {
    gap: TILE_GAP,
  },
  statScrollCard: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 11,
    width: TILE_WIDTH,
  },
  statScrollLabel: {
    color: '#a855f7',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 5,
  },
  statScrollValue: {
    fontSize: 15,
    fontWeight: '900',
  },

  /* Quick Actions */
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  quickBtnAdd: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  quickBtnSold: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  quickBtnAccentAdd: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#9333ea',
  },
  quickBtnAccentSold: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#f59e0b',
  },
  quickBtnIcon: {
    fontSize: 22,
    lineHeight: 26,
  },
  quickBtnLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#e0e0e0',
    letterSpacing: -0.2,
  },
  quickBtnHint: {
    fontSize: 10,
    fontWeight: '600',
    color: '#888888',
  },

  /* Activity */
  activityContainer: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  activityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9333ea',
  },
  activityTitle: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    gap: 10,
  },
  activityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityAvatarEmoji: {
    fontSize: 18,
  },
  activityInfo: {
    flex: 1,
  },
  activityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    marginBottom: 2,
  },
  activityBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  activityCardName: {
    color: '#f0f0f0',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  activityDetail: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '500',
  },
  activityTime: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 0,
  },

  /* Error */
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 28,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  retryButton: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '700',
  },
  spacer: {
    height: 100,
  },

  /* ── Modals ──────────────────────────────────────────── */
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  modalScroll: {
    padding: 20,
    paddingBottom: 60,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  modalTitle: {
    color: '#f0f0f0',
    fontSize: 18,
    fontWeight: '900',
  },
  modalErrorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  modalErrorText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  fieldLabel: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 14,
  },
  fieldInput: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f0f0f0',
    fontSize: 15,
  },
  sportGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  sportBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    gap: 4,
  },
  sportBtnActive: {
    backgroundColor: 'rgba(147,51,234,0.15)',
    borderColor: '#9333ea',
  },
  sportEmoji: { fontSize: 18 },
  sportLabel: { color: '#888888', fontSize: 10, fontWeight: '700' },
  sportLabelActive: { color: '#a855f7' },
  moreSportBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 14,
  },
  moreSportBtnActive: { borderColor: '#9333ea' },
  moreSportText: { color: '#888888', fontSize: 13, fontWeight: '600' },
  inlinePicker: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    marginBottom: 14,
    overflow: 'hidden',
  },
  inlinePickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  row2: {
    flexDirection: 'row',
    gap: 10,
  },
  half: { flex: 1 },
  moreDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 4,
  },
  moreDetailsBtnText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
  },
  autoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 14,
  },
  autoRowActive: {
    borderColor: 'rgba(255,190,46,0.3)',
    backgroundColor: 'rgba(255,190,46,0.05)',
  },
  autoCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  autoCheckboxActive: {
    backgroundColor: '#ffbe2e',
    borderColor: '#ffbe2e',
  },
  autoLabel: { color: '#ccc', fontSize: 13, fontWeight: '700' },
  autoSub: { color: '#888888', fontSize: 10, marginTop: 1 },
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  datePickerText: { color: '#f0f0f0', fontSize: 14, flex: 1 },
  dropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 14,
  },
  dropdownBtnText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '500',
  },
  saveBtn: {
    backgroundColor: '#9333ea',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#9333ea',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },

  /* Sold modal */
  soldToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  soldSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 6,
  },
  soldSearchInput: {
    flex: 1,
    color: '#f0f0f0',
    fontSize: 14,
    padding: 0,
  },
  soldSortBtn: {
    height: 38,
    paddingHorizontal: 10,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  soldSortBtnActive: {
    backgroundColor: '#9333ea',
    borderColor: '#9333ea',
  },
  soldSortSheet: {
    marginHorizontal: 16,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  soldSortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  soldSortOptionActive: {
    backgroundColor: 'rgba(168,85,247,0.06)',
  },
  soldSortOptionText: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '600',
  },
  sportDropdownModal: {
    position: 'absolute',
    top: '20%',
    left: 20,
    right: 20,
    backgroundColor: '#111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  sportDropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  sportDropdownTitle: {
    color: '#f0f0f0',
    fontSize: 15,
    fontWeight: '800',
  },
  sportDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    gap: 12,
  },
  sportDropdownItemEmoji: {
    fontSize: 20,
  },
  sportDropdownItemText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  sportDropdownItemTextActive: {
    color: '#a855f7',
    fontWeight: '700',
  },
  soldEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  soldEmptyText: {
    color: '#888888',
    fontSize: 15,
    fontWeight: '600',
  },
  soldCard: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  soldCardEmoji: {
    fontSize: 24,
    flexShrink: 0,
  },
  soldCardName: {
    color: '#f0f0f0',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  soldCardMeta: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '500',
  },
  soldCardHint: {
    color: '#444444',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 3,
  },
  soldCardPrice: {
    color: '#f0f0f0',
    fontSize: 14,
    fontWeight: '800',
  },
  soldCardGL: {
    fontSize: 12,
    fontWeight: '700',
  },
  unsellBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  unsellBtnText: {
    color: '#bbbbbb',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Spotlight / Card of the Day */
  cardOfDayContainer: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#0f0a1a',
    borderWidth: 1.5,
    borderColor: '#3b1d6e',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#9333ea',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardOfDayAccentBar: {
    height: 3,
    backgroundColor: '#9333ea',
  },
  cardOfDayHeader: {
    flexDirection: 'column',
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a1a3e',
    gap: 8,
  },
  cardOfDayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardOfDaySparkle: {
    fontSize: 12,
  },
  cardOfDayHeaderLabel: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  cardOfDayStats: {
    flexDirection: 'row',
  },
  cardOfDayStat: {
    flex: 1,
    alignItems: 'center',
  },
  cardOfDayStatBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#2a1a3e',
  },
  cardOfDayStatLabel: {
    color: '#a855f7',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cardOfDayStatValue: {
    color: '#f0f0f0',
    fontSize: 13,
    fontWeight: '800',
  },
  cardOfDayBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  cardOfDayName: {
    color: '#f0f0f0',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 3,
  },
  cardOfDaySportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  cardOfDaySportEmoji: {
    fontSize: 13,
  },
  cardOfDaySport: {
    color: '#9966cc',
    fontSize: 13,
    fontWeight: '600',
  },
  cardOfDayLink: {
    color: '#a855f7',
    fontSize: 13,
    fontWeight: '700',
  },
  cardOfDayThumb: {
    width: 55,
    height: 70,
    backgroundColor: '#1a0a2e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3b1d6e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardOfDayThumbEmoji: {
    fontSize: 28,
  },
});
