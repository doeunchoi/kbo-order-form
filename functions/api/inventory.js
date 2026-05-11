// GET /api/inventory — 잔여구좌 조회
export async function onRequestGet(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const db = context.env.DB;
    const [expMonthly, inventory] = await Promise.all([
      buildExpMonthly(db),
      buildInventory(db),
    ]);
    return Response.json({
      ok: true, expMonthly, inventory,
      ts: new Date().toISOString(),
    }, { headers: corsHeaders });

  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

// ── 노출형 집계 ──────────────────────────────────────────────
async function buildExpMonthly(db) {
  const { results } = await db.prepare(`
    SELECT month, product, quota, week, team, advertiser
FROM exposure_orders
WHERE COALESCE(status, '활성') IN ('활성', '낙찰', '확정')
  `).all();

  const map = {};
  for (const r of (results||[])) {
    const mk = monthLabelToKey(r.month);
    if (!mk) continue;

    const k1 = `${mk}__${r.product}`;
    if (!map[k1]) map[k1] = { used:0, advertisers:[] };
    map[k1].used += (r.quota||1);
    if (r.advertiser) map[k1].advertisers.push(r.advertiser);

    if (r.week) {
      const k2 = `${mk}__${r.product}__${r.week}`;
      if (!map[k2]) map[k2] = { used:0, advertisers:[] };
      map[k2].used += (r.quota||1);
      if (r.advertiser) map[k2].advertisers.push(r.advertiser);
    }
    if (r.team) {
      const k3 = `${mk}__${r.product}__${r.team}`;
      if (!map[k3]) map[k3] = { used:0, advertisers:[] };
      map[k3].used += (r.quota||1);
      if (r.advertiser) map[k3].advertisers.push(r.advertiser);
    }
  }
  return map;
}

// ── 기획형 집계 ──────────────────────────────────────────────
async function buildInventory(db) {
  const { results } = await db.prepare(`
    SELECT category, product, date_month, quota, advertiser
FROM planning_orders
WHERE COALESCE(status, '활성') IN ('활성', '낙찰', '확정')
  `).all();

  const codeMap = {
    'PPL — 기획':'sm_ppl','PPL — 이벤트':'sm_ppl',
    'PPL — 기능':'sm_ppl','PPL — 단순':'sm_ppl',
    '메인 디스플레이 PPL':'sm_main_display',
    '빅 가상광고':'sm_big_vr',
    '풀프레임 가상광고':'fd_fullframe_vr',
    '협찬고지':'fd_sponsor',
    '하이라이트 클립 범퍼':'clip_monthly',
  };
  const totalMap = {
    sm_ppl:1, sm_main_display:1, sm_big_vr:6,
    fd_ppl:1, fd_fullframe_vr:1, fd_sponsor:1, clip_monthly:1,
  };

  const invMap = {};
  for (const r of (results||[])) {
    let code = codeMap[r.product] || null;
    if (!code) {
      if (r.category==='슈퍼매치'&&(r.product||'').includes('PPL')) code='sm_ppl';
      else if (r.category==='팬덤중계'&&(r.product||'').includes('PPL')) code='fd_ppl';
      else if (r.category==='클립') code='clip_monthly';
    }
    if (!code||!r.date_month) continue;

    const key = `${code}_${r.date_month}`;
    if (!invMap[key]) invMap[key] = { code, date:r.date_month, reserved:0, advertisers:[] };
    invMap[key].reserved += (r.quota||1);
    if (r.advertiser) invMap[key].advertisers.push(r.advertiser);
  }

  return Object.values(invMap).map(item => ({
    ...item,
    total: totalMap[item.code]||1,
    remaining: Math.max(0, (totalMap[item.code]||1) - item.reserved),
  }));
}

function monthLabelToKey(label) {
  if (!label) return null;

  const s = String(label);

  if (s.includes('3~4월')) return '3~4월 통합';

  if (/^\d{4}-\d{2}$/.test(s)) return s;

  const m1 = s.match(/(\d{4})년\s*(\d{1,2})월/);
  if (m1) return `${m1[1]}-${String(m1[2]).padStart(2,'0')}`;

  const m2 = s.match(/(\d{4})[-./](\d{1,2})/);
  if (m2) return `${m2[1]}-${String(m2[2]).padStart(2,'0')}`;

  return null;
}
