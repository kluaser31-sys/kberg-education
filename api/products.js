// Fonction serverless Vercel : lit les produits PUBLIÉS de la boutique Chariow.
// La clé API reste côté serveur (variable d'environnement CHARIOW_API_KEY), jamais dans le site.
const strip = h => String(h || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();

module.exports = async (req, res) => {
  const key = process.env.CHARIOW_API_KEY;
  if (!key) return res.status(500).json({ products: [], error: "CHARIOW_API_KEY manquante" });
  try {
    const out = [];
    let cursor = null, pages = 0;
    do {
      const u = new URL("https://api.chariow.com/v1/products");
      u.searchParams.set("per_page", "100");
      if (cursor) u.searchParams.set("cursor", cursor);
      const r = await fetch(u, { headers: { Authorization: "Bearer " + key } });
      if (!r.ok) throw new Error("Chariow " + r.status);
      const page = ((await r.json()).data) || {};
      for (const p of page.data || []) {
        if (p.settings && p.settings.is_hidden_on_store_front) continue;
        const d = strip(p.description);
        out.push({
          id: p.id,
          t: p.name,
          slug: p.slug || null,
          d: d.length > 140 ? d.slice(0, 137) + "…" : d,
          c: (p.category && p.category.label) || "Autres",
          img: (p.pictures && (p.pictures.thumbnail || p.pictures.cover)) || null,
          price: p.is_free ? "Gratuit" : ((p.pricing && p.pricing.current_price && p.pricing.current_price.formatted) || "")
        });
      }
      cursor = page.pagination && page.pagination.has_more ? page.pagination.next_cursor : null;
    } while (cursor && ++pages < 10);
    // Mise en cache 1 minute : un nouveau produit apparaît en ~1 minute
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({ products: out });
  } catch (e) {
    res.status(502).json({ products: [], error: "Boutique indisponible" });
  }
};
