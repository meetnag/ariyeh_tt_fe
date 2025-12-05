import { useMemo, useState, type FormEvent } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

type BagRequest = {
  display_name: string;
  brand: string;
  model?: string;
  style?: string;
  color?: string;
  material?: string;
  tag_code: string;
};

type EntrupyRequest = {
  bag_id: number;
  customer_item_id: string;
  authentication_status?: string;
  certificate_url?: string;
  brand?: string;
  model?: string;
  style?: string;
  color?: string;
  material?: string;
  dimensions?: Record<string, unknown>;
  condition_grade?: string;
  catalog_raw?: Record<string, unknown>;
};

type ApiError = { message: string };

function AdminPage() {
  const [bagForm, setBagForm] = useState<BagRequest>({
    display_name: "",
    brand: "",
    tag_code: "",
    model: "",
    style: "",
    color: "",
    material: "",
  });
  const [entrupyForm, setEntrupyForm] = useState<EntrupyRequest>({
    bag_id: 1,
    customer_item_id: "CUST-001",
    authentication_status: "pending",
    certificate_url: "https://example.com/cert",
    brand: "SampleBrand",
    model: "SampleModel",
    style: "Tote",
    color: "Black",
    material: "Leather",
    dimensions: { width_cm: 30, height_cm: 20, depth_cm: 10 },
    condition_grade: "A",
    catalog_raw: { source: "demo" },
  });
  const [bagResult, setBagResult] = useState<unknown>(null);
  const [entrupyResult, setEntrupyResult] = useState<unknown>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);

  const parseError = async (res: Response) => {
    try {
      const data = await res.json();
      const detail = (data as { detail?: string }).detail;
      throw new Error(`Request failed: ${res.status}${detail ? ` - ${detail}` : ""}`);
    } catch {
      const text = await res.text();
      throw new Error(`Request failed: ${res.status}${text ? ` - ${text}` : ""}`);
    }
  };

  const handleBagSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setScanStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/bags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bagForm),
      });
      if (!res.ok) await parseError(res);
      const data = await res.json();
      setBagResult(data);
      const newBagId = (data as { bag?: { id?: number } })?.bag?.id;
      if (newBagId) {
        setEntrupyForm((prev) => ({ ...prev, bag_id: newBagId }));
      }
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const handleEntrupySubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/entrupy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entrupyForm),
      });
      if (!res.ok) await parseError(res);
      const data = await res.json();
      setEntrupyResult(data);
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const startTagScan = async () => {
    setError(null);
    setScanStatus("Starting scan...");

    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (window.location.protocol !== "https:" && !isLocalhost) {
      setError({ message: "Web NFC requires https or localhost." });
      setScanStatus(null);
      return;
    }

    if (!("NDEFReader" in window)) {
      setError({ message: "Web NFC not supported on this device/browser." });
      setScanStatus(null);
      return;
    }
    try {
      const ndef = new NDEFReader();
      await ndef.scan();
      setScanStatus("Hold tag near the device to scan...");
      ndef.onreading = (event) => {
        const records = event.message?.records ?? [];
        const decoder = new TextDecoder();
        const textRecord = records.find((r) => r.recordType === "text");
        const textValue = textRecord ? decoder.decode(textRecord.data) : undefined;
        const serial = (event as unknown as { serialNumber?: string }).serialNumber;
        const tagValue = textValue || serial;
        if (tagValue) {
          setBagForm((prev) => ({ ...prev, tag_code: tagValue }));
          setScanStatus(`Scanned tag: ${tagValue}`);
        } else {
          setScanStatus("Scanned, but no data found on tag.");
        }
      };
      ndef.onreadingerror = () => {
        setError({ message: "Tag read error. Please try again." });
        setScanStatus(null);
      };
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "Failed to start scan" });
      setScanStatus(null);
    }
  };

  return (
    <div className="card">
      <h2>Admin: Create Bag + Assign Tag</h2>
      <form className="form" onSubmit={handleBagSubmit}>
        <div className="grid">
          <label className="field">
            <span>Display name</span>
            <input
              value={bagForm.display_name}
              onChange={(e) => setBagForm({ ...bagForm, display_name: e.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>Brand</span>
            <input
              value={bagForm.brand}
              onChange={(e) => setBagForm({ ...bagForm, brand: e.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>Tag code</span>
            <div className="inline-actions">
              <input
                value={bagForm.tag_code}
                onChange={(e) => setBagForm({ ...bagForm, tag_code: e.target.value })}
                required
              />
              <button type="button" className="ghost" onClick={startTagScan}>
                Scan Tag
              </button>
            </div>
            {scanStatus && <p className="muted small">{scanStatus}</p>}
            <p className="muted small">
              NFC scan works on compatible devices (e.g., Chrome on Android) over https or localhost. Otherwise, enter the tag code manually.
            </p>
          </label>
          <label className="field">
            <span>Model</span>
            <input
              value={bagForm.model}
              onChange={(e) => setBagForm({ ...bagForm, model: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Style</span>
            <input
              value={bagForm.style}
              onChange={(e) => setBagForm({ ...bagForm, style: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Color</span>
            <input
              value={bagForm.color}
              onChange={(e) => setBagForm({ ...bagForm, color: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Material</span>
            <input
              value={bagForm.material}
              onChange={(e) => setBagForm({ ...bagForm, material: e.target.value })}
            />
          </label>
        </div>
        <button type="submit">Create + Assign</button>
      </form>
      {bagResult && (
        <pre className="result" aria-label="bag-result">
          {JSON.stringify(bagResult, null, 2)}
        </pre>
      )}

      <h2>Admin: Upsert Entrupy</h2>
      <form className="form" onSubmit={handleEntrupySubmit}>
        <div className="grid">
          <label className="field">
            <span>Bag ID</span>
            <input
              type="number"
              value={entrupyForm.bag_id}
              onChange={(e) =>
                setEntrupyForm({ ...entrupyForm, bag_id: Number(e.target.value) })
              }
              required
            />
          </label>
          <label className="field">
            <span>Customer item id</span>
            <input
              value={entrupyForm.customer_item_id}
              onChange={(e) =>
                setEntrupyForm({ ...entrupyForm, customer_item_id: e.target.value })
              }
              required
            />
          </label>
          <label className="field">
            <span>Authentication status</span>
            <input
              value={entrupyForm.authentication_status ?? ""}
              onChange={(e) =>
                setEntrupyForm({ ...entrupyForm, authentication_status: e.target.value })
              }
            />
          </label>
          <label className="field">
            <span>Certificate URL</span>
            <input
              value={entrupyForm.certificate_url ?? ""}
              onChange={(e) =>
                setEntrupyForm({ ...entrupyForm, certificate_url: e.target.value })
              }
            />
          </label>
          <label className="field">
            <span>Brand</span>
            <input
              value={entrupyForm.brand ?? ""}
              onChange={(e) => setEntrupyForm({ ...entrupyForm, brand: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Model</span>
            <input
              value={entrupyForm.model ?? ""}
              onChange={(e) => setEntrupyForm({ ...entrupyForm, model: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Style</span>
            <input
              value={entrupyForm.style ?? ""}
              onChange={(e) => setEntrupyForm({ ...entrupyForm, style: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Color</span>
            <input
              value={entrupyForm.color ?? ""}
              onChange={(e) => setEntrupyForm({ ...entrupyForm, color: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Material</span>
            <input
              value={entrupyForm.material ?? ""}
              onChange={(e) => setEntrupyForm({ ...entrupyForm, material: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Condition grade</span>
            <input
              value={entrupyForm.condition_grade ?? ""}
              onChange={(e) =>
                setEntrupyForm({ ...entrupyForm, condition_grade: e.target.value })
              }
            />
          </label>
          <label className="field field-textarea">
            <span>Dimensions (JSON)</span>
            <textarea
              value={
                entrupyForm.dimensions ? JSON.stringify(entrupyForm.dimensions, null, 2) : ""
              }
              onChange={(e) => {
                try {
                  const parsed = e.target.value ? JSON.parse(e.target.value) : undefined;
                  setEntrupyForm({ ...entrupyForm, dimensions: parsed });
                } catch {
                  setError({ message: "Invalid JSON for dimensions" });
                }
              }}
            />
          </label>
          <label className="field field-textarea">
            <span>Catalog raw (JSON)</span>
            <textarea
              value={
                entrupyForm.catalog_raw ? JSON.stringify(entrupyForm.catalog_raw, null, 2) : ""
              }
              onChange={(e) => {
                try {
                  const parsed = e.target.value ? JSON.parse(e.target.value) : undefined;
                  setEntrupyForm({ ...entrupyForm, catalog_raw: parsed });
                } catch {
                  setError({ message: "Invalid JSON for catalog_raw" });
                }
              }}
            />
          </label>
        </div>
        <button type="submit">Save Entrupy</button>
      </form>
      {entrupyResult && (
        <pre className="result" aria-label="entrupy-result">
          {JSON.stringify(entrupyResult, null, 2)}
        </pre>
      )}
      {error && <p className="error">{error.message}</p>}
    </div>
  );
}

function ScanPage() {
  const [tagCode, setTagCode] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const disabled = useMemo(() => tagCode.trim().length === 0, [tagCode]);

  const handleLookup = async () => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/tags/${encodeURIComponent(tagCode)}`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  return (
    <div className="card">
      <h2>Scan Tag</h2>
      <div className="row">
        <input
          placeholder="Tag code"
          value={tagCode}
          onChange={(e) => setTagCode(e.target.value)}
        />
        <button onClick={handleLookup} disabled={disabled}>
          Lookup
        </button>
      </div>
      {result && (
        <pre className="result" aria-label="tag-result">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
      {error && <p className="error">{error.message}</p>}
    </div>
  );
}

function App() {
  return (
    <div className="app">
      <header>
        <h1>Bag Tagging Admin</h1>
        <p className="muted">API base: {API_BASE}</p>
      </header>
      <main className="stack">
        <AdminPage />
        <ScanPage />
      </main>
    </div>
  );
}

export default App;
