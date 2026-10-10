"use client";
import { useState } from "react";
import StoreScene from "@/components/store3d/StoreScene";
import type { ShelfGroup } from "@/components/store3d/StoreScene";

export type { ShelfGroup };

export default function Scene({ items, selectedKey, onSelect }: {
  items: ShelfGroup[]; selectedKey: string | null; onSelect: (k: string) => void;
}) {
  const [quality, setQuality] = useState<"high" | "low">("high");
  return <StoreScene items={items} selectedKey={selectedKey} quality={quality} onQuality={setQuality} onSelect={onSelect} />;
}
