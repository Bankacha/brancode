import { sameArticleCodes } from "./ean.js";
import { formatPrice, samePrice } from "./format.js";
import { formatDate } from "./listFormat.js";

// The morning check (api/promo-check.js, Vercel Cron, early morning in
// Belgrade). Over the leaflets whose regular prices haven't come back yet:
//   1. a leaflet imported before its first day gets its promo prices written;
//   2. the morning after a promotion ends, regular prices come back — only
//      where the database still holds that leaflet's promo price; an article
//      that is on a running leaflet now is handed on to it instead;
//   3. a reminder mail the day before and on the last day.
// Every step is recorded in the database, so running it again the same day
// does nothing twice. Server only: uses the service-role store.

export const belgradeToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

export const addDays = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

const day = (iso) => `${formatDate(iso)}.`;
const period = (leaflet) => `${day(leaflet.dateFrom)} – ${day(leaflet.dateTo)}`;
const shownPrice = (price) => (price === null ? "bez cene" : formatPrice(price));
const articleLines = (items) => [...items].sort((a, b) => a.name.localeCompare(b.name, "sr")).map((i) => `- ${i.name} (${i.barcode})`);

// The products row of an article, also after a scan moved it to its full code.
const productsOf = async (store, items) => {
  const found = await store.products([...new Set(items.flatMap((i) => sameArticleCodes(i.barcode)))]);
  const byBarcode = new Map(found.map((p) => [p.barcode, p]));
  return (barcode) => sameArticleCodes(barcode).map((code) => byBarcode.get(code)).find(Boolean) ?? null;
};

export const reminderMail = (leaflet, items, when) => {
  const tomorrow = when === "tomorrow";
  return {
    subject: `Akcija ističe ${tomorrow ? "sutra" : "danas"}: ${leaflet.name} (${day(leaflet.dateTo)})`,
    text: [
      tomorrow
        ? `Akcija „${leaflet.name}“ (${period(leaflet)}) ističe sutra. Posle zatvaranja sutra skini akcijske cenovnike. Redovne cene u bazi se vraćaju same.`
        : `Akcija „${leaflet.name}“ (${period(leaflet)}) ističe danas. Posle zatvaranja skini akcijske cenovnike. Redovne cene u bazi se vraćaju same sutra ujutru.`,
      "",
      `Artikli (${items.length}):`,
      ...articleLines(items),
    ].join("\n"),
  };
};

export const restoreMail = (leaflet, restoredCount, changed) => ({
  subject: `Redovne cene vraćene: ${leaflet.name}`,
  text: [
    `Posle akcije „${leaflet.name}“ (${period(leaflet)}) redovne cene su vraćene u bazu: ${restoredCount}.`,
    "Ovi artikli nisu vraćeni jer im je cena u međuvremenu menjana, pa ih proveri:",
    ...changed.map(({ item, product }) => `- ${item.name} (${item.barcode}): sada ${product ? shownPrice(product.price) : "nije u bazi"}, redovna ${shownPrice(item.regularPrice)}`),
  ].join("\n"),
});

export const runPromoCheck = async ({ store, sendMail, today, now = new Date() }) => {
  const stamp = now.toISOString();
  const done = { applied: [], restored: [], reminders: [] };
  const trySend = async (mail) => {
    try {
      await sendMail(mail);
      return true;
    } catch (e) {
      console.error("promo mail failed", e);
      return false;
    }
  };

  const open = await store.openLeaflets();
  const running = (l) => Boolean(l.pricesAppliedAt) && l.dateFrom <= today && today <= l.dateTo;

  // 1. Promo prices of a leaflet imported early, on its first morning. The
  // regular price is taken again now: it may have changed since the import.
  for (const leaflet of open.filter((l) => !l.pricesAppliedAt && l.dateFrom <= today && today <= l.dateTo)) {
    const items = await store.leafletItems([leaflet.id]);
    const others = open.filter((l) => l.id !== leaflet.id && l.pricesAppliedAt);
    const elsewhere = others.length ? await store.leafletItems(others.map((l) => l.id), items.map((i) => i.barcode)) : [];
    const productOf = await productsOf(store, items);
    const prices = [];
    const regular = [];
    for (const item of items) {
      const product = productOf(item.barcode);
      if (!product) continue;
      const onOther = elsewhere.find((e) => e.barcode === item.barcode);
      regular.push({ ...item, regularPrice: onOther ? onOther.regularPrice : product.price });
      prices.push({ barcode: product.barcode, name: product.name, price: item.promoPrice });
    }
    await store.saveItems(leaflet.id, regular);
    await store.setProductPrices(prices);
    await store.markLeaflet(leaflet.id, { pricesAppliedAt: stamp });
    leaflet.pricesAppliedAt = stamp;
    done.applied.push(leaflet.name);
  }

  // 2. Regular prices back, the morning after the last day.
  for (const leaflet of open.filter((l) => l.dateTo < today)) {
    if (!leaflet.pricesAppliedAt) {
      await store.markLeaflet(leaflet.id, { pricesRestoredAt: stamp }); // never wrote any prices
      continue;
    }
    const items = (await store.leafletItems([leaflet.id])).filter((i) => !i.restoreResult);
    const others = open.filter((l) => l.id !== leaflet.id && running(l));
    const elsewhere = others.length && items.length ? await store.leafletItems(others.map((l) => l.id), items.map((i) => i.barcode)) : [];
    const productOf = await productsOf(store, items);
    const prices = [];
    const results = [];
    const changed = [];
    for (const item of items) {
      const newer = elsewhere.find((e) => e.barcode === item.barcode);
      if (newer) {
        await store.setItemRegularPrice(newer.leafletId, item.barcode, item.regularPrice);
        results.push({ barcode: item.barcode, restoreResult: "newer_leaflet" });
        continue;
      }
      const product = productOf(item.barcode);
      // Already regular: restored by an earlier run that broke off.
      if (product && (samePrice(product.price, item.promoPrice) || samePrice(product.price, item.regularPrice))) {
        if (!samePrice(product.price, item.regularPrice)) prices.push({ barcode: product.barcode, name: product.name, price: item.regularPrice });
        results.push({ barcode: item.barcode, restoreResult: "restored" });
      } else {
        results.push({ barcode: item.barcode, restoreResult: "changed" });
        changed.push({ item, product });
      }
    }
    if (prices.length) await store.setProductPrices(prices);
    if (results.length) await store.setItemResults(leaflet.id, results);
    await store.markLeaflet(leaflet.id, { pricesRestoredAt: stamp });
    done.restored.push(leaflet.name);
    if (changed.length) await trySend(restoreMail(leaflet, results.filter((r) => r.restoreResult === "restored").length, changed));
  }

  // 3. Reminders: the day before the last day, and on it.
  const tomorrow = addDays(today, 1);
  for (const leaflet of open) {
    const when = leaflet.dateTo === tomorrow && !leaflet.remindedTomorrowAt ? "tomorrow" : leaflet.dateTo === today && !leaflet.remindedTodayAt ? "today" : null;
    if (!when) continue;
    const items = await store.leafletItems([leaflet.id]);
    if (!(await trySend(reminderMail(leaflet, items, when)))) continue;
    await store.markLeaflet(leaflet.id, when === "tomorrow" ? { remindedTomorrowAt: stamp } : { remindedTodayAt: stamp });
    done.reminders.push(`${when}: ${leaflet.name}`);
  }

  return done;
};
