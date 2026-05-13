const ANSI = /\x1b\[[0-9;]*m/g;
export default function stripAnsi(s: string): string {
  return s.replace(ANSI, "");
}
