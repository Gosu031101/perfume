document.addEventListener("DOMContentLoaded", () => {
    // 1. MOBILE MENU
    const menuToggle = document.getElementById("menu-toggle");
    const navMenu = document.getElementById("nav-menu");
    menuToggle.addEventListener("click", () => {
        navMenu.classList.toggle("active");
    });

    // 2. TÌM KIẾM SẢN PHẨM
    const searchBtn = document.getElementById("search-btn");
    const searchInput = document.getElementById("search-input");
    const productCards = document.querySelectorAll(".product-card");

    searchBtn.addEventListener("click", () => {
        searchInput.classList.toggle("active");
        if (searchInput.classList.contains("active")) searchInput.focus();
    });

    searchInput.addEventListener("input", (e) => {
        const keyword = e.target.value.toLowerCase().trim();
        productCards.forEach(card => {
            const productName = card.querySelector("h3").innerText.toLowerCase();
            const brandName = card.querySelector(".brand").innerText.toLowerCase();
            card.style.display = (productName.includes(keyword) || brandName.includes(keyword)) ? "block" : "none";
        });
    });

    // ==========================================
    // 3. LOGIC GIỎ HÀNG SLIDE-OUT (Drawer Cart)
    // ==========================================
    const cartBtn = document.querySelector(".cart-btn");
    const cartDrawer = document.getElementById("cart-drawer");
    const cartOverlay = document.getElementById("cart-overlay");
    const closeCartBtn = document.getElementById("close-cart");
    const cartItemsContainer = document.getElementById("cart-items-container");
    const cartTotalPriceEl = document.getElementById("cart-total-price");
    const cartCountEl = document.getElementById("cart-count");
    const accountBtn = document.getElementById("account-btn");
    const accountLabel = document.getElementById("account-label");
    const authOverlay = document.getElementById("auth-overlay");
    const authModal = document.getElementById("auth-modal");
    const closeAuthBtn = document.getElementById("close-auth");
    const authForm = document.getElementById("auth-form");
    const authMessage = document.getElementById("auth-message");
    const authName = document.getElementById("auth-name");
    const authEmail = document.getElementById("auth-email");
    const authPassword = document.getElementById("auth-password");
    const authTabs = document.querySelectorAll(".auth-tab");
    const socialAuthBtns = document.querySelectorAll("[data-social-auth]");
    const memberRankBox = document.getElementById("member-rank-box");
    const logoutBtn = document.getElementById("logout-btn");

    let cart = JSON.parse(localStorage.getItem("perfumeCart")) || []; // Mảng chứa dữ liệu các sản phẩm trong giỏ
    let authMode = "login";

    // Hàm Mở/Đóng giỏ hàng
    const toggleCart = () => {
        cartDrawer.classList.toggle("open");
        cartOverlay.classList.toggle("open");
    };

    cartBtn.addEventListener("click", toggleCart);
    closeCartBtn.addEventListener("click", toggleCart);
    cartOverlay.addEventListener("click", toggleCart); // Click ra ngoài nền đen để đóng

    // Tiện ích format tiền (VND) và parse số từ text
    const formatMoney = (amount) => amount.toLocaleString('vi-VN') + ' đ';
    const parsePrice = (priceStr) => parseInt(priceStr.replace(/\./g, '').replace(' đ', '').trim());

    // Hàm Render lại toàn bộ giao diện giỏ hàng dựa trên mảng `cart`
    const getMember = () => JSON.parse(localStorage.getItem("perfumeMember")) || null;
    const saveMember = (member) => localStorage.setItem("perfumeMember", JSON.stringify(member));
    const isLiveServer = () => ["5500", "5501"].includes(window.location.port);
    const apiRequest = async (paths, data) => {
        if (isLiveServer()) {
            throw new Error("Bạn đang chạy bằng Live Server. PHP cần chạy qua XAMPP/Apache, ví dụ http://localhost/perfume-main/index.html");
        }

        const endpoints = Array.isArray(paths) ? paths : [paths];
        let lastError = null;

        for (const path of endpoints) {
            try {
                const response = await fetch(path, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
                const text = await response.text();
                let result = {};
                try {
                    result = text ? JSON.parse(text) : {};
                } catch (error) {
                    throw new Error("Máy chủ chưa trả về JSON hợp lệ. Hãy kiểm tra Apache/PHP/MySQL và đường dẫn chạy web.");
                }
                if (!response.ok || result.status === "error") {
                    throw new Error(result.message || "Không thể kết nối máy chủ.");
                }
                return result;
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error("Không thể kết nối máy chủ.");
    };
    const getMemberRank = (points = 0) => {
        if (points >= 1500) return { name: "Bạch kim", discount: 15, next: null };
        if (points >= 1000) return { name: "Vàng", discount: 10, next: 1500 };
        if (points >= 500) return { name: "Bạc", discount: 8, next: 1000 };
        return { name: "Đồng", discount: 5, next: 500 };
    };
    const openAuth = () => {
        authOverlay.classList.add("open");
        authModal.classList.add("open");
    };
    const closeAuth = () => {
        authOverlay.classList.remove("open");
        authModal.classList.remove("open");
    };
    const showAuthMessage = (message, type = "error") => {
        authMessage.innerText = message;
        authMessage.className = `auth-message ${type} active`;
    };
    const clearAuthMessage = () => {
        authMessage.innerText = "";
        authMessage.className = "auth-message";
    };
    const renderMember = () => {
        const member = getMember();

        if (!member) {
            authModal.classList.remove("is-logged-in");
            authOverlay.classList.remove("profile-popover-overlay");
            accountLabel.innerText = "Đăng nhập";
            memberRankBox.classList.remove("active");
            memberRankBox.innerHTML = "";
            logoutBtn.classList.remove("active");
            authForm.style.display = "grid";
            return;
        }

        const points = member.points || 0;
        const rank = getMemberRank(points);
        const nextText = rank.next ? `Cần ${rank.next - points} điểm để lên hạng tiếp theo.` : "Bạn đang ở hạng cao nhất.";
        authModal.classList.add("is-logged-in");
        authOverlay.classList.add("profile-popover-overlay");
        accountLabel.innerText = member.name;
        memberRankBox.classList.add("active");
        memberRankBox.innerHTML = `
            <strong class="member-rank-name">${member.name}</strong>
            <span class="member-rank-detail">
                <br>Hạng ${rank.name} - ${points} điểm - Giảm ${rank.discount}%<br>
                ${nextText}
            </span>
        `;
        logoutBtn.classList.add("active");
        authForm.style.display = "none";
    };
    const setAuthMode = (mode) => {
        authMode = mode;
        clearAuthMessage();
        authTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.authMode === mode));
        authName.closest(".auth-field").style.display = mode === "register" ? "grid" : "none";
        authName.required = mode === "register";
        authForm.querySelector("button[type='submit']").innerText = mode === "register" ? "Đăng ký" : "Đăng nhập";
    };

    const renderCart = () => {
        cartItemsContainer.innerHTML = "";
        let totalPrice = 0;
        let totalItems = 0;

        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Giỏ hàng của bạn đang trống.</p>';
        } else {
            cart.forEach((item, index) => {
                totalPrice += item.price * item.quantity;
                totalItems += item.quantity;

                // Tạo HTML cho từng item
                const itemHTML = `
                    <div class="cart-item">
                        <img src="${item.img}" alt="${item.name}">
                        <div class="cart-item-details">
                            <h4 class="cart-item-title">${item.name}</h4>
                            <span class="cart-item-price">${formatMoney(item.price)}</span>
                            <div class="cart-item-actions">
                                <div class="quantity-control">
                                    <button class="btn-decrease" data-index="${index}">-</button>
                                    <span>${item.quantity}</span>
                                    <button class="btn-increase" data-index="${index}">+</button>
                                </div>
                                <button class="remove-item" data-index="${index}">Xóa</button>
                            </div>
                        </div>
                    </div>
                `;
                cartItemsContainer.insertAdjacentHTML('beforeend', itemHTML);
            });
        }

        // Cập nhật giá và icon số lượng trên header
        cartTotalPriceEl.innerText = formatMoney(totalPrice);
        cartCountEl.innerText = totalItems;
        localStorage.setItem("perfumeCart", JSON.stringify(cart));
    };

    // Hàm xử lý khi bấm nút "Thêm vào giỏ" ở Trang chủ
    accountBtn.addEventListener("click", (event) => {
        if (event.target.closest("#auth-modal")) return;
        openAuth();
    });
    accountBtn.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openAuth();
        }
    });
    closeAuthBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        closeAuth();
    });
    authModal.addEventListener("click", (event) => event.stopPropagation());
    authOverlay.addEventListener("click", closeAuth);
    authTabs.forEach((tab) => {
        tab.addEventListener("click", () => setAuthMode(tab.dataset.authMode));
    });

    socialAuthBtns.forEach((button) => {
        button.addEventListener("click", async () => {
            clearAuthMessage();
            const provider = button.dataset.socialAuth;
            const providerName = provider === "google" ? "Google" : "Facebook";
            const email = prompt(`Nhập email ${providerName} của bạn:`)?.trim().toLowerCase();
            if (!email) return;

            const defaultName = email.split("@")[0] || providerName;
            const name = provider === "google" ? defaultName : (prompt("Nhập tên Facebook của bạn:")?.trim() || defaultName);
            const password = `${provider}-${email}`;

            try {
                const result = await apiRequest(["register.php", "/api/register"], { name, email, password });
                saveMember(result.user);
                showAuthMessage(`Đăng ký bằng ${providerName} thành công.`, "success");
            } catch (error) {
                try {
                    const result = await apiRequest(["login.php", "/api/login"], { email, password });
                    saveMember(result.user);
                    showAuthMessage(`Đăng nhập bằng ${providerName} thành công.`, "success");
                } catch (loginError) {
                    showAuthMessage(loginError.message || `Không thể đăng ký bằng ${providerName}.`);
                    return;
                }
            }

            renderMember();
            setTimeout(closeAuth, 700);
        });
    });

    authForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearAuthMessage();
        const email = authEmail.value.trim().toLowerCase();
        const password = authPassword.value;
        const name = authName.value.trim();

        try {
            const endpoint = authMode === "register" ? ["register.php", "/api/register"] : ["login.php", "/api/login"];
            const result = await apiRequest(endpoint, { name, email, password });
            saveMember(result.user);
            showAuthMessage(authMode === "register" ? "Đăng ký tài khoản thành công." : "Đăng nhập thành công.", "success");
        } catch (error) {
            if (authMode === "register") {
                if (isLiveServer()) {
                    showAuthMessage(error.message);
                    return;
                }

                saveMember({ name, email, points: 0 });
                showAuthMessage("Máy chủ API chưa sẵn sàng, tài khoản tạm lưu trên trình duyệt.", "success");
            } else {
                showAuthMessage(error.message || "Email chưa đăng ký hoặc mật khẩu không đúng.");
                return;
            }
        }

        renderMember();
        setTimeout(closeAuth, 700);
    });

    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("perfumeMember");
        renderMember();
    });

    const addCartBtns = document.querySelectorAll(".btn-add-cart");
    addCartBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            const card = e.target.closest(".product-card");
            const name = card.querySelector("h3").innerText;
            const price = parsePrice(card.querySelector(".price").innerText);
            const img = card.querySelector("img").src;

            // Kiểm tra xem đã có trong giỏ chưa
            const existingItemIndex = cart.findIndex(item => item.name === name);
            if (existingItemIndex > -1) {
                cart[existingItemIndex].quantity += 1;
            } else {
                cart.push({ name, price, img, quantity: 1 });
            }

            renderCart();
            // Thêm xong thì tự động mở giỏ hàng trượt ra cho người dùng xem luôn
            cartDrawer.classList.add("open");
            cartOverlay.classList.add("open");
        });
    });

    // Lắng nghe sự kiện click bằng Event Delegation cho các nút bên TRONG Giỏ hàng (+, -, xóa)
    cartItemsContainer.addEventListener("click", (e) => {
        const index = e.target.dataset.index;
        if (!index) return; // Nếu bấm không trúng nút thì bỏ qua

        if (e.target.classList.contains("btn-increase")) {
            cart[index].quantity++;
        } else if (e.target.classList.contains("btn-decrease")) {
            if (cart[index].quantity > 1) {
                cart[index].quantity--;
            } else {
                cart.splice(index, 1); // Giảm về 0 thì xóa luôn
            }
        } else if (e.target.classList.contains("remove-item")) {
            cart.splice(index, 1);
        }
        renderCart(); // Gọi lại để vẽ lại giỏ hàng sau khi thay đổi
    });

    const checkoutBtn = document.querySelector(".btn-checkout");
    checkoutBtn.addEventListener("click", () => {
        if (cart.length === 0) {
            alert("Giỏ hàng của bạn đang trống.");
            return;
        }

        localStorage.setItem("perfumeCart", JSON.stringify(cart));
        window.location.href = "checkout.html";
    });

    // Khởi tạo giao diện giỏ hàng lần đầu
    renderCart();
    renderMember();
    setAuthMode("login");

    if (!getMember()) {
        openAuth();
    }

    // 4. SCROLL ANIMATION
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("show");
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

    productCards.forEach(card => observer.observe(card));
});
