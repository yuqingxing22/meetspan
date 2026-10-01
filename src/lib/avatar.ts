// Stable avatar colors: the same id always gets the same color. All of these
// keep white initials above 4.5:1 contrast.
const COLORS = ["#4F46E5", "#0E7490", "#B45309", "#7C3AED", "#BE185D", "#047857", "#1D4ED8", "#B42318"];

export function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

export function initial(name: string): string {
  return (name.trim().charAt(0) || "?").toUpperCase();
}
