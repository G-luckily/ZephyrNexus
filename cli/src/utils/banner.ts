import pc from "picocolors";

const ZEPHYR_ART = [
  "  ███████╗███████╗██████╗ ██╗  ██╗██╗   ██╗██████╗ ",
  "  ╚══███╔╝██╔════╝██╔══██╗██║  ██║╚██╗ ██╔╝██╔══██╗",
  "    ███╔╝ █████╗  ██████╔╝███████║ ╚████╔╝ ██████╔╝",
  "   ███╔╝  ██╔══╝  ██╔═══╝ ██╔══██║  ╚██╔╝  ██╔══██╗",
  "  ███████╗███████╗██║     ██║  ██║   ██║   ██║  ██║",
  "  ╚══════╝╚══════╝╚═╝     ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝",
] as const;

const TAGLINE = "Zephyr Nexus: Celestial AI orchestration powered by Paperclip";

export function printPaperclipCliBanner(): void {
  const sky = "\x1b[38;5;111m";
  const purple = "\x1b[38;5;141m";
  const silver = "\x1b[38;5;153m";
  const gray = "\x1b[38;5;248m";
  const reset = "\x1b[0m";

  const lines = [
    "",
    ...ZEPHYR_ART.map((line) => `${sky}${line}${reset}`),
    `${silver}                                           N E X U S${reset}`,
    `${silver}  ───────────────────────────────────────────────────────${reset}`,
    `  ${gray}${TAGLINE}${reset}`,
    "",
  ];

  console.log(lines.join("\n"));
}
