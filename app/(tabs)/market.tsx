import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as api from '@/lib/api';

const CARD_W = (Dimensions.get('window').width - 16 * 2 - 10) / 2;

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);

const getSportEmoji = (sport?: string): string => {
  if (!sport) return '🃏';
  const s = sport.toLowerCase();
  if (s.includes('baseball') || s.includes('mlb')) return '⚾';
  if (s.includes('basketball') || s.includes('nba')) return '🏀';
  if (s.includes('football') || s.includes('nfl')) return '🏈';
  if (s.includes('soccer') || s.includes('mls')) return '⚽';
  if (s.includes('hockey') || s.includes('nhl')) return '🏒';
  if (s.includes('f1') || s.includes('racing') || s.includes('formula')) return '🏎️';
  return '🃏';
};

type MarketResult = {
  title: string;
  price: number;
  image?: string;
  link: string;
  condition: string;
};

type SearchStats = {
  count: number;
  avg: number;
  high: number;
  low: number;
};

type ParsedCard = {
  player: string;
  year: string;
  brand: string;
  name: string;      // set / card name
  grade: string;
  gradingCo: string;
  num: string;       // serial e.g. /25
  auto: boolean;
  sport: string;
  buy: string;
  val: string;
};

const KNOWN_BRANDS = [
  'Topps','Bowman','Panini','Upper Deck','Donruss','Fleer','Score','Leaf',
  'Select','Prizm','Mosaic','Optic','Chronicles','Revolution','Contenders',
  'Immaculate','National Treasures','Finest','Stadium Club','Heritage',
  'Gypsy Queen','Allen & Ginter','Chrome','Refractor','Hoops','Skybox',
  'Playoff','Pacific','SP Authentic','SPx','Exquisite','Certified','Absolute',
];
const GRADING_COS = ['PSA','BGS','SGC','CGC','HGA','CSG','GAI'];
const SPORTS_KEYWORDS: [string, string][] = [
  ['football','Football'],['nfl','Football'],['quarterback','Football'],
  ['basketball','Basketball'],['nba','Basketball'],
  ['baseball','Baseball'],['mlb','Baseball'],['topps','Baseball'],['bowman','Baseball'],
  ['soccer','Soccer'],['mls','Soccer'],['fifa','Soccer'],
  ['hockey','Hockey'],['nhl','Hockey'],
  ['f1','F1'],['formula','F1'],['racing','F1'],
  ['pokemon','Pokémon'],['pikachu','Pokémon'],
  ['magic','Magic: The Gathering'],['mtg','Magic: The Gathering'],
];

function parseEbayTitle(title: string, buyPrice: number): ParsedCard {
  const t = title;
  const tl = t.toLowerCase();

  // Year: 4-digit between 1950–2030
  const yearMatch = t.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  const year = yearMatch ? yearMatch[1] : '';

  // Grading company + grade: "PSA 10", "BGS 9.5", etc.
  let gradingCo = '';
  let grade = '';
  for (const co of GRADING_COS) {
    const re = new RegExp(`\\b${co}\\s*(\\d{1,2}(?:\\.\\d)?)\\b`, 'i');
    const m = t.match(re);
    if (m) { gradingCo = co; grade = m[1]; break; }
  }

  // Serial number: /25, /10, /99, etc.
  const numMatch = t.match(/\/(\d{1,5})\b/);
  const num = numMatch ? `/${numMatch[1]}` : '';

  // Auto
  const auto = /\bauto(?:graph)?\b/i.test(t);

  // Brand
  let brand = '';
  for (const b of KNOWN_BRANDS) {
    if (tl.includes(b.toLowerCase())) { brand = b; break; }
  }

  // Sport
  let sport = '';
  for (const [kw, sp] of SPORTS_KEYWORDS) {
    if (tl.includes(kw)) { sport = sp; break; }
  }

  // Player name heuristic: words before the year (or first 3 capitalised words)
  let player = '';
  if (yearMatch) {
    player = t.slice(0, yearMatch.index).trim().replace(/[^a-zA-Z\s'-]/g, '').trim();
  }
  if (!player || player.length < 3) {
    // Fallback: grab first capitalised tokens up to 3 words
    const words = t.split(' ');
    const nameParts: string[] = [];
    for (const w of words) {
      if (/^[A-Z]/.test(w) && !/^\d/.test(w) && !GRADING_COS.includes(w.toUpperCase())) {
        nameParts.push(w);
        if (nameParts.length >= 3) break;
      }
    }
    player = nameParts.join(' ');
  }
  // Strip trailing non-alpha
  player = player.replace(/[\s,;:]+$/, '').trim();
  if (!player) player = t.slice(0, 40);

  return {
    player,
    year,
    brand,
    name: '',   // user can fill set name
    grade,
    gradingCo,
    num,
    auto,
    sport,
    buy: String(buyPrice),
    val: String(buyPrice),
  };
}

export default function MarketScreen() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<MarketResult[]>([]);
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Add-to-collection modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<ParsedCard | null>(null);
  const [savingCard, setSavingCard] = useState(false);

  const setF = (k: keyof ParsedCard, v: any) =>
    setAddForm(f => f ? { ...f, [k]: v } : f);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setHasSearched(false);
    try {
      const data = await api.searchMarket(searchQuery);
      setResults(data.results || []);
      setStats({
        count: data.count || 0,
        avg: data.avg || 0,
        high: data.high || 0,
        low: data.low || 0,
      });
    } catch (e) {
      console.error('Market search error:', e);
      setResults([]);
      setStats(null);
    } finally {
      setIsLoading(false);
      setHasSearched(true);
    }
  };

  const openAddModal = (item: MarketResult) => {
    setAddForm(parseEbayTitle(item.title, item.price));
    setShowAddModal(true);
  };

  const handleSaveCard = async () => {
    if (!addForm) return;
    if (!addForm.player.trim()) {
      Alert.alert('Required', 'Player name is required');
      return;
    }
    setSavingCard(true);
    try {
      await api.addCard({
        player: addForm.player.trim(),
        sport: addForm.sport || null,
        year: addForm.year || null,
        brand: addForm.brand || null,
        name: addForm.name || null,
        grade: addForm.grade || null,
        gradingCo: addForm.gradingCo || null,
        num: addForm.num || null,
        auto: addForm.auto,
        buy: parseFloat(addForm.buy) || 0,
        val: parseFloat(addForm.val) || 0,
        qty: 1,
      });
      setShowAddModal(false);
      Alert.alert('Added! 🎉', `${addForm.player} has been added to your collection.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add card');
    } finally {
      setSavingCard(false);
    }
  };

  // ─── Render helpers ────────────────────────────────────────────

  const renderCard = ({ item }: { item: MarketResult }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => Linking.openURL(item.link)}
    >
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, styles.noImage]}>
          <Ionicons name="image-outline" size={32} color="#333" />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.cardMeta}>
          <View style={styles.condBadge}>
            <Text style={styles.condBadgeText} numberOfLines={1}>{item.condition}</Text>
          </View>
          <Text style={styles.ebayLink}>eBay ↗</Text>
        </View>
        <Text style={styles.cardPrice}>{fmt(item.price)}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => openAddModal(item)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={13} color="#fff" />
          <Text style={styles.addBtnText}>Add to Collection</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => {
    if (!stats || !hasSearched) return null;
    return (
      <View style={styles.statsSection}>
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { borderTopColor: '#9333ea' }]}>
            <Text style={styles.statLabel}>RESULTS</Text>
            <Text style={styles.statVal}>{stats.count}</Text>
          </View>
          <View style={[styles.statBox, { borderTopColor: '#9333ea' }]}>
            <Text style={styles.statLabel}>AVG PRICE</Text>
            <Text style={styles.statVal}>{fmt(stats.avg)}</Text>
          </View>
          <View style={[styles.statBox, { borderTopColor: '#f97316' }]}>
            <Text style={styles.statLabel}>HIGHEST</Text>
            <Text style={[styles.statVal, { color: '#f97316' }]}>{fmt(stats.high)}</Text>
          </View>
          <View style={[styles.statBox, { borderTopColor: '#22c55e' }]}>
            <Text style={styles.statLabel}>LOWEST</Text>
            <Text style={[styles.statVal, { color: '#22c55e' }]}>{fmt(stats.low)}</Text>
          </View>
        </View>
        <Text style={styles.resultsNote}>
          {stats.count} listings · tap any card to view on eBay
        </Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons name={hasSearched ? 'search-outline' : 'trending-up-outline'} size={52} color={'#2a2a2a'} />
        <Text style={styles.emptyTitle}>{hasSearched ? 'No results found' : 'Find cards to buy'}</Text>
        <Text style={styles.emptySubtitle}>
          {hasSearched
            ? 'Try a different search term or check your spelling'
            : 'Search active eBay listings · add cards directly to your collection'}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerEyebrow}>EBAY ACTIVE LISTINGS</Text>
        <Text style={styles.headerTitle}>MARKETPLACE</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#888888" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="e.g. LeBron James Topps Chrome PSA 10"
            placeholderTextColor="#888888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#888888" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.searchBtn, (!searchQuery.trim() || isLoading) && { opacity: 0.5 }]}
          onPress={handleSearch}
          disabled={!searchQuery.trim() || isLoading}
        >
          {isLoading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.searchBtnText}>Search</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Results FlatList */}
      <FlatList
        data={results}
        keyExtractor={(item, idx) => `${item.link}-${idx}`}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={renderCard}
      />

      {/* ── Add to Collection Modal ── */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>FROM EBAY</Text>
                <Text style={styles.modalTitle}>Add to Collection</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#888888" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalHint}>
              We pre-filled what we could from the listing title. Review and correct before saving.
            </Text>

            {addForm && (
              <>
                {/* Player */}
                <Text style={styles.fLabel}>PLAYER / SUBJECT *</Text>
                <TextInput
                  style={styles.fInput}
                  value={addForm.player}
                  onChangeText={v => setF('player', v)}
                  placeholder="Player or subject name"
                  placeholderTextColor="#888888"
                />

                {/* Sport */}
                <Text style={styles.fLabel}>SPORT / GAME</Text>
                <TextInput
                  style={styles.fInput}
                  value={addForm.sport}
                  onChangeText={v => setF('sport', v)}
                  placeholder="e.g. Basketball, Football, Pokémon"
                  placeholderTextColor="#888888"
                />

                {/* Year + Brand */}
                <View style={styles.row2}>
                  <View style={styles.half}>
                    <Text style={styles.fLabel}>YEAR</Text>
                    <TextInput
                      style={styles.fInput}
                      value={addForm.year}
                      onChangeText={v => setF('year', v)}
                      placeholder="e.g. 2023"
                      placeholderTextColor="#888888"
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.fLabel}>BRAND</Text>
                    <TextInput
                      style={styles.fInput}
                      value={addForm.brand}
                      onChangeText={v => setF('brand', v)}
                      placeholder="e.g. Topps"
                      placeholderTextColor="#888888"
                    />
                  </View>
                </View>

                {/* Set name */}
                <Text style={styles.fLabel}>SET / CARD NAME</Text>
                <TextInput
                  style={styles.fInput}
                  value={addForm.name}
                  onChangeText={v => setF('name', v)}
                  placeholder="e.g. Chrome Refractor"
                  placeholderTextColor="#888888"
                />

                {/* Grading Co + Grade */}
                <View style={styles.row2}>
                  <View style={styles.half}>
                    <Text style={styles.fLabel}>GRADING CO.</Text>
                    <TextInput
                      style={styles.fInput}
                      value={addForm.gradingCo}
                      onChangeText={v => setF('gradingCo', v)}
                      placeholder="PSA / BGS / SGC"
                      placeholderTextColor="#888888"
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.fLabel}>GRADE</Text>
                    <TextInput
                      style={styles.fInput}
                      value={addForm.grade}
                      onChangeText={v => setF('grade', v)}
                      placeholder="10 / 9.5 / Raw"
                      placeholderTextColor="#888888"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                {/* Serial number */}
                <Text style={styles.fLabel}>SERIAL NUMBER</Text>
                <TextInput
                  style={styles.fInput}
                  value={addForm.num}
                  onChangeText={v => setF('num', v)}
                  placeholder="/25  /10  /1"
                  placeholderTextColor="#888888"
                />

                {/* Auto toggle */}
                <TouchableOpacity
                  style={[styles.autoRow, addForm.auto && styles.autoRowActive]}
                  onPress={() => setF('auto', !addForm.auto)}
                >
                  <View style={[styles.checkbox, addForm.auto && styles.checkboxActive]}>
                    {addForm.auto && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <View>
                    <Text style={[styles.autoLabel, addForm.auto && { color: '#ffbe2e' }]}>Autograph ✍️</Text>
                    <Text style={styles.autoSub}>This card has an autograph</Text>
                  </View>
                </TouchableOpacity>

                {/* Buy price + Value */}
                <View style={styles.row2}>
                  <View style={styles.half}>
                    <Text style={styles.fLabel}>BUY PRICE ($)</Text>
                    <TextInput
                      style={styles.fInput}
                      value={addForm.buy}
                      onChangeText={v => setF('buy', v)}
                      placeholder="0.00"
                      placeholderTextColor="#888888"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.fLabel}>CURRENT VALUE ($)</Text>
                    <TextInput
                      style={styles.fInput}
                      value={addForm.val}
                      onChangeText={v => setF('val', v)}
                      placeholder="0.00"
                      placeholderTextColor="#888888"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                {/* Preview pill row */}
                <View style={styles.previewRow}>
                  {addForm.year ? <View style={styles.previewPill}><Text style={styles.previewPillText}>{addForm.year}</Text></View> : null}
                  {addForm.brand ? <View style={styles.previewPill}><Text style={styles.previewPillText}>{addForm.brand}</Text></View> : null}
                  {addForm.gradingCo && addForm.grade ? <View style={[styles.previewPill, styles.previewPillPurple]}><Text style={[styles.previewPillText, { color: '#a855f7' }]}>{addForm.gradingCo} {addForm.grade}</Text></View> : null}
                  {addForm.num ? <View style={[styles.previewPill, styles.previewPillGold]}><Text style={[styles.previewPillText, { color: '#d97706' }]}>{addForm.num}</Text></View> : null}
                  {addForm.auto ? <View style={[styles.previewPill, styles.previewPillGold]}><Text style={[styles.previewPillText, { color: '#d97706' }]}>AUTO ✍️</Text></View> : null}
                  {addForm.sport ? <View style={styles.previewPill}><Text style={styles.previewPillText}>{getSportEmoji(addForm.sport)} {addForm.sport}</Text></View> : null}
                </View>

                {/* Save button */}
                <TouchableOpacity
                  style={[styles.saveBtn, savingCard && { opacity: 0.6 }]}
                  onPress={handleSaveCard}
                  disabled={savingCard}
                >
                  {savingCard
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={styles.saveBtnText}>Add to My Collection</Text></>
                  }
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

  // Header
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#2a2a2a', backgroundColor: '#0a0a0a' },
  headerEyebrow: { color: '#9333ea', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  headerTitle: { color: '#f0f0f0', fontSize: 26, fontWeight: '900', letterSpacing: -1 },

  // Search
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, color: '#f0f0f0', fontSize: 14 },
  searchBtn: { backgroundColor: '#9333ea', height: 44, paddingHorizontal: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', minWidth: 72 },
  searchBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Stats
  statsSection: { paddingHorizontal: 0, paddingTop: 12, paddingBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statBox: { flex: 1, backgroundColor: '#111', borderWidth: 1, borderTopWidth: 3, borderColor: '#2a2a2a', borderRadius: 10, padding: 10, alignItems: 'center' },
  statLabel: { color: '#888888', fontSize: 8, fontWeight: '700', letterSpacing: 0.5, marginBottom: 5 },
  statVal: { color: '#f0f0f0', fontSize: 12, fontWeight: '900' },
  resultsNote: { color: '#888888', fontSize: 11, fontWeight: '500', textAlign: 'center', paddingBottom: 4 },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  row: { gap: 10, marginBottom: 10 },

  // Card
  card: { width: CARD_W, backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 14, overflow: 'hidden' },
  cardImage: { width: '100%', height: 160, backgroundColor: '#0a0a0a' },
  noImage: { justifyContent: 'center', alignItems: 'center' },
  cardBody: { padding: 10 },
  cardTitle: { color: '#f0f0f0', fontSize: 11, fontWeight: '700', lineHeight: 15, marginBottom: 7 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  condBadge: { backgroundColor: '#2a2a2a', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3, flex: 1, marginRight: 6 },
  condBadgeText: { color: '#bbbbbb', fontSize: 9, fontWeight: '700' },
  ebayLink: { color: '#9333ea', fontSize: 10, fontWeight: '700' },
  cardPrice: { color: '#f0f0f0', fontSize: 15, fontWeight: '900', marginBottom: 8 },
  addBtn: { backgroundColor: '#9333ea', borderRadius: 8, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  addBtnText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },

  // Empty
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { color: '#888888', fontSize: 17, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  emptySubtitle: { color: '#333', fontSize: 13, textAlign: 'center', lineHeight: 19 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#0a0a0a' },
  modalScroll: { padding: 20, paddingTop: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, paddingTop: 10 },
  modalEyebrow: { color: '#9333ea', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 3 },
  modalTitle: { color: '#f0f0f0', fontSize: 20, fontWeight: '900' },
  modalHint: { color: '#888888', fontSize: 12, lineHeight: 17, marginBottom: 18, backgroundColor: '#111', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2a2a2a' },

  // Form
  fLabel: { color: '#888888', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  fInput: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, color: '#f0f0f0', fontSize: 14, marginBottom: 14 },
  row2: { flexDirection: 'row', gap: 10, marginBottom: 0 },
  half: { flex: 1 },
  autoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 14 },
  autoRowActive: { borderColor: 'rgba(255,190,46,0.3)', backgroundColor: 'rgba(255,190,46,0.05)' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#333', justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#ffbe2e', borderColor: '#ffbe2e' },
  autoLabel: { color: '#ccc', fontSize: 13, fontWeight: '700' },
  autoSub: { color: '#888888', fontSize: 10, marginTop: 1 },

  // Preview pills
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 },
  previewPill: { backgroundColor: '#2a2a2a', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#2a2a2a' },
  previewPillPurple: { borderColor: 'rgba(147,51,234,0.3)', backgroundColor: 'rgba(147,51,234,0.08)' },
  previewPillGold: { borderColor: 'rgba(217,119,6,0.3)', backgroundColor: 'rgba(217,119,6,0.08)' },
  previewPillText: { color: '#bbbbbb', fontSize: 11, fontWeight: '700' },

  // Save
  saveBtn: { backgroundColor: '#9333ea', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cancelBtn: { backgroundColor: '#2a2a2a', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#666', fontSize: 14, fontWeight: '700' },
});
