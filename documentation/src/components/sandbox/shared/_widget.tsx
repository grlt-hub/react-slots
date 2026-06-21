type Props = { accent: [string, string]; title: string; value: string | number }

const Widget = ({ accent, title, value }: Props) => (
  <div
    style={{
      position: "relative",
      padding: "13px 16px 13px 18px",
      background: "#151d27",
      border: "1px solid #2a3340",
      borderRadius: 12,
      overflow: "hidden",
    }}
  >
    <span
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 5,
        background: `linear-gradient(180deg, ${accent[0]}, ${accent[1]})`,
      }}
    />
    {value !== undefined && (
      <span
        style={{
          position: "absolute",
          top: 11,
          right: 11,
          padding: 4,
          display: "grid",
          placeItems: "center",
          borderRadius: "8px",
          background: accent[1],
          color: "#0a0e14",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {value}
      </span>
    )}

    <div style={{ fontWeight: 600, fontSize: 14, color: "#e6eaf0" }}>{title}</div>
  </div>
)

export { Widget }
