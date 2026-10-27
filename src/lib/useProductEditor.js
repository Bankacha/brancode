import { useRef, useState } from "react";
import { lookupProduct, saveProduct } from "./products.js";
import { fullCodeOf } from "./ean.js";
import { formatPrice, parsePrice, toPriceInput } from "./format.js";
import { copiesOf, upsertQueueItem, withCopies } from "./printQueue.js";

// Edit state for one product, opened from a scan/typed code (`open`) or from
// a print-list row (`openItem`); `barcode === null` means closed.
// badge: "U bazi" | "Novi artikal" | "Nije u bazi"; error: null | "lookup" | "save";
// oldPrice: the database price ("79,00") when a scanned/typed code was found;
// copies, promo (a leaflet's { dateFrom, dateTo }) and mixFormat: taken from the list when
// the article is already on it, so scanning it again keeps them.
export const useProductEditor = (queue, setQueue) => {
  const [barcode, setBarcode] = useState(null);
  const [matchedBarcode, setMatchedBarcode] = useState(null); // DB row the lookup found, if any
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [badge, setBadge] = useState(null);
  const [oldPrice, setOldPrice] = useState(null);
  const [copies, setCopies] = useState(1);
  const [promo, setPromo] = useState(null);
  const [mixFormat, setMixFormat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const request = useRef(0); // a newer open() makes older lookups stale

  const begin = (code) => {
    const id = ++request.current;
    setBarcode(code);
    setMatchedBarcode(null);
    setOldPrice(null);
    setError(null);
    setLoading(true);
    return id;
  };

  const lookup = async (id, code, onFound) => {
    try {
      const data = await lookupProduct(code);
      if (id !== request.current) return;
      onFound(data);
    } catch (e) {
      if (id !== request.current) return;
      console.error("lookup failed", e);
      setError("lookup");
    }
    setLoading(false);
  };

  const open = (code) => {
    const id = begin(code);
    setName("");
    setPrice("");
    setBadge(null);
    const listed = queue.find((q) => q.barcode === code);
    setCopies(listed ? copiesOf(listed) : 1);
    setPromo(listed?.promo ?? null);
    setMixFormat(listed?.mixFormat ?? null);
    return lookup(id, code, (data) => {
      if (data) {
        // 12 typed digits of an article stored with 13: carry on with the full code
        setBarcode(fullCodeOf(code, data.barcode));
        setMatchedBarcode(data.barcode);
        setName(data.name || "");
        setPrice(data.price != null ? toPriceInput(data.price) : "");
        setOldPrice(data.price != null ? formatPrice(data.price) : null);
        setBadge("U bazi");
      } else {
        setBadge("Novi artikal");
      }
    });
  };

  // The list's name and price win; the lookup only finds the row to save onto.
  const openItem = (item) => {
    const id = begin(item.barcode);
    setName(item.name);
    setPrice(toPriceInput(item.price));
    setBadge(item.notInDb ? "Nije u bazi" : "U bazi");
    setCopies(copiesOf(item));
    setPromo(item.promo ?? null);
    setMixFormat(item.mixFormat ?? null);
    return lookup(id, item.barcode, (data) => setMatchedBarcode(data ? data.barcode : null));
  };

  const priceNum = parsePrice(price);
  const canSave = name.trim() !== "" && priceNum !== null && !loading && !saving;

  // Resolves to the saved item, or null (the editor stays open, error "save").
  // What the list keeps besides name and price.
  const listFields = (item) => withCopies({ ...item, ...(promo && { promo }), ...(mixFormat && { mixFormat }) }, copies);

  const save = async () => {
    if (!canSave) return null;
    const product = { barcode, name: name.trim(), price: priceNum };
    setSaving(true);
    setError(null);
    try {
      await saveProduct(product, matchedBarcode);
    } catch (e) {
      console.error("save to supabase failed", e);
      setError("save");
      setSaving(false);
      return null;
    }
    const item = listFields({ id: `${barcode}-${Date.now()}`, ...product });
    setQueue(upsertQueueItem(queue, item));
    setSaving(false);
    setBarcode(null);
    return item;
  };

  // "Preskoči": onto the print list as it is, without touching the database.
  const skip = () => {
    if (!canSave) return null;
    const item = listFields({ id: `${barcode}-${Date.now()}`, barcode, name: name.trim(), price: priceNum });
    setQueue(upsertQueueItem(queue, item));
    setBarcode(null);
    return item;
  };

  const close = () => setBarcode(null);

  return { barcode, name, price, badge, oldPrice, copies, promo, mixFormat, loading, saving, error, canSave, open, openItem, setName, setPrice, setCopies, save, skip, close };
};
