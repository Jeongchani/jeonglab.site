// src/main.ts
import type { LinkItem } from "./types/link";
import linksJson from "./data/links.sample.json";
import { initApp } from "./ui/app";

const app = document.getElementById("app");

if (app) {
  const links = linksJson as LinkItem[];
  initApp(app, links);
} else {
  console.error("#app element not found");
}
