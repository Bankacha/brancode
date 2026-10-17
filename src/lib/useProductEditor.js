import { useState } from "react";
import { lookupProduct, saveProduct } from "./products.js";

// Edit state for one scanned/typed barcode; `barcode === null` means closed.
export const useProductEditor = (queue, setQueue) => {
  const [barcode, setBarcode] = useState(null);
  const [matchedBarcode, setMatchedBarcode] = useState(null); // barcode of the DB row the lookup found, if any
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const open = async (code) => {
    setBarcode(code);
    setMatchedBarcode(null);
    setName("");
    setPrice("");
    setIsNew(false);
    setError(null);
    setLoading(true);
    try {
      const data = await lookupProduct(code);
      if (data) {
        setMatchedBarcode(data.barcode);
        setName(data.name || "");
        setPrice(data.price != null ? String(data.price) : "");
        setIsNew(false);
      } else {
        setIsNew(true);
      }
    } catch (e) {
      console.error("lookup failed", e);
      setError("Ne mogu da se povežem sa bazom. Proveri internet konekciju.");
    }
    setLoading(false);
  };

  const save = async () => {
    if (!name.trim() || price === "") return;
    const priceNum = parseFloat(price.replace(",", "."));
    if (isNaN(priceNum)) return;

    setError(null);
    try {
      await saveProduct({ barcode, name: name.trim(), price: priceNum }, matchedBarcode);
    } catch (e) {
      console.error("save to supabase failed", e);
      setError("Čuvanje u bazi nije uspelo. Proveri internet konekciju i probaj ponovo.");
      return;
    }

    const withoutDuplicate = queue.filter((q) => q.barcode !== barcode);
    setQueue([...withoutDuplicate, { id: `${barcode}-${Date.now()}`, barcode, name: name.trim(), price: priceNum }]);

    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
    setBarcode(null);
  };

  const cancel = () => setBarcode(null);

  return { barcode, name, price, isNew, loading, error, savedFlash, open, setName, setPrice, save, cancel };
};
