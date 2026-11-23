import type { Metadata, Viewport } from "next";
import { Anybody, Bodoni_Moda, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const anybody = Anybody({
  variable: "--font-anybody",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  display: "swap",
});

const description =
  "Velvet Layne is a design showcase by Layne at Linea: one long scroll that changes style completely, chapter by chapter.";

export const metadata: Metadata = {
  metadataBase: new URL("https://velvet-layne.vercel.app"),
  title: "Velvet Layne, a design showcase by Layne at Linea",
  description,
  openGraph: {
    title: "Velvet Layne",
    description,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0406",
  width: "device-width",
  initialScale: 1,
};

// Runs before first paint: motion styles apply only when the visitor has not
// asked for reduced motion. Without it (or without JS) the static show renders.
const motionGate = `try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("anim")}catch(e){}`;

// Runs as soon as the page's HTML is in place, long before the chapters below
// the hero hydrate (they wait for the first input). The Manifesto overlaps the
// hero and is hidden by default in CSS; this keeps --settle (how far its
// velvet has rolled in, see Manifesto.tsx) right for the scroll position, so a
// refresh part way down the page shows it in the correct state at once.
// Manifesto.tsx removes the listener when it takes over. 1.15 is its SETTLE.
const settleGate = `try{(function(){var m=document.querySelector(".manifesto");if(!m||!document.documentElement.classList.contains("anim"))return;var f=window.__mfSettle=function(){var v=-m.getBoundingClientRect().top/(innerHeight*1.15);m.style.setProperty("--settle",v<0?0:v>1?1:v)};addEventListener("scroll",f,{passive:true});f()})()}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${anybody.variable} ${bodoni.variable} ${schibsted.variable}`}
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: motionGate }} />
        {children}
        <script dangerouslySetInnerHTML={{ __html: settleGate }} />
      </body>
    </html>
  );
}
