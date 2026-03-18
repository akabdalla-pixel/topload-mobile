import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Fixed grid card width: 2 columns — screen minus 14px padding each side (28px), minus 10px gap (1 gap between 2 cols)
const GRID_CARD_W = (Dimensions.get('window').width - 38) / 2;
import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import * as api from '@/lib/api';
import { emitDataChanged } from '@/lib/dataEvents';
import { useData } from '@/context/data';
import { useAuth } from '@/context/auth';
import { useToast } from '@/components/Toast';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n || 0);

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
  return '🃏';
};

// Returns the set/brand line: "2023 Topps Chrome · Prizm Silver"
const cardSetLine = (card: { year?: string; brand?: string; name?: string }): string =>
  [card.year, card.brand, card.name].filter(Boolean).join(' · ');

// Returns the attributes line: "PSA 10 · /25 · AUTO"
const cardAttrLine = (card: { grade?: string; gradingCo?: string; num?: string; auto?: boolean }): string => {
  const parts: string[] = [];
  if (card.gradingCo && card.grade) parts.push(`${card.gradingCo} ${card.grade}`);
  else if (card.grade && card.grade !== 'Raw') parts.push(card.grade);
  if (card.num) parts.push(card.num.includes('/') ? card.num : `#${card.num}`);
  if (card.auto) parts.push('AUTO ✍️');
  return parts.join(' · ');
};

const TOP_SPORTS = [
  { label: 'Football', emoji: '🏈' },
  { label: 'Basketball', emoji: '🏀' },
  { label: 'Baseball', emoji: '⚾' },
  { label: 'Soccer', emoji: '⚽' },
];

const MORE_SPORTS = ['Hockey','F1','Golf','Tennis','Pokémon','Magic: The Gathering','Yu-Gi-Oh!','Lorcana','One Piece','Dragon Ball Super','Digimon','Other'];

const GRADES = ['Raw', '10','9.5','9','8.5','8','7.5','7','6.5','6','5','4','3','2','1'];
const GRADING_COS = ['PSA','BGS','SGC','CGC','HGA','CSG','GAI','Other'];
const CONDS = ['Mint','Near Mint','Excellent','Very Good','Good','Poor'];

const EMPTY_FORM = {
  id: '',
  player: '',
  sport: '',
  grade: '',
  gradingCo: '',
  buy: '',
  val: '',
  year: '',
  num: '',
  name: '',
  brand: '',
  qty: '1',
  cond: '',
  notes: '',
  auto: false,
  sold: false,
  soldPrice: '',
  soldDate: '',
  purchaseDate: '',
};

type Card = {
  id: string;
  player: string;
  sport?: string;
  year?: string;
  grade?: string;
  gradingCo?: string;
  buy: number;
  val: number;
  qty?: number;
  num?: string;
  name?: string;
  brand?: string;
  cond?: string;
  notes?: string;
  auto?: boolean;
  sold?: boolean;
  soldPrice?: number;
  soldDate?: string;
  purchaseDate?: string;
  createdAt?: string;
};

type FilterState = {
  sport: string;
  grade: 'all' | 'graded' | 'raw';
  autosOnly: boolean;
  minPrice: string;
  maxPrice: string;
  dateFrom: string;
  dateTo: string;
};

// ── Calendar Picker ──────────────────────────────────────────
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEK_DAYS = ['S','M','T','W','T','F','S'];

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
      setViewYear(p.getFullYear());
      setViewMonth(p.getMonth());
    }
  }, [visible]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const selParts = value ? value.split('-').map(Number) : null;
  const isSelected = (day: number) =>
    selParts && selParts[0] === viewYear && selParts[1] === viewMonth + 1 && selParts[2] === day;
  const isTodayCell = (day: number) =>
    today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };
  const pick = (day: number) => {
    onSelect(`${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`);
    onClose();
  };
  const pickToday = () => { onSelect(todayStr); onClose(); };

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={calSt.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={calSt.container} activeOpacity={1} onPress={() => {}}>

          {/* ── Month / Year header ── */}
          <View style={calSt.header}>
            <TouchableOpacity onPress={prevMonth} style={calSt.navBtn} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
              <Ionicons name="chevron-back" size={22} color="#a855f7" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={calSt.monthTitle}>{MONTHS_FULL[viewMonth]}</Text>
              <Text style={calSt.yearTitle}>{viewYear}</Text>
            </View>
            <TouchableOpacity onPress={nextMonth} style={calSt.navBtn} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
              <Ionicons name="chevron-forward" size={22} color="#a855f7" />
            </TouchableOpacity>
          </View>

          {/* ── Divider ── */}
          <View style={calSt.divider} />

          {/* ── Day-of-week labels ── */}
          <View style={calSt.weekRow}>
            {WEEK_DAYS.map((d, i) => (
              <View key={i} style={calSt.weekCell}>
                <Text style={calSt.weekDay}>{d}</Text>
              </View>
            ))}
          </View>

          {/* ── Date grid ── */}
          <View style={calSt.grid}>
            {cells.map((day, i) => {
              const sel = day ? isSelected(day) : false;
              const tod = day ? isTodayCell(day) : false;
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    calSt.cell,
                    sel && calSt.cellSel,
                    tod && !sel && calSt.cellToday,
                    !day && { opacity: 0 },
                  ]}
                  onPress={() => day && pick(day)}
                  disabled={!day}
                  activeOpacity={0.65}
                >
                  <Text style={[
                    calSt.cellText,
                    sel && calSt.cellTextSel,
                    tod && !sel && calSt.cellTextToday,
                  ]}>
                    {day ?? ''}
                  </Text>
                  {sel && <View style={calSt.selDot} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Footer ── */}
          <View style={calSt.footer}>
            <TouchableOpacity style={calSt.cancelBtn} onPress={onClose}>
              <Text style={calSt.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[calSt.todayBtn, isCurrentMonth && value === todayStr && calSt.todayBtnActive]}
              onPress={pickToday}
            >
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#111111',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    width: 340,
    shadowColor: '#9333ea',
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 8 },
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  monthTitle: {
    color: '#f0f0f0',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  yearTitle: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginBottom: 14,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekDay: {
    color: '#4a4a4a',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  cell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    position: 'relative',
  },
  cellSel: {
    backgroundColor: '#9333ea',
    shadowColor: '#9333ea',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cellToday: {
    backgroundColor: 'rgba(147,51,234,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(147,51,234,0.4)',
  },
  cellText: {
    color: '#bbbbbb',
    fontSize: 14,
    fontWeight: '500',
  },
  cellTextSel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  cellTextToday: {
    color: '#c084fc',
    fontWeight: '700',
  },
  selDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
    paddingTop: 14,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  cancelText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '700',
  },
  todayBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(147,51,234,0.1)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(147,51,234,0.3)',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  todayBtnActive: {
    backgroundColor: 'rgba(147,51,234,0.25)',
    borderColor: '#9333ea',
  },
  todayText: {
    color: '#a855f7',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default function CollectionScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { search: incomingSearch } = useLocalSearchParams<{ search?: string }>();
  const { cards, initialLoading, refresh } = useData();
  const { show: showToast, ToastComponent } = useToast();
  const [filtered, setFiltered] = useState<Card[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'sold' | 'all'>('active');
  const [sortBy, setSortBy] = useState<string>('date-newest');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showBreakevenModal, setShowBreakevenModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    sport: 'all',
    grade: 'all',
    autosOnly: false,
    minPrice: '',
    maxPrice: '',
    dateFrom: '',
    dateTo: '',
  });
  const [showFilterFromCalendar, setShowFilterFromCalendar] = useState(false);
  const [showFilterToCalendar, setShowFilterToCalendar] = useState(false);
  const [breakEvenPrice, setBreakEvenPrice] = useState<number | null>(null);
  const [breakEvenTargetPrice, setBreakEvenTargetPrice] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sportPill, setSportPill] = useState<string>('ALL');
  const [showSportDropdown, setShowSportDropdown] = useState(false);
  const [sellCard, setSellCard] = useState<Card | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  const [sellDate, setSellDate] = useState('');
  const [showSellCalendar, setShowSellCalendar] = useState(false);
  const [showFormCalendar, setShowFormCalendar] = useState(false);
  const [showPurchaseCalendar, setShowPurchaseCalendar] = useState(false);
  const [sellSaving, setSellSaving] = useState(false);
  const [calcBuyPrice, setCalcBuyPrice] = useState('');
  const [calcCardName, setCalcCardName] = useState('');
  const [calcEbayFee, setCalcEbayFee] = useState('13.25');
  const [calcShipping, setCalcShipping] = useState('5.00');
  const [showCalcResults, setShowCalcResults] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [showSportPickerInline, setShowSportPickerInline] = useState(false);
  const [showGradePicker, setShowGradePicker] = useState(false);
  const [showGradingCoPicker, setShowGradingCoPicker] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toolsOpenId, setToolsOpenId] = useState<string | null>(null);

  // Track open swipeables so only one stays open at a time
  const swipeRefs = useRef<{ [id: string]: Swipeable | null }>({});

  // Animation for inline filter dropdown
  const filterAnim = useRef(new Animated.Value(0)).current;

  const openFilterDropdown = () => {
    setShowFilterModal(true);
    Animated.timing(filterAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  };
  const closeFilterDropdown = () => {
    Animated.timing(filterAnim, { toValue: 0, duration: 150, useNativeDriver: false }).start(() => setShowFilterModal(false));
  };
  const toggleFilterDropdown = () => showFilterModal ? closeFilterDropdown() : openFilterDropdown();

  // Swipe-down-to-dismiss pan responder for sort bottom sheet
  const sortPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderRelease: (_, g) => { if (g.dy > 50) setShowSortModal(false); },
    })
  ).current;

  // Apply incoming search param (e.g. from dashboard tap) — only consume it once per navigation
  const lastAppliedSearch = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (incomingSearch && incomingSearch !== lastAppliedSearch.current) {
      lastAppliedSearch.current = incomingSearch;
      setSearch(incomingSearch);
    }
  }, [incomingSearch]);

  // Clear the search when the user leaves the collection tab so they start fresh next visit
  useFocusEffect(
    useCallback(() => {
      return () => {
        // on blur: wipe search and reset the consumed-param ref so a future deep-link works again
        setSearch('');
        lastAppliedSearch.current = undefined;
      };
    }, [])
  );

  // Reset sport pill whenever the status tab changes so stale selections don't carry over
  useEffect(() => {
    setSportPill('ALL');
  }, [statusFilter]);

  const applyFiltersAndSort = useCallback(() => {
    let result = [...cards];

    if (statusFilter === 'active') {
      result = result.filter(c => !c.sold);
    } else if (statusFilter === 'sold') {
      result = result.filter(c => c.sold);
    }

    if (search) {
      result = result.filter(c => c.player?.toLowerCase().includes(search.toLowerCase()));
    }

    if (sportPill !== 'ALL') {
      result = result.filter(c => c.sport === sportPill);
    }

    if (filters.sport !== 'all') {
      result = result.filter(c => c.sport === filters.sport);
    }

    if (filters.grade === 'graded') {
      result = result.filter(c => c.grade && c.grade !== 'Raw');
    } else if (filters.grade === 'raw') {
      result = result.filter(c => !c.grade || c.grade === 'Raw');
    }

    if (filters.autosOnly) {
      result = result.filter(c => c.auto);
    }

    if (filters.minPrice) {
      const min = parseFloat(filters.minPrice) || 0;
      result = result.filter(c => (c.val || 0) >= min);
    }

    if (filters.maxPrice) {
      const max = parseFloat(filters.maxPrice) || Infinity;
      result = result.filter(c => (c.val || 0) <= max);
    }

    if (filters.dateFrom) {
      result = result.filter(c => {
        const d = c.purchaseDate || c.createdAt;
        return d && d >= filters.dateFrom;
      });
    }

    if (filters.dateTo) {
      result = result.filter(c => {
        const d = c.purchaseDate || c.createdAt;
        return d && d <= filters.dateTo;
      });
    }

    if (sortBy === 'value-high') {
      result.sort((a, b) => (b.val || 0) - (a.val || 0));
    } else if (sortBy === 'value-low') {
      result.sort((a, b) => (a.val || 0) - (b.val || 0));
    } else if (sortBy === 'player-az') {
      result.sort((a, b) => (a.player || '').localeCompare(b.player || ''));
    } else if (sortBy === 'player-za') {
      result.sort((a, b) => (b.player || '').localeCompare(a.player || ''));
    } else if (sortBy === 'date-newest') {
      result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else if (sortBy === 'date-oldest') {
      result.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    } else if (sortBy === 'buy-high') {
      result.sort((a, b) => (b.buy || 0) - (a.buy || 0));
    } else if (sortBy === 'buy-low') {
      result.sort((a, b) => (a.buy || 0) - (b.buy || 0));
    } else if (sortBy === 'gain-high') {
      result.sort((a, b) => ((b.val || 0) - (b.buy || 0)) - ((a.val || 0) - (a.buy || 0)));
    } else if (sortBy === 'gain-low') {
      result.sort((a, b) => ((a.val || 0) - (a.buy || 0)) - ((b.val || 0) - (b.buy || 0)));
    }

    setFiltered(result);
  }, [cards, search, statusFilter, sortBy, filters, sportPill]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [applyFiltersAndSort]);

  // Stats scoped to the active sport filter so numbers match what the user sees
  const activeSport = sportPill !== 'ALL' ? sportPill : (filters.sport !== 'all' ? filters.sport : null);
  const scopedCards = activeSport ? cards.filter(c => c.sport === activeSport) : cards;
  const activeCards2 = scopedCards.filter(c => !c.sold);
  const soldCards2 = scopedCards.filter(c => c.sold);
  const portfolioValue = activeCards2.reduce((sum, c) => sum + (c.val || 0) * (c.qty || 1), 0);
  const totalInvested = activeCards2.reduce((sum, c) => sum + (c.buy || 0) * (c.qty || 1), 0);
  const unrealizedGL = activeCards2.reduce((sum, c) => sum + ((c.val || 0) - (c.buy || 0)) * (c.qty || 1), 0);
  const realizedGL = soldCards2.reduce((sum, c) => sum + ((c.soldPrice || 0) - (c.buy || 0)) * (c.qty || 1), 0);
  const totalGL = unrealizedGL + realizedGL;
  const stats = {
    portfolioValue,
    totalInvested,
    cardsCount: activeCards2.length,
    realized: realizedGL,
    gainLoss: totalGL,
  };

  // Dynamic sport pills — reflects whichever status tab is active
  const sportSet = new Set<string>();
  const pillSource = statusFilter === 'active' ? cards.filter(c => !c.sold)
    : statusFilter === 'sold' ? cards.filter(c => c.sold)
    : cards;
  pillSource.forEach(c => { if (c.sport) sportSet.add(c.sport); });
  const sportPills = ['ALL', ...Array.from(sportSet)];

  const handleEdit = (card: Card) => {
    setForm({
      id: card.id,
      player: card.player || '',
      sport: card.sport || '',
      grade: card.grade || '',
      gradingCo: card.gradingCo || '',
      buy: String(card.buy || ''),
      val: String(card.val || ''),
      year: card.year || '',
      num: card.num || '',
      name: card.name || '',
      brand: card.brand || '',
      qty: String(card.qty || 1),
      cond: card.cond || '',
      notes: card.notes || '',
      auto: card.auto || false,
      sold: card.sold || false,
      soldPrice: String(card.soldPrice || ''),
      soldDate: card.soldDate || '',
      purchaseDate: card.purchaseDate || '',
    });
    setShowMoreDetails(true);  // always expand details when editing
    setShowSportPickerInline(false);
    setShowGradePicker(false);
    setShowGradingCoPicker(false);
    setShowAddModal(true);
  };

  const handleSaveCard = async () => {
    if (!form.player.trim()) {
      setFormError('Player name is required');
      return;
    }
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
        sold: form.sold,
        soldPrice: form.sold ? (parseFloat(form.soldPrice) || 0) : null,
        soldDate: form.sold ? form.soldDate : null,
        purchaseDate: form.purchaseDate || null,
      };

      const isNew = !form.id;
      if (form.id) {
        await api.updateCard({ id: form.id, ...payload });
      } else {
        await api.addCard(payload);
      }

      setForm({ ...EMPTY_FORM });
      setShowAddModal(false);
      emitDataChanged();
      if (isNew) {
        showToast({
          emoji: '🎉',
          title: `${payload.player} added!`,
          sub: 'Your collection just got better 🔥',
          color: '#22c55e',
        });
      } else {
        showToast({
          emoji: '✅',
          title: 'Card updated',
          sub: `${payload.player} saved successfully`,
          color: '#9333ea',
        });
      }
    } catch (e: any) {
      setFormError(e.message || 'Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Card', 'Remove this card from your collection?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteCard(id);
            emitDataChanged();
          } catch {
            Alert.alert('Error', 'Failed to delete card');
          }
        },
      },
    ]);
  };

  const enterSelectionMode = (id: string) => {
    // Close any open swipeables first
    Object.values(swipeRefs.current).forEach(ref => ref?.close());
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  };

  const handleBulkDelete = () => {
    const count = selectedIds.size;
    Alert.alert(
      'Delete Cards',
      `Remove ${count} card${count !== 1 ? 's' : ''} from your collection?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Delete ${count}`,
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all([...selectedIds].map(id => api.deleteCard(id)));
              exitSelectionMode();
              emitDataChanged();
            } catch {
              Alert.alert('Error', 'Failed to delete some cards');
            }
          },
        },
      ]
    );
  };

  const closeOtherSwipeables = (openId: string) => {
    Object.entries(swipeRefs.current).forEach(([id, ref]) => {
      if (id !== openId) ref?.close();
    });
  };

  const renderDeleteAction = (cardId: string) => (
    <TouchableOpacity
      style={styles.swipeDeleteBtn}
      activeOpacity={0.85}
      onPress={() => {
        swipeRefs.current[cardId]?.close();
        handleDelete(cardId);
      }}
    >
      <Ionicons name="trash" size={20} color="#fff" />
      <Text style={styles.swipeDeleteText}>Delete</Text>
    </TouchableOpacity>
  );

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const setFilter = (k: string, v: any) => setFilters(f => ({ ...f, [k]: v }));

  const handleOpenEbay = (card: Card) => {
    const query = [card.player, card.year, card.brand, card.gradingCo, card.grade]
      .filter(Boolean)
      .join(' ');
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1`;
    Linking.openURL(url);
  };

  // Breakeven calculator with calcBuyPrice
  const calcCostBasisNum = calcBuyPrice ? parseFloat(calcBuyPrice) : 0;
  const calcEbayFeeNum = calcEbayFee ? parseFloat(calcEbayFee) : 13.25;
  const calcShippingNum = calcShipping ? parseFloat(calcShipping) : 5.0;
  const breakEvenTargetNum = breakEvenTargetPrice ? parseFloat(breakEvenTargetPrice) : 0;
  const ebayFeeAmount = (breakEvenTargetNum * calcEbayFeeNum) / 100;
  const netAfterFees = breakEvenTargetNum - ebayFeeAmount - calcShippingNum;
  const profit = netAfterFees - calcCostBasisNum;
  const profitPct = calcCostBasisNum ? ((profit / calcCostBasisNum) * 100).toFixed(1) : '0';

  const calculateBreakeven = () => {
    const costBasis = calcBuyPrice ? parseFloat(calcBuyPrice) : 0;
    const feeDecimal = calcEbayFeeNum / 100;
    const breakeven = (costBasis + calcShippingNum) / (1 - feeDecimal);
    setBreakEvenPrice(breakeven);
    setShowCalcResults(true);
  };

  if (initialLoading && cards.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#9333ea" />
      </View>
    );
  }

  const isEditing = !!form.id;

  const activeFilterCount = [
    filters.sport !== 'all',
    filters.grade !== 'all',
    filters.autosOnly,
    !!filters.minPrice,
    !!filters.maxPrice,
    !!filters.dateFrom,
    !!filters.dateTo,
    sortBy !== 'date-newest',
  ].filter(Boolean).length;

  const filterDropdownHeight = filterAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 420] });
  const filterDropdownOpacity = filterAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] });

  return (
    <View style={styles.container}>
      <ToastComponent />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>MY COLLECTION</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => Share.share({
                message: `Check out my card collection on TopLoad! toploadcards.com/share/${user?.username ?? ''}`,
                url: `https://toploadcards.com/share/${user?.username ?? ''}`,
              })}
            >
              <Ionicons name="share-outline" size={18} color="#f0f0f0" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Stats 2x2 Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statGridCard, styles.statGridCardPurple]}>
          <Text style={styles.statGridLabel}>VALUE</Text>
          <Text style={styles.statGridValue}>{fmt(stats.portfolioValue)}</Text>
        </View>
        <View style={[styles.statGridCard, { borderLeftColor: stats.gainLoss >= 0 ? '#22c55e' : '#ef4444' }]}>
          <Text style={styles.statGridLabel}>TOTAL P&L</Text>
          <Text style={[styles.statGridValue, { color: stats.gainLoss >= 0 ? '#22c55e' : '#ef4444' }]}>
            {stats.gainLoss >= 0 ? '+' : ''}{fmt(stats.gainLoss)}
          </Text>
        </View>
        <View style={styles.statGridCard}>
          <Text style={styles.statGridLabel}>TOTAL CURRENT INVESTED</Text>
          <Text style={styles.statGridValue}>{fmt(stats.totalInvested)}</Text>
        </View>
        <View style={styles.statGridCard}>
          <Text style={styles.statGridLabel}>CARDS</Text>
          <Text style={styles.statGridValue}>{stats.cardsCount}</Text>
        </View>
      </View>

      {/* Search Bar + Sport Dropdown + View Toggle + Filter */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 8 }}>
        <View style={[styles.searchContainer, { flex: 1, marginBottom: 0 }]}>
          <Ionicons name="search" size={16} color="#888888" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search player, brand, set..."
            placeholderTextColor="#888888"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        {/* Sport Dropdown Button */}
        <TouchableOpacity
          style={[styles.sportDropdownBtn, sportPill !== 'ALL' && styles.sportDropdownBtnActive]}
          onPress={() => setShowSportDropdown(true)}
        >
          <Text style={[styles.sportDropdownBtnText, sportPill !== 'ALL' && styles.sportDropdownBtnTextActive]} numberOfLines={1}>
            {sportPill === 'ALL' ? '🃏' : getSportEmoji(sportPill)}
          </Text>
          <Ionicons name="chevron-down" size={12} color={sportPill !== 'ALL' ? '#fff' : '#bbbbbb'} style={{ marginLeft: 2 }} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.viewToggleBtn}
          onPress={() => setViewMode(v => v === 'list' ? 'grid' : 'list')}
        >
          <Ionicons name={viewMode === 'list' ? 'grid' : 'list'} size={18} color="#a855f7" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, (showFilterModal || activeFilterCount > 0) && styles.filterBtnActive]}
          onPress={toggleFilterDropdown}
        >
          <Ionicons name="funnel" size={18} color={showFilterModal || activeFilterCount > 0 ? '#fff' : '#a855f7'} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Inline Filter Dropdown */}
      {showFilterModal && (
        <Animated.View style={[styles.filterDropdownWrap, { maxHeight: filterDropdownHeight, opacity: filterDropdownOpacity }]}>
          <ScrollView
            style={styles.filterDropdownScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {/* ── Sort ── */}
            <Text style={styles.fdLabel}>SORT BY</Text>
            <View style={styles.fdPillRow}>
              {[
                { label: 'Value ↓', value: 'value-high' },
                { label: 'Value ↑', value: 'value-low' },
                { label: 'Name A→Z', value: 'player-az' },
                { label: 'Name Z→A', value: 'player-za' },
                { label: 'Buy ↓', value: 'buy-high' },
                { label: 'Buy ↑', value: 'buy-low' },
                { label: 'Gain ↓', value: 'gain-high' },
                { label: 'Gain ↑', value: 'gain-low' },
                { label: 'Newest', value: 'date-newest' },
                { label: 'Oldest', value: 'date-oldest' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.fdPill, sortBy === opt.value && styles.fdPillActive]}
                  onPress={() => setSortBy(sortBy === opt.value ? 'date-newest' : opt.value)}
                >
                  <Text style={[styles.fdPillText, sortBy === opt.value && styles.fdPillTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Sport ── */}
            <Text style={styles.fdLabel}>SPORT</Text>
            <View style={styles.fdPillRow}>
              {[{ label: 'All', value: 'all' }, ...TOP_SPORTS.map(s => ({ label: `${s.emoji} ${s.label}`, value: s.label }))].map(s => (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.fdPill, filters.sport === s.value && styles.fdPillActive]}
                  onPress={() => setFilter('sport', filters.sport === s.value && s.value !== 'all' ? 'all' : s.value)}
                >
                  <Text style={[styles.fdPillText, filters.sport === s.value && styles.fdPillTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Grade ── */}
            <Text style={styles.fdLabel}>GRADE</Text>
            <View style={styles.fdPillRow}>
              {([
                { label: 'All', value: 'all' },
                { label: 'Graded', value: 'graded' },
                { label: 'Raw', value: 'raw' },
              ] as const).map(g => (
                <TouchableOpacity
                  key={g.value}
                  style={[styles.fdPill, filters.grade === g.value && styles.fdPillActive]}
                  onPress={() => setFilter('grade', filters.grade === g.value && g.value !== 'all' ? 'all' : g.value)}
                >
                  <Text style={[styles.fdPillText, filters.grade === g.value && styles.fdPillTextActive]}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Options ── */}
            <Text style={styles.fdLabel}>OPTIONS</Text>
            <View style={styles.fdPillRow}>
              <TouchableOpacity
                style={[styles.fdPill, filters.autosOnly && styles.fdPillActive]}
                onPress={() => setFilter('autosOnly', !filters.autosOnly)}
              >
                <Text style={[styles.fdPillText, filters.autosOnly && styles.fdPillTextActive]}>✍️ Autos Only</Text>
              </TouchableOpacity>
            </View>

            {/* ── Price Range ── */}
            <Text style={styles.fdLabel}>PRICE RANGE (VALUE)</Text>
            <View style={styles.fdPriceRow}>
              <TextInput
                style={styles.fdPriceInput}
                placeholder="Min $"
                placeholderTextColor="#888888"
                keyboardType="decimal-pad"
                value={filters.minPrice}
                onChangeText={v => setFilter('minPrice', v)}
              />
              <Text style={{ color: '#888888', fontSize: 14 }}>—</Text>
              <TextInput
                style={styles.fdPriceInput}
                placeholder="Max $"
                placeholderTextColor="#888888"
                keyboardType="decimal-pad"
                value={filters.maxPrice}
                onChangeText={v => setFilter('maxPrice', v)}
              />
            </View>

            {/* ── Date Purchased ── */}
            <Text style={styles.fdLabel}>DATE PURCHASED</Text>
            <View style={styles.fdPriceRow}>
              <TouchableOpacity
                style={[styles.fdDateBtn, !!filters.dateFrom && styles.fdDateBtnActive]}
                onPress={() => setShowFilterFromCalendar(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={13} color={filters.dateFrom ? '#a855f7' : '#888888'} />
                <Text style={[styles.fdDateText, !!filters.dateFrom && styles.fdDateTextActive]}>
                  {filters.dateFrom || 'From'}
                </Text>
                {filters.dateFrom ? (
                  <TouchableOpacity onPress={() => setFilter('dateFrom', '')} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                    <Ionicons name="close-circle" size={13} color="#666" />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
              <Text style={{ color: '#333', fontSize: 14 }}>—</Text>
              <TouchableOpacity
                style={[styles.fdDateBtn, !!filters.dateTo && styles.fdDateBtnActive]}
                onPress={() => setShowFilterToCalendar(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={13} color={filters.dateTo ? '#a855f7' : '#888888'} />
                <Text style={[styles.fdDateText, !!filters.dateTo && styles.fdDateTextActive]}>
                  {filters.dateTo || 'To'}
                </Text>
                {filters.dateTo ? (
                  <TouchableOpacity onPress={() => setFilter('dateTo', '')} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                    <Ionicons name="close-circle" size={13} color="#666" />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </View>
            <CalendarPicker visible={showFilterFromCalendar} value={filters.dateFrom} onSelect={v => setFilter('dateFrom', v)} onClose={() => setShowFilterFromCalendar(false)} />
            <CalendarPicker visible={showFilterToCalendar} value={filters.dateTo} onSelect={v => setFilter('dateTo', v)} onClose={() => setShowFilterToCalendar(false)} />

            {/* ── Actions ── */}
            <View style={styles.fdActions}>
              <TouchableOpacity
                style={styles.fdClearBtn}
                onPress={() => { setFilters({ sport: 'all', grade: 'all', autosOnly: false, minPrice: '', maxPrice: '', dateFrom: '', dateTo: '' }); setSortBy('value-high'); }}
              >
                <Text style={styles.fdClearText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.fdApplyBtn} onPress={closeFilterDropdown}>
                <Text style={styles.fdApplyText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 8 }} />
          </ScrollView>
        </Animated.View>
      )}

      {/* Sport Dropdown Modal */}
      <Modal visible={showSportDropdown} transparent animationType="fade" onRequestClose={() => setShowSportDropdown(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }} activeOpacity={1} onPress={() => setShowSportDropdown(false)}>
          <View style={styles.sportDropdownModal}>
            <View style={styles.sportDropdownHeader}>
              <Text style={styles.sportDropdownTitle}>Filter by Sport</Text>
              <TouchableOpacity onPress={() => setShowSportDropdown(false)}>
                <Ionicons name="close" size={20} color="#bbbbbb" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {sportPills.map(sp => (
                <TouchableOpacity
                  key={sp}
                  style={styles.sportDropdownItem}
                  onPress={() => { setSportPill(sp); setShowSportDropdown(false); }}
                >
                  <Text style={styles.sportDropdownItemEmoji}>
                    {sp === 'ALL' ? '🃏' : getSportEmoji(sp)}
                  </Text>
                  <Text style={[styles.sportDropdownItemText, sportPill === sp && styles.sportDropdownItemTextActive]}>
                    {sp === 'ALL' ? 'All Sports' : sp}
                  </Text>
                  {sportPill === sp && (
                    <Ionicons name="checkmark" size={18} color="#9333ea" style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Status Toggle */}
      <View style={styles.statusToggleContainer}>
        {(['active', 'sold', 'all'] as const).map(status => (
          <TouchableOpacity
            key={status}
            style={[styles.statusToggleBtn, statusFilter === status && styles.statusToggleBtnActive]}
            onPress={() => setStatusFilter(status)}
          >
            <Text style={[styles.statusToggleBtnText, statusFilter === status && styles.statusToggleBtnTextActive]}>
              {status === 'active' ? 'Active' : status === 'sold' ? 'Sold' : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Card List / Grid */}
      <FlatList
        key={`${viewMode}-${sportPill}`}
        data={filtered}
        keyExtractor={c => c.id}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? { gap: 10, paddingHorizontal: 14 } : undefined}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} tintColor="#9333ea" />
        }
        contentContainerStyle={{ paddingHorizontal: viewMode === 'list' ? 16 : 0, paddingBottom: insets.bottom + 140 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🃏</Text>
            <Text style={styles.emptyText}>No cards</Text>
            <Text style={styles.emptySubtext}>Tap + to add your first card</Text>
          </View>
        }
        renderItem={({ item: card }) => {
          // For sold cards use soldPrice, for active cards use val
          const effectiveVal = (card.sold && card.soldPrice != null) ? (card.soldPrice || 0) : (card.val || 0);
          const gain = effectiveVal - (card.buy || 0);
          const gainPct = card.buy ? ((gain / card.buy) * 100).toFixed(0) : '0';
          const isGain = gain >= 0;

          const isSelected = selectedIds.has(card.id);

          if (viewMode === 'grid') {
            const cardContent = (
              <TouchableOpacity
                style={[styles.gridCard, { marginBottom: 0 }, isSelected && styles.cardSelected]}
                onPress={() => selectionMode ? toggleSelect(card.id) : handleEdit(card)}
                onLongPress={() => !selectionMode && enterSelectionMode(card.id)}
                delayLongPress={400}
                activeOpacity={0.8}
              >
                  {/* Header band: accent bar + grade + G/L badge */}
                  <View style={styles.gridHeaderBand}>
                    <View style={[styles.gridAccentBar, { backgroundColor: isGain ? '#22c55e' : '#ef4444' }]} />
                    <View style={styles.gridHeaderRow}>
                      {card.grade ? (
                        <View style={styles.gridGradePill}>
                          <Text style={styles.gridGradePillText}>{card.gradingCo ? `${card.gradingCo} ` : ''}{card.grade}</Text>
                        </View>
                      ) : (
                        <View style={styles.gridGradePill}>
                          <Text style={styles.gridGradePillText}>RAW</Text>
                        </View>
                      )}
                      <View style={[styles.gridGainPill, { backgroundColor: isGain ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' }]}>
                        <Text style={[styles.gridGainPillText, { color: isGain ? '#22c55e' : '#ef4444' }]}>
                          {card.sold
                            ? `${isGain ? '+' : ''}${fmt(gain)}`
                            : `${isGain ? '+' : ''}${gainPct}%`}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.gridCardInfo}>
                    <Text style={styles.gridCardPlayer} numberOfLines={2}>{card.player || ''}</Text>
                    {cardSetLine(card) ? (
                      <Text style={styles.gridCardSubtitle} numberOfLines={1}>{cardSetLine(card)}</Text>
                    ) : null}
                    {card.auto ? (
                      <Text style={styles.gridCardAttr}>✍️ AUTO</Text>
                    ) : null}
                    <View style={styles.gridCardPrices}>
                      <View>
                        <Text style={styles.gridPriceLabel}>PAID</Text>
                        <Text style={styles.gridPriceVal}>{fmt(card.buy || 0)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.gridPriceLabel}>{card.sold ? 'SOLD' : 'VAL'}</Text>
                        <Text style={styles.gridPriceVal}>{fmt(card.sold && card.soldPrice != null ? (card.soldPrice || 0) : (card.val || 0))}</Text>
                      </View>
                    </View>
                    {!selectionMode && (
                      <View>
                        {/* Primary row: eBay · Edit · Tools */}
                        <View style={styles.gridCardActions}>
                          <TouchableOpacity style={styles.gridActionBtn} onPress={() => handleOpenEbay(card)}>
                            <Ionicons name="search" size={11} color="#bbbbbb" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.gridActionBtn} onPress={() => handleEdit(card)}>
                            <Ionicons name="pencil" size={11} color="#bbbbbb" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.gridActionBtn, toolsOpenId === card.id && { backgroundColor: '#2a2a2a' }]}
                            onPress={() => setToolsOpenId(toolsOpenId === card.id ? null : card.id)}
                          >
                            <Ionicons name="ellipsis-horizontal" size={11} color={toolsOpenId === card.id ? '#a855f7' : '#bbbbbb'} />
                          </TouchableOpacity>
                        </View>
                        {/* Tools dropdown */}
                        {toolsOpenId === card.id && (
                          <View style={styles.gridToolsMenu}>
                            <TouchableOpacity style={styles.gridToolsItem} onPress={() => { setToolsOpenId(null); setSellCard(card); setSellPrice(String(card.val || '')); setSellDate(new Date().toISOString().split('T')[0]); setShowSellModal(true); }}>
                              <Ionicons name="pricetag" size={11} color="#d97706" />
                              <Text style={styles.gridToolsText}>Sell</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.gridToolsItem} onPress={() => { setToolsOpenId(null); setCalcBuyPrice(String(card.buy || 0)); setCalcCardName(card.player); setBreakEvenPrice(null); setBreakEvenTargetPrice(''); setCalcEbayFee('13.25'); setCalcShipping('5.00'); setShowCalcResults(false); setShowBreakevenModal(true); }}>
                              <Ionicons name="calculator" size={11} color="#a855f7" />
                              <Text style={styles.gridToolsText}>Calc</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.gridToolsItem} onPress={() => { setToolsOpenId(null); handleDelete(card.id); }}>
                              <Ionicons name="trash" size={11} color="#ef4444" />
                              <Text style={[styles.gridToolsText, { color: '#ef4444' }]}>Delete</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  {/* Selection checkmark overlay */}
                  {selectionMode && (
                    <View style={styles.selectionOverlay}>
                      <View style={[styles.selectionCheck, isSelected && styles.selectionCheckActive]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
            );

            return selectionMode ? cardContent : (
              <Swipeable
                ref={ref => { swipeRefs.current[card.id] = ref; }}
                renderRightActions={() => renderDeleteAction(card.id)}
                onSwipeableOpen={() => closeOtherSwipeables(card.id)}
                overshootRight={false}
                rightThreshold={50}
                containerStyle={{ width: GRID_CARD_W, marginBottom: 10 }}
              >
                {cardContent}
              </Swipeable>
            );
          }

          // List view
          const listCardInner = (
            <TouchableOpacity
              activeOpacity={selectionMode ? 0.7 : 1}
              onPress={() => selectionMode && toggleSelect(card.id)}
              onLongPress={() => !selectionMode && enterSelectionMode(card.id)}
              delayLongPress={400}
            >
              <View style={[styles.cardRow, isSelected && styles.cardSelected]}>
                {/* Top row: name + meta + badge */}
                <View style={styles.cardTopRow}>
                  <View style={styles.cardNameArea}>
                    <Text style={styles.cardPlayer} numberOfLines={1}>{card.player}</Text>
                    {cardSetLine(card) ? (
                      <Text style={styles.cardMetaSet} numberOfLines={1}>{cardSetLine(card)}</Text>
                    ) : null}
                    {(card.sport || cardAttrLine(card)) ? (
                      <Text style={styles.cardMetaAttr} numberOfLines={1}>
                        {[card.sport, cardAttrLine(card)].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>{card.sold ? 'SOLD' : 'ACTIVE'}</Text>
                  </View>
                </View>

                {/* Stats + action buttons on same row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {/* Stats */}
                  <View style={[styles.cardStatsRow, { flex: 1, marginBottom: 0 }]}>
                    <View style={styles.cardStat}>
                      <Text style={styles.cardStatLabel}>PAID</Text>
                      <Text style={styles.cardStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{fmt(card.buy || 0)}</Text>
                    </View>
                    <View style={styles.cardStat}>
                      <Text style={styles.cardStatLabel}>{card.sold ? 'SOLD FOR' : 'VALUE'}</Text>
                      <Text style={styles.cardStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{fmt(card.sold && card.soldPrice != null ? (card.soldPrice || 0) : (card.val || 0))}</Text>
                    </View>
                    <View style={styles.cardStat}>
                      <Text style={styles.cardStatLabel}>G/L</Text>
                      <Text style={[styles.cardStatValue, { color: isGain ? '#22c55e' : '#ef4444' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                        {card.sold
                          ? `${isGain ? '+' : ''}${fmt(gain)}`
                          : `${isGain ? '+' : ''}${gainPct}%`}
                      </Text>
                    </View>
                  </View>

                  {/* Action buttons — hidden during selection mode */}
                  {!selectionMode && (
                    <View style={{ gap: 4 }}>
                      {/* Primary row: eBay · Edit · Tools */}
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <TouchableOpacity style={[styles.cardActionBtn, styles.cardActionBtnPurple, { flex: 0, paddingHorizontal: 10 }]} onPress={() => handleOpenEbay(card)}>
                          <Ionicons name="search" size={12} color="#fff" />
                          <Text style={styles.cardActionBtnText}>eBay</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.cardActionBtn, styles.cardActionBtnDark, { flex: 0, paddingHorizontal: 10 }]} onPress={() => handleEdit(card)}>
                          <Ionicons name="pencil" size={12} color="#aaa" />
                          <Text style={[styles.cardActionBtnText, { color: '#aaa' }]}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.cardActionBtn, styles.cardActionBtnDark, { flex: 0, paddingHorizontal: 10 }, toolsOpenId === card.id && { backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#9333ea' }]}
                          onPress={() => setToolsOpenId(toolsOpenId === card.id ? null : card.id)}
                        >
                          <Ionicons name="ellipsis-horizontal" size={12} color={toolsOpenId === card.id ? '#a855f7' : '#bbbbbb'} />
                          <Text style={[styles.cardActionBtnText, { color: toolsOpenId === card.id ? '#a855f7' : '#bbbbbb' }]}>Tools</Text>
                        </TouchableOpacity>
                      </View>
                      {/* Tools dropdown */}
                      {toolsOpenId === card.id && (
                        <View style={styles.listToolsMenu}>
                          <TouchableOpacity style={styles.listToolsItem} onPress={() => { setToolsOpenId(null); setSellCard(card); setSellPrice(String(card.val || '')); setSellDate(new Date().toISOString().split('T')[0]); setShowSellModal(true); }}>
                            <Ionicons name="pricetag" size={13} color="#d97706" />
                            <Text style={styles.listToolsText}>Sell</Text>
                          </TouchableOpacity>
                          <View style={styles.listToolsDivider} />
                          <TouchableOpacity style={styles.listToolsItem} onPress={() => { setToolsOpenId(null); setCalcBuyPrice(String(card.buy || 0)); setCalcCardName(card.player); setBreakEvenPrice(null); setBreakEvenTargetPrice(''); setCalcEbayFee('13.25'); setCalcShipping('5.00'); setShowCalcResults(false); setShowBreakevenModal(true); }}>
                            <Ionicons name="calculator" size={13} color="#a855f7" />
                            <Text style={styles.listToolsText}>Breakeven Calc</Text>
                          </TouchableOpacity>
                          <View style={styles.listToolsDivider} />
                          <TouchableOpacity style={styles.listToolsItem} onPress={() => { setToolsOpenId(null); handleDelete(card.id); }}>
                            <Ionicons name="trash" size={13} color="#ef4444" />
                            <Text style={[styles.listToolsText, { color: '#ef4444' }]}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Selection checkmark — visible during selection mode */}
                  {selectionMode && (
                    <View style={[styles.selectionCheck, isSelected && styles.selectionCheckActive]}>
                      {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );

          return selectionMode ? listCardInner : (
            <Swipeable
              ref={ref => { swipeRefs.current[card.id] = ref; }}
              renderRightActions={() => renderDeleteAction(card.id)}
              onSwipeableOpen={() => closeOtherSwipeables(card.id)}
              overshootRight={false}
              rightThreshold={60}
            >
              {listCardInner}
            </Swipeable>
          );
        }}
      />

      {/* Multi-select action bar */}
      {selectionMode && (
        <View style={[styles.selectionBar, { bottom: insets.bottom + 72 }]}>
          <TouchableOpacity style={styles.selectionCancelBtn} onPress={exitSelectionMode}>
            <Ionicons name="close" size={18} color="#aaa" />
            <Text style={styles.selectionCancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.selectionCount}>
            {selectedIds.size} selected
          </Text>
          <TouchableOpacity
            style={[styles.selectionDeleteBtn, selectedIds.size === 0 && { opacity: 0.4 }]}
            onPress={handleBulkDelete}
            disabled={selectedIds.size === 0}
          >
            <Ionicons name="trash" size={16} color="#fff" />
            <Text style={styles.selectionDeleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FAB — hidden during selection mode, floats above tab bar */}
      {!selectionMode && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 72 }]}
          onPress={() => { setForm({ ...EMPTY_FORM }); setShowMoreDetails(false); setShowSportPickerInline(false); setShowGradePicker(false); setShowGradingCoPicker(false); setShowAddModal(true); }}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Add/Edit Card Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">

            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEditing ? 'Edit Card' : 'Quick Add'}</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#888888" />
              </TouchableOpacity>
            </View>

            {formError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{formError}</Text>
              </View>
            ) : null}

            {/* ── QUICK FIELDS ── */}

            <Text style={styles.fieldLabel}>PLAYER NAME *</Text>
            <TextInput
              style={styles.input}
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
                  <Text style={[styles.sportLabel, form.sport === s.label && styles.sportLabelActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* More sports — inline accordion (nested Modals don't work on iOS) */}
            <TouchableOpacity
              style={[
                styles.moreSportPickerBtn,
                (form.sport && !TOP_SPORTS.find(s => s.label === form.sport)) && styles.moreSportPickerBtnActive,
                showSportPickerInline && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomColor: 'transparent' },
              ]}
              onPress={() => {
                setShowSportPickerInline(v => !v);
                setShowGradePicker(false);
                setShowGradingCoPicker(false);
              }}
            >
              <Text style={[
                styles.moreSportPickerText,
                (form.sport && !TOP_SPORTS.find(s => s.label === form.sport)) && { color: '#a855f7' },
              ]}>
                {form.sport && !TOP_SPORTS.find(s => s.label === form.sport)
                  ? `${getSportEmoji(form.sport)}  ${form.sport}`
                  : 'More sports / TCG...'}
              </Text>
              <Ionicons name={showSportPickerInline ? 'chevron-up' : 'chevron-down'} size={16} color="#888888" />
            </TouchableOpacity>
            {showSportPickerInline && (
              <View style={styles.inlinePickerList}>
                {form.sport && !TOP_SPORTS.find(s => s.label === form.sport) && (
                  <TouchableOpacity
                    style={styles.inlinePickerItem}
                    onPress={() => { set('sport', ''); setShowSportPickerInline(false); }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Ionicons name="close-circle-outline" size={20} color="#888888" />
                      <Text style={{ color: '#888888', fontSize: 14, fontWeight: '600' }}>Clear selection</Text>
                    </View>
                  </TouchableOpacity>
                )}
                {MORE_SPORTS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={styles.inlinePickerItem}
                    onPress={() => { set('sport', s); setShowSportPickerInline(false); }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                      <Text style={{ fontSize: 20 }}>{getSportEmoji(s)}</Text>
                      <Text style={{ color: form.sport === s ? '#a855f7' : '#ccc', fontSize: 15, fontWeight: '500' }}>{s}</Text>
                    </View>
                    {form.sport === s && <Ionicons name="checkmark" size={18} color="#a855f7" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Autograph */}
            <TouchableOpacity
              style={[styles.autoRow, form.auto && styles.autoRowActive]}
              onPress={() => set('auto', !form.auto)}
            >
              <View style={[styles.checkbox, form.auto && styles.checkboxActive]}>
                {form.auto && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <View>
                <Text style={[styles.autoLabel, form.auto && { color: '#ffbe2e' }]}>Autograph ✍️</Text>
                <Text style={styles.autoSub}>This card has an auto</Text>
              </View>
            </TouchableOpacity>

            {/* Buy + Value */}
            <View style={styles.row2}>
              <View style={styles.half}>
                <Text style={styles.fieldLabel}>BUY PRICE ($)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor="#888888"
                  keyboardType="decimal-pad"
                  value={form.buy}
                  onChangeText={v => set('buy', v)}
                />
              </View>
              <View style={styles.half}>
                <Text style={styles.fieldLabel}>CURRENT VALUE ($)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor="#888888"
                  keyboardType="decimal-pad"
                  value={form.val}
                  onChangeText={v => set('val', v)}
                />
              </View>
            </View>

            {/* Quantity + Purchase Date row */}
            <View style={styles.row2}>
              <View style={{ width: '40%' }}>
                <Text style={styles.fieldLabel}>QUANTITY</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  placeholderTextColor="#888888"
                  keyboardType="number-pad"
                  value={form.qty}
                  onChangeText={v => set('qty', v)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>DATE PURCHASED</Text>
                <TouchableOpacity
                  style={[styles.input, styles.datePickerBtn]}
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

            {/* ── MORE DETAILS TOGGLE ── */}
            <TouchableOpacity
              style={styles.moreDetailsBtn}
              onPress={() => setShowMoreDetails(v => !v)}
            >
              <Ionicons name={showMoreDetails ? 'chevron-up' : 'chevron-down'} size={15} color="#666" />
              <Text style={styles.moreDetailsBtnText}>
                {showMoreDetails ? 'Less details' : 'More details (year, set, brand, numbering...)'}
              </Text>
            </TouchableOpacity>

            {/* ── COLLAPSIBLE EXTRA FIELDS ── */}
            {showMoreDetails && (
              <View>
                {/* Grade dropdown */}
                <Text style={styles.fieldLabel}>GRADE</Text>
                <TouchableOpacity
                  style={[styles.dropdownBtn, showGradePicker && styles.dropdownBtnOpen]}
                  onPress={() => { setShowGradePicker(v => !v); setShowGradingCoPicker(false); setShowSportPickerInline(false); }}
                >
                  <Text style={styles.dropdownBtnText}>{form.grade || 'Raw / No grade'}</Text>
                  <Ionicons name={showGradePicker ? 'chevron-up' : 'chevron-down'} size={16} color="#888888" />
                </TouchableOpacity>
                {showGradePicker && (
                  <View style={[styles.inlinePickerList, { marginTop: -14, marginBottom: 14 }]}>
                    <TouchableOpacity
                      style={styles.inlinePickerItem}
                      onPress={() => { set('grade', ''); setShowGradePicker(false); }}
                    >
                      <Text style={{ color: !form.grade ? '#a855f7' : '#ccc', fontSize: 14 }}>Raw / No grade</Text>
                      {!form.grade && <Ionicons name="checkmark" size={16} color="#a855f7" />}
                    </TouchableOpacity>
                    {GRADES.filter(g => g !== 'Raw').map(g => (
                      <TouchableOpacity
                        key={g}
                        style={styles.inlinePickerItem}
                        onPress={() => { set('grade', g); setShowGradePicker(false); }}
                      >
                        <Text style={{ color: form.grade === g ? '#a855f7' : '#ccc', fontSize: 14 }}>{g}</Text>
                        {form.grade === g && <Ionicons name="checkmark" size={16} color="#a855f7" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Grading Co dropdown */}
                <Text style={styles.fieldLabel}>GRADING COMPANY</Text>
                <TouchableOpacity
                  style={[styles.dropdownBtn, showGradingCoPicker && styles.dropdownBtnOpen]}
                  onPress={() => { setShowGradingCoPicker(v => !v); setShowGradePicker(false); setShowSportPickerInline(false); }}
                >
                  <Text style={styles.dropdownBtnText}>{form.gradingCo || 'No grading co.'}</Text>
                  <Ionicons name={showGradingCoPicker ? 'chevron-up' : 'chevron-down'} size={16} color="#888888" />
                </TouchableOpacity>
                {showGradingCoPicker && (
                  <View style={[styles.inlinePickerList, { marginTop: -14, marginBottom: 14 }]}>
                    <TouchableOpacity
                      style={styles.inlinePickerItem}
                      onPress={() => { set('gradingCo', ''); setShowGradingCoPicker(false); }}
                    >
                      <Text style={{ color: !form.gradingCo ? '#a855f7' : '#ccc', fontSize: 14 }}>No grading co.</Text>
                      {!form.gradingCo && <Ionicons name="checkmark" size={16} color="#a855f7" />}
                    </TouchableOpacity>
                    {GRADING_COS.map(g => (
                      <TouchableOpacity
                        key={g}
                        style={styles.inlinePickerItem}
                        onPress={() => { set('gradingCo', g); setShowGradingCoPicker(false); }}
                      >
                        <Text style={{ color: form.gradingCo === g ? '#a855f7' : '#ccc', fontSize: 14 }}>{g}</Text>
                        {form.gradingCo === g && <Ionicons name="checkmark" size={16} color="#a855f7" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <View style={styles.row2}>
                  <View style={styles.half}>
                    <Text style={styles.fieldLabel}>YEAR</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 2023"
                      placeholderTextColor="#888888"
                      keyboardType="number-pad"
                      value={form.year}
                      onChangeText={v => set('year', v)}
                    />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.fieldLabel}>CARD NUMBER</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 10/50"
                      placeholderTextColor="#888888"
                      value={form.num}
                      onChangeText={v => set('num', v)}
                    />
                  </View>
                </View>

                <View style={styles.row2}>
                  <View style={styles.half}>
                    <Text style={styles.fieldLabel}>SET / PRODUCT</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Topps Chrome"
                      placeholderTextColor="#888888"
                      value={form.name}
                      onChangeText={v => set('name', v)}
                    />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.fieldLabel}>BRAND</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Topps"
                      placeholderTextColor="#888888"
                      value={form.brand}
                      onChangeText={v => set('brand', v)}
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>CONDITION</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  {CONDS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.pill, form.cond === c && styles.pillActive]}
                      onPress={() => set('cond', form.cond === c ? '' : c)}
                    >
                      <Text style={[styles.pillText, form.cond === c && styles.pillTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.fieldLabel}>NOTES</Text>
                <TextInput
                  style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                  placeholder="Any extra details..."
                  placeholderTextColor="#888888"
                  multiline
                  value={form.notes}
                  onChangeText={v => set('notes', v)}
                />

                {isEditing && (
                  <View>
                    <Text style={styles.fieldLabel}>SOLD STATUS</Text>
                    <TouchableOpacity
                      style={[styles.autoRow, form.sold && { borderColor: 'rgba(34,197,94,0.3)', backgroundColor: 'rgba(34,197,94,0.05)' }]}
                      onPress={() => set('sold', !form.sold)}
                    >
                      <View style={[styles.checkbox, form.sold && { backgroundColor: '#22c55e', borderColor: '#22c55e' }]}>
                        {form.sold && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                      <Text style={[styles.autoLabel, form.sold && { color: '#22c55e' }]}>Mark as Sold</Text>
                    </TouchableOpacity>
                    {form.sold && (
                      <View style={styles.row2}>
                        <View style={styles.half}>
                          <Text style={styles.fieldLabel}>SOLD PRICE ($)</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="0.00"
                            placeholderTextColor="#888888"
                            keyboardType="decimal-pad"
                            value={form.soldPrice}
                            onChangeText={v => set('soldPrice', v)}
                          />
                        </View>
                        <View style={styles.half}>
                          <Text style={styles.fieldLabel}>SOLD DATE</Text>
                          <TouchableOpacity
                            style={[styles.input, styles.datePickerBtn]}
                            onPress={() => setShowFormCalendar(true)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="calendar-outline" size={16} color={form.soldDate ? '#a855f7' : '#888888'} />
                            <Text style={[styles.datePickerText, !form.soldDate && { color: '#888888' }]}>
                              {form.soldDate || 'Select'}
                            </Text>
                          </TouchableOpacity>
                          <CalendarPicker visible={showFormCalendar} value={form.soldDate} onSelect={v => set('soldDate', v)} onClose={() => setShowFormCalendar(false)} />
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Save button */}
            <TouchableOpacity
              style={[styles.saveBtn, { marginTop: 16 }, (!form.player || saving) && styles.saveBtnDisabled]}
              onPress={handleSaveCard}
              disabled={!form.player || saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{isEditing ? 'Update Card' : '+ Add Card'}</Text>
              )}
            </TouchableOpacity>

            {isEditing && (
              <TouchableOpacity
                style={styles.deleteBtnModal}
                onPress={() => { setShowAddModal(false); handleDelete(form.id); }}
              >
                <Text style={styles.deleteBtnModalText}>Delete Card</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sell Modal */}
      <Modal visible={showSellModal} transparent animationType="slide" onRequestClose={() => setShowSellModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHandle} />
            <View style={styles.bottomSheetContent}>

              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Mark as Sold</Text>
                <TouchableOpacity onPress={() => setShowSellModal(false)}>
                  <Ionicons name="close" size={24} color="#888888" />
                </TouchableOpacity>
              </View>

              {/* Card info summary */}
              {sellCard && (
                <View style={styles.sellCardSummary}>
                  <Text style={styles.sellCardName} numberOfLines={1}>{sellCard.player}</Text>
                  {cardSetLine(sellCard) ? (
                    <Text style={styles.sellCardMeta} numberOfLines={1}>{cardSetLine(sellCard)}</Text>
                  ) : null}
                  <View style={styles.sellCardStats}>
                    <View style={styles.sellCardStat}>
                      <Text style={styles.sellCardStatLabel}>PAID</Text>
                      <Text style={styles.sellCardStatValue}>{fmt(sellCard.buy || 0)}</Text>
                    </View>
                    <View style={styles.sellCardStat}>
                      <Text style={styles.sellCardStatLabel}>CURRENT VALUE</Text>
                      <Text style={[styles.sellCardStatValue, { color: '#9333ea' }]}>{fmt(sellCard.val || 0)}</Text>
                    </View>
                  </View>
                </View>
              )}

              <Text style={styles.fieldLabel}>SOLD PRICE ($)</Text>
              <TextInput
                style={[styles.input, { fontSize: 20, fontWeight: '800', textAlign: 'center' }]}
                placeholder="0.00"
                placeholderTextColor="#333"
                keyboardType="decimal-pad"
                value={sellPrice}
                onChangeText={setSellPrice}
              />

              {/* Sold Date */}
              <Text style={[styles.fieldLabel, { marginTop: 14, marginBottom: 6 }]}>SOLD DATE <Text style={{ color: '#ef4444' }}>*</Text></Text>
              <TouchableOpacity
                style={[styles.input, styles.datePickerBtn, !sellDate && { borderColor: '#3a1a1a' }]}
                onPress={() => setShowSellCalendar(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={16} color={sellDate ? '#a855f7' : '#888888'} />
                <Text style={[styles.datePickerText, !sellDate && { color: '#888888' }]}>
                  {sellDate || 'Select date'}
                </Text>
              </TouchableOpacity>
              {!sellDate ? (
                <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '600', marginBottom: 10, marginTop: 4 }}>Required to track on chart</Text>
              ) : null}
              <CalendarPicker visible={showSellCalendar} value={sellDate} onSelect={setSellDate} onClose={() => setShowSellCalendar(false)} />

              {/* Profit preview */}
              {sellCard && sellPrice ? (
                <View style={styles.sellProfit}>
                  {(() => {
                    const profit = parseFloat(sellPrice) - (sellCard.buy || 0);
                    const isPos = profit >= 0;
                    return (
                      <>
                        <Text style={styles.sellProfitLabel}>
                          {isPos ? '↗ Profit' : '↘ Loss'}
                        </Text>
                        <Text style={[styles.sellProfitValue, { color: isPos ? '#22c55e' : '#ef4444' }]}>
                          {isPos ? '+' : ''}{fmt(profit)}
                        </Text>
                      </>
                    );
                  })()}
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.saveBtn, (sellSaving || !sellPrice || !sellDate) && styles.saveBtnDisabled]}
                disabled={sellSaving || !sellPrice || !sellDate}
                onPress={async () => {
                  if (!sellCard || !sellPrice || !sellDate) return;
                  setSellSaving(true);
                  try {
                    await api.updateCard({
                      id: sellCard.id,
                      player: sellCard.player,
                      buy: sellCard.buy,
                      val: sellCard.val,
                      sold: true,
                      soldPrice: parseFloat(sellPrice),
                      soldDate: sellDate,
                    });
                    setShowSellModal(false);
                    setSellCard(null);
                    setSellPrice('');
                    setSellDate('');
                    emitDataChanged();
                  } catch {
                    Alert.alert('Error', 'Failed to mark card as sold');
                  } finally {
                    setSellSaving(false);
                  }
                }}
              >
                {sellSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Confirm Sale</Text>}
              </TouchableOpacity>
              <View style={{ height: 16 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Filter Modal */}
      {/* Sort Modal */}
      <Modal visible={showSortModal} transparent animationType="slide" onRequestClose={() => setShowSortModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setShowSortModal(false)} activeOpacity={1} />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHandle} {...sortPanResponder.panHandlers} />
            <ScrollView style={styles.bottomSheetContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Sort By</Text>
              {[
                { label: 'Value High → Low', value: 'value-high' },
                { label: 'Value Low → High', value: 'value-low' },
                { label: 'Name A → Z', value: 'player-az' },
                { label: 'Name Z → A', value: 'player-za' },
                { label: 'Buy Price High → Low', value: 'buy-high' },
                { label: 'Buy Price Low → High', value: 'buy-low' },
                { label: 'Gain High → Low', value: 'gain-high' },
                { label: 'Gain Low → High', value: 'gain-low' },
                { label: 'Date Newest', value: 'date-newest' },
                { label: 'Date Oldest', value: 'date-oldest' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.sortOption}
                  onPress={() => { setSortBy(opt.value); setShowSortModal(false); }}
                >
                  <Text style={[styles.sortOptionText, sortBy === opt.value && styles.sortOptionTextActive]}>
                    {opt.label}
                  </Text>
                  {sortBy === opt.value && <Ionicons name="checkmark" size={18} color="#9333ea" />}
                </TouchableOpacity>
              ))}
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Breakeven Calculator Modal */}
      <Modal visible={showBreakevenModal} transparent animationType="slide" onRequestClose={() => setShowBreakevenModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={[styles.bottomSheet, { maxHeight: '90%' }]}>
              <View style={styles.bottomSheetHandle} />
              <ScrollView style={styles.bottomSheetContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(147,51,234,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="calculator" size={18} color="#a855f7" />
                    </View>
                    <View>
                      <Text style={styles.modalTitle}>Breakeven Calc</Text>
                      {calcCardName ? <Text style={{ color: '#888888', fontSize: 12, marginTop: 1 }} numberOfLines={1}>{calcCardName}</Text> : null}
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setShowBreakevenModal(false)}>
                    <Ionicons name="close" size={24} color="#888888" />
                  </TouchableOpacity>
                </View>

                {/* Cost basis display */}
                <View style={{ backgroundColor: '#0a0a0a', borderRadius: 12, padding: 16, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#888888', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>COST BASIS</Text>
                  <Text style={{ color: '#f0f0f0', fontSize: 22, fontWeight: '900' }}>{fmt(calcCostBasisNum)}</Text>
                </View>

                {/* Target Sell Price — main input */}
                <Text style={[styles.fieldLabel, { fontSize: 10, marginBottom: 8 }]}>TARGET SELL PRICE</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderWidth: 1.5, borderColor: '#9333ea', borderRadius: 12, paddingHorizontal: 14, marginBottom: 18 }}>
                  <Text style={{ color: '#a855f7', fontSize: 18, fontWeight: '800', marginRight: 6 }}>$</Text>
                  <TextInput
                    style={{ flex: 1, color: '#f0f0f0', fontSize: 22, fontWeight: '800', paddingVertical: 14 }}
                    placeholder="0.00"
                    placeholderTextColor="#333"
                    keyboardType="decimal-pad"
                    value={breakEvenTargetPrice}
                    onChangeText={v => { setBreakEvenTargetPrice(v); setShowCalcResults(false); }}
                  />
                </View>

                {/* Fee settings row */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>EBAY FEE %</Text>
                    <TextInput
                      style={[styles.input, { marginBottom: 0 }]}
                      placeholder="13.25"
                      placeholderTextColor="#888888"
                      keyboardType="decimal-pad"
                      value={calcEbayFee}
                      onChangeText={v => { setCalcEbayFee(v); setShowCalcResults(false); }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>SHIPPING $</Text>
                    <TextInput
                      style={[styles.input, { marginBottom: 0 }]}
                      placeholder="5.00"
                      placeholderTextColor="#888888"
                      keyboardType="decimal-pad"
                      value={calcShipping}
                      onChangeText={v => { setCalcShipping(v); setShowCalcResults(false); }}
                    />
                  </View>
                </View>

                {/* Calculate button */}
                <TouchableOpacity
                  style={[styles.saveBtn, { marginBottom: 20 }, (!breakEvenTargetPrice || parseFloat(breakEvenTargetPrice) <= 0) && styles.saveBtnDisabled]}
                  onPress={calculateBreakeven}
                  disabled={!breakEvenTargetPrice || parseFloat(breakEvenTargetPrice) <= 0}
                >
                  <Text style={styles.saveBtnText}>Calculate</Text>
                </TouchableOpacity>

                {/* Results card — only shown after Calculate is tapped */}
                {showCalcResults && breakEvenPrice !== null && (
                  <View style={{ backgroundColor: '#0a0a0a', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 10 }}>

                    {/* Breakeven highlight */}
                    <View style={{ alignItems: 'center', marginBottom: 18, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' }}>
                      <Text style={{ color: '#888888', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 }}>BREAK EVEN PRICE</Text>
                      <Text style={{ color: '#a855f7', fontSize: 36, fontWeight: '900' }}>{fmt(breakEvenPrice)}</Text>
                      <Text style={{ color: '#888888', fontSize: 11, marginTop: 4 }}>
                        {breakEvenTargetNum >= breakEvenPrice ? 'Above breakeven ✓' : 'Below breakeven ✗'}
                      </Text>
                    </View>

                    {/* Fee breakdown rows */}
                    <View style={styles.breakEvenRow}>
                      <Text style={styles.breakEvenLabel}>Sell Price</Text>
                      <Text style={styles.breakEvenValue}>{fmt(breakEvenTargetNum)}</Text>
                    </View>
                    <View style={styles.breakEvenRow}>
                      <Text style={styles.breakEvenLabel}>eBay Fee ({calcEbayFeeNum}%)</Text>
                      <Text style={[styles.breakEvenValue, { color: '#ef4444' }]}>−{fmt(ebayFeeAmount)}</Text>
                    </View>
                    <View style={styles.breakEvenRow}>
                      <Text style={styles.breakEvenLabel}>Shipping</Text>
                      <Text style={[styles.breakEvenValue, { color: '#ef4444' }]}>−{fmt(calcShippingNum)}</Text>
                    </View>
                    <View style={styles.breakEvenRow}>
                      <Text style={styles.breakEvenLabel}>Net After Fees</Text>
                      <Text style={[styles.breakEvenValue, { color: '#a855f7' }]}>{fmt(netAfterFees)}</Text>
                    </View>
                    <View style={[styles.breakEvenRow, { borderBottomWidth: 0, marginTop: 4 }]}>
                      <Text style={{ color: '#f0f0f0', fontSize: 14, fontWeight: '800' }}>Profit / Loss</Text>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: profit >= 0 ? '#22c55e' : '#ef4444' }}>
                        {profit >= 0 ? '+' : ''}{fmt(profit)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={{ color: '#888888', fontSize: 12 }}>Return</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: profit >= 0 ? '#22c55e' : '#ef4444' }}>
                        {profit >= 0 ? '+' : ''}{profitPct}%
                      </Text>
                    </View>

                    {/* Status banner */}
                    <View style={{ marginTop: 16, backgroundColor: profit >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: profit >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' }}>
                      <Text style={{ color: profit >= 0 ? '#22c55e' : '#ef4444', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }}>
                        {profit >= 0 ? '✓  YOU PROFIT' : '✗  YOU LOSE MONEY'}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={{ height: 30 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  header: { paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#f0f0f0', fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconBtn: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, padding: 10 },
  addBtn: { backgroundColor: '#9333ea', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  statGridCard: { flex: 1, minWidth: '45%', backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: 'transparent' },
  statGridCardPurple: { borderLeftColor: '#9333ea' },
  statGridLabel: { color: '#888888', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  statGridValue: { color: '#f0f0f0', fontSize: 18, fontWeight: '900' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: '#f0f0f0', fontSize: 14, paddingVertical: 10 },
  filterBtn: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, padding: 10, position: 'relative' },
  filterBtnActive: { backgroundColor: '#3b1d6e', borderColor: '#9333ea' },
  filterBadge: {
    position: 'absolute', top: -5, right: -5,
    backgroundColor: '#9333ea', borderRadius: 8, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Inline filter dropdown
  filterDropdownWrap: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: '#111', borderRadius: 14,
    borderWidth: 1, borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  filterDropdownScroll: { paddingHorizontal: 14, paddingTop: 12 },
  fdLabel: { fontSize: 9, fontWeight: '800', color: '#888888', letterSpacing: 1.5, marginBottom: 8, marginTop: 4 },
  fdPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  fdPill: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#2a2a2a',
  },
  fdPillActive: { backgroundColor: '#3b1d6e', borderColor: '#9333ea' },
  fdPillText: { fontSize: 12, fontWeight: '600', color: '#666' },
  fdPillTextActive: { color: '#c084fc' },
  fdPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  fdDateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  fdDateBtnActive: { borderColor: '#9333ea', backgroundColor: 'rgba(147,51,234,0.08)' },
  fdDateText: { color: '#888888', fontSize: 12, fontWeight: '600', flex: 1 },
  fdDateTextActive: { color: '#c084fc' },
  fdPriceInput: {
    flex: 1, backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    color: '#fff', fontSize: 13,
  },
  fdActions: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  fdClearBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#2a2a2a',
    alignItems: 'center',
  },
  fdClearText: { color: '#666', fontSize: 13, fontWeight: '700' },
  fdApplyBtn: {
    flex: 2, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#9333ea', alignItems: 'center',
  },
  fdApplyText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  viewToggleBtn: { backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 10, padding: 10 },
  statusToggleContainer: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  statusToggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center' },
  statusToggleBtnActive: { backgroundColor: '#9333ea', borderColor: '#9333ea' },
  statusToggleBtnText: { color: '#888888', fontSize: 12, fontWeight: '700' },
  statusToggleBtnTextActive: { color: '#fff' },
  cardRow: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 10, marginBottom: 8 },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  cardCheckbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: '#333', marginTop: 2 },
  cardNameArea: { flex: 1 },
  cardPlayer: { color: '#f0f0f0', fontSize: 13, fontWeight: '700', marginBottom: 1 },
  cardMeta: { color: '#888888', fontSize: 10, fontWeight: '500' },
  activeBadge: { backgroundColor: 'rgba(147,51,234,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#9333ea' },
  activeBadgeText: { color: '#a855f7', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  cardStatsRow: { flexDirection: 'row', backgroundColor: '#0a0a0a', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 11, marginBottom: 8, gap: 4 },
  cardStat: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardMetaSet: { color: '#bbb', fontSize: 11, fontWeight: '600', marginBottom: 1 },
  cardMetaAttr: { color: '#666', fontSize: 10, fontWeight: '500' },
  cardStatLabel: { color: '#888888', fontSize: 8, fontWeight: '700', letterSpacing: 0.4, marginBottom: 3 },
  cardStatValue: { color: '#f0f0f0', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  cardActions: { flexDirection: 'row', gap: 5 },
  cardActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 6, borderRadius: 7 },
  cardActionBtnPurple: { backgroundColor: '#9333ea' },
  cardActionBtnGold: { backgroundColor: '#d97706' },
  cardActionBtnCalc: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#9333ea' },
  cardActionBtnDark: { backgroundColor: '#2a2a2a' },
  cardActionBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12, opacity: 0.3 },
  emptyText: { color: '#f0f0f0', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  emptySubtext: { color: '#888888', fontSize: 13 },
  fab: { position: 'absolute', bottom: 100, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#9333ea', justifyContent: 'center', alignItems: 'center', shadowColor: '#9333ea', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  modalContainer: { flex: 1, backgroundColor: '#0a0a0a' },
  modalScroll: { padding: 20, paddingTop: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 10 },
  modalTitle: { color: '#f0f0f0', fontSize: 20, fontWeight: '900' },
  errorBox: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 10, padding: 12, marginBottom: 14 },
  errorText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  fieldLabel: { color: '#888888', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, color: '#f0f0f0', fontSize: 14, marginBottom: 14 },
  sportGrid: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  sportBtn: { flex: 1, backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  sportBtnActive: { backgroundColor: 'rgba(147,51,234,0.12)', borderColor: '#9333ea' },
  sportEmoji: { fontSize: 20, marginBottom: 4 },
  sportLabel: { color: '#888888', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  sportLabelActive: { color: '#9333ea' },
  pickerWrap: { marginBottom: 14 },
  moreSportBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', marginRight: 8 },
  moreSportBtnActive: { backgroundColor: 'rgba(147,51,234,0.12)', borderColor: '#9333ea' },
  moreSportText: { color: '#888888', fontSize: 12, fontWeight: '700' },
  moreSportTextActive: { color: '#9333ea' },
  moreSportPickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 14 },
  moreSportPickerBtnActive: { borderColor: '#9333ea', backgroundColor: 'rgba(147,51,234,0.08)' },
  moreSportPickerText: { color: '#888888', fontSize: 14, fontWeight: '600' },
  moreDetailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 6 },
  moreDetailsBtnText: { color: '#666', fontSize: 13, fontWeight: '600', flex: 1 },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 14 },
  dropdownBtnOpen: { borderColor: '#9333ea', borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomColor: 'transparent' },
  dropdownBtnText: { color: '#ccc', fontSize: 14, fontWeight: '600' },
  inlinePickerList: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#2a2a2a', borderTopWidth: 0, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, overflow: 'hidden', marginBottom: 14 },
  inlinePickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  row2: { flexDirection: 'row', gap: 10, marginBottom: 0 },
  half: { flex: 1 },
  pillScroll: { marginBottom: 14 },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', marginRight: 8 },
  pillActive: { backgroundColor: 'rgba(147,51,234,0.15)', borderColor: '#9333ea' },
  pillText: { color: '#888888', fontSize: 12, fontWeight: '700' },
  pillTextActive: { color: '#a855f7' },
  autoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 14 },
  autoRowActive: { borderColor: 'rgba(255,190,46,0.3)', backgroundColor: 'rgba(255,190,46,0.05)' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#333', justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#ffbe2e', borderColor: '#ffbe2e' },
  autoLabel: { color: '#ccc', fontSize: 13, fontWeight: '700' },
  autoSub: { color: '#888888', fontSize: 10, marginTop: 1 },
  saveBtn: { backgroundColor: '#9333ea', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  saveBtnDisabled: { backgroundColor: '#2a2a2a' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  deleteBtnModal: { backgroundColor: '#ef4444', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  deleteBtnModalText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  bottomSheetHandle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4, paddingVertical: 10 },
  bottomSheetContent: { paddingHorizontal: 20, paddingVertical: 10 },

  // Sort pill grid inside filter sheet
  sortPillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  sortPill: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#2a2a2a',
  },
  sortPillActive: { backgroundColor: '#3b1d6e', borderColor: '#9333ea' },
  sortPillText: { fontSize: 12, fontWeight: '600', color: '#666' },
  sortPillTextActive: { color: '#c084fc' },
  gradeFilterRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  clearBtn: { backgroundColor: '#333', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  clearBtnText: { color: '#999', fontSize: 15, fontWeight: '800' },
  centerModalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerModal: { backgroundColor: '#111', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 20, width: '90%', maxHeight: '70%' },
  sortOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  sortOptionText: { color: '#f0f0f0', fontSize: 14, fontWeight: '600' },
  sortOptionTextActive: { color: '#9333ea', fontWeight: '800' },
  closeModalBtn: { backgroundColor: '#333', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  closeModalBtnText: { color: '#999', fontSize: 14, fontWeight: '700' },
  breakEvenValue: { color: '#f0f0f0', fontSize: 16, fontWeight: '800', marginBottom: 14 },
  breakEvenLarge: { color: '#9333ea', fontSize: 32, fontWeight: '900', marginBottom: 20 },
  breakEvenRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  breakEvenLabel: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  breakEvenStatus: { fontSize: 16, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  sportDropdownBtn: { backgroundColor: '#111', borderWidth: 1, borderColor: '#222', borderRadius: 10, height: 38, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  sportDropdownBtnActive: { backgroundColor: '#9333ea', borderColor: '#9333ea' },
  sportDropdownBtnText: { color: '#bbbbbb', fontSize: 16, lineHeight: 20 } as any,
  sportDropdownBtnTextActive: { color: '#fff' },
  swipeDeleteBtn: { backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center', width: 72, borderRadius: 12, marginBottom: 8, gap: 3 },
  swipeDeleteText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  // Multi-select
  cardSelected: { borderColor: '#9333ea', borderWidth: 2, backgroundColor: 'rgba(147,51,234,0.08)' },
  selectionOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' } as any,
  selectionCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#888888', backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  selectionCheckActive: { backgroundColor: '#9333ea', borderColor: '#9333ea' },
  selectionBar: { position: 'absolute', bottom: 90, left: 16, right: 16, backgroundColor: '#2a2a2a', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16 },
  selectionCancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectionCancelText: { color: '#aaa', fontSize: 14, fontWeight: '600' },
  selectionCount: { color: '#fff', fontSize: 14, fontWeight: '800' },
  selectionDeleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ef4444', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  selectionDeleteText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  // Sell modal
  sellCardSummary: { backgroundColor: '#0a0a0a', borderRadius: 12, padding: 14, marginBottom: 16 },
  sellCardName: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 3 },
  sellCardMeta: { color: '#666', fontSize: 12, fontWeight: '500', marginBottom: 10 },
  sellCardStats: { flexDirection: 'row', gap: 12 },
  sellCardStat: { flex: 1 },
  sellCardStatLabel: { color: '#888888', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 },
  sellCardStatValue: { color: '#f0f0f0', fontSize: 14, fontWeight: '800' },
  sellProfit: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0a0a0a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 },
  sellProfitLabel: { color: '#bbbbbb', fontSize: 13, fontWeight: '600' },
  sellProfitValue: { fontSize: 16, fontWeight: '900' },
  sportDropdownModal: { position: 'absolute', top: '25%', left: 24, right: 24, backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: '#222', overflow: 'hidden' },
  sportDropdownHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  sportDropdownTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  sportDropdownItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  sportDropdownItemEmoji: { fontSize: 18, marginRight: 12, lineHeight: 22 } as any,
  sportDropdownItemText: { color: '#aaa', fontSize: 14, fontWeight: '600', flex: 1 },
  sportDropdownItemTextActive: { color: '#fff', fontWeight: '800' },
  gridCard: { width: GRID_CARD_W, backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 14, marginBottom: 10, overflow: 'hidden' },
  gridHeaderBand: { backgroundColor: '#0d0d0d', paddingBottom: 8 },
  gridAccentBar: { height: 3, marginBottom: 8 },
  gridHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, gap: 4 },
  gridGradePill: { backgroundColor: 'rgba(147,51,234,0.18)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(147,51,234,0.3)', flexShrink: 1 },
  gridGradePillText: { color: '#c084fc', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  gridGainPill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, flexShrink: 0 },
  gridGainPillText: { fontSize: 9, fontWeight: '800' },
  gradeBadge: { position: 'absolute', top: 5, left: 5, backgroundColor: 'rgba(147,51,234,0.25)', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  gradeBadgeText: { color: '#a855f7', fontSize: 9, fontWeight: '800' },
  gainBadge: { position: 'absolute', top: 5, right: 5, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  gainBadgeText: { fontSize: 9, fontWeight: '800' },
  gridCardInfo: { padding: 10 },
  gridCardPlayer: { color: '#f0f0f0', fontSize: 14, fontWeight: '900', letterSpacing: -0.3, marginBottom: 3, lineHeight: 18 },
  gridCardSubtitle: { color: '#888888', fontSize: 10, fontWeight: '600', marginBottom: 4 },
  gridCardAttr: { color: '#a855f7', fontSize: 10, fontWeight: '700', marginBottom: 6 },
  gridCardSport: { color: '#888888', fontSize: 9, fontWeight: '600', marginBottom: 2 },
  gridCardSet: { color: '#888888', fontSize: 8, fontWeight: '600', marginBottom: 5 },
  gridCardPrices: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, marginTop: 2 },
  gridPriceLabel: { color: '#666', fontSize: 9, fontWeight: '700', letterSpacing: 0.4, marginBottom: 2 },
  gridPriceVal: { color: '#f0f0f0', fontSize: 13, fontWeight: '800' },
  gridCardActions: { flexDirection: 'row', gap: 4, borderTopWidth: 1, borderTopColor: '#2a2a2a', paddingTop: 6 },
  gridActionBtn: { flex: 1, backgroundColor: '#2a2a2a', borderRadius: 6, paddingVertical: 6, alignItems: 'center' },
  // Grid Tools dropdown
  gridToolsMenu: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#2a2a2a', borderRadius: 8, paddingVertical: 6, marginTop: 4 },
  gridToolsItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 4 },
  gridToolsText: { color: '#aaa', fontSize: 9, fontWeight: '700' },
  // List Tools dropdown
  listToolsMenu: { backgroundColor: '#2a2a2a', borderRadius: 8, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden', marginTop: 4 },
  listToolsItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 12 },
  listToolsText: { color: '#ccc', fontSize: 12, fontWeight: '700' },
  listToolsDivider: { height: 1, backgroundColor: '#2a2a2a' },
  // Date picker button (used in sell modal and edit form)
  datePickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  datePickerText: { color: '#f0f0f0', fontSize: 14, flex: 1 },
});
