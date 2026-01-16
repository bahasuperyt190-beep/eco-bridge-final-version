let currentUser = null;
let pickedLocation = null;
let map;
let marker = null;
let pickMode = false;
let lotMapInstance = null;
let lotMarker = null;
let lotRoute = null;

function login() {
  const username = document.getElementById("username").value.trim();
  const role = document.getElementById("role").value;

  if (!username) return alert("Введите имя");

  currentUser = { username, role };
  localStorage.setItem("user", JSON.stringify(currentUser));

  document.getElementById("loginPanel").style.display = "none";
  document.getElementById("mainInterface").style.display = "block";

  document.getElementById("welcome").innerText =
    `Привет, ${username} (${role})`;

  loadLots();
}

function logout() {
  localStorage.removeItem("user");
  currentUser = null;

  document.getElementById("mainInterface").style.display = "none";
  document.getElementById("loginPanel").style.display = "block";
}

document.getElementById('openMapBtn').onclick = () => {
  document.getElementById('mapWrapper').style.display = 'block';

  if (!map) {
    map = L.map('map').setView([43.2389, 76.8897], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);

    map.on('click', e => {
      if (!pickMode) return;

      if (marker) map.removeLayer(marker);
      marker = L.marker(e.latlng).addTo(map);

      pickedLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
      pickMode = false;
      alert('Точка выбрана');
    });
  }

  pickMode = true;
};

document.getElementById('closeMapBtn').onclick = () => {
  document.getElementById('mapWrapper').style.display = 'none';
  pickMode = false;
};

function createLot() {
  const title = document.getElementById("title").value.trim();
  const price = +document.getElementById("price").value;
  const amount = +document.getElementById("amount").value;
  const unit = document.getElementById("unit").value;
  const imageInput = document.getElementById("lotImage");

  if (!title || price <= 0 || amount <= 0) {
    return alert("Заполни все поля");
  }

  if (!pickedLocation) {
    return alert("Выберите точку на карте");
  }

  let imageData = null;

  function saveLot(image) {
    const type = currentUser.role === "buyer" ? "buy" : "sell";
    const lots = JSON.parse(localStorage.getItem("lots")) || [];

    lots.push({
      title,
      price,
      amount,
      unit,
      type,
      owner: currentUser.username,
      dealWith: null,
      location: pickedLocation,
      image: image,
      paid: false
    });

    localStorage.setItem("lots", JSON.stringify(lots));
    loadLots();

  
    document.getElementById("title").value = "";
    document.getElementById("price").value = "";
    document.getElementById("amount").value = "";
    document.getElementById("lotImage").value = "";
    pickedLocation = null;
  }

  if (imageInput.files && imageInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      imageData = e.target.result;
      saveLot(imageData);
    };
    reader.readAsDataURL(imageInput.files[0]);
  } else {
    saveLot(null);
  }
}

function loadLots() {
  const lotsDiv = document.getElementById("lots");
  lotsDiv.innerHTML = "";

  const lots = JSON.parse(localStorage.getItem("lots")) || [];

  lots.forEach((lot, index) => {
    const div = document.createElement("div");
    div.className = `lot ${lot.type === "sell" ? "seller" : "buyer"}`;

    let buttons = "";
    let dealInfo = ""; // ← НОВОЕ

    if (lot.owner !== currentUser.username && !lot.dealWith && lot.amount >= 50 && !lot.paid) {
      buttons = `<button onclick="showPaymentQR(${index})">💳 Оплатить и увидеть карту</button>`;
    }

    if (lot.paid && lot.dealWith === currentUser.username) {
      buttons = `<button onclick="showLotOnMap(${index})">🗺 Показать на карте</button>`;
    }

    if (lot.amount < 50) {
      buttons = `<span style="color:red">Мин. 50 ${lot.unit}</span>`;
    }

    if (lot.owner === currentUser.username) {
      buttons += ` <button style="background:#e74c3c" onclick="deleteLot(${index})">Удалить</button>`;
    }

    // ===== СТАТУС СДЕЛКИ =====
    if (lot.dealWith) {
      dealInfo = `<br><b style="color:green">Сделка с: ${lot.dealWith}</b>`;
    }

    div.innerHTML = `
      ${lot.image ? `<img src="${lot.image}" 
        style="width:100px;height:100px;object-fit:cover;margin-right:10px;float:left;border-radius:8px;">` : ""}
      <b>${lot.title}</b><br>
      <i>${lot.type === "sell" ? "Продаю" : "Скупаем"}</i><br>
      Цена: ${lot.price} тг / ${lot.unit}<br>
      Количество: ${lot.amount} ${lot.unit}<br>
      Создал: ${lot.owner}
      ${dealInfo}
      <br>
      ${buttons}
      <div style="clear:both;"></div>
    `;

    lotsDiv.appendChild(div);
  });
}



function deleteLot(index) {
  const lots = JSON.parse(localStorage.getItem("lots"));
  if (confirm("Удалить этот лот?")) {
    lots.splice(index, 1);
    localStorage.setItem("lots", JSON.stringify(lots));
    loadLots();
  }
}

function clearHistory() {
  if (confirm("Удалить все лоты?")) {
    localStorage.removeItem("lots");
    loadLots();
  }
}


function showLotOnMap(index) {
  const lots = JSON.parse(localStorage.getItem("lots")) || [];
  const lot = lots[index];

  if (!lot.location) return alert("У этого лота нет точки");

  const modal = document.getElementById("lotMapModal");
  modal.style.display = "block";

  if (lotMapInstance) {
    lotMapInstance.remove();
    lotMapInstance = null;
  }

  lotMapInstance = L.map("lotMap").setView([lot.location.lat, lot.location.lng], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(lotMapInstance);

  lotMarker = L.marker([lot.location.lat, lot.location.lng])
    .addTo(lotMapInstance)
    .bindPopup(`📍 ${lot.title} (${lot.type === 'sell' ? 'Продаю' : 'Скупаем'})`)
    .openPopup();

  if (currentUser.role === 'buyer' && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      lotRoute = L.polyline(
        [[pos.coords.latitude, pos.coords.longitude], [lot.location.lat, lot.location.lng]],
        { color: 'blue' }
      ).addTo(lotMapInstance);
      lotMapInstance.fitBounds(lotRoute.getBounds());
    });
  }
}


document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.getElementById("closeLotMap");
  const modal = document.getElementById("lotMapModal");

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
      if (lotMapInstance) {
        lotMapInstance.remove();
        lotMapInstance = null;
        lotMarker = null;
        lotRoute = null;
      }
    });
  }
});


function showPaymentQR(index) {
  const lots = JSON.parse(localStorage.getItem("lots"));
  const lot = lots[index];

  if (lot.paid) {
    showLotOnMap(index);
    return;
  }

  const lotDiv = document.getElementById("lots").children[index];

  
  let qrDiv = lotDiv.querySelector(".qr-code");
  if (!qrDiv) {
    qrDiv = document.createElement("div");
    qrDiv.className = "qr-code";
    qrDiv.style.width = "150px";
    qrDiv.style.height = "150px";
    qrDiv.style.margin = "10px 0";
    lotDiv.appendChild(qrDiv);
  }

  let confirmBtn = lotDiv.querySelector(".confirm-pay-btn");
  if (!confirmBtn) {
    confirmBtn = document.createElement("button");
    confirmBtn.className = "confirm-pay-btn";
    confirmBtn.innerText = "✅ Подтвердить оплату";
    confirmBtn.style.marginLeft = "10px";
    confirmBtn.onclick = () => {
      markLotPaid(index);
      alert("Оплата подтверждена! Теперь карта доступна.");
    };
    lotDiv.appendChild(confirmBtn);
  }

  qrDiv.innerHTML = "";
  new QRCode(qrDiv, {
    text: JSON.stringify({ lotId: index }),
    width: 150,
    height: 150,
    correctLevel: QRCode.CorrectLevel.H
  });
}


function markLotPaid(index) {
  const lots = JSON.parse(localStorage.getItem("lots"));
  const lot = lots[index];

  lot.paid = true;
  lot.dealWith = currentUser.username; 
  localStorage.setItem("lots", JSON.stringify(lots));

 
  const archiveKey = `purchased_${currentUser.username}`;
  const archive = JSON.parse(localStorage.getItem(archiveKey)) || [];
  archive.push(lot);
  localStorage.setItem(archiveKey, JSON.stringify(archive));

  loadLots();
}


function showPurchasedArchive() {
  const archiveKey = `purchased_${currentUser.username}`;
  const archive = JSON.parse(localStorage.getItem(archiveKey)) || [];

  if (archive.length === 0) {
    return alert("Архив покупок пустой");
  }

  let html = "<h3>Архив купленных лотов:</h3>";
  archive.forEach((lot, i) => {
    html += `
      <div style="border:1px solid #ccc; padding:10px; margin:5px;">
        <b>${lot.title}</b> — ${lot.price} тг / ${lot.unit}, Кол-во: ${lot.amount} ${lot.unit}<br>
        Создал: ${lot.owner}<br>
        ${lot.location ? `📍 Координаты: ${lot.location.lat.toFixed(5)}, ${lot.location.lng.toFixed(5)}` : ""}
      </div>
    `;
  });

  const archiveDiv = document.getElementById("archive") || document.createElement("div");
  archiveDiv.id = "archive";
  archiveDiv.innerHTML = html;
  document.body.appendChild(archiveDiv);
}

document.getElementById("archiveBtn").onclick = () => {
    showPurchasedArchive();
    document.getElementById("archiveModal").style.display = "block";
  };
  

  document.getElementById("closeArchive").onclick = () => {
    document.getElementById("archiveModal").style.display = "none";
  };
  
  function showPurchasedArchive() {
    const archiveKey = `purchased_${currentUser.username}`;
    const archive = JSON.parse(localStorage.getItem(archiveKey)) || [];
  
    const archiveContent = document.getElementById("archiveContent");
    archiveContent.innerHTML = "";
  
    if (archive.length === 0) {
      archiveContent.innerHTML = "<p>Архив покупок пустой.</p>";
      return;
    }
  
    archive.forEach((lot) => {
      const lotDiv = document.createElement("div");
      lotDiv.className = "archive-lot";
  
      lotDiv.innerHTML = `
        ${lot.image ? `<img src="${lot.image}">` : `<div style="width:80px;height:80px;background:#ccc;border-radius:8px;margin-right:15px;"></div>`}
        <div>
          <b>${lot.title}</b> — ${lot.price} тг / ${lot.unit}<br>
          Кол-во: ${lot.amount} ${lot.unit}<br>
          Создал: ${lot.owner}<br>
          ${lot.location ? `📍 ${lot.location.lat.toFixed(5)}, ${lot.location.lng.toFixed(5)}` : ""}
        </div>
      `;
  
      archiveContent.appendChild(lotDiv);
    });
  }
  


