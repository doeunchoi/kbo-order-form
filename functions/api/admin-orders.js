export async function onRequestGet(context) {
  const { env } = context;

  try {
    const exposure = await env.DB.prepare(`
      SELECT 'exposure' AS type, *
      FROM exposure_orders
      ORDER BY id DESC
    `).all();

    const planning = await env.DB.prepare(`
      SELECT 'planning' AS type, *
      FROM planning_orders
      ORDER BY id DESC
    `).all();

    return Response.json({
      ok: true,
      data: [
        ...(exposure.results || []),
        ...(planning.results || [])
      ]
    });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function onRequestPatch(context) {
  const { request, env } = context;

  try {
    const { type, id, status } = await request.json();

    const table =
      type === 'exposure' ? 'exposure_orders' :
      type === 'planning' ? 'planning_orders' :
      null;

    if (!table) throw new Error('Invalid type');

    await env.DB.prepare(`
      UPDATE ${table}
      SET status = ?
      WHERE id = ?
    `).bind(status, id).run();

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
