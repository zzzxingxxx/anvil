/// <reference types="vite/client" />

interface AnvilDesktop {
  pickFolder(): Promise<string | null>;
}

interface Window {
  anvilDesktop?: AnvilDesktop;
}
