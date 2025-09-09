import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:8000';


/**
 * Product management React component — lists, searches, creates, views, edits, and deletes products.
 *
 * This component maintains local state for the product list, the currently selected product,
 * modal mode (one of `'create' | 'edit' | 'view' | 'delete'`), modal visibility, and the search term.
 * On mount it fetches products from the API (GET `${API_URL}/products/`) and updates the list.
 * Creating, updating and deleting products are performed via POST, PUT and DELETE requests to the API
 * and the list is refreshed after successful operations.
 *
 * Modal interactions:
 * - 'create': opens a form to add a new product.
 * - 'edit': opens a form pre-filled for updating an existing product.
 * - 'view': shows read-only product details.
 * - 'delete': shows a confirmation dialog that triggers deletion on confirm.
 *
 * Filter behavior:
 * - Products are filtered client-side by the `search` term (case-insensitive) against name and description.
 *
 * Notes:
 * - Price and stock inputs are parsed to numbers before being sent to the API.
 * - API errors are logged to the console.
 *
 * @returns {JSX.Element} The product management UI.
 */
function App() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  // modalType: 'create' | 'edit' | 'view' | null
  const [modalType, setModalType] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_URL}/products/`);
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleCreate = () => {
    setSelectedProduct({ name: '', price: '', description: '', stock: '' });
    setModalType('create');
    setIsModalOpen(true);
  };

  const handleEdit = (product) => {
    setSelectedProduct(product);
    setModalType('edit');
    setIsModalOpen(true);
  };

  const handleView = (product) => {
    setSelectedProduct(product);
    setModalType('view');
    setIsModalOpen(true);
  };

  // perform the actual delete API call
  const performDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/products/${id}`);
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  // open delete confirmation dialog
  const showDelete = (product) => {
    setSelectedProduct(product);
    setModalType('delete');
    setIsModalOpen(true);
  };

  // called when user confirms delete in dialog
  const confirmDelete = async () => {
    if (!selectedProduct) return;
    await performDelete(selectedProduct.id);
    setSelectedProduct(null);
    setModalType(null);
    setIsModalOpen(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const { name, price, description, stock } = selectedProduct;
    const data = {
      name,
      price: parseFloat(price),
      description,
      stock: parseInt(stock),
    };

    try {
      if (modalType === 'create') {
        await axios.post(`${API_URL}/products/`, data);
      } else {
        await axios.put(`${API_URL}/products/${selectedProduct.id}`, data);
      }
      fetchProducts();
      setSelectedProduct(null);
      setModalType(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleCancel = () => {
    setSelectedProduct(null);
  // removed setIsCreating usage; modalType controls modal mode
    setIsModalOpen(false);
  };

  // Filter products by search
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-light-gray flex flex-col items-center pt-[21px] pb-6">
  <div className="w-full max-w-7xl mx-auto">
    <h1 className="text-[13.2px] font-normal text-black mb-[28px]">Product Management</h1>
    {/* Search and Add Bar */}
    <div className="flex flex-row items-center justify-between mb-6 pr-[64.578px]">
          <div className="relative w-[392px]">
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 h-[31.5px] rounded-[6.75px] border border-transparent bg-light-gray text-[10.7px] text-black placeholder-black focus:outline-none focus:border-dark-gray"
            />
            <span className="absolute left-3 top-[8px] text-black">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.25 12.25L9.71832 9.71832" stroke="currentColor" stroke-width="1.16667" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M6.41667 11.0833C8.994 11.0833 11.0833 8.994 11.0833 6.41667C11.0833 3.83934 8.994 1.75 6.41667 1.75C3.83934 1.75 1.75 3.83934 1.75 6.41667C1.75 8.994 3.83934 11.0833 6.41667 11.0833Z" stroke="currentColor" stroke-width="1.16667" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            </span>
          </div>
          <button
            onClick={handleCreate}
            className="inline-flex items-center bg-dark-gray hover:bg-dark-gray/80 text-white text-[11.3px] font-medium h-[31.5px] px-[13px] rounded-[6.75px] shadow-sm transition"
          >
            <svg className="mr-[8.75px]" width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 1.75V12.25" stroke="currentColor" stroke-width="1.16667" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M1.75 7H12.25" stroke="currentColor" stroke-width="1.16667" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Add Product
          </button>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full text-muted-foreground text-center py-8">No products found.</div>
          ) : (
            filteredProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-[12.75px] border border-[rgba(0,0,0,0.1)] shadow-sm flex flex-col relative overflow-hidden">
                <div className="p-[15px] pb-0 relative">
                  <h4 className="text-[13.2px] text-black leading-[1.06] mb-[15px]">{product.name}</h4>
                  <div className="absolute top-[15px] right-[14px] flex gap-[7px]">
                    <button
                      onClick={() => handleView(product)}
                      className="inline-flex items-center border border-[rgba(0,0,0,0.06)] text-black bg-white h-7 px-[10px] rounded-[6.75px] text-[11.3px] font-medium shadow-sm"
                      title="View"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.20284 7.20303C1.15423 7.07206 1.15423 6.92799 1.20284 6.79703C1.67634 5.64894 2.48006 4.6673 3.51213 3.97655C4.54419 3.2858 5.75812 2.91705 7.00001 2.91705C8.2419 2.91705 9.45583 3.2858 10.4879 3.97655C11.52 4.6673 12.3237 5.64894 12.7972 6.79703C12.8458 6.92799 12.8458 7.07206 12.7972 7.20303C12.3237 8.35111 11.52 9.33275 10.4879 10.0235C9.45583 10.7143 8.2419 11.083 7.00001 11.083C5.75812 11.083 4.54419 10.7143 3.51213 10.0235C2.48006 9.33275 1.67634 8.35111 1.20284 7.20303Z" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 8.75C7.9665 8.75 8.75 7.9665 8.75 7C8.75 6.0335 7.9665 5.25 7 5.25C6.0335 5.25 5.25 6.0335 5.25 7C5.25 7.9665 6.0335 8.75 7 8.75Z" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <button
                      onClick={() => handleEdit(product)}
                      className="inline-flex items-center border border-[rgba(0,0,0,0.06)] text-black bg-white h-7 px-[10px] rounded-[6.75px] text-[11.3px] font-medium shadow-sm"
                      title="Edit"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 1.75H2.91667C2.60725 1.75 2.3105 1.87292 2.09171 2.09171C1.87292 2.3105 1.75 2.60725 1.75 2.91667V11.0833C1.75 11.3928 1.87292 11.6895 2.09171 11.9083C2.3105 12.1271 2.60725 12.25 2.91667 12.25H11.0833C11.3928 12.25 11.6895 12.1271 11.9083 11.9083C12.1271 11.6895 12.25 11.3928 12.25 11.0833V7" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/><path d="M10.7187 1.53126C10.9508 1.2992 11.2655 1.16882 11.5937 1.16882C11.9219 1.16882 12.2367 1.2992 12.4687 1.53126C12.7008 1.76332 12.8312 2.07807 12.8312 2.40626C12.8312 2.73445 12.7008 3.0492 12.4687 3.28126L7.21114 8.53943C7.07263 8.67782 6.90151 8.77913 6.71356 8.83401L5.03764 9.32401C4.98744 9.33865 4.93424 9.33953 4.88359 9.32655C4.83294 9.31357 4.78671 9.28722 4.74973 9.25025C4.71276 9.21328 4.68641 9.16705 4.67343 9.1164C4.66046 9.06575 4.66133 9.01254 4.67597 8.96234L5.16597 7.28643C5.22111 7.09862 5.32262 6.92771 5.46114 6.78943L10.7187 1.53126Z" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <button
                      onClick={() => showDelete(product)}
                      className="inline-flex items-center bg-red text-white h-7 px-[8.75px] rounded-[6.75px] text-[11.3px] font-medium shadow-sm"
                      title="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5.83334 6.41669V9.91669" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/><path d="M8.16666 6.41669V9.91669" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/><path d="M11.0833 3.5V11.6667C11.0833 11.9761 10.9604 12.2728 10.7416 12.4916C10.5228 12.7104 10.2261 12.8333 9.91666 12.8333H4.08332C3.7739 12.8333 3.47716 12.7104 3.25837 12.4916C3.03957 12.2728 2.91666 11.9761 2.91666 11.6667V3.5" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/><path d="M1.75 3.5H12.25" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/><path d="M4.66666 3.50002V2.33335C4.66666 2.02393 4.78957 1.72719 5.00837 1.5084C5.22716 1.2896 5.5239 1.16669 5.83332 1.16669H8.16666C8.47608 1.16669 8.77282 1.2896 8.99161 1.5084C9.21041 1.72719 9.33332 2.02393 9.33332 2.33335V3.50002" stroke="currentColor" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                </div>
                <div className="px-[14px] pb-[14px]">
                  <div className="text-[11.3px] text-muted-foreground leading-[1.55] mb-[14px] min-h-[54px]">{product.description}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11.3px] text-muted-foreground">Stock: {product.stock}</span>
                    <span className="text-[12.8px] font-medium text-dark-gray">${product.price}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={handleCancel}>
          <div className="bg-white rounded-[8.75px] shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.1)] w-full max-w-[388px] relative" onClick={e => e.stopPropagation()}>
            <button
              className="absolute top-[15px] right-[15px] w-6 h-6 flex items-center justify-center"
              onClick={handleCancel}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 1L11 11M1 11L11 1" />
              </svg>
            </button>
              <div className="p-[22px]">
              {modalType === 'delete' ? (
                <div>
                  <h2 className="text-base font-semibold text-black mb-[12px]">Delete Product</h2>
                  <p className="text-[12px] text-muted-foreground mb-[18px]">Are you sure you want to delete "{selectedProduct?.name}"? This action cannot be undone.</p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="h-8 px-[14px] border border-[rgba(0,0,0,0.1)] rounded-[6.75px] text-xs font-medium text-black"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmDelete}
                      className="h-8 px-[11px] bg-red text-white rounded-[6.75px] text-xs font-medium"
                    >
                      Delete Product
                    </button>
                  </div>
                </div>
              ) : modalType === 'view' ? (
                <div>
                  <h2 className="text-[16px] font-semibold text-black mb-[12px]">Product Details</h2>
                  <h3 className="text-[16px] font-medium text-black mb-[12px]">{selectedProduct?.name}</h3>
                  <p className="text-[16px] text-muted-foreground mb-[16px] leading-[1.5]">{selectedProduct?.description}</p>
                  <div className="h-[1px] bg-[rgba(0,0,0,0.1)] mb-[16px]"></div>
                  <div className="space-y-[10px] text-[12px] text-muted-foreground">
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
                      <span className="text-[12px] font-medium text-dark-gray">$ {selectedProduct?.price ?? '-'}</span>
                    </div>
                  </div>
                  <div className="flex justify-end mt-[18px]">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="h-8 px-[14px] border border-[rgba(0,0,0,0.1)] rounded-[6.75px] text-xs font-medium text-black"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : modalType === 'edit' ? (
                <form onSubmit={handleSave} className="space-y-[18px]">
                  <div>
                    <label className="block text-[12px] font-medium text-black mb-[6px]">Product Name</label>
                    <input
                      type="text"
                      placeholder="Enter product name"
                      value={selectedProduct?.name || ''}
                      onChange={e => setSelectedProduct({ ...selectedProduct, name: e.target.value })}
                      required
                      className="w-full h-8 px-[11px] py-2 bg-light-gray rounded-[6.75px] border border-transparent text-xs focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-black mb-[6px]">Description</label>
                    <textarea
                      placeholder="Enter product description"
                      value={selectedProduct?.description || ''}
                      onChange={e => setSelectedProduct({ ...selectedProduct, description: e.target.value })}
                      className="w-full min-h-[69px] px-[11px] py-2 bg-light-gray rounded-[6.75px] border border-transparent text-sm focus:outline-none focus:border-black"
                    />
                  </div>
                  <div className="flex gap-[16px]">
                    <div>
                      <label className="block text-[12px] font-medium text-black mb-[6px]">Price ($)</label>
                      <input
                        type="number"
                        placeholder="199.99"
                        value={selectedProduct?.price || ''}
                        onChange={e => setSelectedProduct({ ...selectedProduct, price: e.target.value })}
                        required
                        className="w-[165px] h-8 px-[11px] py-2 bg-light-gray rounded-[6.75px] border border-transparent text-xs focus:outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-black mb-[6px]">Stock</label>
                      <input
                        type="number"
                        placeholder="25"
                        value={selectedProduct?.stock || ''}
                        onChange={e => setSelectedProduct({ ...selectedProduct, stock: e.target.value })}
                        required
                        className="w-[165px] h-8 px-[11px] py-2 bg-light-gray rounded-[6.75px] border border-transparent text-xs focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-[12px]">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="h-8 w-[68px] px-[14px] border border-[rgba(0,0,0,0.1)] rounded-[6.75px] text-xs font-medium text-black"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="h-8 w-[113px] bg-dark-gray hover:bg-dark-gray/80 text-white rounded-[6.75px] text-xs font-medium"
                    >
                      Update Product
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSave} className="space-y-[18px]">
                  <div>
                    <label className="block text-[12px] font-medium text-black mb-[6px]">Product Name</label>
                    <input
                      type="text"
                      placeholder="Enter product name"
                      value={selectedProduct?.name || ''}
                      onChange={e => setSelectedProduct({ ...selectedProduct, name: e.target.value })}
                      required
                      className="w-full h-8 px-[11px] py-2 bg-light-gray rounded-[6.75px] border border-transparent text-xs focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-black mb-[6px]">Description</label>
                    <textarea
                      placeholder="Enter product description"
                      value={selectedProduct?.description || ''}
                      onChange={e => setSelectedProduct({ ...selectedProduct, description: e.target.value })}
                      className="w-full min-h-[56px] px-[11px] py-2 bg-light-gray rounded-[6.75px] border border-transparent text-sm focus:outline-none focus:border-black"
                    />
                  </div>
                  <div className="flex gap-[16px]">
                    <div>
                      <label className="block text-[12px] font-medium text-black mb-[6px]">Price ($)</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={selectedProduct?.price || ''}
                        onChange={e => setSelectedProduct({ ...selectedProduct, price: e.target.value })}
                        required
                        className="w-[165px] h-8 px-[11px] py-2 bg-light-gray rounded-[6.75px] border border-transparent text-xs focus:outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-black mb-[6px]">Stock</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={selectedProduct?.stock || ''}
                        onChange={e => setSelectedProduct({ ...selectedProduct, stock: e.target.value })}
                        required
                        className="w-[165px] h-8 px-[11px] py-2 bg-light-gray rounded-[6.75px] border border-transparent text-xs focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-[12px]">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="h-8 w-[68px] px-[14px] border border-[rgba(0,0,0,0.1)] rounded-[6.75px] text-xs font-medium text-black"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="h-8 w-[113px] bg-dark-gray hover:bg-dark-gray/80 text-white rounded-[6.75px] text-xs font-medium"
                    >
                      Add Product
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;