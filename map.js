// Toast notification system
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    setTimeout(() => {
        toast.className = toast.className.replace('show', '');
    }, 3000);
}

// Map layers with fixed terrain layer
const mapLayers = {
    streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    }),
    terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap'
    })
};

// Initialize map with streets layer and layer control
const map = L.map('map', {
    layers: [mapLayers.streets]
}).setView([39.9334, 32.8597], 6);

// Add layer control to map
L.control.layers({
    "Streets": mapLayers.streets,
    "Satellite": mapLayers.satellite,
    "Terrain": mapLayers.terrain
}, null, {
    position: 'topright'
}).addTo(map);

let selectedMarker = null;
let selectedLatLng = null;
let drawControl;
let currentDrawing = null;
let isAddingPoint = false;

// Drawing controls
const drawOptions = {
    draw: {
        marker: false,
        circle: false,
        circlemarker: false,
        rectangle: false,
        polyline: {
            shapeOptions: {
                color: '#3388ff',
                weight: 4
            }
        },
        polygon: {
            allowIntersection: false,
            shapeOptions: {
                color: '#3388ff',
                fillColor: '#3388ff',
                fillOpacity: 0.2,
                weight: 2
            }
        }
    },
    edit: false
};

// Add drawing controls to map
drawControl = new L.Control.Draw(drawOptions);
map.addControl(drawControl);

// Helper Functions
function createCustomMarker(latlng, options = {}) {
    return L.marker(latlng, {
        ...options,
        icon: L.divIcon({
            className: 'custom-marker',
            html: '<i class="fas fa-map-marker-alt"></i>',
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
        })
    });
}

function clearMarkers() {
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });
}

function isWithinTurkey(lat, lng) {
    const minLat = 35.0, maxLat = 42.0;
    const minLng = 25.0, maxLng = 45.0;
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

// Event Handlers
map.on('click', function(e) {
    if (!isAddingPoint) return;

    if (selectedMarker) {
        map.removeLayer(selectedMarker);
    }

    selectedMarker = createCustomMarker([e.latlng.lat, e.latlng.lng], { 
        draggable: true 
    }).addTo(map);

    const popupContent = document.createElement('div');
    popupContent.className = 'marker-popup';
    popupContent.innerHTML = `
        <h4>Selected Point</h4>
        <p>Lat: ${e.latlng.lat.toFixed(6)}<br>Lng: ${e.latlng.lng.toFixed(6)}</p>
        <button onclick="removeMarker()" class="btn-danger">
            <i class="fas fa-trash"></i> Remove
        </button>
    `;

    selectedMarker.bindPopup(popupContent).openPopup();

    selectedMarker.on('dragend', function(event) {
        const position = event.target.getLatLng();
        selectedLatLng = position;
        
        const newPopupContent = document.createElement('div');
        newPopupContent.className = 'marker-popup';
        newPopupContent.innerHTML = `
            <h4>Selected Point</h4>
            <p>Lat: ${position.lat.toFixed(6)}<br>Lng: ${position.lng.toFixed(6)}</p>
            <button onclick="removeMarker()" class="btn-danger">
                <i class="fas fa-trash"></i> Remove
            </button>
        `;
        selectedMarker.setPopupContent(newPopupContent);
        showToast('Marker position updated', 'info');
    });

    selectedLatLng = e.latlng;
    showToast('New marker placed', 'success');
});

map.on('draw:created', function(e) {
    currentDrawing = e.layer;
    const type = e.layerType;
    const coordinates = type === 'polyline' ? 
        e.layer.getLatLngs() : 
        e.layer.getLatLngs()[0];

    map.addLayer(currentDrawing);
    document.getElementById('drawing-form').style.display = 'block';
    document.getElementById('drawing-type').value = type;
});

map.on('draw:drawstart', function() {
    document.getElementById('cancel-drawing').style.display = 'block';
});

map.on('draw:drawstop', function() {
    document.getElementById('draw-line').classList.remove('active');
    document.getElementById('draw-polygon').classList.remove('active');
    document.getElementById('cancel-drawing').style.display = 'none';
});

// Form Handlers
document.getElementById('add-point-form').addEventListener('submit', function(e) {
    e.preventDefault();
    if (!selectedLatLng) {
        showToast('Please select a location on the map first', 'warning');
        return;
    }

    const description = document.getElementById('description').value;
    const imageFile = document.getElementById('image').files[0];
    const formData = new FormData();
    
    formData.append('description', description);
    formData.append('latitude', selectedLatLng.lat);
    formData.append('longitude', selectedLatLng.lng);
    if (imageFile) {
        formData.append('image', imageFile);
    }

    const token = localStorage.getItem('token');
    fetch('http://localhost:3000/api/points', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    })
    .then(response => {
        if (!response.ok) throw new Error('Error adding point');
        return response.json();
    })
    .then(() => {
        showToast('Point added successfully', 'success');
        this.reset();
        disableAddPointMode();
        document.getElementById('load-points-btn').click();
    })
    .catch(err => {
        console.error('Error adding point:', err);
        showToast('Error adding point', 'error');
    });
});

document.getElementById('update-point-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData();
    const id = document.getElementById('update-point-id').value;
    
    formData.append('description', document.getElementById('update-description').value);
    formData.append('latitude', document.getElementById('update-latitude').value);
    formData.append('longitude', document.getElementById('update-longitude').value);
    
    const imageFile = document.getElementById('update-image').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }

    try {
        const response = await fetch(`http://localhost:3000/api/points/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        showToast('Point updated successfully', 'success');
        document.getElementById('update-form-container').style.display = 'none';
        
        clearMarkers();
        document.getElementById('load-points-btn').click();
    } catch (err) {
        console.error('Error updating point:', err);
        showToast('Error updating point: ' + err.message, 'error');
    }
});

document.getElementById('save-drawing-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const type = document.getElementById('drawing-type').value;
    const name = document.getElementById('drawing-name').value;
    const color = document.getElementById('drawing-color').value;

    if (!currentDrawing) {
        showToast('No drawing to save', 'error');
        return;
    }

    const coordinates = type === 'polyline' ? 
        currentDrawing.getLatLngs() : 
        currentDrawing.getLatLngs()[0];

    const style = {
        color: color,
        weight: type === 'polyline' ? 4 : 2,
        fillColor: color,
        fillOpacity: type === 'polygon' ? 0.2 : 0
    };

    try {
        const response = await fetch(`http://localhost:3000/api/${type === 'polyline' ? 'lines' : 'polygons'}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                name: name,
                coordinates: coordinates,
                style: style
            })
        });

        if (!response.ok) throw new Error('Failed to save drawing');

        showToast(`${type} saved successfully`, 'success');
        document.getElementById('drawing-form').style.display = 'none';
        loadDrawings();
    } catch (error) {
        console.error('Error saving drawing:', error);
        showToast('Error saving drawing', 'error');
    }
});

// Button Click Handlers
document.getElementById('load-points-btn').addEventListener('click', function() {
    const token = localStorage.getItem('token');
    this.classList.add('loading');
    
    fetch('http://localhost:3000/api/points', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        if (!Array.isArray(data)) throw new Error('Invalid data format');
        clearMarkers();
        
        data.forEach(point => {
            const marker = createCustomMarker([point.latitude, point.longitude]).addTo(map);
            marker.bindPopup(createMarkerPopup(point));
        });
        showToast('Points loaded successfully', 'success');
    })
    .catch(err => {
        console.error('Error loading points:', err);
        showToast('Error loading points', 'error');
    })
    .finally(() => {
        this.classList.remove('loading');
    });
});

document.getElementById('export-geojson-btn').addEventListener('click', function() {
    const token = localStorage.getItem('token');
    this.classList.add('loading');
    
    fetch('http://localhost:3000/api/points', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Error fetching points');
        return response.json();
    })
    .then(points => {
        const geojson = {
            type: 'FeatureCollection',
            features: points.map(point => ({
                type: 'Feature',
                properties: {
                    id: point.id,
                    description: point.description,
                    image_url: point.image_url
                },
                geometry: {
                    type: 'Point',
                    coordinates: [point.longitude, point.latitude]
                }
            }))
        };

        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'points.geojson';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('GeoJSON exported successfully', 'success');
    })
    .catch(err => {
        console.error('Error exporting GeoJSON:', err);
        showToast('Error exporting GeoJSON', 'error');
    })
    .finally(() => {
        this.classList.remove('loading');
    });
});

document.getElementById('draw-line').addEventListener('click', function() {
    new L.Draw.Polyline(map, drawOptions.draw.polyline).enable();
    this.classList.add('active');
});

document.getElementById('draw-polygon').addEventListener('click', function() {
    new L.Draw.Polygon(map, drawOptions.draw.polygon).enable();
    this.classList.add('active');
});

['domestic', 'abroad'].forEach(type => {
    document.getElementById(`filter-${type}`).addEventListener('click', function() {
        const token = localStorage.getItem('token');
        fetch('http://localhost:3000/api/points', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (!Array.isArray(data)) throw new Error('Invalid data format');
            clearMarkers();
            data.forEach(point => {
                const isDomestic = isWithinTurkey(point.latitude, point.longitude);
                if ((type === 'domestic' && isDomestic) || 
                    (type === 'abroad' && !isDomestic)) {
                    const marker = createCustomMarker([point.latitude, point.longitude]).addTo(map);
                    marker.bindPopup(`<b>${point.description}</b>`);
                }
            });
            showToast(`Filtered ${type} points`, 'info');
        })
        .catch(err => {
            console.error(`Error filtering ${type} points:`, err);
            showToast(`Error filtering ${type} points`, 'error');
        });
    });
});

document.getElementById('load-lines-btn').addEventListener('click', function() {
    this.classList.add('loading');
    loadLines().finally(() => {
        this.classList.remove('loading');
    });
});

document.getElementById('load-polygons-btn').addEventListener('click', function() {
    this.classList.add('loading');
    loadPolygons().finally(() => {
        this.classList.remove('loading');
    });
});

// Modal Functions
function openImageModal(imageUrl) {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-image');
    modalImg.src = imageUrl.replace(/\\/g, '/');
    modal.classList.add('show');
    modalImg.dataset.originalUrl = imageUrl;
    document.addEventListener('keydown', handleEscKey);
}

function closeImageModal() {
    const modal = document.getElementById('image-modal');
    modal.classList.remove('show');
}

function closeModalOnBackground(event) {
    if (event.target.className === 'image-modal') {
        closeImageModal();
    }
}

function stopPropagation(event) {
    event.stopPropagation();
}

function handleEscKey(event) {
    if (event.key === 'Escape') {
        closeImageModal();
        document.removeEventListener('keydown', handleEscKey);
    }
}

// Drawing Functions
function cancelDrawing() {
    if (currentDrawing) {
        map.removeLayer(currentDrawing);
        currentDrawing = null;
    }
    document.getElementById('drawing-form').style.display = 'none';
    document.getElementById('save-drawing-form').reset();
}

async function loadLines() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3000/api/lines', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const lines = await response.json();

        map.eachLayer((layer) => {
            if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
                map.removeLayer(layer);
            }
        });

        lines.forEach(line => {
            const coords = JSON.parse(line.coordinates);
            const style = JSON.parse(line.style);
            const polyline = L.polyline(coords, style).addTo(map);
            
            polyline.bindPopup(`
                <div class="drawing-popup">
                    <h4>${line.name}</h4>
                    <button onclick="deleteDrawing('lines', ${line.id})" class="btn-danger">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `);
        });
        showToast('Lines loaded successfully', 'success');
    } catch (error) {
        console.error('Error loading lines:', error);
        showToast('Error loading lines', 'error');
    }
}

async function loadPolygons() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3000/api/polygons', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const polygons = await response.json();

        map.eachLayer((layer) => {
            if (layer instanceof L.Polygon) {
                map.removeLayer(layer);
            }
        });

        polygons.forEach(polygon => {
            const coords = JSON.parse(polygon.coordinates);
            const style = JSON.parse(polygon.style);
            const poly = L.polygon(coords, style).addTo(map);
            
            poly.bindPopup(`
                <div class="drawing-popup">
                    <h4>${polygon.name}</h4>
                    <button onclick="deleteDrawing('polygons', ${polygon.id})" class="btn-danger">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            `);
        });
        showToast('Polygons loaded successfully', 'success');
    } catch (error) {
        console.error('Error loading polygons:', error);
        showToast('Error loading polygons', 'error');
    }
}

async function loadDrawings() {
    await Promise.all([loadLines(), loadPolygons()]);
}

async function deleteDrawing(type, id) {
    if (!confirm(`Are you sure you want to delete this ${type.slice(0, -1)}?`)) return;

    try {
        const response = await fetch(`http://localhost:3000/api/${type}/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error(`Failed to delete ${type.slice(0, -1)}`);

        showToast(`${type.slice(0, -1)} deleted successfully`, 'success');
        loadDrawings();
    } catch (error) {
        console.error('Error deleting drawing:', error);
        showToast('Error deleting drawing', 'error');
    }
}

// Point Functions
function removeMarker() {
    if (selectedMarker) {
        map.removeLayer(selectedMarker);
        selectedMarker = null;
        selectedLatLng = null;
        showToast('Marker removed', 'warning');
    }
}

function editPoint(id, description, latitude, longitude, imageUrl) {
    document.getElementById('update-point-id').value = id;
    document.getElementById('update-description').value = description;
    document.getElementById('update-latitude').value = latitude;
    document.getElementById('update-longitude').value = longitude;
    
    const imagePreview = document.getElementById('current-image-preview');
    if (imageUrl) {
        const fullImageUrl = `http://localhost:3000/${imageUrl}`;
        imagePreview.innerHTML = `
            <img src="${fullImageUrl}" 
                 alt="Current image" 
                 class="preview-image"
                 onclick="openImageModal('${fullImageUrl}')">
        `;
    } else {
        imagePreview.innerHTML = '<p>No current image</p>';
    }

    if (selectedMarker) {
        map.removeLayer(selectedMarker);
    }

    selectedMarker = createCustomMarker([latitude, longitude], { 
        draggable: true 
    }).addTo(map);

    selectedMarker.on('dragend', function(event) {
        const position = event.target.getLatLng();
        document.getElementById('update-latitude').value = position.lat.toFixed(6);
        document.getElementById('update-longitude').value = position.lng.toFixed(6);
        showToast('Marker position updated', 'info');
    });

    map.setView([latitude, longitude], 13);
    document.getElementById('update-form-container').style.display = 'block';
    showToast('Edit mode activated', 'info');
}

function deletePoint(id) {
    if (confirm('Are you sure you want to delete this point?')) {
        const token = localStorage.getItem('token');
        fetch(`http://localhost:3000/api/points/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) throw new Error('Error deleting point');
            return response.json();
        })
        .then(() => {
            showToast('Point deleted successfully', 'success');
            clearMarkers();
            document.getElementById('load-points-btn').click();
        })
        .catch(err => {
            console.error('Error deleting point:', err);
            showToast('Error deleting point', 'error');
        });
    }
}

function closeUpdateForm() {
    document.getElementById('update-form-container').style.display = 'none';
    if (selectedMarker) {
        map.removeLayer(selectedMarker);
        selectedMarker = null;
    }
}

function createMarkerPopup(point) {
    const popupContent = document.createElement('div');
    popupContent.className = 'marker-popup';
    
    let imageHtml = '';
    if (point.image_url) {
        const fullImageUrl = `http://localhost:3000/${point.image_url.replace(/\\/g, '/')}`;
        imageHtml = `
            <img src="${fullImageUrl}" 
                 alt="${point.description}" 
                 class="popup-image"
                 onclick="openImageModal('${fullImageUrl}')"
                 style="cursor: pointer;">
        `;
    }
    
    popupContent.innerHTML = `
        <h4>${point.description}</h4>
        <p>Lat: ${point.latitude}<br>Lng: ${point.longitude}</p>
        ${imageHtml}
        <div class="popup-actions">
            <button onclick="editPoint(${point.id}, '${point.description}', 
                    ${point.latitude}, ${point.longitude}, '${point.image_url || ''}')" 
                    class="btn-primary">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button onclick="deletePoint(${point.id})" 
                    class="btn-danger">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    
    return popupContent;
}

// Add these new functions for point adding mode
function enableAddPointMode() {
    isAddingPoint = true;
    document.getElementById('toggle-add-point').classList.add('active');
    document.getElementById('add-point-form').style.display = 'block';
    showToast('Click on the map to place a point', 'info');
}

function disableAddPointMode() {
    isAddingPoint = false;
    document.getElementById('toggle-add-point').classList.remove('active');
    document.getElementById('add-point-form').style.display = 'none';
    if (selectedMarker) {
        map.removeLayer(selectedMarker);
        selectedMarker = null;
        selectedLatLng = null;
    }
}

// Add event listeners for the add point toggle and cancel buttons
document.getElementById('toggle-add-point').addEventListener('click', function() {
    if (!isAddingPoint) {
        enableAddPointMode();
    } else {
        disableAddPointMode();
    }
});

document.getElementById('cancel-add-point').addEventListener('click', function() {
    disableAddPointMode();
});