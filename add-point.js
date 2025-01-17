let currentMarker = null; // Haritada mevcut marker'ı takip etmek için

// JWT Token'ı almak
const token = localStorage.getItem("token");

// Harita üzerinde nokta seçme işlemi
map.on("click", function (e) {
    // Önceki marker varsa, onu kaldır
    if (currentMarker) {
        map.removeLayer(currentMarker);
    }

    // Yeni marker ekle
    selectedLatLng = e.latlng;
    currentMarker = L.marker([e.latlng.lat, e.latlng.lng], {
        draggable: true, // Marker'ı sürüklenebilir yap
    })
        .addTo(map)
        .bindPopup("Selected Point")
        .openPopup();

    // Marker'ı kaldırmak için "closePopup" event'ine dinleyici ekle
    currentMarker.on("popupclose", function () {
        map.removeLayer(currentMarker);
        currentMarker = null;
        selectedLatLng = null; // Marker kaldırıldığında koordinatları sıfırla
    });
});

// Harita üzerinde nokta ekleme ve form gönderme işlemleri
document.getElementById("add-point-form").addEventListener("submit", async function (e) {
    e.preventDefault(); // Sayfanın yeniden yüklenmesini engelle

    // Harita üzerinde bir konum seçilmemişse uyarı ver
    if (!selectedLatLng) {
        alert("Please click on the map to select a location.");
        return;
    }

    try {
        // Form verilerini toplama
        const formData = new FormData(e.target); // Form alanlarını otomatik olarak ekler
        formData.append("latitude", selectedLatLng.lat); // Haritadan seçilen latitude
        formData.append("longitude", selectedLatLng.lng); // Haritadan seçilen longitude

        // Fetch ile POST isteği gönder
        const response = await fetch("http://localhost:3000/api/points", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: formData, // Form verilerini gönder
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error: ${errorText}`);
        }

        alert("Point added successfully!");
        location.reload(); // Sayfayı yenile
    } catch (err) {
        console.error("Error:", err);
        alert("An error occurred while adding the point. Please try again.");
    }
});

// Nokta güncelleme işlevi
document.getElementById("update-point-form").addEventListener("submit", async function (e) {
    e.preventDefault(); // Sayfanın yeniden yüklenmesini engelle

    const id = document.getElementById("update-point-id").value;
    const description = document.getElementById("update-description").value;
    const latitude = document.getElementById("update-latitude").value;
    const longitude = document.getElementById("update-longitude").value;

    try {
        const response = await fetch(`http://localhost:3000/api/points/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ description, latitude, longitude }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error: ${errorText}`);
        }

        alert("Point updated successfully!");
        location.reload(); // Sayfayı yenile
    } catch (err) {
        console.error("Error updating point:", err);
        alert("An error occurred while updating the point. Please try again.");
    }
});

// Nokta düzenleme işlevi
function editPoint(id, description, latitude, longitude) {
    document.getElementById("update-point-id").value = id;
    document.getElementById("update-description").value = description;
    document.getElementById("update-latitude").value = latitude;
    document.getElementById("update-longitude").value = longitude;

    // Güncelleme formunu göster
    document.getElementById("update-form-container").style.display = "block";
}

// Nokta silme işlevi
function deletePoint(id) {
    if (confirm("Are you sure you want to delete this point?")) {
        fetch(`http://localhost:3000/api/points/${id}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${token}`, // Token gönderiliyor mu?
            },
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Error deleting point");
                }
                return response.json();
            })
            .then(() => {
                alert("Point deleted successfully!");
                location.reload();
            })
            .catch((err) => {
                console.error("Error deleting point:", err);
                alert("An error occurred while deleting the point. Please try again.");
            });
    }
}


// GeoJSON dışa aktarma işlevi
document.getElementById("export-geojson-btn").addEventListener("click", async function () {
    try {
        const response = await fetch("http://localhost:3000/api/points/geojson", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error("Failed to export GeoJSON");
        }

        const data = await response.json();
        const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "points.geojson";
        a.click();
        URL.revokeObjectURL(url);
        alert("GeoJSON exported successfully!");
    } catch (err) {
        console.error("Error exporting GeoJSON:", err);
        alert("An error occurred while exporting GeoJSON.");
    }
});
