// Shared review table. Clicking a row calls onSelect(row.idx); the selected row is highlighted.
// `columns` is a list of [label, getter] pairs, e.g. ["pt1", (r) => r.pt1].
export const fmt = (v) =>
  typeof v === "number" ? (Number.isInteger(v) ? v : +v.toFixed(3)) : v ?? "";

export default function EventTable({ rows = [], columns = [], onSelect, selected }) {
  if (!rows.length) return <div className="loading">No events match these settings.</div>;

  return (
    <div className="scroll">
      <table className="data">
        <thead>
          <tr>
            <th>#</th>
            {columns.map(([label]) => <th key={label}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.idx} className={"row" + (selected === r.idx ? " sel" : "")}
                onClick={() => onSelect(r.idx)}>
              <td>{r.idx}</td>
              {columns.map(([label, get]) => <td key={label}>{fmt(get(r))}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
