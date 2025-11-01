// App.js — NYC Property Analytics (animated KPIs + memoized state)

import { useEffect, useState, useRef, useMemo } from "react";
import { getNYCRecentSales, getNeighborhoodSales } from "./api";
import { useSpring, animated } from "@react-spring/web";
import "./App.css";

/* ---------- Utilities ---------- */

const formatMoney = (n) =>
  typeof n === "number" && !Number.isNaN(n)
    ? `$${Math.round(n).toLocaleString()}`
    : "$0";

const buttonStyle = (active) => ({
  padding: "6px 14px",
  borderRadius: "6px",
  fontWeight: 500,
  border: active ? "2px solid var(--primary)" : "1px solid #d1d5db",
  background: active ? "var(--primary-light)" : "white",
  color: active ? "var(--primary)" : "var(--text-dark)",
  cursor: "pointer",
  transition: "all .15s ease",
});

/* ---------- Animated Number ---------- */

function AnimatedNumber({ value, formatFn }) {
  const previous = useRef(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  const fromValue = hasAnimated ? previous.current : 0;

  const { number } = useSpring({
    from: { number: fromValue },
    to: { number: value || 0 },
    config: { tension: 170, friction: 26 },
    reset: false,
  });

  // remember last value, mark first animation done
  useEffect(() => {
    previous.current = value || 0;
    if (!hasAnimated && (value || 0) > 0) setHasAnimated(true);
  }, [value, hasAnimated]);

  return (
    <animated.span>
      {number.to((n) =>
        formatFn ? formatFn(n) : Math.round(n).toLocaleString()
      )}
    </animated.span>
  );
}

/* ---------- KPI Card ---------- */

function KpiCard({ label, children }) {
  return (
    <div
      style={{
        background: "var(--card-bg)",
        boxShadow: "var(--shadow)",
        borderRadius: "12px",
        padding: "18px 20px",
        transition: "transform .2s ease, box-shadow .2s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      <h3 style={{ fontSize: "0.9rem", marginBottom: "4px", color: "var(--text-light)" }}>
        {label}
      </h3>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--primary)" }}>
        {children}
      </div>
    </div>
  );
}

/* ---------- Bar Chart ---------- */

function BarChart({ data, labelKey, valueKey }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data.map(d => Number(d[valueKey]) || 0) || [0]);

  return (
    <div style={{ marginTop: "20px" }}>
      {data.map((row, i) => {
        const val = Number(row[valueKey] || 0);
        const pct = max > 0 ? Math.max(4, Math.round((val / max) * 100)) : 0;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "6px",
            }}
          >
            {/* Label */}
            <div style={{ width: "160px", fontWeight: 600, color: "var(--text-dark)" }}>
              {row[labelKey]}
            </div>

            {/* Bar */}
            <div
              style={{
                flex: 1,
                background: "#f3f4f6",
                borderRadius: 8,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: pct + "%",
                  height: "18px",
                  background: "linear-gradient(90deg, var(--primary), #6366f1)",
                  borderRadius: 8,
                  transition: "width .4s ease",
                }}
              />
            </div>

            {/* Value & count */}
            <div style={{ width: "180px", textAlign: "right", fontSize: "0.9rem" }}>
              <strong>{formatMoney(val)}</strong>
              {typeof row.count !== "undefined" && (
                <span style={{ color: "var(--text-light)", marginLeft: "6px" }}>
                  ({Number(row.count || 0).toLocaleString()} sales)
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- App ---------- */

export default function App() {
  const [salesData, setSalesData] = useState([]); // borough-level
  const [neighborhoodData, setNeighborhoodData] = useState([]); // neighborhood-level
  const [months, setMonths] = useState(12);
  const [selectedBorough, setSelectedBorough] = useState("All");
  const [loadingNYC, setLoadingNYC] = useState(true);

  const isAll = selectedBorough === "All";
  const data = isAll ? salesData : neighborhoodData;

  // Load data on months / borough changes
useEffect(() => {
  let cancel = false;
  
  async function load() {
    setLoadingNYC(true);
    try {
      if (selectedBorough === "All") {
        const res = await getNYCRecentSales(months);
        if (!cancel) {
          setSalesData(res?.boroughs || []);
          setNeighborhoodData([]);
        }
      } else {
        const res = await getNeighborhoodSales(selectedBorough, months);
        if (!cancel) {
          setNeighborhoodData(res?.neighborhoods || []);
        }
      }
    } finally {
      if (!cancel) setLoadingNYC(false);
    }
  }

  load();
  return () => (cancel = true);
}, [months, selectedBorough]);


  // KPI calculations (memoized)
  const kpis = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalSales: 0,
        median: 0,
        topLabel: "—",
        topValue: 0,
        topVolumeLabel: "—",
        topVolumeCount: 0,
      };
    }

    const totalSales = data.reduce((sum, r) => sum + (r.count || 0), 0);
    const median = Math.round(
      data.reduce((sum, r) => sum + (r.median_value || 0), 0) / data.length
    );

    const sortedByMedian = [...data].sort(
      (a, b) => (b.median_value || 0) - (a.median_value || 0)
    );
    const sortedByCount = [...data].sort(
      (a, b) => (b.count || 0) - (a.count || 0)
    );

    return {
      totalSales,
      median,
      topLabel: isAll ? sortedByMedian[0]?.borough : sortedByMedian[0]?.neighborhood,
      topValue: sortedByMedian[0]?.median_value || 0,
      topVolumeLabel: isAll ? sortedByCount[0]?.borough : sortedByCount[0]?.neighborhood,
      topVolumeCount: sortedByCount[0]?.count || 0,
    };
  }, [data, isAll]);

  // Handlers & chart prep
  const handleBoroughClick = async (b) => {
    setSelectedBorough(b);
    // fetch happens in useEffect; leaving this lean prevents double-fetch
  };

  const chartLabelKey = isAll ? "borough" : "neighborhood";
  const chartData = isAll
    ? data
    : [...data]
        .sort((a, b) => (b.median_value || 0) - (a.median_value || 0))
        .slice(0, 10);

  return (
    <div className="App" style={{ padding: "2rem" }}>
      {/* Header */}
      <h1
        style={{
          fontSize: "1.8rem",
          fontWeight: 700,
          marginBottom: "0.25rem",
          color: "var(--text-dark)",
        }}
      >
        New York City Property Analytics
      </h1>
      <p style={{ color: "var(--text-light)", marginBottom: "1rem" }}>
        Interactive insights from NYC’s open real estate data
      </p>

      {/* Month filters */}
      <div style={{ display: "flex", gap: "10px", marginTop: "1rem" }}>
        {[1, 3, 6, 12].map((m) => (
          <button
            key={m}
            onClick={() => setMonths(m)}
            style={buttonStyle(months === m)}
          >
            {m}M
          </button>
        ))}
      </div>

      {/* KPI Section */}
      {!loadingNYC && data.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "20px",
            marginTop: "2rem",
            alignItems: "stretch",
          }}
        >
          <KpiCard
            label={`Total Sales (${isAll ? "NYC" : selectedBorough}, ${months}M)`}
          >
            <AnimatedNumber value={kpis.totalSales} />
          </KpiCard>

          <KpiCard
            label={`Median Sale Price (${isAll ? "NYC" : selectedBorough}, ${months}M)`}
          >
            <AnimatedNumber value={kpis.median} formatFn={formatMoney} />
          </KpiCard>

          <KpiCard
            label={`${isAll ? "Highest Median Borough" : "Top Neighborhood"} (${months}M)`}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{kpis.topLabel}</div>
            <AnimatedNumber value={kpis.topValue} formatFn={formatMoney} />
          </KpiCard>

          <KpiCard
            label={`Most Transactions (${isAll ? "NYC" : selectedBorough}, ${months}M)`}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{kpis.topVolumeLabel}</div>
            <AnimatedNumber value={kpis.topVolumeCount} />{" "}
            <span style={{ fontSize: "0.95rem", color: "var(--text-dark)" }}>sales</span>
          </KpiCard>
        </div>
      )}

      {/* Borough summary table + borough selector */}
      <h2 style={{ marginTop: "1.75rem" }}>
        {isAll
          ? `NYC Borough — Recent Sales (Last ${months}M)`
          : `${selectedBorough} — Neighborhood Sales (Last ${months}M)`}
      </h2>
          <div style={{ display: "flex", gap: "8px", margin: "16px 0" }}>
            {["All", "Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"].map((b) => (
              <button
                key={b}
                onClick={() => handleBoroughClick(b)}
                style={buttonStyle(selectedBorough === b)}
              >
                {b}
              </button>
            ))}
          </div>

      {loadingNYC && <p>Loading NYC sales…</p>}

      {!loadingNYC && isAll && salesData.length > 0 && (
        <>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: "1rem",
              background: "white",
              borderRadius: "8px",
              overflow: "hidden",
              boxShadow: "var(--shadow)",
            }}
          >
            <thead style={{ background: "var(--primary-light)" }}>
              <tr>
                <th style={{ padding: "10px", textAlign: "left" }}>Borough</th>
                <th style={{ padding: "10px", textAlign: "left" }}>Median</th>
                <th style={{ padding: "10px", textAlign: "left" }}>Average</th>
                <th style={{ padding: "10px", textAlign: "left" }}>Transactions</th>
              </tr>
            </thead>
            <tbody>
              {salesData.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "10px" }}>{row.borough}</td>
                  <td style={{ padding: "10px" }}>{formatMoney(row.median_value)}</td>
                  <td style={{ padding: "10px" }}>{formatMoney(row.avg_value)}</td>
                  <td style={{ padding: "10px" }}>
                    {Number(row.count || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          
        </>
      )}

      {/* Chart */}
      {!loadingNYC && data.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>
            {isAll
              ? `Median Sale Price by Borough (Last ${months}M)`
              : `Median Sale Price by Neighborhood in ${selectedBorough} (Top 10, Last ${months}M)`}
          </h3>
          
          <BarChart data={chartData || []} labelKey={chartLabelKey || "borough"} valueKey="median_value" />

        </div>
      )}

      {/* Neighborhood table when a borough is selected */}
      {!loadingNYC && !isAll && neighborhoodData.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h4>All Neighborhoods in {selectedBorough} (Last {months}M)</h4>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: "8px",
                background: "white",
                borderRadius: "8px",
                overflow: "hidden",
                boxShadow: "var(--shadow)",
              }}
            >
              <thead style={{ background: "var(--primary-light)" }}>
                <tr style={{ textAlign: "left" }}>
                  <th style={{ padding: "8px" }}>Neighborhood</th>
                  <th style={{ padding: "8px" }}>Median</th>
                  <th style={{ padding: "8px" }}>Average</th>
                  <th style={{ padding: "8px" }}>Sales</th>
                </tr>
              </thead>
              <tbody>
                {[...neighborhoodData]
                  .sort((a, b) => (b.median_value || 0) - (a.median_value || 0))
                  .map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "8px" }}>{row.neighborhood || "—"}</td>
                      <td style={{ padding: "8px" }}>{formatMoney(row.median_value)}</td>
                      <td style={{ padding: "8px" }}>{formatMoney(row.avg_value)}</td>
                      <td style={{ padding: "8px" }}>
                        {Number(row.count || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
