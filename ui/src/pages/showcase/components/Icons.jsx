import React from 'react'

export const Ic = ({ name, size = 14, stroke = 1.5, ...rest }) => {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...rest,
  };
  const paths = {
    wind: (
      <>
        <path d="M3 8h11a3 3 0 1 0-3-3" />
        <path d="M3 12h17a3 3 0 1 1-3 3" />
        <path d="M3 16h9" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
    workflow: (
      <>
        <circle cx="5" cy="6" r="2" />
        <circle cx="19" cy="6" r="2" />
        <circle cx="12" cy="18" r="2" />
        <path d="M7 6h10M6.5 7.5l5 9M17.5 7.5l-5 9" />
      </>
    ),
    agents: (
      <>
        <circle cx="9" cy="9" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 19c0-2.5 2.7-4 6-4s6 1.5 6 4" />
        <path d="M14 19c0-1.7 1.5-3 3-3s3 1.3 3 3" />
      </>
    ),
    runtime: (
      <>
        <path d="M3 12h4l2-6 4 12 2-6h6" />
      </>
    ),
    budget: (
      <>
        <path d="M4 7h16v12H4z" />
        <path d="M4 11h16" />
        <circle cx="9" cy="15" r="1.3" />
      </>
    ),
    shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />,
    audit: (
      <>
        <path d="M14 3H6v18h12V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6M9 17h4" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </>
    ),
    inbox: (
      <>
        <path d="M3 13l3-9h12l3 9" />
        <path d="M3 13v6h18v-6" />
        <path d="M3 13h5l1 3h6l1-3h5" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    arrow: <path d="M5 12h14M13 5l7 7-7 7" />,
    arrowUR: <path d="M7 17L17 7M9 7h8v8" />,
    play: <path d="M6 4l14 8-14 8z" />,
    pause: <path d="M7 4v16M17 4v16" />,
    bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
    search: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="M20 20l-3.5-3.5" />
      </>
    ),
    filter: <path d="M3 5h18l-7 8v7l-4-2v-5L3 5z" />,
    chev: <path d="M9 6l6 6-6 6" />,
    chevD: <path d="M6 9l6 6 6-6" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v.01M12 11v5" />
      </>
    ),
    more: (
      <>
        <circle cx="12" cy="6" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="18" r="1" />
      </>
    ),
    check: <path d="M5 12l5 5L20 7" />,
    cmd: (
      <>
        <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6z" />
      </>
    ),
    sparkles: (
      <>
        <path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z" />
        <path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  };
  return <svg {...common}>{paths[name] || null}</svg>;
};
