import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import "./App.css";

// Prefer configured API base. If unset, use deployed backend on Vercel; otherwise fall back to localhost for dev.
const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (typeof window !== "undefined" && window.location.hostname.endsWith("vercel.app")
    ? "https://ariyeh-tt-be.vercel.app"
    : "http://127.0.0.1:8000");

type BagRequest = {
  display_name: string;
  brand: string;
  model?: string;
  style?: string;
  color?: string;
  material?: string;
  tag_code: string;
};

type BagWithTagResponse = {
  bag?: {
    id?: number;
    display_name?: string;
    brand?: string;
    model?: string | null;
    style?: string | null;
    color?: string | null;
    material?: string | null;
  };
  tag?: {
    tag_code?: string;
    id?: number;
    bag_id?: number | null;
  };
};

type InventoryRow = {
  id?: number;
  display_name?: string;
  brand?: string;
  model?: string | null;
  style?: string | null;
  color?: string | null;
  tag_code?: string | null;
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
};

type ApiError = { message: string };

type NDEFRecordData = {
  recordType: string;
  mediaType?: string;
  id?: string;
  data: DataView;
};

type NDEFMessageData = { records: NDEFRecordData[] };

type NDEFReadingEvent = Event & {
  message?: NDEFMessageData;
  serialNumber?: string;
};

type WebNDEFReader = {
  scan: () => Promise<void>;
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
};

declare global {
  interface Window {
    NDEFReader?: { new (): WebNDEFReader };
  }
}

function AdminPage({
  onBagCreated,
  mode = "bag",
}: {
  onBagCreated?: (payload: BagWithTagResponse) => void;
  mode?: "bag" | "entrupy";
}) {
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
  });
  const [bagResult, setBagResult] = useState<unknown>(null);
  const [entrupyResult, setEntrupyResult] = useState<unknown>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const isSecureContext =
    typeof window !== "undefined" && (window.location.protocol === "https:" || isLocalhost);
  const webNfcSupported =
    typeof window !== "undefined" && isSecureContext && "NDEFReader" in window;

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
      if (onBagCreated) {
        onBagCreated(data as BagWithTagResponse);
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

    if (!isSecureContext) {
      setError({ message: "Web NFC requires https or localhost." });
      setScanStatus(null);
      return;
    }

    if (!webNfcSupported) {
      setError({
        message:
          "Web NFC not supported on this device/browser. Try Chrome on Android with NFC enabled.",
      });
      setScanStatus(null);
      return;
    }
    const NDEFConstructor = window.NDEFReader;
    if (!NDEFConstructor) {
      setError({ message: "Web NFC not available in this context." });
      setScanStatus(null);
      return;
    }
    try {
      const ndef = new NDEFConstructor();
      await ndef.scan();
      setScanStatus("Hold tag near the device to scan...");
      ndef.onreading = (event: NDEFReadingEvent) => {
        const records = event.message?.records ?? [];
        const decoder = new TextDecoder();
        const textRecord = records.find((r: NDEFRecordData) => r.recordType === "text");
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
      {mode === "bag" && (
        <>
          <form className="form bag-form" onSubmit={handleBagSubmit}>
            <div className="bag-columns">
              <div className="bag-column">
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
                  <span>Model</span>
                  <input
                    value={bagForm.model}
                    onChange={(e) => setBagForm({ ...bagForm, model: e.target.value })}
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

              <div className="bag-column">
                <label className="field">
                  <span>Tag code</span>
                  <div className="inline-actions">
                    <input
                      value={bagForm.tag_code}
                      onChange={(e) => setBagForm({ ...bagForm, tag_code: e.target.value })}
                      required
                    />
                    <button type="button" className="ghost" onClick={startTagScan}>
                      Scan NFC Tag
                    </button>
                  </div>
                  {scanStatus && <p className="muted small">{scanStatus}</p>}
                  {!webNfcSupported && (
                    <p className="muted small">
                      Web NFC not detected. Enter the tag code manually or try Chrome on Android with
                      NFC on.
                    </p>
                  )}
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
                <div className="bag-actions">
                  <button type="submit">Create + Assign</button>
                </div>
              </div>
            </div>
          </form>
          {bagResult !== null && (
            <pre className="result" aria-label="bag-result">
              {JSON.stringify(bagResult, null, 2)}
            </pre>
          )}
          {error && <p className="error">{error.message}</p>}
        </>
      )}

      {mode === "entrupy" && (
        <>
          <form className="form entrupy-form" onSubmit={handleEntrupySubmit}>
            <div className="entrupy-columns">
              <div className="entrupy-column">
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
              </div>

              <div className="entrupy-column">
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
                <div className="entrupy-actions">
                  <button type="submit">Save Entrupy</button>
                </div>
              </div>
            </div>
          </form>
          {entrupyResult !== null && (
            <pre className="result" aria-label="entrupy-result">
              {JSON.stringify(entrupyResult, null, 2)}
            </pre>
          )}
          {error && <p className="error">{error.message}</p>}
        </>
      )}
    </div>
  );
}

function ScanPage() {
  const [tagCode, setTagCode] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);

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

  const startTagScan = async () => {
    setError(null);
    setScanStatus("Starting scan...");

    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    const isSecureContext =
      typeof window !== "undefined" && (window.location.protocol === "https:" || isLocalhost);
    const webNfcSupported =
      typeof window !== "undefined" && isSecureContext && "NDEFReader" in window;

    if (!isSecureContext) {
      setError({ message: "Web NFC requires https or localhost." });
      setScanStatus(null);
      return;
    }

    if (!webNfcSupported) {
      setError({
        message:
          "Web NFC not supported on this device/browser. Try Chrome on Android with NFC enabled.",
      });
      setScanStatus(null);
      return;
    }

    const NDEFConstructor = window.NDEFReader;
    if (!NDEFConstructor) {
      setError({ message: "Web NFC not available in this context." });
      setScanStatus(null);
      return;
    }

    try {
      const ndef = new NDEFConstructor();
      await ndef.scan();
      setScanStatus("Hold tag near the device to scan...");
      ndef.onreading = (event: NDEFReadingEvent) => {
        const records = event.message?.records ?? [];
        const decoder = new TextDecoder();
        const textRecord = records.find((r: NDEFRecordData) => r.recordType === "text");
        const textValue = textRecord ? decoder.decode(textRecord.data) : undefined;
        const serial = (event as unknown as { serialNumber?: string }).serialNumber;
        const tagValue = textValue || serial;
        if (tagValue) {
          setTagCode(tagValue);
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
      <div className="row">
        <input
          placeholder="Tag code"
          value={tagCode}
          onChange={(e) => setTagCode(e.target.value)}
        />
        <button type="button" className="ghost" onClick={startTagScan}>
          Scan NFC Tag
        </button>
        <button onClick={handleLookup} disabled={disabled}>
          Lookup
        </button>
      </div>
      {scanStatus && <p className="muted small">{scanStatus}</p>}
      {result !== null && (
        <pre className="result" aria-label="tag-result">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
      {error && <p className="error">{error.message}</p>}
    </div>
  );
}

type SectionKey = "bag" | "entrupy" | "scan" | "inventory" | "settings";

function InventoryTable({
  rows,
  loading,
  error,
}: {
  rows: InventoryRow[];
  loading?: boolean;
  error?: string | null;
}) {
  return (
    <div className="card">
      <div className="section-header">
        <p className="muted small">
          {loading ? "Loading bags..." : `Showing ${rows.length || 0} bag(s) from the database.`}
        </p>
      </div>
      {error && <p className="error">{error}</p>}
      {rows.length === 0 && !loading ? (
        <p className="muted">No bags yet. Create one from “Bag Tagging”.</p>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Tag code</th>
                <th>ID</th>
                <th>Display name</th>
                <th>Brand</th>
                <th>Model</th>
                <th>Style</th>
                <th>Color</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((bag, idx) => (
                <tr key={bag.id ?? idx}>
                  <td>{bag.tag_code ?? "-"}</td>
                  <td>{bag.id ?? "-"}</td>
                  <td>{bag.display_name ?? "-"}</td>
                  <td>{bag.brand ?? "-"}</td>
                  <td>{bag.model ?? "-"}</td>
                  <td>{bag.style ?? "-"}</td>
                  <td>{bag.color ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="card">
      <h2>Settings</h2>
      <p className="muted">No additional settings yet.</p>
    </div>
  );
}

function App() {
  const [section, setSection] = useState<SectionKey>("bag");
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  const addToInventory = (data: BagWithTagResponse) => {
    const bag = data.bag;
    if (!bag) return;
    setInventory((prev) => [{ ...bag }, ...prev].slice(0, 50));
  };

  const fetchInventory = useCallback(async () => {
    setInventoryLoading(true);
    setInventoryError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/bags`);
      if (!res.ok) {
        throw new Error(`Failed to load bags (${res.status})`);
      }
      const data = (await res.json()) as InventoryRow[];
      setInventory(data);
    } catch (err) {
      setInventoryError(err instanceof Error ? err.message : "Unable to load inventory");
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (section === "inventory") {
      void fetchInventory();
    }
  }, [section, fetchInventory]);

  const renderContent = () => {
    switch (section) {
      case "bag":
        return <AdminPage onBagCreated={addToInventory} />;
      case "entrupy":
        return <AdminPage onBagCreated={addToInventory} mode="entrupy" />;
      case "scan":
        return <ScanPage />;
      case "inventory":
        return <InventoryTable rows={inventory} loading={inventoryLoading} error={inventoryError} />;
      case "settings":
        return <SettingsPage />;
      default:
        return <AdminPage onBagCreated={addToInventory} />;
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/dflogo.svg" alt="DF logo" className="brand-logo" />
        </div>
        <nav className="nav">
          {[
            { key: "bag", label: "Bag Tagging" },
            { key: "entrupy", label: "Entrupy Tagging" },
            { key: "scan", label: "Scan Tag" },
            { key: "inventory", label: "Inventory" },
            { key: "settings", label: "Settings" },
          ].map((item) => (
            <button
              key={item.key}
              className={`nav-item ${section === item.key ? "active" : ""}`}
              onClick={() => setSection(item.key as SectionKey)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <header className="page-header">
          <div className="mobile-nav">
            <label className="field">
              <span>Go to</span>
              <select value={section} onChange={(e) => setSection(e.target.value as SectionKey)}>
                {[
                  { key: "bag", label: "Bag Tagging" },
                  { key: "entrupy", label: "Entrupy Tagging" },
                  { key: "scan", label: "Scan Tag" },
                  { key: "inventory", label: "Inventory" },
                  { key: "settings", label: "Settings" },
                ].map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <h1>
            {section === "bag" && "Bag Tagging"}
            {section === "entrupy" && "Entrupy Tagging"}
            {section === "scan" && "Scan Tag"}
            {section === "inventory" && "Inventory"}
            {section === "settings" && "Settings"}
          </h1>
          <p className="muted">
            {section === "bag" ? "Create Bag and Assign Tag" : "Manage tags, bags, and Entrupy data."}
          </p>
        </header>
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
