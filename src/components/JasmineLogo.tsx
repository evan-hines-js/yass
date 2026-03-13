export default function JasmineLogo(props: { size?: number }) {
  const s = props.size ?? 40;
  return (
    <svg width={s} height={s} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* 5-petal jasmine — no background, just the flower */}
      <g transform="translate(50,50)">
        {[0, 72, 144, 216, 288].map((angle) => (
          <ellipse
            cx="0"
            cy="-20"
            rx="11"
            ry="18"
            fill="#F8DE7E"
            stroke="#8B7335"
            stroke-width="2"
            transform={`rotate(${angle})`}
          />
        ))}
        <circle cx="0" cy="0" r="9" fill="#EFBF04" />
        <circle cx="0" cy="0" r="5" fill="#8B7335" />
      </g>
    </svg>
  );
}
