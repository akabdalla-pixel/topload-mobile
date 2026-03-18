import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Text,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '@/context/data';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PAD = 16;
const CONTENT = SCREEN_WIDTH - PAD * 2;
const HALF = (CONTENT - 10) / 2;

const SPORT_COLORS: Record<string, string> = {
  Baseball: '#ec4899',
  Football: '#3b82f6',
  Basketball: '#f97316',
  Hockey: '#06b6d4',
  Soccer: '#10b981',
  Other: '#8b5cf6',
};

type Card = {
  id: string;
  player: string;
  sport: string;
  year: string;
  buy: number;
  val: number;
  qty: number;
  grade?: string;
  gradingCo?: string;
  brand: string;
  sold?: boolean;
  soldPrice?: number;
  createdAt: string;
};


export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const { cards, initialLoading, refresh } = useData();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // ── All hooks above early returns ────────────────────────────────

  const stats = useMemo(() => {
    const unsold = cards.filter((c) => !c.sold);
    const sold = cards.filter((c) => c.sold);
    const q = (c: Card) => c.qty || 1;
    const invested = unsold.reduce((s, c) => s + (c.buy || 0) * q(c), 0);
    const value = unsold.reduce((s, c) => s + (c.val || 0) * q(c), 0);
    const ugl = value - invested;
    const roi = invested > 0 ? (ugl / invested) * 100 : 0;
    const realized = sold.reduce((s, c) => s + ((c.soldPrice || 0) - (c.buy || 0)) * q(c), 0);
    return { total: unsold.length, soldCount: sold.length, invested, value, ugl, roi, realized };
  }, [cards]);

  const top5 = useMemo(() =>
    cards.filter((c) => !c.sold)
      .map((c) => ({ ...c, tv: (c.val || 0) * (c.qty || 1) }))
      .sort((a, b) => b.tv - a.tv).slice(0, 5),
  [cards]);

  const sportBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    cards.forEach((c) => { if (!c.sold && c.sport) m[c.sport] = (m[c.sport] || 0) + (c.qty || 1); });
    return Object.entries(m).map(([s, n]) => ({ s, n })).sort((a, b) => b.n - a.n).slice(0, 6);
  }, [cards]);

  const gradingStats = useMemo(() => {
    const unsold = cards.filter((c) => !c.sold);
    const graded = unsold.filter((c) => c.grade && c.grade.trim() && c.grade !== 'Raw').length;
    const raw = unsold.length - graded;
    const total = unsold.length || 1;
    return { graded, raw, gPct: ((graded / total) * 100).toFixed(0), rPct: ((raw / total) * 100).toFixed(0) };
  }, [cards]);

  const valueDist = useMemo(() => {
    const b: [string, number][] = [['<$50', 0], ['$50–$200', 0], ['$200–$500', 0], ['$500–$1k', 0], '>$1k'];
    const buckets: Record<string, number> = { '<$50': 0, '$50–$200': 0, '$200–$500': 0, '$500–$1k': 0, '>$1k': 0 };
    cards.forEach((c) => {
      if (!c.sold) {
        const v = c.val || 0;
        if (v < 50) buckets['<$50']++;
        else if (v < 200) buckets['$50–$200']++;
        else if (v < 500) buckets['$200–$500']++;
        else if (v < 1000) buckets['$500–$1k']++;
        else buckets['>$1k']++;
      }
    });
    return buckets;
  }, [cards]);

  const yearBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    cards.forEach((c) => { if (!c.sold && c.year) m[c.year] = (m[c.year] || 0) + (c.qty || 1); });
    return Object.entries(m).map(([y, n]) => ({ y, n })).sort((a, b) => parseInt(b.y) - parseInt(a.y)).slice(0, 6);
  }, [cards]);

  const monthBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    cards.forEach((c) => {
      if (!c.createdAt) return;
      const d = new Date(c.createdAt);
      if (isNaN(d.getTime())) return;
      const k = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      m[k] = (m[k] || 0) + (c.qty || 1);
    });
    return Object.entries(m).map(([mo, n]) => ({ mo, n })).slice(-6);
  }, [cards]);

  const brandBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    cards.forEach((c) => { if (!c.sold && c.brand) m[c.brand] = (m[c.brand] || 0) + (c.qty || 1); });
    return Object.entries(m).map(([br, n]) => ({ br, n })).sort((a, b) => b.n - a.n).slice(0, 5);
  }, [cards]);

  const pr = useMemo(() => {
    const unsold = cards.filter((c) => !c.sold);
    const sold = cards.filter((c) => c.sold);
    const q = (c: Card) => c.qty || 1;
    let mv: Card | null = null, bw: Card | null = null, me: Card | null = null;
    unsold.forEach((c) => {
      if (!mv || (c.val || 0) * q(c) > (mv.val || 0) * q(mv)) mv = c;
      if (!me || (c.buy || 0) > (me.buy || 0)) me = c;
      const gp = (c.buy || 0) > 0 ? ((c.val || 0) - (c.buy || 0)) / c.buy * 100 : 0;
      const bp = bw && (bw.buy || 0) > 0 ? ((bw.val || 0) - (bw.buy || 0)) / bw.buy * 100 : -Infinity;
      if (gp > bp) bw = c;
    });
    let bf: Card | null = null; let bfp = 0; // only profitable flips qualify (profit must be > 0)
    sold.forEach((c) => { const p = (c.soldPrice || 0) - (c.buy || 0); if (p > bfp) { bf = c; bfp = p; } });
    let la: Card | null = null;
    cards.forEach((c) => { if (!c.createdAt) return; if (!la || new Date(c.createdAt) > new Date(la.createdAt || 0)) la = c; });
    const ts = sportBreakdown.length > 0 ? sportBreakdown[0] : null;
    return {
      mv: mv as Card | null, bw: bw as Card | null, me: me as Card | null,
      bf: bf as Card | null, la: la as Card | null, ts,
    };
  }, [cards, sportBreakdown]);

  // ── Early returns ────────────────────────────────────────────────

  if (initialLoading && cards.length === 0) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#9333ea" />
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <View style={s.container}>
        <ScrollView
          contentContainerStyle={[s.emptyWrap, { paddingTop: insets.top + 32 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9333ea" />}
        >
          <Text style={s.emptyEmoji}>📊</Text>
          <Text style={s.emptyTitle}>No Insights Yet</Text>
          <Text style={s.emptyBody}>Add cards to your collection to see portfolio analytics here.</Text>
        </ScrollView>
      </View>
    );
  }

  const maxTop5 = top5[0]?.tv || 1;
  const maxSport = sportBreakdown[0]?.n || 1;
  const maxDist = Math.max(...Object.values(valueDist), 1);
  const maxYear = yearBreakdown[0]?.n || 1;
  const maxMonth = monthBreakdown[0]?.n || 1;
  const maxBrand = brandBreakdown[0]?.n || 1;

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#9333ea" />}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Page Header ─────────────────────────────────────── */}
        <Text style={s.pageTitle}>INSIGHTS</Text>
        <Text style={s.pageSub}>Your portfolio at a glance</Text>

        {/* ── Portfolio Overview ──────────────────────────────── */}
        <SectionLabel text="PORTFOLIO OVERVIEW" />
        <View style={s.twoRow}>
          <AccentCard
            accent="#9333ea"
            label="PORTFOLIO VALUE"
            value={`$${stats.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            sub={`${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}% ROI`}
            subColor={stats.roi >= 0 ? '#22c55e' : '#ef4444'}
          />
          <AccentCard
            accent={stats.ugl >= 0 ? '#22c55e' : '#ef4444'}
            label="UNREALIZED G/L"
            value={`${stats.ugl >= 0 ? '+' : '-'}$${Math.abs(stats.ugl).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            valueColor={stats.ugl >= 0 ? '#22c55e' : '#ef4444'}
          />
        </View>
        <View style={s.twoRow}>
          <AccentCard
            accent="#888888"
            label="TOTAL INVESTED"
            value={`$${stats.invested.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            sub={`${stats.total} active cards`}
          />
          <AccentCard
            accent={stats.realized >= 0 ? '#22c55e' : '#ef4444'}
            label="REALIZED P&L"
            value={`${stats.realized >= 0 ? '+' : '-'}$${Math.abs(stats.realized).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            valueColor={stats.realized >= 0 ? '#22c55e' : '#ef4444'}
            sub={`${stats.soldCount} sold`}
          />
        </View>
        <View style={s.twoRow}>
          <AccentCard accent="#9333ea" label="GRADED" value={gradingStats.graded.toString()} sub={`${gradingStats.gPct}% of collection`} />
          <AccentCard accent="#888888" label="RAW" value={gradingStats.raw.toString()} sub={`${gradingStats.rPct}% of collection`} />
        </View>

        {/* ── Personal Records ────────────────────────────────── */}
        <SectionLabel text="PERSONAL RECORDS" />
        <View style={s.box}>
          <PRRow emoji="👑" label="Most Valuable" name={pr.mv?.player} sub={pr.mv ? `$${((pr.mv.val || 0) * (pr.mv.qty || 1)).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null} subColor="#22c55e" />
          <Divider />
          <PRRow emoji="📈" label="Biggest Win %" name={pr.bw?.player} sub={pr.bw && pr.bw.buy > 0 ? `+${(((pr.bw.val - pr.bw.buy) / pr.bw.buy) * 100).toFixed(1)}%` : null} subColor="#22c55e" />
          <Divider />
          <PRRow emoji="💸" label="Most Expensive Buy" name={pr.me?.player} sub={pr.me ? `$${(pr.me.buy || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} paid` : null} subColor="#bbbbbb" />
          <Divider />
          <PRRow emoji="🔥" label="Best Flip" name={pr.bf?.player || '—'} sub={pr.bf ? `+$${((pr.bf.soldPrice || 0) - (pr.bf.buy || 0)).toLocaleString('en-US', { maximumFractionDigits: 0 })} profit` : null} subColor="#22c55e" />
          <Divider />
          <PRRow emoji="🏆" label="Top Sport" name={pr.ts?.s || '—'} sub={pr.ts ? `${pr.ts.n} cards` : null} subColor="#eab308" />
          <Divider />
          <PRRow emoji="🆕" label="Latest Add" name={pr.la?.player} sub={pr.la?.createdAt ? new Date(pr.la.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null} subColor="#bbbbbb" last />
        </View>

        {/* ── Top 5 Most Valuable ─────────────────────────────── */}
        {top5.length > 0 && (
          <>
            <SectionLabel text="TOP 5 MOST VALUABLE" />
            <View style={s.box}>
              {top5.map((c, i) => {
                const gain = ((c.val || 0) - (c.buy || 0)) * (c.qty || 1);
                return (
                  <View key={c.id}>
                    <View style={s.top5Row}>
                      <Text style={s.top5Rank}>{i + 1}</Text>
                      <View style={s.top5Mid}>
                        <Text style={s.top5Name} numberOfLines={1}>{c.player}</Text>
                        <View style={s.barTrack}>
                          <View style={[s.barFill, { width: `${(c.tv / maxTop5) * 100}%`, backgroundColor: '#9333ea' }]} />
                        </View>
                      </View>
                      <View style={s.top5Right}>
                        <Text style={s.top5Val}>${c.tv.toLocaleString('en-US', { maximumFractionDigits: 0 })}</Text>
                        <Text style={[s.top5Gain, { color: gain >= 0 ? '#22c55e' : '#ef4444' }]}>
                          {gain >= 0 ? '+' : ''}${gain.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </Text>
                      </View>
                    </View>
                    {i < top5.length - 1 && <Divider />}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── Sport Breakdown ──────────────────────────────────── */}
        {sportBreakdown.length > 0 && (
          <>
            <SectionLabel text="SPORT BREAKDOWN" />
            <View style={s.box}>
              {sportBreakdown.map((item, i) => {
                const col = SPORT_COLORS[item.s] || '#9333ea';
                const pct = ((item.n / Math.max(stats.total, 1)) * 100).toFixed(0);
                return (
                  <View key={item.s}>
                    <View style={s.chartRow}>
                      <View style={[s.sportDot, { backgroundColor: col }]} />
                      <Text style={s.chartLabel}>{item.s}</Text>
                      <View style={s.barTrack}>
                        <View style={[s.barFill, { width: `${(item.n / maxSport) * 100}%`, backgroundColor: col }]} />
                      </View>
                      <Text style={s.chartCount}>{pct}%</Text>
                    </View>
                    {i < sportBreakdown.length - 1 && <Divider />}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── Value Distribution ───────────────────────────────── */}
        {Object.values(valueDist).some((v) => v > 0) && (
          <>
            <SectionLabel text="VALUE DISTRIBUTION" />
            <View style={s.box}>
              {Object.entries(valueDist).map(([bucket, count], i, arr) => (
                <View key={bucket}>
                  <View style={s.chartRow}>
                    <Text style={s.chartLabel}>{bucket}</Text>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${(count / maxDist) * 100}%`, backgroundColor: '#9333ea' }]} />
                    </View>
                    <Text style={s.chartCount}>{count}</Text>
                  </View>
                  {i < arr.length - 1 && <Divider />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Top Brands ───────────────────────────────────────── */}
        {brandBreakdown.length > 0 && (
          <>
            <SectionLabel text="TOP BRANDS" />
            <View style={s.box}>
              {brandBreakdown.map((item, i) => (
                <View key={item.br}>
                  <View style={s.chartRow}>
                    <Text style={s.chartLabel}>{item.br}</Text>
                    <View style={s.barTrack}>
                      <View style={[s.barFill, { width: `${(item.n / maxBrand) * 100}%`, backgroundColor: '#f97316' }]} />
                    </View>
                    <Text style={s.chartCount}>{item.n}</Text>
                  </View>
                  {i < brandBreakdown.length - 1 && <Divider />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Cards by Year + Added by Month ───────────────────── */}
        {(yearBreakdown.length > 0 || monthBreakdown.length > 0) && (
          <View style={s.twoColSection}>
            {yearBreakdown.length > 0 && (
              <View style={s.halfBox}>
                <Text style={s.halfBoxTitle}>BY YEAR</Text>
                {yearBreakdown.map((item) => (
                  <View key={item.y} style={s.halfChartRow}>
                    <Text style={s.halfChartLabel}>{item.y}</Text>
                    <View style={s.halfBarTrack}>
                      <View style={[s.barFill, { width: `${(item.n / maxYear) * 100}%`, backgroundColor: '#9333ea' }]} />
                    </View>
                    <Text style={s.halfChartCount}>{item.n}</Text>
                  </View>
                ))}
              </View>
            )}
            {monthBreakdown.length > 0 && (
              <View style={s.halfBox}>
                <Text style={s.halfBoxTitle}>BY MONTH</Text>
                {monthBreakdown.map((item) => (
                  <View key={item.mo} style={s.halfChartRow}>
                    <Text style={s.halfChartLabel}>{item.mo}</Text>
                    <View style={s.halfBarTrack}>
                      <View style={[s.barFill, { width: `${(item.n / maxMonth) * 100}%`, backgroundColor: '#9333ea' }]} />
                    </View>
                    <Text style={s.halfChartCount}>{item.n}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ── Reusable components ──────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return (
    <Text style={{ color: '#c084fc', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 10, marginTop: 8 }}>
      {text}
    </Text>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: '#2a2a2a' }} />;
}

function AccentCard({
  accent, label, value, valueColor, sub, subColor,
}: {
  accent: string; label: string; value: string;
  valueColor?: string; sub?: string; subColor?: string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: '#111111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 14, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: accent }} />
      <Text style={{ color: '#888888', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 4 }}>{label}</Text>
      <Text style={{ fontSize: 20, fontWeight: '900', color: valueColor ?? '#f0f0f0', marginBottom: 2 }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 11, fontWeight: '600', color: subColor ?? '#bbbbbb' }}>{sub}</Text> : null}
    </View>
  );
}

function PRRow({
  emoji, label, name, sub, subColor,
}: {
  emoji: string; label: string; name?: string; sub: string | null; subColor?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 10 }}>
      <Text style={{ fontSize: 18, width: 26, textAlign: 'center' }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 9, fontWeight: '700', color: '#888888', letterSpacing: 0.8, marginBottom: 3 }}>{label}</Text>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#f0f0f0' }} numberOfLines={1}>{name || '—'}</Text>
      </View>
      {sub ? <Text style={{ fontSize: 12, fontWeight: '700', textAlign: 'right', color: subColor ?? '#bbbbbb' }}>{sub}</Text> : null}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { paddingHorizontal: PAD, paddingBottom: 24 },

  // Empty
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: PAD },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f0f0f0', marginBottom: 8 },
  emptyBody: { fontSize: 14, color: '#888888', textAlign: 'center', lineHeight: 20 },

  // Page header
  pageTitle: { fontSize: 28, fontWeight: '900', color: '#f0f0f0', letterSpacing: 1.5, marginBottom: 4 },
  pageSub: { fontSize: 13, color: '#888888', fontWeight: '600', marginBottom: 24 },

  // Section label (like dashboard's SIMPLE BY DESIGN label)
  sectionLabel: {
    color: '#a855f7',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 8,
  },

  // Two-card row
  twoRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },

  // Accent stat card (matches dashboard mockup cards exactly)
  accentCard: {
    flex: 1,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 14,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
  },
  accentLabel: {
    color: '#888888', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 4,
  },
  accentValue: {
    fontSize: 20, fontWeight: '900', color: '#f0f0f0', marginBottom: 2,
  },
  accentSub: {
    fontSize: 11, fontWeight: '600', color: '#bbbbbb',
  },

  // Gray box container
  box: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 6,
  },

  // Divider inside box
  divider: { height: 1, backgroundColor: '#2a2a2a' },

  // Personal Records rows
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  prEmoji: { fontSize: 18, width: 26, textAlign: 'center' },
  prMid: { flex: 1 },
  prLabel: { fontSize: 9, fontWeight: '700', color: '#888888', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 },
  prName: { fontSize: 14, fontWeight: '700', color: '#f0f0f0' },
  prSub: { fontSize: 12, fontWeight: '700', textAlign: 'right' },

  // Top 5 rows
  top5Row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  top5Rank: { fontSize: 14, fontWeight: '900', color: '#9333ea', width: 20, textAlign: 'center' },
  top5Mid: { flex: 1, gap: 6 },
  top5Name: { fontSize: 13, fontWeight: '700', color: '#f0f0f0' },
  top5Right: { alignItems: 'flex-end', gap: 2 },
  top5Val: { fontSize: 13, fontWeight: '800', color: '#f0f0f0' },
  top5Gain: { fontSize: 11, fontWeight: '700' },

  // Chart rows inside box
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 10,
  },
  chartLabel: { fontSize: 12, fontWeight: '600', color: '#bbbbbb', width: 70 },
  chartCount: { fontSize: 12, fontWeight: '700', color: '#f0f0f0', width: 36, textAlign: 'right' },
  sportDot: { width: 8, height: 8, borderRadius: 4 },

  // Shared bar
  barTrack: { flex: 1, height: 5, backgroundColor: '#2a2a2a', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },

  // Two-column Year/Month section
  twoColSection: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  halfBox: {
    flex: 1,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 14,
    overflow: 'hidden',
  },
  halfBoxTitle: {
    color: '#888888', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 12,
  },
  halfChartRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
  halfChartLabel: { fontSize: 11, color: '#bbbbbb', fontWeight: '600', width: 34 },
  halfBarTrack: { flex: 1, height: 4, backgroundColor: '#2a2a2a', borderRadius: 2, overflow: 'hidden' },
  halfChartCount: { fontSize: 11, fontWeight: '700', color: '#f0f0f0', width: 16, textAlign: 'right' },
});
