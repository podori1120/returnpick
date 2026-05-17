import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#182026",
        mist: "#f5f7f8",
        line: "#dde4e8",
        pine: "#1f6f5b",
        coral: "#d95f43",
        lemon: "#f0bf49",
        steel: "#4a6672"
      },
      boxShadow: {
        soft: "0 16px 45px rgba(20, 36, 45, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
