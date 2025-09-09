import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';

const API_URL = 'http://localhost:8000';
const CART_Z = 2147483647;

function dedupeById(arr = []) {
  const seen = new Set();
  return arr.filter(item => {
    if (!item || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function App() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [mounted, setMounted] = useState(false);
  const [cartVisible, setCartVisible] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchProducts();
    fetchCart();
     
  }, []);

  const fetchProducts = async () => {
    try {
      const resp = await axios.get(`${API_URL}/products/`);
      setProducts(Array.isArray(resp.data) ? resp.data : []);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchCart = async () => {
    try {
      const resp = await axios.get(`${API_URL}/cart/`);
      setCart(dedupeById(Array.isArray(resp.data) ? resp.data : []));
    } catch (err) {
      console.error('Error fetching cart:', err);
    }
  };

  const handleCreate = () => {
    setSelectedProduct({ name: '', price: '', description: '', stock: '' });
    setModalType('create');
    setIsModalOpen(true);
  };

  const handleEdit = (p) => {
    setSelectedProduct(p);
    setModalType('edit');
    setIsModalOpen(true);
  };

  const handleView = (p) => {
    setSelectedProduct(p);
    setModalType('view');
    setIsModalOpen(true);
  };

  const performDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/products/${id}`);
      await fetchProducts();
    } catch (err) {
      console.error(err);
    }
  };

  const showDelete = (p) => {
    setSelectedProduct(p);
    setModalType('delete');
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedProduct) return;
    await performDelete(selectedProduct.id);
    setSelectedProduct(null);
    setModalType(null);
    setIsModalOpen(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const data = {
      name: selectedProduct.name,
      price: parseFloat(selectedProduct.price),
      description: selectedProduct.description,
      stock: parseInt(selectedProduct.stock, 10) || 0,
    };
    try {
      if (modalType === 'create') {
        await axios.post(`${API_URL}/products/`, data);
      } else {
        await axios.put(`${API_URL}/products/${selectedProduct.id}`, data);
      }
      await fetchProducts();
      setSelectedProduct(null);
      setModalType(null);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving product:', err);
    }
  };

  const handleCancel = () => {
    setSelectedProduct(null);
    setModalType(null);
    setIsModalOpen(false);
  };

  const addToCart = async (productId) => {
    try {
      await axios.post(`${API_URL}/cart/`, { product_id: productId, quantity: 1 });
      await fetchCart();
      await fetchProducts();
    } catch (err) {
      console.error('Error adding to cart:', err);
    }
  };

  /**
   * removeFromCart:
   * - optimistic UI removal (cart item removed immediately)
   * - checks server product stock before deletion and after deletion
   * - if backend already restored stock when deleting the cart item, do nothing
   * - otherwise, perform a single PUT to update stock on server
   * - final fetch for consistency
   */
  const removeFromCart = async (itemId) => {
    try {
      const item = cart.find(c => c.id === itemId);
      if (!item) return;

      // Optimistic UI: remove cart item locally right away
      setCart(prev => prev.filter(i => i.id !== itemId));

      // Optimistically restore product stock in UI (so product cards reflect restored units immediately)
      setProducts(prev =>
        prev.map(p =>
          p.id === item.product.id ? { ...p, stock: Number(p.stock || 0) + Number(item.quantity || 0) } : p
        )
      );

      // --- Server-side logic (careful to avoid double-adding) ---
      // 1) fetch server product BEFORE deletion (to know baseline)
      let prodBefore = null;
      try {
        const rBefore = await axios.get(`${API_URL}/products/${item.product.id}`);
        prodBefore = rBefore.data;
      } catch (err) {
        // if GET fails, set prodBefore = null and continue (we'll attempt deletion & then fetch after)
        prodBefore = null;
      }

      // 2) delete cart item on server (some backends might auto-restore stock here)
      try {
        await axios.delete(`${API_URL}/cart/${itemId}`);
      } catch (err) {
        // deletion failed -> revert optimistic changes and re-fetch
        console.warn('Failed to delete cart item on server:', err);
        // revert optimistic UI
        setCart(prev => dedupeById([...prev, item]));
        setProducts(prev =>
          prev.map(p =>
            p.id === item.product.id ? { ...p, stock: Number(p.stock || 0) - Number(item.quantity || 0) } : p
          )
        );
        await fetchCart();
        await fetchProducts();
        return;
      }

      // 3) fetch product AFTER deletion to check whether backend already restored stock
      let prodAfter = null;
      try {
        const rAfter = await axios.get(`${API_URL}/products/${item.product.id}`);
        prodAfter = rAfter.data;
      } catch (err) {
        prodAfter = null;
      }

      // 4) Decide whether we need to update server-side product stock:
      // - If prodBefore exists and prodAfter exists:
      //     * If prodAfter.stock >= prodBefore.stock + item.quantity => backend restored (or someone else increased stock) -> do nothing
      //     * If prodAfter.stock === prodBefore.stock => backend didn't restore -> perform one PUT to set stock = prodAfter.stock + item.quantity
      // - If prodBefore missing but prodAfter exists:
      //     * If prodAfter.stock increased by >= item.quantity relative to what we expect from optimistic UI, assume restored; otherwise add item.quantity
      // - If both missing: give up and just refetch for consistency
      if (prodAfter && prodBefore) {
        const before = Number(prodBefore.stock || 0);
        const after = Number(prodAfter.stock || 0);
        const qty = Number(item.quantity || 0);

        if (after >= before + qty) {
          // backend already restored (or other change); nothing to do
        } else if (after === before) {
          // backend didn't restore; restore exactly once
          const updated = { ...prodAfter, stock: after + qty };
          try {
            await axios.put(`${API_URL}/products/${updated.id}`, updated);
          } catch (err) {
            console.warn('Failed to update product stock on server after delete:', err);
          }
        } else {
          // unexpected: after < before or other concurrent change.
          // To be safe, ensure stock is at least before + qty
          if (after < before + qty) {
            const updated = { ...prodAfter, stock: Math.max(after, before + qty) };
            try {
              await axios.put(`${API_URL}/products/${updated.id}`, updated);
            } catch (err) {
              console.warn('Failed to reconcile product stock on server:', err);
            }
          }
        }
      } else if (prodAfter && !prodBefore) {
        // No baseline; we attempted delete then fetched current
        // If prodAfter.stock seems unchanged, assume we need to add quantity
        const after = Number(prodAfter.stock || 0);
        // Compare with optimistic UI value in local products state:
        const localProd = products.find(p => p.id === item.product.id);
        const localStock = localProd ? Number(localProd.stock || 0) : null;
        // If localStock === after + qty, it means we've already incremented locally — server didn't change -> update server
        if (localStock !== null) {
          const qty = Number(item.quantity || 0);
          if (after + qty === localStock) {
            const updated = { ...prodAfter, stock: after + qty };
            try {
              await axios.put(`${API_URL}/products/${updated.id}`, updated);
            } catch (err) {
              console.warn('Failed to update product stock (no baseline):', err);
            }
          }
        }
      } else if (!prodAfter && prodBefore) {
        // server fetch after delete failed; fallback: try update using prodBefore + qty
        const qty = Number(item.quantity || 0);
        const updated = { ...prodBefore, stock: Number(prodBefore.stock || 0) + qty };
        try {
          await axios.put(`${API_URL}/products/${updated.id}`, updated);
        } catch (err) {
          console.warn('Failed to update product stock (fallback):', err);
        }
      } else {
        // both missing: we can't be sure, simply refetch both lists to let server be the source of truth
      }

      // Final refresh for deterministic consistency
      await fetchCart();
      await fetchProducts();
    } catch (err) {
      console.error('Error removing from cart:', err);
      // try to recover by reloading canonical state
      await fetchCart();
      await fetchProducts();
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  );

  // Cart portal (render only after mount)
  const CartPortal = mounted ? createPortal(
    cartVisible ? (
      <div
        style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          zIndex: CART_Z,
          width: 340,
          maxHeight: '70vh',
          overflow: 'auto',
          background: '#ffffff',
          color: '#0a0a0a',
          padding: 18,
          borderRadius: 12,
          boxShadow: '0 12px 30px rgba(0,0,0,0.16)',
          border: '1px solid rgba(0,0,0,0.08)',
        }}
        role="region"
        aria-label="Shopping cart"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Shopping Cart</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ color: '#717182', fontSize: 13 }}>{cart.length} item{cart.length !== 1 ? 's' : ''}</div>
            <button
              onClick={() => setCartVisible(false)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(0,0,0,0.06)',
                padding: '6px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                color: '#0a0a0a',
              }}
              aria-label="Hide cart"
              title="Hide cart"
            >
              Hide
            </button>
          </div>
        </div>

        {cart.length === 0 ? (
          <p style={{ margin: 0, color: '#717182' }}>Your cart is empty.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {cart.map(item => (
              <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{item.product?.name ?? 'Product'}</div>
                  <div style={{ fontSize: 13, color: '#717182' }}>Qty: {item.quantity}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#717182', fontSize: 13 }}>${item.product?.price ?? '—'}</div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    style={{
                      marginTop: 6,
                      padding: '6px 8px',
                      border: '1px solid #D4183D',
                      background: '#fff',
                      color: '#D4183D',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                    aria-label={`Remove ${item.product?.name ?? 'item'}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    ) : null,
    typeof document !== 'undefined' ? document.body : document.getElementById('root')
  ) : null;

  // small toggle for debugging / convenience
  const ToggleButton = (
    <div style={{ position: 'fixed', top: 12, right: 12, zIndex: CART_Z }}>
      <button
        onClick={() => setCartVisible(v => !v)}
        style={{
          background: '#030213',
          color: '#fff',
          border: 'none',
          padding: '8px 12px',
          borderRadius: 8,
          cursor: 'pointer',
          boxShadow: '0 6px 12px rgba(0,0,0,0.12)',
          fontSize: 13,
        }}
        aria-label="Toggle cart visibility"
      >
        {cartVisible ? 'Hide Cart' : 'Show Cart'}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-light-gray flex flex-col items-center pt-[21px] pb-[200px]">
      <div className="w-full max-w-7xl mx-auto">
        <h1 className="text-[13.2px] font-normal text-black mb-[28px]">Product Management</h1>

        <div className="flex flex-row items-center justify-between mb-6 pr-[64.578px]">
          <div className="relative w-[392px]">
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 h-[31.5px] rounded-[6.75px] border border-transparent bg-light-gray text-[10.7px] text-black placeholder-black focus:outline-none focus:border-dark-gray"
            />
          </div>
          <button onClick={handleCreate} className="inline-flex items-center bg-dark-gray hover:bg-dark-gray/80 text-white text-[11.3px] font-medium h-[31.5px] px-[13px] rounded-[6.75px] shadow-sm transition">
            Add Product
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-muted-foreground text-center py-8">No products found.</div>
          ) : (
            filteredProducts.map(product => (
              <div key={product.id} className="bg-white rounded-[12.75px] border border-[rgba(0,0,0,0.06)] shadow-sm flex flex-col relative overflow-hidden">
                <div className="p-[15px] pb-0 relative">
                  <h4 className="text-[13.2px] text-black leading-[1.06] mb-[15px]">{product.name}</h4>
                  <div className="absolute top-[15px] right-[14px] flex gap-[7px]">
                    <button onClick={() => handleView(product)} className="inline-flex items-center border border-[rgba(0,0,0,0.06)] text-black bg-white h-7 px-[10px] rounded-[6.75px] text-[11.3px] font-medium shadow-sm">View</button>
                    <button onClick={() => handleEdit(product)} className="inline-flex items-center border border-[rgba(0,0,0,0.06)] text-black bg-white h-7 px-[10px] rounded-[6.75px] text-[11.3px] font-medium shadow-sm">Edit</button>
                    <button onClick={() => showDelete(product)} className="inline-flex items-center bg-red text-white h-7 px-[8.75px] rounded-[6.75px] text-[11.3px] font-medium shadow-sm">Delete</button>
                  </div>
                </div>

                <div className="px-[14px] pb-[14px]">
                  <div className="text-[11.3px] text-muted-foreground leading-[1.55] mb-[14px] min-h-[54px]">{product.description}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11.3px] text-muted-foreground">Stock: {product.stock}</span>
                    <span className="text-[12.8px] font-medium text-dark-gray">${product.price}</span>
                  </div>
                </div>

                <button onClick={() => addToCart(product.id)} className="mt-4 p-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold text-white mx-4 mb-4">Add to Cart</button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* modal with high contrast and clear text */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-60" onClick={handleCancel}>
          <div className="bg-white rounded-[8.75px] shadow-[0_20px_30px_rgba(0,0,0,0.25)] w-full max-w-[480px] relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-[12px] right-[12px] w-8 h-8 flex items-center justify-center bg-[rgba(0,0,0,0.04)] rounded" onClick={handleCancel} aria-label="Close modal">
              ✕
            </button>
            <div className="p-[22px] text-black">
              {modalType === 'delete' ? (
                <div>
                  <h2 className="text-[18px] font-semibold mb-3">Delete Product</h2>
                  <p className="text-[13px] text-muted-foreground mb-4">Are you sure you want to delete <strong className="text-black">"{selectedProduct?.name}"</strong>? This action cannot be undone.</p>
                  <div className="flex justify-end gap-2">
                    <button onClick={handleCancel} className="h-8 px-[14px] border border-[rgba(0,0,0,0.08)] rounded-[6.75px] text-xs font-medium text-black">Cancel</button>
                    <button onClick={confirmDelete} className="h-8 px-[11px] bg-red text-white rounded-[6.75px] text-xs font-medium">Delete Product</button>
                  </div>
                </div>
              ) : modalType === 'view' ? (
                <div>
                  <h2 className="text-[16px] font-semibold text-black mb-[12px]">{selectedProduct?.name}</h2>
                  <p className="text-[14px] text-muted-foreground mb-[16px] leading-[1.5]">{selectedProduct?.description}</p>
                  <div className="h-[1px] bg-[rgba(0,0,0,0.06)] mb-[16px]"></div>
                  <div className="space-y-[10px] text-[13px] text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Product ID:</span>
                      <span className="text-black">{selectedProduct?.id ?? '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Stock:</span>
                      <span className="text-black">{selectedProduct?.stock ?? '-'} units</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Price:</span>
                      <span className="text-[13px] font-medium text-dark-gray">$ {selectedProduct?.price ?? '-'}</span>
                    </div>
                  </div>
                  <div className="flex justify-end mt-[18px]">
                    <button onClick={handleCancel} className="h-8 px-[14px] border border-[rgba(0,0,0,0.08)] rounded-[6.75px] text-xs font-medium text-black">Close</button>
                  </div>
                </div>
              ) : modalType === 'edit' ? (
                <form onSubmit={handleSave} className="space-y-[16px]">
                  <div>
                    <label className="block text-[13px] font-medium text-black mb-[6px]">Product Name</label>
                    <input type="text" placeholder="Enter product name" value={selectedProduct?.name || ''} onChange={e => setSelectedProduct({ ...selectedProduct, name: e.target.value })} required className="w-full h-9 px-[11px] py-2 bg-light-gray rounded-[6.75px] border border-transparent text-sm focus:outline-none focus:border-black" />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-black mb-[6px]">Description</label>
                    <textarea placeholder="Enter product description" value={selectedProduct?.description || ''} onChange={e => setSelectedProduct({ ...selectedProduct, description: e.target.value })} className="w-full min-h-[80px] px-[11px] py-2 bg-light-gray rounded-[6.75px] border border-transparent text-sm focus:outline-none focus:border-black" />
                  </div>

                  <div className="flex gap-[12px]">
                    <div className="flex-1">
                      <label className="block text-[13px] font-medium text-black mb-[6px]">Price ($)</label>
                      <input type="number" placeholder="0.00" value={selectedProduct?.price || ''} onChange={e => setSelectedProduct({ ...selectedProduct, price: e.target.value })} required className="w-full h-9 px-[11px] py-2 bg-light-gray rounded-[6.75px] border border-transparent text-sm focus:outline-none focus:border-black" />
                    </div>
                    <div style={{ width: 140 }}>
                      <label className="block text-[13px] font-medium text-black mb-[6px]">Stock</label>
                      <input type="number" placeholder="0" value={selectedProduct?.stock || ''} onChange={e => setSelectedProduct({ ...selectedProduct, stock: e.target.value })} required className="w-full h-9 px-[11px] py-2 bg-light-gray rounded-[6.75px] border border-transparent text-sm focus:outline-none focus:border-black" />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-[6px]">
                    <button type="button" onClick={handleCancel} className="h-9 px-[14px] border border-[rgba(0,0,0,0.08)] rounded-[6.75px] text-sm font-medium text-black">Cancel</button>
                    <button type="submit" className="h-9 px-[12px] bg-dark-gray hover:bg-dark-gray/90 text-white rounded-[6.75px] text-sm font-medium">{modalType === 'edit' ? 'Update' : 'Save'}</button>
                  </div>
                </form>
              ) : (
                // create form (same layout as edit)
                <form onSubmit={handleSave} className="space-y-[16px]">
                  <div>
                    <label className="block text-[13px] font-medium text-black mb-[6px]">Product Name</label>
                    <input type="text" placeholder="Enter product name" value={selectedProduct?.name || ''} onChange={e => setSelectedProduct({ ...selectedProduct, name: e.target.value })} required className="w-full h-9 px-[11px] py-2 bg-light-gray rounded-[6.75px] border border-transparent text-sm focus:outline-none focus:border-black" />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium text-black mb-[6px]">Description</label>
                    <textarea placeholder="Enter product description" value={selectedProduct?.description || ''} onChange={e => setSelectedProduct({ ...selectedProduct, description: e.target.value })} className="w-full min-h-[80px] px-[11px] py-2 bg-light-gray rounded-[6.75px] border border-transparent text-sm focus:outline-none focus:border-black" />
                  </div>

                  <div className="flex gap-[12px]">
                    <div className="flex-1">
                      <label className="block text-[13px] font-medium text-black mb-[6px]">Price ($)</label>
                      <input type="number" placeholder="0.00" value={selectedProduct?.price || ''} onChange={e => setSelectedProduct({ ...selectedProduct, price: e.target.value })} required className="w-full h-9 px-[11px] py-2 bg-light-gray rounded-[6.75px] border border-transparent text-sm focus:outline-none focus:border-black" />
                    </div>
                    <div style={{ width: 140 }}>
                      <label className="block text-[13px] font-medium text-black mb-[6px]">Stock</label>
                      <input type="number" placeholder="0" value={selectedProduct?.stock || ''} onChange={e => setSelectedProduct({ ...selectedProduct, stock: e.target.value })} required className="w-full h-9 px-[11px] py-2 bg-light-gray rounded-[6.75px] border border-transparent text-sm focus:outline-none focus:border-black" />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-[6px]">
                    <button type="button" onClick={handleCancel} className="h-9 px-[14px] border border-[rgba(0,0,0,0.08)] rounded-[6.75px] text-sm font-medium text-black">Cancel</button>
                    <button type="submit" className="h-9 px-[12px] bg-dark-gray hover:bg-dark-gray/90 text-white rounded-[6.75px] text-sm font-medium">Add Product</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {ToggleButton}
      {CartPortal}
    </div>
  );
}

export default App;
