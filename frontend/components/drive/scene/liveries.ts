/**
 * Paint schemes for the /drive car. Kept apart from the Three.js builder so
 * the page can show the picker without pulling the 3D engine into its
 * first load.
 */
export interface Livery {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  number: string;
}

export const LIVERIES: Livery[] = [
  { name: "Jalur", primary: "#15181c", secondary: "#f5a623", accent: "#f4efe6", number: "58" },
  { name: "Papaya", primary: "#ff8000", secondary: "#101214", accent: "#47c7fc", number: "4" },
  { name: "Rosso", primary: "#dc0000", secondary: "#f4efe6", accent: "#ffd200", number: "16" },
  { name: "Silver", primary: "#c9ced3", secondary: "#101214", accent: "#27f4d2", number: "63" },
  { name: "Navy", primary: "#1e2b58", secondary: "#e10600", accent: "#ffcc00", number: "1" },
];
