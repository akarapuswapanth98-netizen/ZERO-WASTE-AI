"use client";

import React, { useEffect, useState } from "react";
import {
  Boxes,
  Calendar,
  ChevronDown,
  ChevronRight,
  Filter,
  Package,
  RefreshCw,
  Search,
  Store as StoreIcon,
  X,
} from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassInput } from "@/components/ui/GlassInput";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WarehouseShelves } from "@/components/3d/WarehouseShelves";
import { api, InventoryBatch, Product, Store } from "@/lib/api";

export default function InventoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);

  // Filter state
  const [selectedStoreId, setSelectedStoreId] = useState<number | "all">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Drawer state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const invData = await api.getInventory();
      setStores(invData.stores || []);
      setProducts(invData.products || []);

      const storeParam = selectedStoreId === "all" ? undefined : selectedStoreId;
      const batchData = await api.getBatches(storeParam);
      setBatches(batchData.batches || []);
    } catch (err: any) {
      setError(err.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId]);

  const categories = ["all", "dairy", "bakery", "produce", "meat", "seafood", "ready-to-eat"];

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Batches for selected product in drawer
  const productBatches = selectedProduct
    ? batches.filter((b) => b.product_id === selectedProduct.id)
    : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8F2EC] tracking-tight">Inventory Explorer</h1>
          <p className="text-sm text-[#9EB5A8] mt-0.5">
            Real-time multi-store catalog, FIFO batch expiry tracking, and stock position auditing.
          </p>
        </div>

        <GlassButton variant="secondary" size="md" onClick={loadData} id="btn-refresh-inventory">
          <RefreshCw className="w-4 h-4 mr-2" />
          Sync Data
        </GlassButton>
      </div>

      {/* 3D Isometric Shelf Unit */}
      <WarehouseShelves />

      {/* Control Bar: Store Switcher, Category Filter, Search */}
      <GlassPanel className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Store Switcher */}
          <div className="flex items-center gap-2">
            <StoreIcon className="w-4 h-4 text-[#66E3A1]" />
            <span className="text-xs font-semibold uppercase text-[#9EB5A8]">Store:</span>
            <select
              id="select-store-filter"
              value={selectedStoreId}
              onChange={(e) =>
                setSelectedStoreId(e.target.value === "all" ? "all" : parseInt(e.target.value, 10))
              }
              className="bg-[#101D16] border border-[#2A4033] rounded-lg px-3 py-1.5 text-sm text-[#E8F2EC] focus:outline-none focus:border-[#66E3A1]"
            >
              <option value="all">All Stores (Aggregate)</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#6B8576] absolute left-3 top-1/2 -translate-y-1/2" />
            <GlassInput
              id="input-inventory-search"
              placeholder="Search by product name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-[#2A4033]/50">
          <span className="text-xs text-[#9EB5A8] mr-1">Category:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              id={`filter-category-${cat}`}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize shrink-0 ${
                selectedCategory === cat
                  ? "bg-[#66E3A1] text-[#0B1511] font-semibold"
                  : "bg-[#101D16] text-[#9EB5A8] hover:text-[#E8F2EC] border border-[#2A4033]"
              }`}
            >
              {cat.replace("-", " ")}
            </button>
          ))}
        </div>
      </GlassPanel>

      {/* 2D Table */}
      <GlassPanel className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" id="table-inventory">
            <thead className="bg-[#101D16]/90 border-b border-[#2A4033] text-xs font-semibold text-[#9EB5A8] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Product & SKU</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5 text-right">Unit Price</th>
                <th className="px-4 py-3.5 text-right">Cost</th>
                <th className="px-4 py-3.5 text-right">Shelf Life</th>
                <th className="px-4 py-3.5 text-right">Lead Time</th>
                <th className="px-4 py-3.5 text-right">Total On-Hand</th>
                <th className="px-5 py-3.5 text-center">Batch Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A4033]/60">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[#9EB5A8]">
                    No inventory items found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const hasOverstock = p.total_on_hand > 50;
                  const hasLowStock = p.total_on_hand < 15;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-[#1C3A2A]/40 transition-colors cursor-pointer group"
                      onClick={() => setSelectedProduct(p)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-[#E8F2EC] group-hover:text-[#66E3A1] transition-colors">
                          {p.name}
                        </div>
                        <div className="text-xs text-[#9EB5A8] font-mono">{p.sku}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="capitalize text-xs text-[#9EB5A8] px-2.5 py-0.5 rounded-md bg-[#101D16] border border-[#2A4033]">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-[#E8F2EC]">
                        ${p.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-[#9EB5A8]">
                        ${p.unit_cost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-[#E8F2EC]">
                        {p.shelf_life_days} days
                      </td>
                      <td className="px-4 py-3.5 text-right text-[#9EB5A8]">
                        {p.supplier_lead_time_days}d (MOQ {p.min_order_qty})
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span
                          className={`font-bold ${
                            hasLowStock
                              ? "text-[#FF7D78]"
                              : hasOverstock
                              ? "text-[#F4B860]"
                              : "text-[#66E3A1]"
                          }`}
                        >
                          {p.total_on_hand} units
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <GlassButton
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(p);
                          }}
                          className="text-[#66E3A1] hover:text-[#43C985]"
                        >
                          Inspect Batches
                          <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </GlassButton>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      {/* Detail Batch Drawer */}
      {selectedProduct && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-[#101D16]/95 backdrop-blur-2xl border-l border-[#2A4033] shadow-2xl z-50 p-6 flex flex-col justify-between animate-in slide-in-from-right duration-200">
          <div className="space-y-6 overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-[#2A4033] pb-4">
              <div>
                <span className="text-xs uppercase font-mono text-[#66E3A1]">{selectedProduct.sku}</span>
                <h3 className="text-xl font-bold text-[#E8F2EC] mt-0.5">{selectedProduct.name}</h3>
                <span className="text-xs text-[#9EB5A8] capitalize">{selectedProduct.category} department</span>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 text-[#9EB5A8] hover:text-[#E8F2EC] rounded-lg hover:bg-[#172A20]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Spec Cards */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#172A20]/80 border border-[#2A4033]">
                <span className="text-[#9EB5A8]">Unit Weight:</span>
                <p className="font-semibold text-[#E8F2EC] mt-0.5">{selectedProduct.unit_weight_kg} kg</p>
              </div>
              <div className="p-3 rounded-xl bg-[#172A20]/80 border border-[#2A4033]">
                <span className="text-[#9EB5A8]">Nominal Margin:</span>
                <p className="font-semibold text-[#66E3A1] mt-0.5">
                  ${(selectedProduct.price - selectedProduct.unit_cost).toFixed(2)} (
                  {Math.round(((selectedProduct.price - selectedProduct.unit_cost) / selectedProduct.price) * 100)}%)
                </p>
              </div>
            </div>

            {/* Batches Breakdown */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-[#E8F2EC] flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-[#66E3A1]" />
                  Active FIFO Batches ({productBatches.length})
                </h4>
              </div>

              {productBatches.length === 0 ? (
                <p className="text-xs text-[#9EB5A8] py-4 text-center">No active batches recorded in this store.</p>
              ) : (
                <div className="space-y-2.5">
                  {productBatches.map((b) => {
                    const exp = new Date(b.expiry_date);
                    const isExpiringSoon = exp.getTime() - new Date("2026-10-12").getTime() <= 3 * 86400000;

                    return (
                      <div
                        key={b.id}
                        className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                          isExpiringSoon
                            ? "bg-[#FF7D78]/10 border-[#FF7D78]/30 shadow-sm"
                            : "bg-[#172A20]/60 border-[#2A4033]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-[#E8F2EC]">{b.batch_code}</span>
                          <span className="text-[#9EB5A8]">{b.store_name}</span>
                        </div>
                        <div className="flex items-center justify-between text-[#9EB5A8]">
                          <span>
                            Expires:{" "}
                            <strong className={isExpiringSoon ? "text-[#FF7D78]" : "text-[#E8F2EC]"}>
                              {b.expiry_date}
                            </strong>
                          </span>
                          <span className="font-bold text-[#E8F2EC] text-sm">
                            {b.current_quantity} / {b.initial_quantity} units
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-[#2A4033]">
            <GlassButton
              variant="secondary"
              className="w-full"
              onClick={() => setSelectedProduct(null)}
            >
              Close Drawer
            </GlassButton>
          </div>
        </div>
      )}
    </div>
  );
}
