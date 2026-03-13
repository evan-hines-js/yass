/**
 * Visual keyboard legend showing left-hand shortcuts.
 * Rendered as inline SVG to keep it crisp at any size.
 */
export default function KeyboardLegend() {
  const kw = 28;   // key width
  const kh = 28;   // key height
  const gap = 2;   // gap between keys
  const step = kw + gap; // 30px per key cell

  // Row y positions
  const y0 = 0;
  const y1 = kh + gap;
  const y2 = y1 + kh + gap;
  const y3 = y2 + kh + gap;

  // Row x offsets (QWERTY stagger)
  const off0 = 0;
  const off1 = 9;
  const off2 = 14;
  const off3 = 20;

  // Spacebar
  const spaceY = y3 + kh + gap;

  type KeyDef = {
    letter: string;
    label: string;
    x: number;
    y: number;
    w?: number;       // override width
    fill: string;     // key background
    textFill?: string;
  };

  const gold = "#F8DE7E";      // jasmine — page nav
  const goldDark = "#E8C84E";  // jasmine-dark — actions
  const champ = "#F7E6CA";     // champagne — list nav
  const cream = "#FFF9E8";     // cream — utility
  const bark = "#2C2416";
  const barkMuted = "#6B5D4B";

  const keys: KeyDef[] = [
    // Row 0: ` 1 2 3 4 5
    { letter: "`",  label: "DEL",   x: off0 + 0 * step, y: y0, fill: cream },
    { letter: "1",  label: "TASK",  x: off0 + 1 * step, y: y0, fill: gold },
    { letter: "2",  label: "INV",   x: off0 + 2 * step, y: y0, fill: gold },
    { letter: "3",  label: "BUY",   x: off0 + 3 * step, y: y0, fill: gold },
    { letter: "4",  label: "IMP",   x: off0 + 4 * step, y: y0, fill: gold },
    { letter: "5",  label: "HIST",  x: off0 + 5 * step, y: y0, fill: gold },
    // Row 1: Q W E R T
    { letter: "Q",  label: "\u25C0\u25B2",  x: off1 + 0 * step, y: y1, fill: champ },
    { letter: "W",  label: "NEXT",      x: off1 + 1 * step, y: y1, fill: goldDark },
    { letter: "E",  label: "\u25B6\u25BC",  x: off1 + 2 * step, y: y1, fill: champ },
    { letter: "R",  label: "",  x: off1 + 3 * step, y: y1, fill: cream },
    { letter: "T",  label: "",  x: off1 + 4 * step, y: y1, fill: cream },
    // Row 2: A S D F
    { letter: "A",  label: "ADD",    x: off2 + 0 * step, y: y2, fill: goldDark },
    { letter: "S",  label: "SEL",    x: off2 + 1 * step, y: y2, fill: goldDark },
    { letter: "D",  label: "HOME",   x: off2 + 2 * step, y: y2, fill: gold },
    { letter: "F",  label: "DO!",    x: off2 + 3 * step, y: y2, fill: goldDark },
    // Row 3: Z _ C
    { letter: "Z",  label: "UNDO",  x: off3 + 0 * step, y: y3, fill: goldDark },
    { letter: "C",  label: "CAL",   x: off3 + 2 * step, y: y3, fill: gold },
  ];

  const svgW = off0 + 6 * step - gap;  // width to fit row 0
  const svgH = spaceY + 16;            // height including spacebar

  return (
    <div class="px-4 py-3">
      <p class="text-[10px] text-bark-light tracking-wider uppercase mb-2 text-center">Keyboard</p>
      <svg
        viewBox={`-1 -1 ${svgW + 2} ${svgH + 2}`}
        width="100%"
        role="img"
        aria-label="Keyboard shortcut legend"
      >
        {keys.map((k) => {
          const w = k.w ?? kw;
          return (
            <g>
              <rect
                x={k.x} y={k.y}
                width={w} height={kh}
                rx={4} ry={4}
                fill={k.fill}
                stroke={barkMuted}
                stroke-width={0.5}
                stroke-opacity={0.3}
              />
              {/* Key letter */}
              <text
                x={k.x + w / 2}
                y={k.y + 11}
                text-anchor="middle"
                font-size="9"
                font-weight="600"
                font-family="ui-monospace, monospace"
                fill={k.textFill ?? bark}
              >
                {k.letter}
              </text>
              {/* Function label */}
              <text
                x={k.x + w / 2}
                y={k.y + 22}
                text-anchor="middle"
                font-size="6"
                font-weight="500"
                font-family="system-ui, sans-serif"
                fill={barkMuted}
              >
                {k.label}
              </text>
            </g>
          );
        })}
        {/* Spacebar */}
        <rect
          x={off1} y={spaceY}
          width={4 * step + kw - gap} height={14}
          rx={4} ry={4}
          fill={cream}
          stroke={barkMuted}
          stroke-width={0.5}
          stroke-opacity={0.3}
        />
        <text
          x={off1 + (4 * step + kw - gap) / 2}
          y={spaceY + 10}
          text-anchor="middle"
          font-size="6"
          font-weight="500"
          font-family="system-ui, sans-serif"
          fill={barkMuted}
        >
          SPACE = CLICK
        </text>
      </svg>
    </div>
  );
}
