import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth';
import { useData } from '@/context/data';
import * as api from '@/lib/api';


const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

export default function SettingsScreen() {
  const { user, logout, displayName, updateDisplayName } = useAuth();
  const insets = useSafeAreaInsets();
  const { cards } = useData();
  const [isLoading, setIsLoading] = useState(false);

  // Display name state
  const [nameInput, setNameInput] = useState(displayName);
  const [nameSaving, setNameSaving] = useState(false);
  const [showNameEdit, setShowNameEdit] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPassSection, setShowPassSection] = useState(false);

  const handleSaveName = async () => {
    if (!nameInput.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
    try {
      setNameSaving(true);
      await updateDisplayName(nameInput.trim());
      setShowNameEdit(false);
      Alert.alert('Saved', 'Your display name has been updated');
    } catch {
      Alert.alert('Error', 'Failed to save name');
    } finally {
      setNameSaving(false);
    }
  };

  // Derived stats from shared context (no extra fetch needed)
  const activeCards = cards.filter(c => !c.sold);
  const soldCards = cards.filter(c => c.sold);
  const totalInvested = activeCards.reduce((s, c) => s + (c.buy || 0) * (c.qty || 1), 0);
  const currentValue = activeCards.reduce((s, c) => s + (c.val || 0) * (c.qty || 1), 0);
  const unrealizedGL = currentValue - totalInvested;
  const realizedPL = soldCards.reduce((s, c) => s + ((c.soldPrice || 0) - (c.buy || 0)) * (c.qty || 1), 0);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    try {
      setPasswordLoading(true);
      await api.changePassword(currentPassword, newPassword);
      Alert.alert('Success', 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPassSection(false);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          try {
            setIsLoading(true);
            await logout();
          } catch {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await api.deleteAccount();
              router.replace('/');
            } catch {
              Alert.alert('Error', 'Failed to delete account.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <Text style={s.pageTitle}>SETTINGS</Text>
        <Text style={s.pageSub}>Account & preferences</Text>
      </View>


      {/* ── Account ─────────────────────────────────────────── */}
      <SectionLabel text="ACCOUNT" />
      <View style={s.box}>
        <View style={s.accountRow}>
          <View style={s.avatar}>
            <Text style={s.avatarInitial}>
              {(displayName?.[0] || user?.username?.[0] || '?').toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.accountName}>{displayName || user?.username || '—'}</Text>
            <Text style={s.accountEmail}>{user?.email ?? '—'}</Text>
          </View>
        </View>
      </View>

      {/* ── Your Name ───────────────────────────────────────── */}
      <SectionLabel text="YOUR NAME" />
      <View style={s.box}>
        <TouchableOpacity
          style={s.settingsRow}
          onPress={() => { setNameInput(displayName); setShowNameEdit(v => !v); }}
        >
          <View style={s.settingsRowIcon}>
            <Ionicons name="person-outline" size={16} color="#a855f7" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.settingsRowLabel}>Display Name</Text>
            <Text style={{ fontSize: 12, color: '#888888', fontWeight: '500', marginTop: 1 }}>
              {displayName || 'Not set'}
            </Text>
          </View>
          <Ionicons
            name={showNameEdit ? 'chevron-up' : 'chevron-down'}
            size={16} color="#888888"
          />
        </TouchableOpacity>

        {showNameEdit && (
          <View>
            <Divider />
            <View style={{ padding: 14, gap: 10 }}>
              <TextInput
                style={s.passInput}
                placeholder="Enter your name"
                placeholderTextColor="#888888"
                value={nameInput}
                onChangeText={setNameInput}
                editable={!nameSaving}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
              />
              <TouchableOpacity
                style={[s.passBtn, nameSaving && { opacity: 0.6 }]}
                onPress={handleSaveName}
                disabled={nameSaving}
              >
                {nameSaving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.passBtnText}>Save Name</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── Collection Snapshot ─────────────────────────────── */}
      <SectionLabel text="COLLECTION SNAPSHOT" />
      <View style={s.statsGrid}>
        <StatTile label="Active Cards" value={String(activeCards.length)} />
        <StatTile label="Sold Cards" value={String(soldCards.length)} />
        <StatTile label="Invested" value={fmt(totalInvested)} />
        <StatTile label="Value" value={fmt(currentValue)} />
        <StatTile
          label="Unrealized G/L"
          value={`${unrealizedGL >= 0 ? '+' : ''}${fmt(unrealizedGL)}`}
          valueColor={unrealizedGL >= 0 ? '#22c55e' : '#ef4444'}
        />
        <StatTile
          label="Realized P&L"
          value={`${realizedPL >= 0 ? '+' : ''}${fmt(realizedPL)}`}
          valueColor={realizedPL >= 0 ? '#22c55e' : '#ef4444'}
        />
      </View>

      {/* ── Share ───────────────────────────────────────────── */}
      <SectionLabel text="SHARE" />
      <View style={s.box}>
        <View style={s.shareRow}>
          <View style={s.shareIcon}>
            <Ionicons name="link" size={16} color="#a855f7" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.shareTitle}>Your Collection Link</Text>
            <Text style={s.shareUrl}>toploadcards.com/share/{user?.username}</Text>
          </View>
        </View>
        <Divider />
        <View style={s.shareButtons}>
          <TouchableOpacity
            style={s.shareCopyBtn}
            onPress={() => Share.share({
              message: `Check out my card collection on TopLoad! toploadcards.com/share/${user?.username ?? ''}`,
              url: `https://toploadcards.com/share/${user?.username ?? ''}`,
            })}
          >
            <Ionicons name="share-outline" size={14} color="#fff" />
            <Text style={s.shareCopyText}>Share Collection</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.sharePreviewBtn}
            onPress={() => Share.share({
              message: `Check out my card collection on TopLoad! toploadcards.com/share/${user?.username ?? ''}`,
              url: `https://toploadcards.com/share/${user?.username ?? ''}`,
            })}
          >
            <Ionicons name="copy-outline" size={14} color="#aaa" />
            <Text style={s.sharePreviewText}>Copy Link</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Security ────────────────────────────────────────── */}
      <SectionLabel text="SECURITY" />
      <View style={s.box}>
        <TouchableOpacity
          style={s.settingsRow}
          onPress={() => setShowPassSection(v => !v)}
        >
          <View style={s.settingsRowIcon}>
            <Ionicons name="lock-closed" size={16} color="#a855f7" />
          </View>
          <Text style={s.settingsRowLabel}>Change Password</Text>
          <Ionicons
            name={showPassSection ? 'chevron-up' : 'chevron-down'}
            size={16} color="#888888"
          />
        </TouchableOpacity>

        {showPassSection && (
          <View style={s.passSection}>
            <Divider />
            <View style={{ padding: 14, gap: 10 }}>
              <TextInput
                style={s.passInput}
                placeholder="Current Password"
                placeholderTextColor="#888888"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                editable={!passwordLoading}
              />
              <TextInput
                style={s.passInput}
                placeholder="New Password (8+ characters)"
                placeholderTextColor="#888888"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                editable={!passwordLoading}
              />
              <TextInput
                style={s.passInput}
                placeholder="Confirm New Password"
                placeholderTextColor="#888888"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!passwordLoading}
              />
              <TouchableOpacity
                style={[s.passBtn, passwordLoading && { opacity: 0.6 }]}
                onPress={handleChangePassword}
                disabled={passwordLoading}
              >
                {passwordLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.passBtnText}>Update Password</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── More ────────────────────────────────────────────── */}
      <SectionLabel text="MORE" />
      <View style={s.box}>
        <TouchableOpacity
          style={s.settingsRow}
          onPress={() => Alert.alert('Support', 'support@toploadcards.com')}
        >
          <View style={s.settingsRowIcon}>
            <Ionicons name="mail-outline" size={16} color="#a855f7" />
          </View>
          <Text style={s.settingsRowLabel}>Contact Support</Text>
          <Ionicons name="chevron-forward" size={16} color="#888888" />
        </TouchableOpacity>
        <Divider />
        <View style={s.settingsRow}>
          <View style={s.settingsRowIcon}>
            <Ionicons name="information-circle-outline" size={16} color="#a855f7" />
          </View>
          <Text style={s.settingsRowLabel}>App Version</Text>
          <Text style={s.settingsRowValue}>1.0.0</Text>
        </View>
      </View>

      {/* ── Account Actions ─────────────────────────────────── */}
      <SectionLabel text="ACCOUNT ACTIONS" />
      <View style={s.box}>
        <TouchableOpacity style={s.settingsRow} onPress={handleLogout} disabled={isLoading}>
          <View style={[s.settingsRowIcon, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
            <Ionicons name="log-out-outline" size={16} color="#f0f0f0" />
          </View>
          <Text style={[s.settingsRowLabel, { color: '#f0f0f0' }]}>Sign Out</Text>
          {isLoading
            ? <ActivityIndicator size="small" color="#bbbbbb" />
            : <Ionicons name="chevron-forward" size={16} color="#888888" />}
        </TouchableOpacity>
        <Divider />
        <TouchableOpacity style={s.settingsRow} onPress={handleDeleteAccount} disabled={isLoading}>
          <View style={[s.settingsRowIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
          </View>
          <Text style={[s.settingsRowLabel, { color: '#ef4444' }]}>Delete Account</Text>
          <Ionicons name="chevron-forward" size={16} color="#888888" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return <Text style={{ color: '#c084fc', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 10, marginTop: 20, paddingHorizontal: 16 }}>{text}</Text>;
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: '#2a2a2a' }} />;
}

function StatTile({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={[s_stat.tile, { backgroundColor: '#111111', borderColor: '#2a2a2a' }]}>
      <Text style={[s_stat.value, { color: valueColor ?? '#f0f0f0' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={[s_stat.label, { color: '#888888' }]}>{label}</Text>
    </View>
  );
}

const s_stat = StyleSheet.create({
  tile: { width: '30.5%', borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  value: { fontSize: 13, fontWeight: '900', marginBottom: 4, textAlign: 'center' },
  label: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
});

// ── Styles ───────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

  header: { paddingHorizontal: 16, paddingBottom: 16 },
  pageTitle: { fontSize: 28, fontWeight: '900', color: '#f0f0f0', letterSpacing: 1.5, marginBottom: 4 },
  pageSub: { fontSize: 13, color: '#888888', fontWeight: '600' },

  sectionLabel: {
    color: '#a855f7', fontSize: 10, fontWeight: '800',
    letterSpacing: 2, marginBottom: 10, marginTop: 20, paddingHorizontal: 16,
  },

  box: {
    marginHorizontal: 16,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    overflow: 'hidden',
  },

  divider: { height: 1, backgroundColor: '#2a2a2a' },

  // Account row
  accountRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#3b1d6e', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '900', color: '#c084fc' },
  accountName: { fontSize: 15, fontWeight: '800', color: '#f0f0f0', marginBottom: 2 },
  accountEmail: { fontSize: 12, color: '#888888', fontWeight: '500' },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  statTile: {
    width: '30.5%',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 13, fontWeight: '900', color: '#fff', marginBottom: 4, textAlign: 'center' },
  statLabel: { fontSize: 10, color: '#888888', fontWeight: '600', textAlign: 'center' },

  // Share
  shareRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  shareIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(147,51,234,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  shareTitle: { fontSize: 13, fontWeight: '700', color: '#f0f0f0', marginBottom: 2 },
  shareUrl: { fontSize: 11, color: '#9333ea', fontFamily: 'monospace' },
  shareButtons: { flexDirection: 'row', padding: 12, gap: 10 },
  shareCopyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#9333ea', borderRadius: 10, paddingVertical: 10,
  },
  shareCopyText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  sharePreviewBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#2a2a2a', borderRadius: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  sharePreviewText: { color: '#bbbbbb', fontSize: 13, fontWeight: '700' },

  // Settings rows
  settingsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 14, gap: 12,
  },
  settingsRowIcon: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: 'rgba(147,51,234,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  settingsRowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#bbbbbb' },
  settingsRowValue: { fontSize: 13, color: '#888888', fontWeight: '600' },

  // Password section
  passSection: {},
  passInput: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1, borderColor: '#2a2a2a',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    color: '#f0f0f0', fontSize: 14,
  },
  passBtn: {
    backgroundColor: '#9333ea', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 2,
  },
  passBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

});
