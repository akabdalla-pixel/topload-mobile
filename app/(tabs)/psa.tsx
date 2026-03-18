import React from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as api from '@/lib/api';

// expo-camera is loaded lazily so a missing native module won't crash the whole tab
let CameraView: React.ComponentType<any> = View as any;
let useCameraPermissionsHook: () => [any, () => Promise<any>] = () => [null, async () => {}];
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cam = require('expo-camera');
  if (cam.CameraView) CameraView = cam.CameraView;
  if (cam.useCameraPermissions) useCameraPermissionsHook = cam.useCameraPermissions;
} catch {}
import { emitDataChanged } from '@/lib/dataEvents';
import { useToast } from '@/components/Toast';

// ─── Types ────────────────────────────────────────────────────────────────────
type PSACard = {
  cert: string;
  grade: string;
  gradeDescription?: string;
  player: string;
  year?: string | number;
  brand?: string;
  cardNumber?: string;
  variety?: string;
  sport?: string;
  set?: string;
  labelType?: string;
  isCancelled?: boolean;
  certPageUrl?: string;
  totalPop?: number;
  popHigher?: number;
  frontImage?: string;
  backImage?: string;
};

type AddForm = {
  player: string;
  sport: string;
  grade: string;
  year: string;
  brand: string;
  name: string;
  buy: string;
  val: string;
  notes: string;
};

type RecentLookup = { player: string; grade: string; cert: string };

const TOP_SPORTS = ['Football', 'Basketball', 'Baseball', 'Soccer'];

// ─── Image with fallback ──────────────────────────────────────────────────────
function ImageWithFallback({ uri }: { uri: string }) {
  const [failed, setFailed] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  if (failed) return null;
  return (
    <View style={styles.cardImageWrap}>
      {!loaded && (
        <View style={{ height: 260, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#9333ea" />
        </View>
      )}
      <Image
        source={{ uri }}
        style={[styles.cardImage, !loaded && { height: 0 }]}
        resizeMode="contain"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PSAScreen() {
  const insets = useSafeAreaInsets();
  const { show: showToast, ToastComponent } = useToast();
  const [cameraPermission, requestCameraPermission] = useCameraPermissionsHook();

  const [certInput, setCertInput] = useState('');
  const [cardData, setCardData] = useState<PSACard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentLookups, setRecentLookups] = useState<RecentLookup[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({
    player: '', sport: '', grade: '', year: '', brand: '', name: '', buy: '', val: '', notes: '',
  });
  const [addLoading, setAddLoading] = useState(false);

  // Reset everything when the tab loses focus (navigating away)
  useFocusEffect(
    useCallback(() => {
      return () => {
        setCertInput('');
        setCardData(null);
        setError('');
        setScanning(false);
        setScanned(false);
        setShowAddModal(false);
      };
    }, [])
  );

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const getGradeColor = (grade: string) => {
    const g = parseFloat(grade);
    if (g >= 9) return '#22c55e';
    if (g >= 7) return '#ffbe2e';
    return '#ef4444';
  };

  // ─── Lookup ─────────────────────────────────────────────────────────────────
  const handleLookup = async (cert?: string) => {
    const num = (cert ?? certInput).trim();
    if (!num) { setError('Please enter a certificate number'); return; }
    setIsLoading(true);
    setError('');
    setCardData(null);
    try {
      const data: PSACard = await api.lookupPSA(num);
      setCardData(data);
      if (data.player && data.grade) {
        setRecentLookups(prev => {
          const item: RecentLookup = { player: data.player, grade: data.grade, cert: num };
          return [item, ...prev.filter(r => r.cert !== num)].slice(0, 5);
        });
      }
      setCertInput('');
    } catch (err: any) {
      setError(err.message || 'Card not found. Check the certificate number.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Camera scan ─────────────────────────────────────────────────────────────
  const handleCameraPress = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Permission Denied', 'Camera access is required to scan PSA QR codes.');
        return;
      }
    }
    setScanned(false);
    setScanning(true);
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setScanning(false);
    // PSA QR codes: https://www.psacard.com/cert/12345678 or https://www.psacard.com/cert/12345678/psa
    const urlMatch = data.match(/psacard\.com\/cert\/(\d+)/i);
    const rawMatch = data.match(/^(\d{7,9})$/);
    const cert = urlMatch?.[1] ?? rawMatch?.[1];
    if (cert) {
      handleLookup(cert);
    } else {
      setError('Could not read cert number from QR code. Try entering it manually.');
    }
  };

  // ─── Add to Collection ───────────────────────────────────────────────────────
  const handleAddToCollection = () => {
    if (!cardData) return;
    const noteParts = [`PSA Cert #${cardData.cert}`];
    if (cardData.variety) noteParts.push(cardData.variety);
    setAddForm({
      player: cardData.player || '',
      sport: cardData.sport || '',
      grade: cardData.grade || '',
      year: cardData.year?.toString() || '',
      brand: cardData.brand || '',
      name: cardData.set || '',
      buy: '',
      val: '',
      notes: noteParts.join(' · '),
    });
    setShowAddModal(true);
  };

  const handleSubmitAdd = async () => {
    if (!addForm.player.trim()) {
      Alert.alert('Required', 'Player name is required.');
      return;
    }
    setAddLoading(true);
    try {
      await api.addCard({
        player: addForm.player.trim(),
        sport: addForm.sport || undefined,
        grade: addForm.grade || undefined,
        gradingCo: 'PSA',
        year: addForm.year || undefined,
        brand: addForm.brand || undefined,
        name: addForm.name || undefined,
        buy: parseFloat(addForm.buy) || 0,
        val: parseFloat(addForm.val) || parseFloat(addForm.buy) || 0,
        qty: 1,
        notes: addForm.notes || undefined,
        imageUrl: cardData?.frontImage || undefined,
      });
      emitDataChanged();
      setShowAddModal(false);
      showToast({
        emoji: '🎉',
        title: `${addForm.player} added!`,
        sub: 'Your collection just got better 🔥',
        color: '#22c55e',
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add card.');
    } finally {
      setAddLoading(false);
    }
  };

  // ─── Pop report numbers ──────────────────────────────────────────────────────
  const totalPop = cardData?.totalPop ?? 0;
  const gradedHigher = cardData?.popHigher ?? 0;
  const thisGrade = Math.max(0, totalPop - gradedHigher);

  // ─── Render ──────────────────────────────────────────────────────────────────

  // Camera scanning view
  if (scanning) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          onBarcodeScanned={handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        {/* Overlay */}
        <View style={styles.scanOverlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanHint}>Point at the QR code on the PSA slab</Text>
          <TouchableOpacity style={styles.scanCancel} onPress={() => setScanning(false)}>
            <Text style={styles.scanCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <>
      <ToastComponent />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Page header */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Text style={styles.pageTitle}>PSA LOOKUP</Text>
          <Text style={styles.pageSubtitle}>Verify authenticity & view pop report</Text>
        </View>

        {/* Search bar */}
        <View style={styles.searchCard}>
          <Ionicons name="shield-checkmark" size={18} color="#9333ea" style={{ flexShrink: 0 }} />
          <TextInput
            style={styles.input}
            placeholder="Enter cert number..."
            placeholderTextColor="#888888"
            value={certInput}
            onChangeText={setCertInput}
            keyboardType="number-pad"
            editable={!isLoading}
            onSubmitEditing={() => handleLookup()}
            returnKeyType="search"
          />
          <TouchableOpacity onPress={handleCameraPress} style={styles.cameraBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="qr-code" size={20} color="#9333ea" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.lookupButton, isLoading && styles.lookupButtonDisabled]}
            onPress={() => handleLookup()}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.lookupButtonText}>Look Up</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Error */}
        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Empty state */}
        {!cardData && !isLoading && (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>HOW TO FIND THE CERT #</Text>
              {[
                { icon: '🔖', text: 'Find it on the label inside the PSA slab' },
                { icon: '📷', text: 'Tap the QR button above to scan the slab\'s QR code' },
                { icon: '🔢', text: 'Numbers only, usually 7–9 digits' },
                { icon: '⚠️', text: 'A cancelled cert means fraud or a returned card' },
              ].map((item, i) => (
                <View key={i} style={styles.infoItem}>
                  <Text style={styles.infoIcon}>{item.icon}</Text>
                  <Text style={styles.infoText}>{item.text}</Text>
                </View>
              ))}
            </View>

            {recentLookups.length > 0 && (
              <View style={styles.recentSection}>
                <Text style={styles.recentTitle}>RECENT LOOKUPS</Text>
                {recentLookups.map(r => (
                  <TouchableOpacity key={r.cert} style={styles.recentRow} onPress={() => handleLookup(r.cert)}>
                    <Text style={styles.recentPlayer} numberOfLines={1}>{r.player}</Text>
                    <View style={[styles.recentGradeBadge, { backgroundColor: getGradeColor(r.grade) }]}>
                      <Text style={styles.recentGradeText}>{r.grade}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {/* ── Result Card ─────────────────────────────────────────────────── */}
        {cardData && (
          <View style={styles.resultWrap}>

            {/* Verified / Cancelled banner */}
            <View style={[styles.verifiedBar, cardData.isCancelled && styles.cancelledBar]}>
              <Ionicons
                name={cardData.isCancelled ? 'close-circle' : 'checkmark-circle'}
                size={15}
                color={cardData.isCancelled ? '#ef4444' : '#22c55e'}
              />
              <Text style={[styles.verifiedText, cardData.isCancelled && { color: '#ef4444' }]}>
                {cardData.isCancelled ? 'CANCELLED — DO NOT PURCHASE' : 'VERIFIED AUTHENTIC'}
              </Text>
            </View>

            {/* View on PSA link */}
            {!!cardData.certPageUrl && (
              <TouchableOpacity
                style={styles.psaLinkBtn}
                onPress={() => Linking.openURL(cardData.certPageUrl!)}
                activeOpacity={0.7}
              >
                <Text style={styles.psaLinkText}>View on PSA</Text>
                <Text style={styles.psaLinkArrow}> ↗</Text>
              </TouchableOpacity>
            )}

            {/* Card image */}
            {!!cardData.frontImage && (
              <ImageWithFallback uri={cardData.frontImage} />
            )}

            {/* Grade badge + card name */}
            <View style={styles.gradeNameRow}>
              <View style={[styles.gradeBadge, { borderColor: getGradeColor(cardData.grade) }]}>
                <Text style={[styles.gradeText, { color: getGradeColor(cardData.grade) }]}>
                  {cardData.grade}
                </Text>
              </View>
              <View style={styles.nameBlock}>
                <Text style={styles.playerName} numberOfLines={2}>{cardData.player}</Text>
                <Text style={styles.gradeDesc}>
                  {cardData.gradeDescription || `GEM MT ${cardData.grade}`}
                </Text>
              </View>
            </View>

            {/* Details grid */}
            <View style={styles.detailsCard}>
              {([
                ['CERT #', cardData.cert],
                ['YEAR', cardData.year?.toString() || '—'],
                ['SPORT', cardData.sport || '—'],
                ['BRAND', cardData.brand || '—'],
                ['CARD #', cardData.cardNumber || '—'],
                ['SET', cardData.set || '—'],
                ['VARIETY', cardData.variety || '—'],
                ['LABEL', cardData.labelType || '—'],
              ] as [string, string][]).reduce<[string, string][][]>((rows, item, i) => {
                if (i % 2 === 0) rows.push([item]);
                else rows[rows.length - 1].push(item);
                return rows;
              }, []).map((row, i) => (
                <View key={i} style={[styles.detailRow, i > 0 && styles.detailRowBorder]}>
                  {row.map(([label, value]) => (
                    <View key={label} style={styles.detailCell}>
                      <Text style={styles.detailLabel}>{label}</Text>
                      <Text style={styles.detailValue} numberOfLines={2}>{value}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>

            {/* PSA Pop Report */}
            <View style={styles.popCard}>
              <Text style={styles.popTitle}>PSA POP REPORT</Text>
              <View style={styles.popRow}>
                <View style={styles.popStat}>
                  <Text style={[styles.popNum, { color: getGradeColor(cardData.grade) }]}>{thisGrade}</Text>
                  <Text style={styles.popLabel}>THIS GRADE</Text>
                </View>
                <View style={[styles.popStat, styles.popStatBorder]}>
                  <Text style={[styles.popNum, { color: gradedHigher > 0 ? '#ef4444' : '#888888' }]}>
                    {gradedHigher}
                  </Text>
                  <Text style={styles.popLabel}>GRADED HIGHER</Text>
                </View>
                <View style={styles.popStat}>
                  <Text style={[styles.popNum, { color: '#f0f0f0' }]}>{totalPop}</Text>
                  <Text style={styles.popLabel}>TOTAL POP</Text>
                </View>
              </View>
              {gradedHigher === 0 && totalPop > 0 && (
                <Text style={styles.popTopGrade}>🏆 Top grade — nothing graded higher</Text>
              )}
            </View>

            {/* Add to Collection */}
            <TouchableOpacity style={styles.addBtn} onPress={handleAddToCollection} activeOpacity={0.85}>
              <Text style={styles.addBtnText}>+ Add to Collection</Text>
            </TouchableOpacity>

          </View>
        )}
      </ScrollView>

      {/* ── Quick Add Modal ───────────────────────────────────────────────── */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalContainer}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Quick Add</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="#bbbbbb" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.modalBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Player */}
              <Text style={styles.fieldLabel}>PLAYER NAME *</Text>
              <TextInput
                style={[styles.fieldInput, { borderColor: '#9333ea' }]}
                value={addForm.player}
                onChangeText={v => setAddForm(f => ({ ...f, player: v }))}
                placeholder="Player or card name"
                placeholderTextColor="#888888"
              />

              {/* Sport pills */}
              <Text style={styles.fieldLabel}>SPORT / GAME</Text>
              <View style={styles.sportPillsRow}>
                {TOP_SPORTS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sportPill, addForm.sport === s && styles.sportPillActive]}
                    onPress={() => setAddForm(f => ({ ...f, sport: f.sport === s ? '' : s }))}
                  >
                    <Text style={[styles.sportPillText, addForm.sport === s && styles.sportPillTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Free-text if not a top-4 sport */}
              {!!addForm.sport && !TOP_SPORTS.includes(addForm.sport) && (
                <TextInput
                  style={[styles.fieldInput, { marginTop: 8 }]}
                  value={addForm.sport}
                  onChangeText={v => setAddForm(f => ({ ...f, sport: v }))}
                  placeholder="Sport or game"
                  placeholderTextColor="#888888"
                />
              )}

              {/* Grade + Grading Co (locked to PSA) */}
              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>GRADE</Text>
                  <View style={[styles.fieldInput, styles.lockedField]}>
                    <Text style={styles.lockedFieldText}>{addForm.grade || '—'}</Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>GRADING CO.</Text>
                  <View style={[styles.fieldInput, styles.lockedField]}>
                    <Text style={[styles.lockedFieldText, { color: '#a855f7' }]}>PSA</Text>
                  </View>
                </View>
              </View>

              {/* Buy + Value */}
              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>BUY PRICE ($)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={addForm.buy}
                    onChangeText={v => setAddForm(f => ({ ...f, buy: v }))}
                    placeholder="0.00"
                    placeholderTextColor="#888888"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>CURRENT VALUE ($)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={addForm.val}
                    onChangeText={v => setAddForm(f => ({ ...f, val: v }))}
                    placeholder="0.00"
                    placeholderTextColor="#888888"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* More details */}
              <Text style={styles.fieldLabel}>YEAR</Text>
              <TextInput
                style={styles.fieldInput}
                value={addForm.year}
                onChangeText={v => setAddForm(f => ({ ...f, year: v }))}
                placeholder="e.g. 2023"
                placeholderTextColor="#888888"
                keyboardType="number-pad"
              />

              <Text style={styles.fieldLabel}>BRAND</Text>
              <TextInput
                style={styles.fieldInput}
                value={addForm.brand}
                onChangeText={v => setAddForm(f => ({ ...f, brand: v }))}
                placeholder="e.g. Topps Chrome"
                placeholderTextColor="#888888"
              />

              <Text style={styles.fieldLabel}>SET / CARD NAME</Text>
              <TextInput
                style={styles.fieldInput}
                value={addForm.name}
                onChangeText={v => setAddForm(f => ({ ...f, name: v }))}
                placeholder="e.g. Prizm Silver"
                placeholderTextColor="#888888"
              />

              <Text style={styles.fieldLabel}>NOTES</Text>
              <TextInput
                style={[styles.fieldInput, { height: 72, textAlignVertical: 'top', paddingTop: 12 }]}
                value={addForm.notes}
                onChangeText={v => setAddForm(f => ({ ...f, notes: v }))}
                multiline
                placeholder="Notes..."
                placeholderTextColor="#888888"
              />

              <TouchableOpacity
                style={[styles.addBtn, { marginTop: 12 }, addLoading && { opacity: 0.6 }]}
                onPress={handleSubmitAdd}
                disabled={addLoading}
                activeOpacity={0.85}
              >
                {addLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.addBtnText}>+ Add Card</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

  // Header
  header: { paddingHorizontal: 16, paddingBottom: 14 },
  pageTitle: { color: '#f0f0f0', fontSize: 24, fontWeight: '900', letterSpacing: 1.5, marginBottom: 2 },
  pageSubtitle: { color: '#888888', fontSize: 13, fontWeight: '500' },

  // Search
  searchCard: {
    marginHorizontal: 16, marginBottom: 12,
    flexDirection: 'row', gap: 8, alignItems: 'center',
    backgroundColor: '#111111', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  input: { flex: 1, color: '#f0f0f0', fontSize: 15, paddingVertical: 4 },
  cameraBtn: { padding: 2 },
  lookupButton: {
    backgroundColor: '#9333ea', paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center', minWidth: 76,
  },
  lookupButtonDisabled: { backgroundColor: '#6b21a8' },
  lookupButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Error
  errorBox: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: '#ef4444',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  errorText: { color: '#ef4444', fontSize: 13, fontWeight: '600', flex: 1 },

  // Info card
  infoCard: {
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: '#111111', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 12, padding: 14,
  },
  infoTitle: { fontSize: 11, fontWeight: '800', color: '#f0f0f0', marginBottom: 12, letterSpacing: 0.5 },
  infoItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 9 },
  infoIcon: { fontSize: 15, marginTop: 1 },
  infoText: { flex: 1, fontSize: 13, color: '#bbbbbb', lineHeight: 18 },

  // Recent lookups
  recentSection: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: '#111111', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  recentTitle: { fontSize: 10, fontWeight: '800', color: '#888888', letterSpacing: 1, marginBottom: 10 },
  recentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2a2a2a',
  },
  recentPlayer: { fontSize: 13, fontWeight: '700', color: '#f0f0f0', flex: 1, marginRight: 12 },
  recentGradeBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 },
  recentGradeText: { color: '#000', fontSize: 11, fontWeight: '800' },

  // ── Result ──────────────────────────────────────────────────────────────────
  resultWrap: { marginHorizontal: 16, marginBottom: 24, gap: 10 },

  verifiedBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  cancelledBar: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' },
  verifiedText: { color: '#22c55e', fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },

  psaLinkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(147,51,234,0.08)', borderWidth: 1, borderColor: 'rgba(147,51,234,0.3)',
    borderRadius: 10, paddingVertical: 12,
  },
  psaLinkText: { color: '#a855f7', fontSize: 14, fontWeight: '800' },
  psaLinkArrow: { color: '#a855f7', fontSize: 14, fontWeight: '800' },

  cardImageWrap: {
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    overflow: 'hidden',
    padding: 12,
  },
  cardImage: {
    width: '100%',
    height: 260,
    borderRadius: 8,
  },

  gradeNameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#111111', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 12, padding: 16,
  },
  gradeBadge: {
    width: 66, height: 66, borderRadius: 12, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a', flexShrink: 0,
  },
  gradeText: { fontSize: 28, fontWeight: '900' },
  nameBlock: { flex: 1 },
  playerName: { color: '#f0f0f0', fontSize: 20, fontWeight: '900', marginBottom: 3 },
  gradeDesc: { color: '#bbbbbb', fontSize: 13, fontWeight: '600' },

  detailsCard: {
    backgroundColor: '#111111', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 12, overflow: 'hidden',
  },
  detailRow: { flexDirection: 'row' },
  detailRowBorder: { borderTopWidth: 1, borderTopColor: '#2a2a2a' },
  detailCell: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  detailLabel: { fontSize: 9, fontWeight: '800', color: '#888888', letterSpacing: 1, marginBottom: 4 },
  detailValue: { fontSize: 13, fontWeight: '700', color: '#f0f0f0' },

  // Pop report
  popCard: {
    backgroundColor: '#111111', borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 16,
  },
  popTitle: { fontSize: 10, fontWeight: '800', color: '#666666', letterSpacing: 1.5, marginBottom: 16, textAlign: 'center' },
  popRow: { flexDirection: 'row' },
  popStat: { flex: 1, alignItems: 'center', gap: 4 },
  popStatBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#2a2a2a' },
  popNum: { fontSize: 34, fontWeight: '900' },
  popLabel: { fontSize: 9, fontWeight: '700', color: '#888888', letterSpacing: 0.6, textAlign: 'center' },
  popTopGrade: { color: '#eab308', fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 14 },

  addBtn: { backgroundColor: '#9333ea', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  // ── Add Modal ────────────────────────────────────────────────────────────────
  modalContainer: { flex: 1, backgroundColor: '#0a0a0a' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#2a2a2a',
  },
  modalTitle: { color: '#f0f0f0', fontSize: 20, fontWeight: '900' },
  modalBody: { padding: 20, paddingBottom: 48 },

  fieldLabel: { color: '#666666', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6, marginTop: 14 },
  fieldInput: {
    backgroundColor: '#111111', borderWidth: 1, borderColor: '#222222',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
    color: '#f0f0f0', fontSize: 15,
  },
  lockedField: { justifyContent: 'center', opacity: 0.75 },
  lockedFieldText: { color: '#f0f0f0', fontSize: 15, fontWeight: '700' },

  twoCol: { flexDirection: 'row', gap: 12 },

  sportPillsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  sportPill: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
    backgroundColor: '#111111', borderWidth: 1, borderColor: '#222222',
  },
  sportPillActive: { backgroundColor: 'rgba(147,51,234,0.15)', borderColor: '#9333ea' },
  sportPillText: { color: '#bbbbbb', fontSize: 13, fontWeight: '700' },
  sportPillTextActive: { color: '#a855f7' },

  // ── Camera scanner ──────────────────────────────────────────────────────────
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  scanFrame: {
    width: 230,
    height: 230,
    borderWidth: 2,
    borderColor: '#9333ea',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  scanHint: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  scanCancel: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: '#888888',
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  scanCancelText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});
