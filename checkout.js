document.addEventListener("DOMContentLoaded", () => {
    const cart = JSON.parse(localStorage.getItem("perfumeCart")) || [];
    const checkoutItems = document.getElementById("checkout-items");
    const checkoutMember = document.getElementById("checkout-member");
    const subtotalEl = document.getElementById("checkout-subtotal");
    const discountRow = document.getElementById("checkout-discount-row");
    const discountEl = document.getElementById("checkout-discount");
    const totalEl = document.getElementById("checkout-total");
    const checkoutForm = document.getElementById("checkout-form");
    const paymentInputs = document.querySelectorAll('input[name="payment"]');
    const paymentDetails = document.querySelectorAll("[data-payment-detail]");
    const cardInputs = document.querySelectorAll(".card-payment-fields input");
    const orderStatusOverlay = document.getElementById("order-status-overlay");
    const orderPending = document.getElementById("order-pending");
    const orderSuccess = document.getElementById("order-success");
    const orderSuccessMessage = document.getElementById("order-success-message");
    const continueShoppingBtn = document.getElementById("continue-shopping");

    const formatMoney = (amount) => amount.toLocaleString("vi-VN") + " đ";

    let orderSubtotal = 0;
    let orderDiscount = 0;
    let orderTotal = 0;

    const getMember = () => JSON.parse(localStorage.getItem("perfumeMember")) || null;
    const saveMember = (member) => localStorage.setItem("perfumeMember", JSON.stringify(member));
    const syncMember = async (member) => {
        const endpoints = ["member_update.php", "/api/member/update"];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(member)
                });
                if (response.ok) return;
            } catch (error) {
                console.warn("Không thể đồng bộ tài khoản lên máy chủ.", error);
            }
        }
    };

    // Determine whether card payments are allowed for the current user.
    const isCardAllowedForMember = (member) => {
        // Member object may include a `verified` boolean.
        // Only allow card payments when user is logged in and email is verified.
        return !!(member && member.verified === true);
    };

    // Enable/disable payment options based on auth/verification state.
    const updatePaymentAvailability = (memberState) => {
        const member = memberState ? memberState.member : null;
        const cardRadio = document.querySelector('input[name="payment"][value="card"]');
        const cardLabel = cardRadio ? cardRadio.closest('.payment-option') : null;
        const cardDetail = document.querySelector('[data-payment-detail="card"]');

        const allowed = isCardAllowedForMember(member);

        if (!cardRadio) return;

        if (!allowed) {
            cardRadio.disabled = true;
            if (cardLabel) cardLabel.classList.add('disabled');
            if (cardDetail) cardDetail.classList.add('disabled');

            // If card was selected, fall back to COD (or bank if COD absent)
            const checked = document.querySelector('input[name="payment"]:checked');
            if (checked && checked.value === 'card') {
                const fallback = document.querySelector('input[name="payment"][value="cod"]') || document.querySelector('input[name="payment"][value="bank"]');
                if (fallback) fallback.checked = true;
            }
        } else {
            cardRadio.disabled = false;
            if (cardLabel) cardLabel.classList.remove('disabled');
            if (cardDetail) cardDetail.classList.remove('disabled');
        }

        // Ensure payment detail UI and required attributes are in sync
        updatePaymentDetails();
    };
    const getMemberRank = (points = 0) => {
        if (points >= 1500) return { name: "Bạch kim", discount: 15, next: null };
        if (points >= 1000) return { name: "Vàng", discount: 10, next: 1500 };
        if (points >= 500) return { name: "Bạc", discount: 8, next: 1000 };
        return { name: "Đồng", discount: 5, next: 500 };
    };
    const renderMember = () => {
        const member = getMember();

        if (!member) {
            checkoutMember.innerHTML = "Bạn có thể đặt hàng không cần đăng nhập. Đăng nhập thành viên để nhận ưu đãi giảm giá và tích điểm.";
            return null;
        }

        const points = member.points || 0;
        const rank = getMemberRank(points);
        const nextText = rank.next ? `Cần ${rank.next - points} điểm để lên hạng tiếp theo.` : "Bạn đang ở hạng cao nhất.";
        checkoutMember.innerHTML = `
            <strong>${member.name}</strong><br>
            Hạng ${rank.name} - ${points} điểm - Giảm ${rank.discount}%<br>
            ${nextText}
        `;
        return { member, rank };
    };

    const updatePaymentDetails = () => {
        const selectedPayment = document.querySelector('input[name="payment"]:checked')?.value || "cod";

        paymentDetails.forEach((detail) => {
            detail.classList.toggle("payment-detail-active", detail.dataset.paymentDetail === selectedPayment);
        });

        cardInputs.forEach((input) => {
            // Only require card inputs when card is selected and card option is enabled
            const cardRadio = document.querySelector('input[name="payment"][value="card"]');
            const cardEnabled = cardRadio && !cardRadio.disabled;
            input.required = cardEnabled && selectedPayment === "card";
        });
    };

    const renderCheckout = () => {
        checkoutItems.innerHTML = "";
        const memberState = renderMember();

        if (cart.length === 0) {
            checkoutItems.innerHTML = `
                <div class="checkout-empty">
                    Giỏ hàng đang trống. Vui lòng quay lại mua hàng.
                </div>
            `;
            subtotalEl.innerText = formatMoney(0);
            discountEl.innerText = "-" + formatMoney(0);
            totalEl.innerText = formatMoney(0);
            return;
        }

        let subtotal = 0;
        cart.forEach((item, index) => {
            subtotal += item.price * item.quantity;
            const itemHTML = `
                <div class="checkout-item">
                    <div class="checkout-item-image">
                        <img src="${item.img}" alt="${item.name}">
                        <span>${item.quantity}</span>
                    </div>
                    <div class="checkout-item-info">
                        <h4>${item.name}</h4>
                        <p>${formatMoney(item.price)}</p>
                    </div>
                    <div class="checkout-quantity">
                        <button type="button" class="checkout-decrease" data-index="${index}">-</button>
                        <span>${item.quantity}</span>
                        <button type="button" class="checkout-increase" data-index="${index}">+</button>
                    </div>
                    <strong>${formatMoney(item.price * item.quantity)}</strong>
                </div>
            `;
            checkoutItems.insertAdjacentHTML("beforeend", itemHTML);
        });

        const discountRate = memberState ? memberState.rank.discount : 0;
        orderSubtotal = subtotal;
        orderDiscount = Math.round(subtotal * discountRate / 100);
        orderTotal = subtotal - orderDiscount;

        subtotalEl.innerText = formatMoney(orderSubtotal);
        discountEl.innerText = "-" + formatMoney(orderDiscount);
        discountRow.style.display = orderDiscount > 0 ? "flex" : "none";
        totalEl.innerText = formatMoney(orderTotal);
    };

    checkoutForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const selectedPayment = document.querySelector('input[name="payment"]:checked')?.value || "cod";
        const paymentMessages = {
            cod: "Bạn sẽ thanh toán COD khi nhận hàng.",
            card: "Bạn đã chọn thanh toán bằng Visa/Mastercard.",
            bank: "Bạn vui lòng chuyển khoản theo thông tin VPBank/QR trên trang thanh toán."
        };
        
        // Prevent using card payment if user is not allowed
        const cardRadio = document.querySelector('input[name="payment"][value="card"]');
        if (selectedPayment === 'card' && cardRadio && cardRadio.disabled) {
            alert('Vui lòng đăng nhập và xác thực email để thanh toán bằng thẻ.');
            return;
        }

        if (cart.length === 0) {
            alert("Giỏ hàng đang trống.");
            window.location.href = "index.html";
            return;
        }

        const member = getMember();
        orderStatusOverlay.classList.add("open");
        orderPending.classList.remove("hidden");
        orderSuccess.classList.add("hidden");

        setTimeout(async () => {
            let pointsMessage = "Bạn đã đặt hàng với tư cách khách.";

            if (member) {
                const earnedPoints = Math.floor(orderTotal / 10000);
                const updatedMember = {
                    ...member,
                    points: (member.points || 0) + earnedPoints
                };
                saveMember(updatedMember);
                await syncMember(updatedMember);
                pointsMessage = `Bạn được cộng ${earnedPoints} điểm thành viên.`;
            }

            orderSuccessMessage.innerHTML = `${paymentMessages[selectedPayment]}<br>${pointsMessage}`;
            localStorage.removeItem("perfumeCart");
            orderPending.classList.add("hidden");
            orderSuccess.classList.remove("hidden");
        }, 1800);
    });

    paymentInputs.forEach((input) => {
        input.addEventListener("change", updatePaymentDetails);
    });

    checkoutItems.addEventListener("click", (event) => {
        const index = event.target.dataset.index;
        if (index === undefined) return;

        if (event.target.classList.contains("checkout-increase")) {
            cart[index].quantity += 1;
        }

        if (event.target.classList.contains("checkout-decrease")) {
            if (cart[index].quantity > 1) {
                cart[index].quantity -= 1;
            } else {
                cart.splice(index, 1);
            }
        }

        localStorage.setItem("perfumeCart", JSON.stringify(cart));
        renderCheckout();
    });

    renderCheckout();
    const initialMemberState = renderMember();
    updatePaymentAvailability(initialMemberState);
    updatePaymentDetails();

    continueShoppingBtn.addEventListener("click", () => {
        window.location.href = "index.html";
    });
});
