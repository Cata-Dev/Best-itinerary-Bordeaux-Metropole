import { ref } from "vue";

function getDarkModePref() {
  return window.matchMedia("(prefers-color-scheme: dark)");
}

getDarkModePref().addEventListener(
  "change",
  () =>
    (localStorage.theme ??=
      // Auto by default
      "auto") === "auto" && refreshTheme(),
);

type Theme = `${"auto-" | ""}${"light" | "dark"}`;

function refreshTheme(): Theme {
  if (!("theme" in localStorage))
    // Auto by default
    localStorage.theme = "auto";

  const theme: "dark" | "light" =
    localStorage.theme === "auto" ? (getDarkModePref().matches ? "dark" : "light") : localStorage.theme;

  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  return localStorage.theme === "auto" ? `auto-${theme}` : theme;
}

const theme = ref<Theme>(refreshTheme());

function toggleDarkMode() {
  if (localStorage.theme === "auto") localStorage.theme = "light";
  else if (localStorage.theme === "light") localStorage.theme = "dark";
  else localStorage.theme = "auto";
  theme.value = refreshTheme();
}

export { theme, toggleDarkMode };

export type { Theme };
