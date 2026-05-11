// POST /api/order — 청약 폼 제출 → D1 저장
export async function onRequestPost(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const p  = await context.request.json();
    const db = context.env.DB;
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);

    if (p.type === '노출형') await writeExposure(db, p, ts);
    else if (p.type === '기획형') await writePlanning(db, p, ts);
    else if (p.type === '문의')   await writeInquiry(db, p, ts);

    return Response.json({ ok: true, ts }, { headers: corsHeaders });

  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// OPTIONS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}

// ── 노출형 저장 ──────────────────────────────────────────────
async function writeExposure(db, p, ts) {
  const items = (p.items && p.items.length) ? p.items : [{}];
  for (const item of items) {
    await db.prepare(`
      INSERT INTO exposure_orders
        (submitted_at, month, advertiser, brand, agency, media_rep,
         billing_entity, billing_month, contact_name, contact_email, contact_org,
         tas_status, tas_corp, tas_biz_num, tas_mgr_name, tas_mgr_email,
         product, duration, quota, week, team, amount, jbp, kbo_pass, note)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      p.timestamp||ts, p.month||'',
      p.advertiser||'', p.brand||'', p.agency||'', p.media_rep||'',
      p.billing_entity||'', p.billing_month||'',
      p.contact_name||'', p.contact_email||'', p.contact_org||'',
      p.tas_status||'', p.tas_corp_name||null, p.tas_biz_num||null,
      p.tas_mgr_name||null, p.tas_mgr_email||null,
      item.product||null, item.duration||null, item.quota||null,
      item.week||null, item.team||null, item.amount||null,
      p.jbp||'N', p.kbo_pass||'N', p.note||null
    ).run();
  }
}

// ── 기획형 저장 ──────────────────────────────────────────────
async function writePlanning(db, p, ts) {
  const base = [
    p.advertiser||'', p.brand||'', p.agency||'', p.media_rep||'',
    p.billing_entity||'', p.billing_month||'',
    p.contact_name||'', p.contact_email||'', p.contact_org||'',
    p.jbp||'N', p.note||null,
  ];

  if (p.mode === 'pkg') {
    await db.prepare(`
      INSERT INTO planning_orders
        (submitted_at, order_type, product, pkg_type, pkg_team, pkg_start, pkg_end,
         advertiser, brand, agency, media_rep, billing_entity, billing_month,
         contact_name, contact_email, contact_org, jbp, note)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      p.timestamp||ts, '패키지',
      p.pkg||'', p.pkg||'', p.pkg_team||null,
      p.pkg_start||null, p.pkg_end||null,
      ...base
    ).run();
    return;
  }

  for (const item of (p.items||[])) {
    await db.prepare(`
      INSERT INTO planning_orders
        (submitted_at, order_type, category, product, date_month, quota, amount,
         advertiser, brand, agency, media_rep, billing_entity, billing_month,
         contact_name, contact_email, contact_org, jbp, note)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      p.timestamp||ts, '단일',
      item.category||'', item.product||'', item.date||null,
      item.quota||1, item.price||0,
      ...base
    ).run();
  }

  if (p.clip_type) {
    const units = parseInt(p.clip_units||0);
    const amt   = p.clip_type==='monthly' ? 100000000 : Math.ceil(units/20)*20000000;
    await db.prepare(`
      INSERT INTO planning_orders
        (submitted_at, order_type, category, product, date_month, quota, amount,
         advertiser, brand, agency, media_rep, billing_entity, billing_month,
         contact_name, contact_email, contact_org, jbp, note)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      p.timestamp||ts, '단일', '클립', '하이라이트 클립 범퍼',
      p.clip_month||null, units||1, amt,
      ...base
    ).run();
  }
}

// ── 문의 저장 ────────────────────────────────────────────────
async function writeInquiry(db, p, ts) {
  await db.prepare(
    `INSERT INTO inquiries (company, contact_name, email, message) VALUES (?,?,?,?)`
  ).bind(p.company||'', p.name||'', p.email||'', p.msg||'').run();
}
