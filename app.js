const STORAGE_KEY = "pdv_data_v1";

const elements = {
  productForm: document.getElementById("product-form"),
  productCancel: document.getElementById("product-cancel"),
  productSearch: document.getElementById("product-search"),
  productFilterCategory: document.getElementById("product-filter-category"),
  productFilterStatus: document.getElementById("product-filter-status"),
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
    products: Array.isArray(rawState.products)
      ? rawState.products.map(normalizeProduct)
      : [],
    cart: Array.isArray(rawState.cart) ? rawState.cart : [],
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
    minStock: Number(product.minStock) || 0,
    supplier: product.supplier || "",
    notes: product.notes || "",
    status: product.status || "active",
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

function resetProductForm() {
  elements.productForm.reset();
  elements.productForm.margin.value = "0";
  elements.productForm.querySelector("button[type='submit']").textContent =
    "Salvar produto";
  editingProductId = null;
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
      const isLowStock =
        product.minStock > 0 && product.stock <= product.minStock;
      return `
        <tr>
          <td>${product.name}</td>
          <td>${product.sku || "-"}</td>
          <td>${product.category || "-"}</td>
          <td>${formatCurrency(product.price)}</td>
          <td>${product.stock}${isLowStock ? ' <span class="muted">(baixo)</span>' : ""}</td>
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
    `<tr><td colspan="7" class="empty">Nenhum produto cadastrado.</td></tr>`;

  const select = elements.saleForm.querySelector("select[name='productId']");
  const saleProducts = state.products.filter(
    (product) => product.status !== "inactive"
  );
  select.innerHTML = saleProducts
    .map(
      (product) =>
        `<option value="${product.id}">${product.name} (${product.unit}, estoque: ${product.stock})</option>`
    )
    .join("");

  if (saleProducts.length === 0) {
    select.innerHTML = `<option value="">Cadastre um produto primeiro</option>`;
    select.disabled = true;
    elements.saleForm.querySelector("button[type='submit']").disabled = true;
  } else {
    select.disabled = false;
    elements.saleForm.querySelector("button[type='submit']").disabled = false;
  }
}

function renderCart() {
  const rows = state.cart
    .map((item) => {
      const product = getProductById(item.productId);
      const price = product ? product.price : 0;
      return `
        <tr>
          <td>${product ? product.name : "Produto removido"}</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(price)}</td>
          <td>${formatCurrency(item.quantity * price)}</td>
          <td class="actions">
            <button type="button" data-cart-remove="${item.productId}" class="ghost">Remover</button>
          </td>
        </tr>
      `;
    })
    .join("");

  elements.cartTable.innerHTML =
    rows || `<tr><td colspan="5" class="empty">Carrinho vazio.</td></tr>`;

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
        .map((item) => `${item.name} x${item.quantity}`)
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
    stock: Number(data.stock),
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

function addToCart(productId, quantity) {
  const product = getProductById(productId);
  if (!product) return;
  if (product.status === "inactive") return;

  const existing = state.cart.find((item) => item.productId === productId);
  const currentQuantity = existing ? existing.quantity : 0;

  if (quantity + currentQuantity > product.stock) {
    alert("Estoque insuficiente.");
    return;
  }

  if (existing) {
    existing.quantity += quantity;
  } else {
    state.cart.push({ productId, quantity });
  }

  saveState();
  renderCart();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter((item) => item.productId !== productId);
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
      return {
        productId: item.productId,
        name: product ? product.name : "Produto removido",
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
      product.stock = Math.max(product.stock - item.quantity, 0);
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
    elements.productForm.stock.value = product.stock;
    elements.productForm.minStock.value = product.minStock;
    elements.productForm.supplier.value = product.supplier;
    elements.productForm.notes.value = product.notes;
    elements.productForm.status.value = product.status;
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
  const quantity = Number(formData.get("quantity"));
  if (!productId || Number.isNaN(quantity) || quantity <= 0) return;
  addToCart(productId, quantity);
  elements.saleForm.reset();
  elements.saleForm.quantity.value = 1;
});

elements.cartTable.addEventListener("click", (event) => {
  const removeId = event.target.getAttribute("data-cart-remove");
  if (removeId) {
    removeFromCart(removeId);
  }
});

elements.saleClear.addEventListener("click", clearCart);
elements.cartDiscount.addEventListener("input", renderCart);
elements.checkout.addEventListener("click", checkout);

renderProducts();
renderCart();
renderSales();
