// Minimal stroke icons (24x24, currentColor). Kept inline so there is no icon-library dependency.
type P = { className?: string };
const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const IconHome = ({ className }: P) => (<svg {...base} className={className}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>);
export const IconCode = ({ className }: P) => (<svg {...base} className={className}><path d="M8 7l-5 5 5 5" /><path d="M16 7l5 5-5 5" /><path d="M14 4l-4 16" /></svg>);
export const IconList = ({ className }: P) => (<svg {...base} className={className}><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></svg>);
export const IconReplay = ({ className }: P) => (<svg {...base} className={className}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 8v4l3 2" /></svg>);
export const IconBolt = ({ className }: P) => (<svg {...base} className={className}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>);
export const IconKey = ({ className }: P) => (<svg {...base} className={className}><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9" /><path d="M16 7l3 3" /></svg>);
export const IconCog = ({ className }: P) => (<svg {...base} className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>);
export const IconBook = ({ className }: P) => (<svg {...base} className={className}><path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /></svg>);
export const IconSearch = ({ className }: P) => (<svg {...base} className={className}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>);
export const IconPlus = ({ className }: P) => (<svg {...base} className={className}><path d="M12 5v14M5 12h14" /></svg>);
export const IconCopy = ({ className }: P) => (<svg {...base} className={className}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>);
export const IconChevron = ({ className }: P) => (<svg {...base} className={className}><path d="M9 6l6 6-6 6" /></svg>);
export const IconMenu = ({ className }: P) => (<svg {...base} className={className}><path d="M4 6h16M4 12h16M4 18h16" /></svg>);
export const IconX = ({ className }: P) => (<svg {...base} className={className}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconDots = ({ className }: P) => (<svg {...base} className={className}><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>);
export const IconCheck = ({ className }: P) => (<svg {...base} className={className}><path d="M5 12l5 5 9-10" /></svg>);
export const IconTerminal = ({ className }: P) => (<svg {...base} className={className}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3M13 15h4" /></svg>);
export const IconArrowUp = ({ className }: P) => (<svg {...base} width={12} height={12} className={className}><path d="M12 19V5M6 11l6-6 6 6" /></svg>);
export const IconArrowDown = ({ className }: P) => (<svg {...base} width={12} height={12} className={className}><path d="M12 5v14M6 13l6 6 6-6" /></svg>);
