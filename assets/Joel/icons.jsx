/* Icons — lucide-style stroke SVGs as React components. Exposed on window.Icon */
const Icon = (function () {
  const S = ({ d, size = 18, sw = 1.75, children, fill, ...p }) =>
    React.createElement("svg", {
      width: size, height: size, viewBox: "0 0 24 24",
      fill: fill || "none", stroke: "currentColor", strokeWidth: sw,
      strokeLinecap: "round", strokeLinejoin: "round", ...p,
    }, children || React.createElement("path", { d }));

  const P = (d) => (props) => S({ d, ...props });
  const Multi = (paths) => (props) => S({ ...props, children: paths.map((pp, i) =>
    React.createElement(pp.tag || "path", { key: i, ...pp })) });

  return {
    mic: Multi([
      { d: "M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" },
      { d: "M19 10v1a7 7 0 0 1-14 0v-1" },
      { tag: "line", x1: 12, y1: 18, x2: 12, y2: 22 },
    ]),
    user: Multi([
      { d: "M19 21a7 7 0 0 0-14 0" },
      { tag: "circle", cx: 12, cy: 8, r: 4 },
    ]),
    settings: Multi([
      { tag: "circle", cx: 12, cy: 12, r: 3 },
      { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" },
    ]),
    x: Multi([{ tag: "line", x1: 18, y1: 6, x2: 6, y2: 18 }, { tag: "line", x1: 6, y1: 6, x2: 18, y2: 18 }]),
    minus: P("M5 12h14"),
    home: Multi([{ d: "M3 10.5 12 3l9 7.5" }, { d: "M5 9.5V21h14V9.5" }]),
    book: Multi([
      { d: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20" },
      { d: "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" },
    ]),
    brain: Multi([
      { d: "M9.5 2A2.5 2.5 0 0 0 7 4.5v.5a2.5 2.5 0 0 0-1 4.78V11a2.5 2.5 0 0 0 1 4.78V16a2.5 2.5 0 0 0 4 2 2.5 2.5 0 0 0 4-2v-.22A2.5 2.5 0 0 0 17 11V9.78A2.5 2.5 0 0 0 16 5v-.5A2.5 2.5 0 0 0 12 2.5 2.5 2.5 0 0 0 9.5 2z" },
      { d: "M12 4.5v15" },
    ]),
    zap: P("M13 2 4.5 13H11l-1 9 8.5-11H12l1-9z"),
    play: (p) => S({ ...p, fill: "currentColor", children: React.createElement("path", { d: "M7 4v16l13-8z", strokeWidth: 1 }) }),
    pause: Multi([{ tag: "rect", x: 6, y: 4, width: 4, height: 16, rx: 1 }, { tag: "rect", x: 14, y: 4, width: 4, height: 16, rx: 1 }]),
    volume: Multi([
      { d: "M11 5 6 9H2v6h4l5 4z" },
      { d: "M15.5 8.5a5 5 0 0 1 0 7" },
      { d: "M18.5 5.5a9 9 0 0 1 0 13" },
    ]),
    sparkles: Multi([
      { d: "M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" },
      { d: "M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" },
    ]),
    chevR: P("M9 6l6 6-6 6"),
    chevD: P("M6 9l6 6 6-6"),
    flame: P("M12 2c1 3-1 4-1 7 0 1.5 1 2.5 2 2.5S15 12 15 10c2 2 3 4 3 6a6 6 0 0 1-12 0c0-3 2.5-5 3-7 .4-1.6 2-2 3-1z"),
    layers: Multi([{ d: "M12 3 3 8l9 5 9-5-9-5z" }, { d: "M3 13l9 5 9-5" }, { d: "M3 16.5l9 5 9-5" }]),
    key: Multi([{ tag: "circle", cx: 8, cy: 15, r: 4 }, { d: "M10.8 12.2 20 3" }, { d: "M16 7l3 3" }, { d: "M15 8l2 2" }]),
    plus: Multi([{ tag: "line", x1: 12, y1: 5, x2: 12, y2: 19 }, { tag: "line", x1: 5, y1: 12, x2: 19, y2: 12 }]),
    trash: Multi([{ d: "M3 6h18" }, { d: "M8 6V4h8v2" }, { d: "M6 6l1 14h10l1-14" }]),
    eye: Multi([{ d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" }, { tag: "circle", cx: 12, cy: 12, r: 3 }]),
    check: P("M5 12.5 10 17l9-10"),
    grid: Multi([
      { tag: "rect", x: 3, y: 3, width: 7, height: 7, rx: 1.5 },
      { tag: "rect", x: 14, y: 3, width: 7, height: 7, rx: 1.5 },
      { tag: "rect", x: 3, y: 14, width: 7, height: 7, rx: 1.5 },
      { tag: "rect", x: 14, y: 14, width: 7, height: 7, rx: 1.5 },
    ]),
    waveform: Multi([
      { tag: "line", x1: 4, y1: 10, x2: 4, y2: 14 },
      { tag: "line", x1: 8, y1: 6, x2: 8, y2: 18 },
      { tag: "line", x1: 12, y1: 3, x2: 12, y2: 21 },
      { tag: "line", x1: 16, y1: 7, x2: 16, y2: 17 },
      { tag: "line", x1: 20, y1: 10, x2: 20, y2: 14 },
    ]),
    rotate: Multi([{ d: "M3 12a9 9 0 1 0 3-6.7L3 8" }, { d: "M3 3v5h5" }]),
    arrowR: Multi([{ d: "M5 12h14" }, { d: "M13 6l6 6-6 6" }]),
    skip: Multi([{ d: "M5 4l10 8-10 8z" }, { tag: "line", x1: 19, y1: 5, x2: 19, y2: 19 }]),
    activity: P("M3 12h4l3 8 4-16 3 8h4"),
    dot: (p) => S({ ...p, fill: "currentColor", children: React.createElement("circle", { cx: 12, cy: 12, r: 4, strokeWidth: 0 }) }),
    drag: Multi([
      { tag:"circle", cx:9, cy:6, r:1.4, strokeWidth:0, fill:"currentColor" },
      { tag:"circle", cx:15, cy:6, r:1.4, strokeWidth:0, fill:"currentColor" },
      { tag:"circle", cx:9, cy:12, r:1.4, strokeWidth:0, fill:"currentColor" },
      { tag:"circle", cx:15, cy:12, r:1.4, strokeWidth:0, fill:"currentColor" },
      { tag:"circle", cx:9, cy:18, r:1.4, strokeWidth:0, fill:"currentColor" },
      { tag:"circle", cx:15, cy:18, r:1.4, strokeWidth:0, fill:"currentColor" },
    ]),
  };
})();
window.Icon = Icon;
