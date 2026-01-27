const STORAGE_KEY = "pdv_data_v1";

const elements = {
  warehouseForm: document.getElementById("warehouse-form"),
  warehouseTable: document.getElementById("warehouse-table"),
  productForm: document.getElementById("product-form"),
  productCancel: document.getElementById("product-cancel"),
  productSearch: document.getElementById("product-search"),
  productFilterCategory: document.getElementById("product-filter-category"),
  productFilterStatus: document.getElementById("product-filter-status"),
  productStockWarehouse: document.getElementById("product-stock-warehouse"),
  productStockQuantity: document.getElementById("product-stock-quantity"),
  productStockAdd: document.getElementById("product-stock-add"),
  productStockTable: document.getElementById("product-stock-table"),
  productTable: document.getElementById("product-table"),
  saleForm: document.getElementById("sale-form"),
  saleClear: document.getElementById("sale-clear"),
  cartTable: document.getElementById("cart-table"),
  cartSubtotal: document.getElementById("cart-subtotal"),
  cartDiscount: document.getElementById("cart-discount"),
  cartDiscountValue: document.getElementById("cart-discount-value"),
  cartTotal: document.getElementById("cart-total"),
  paymentMethod: document.getElementById("payment-method"),
  saleNote: document.getElementById("sale-note"),
  checkout: document.getElementById("checkout"),
  salesTable: document.getElementById("sales-table"),
};

let state = loadState();
let editingProductId = null;
let draftStocks = {};

ensureDefaultWarehouse();
ensureCartWarehouses();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      products: [],
      cart: [],
      sales: [],
    };
  }
  try {
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    return { products: [], cart: [], sales: [] };
  }
}

function normalizeState(rawState) {
  return {
    warehouses: Array.isArray(rawState.warehouses)
      ? rawState.warehouses
      : [],
    products: Array.isArray(rawState.products)
      ? rawState.products.map(normalizeProduct)
      : [],
    cart: Array.isArray(rawState.cart)
      ? rawState.cart.map(normalizeCartItem)
      : [],
    sales: Array.isArray(rawState.sales) ? rawState.sales : [],
  };
}

function normalizeProduct(product) {
  const price = Number(product.price) || 0;
  const cost = Number(product.cost) || 0;
  const margin =
    Number.isFinite(product.margin) && product.margin >= 0
      ? Number(product.margin)
      : computeMargin(price, cost);
  return {
    id: product.id,
    name: product.name || "",
    category: product.category || "",
    sku: product.sku || "",
    barcode: product.barcode || "",
    unit: product.unit || "un",
    price,
    cost,
    margin,
    stock: Number(product.stock) || 0,
    stocks:
      product.stocks && typeof product.stocks === "object"
        ? product.stocks
        : {},
    minStock: Number(product.minStock) || 0,
    supplier: product.supplier || "",
    notes: product.notes || "",
    status: product.status || "active",
  };
}

function normalizeCartItem(item) {
  return {
    productId: item.productId,
    quantity: Number(item.quantity) || 0,
    warehouseId: item.warehouseId || "",
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function computeMargin(price, cost) {
  if (!price || price <= 0) return 0;
  return ((price - cost) / price) * 100;
}

function ensureDefaultWarehouse() {
  if (state.warehouses.length === 0) {
    state.warehouses.push({
      id: crypto.randomUUID(),
      name: "Principal",
    });
  }
  migrateLegacyStocks();
  saveState();
}

function migrateLegacyStocks() {
  const defaultWarehouseId = state.warehouses[0]?.id;
  if (!defaultWarehouseId) return;
  state.products.forEach((product) => {
    if (!product.stocks || Object.keys(product.stocks).length === 0) {
      product.stocks = { [defaultWarehouseId]: product.stock || 0 };
    }
  });
}

function ensureCartWarehouses() {
  const defaultWarehouseId = state.warehouses[0]?.id;
  if (!defaultWarehouseId) return;
  state.cart.forEach((item) => {
    if (!item.warehouseId) {
      item.warehouseId = defaultWarehouseId;
    }
  });
  saveState();
}

function getWarehouseById(warehouseId) {
  return state.warehouses.find((warehouse) => warehouse.id === warehouseId);
}

function computeTotalStock(stocks) {
  return Object.values(stocks).reduce((sum, qty) => sum + Number(qty || 0), 0);
}

function renderWarehouses() {
  const rows = state.warehouses
    .map(
      (warehouse) => `
        <tr>
          <td>${warehouse.name}</td>
          <td class="actions">
            <button type="button" data-warehouse-delete="${warehouse.id}" class="ghost">Excluir</button>
          </td>
        </tr>
      `
    )
    .join("");

  elements.warehouseTable.innerHTML =
    rows || `<tr><td colspan="2" class="empty">Nenhum warehouse cadastrado.</td></tr>`;

  elements.productStockWarehouse.innerHTML = state.warehouses
    .map(
      (warehouse) =>
        `<option value="${warehouse.id}">${warehouse.name}</option>`
    )
    .join("");

  const saleWarehouseSelect = elements.saleForm.querySelector(
    "select[name='warehouseId']"
  );
  saleWarehouseSelect.innerHTML = state.warehouses
    .map(
      (warehouse) =>
        `<option value="${warehouse.id}">${warehouse.name}</option>`
    )
    .join("");
}

function renderProductStockDraft() {
  const rows = Object.entries(draftStocks)
    .map(([warehouseId, quantity]) => {
      const warehouse = getWarehouseById(warehouseId);
      return `
        <tr>
          <td>${warehouse ? warehouse.name : "Warehouse removido"}</td>
          <td>${quantity}</td>
          <td class="actions">
            <button type="button" data-stock-remove="${warehouseId}" class="ghost">Remover</button>
          </td>
        </tr>
      `;
    })
    .join("");

  elements.productStockTable.innerHTML =
    rows ||
    `<tr><td colspan="3" class="empty">Sem estoque por warehouse.</td></tr>`;
  elements.productForm.stock.value = computeTotalStock(draftStocks);
}

function upsertDraftStock() {
  const warehouseId = elements.productStockWarehouse.value;
  const quantity = Number(elements.productStockQuantity.value);
  if (!warehouseId || Number.isNaN(quantity) || quantity < 0) return;
  draftStocks[warehouseId] = quantity;
  elements.productStockQuantity.value = "";
  renderProductStockDraft();
}

function removeDraftStock(warehouseId) {
  delete draftStocks[warehouseId];
  renderProductStockDraft();
}

function renderSaleWarehousesForProduct(productId) {
  const saleWarehouseSelect = elements.saleForm.querySelector(
    "select[name='warehouseId']"
  );
  const product = getProductById(productId);
  if (!product || !product.stocks) {
    saleWarehouseSelect.innerHTML = `<option value="">Sem warehouse</option>`;
    saleWarehouseSelect.disabled = true;
    return;
  }

  const options = Object.entries(product.stocks)
    .filter(([, qty]) => Number(qty) > 0)
    .map(([warehouseId]) => {
      const warehouse = getWarehouseById(warehouseId);
      return warehouse
        ? `<option value="${warehouse.id}">${warehouse.name}</option>`
        : "";
    })
    .join("");

  if (!options) {
    saleWarehouseSelect.innerHTML = `<option value="">Sem estoque</option>`;
    saleWarehouseSelect.disabled = true;
  } else {
    saleWarehouseSelect.innerHTML = options;
    saleWarehouseSelect.disabled = false;
  }
}

function resetProductForm() {
  elements.productForm.reset();
  elements.productForm.margin.value = "0";
  elements.productForm.querySelector("button[type='submit']").textContent =
    "Salvar produto";
  editingProductId = null;
  draftStocks = {};
  renderProductStockDraft();
}

function updateMarginField() {
  const price = Number(elements.productForm.price.value) || 0;
  const cost = Number(elements.productForm.cost.value) || 0;
  const margin = computeMargin(price, cost);
  elements.productForm.margin.value = margin.toFixed(2);
}

function getProductById(productId) {
  return state.products.find((product) => product.id === productId);
}

function renderCategoryFilter() {
  const categories = Array.from(
    new Set(state.products.map((product) => product.category).filter(Boolean))
  );
  const current = elements.productFilterCategory.value;
  elements.productFilterCategory.innerHTML =
    `<option value="">Todas</option>` +
    categories
      .map((category) => `<option value="${category}">${category}</option>`)
      .join("");
  elements.productFilterCategory.value = categories.includes(current)
    ? current
    : "";
}

function getFilteredProducts() {
  const search = elements.productSearch.value.trim().toLowerCase();
  const category = elements.productFilterCategory.value;
  const status = elements.productFilterStatus.value;
  return state.products.filter((product) => {
    const matchesSearch =
      !search ||
      product.name.toLowerCase().includes(search) ||
      product.sku.toLowerCase().includes(search) ||
      product.barcode.toLowerCase().includes(search);
    const matchesCategory = !category || product.category === category;
    const matchesStatus = !status || product.status === status;
    return matchesSearch && matchesCategory && matchesStatus;
  });
}

function formatStatus(product) {
  return product.status === "inactive" ? "Inativo" : "Ativo";
}

function renderProducts() {
  renderCategoryFilter();
  const rows = getFilteredProducts()
    .map((product) => {
      const totalStock = computeTotalStock(product.stocks || {});
      const isLowStock =
        product.minStock > 0 && totalStock <= product.minStock;
      const warehouseInfo = Object.entries(product.stocks || {})
        .map(([warehouseId, quantity]) => {
          const warehouse = getWarehouseById(warehouseId);
          return `${warehouse ? warehouse.name : "?"}: ${quantity}`;
        })
        .join(", ");
      return `
        <tr>
          <td>${product.name}</td>
          <td>${product.sku || "-"}</td>
          <td>${product.category || "-"}</td>
          <td>${formatCurrency(product.price)}</td>
          <td>${totalStock}${isLowStock ? ' <span class="muted">(baixo)</span>' : ""}</td>
          <td>${warehouseInfo || "-"}</td>
          <td>${formatStatus(product)}</td>
          <td class="actions">
            <button type="button" data-edit="${product.id}">Editar</button>
            <button type="button" data-delete="${product.id}" class="ghost">Excluir</button>
          </td>
        </tr>
      `;
    })
    .join("");

  elements.productTable.innerHTML =
    rows ||
    `<tr><td colspan="8" class="empty">Nenhum produto cadastrado.</td></tr>`;

  const select = elements.saleForm.querySelector("select[name='productId']");
  const saleProducts = state.products.filter(
    (product) => product.status !== "inactive"
  );
  select.innerHTML = saleProducts
    .map(
      (product) => {
        const totalStock = computeTotalStock(product.stocks || {});
        return `<option value="${product.id}">${product.name} (${product.unit}, estoque: ${totalStock})</option>`;
      }
    )
    .join("");

  if (saleProducts.length === 0) {
    select.innerHTML = `<option value="">Cadastre um produto primeiro</option>`;
    select.disabled = true;
    elements.saleForm.querySelector("button[type='submit']").disabled = true;
    renderSaleWarehousesForProduct("");
  } else {
    select.disabled = false;
    elements.saleForm.querySelector("button[type='submit']").disabled = false;
    renderSaleWarehousesForProduct(select.value);
  }
}

function renderCart() {
  const rows = state.cart
    .map((item) => {
      const product = getProductById(item.productId);
      const price = product ? product.price : 0;
      const warehouse = getWarehouseById(item.warehouseId);
      return `
        <tr>
          <td>${product ? product.name : "Produto removido"}</td>
          <td>${warehouse ? warehouse.name : "-"}</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(price)}</td>
          <td>${formatCurrency(item.quantity * price)}</td>
          <td class="actions">
            <button type="button" data-cart-remove="${item.productId}" data-cart-warehouse="${item.warehouseId}" class="ghost">Remover</button>
          </td>
        </tr>
      `;
    })
    .join("");

  elements.cartTable.innerHTML =
    rows || `<tr><td colspan="6" class="empty">Carrinho vazio.</td></tr>`;

  const subtotal = state.cart.reduce((sum, item) => {
    const product = getProductById(item.productId);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);

  let discount = Number(elements.cartDiscount.value) || 0;
  if (discount < 0) discount = 0;
  if (discount > subtotal) discount = subtotal;
  elements.cartDiscount.value = discount.toFixed(2);

  const total = subtotal - discount;
  elements.cartSubtotal.textContent = formatCurrency(subtotal);
  elements.cartDiscountValue.textContent = formatCurrency(discount);
  elements.cartTotal.textContent = formatCurrency(total);
  elements.checkout.disabled = state.cart.length === 0;
}

function renderSales() {
  const rows = state.sales
    .map((sale) => {
      const items = sale.items
        .map(
          (item) =>
            `${item.name} (${item.warehouseName || "-"}) x${item.quantity}`
        )
        .join(", ");
      const discountInfo =
        sale.discount && sale.discount > 0
          ? ` (Desc: ${formatCurrency(sale.discount)})`
          : "";
      return `
        <tr>
          <td>${formatDate(sale.date)}</td>
          <td>${items}${discountInfo}</td>
          <td>${sale.paymentMethod || "-"}</td>
          <td>${formatCurrency(sale.total)}</td>
        </tr>
      `;
    })
    .join("");

  elements.salesTable.innerHTML =
    rows || `<tr><td colspan="4" class="empty">Sem vendas registradas.</td></tr>`;
}

function addOrUpdateProduct(data) {
  const payload = {
    name: data.name.trim(),
    category: data.category.trim(),
    sku: data.sku.trim(),
    barcode: data.barcode.trim(),
    unit: data.unit,
    price: Number(data.price),
    cost: Number(data.cost) || 0,
    stocks: { ...draftStocks },
    stock: computeTotalStock(draftStocks),
    minStock: Number(data.minStock) || 0,
    supplier: data.supplier.trim(),
    notes: data.notes.trim(),
    status: data.status,
  };
  payload.margin = computeMargin(payload.price, payload.cost);

  if (editingProductId) {
    const product = getProductById(editingProductId);
    if (product) {
      Object.assign(product, payload);
    }
  } else {
    state.products.push({
      id: crypto.randomUUID(),
      ...payload,
    });
  }

  saveState();
  resetProductForm();
  renderProducts();
  renderCart();
}

function addWarehouse(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  state.warehouses.push({
    id: crypto.randomUUID(),
    name: trimmed,
  });
  saveState();
  renderWarehouses();
  renderProductStockDraft();
  const currentProductId =
    elements.saleForm.querySelector("select[name='productId']").value;
  renderSaleWarehousesForProduct(currentProductId);
}

function removeWarehouse(warehouseId) {
  const hasStock = state.products.some((product) => {
    const qty = Number(product.stocks?.[warehouseId] || 0);
    return qty > 0;
  });
  const inCart = state.cart.some((item) => item.warehouseId === warehouseId);
  if (hasStock || inCart) {
    alert("Nao e possivel excluir. Ainda ha estoque ou itens no carrinho.");
    return;
  }
  state.warehouses = state.warehouses.filter(
    (warehouse) => warehouse.id !== warehouseId
  );
  delete draftStocks[warehouseId];
  saveState();
  renderWarehouses();
  renderProductStockDraft();
  renderProducts();
  renderCart();
  const currentProductId =
    elements.saleForm.querySelector("select[name='productId']").value;
  renderSaleWarehousesForProduct(currentProductId);
}

function removeProduct(productId) {
  const cartHasProduct = state.cart.some((item) => item.productId === productId);
  if (cartHasProduct) {
    alert("Remova o produto do carrinho antes de excluir.");
    return;
  }
  state.products = state.products.filter((product) => product.id !== productId);
  saveState();
  renderProducts();
  renderCart();
}

function addToCart(productId, warehouseId, quantity) {
  const product = getProductById(productId);
  if (!product) return;
  if (product.status === "inactive") return;
  if (!warehouseId) return;

  const existing = state.cart.find(
    (item) =>
      item.productId === productId && item.warehouseId === warehouseId
  );
  const currentQuantity = existing ? existing.quantity : 0;
  const availableStock = Number(product.stocks?.[warehouseId] || 0);

  if (quantity + currentQuantity > availableStock) {
    alert("Estoque insuficiente.");
    return;
  }

  if (existing) {
    existing.quantity += quantity;
  } else {
    state.cart.push({ productId, warehouseId, quantity });
  }

  saveState();
  renderCart();
}

function removeFromCart(productId, warehouseId) {
  state.cart = state.cart.filter(
    (item) =>
      item.productId !== productId || item.warehouseId !== warehouseId
  );
  saveState();
  renderCart();
}

function clearCart() {
  state.cart = [];
  saveState();
  renderCart();
}

function checkout() {
  if (state.cart.length === 0) return;

  const items = state.cart
    .map((item) => {
      const product = getProductById(item.productId);
      const warehouse = getWarehouseById(item.warehouseId);
      return {
        productId: item.productId,
        name: product ? product.name : "Produto removido",
        warehouseId: item.warehouseId,
        warehouseName: warehouse ? warehouse.name : "-",
        quantity: item.quantity,
        price: product ? product.price : 0,
      };
    })
    .filter((item) => item.price > 0);

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  let discount = Number(elements.cartDiscount.value) || 0;
  if (discount < 0) discount = 0;
  if (discount > subtotal) discount = subtotal;
  const total = subtotal - discount;

  items.forEach((item) => {
    const product = getProductById(item.productId);
    if (product) {
      const currentStock = Number(product.stocks?.[item.warehouseId] || 0);
      product.stocks[item.warehouseId] = Math.max(
        currentStock - item.quantity,
        0
      );
      product.stock = computeTotalStock(product.stocks);
    }
  });

  state.sales.unshift({
    id: crypto.randomUUID(),
    date: Date.now(),
    subtotal,
    discount,
    total,
    items,
    paymentMethod: elements.paymentMethod.value,
    note: elements.saleNote.value.trim(),
  });

  state.cart = [];
  elements.cartDiscount.value = "0";
  elements.saleNote.value = "";
  saveState();
  renderProducts();
  renderCart();
  renderSales();
}

elements.productForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  addOrUpdateProduct({
    name: formData.get("name"),
    category: formData.get("category") || "",
    sku: formData.get("sku") || "",
    barcode: formData.get("barcode") || "",
    unit: formData.get("unit") || "un",
    price: formData.get("price"),
    cost: formData.get("cost"),
    stock: formData.get("stock"),
    minStock: formData.get("minStock"),
    supplier: formData.get("supplier") || "",
    notes: formData.get("notes") || "",
    status: formData.get("status") || "active",
  });
});

elements.productCancel.addEventListener("click", resetProductForm);
elements.productForm.price.addEventListener("input", updateMarginField);
elements.productForm.cost.addEventListener("input", updateMarginField);
elements.productSearch.addEventListener("input", renderProducts);
elements.productFilterCategory.addEventListener("change", renderProducts);
elements.productFilterStatus.addEventListener("change", renderProducts);
elements.productStockAdd.addEventListener("click", upsertDraftStock);
elements.productStockTable.addEventListener("click", (event) => {
  const warehouseId = event.target.getAttribute("data-stock-remove");
  if (warehouseId) {
    removeDraftStock(warehouseId);
  }
});

elements.productTable.addEventListener("click", (event) => {
  const editId = event.target.getAttribute("data-edit");
  const deleteId = event.target.getAttribute("data-delete");
  if (editId) {
    const product = getProductById(editId);
    if (!product) return;
    editingProductId = editId;
    elements.productForm.name.value = product.name;
    elements.productForm.category.value = product.category;
    elements.productForm.sku.value = product.sku;
    elements.productForm.barcode.value = product.barcode;
    elements.productForm.unit.value = product.unit;
    elements.productForm.price.value = product.price;
    elements.productForm.cost.value = product.cost;
    elements.productForm.margin.value = product.margin.toFixed(2);
    elements.productForm.stock.value = computeTotalStock(product.stocks || {});
    elements.productForm.minStock.value = product.minStock;
    elements.productForm.supplier.value = product.supplier;
    elements.productForm.notes.value = product.notes;
    elements.productForm.status.value = product.status;
    draftStocks = { ...(product.stocks || {}) };
    renderProductStockDraft();
    elements.productForm.querySelector("button[type='submit']").textContent =
      "Atualizar produto";
  }
  if (deleteId) {
    removeProduct(deleteId);
  }
});

elements.saleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const productId = formData.get("productId");
  const warehouseId = formData.get("warehouseId");
  const quantity = Number(formData.get("quantity"));
  if (!productId || !warehouseId || Number.isNaN(quantity) || quantity <= 0) {
    return;
  }
  addToCart(productId, warehouseId, quantity);
  elements.saleForm.reset();
  elements.saleForm.quantity.value = 1;
  const currentProductId =
    elements.saleForm.querySelector("select[name='productId']").value;
  renderSaleWarehousesForProduct(currentProductId);
});

elements.saleForm
  .querySelector("select[name='productId']")
  .addEventListener("change", (event) => {
    renderSaleWarehousesForProduct(event.target.value);
  });

elements.cartTable.addEventListener("click", (event) => {
  const removeId = event.target.getAttribute("data-cart-remove");
  const removeWarehouse = event.target.getAttribute("data-cart-warehouse");
  if (removeId) {
    removeFromCart(removeId, removeWarehouse);
  }
});

elements.saleClear.addEventListener("click", clearCart);
elements.cartDiscount.addEventListener("input", renderCart);
elements.checkout.addEventListener("click", checkout);

elements.warehouseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  addWarehouse(formData.get("warehouseName") || "");
  event.target.reset();
});

elements.warehouseTable.addEventListener("click", (event) => {
  const warehouseId = event.target.getAttribute("data-warehouse-delete");
  if (warehouseId) {
    removeWarehouse(warehouseId);
  }
});

renderWarehouses();
renderProducts();
renderCart();
renderSales();
renderProductStockDraft();
