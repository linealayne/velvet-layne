"use client";

import { use, type ReactNode } from "react";
import { firstInput } from "@/lib/gate";

/**
 * Renders its children as usual on the server. In the browser it holds back
 * React's hydration of them until the visitor's first input: the server's
 * HTML stays on screen untouched, and React only wakes these chapters up when
 * someone is about to use them. Must sit inside a <Suspense>.
 */
export default function AfterInput({ children }: { children: ReactNode }) {
  if (typeof window !== "undefined") use(firstInput);
  return children;
}
